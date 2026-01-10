import { describe, it, expect, beforeEach } from "@jest/globals";
import { extractUrl, fetchLinkPreview } from "../../utils/linkPreview.js";

describe("Link Preview Utility", () => {
  describe("extractUrl", () => {
    it("should extract HTTP URL from text", () => {
      const text = "Check out this site http://example.com for more info";
      const url = extractUrl(text);
      expect(url).toBe("http://example.com");
    });

    it("should extract HTTPS URL from text", () => {
      const text = "Visit https://www.example.com/path?query=value";
      const url = extractUrl(text);
      expect(url).toBe("https://www.example.com/path?query=value");
    });

    it("should return first URL when multiple URLs exist", () => {
      const text = "Check http://first.com and http://second.com";
      const url = extractUrl(text);
      expect(url).toBe("http://first.com");
    });

    it("should return null when no URL exists", () => {
      const text = "This is just plain text with no URL";
      const url = extractUrl(text);
      expect(url).toBeNull();
    });
  });

  describe("fetchLinkPreview", () => {
    it("should block localhost URLs", async () => {
      const preview = await fetchLinkPreview("http://localhost:3000/admin");
      expect(preview).toBeNull();
    });

    it("should block 127.0.0.1 URLs", async () => {
      const preview = await fetchLinkPreview("http://127.0.0.1/secret");
      expect(preview).toBeNull();
    });

    it("should block private IP ranges (10.x.x.x)", async () => {
      const preview = await fetchLinkPreview("http://10.0.0.1/internal");
      expect(preview).toBeNull();
    });

    it("should block private IP ranges (192.168.x.x)", async () => {
      const preview = await fetchLinkPreview("http://192.168.1.1/router");
      expect(preview).toBeNull();
    });

    it("should block private IP ranges (172.16-31.x.x)", async () => {
      const preview = await fetchLinkPreview("http://172.16.0.1/internal");
      expect(preview).toBeNull();
    });

    it("should block cloud metadata endpoints", async () => {
      const preview1 = await fetchLinkPreview("http://169.254.169.254/latest/meta-data");
      const preview2 = await fetchLinkPreview("http://metadata.google.internal/computeMetadata");
      expect(preview1).toBeNull();
      expect(preview2).toBeNull();
    });

    it("should block non-HTTP protocols", async () => {
      const preview1 = await fetchLinkPreview("file:///etc/passwd");
      const preview2 = await fetchLinkPreview("ftp://example.com/file");
      expect(preview1).toBeNull();
      expect(preview2).toBeNull();
    });

    it("should handle invalid URLs gracefully", async () => {
      const preview = await fetchLinkPreview("not-a-valid-url");
      expect(preview).toBeNull();
    });
  });
});
