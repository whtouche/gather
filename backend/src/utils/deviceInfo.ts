import type { Request } from "express";

export interface ParsedDeviceInfo {
  deviceType: string;
  deviceName: string;
  ipAddress: string | null;
}

/**
 * Parse device information from user agent string
 */
export function parseUserAgent(userAgent: string): {
  deviceType: string;
  deviceName: string;
} {
  const ua = userAgent.toLowerCase();

  // Determine device type
  let deviceType = "desktop";
  if (/(iphone|ipod|android.*mobile|windows phone)/i.test(userAgent)) {
    deviceType = "mobile";
  } else if (/(ipad|android(?!.*mobile)|tablet)/i.test(userAgent)) {
    deviceType = "tablet";
  }

  // Determine device name
  let deviceName = "Unknown Device";

  // Mobile devices
  if (/iphone/i.test(userAgent)) {
    deviceName = "iPhone";
  } else if (/ipad/i.test(userAgent)) {
    deviceName = "iPad";
  } else if (/android.*mobile/i.test(userAgent)) {
    deviceName = "Android Phone";
  } else if (/android/i.test(userAgent)) {
    deviceName = "Android Tablet";
  } else if (/windows phone/i.test(userAgent)) {
    deviceName = "Windows Phone";
  } else {
    // Desktop browsers
    let browser = "Unknown Browser";
    if (ua.includes("edg")) {
      browser = "Edge";
    } else if (ua.includes("chrome")) {
      browser = "Chrome";
    } else if (ua.includes("safari")) {
      browser = "Safari";
    } else if (ua.includes("firefox")) {
      browser = "Firefox";
    } else if (ua.includes("opera") || ua.includes("opr")) {
      browser = "Opera";
    }

    let os = "Unknown OS";
    if (ua.includes("windows")) {
      os = "Windows";
    } else if (ua.includes("mac os")) {
      os = "macOS";
    } else if (ua.includes("linux")) {
      os = "Linux";
    } else if (ua.includes("cros")) {
      os = "Chrome OS";
    }

    deviceName = `${browser} on ${os}`;
  }

  return { deviceType, deviceName };
}

/**
 * Extract IP address from request, accounting for proxies
 *
 * Note: In production, only trust proxy headers if the application is behind
 * a trusted reverse proxy (nginx, cloudflare, etc.). Configure Express to trust
 * proxy with app.set('trust proxy', true) only when appropriate.
 */
export function getIpAddress(req: Request): string | null {
  // Check for proxy headers first - these should only be trusted
  // if Express is configured with 'trust proxy' setting
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    const ips = typeof forwarded === "string" ? forwarded.split(",") : forwarded;
    // Get the first IP in the chain (original client IP)
    const clientIp = ips[0].trim();
    // Basic validation - ensure it looks like an IP address
    if (isValidIpFormat(clientIp)) {
      return clientIp;
    }
  }

  const realIp = req.headers["x-real-ip"];
  if (realIp && typeof realIp === "string" && isValidIpFormat(realIp)) {
    return realIp;
  }

  // Fall back to socket IP
  return req.socket.remoteAddress || null;
}

/**
 * Basic IP address format validation
 */
function isValidIpFormat(ip: string): boolean {
  // IPv4 pattern
  const ipv4Pattern = /^(\d{1,3}\.){3}\d{1,3}$/;
  // IPv6 pattern (simplified)
  const ipv6Pattern = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;

  return ipv4Pattern.test(ip) || ipv6Pattern.test(ip) || ip === "::1";
}

/**
 * Parse complete device information from request
 */
export function parseDeviceInfo(req: Request): ParsedDeviceInfo {
  const userAgent = req.headers["user-agent"] || "";
  const { deviceType, deviceName } = parseUserAgent(userAgent);
  const ipAddress = getIpAddress(req);

  return {
    deviceType,
    deviceName,
    ipAddress,
  };
}

/**
 * Get approximate location from IP address
 * For now, this is a placeholder. In production, you would use a GeoIP service.
 */
export function getLocationFromIp(ipAddress: string): string | null {
  // Placeholder: In production, integrate with a GeoIP service like MaxMind, ipapi, etc.
  // For local/private IPs, return null
  if (
    ipAddress.startsWith("127.") ||
    ipAddress.startsWith("192.168.") ||
    ipAddress.startsWith("10.") ||
    ipAddress === "::1"
  ) {
    return null;
  }

  // Return placeholder for now
  return null;
}

/**
 * Check if this device/IP combination is new for the user
 */
export async function isNewDevice(
  userId: string,
  deviceType: string,
  deviceName: string,
  ipAddress: string | null
): Promise<boolean> {
  const { prisma } = await import("./db.js");

  // Check if there are any existing sessions with similar device info
  const existingSessions = await prisma.session.findFirst({
    where: {
      userId,
      deviceType,
      deviceName,
      // Consider same device if from same IP (optional - could be more strict)
      ...(ipAddress && { ipAddress }),
    },
  });

  return !existingSessions;
}
