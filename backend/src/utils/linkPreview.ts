import { createHash } from "crypto";

/**
 * Link preview generation utility
 * Extracts URLs from content and fetches Open Graph metadata
 */

export interface LinkPreview {
  url: string;
  title: string | null;
  description: string | null;
  imageUrl: string | null;
}

// URL regex that matches http(s) URLs
const URL_REGEX = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/gi;

// Cache for link previews (simple in-memory cache)
// In production, this should use Redis
const previewCache = new Map<string, { preview: LinkPreview | null; timestamp: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Extract first URL from text content
 */
export function extractUrl(content: string): string | null {
  const match = content.match(URL_REGEX);
  return match ? match[0] : null;
}

/**
 * Parse Open Graph meta tags from HTML
 */
function parseOpenGraphTags(html: string): Partial<LinkPreview> {
  const ogData: Partial<LinkPreview> = {};

  // Extract og:title
  const titleMatch = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]*)"[^>]*>/i);
  if (titleMatch) {
    ogData.title = titleMatch[1];
  }

  // Fallback to <title> tag
  if (!ogData.title) {
    const titleTagMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleTagMatch) {
      ogData.title = titleTagMatch[1];
    }
  }

  // Extract og:description
  const descMatch = html.match(/<meta[^>]*property="og:description"[^>]*content="([^"]*)"[^>]*>/i);
  if (descMatch) {
    ogData.description = descMatch[1];
  }

  // Fallback to meta description
  if (!ogData.description) {
    const metaDescMatch = html.match(/<meta[^>]*name="description"[^>]*content="([^"]*)"[^>]*>/i);
    if (metaDescMatch) {
      ogData.description = metaDescMatch[1];
    }
  }

  // Extract og:image
  const imageMatch = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]*)"[^>]*>/i);
  if (imageMatch) {
    ogData.imageUrl = imageMatch[1];
  }

  return ogData;
}

/**
 * Validate URL to prevent SSRF attacks
 */
function isUrlSafe(url: string): boolean {
  try {
    const parsed = new URL(url);

    // Only allow HTTP/HTTPS
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return false;
    }

    // Block localhost and private IP ranges
    const hostname = parsed.hostname.toLowerCase();

    // Block localhost variants
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "[::1]" ||
      hostname.startsWith("127.") ||
      hostname.startsWith("0.")
    ) {
      return false;
    }

    // Block private IP ranges (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16)
    if (
      hostname.startsWith("10.") ||
      hostname.startsWith("192.168.") ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname)
    ) {
      return false;
    }

    // Block link-local addresses (169.254.0.0/16)
    if (hostname.startsWith("169.254.")) {
      return false;
    }

    // Block cloud metadata endpoints
    if (hostname === "169.254.169.254" || hostname === "metadata.google.internal") {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Fetch link preview for a URL
 */
export async function fetchLinkPreview(url: string): Promise<LinkPreview | null> {
  // Validate URL to prevent SSRF
  if (!isUrlSafe(url)) {
    console.warn("Blocked unsafe URL for link preview:", url);
    return null;
  }

  // Check cache first
  const cached = previewCache.get(url);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.preview;
  }

  try {
    // Fetch the URL with timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000); // 5 second timeout

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Gather-Bot/1.0 (+https://gather.app)",
      },
      redirect: "follow",
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("text/html")) {
      // Not an HTML page, skip preview
      return null;
    }

    const html = await response.text();
    const ogData = parseOpenGraphTags(html);

    const preview: LinkPreview = {
      url,
      title: ogData.title || null,
      description: ogData.description || null,
      imageUrl: ogData.imageUrl || null,
    };

    // Cache the result
    previewCache.set(url, { preview, timestamp: Date.now() });

    return preview;
  } catch (error) {
    console.error("Error fetching link preview:", error);

    // Cache the failure to avoid repeated attempts
    previewCache.set(url, { preview: null, timestamp: Date.now() });

    return null;
  }
}

/**
 * Generate link preview from post content
 * Returns null if no URL found or preview generation fails
 */
export async function generateLinkPreview(content: string): Promise<LinkPreview | null> {
  const url = extractUrl(content);
  if (!url) {
    return null;
  }

  return fetchLinkPreview(url);
}
