import type { Request } from "express";
import {
  parseUserAgent,
  getIpAddress,
  parseDeviceInfo,
  getLocationFromIp,
  isNewDevice,
} from "../utils/deviceInfo.js";
import { prisma } from "../utils/db.js";
import { generateSessionToken } from "../utils/verification.js";

describe("Device Info Utilities", () => {
  describe("parseUserAgent", () => {
    it("should identify iPhone", () => {
      const ua =
        "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15";
      const result = parseUserAgent(ua);

      expect(result.deviceType).toBe("mobile");
      expect(result.deviceName).toBe("iPhone");
    });

    it("should identify iPad", () => {
      const ua =
        "Mozilla/5.0 (iPad; CPU OS 15_0 like Mac OS X) AppleWebKit/605.1.15";
      const result = parseUserAgent(ua);

      expect(result.deviceType).toBe("tablet");
      expect(result.deviceName).toBe("iPad");
    });

    it("should identify Android phone", () => {
      const ua =
        "Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36";
      const result = parseUserAgent(ua);

      expect(result.deviceType).toBe("mobile");
      expect(result.deviceName).toBe("Android Phone");
    });

    it("should identify Android tablet", () => {
      const ua =
        "Mozilla/5.0 (Linux; Android 11; SM-T870) AppleWebKit/537.36";
      const result = parseUserAgent(ua);

      expect(result.deviceType).toBe("tablet");
      expect(result.deviceName).toBe("Android Tablet");
    });

    it("should identify Chrome on Windows", () => {
      const ua =
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36";
      const result = parseUserAgent(ua);

      expect(result.deviceType).toBe("desktop");
      expect(result.deviceName).toBe("Chrome on Windows");
    });

    it("should identify Safari on macOS", () => {
      const ua =
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Safari/605.1.15";
      const result = parseUserAgent(ua);

      expect(result.deviceType).toBe("desktop");
      expect(result.deviceName).toBe("Safari on macOS");
    });

    it("should identify Firefox on Linux", () => {
      const ua =
        "Mozilla/5.0 (X11; Linux x86_64; rv:89.0) Gecko/20100101 Firefox/89.0";
      const result = parseUserAgent(ua);

      expect(result.deviceType).toBe("desktop");
      expect(result.deviceName).toBe("Firefox on Linux");
    });

    it("should handle Edge browser", () => {
      const ua =
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36 Edg/91.0.864.59";
      const result = parseUserAgent(ua);

      expect(result.deviceType).toBe("desktop");
      expect(result.deviceName).toBe("Edge on Windows");
    });

    it("should handle unknown user agents", () => {
      const ua = "UnknownBot/1.0";
      const result = parseUserAgent(ua);

      expect(result.deviceType).toBe("desktop");
      expect(result.deviceName).toContain("Unknown");
    });
  });

  describe("getIpAddress", () => {
    it("should extract IP from x-forwarded-for header", () => {
      const req = {
        headers: {
          "x-forwarded-for": "203.0.113.1, 198.51.100.1",
        },
        socket: {
          remoteAddress: "192.168.1.1",
        },
      } as unknown as Request;

      const ip = getIpAddress(req);
      expect(ip).toBe("203.0.113.1");
    });

    it("should extract IP from x-real-ip header", () => {
      const req = {
        headers: {
          "x-real-ip": "203.0.113.1",
        },
        socket: {
          remoteAddress: "192.168.1.1",
        },
      } as unknown as Request;

      const ip = getIpAddress(req);
      expect(ip).toBe("203.0.113.1");
    });

    it("should fall back to socket IP", () => {
      const req = {
        headers: {},
        socket: {
          remoteAddress: "192.168.1.1",
        },
      } as unknown as Request;

      const ip = getIpAddress(req);
      expect(ip).toBe("192.168.1.1");
    });

    it("should handle IPv6 addresses", () => {
      const req = {
        headers: {
          "x-forwarded-for": "2001:db8::1",
        },
        socket: {
          remoteAddress: "::1",
        },
      } as unknown as Request;

      const ip = getIpAddress(req);
      expect(ip).toBe("2001:db8::1");
    });

    it("should reject invalid IP formats in headers", () => {
      const req = {
        headers: {
          "x-forwarded-for": "not-an-ip-address",
        },
        socket: {
          remoteAddress: "192.168.1.1",
        },
      } as unknown as Request;

      const ip = getIpAddress(req);
      expect(ip).toBe("192.168.1.1");
    });

    it("should handle localhost", () => {
      const req = {
        headers: {},
        socket: {
          remoteAddress: "::1",
        },
      } as unknown as Request;

      const ip = getIpAddress(req);
      expect(ip).toBe("::1");
    });
  });

  describe("parseDeviceInfo", () => {
    it("should parse complete device information from request", () => {
      const req = {
        headers: {
          "user-agent":
            "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15",
          "x-forwarded-for": "203.0.113.1",
        },
        socket: {
          remoteAddress: "192.168.1.1",
        },
      } as unknown as Request;

      const info = parseDeviceInfo(req);

      expect(info.deviceType).toBe("mobile");
      expect(info.deviceName).toBe("iPhone");
      expect(info.ipAddress).toBe("203.0.113.1");
    });

    it("should handle missing user agent", () => {
      const req = {
        headers: {},
        socket: {
          remoteAddress: "192.168.1.1",
        },
      } as unknown as Request;

      const info = parseDeviceInfo(req);

      expect(info.deviceType).toBe("desktop");
      expect(info.deviceName).toContain("Unknown");
      expect(info.ipAddress).toBe("192.168.1.1");
    });
  });

  describe("getLocationFromIp", () => {
    it("should return null for local IPs", () => {
      expect(getLocationFromIp("127.0.0.1")).toBeNull();
      expect(getLocationFromIp("192.168.1.1")).toBeNull();
      expect(getLocationFromIp("10.0.0.1")).toBeNull();
      expect(getLocationFromIp("::1")).toBeNull();
    });

    it("should return null for public IPs (placeholder)", () => {
      // Currently returns null as it's a placeholder
      expect(getLocationFromIp("203.0.113.1")).toBeNull();
    });
  });

  describe("isNewDevice", () => {
    let userId: string;

    beforeAll(async () => {
      // Create a test user
      const user = await prisma.user.create({
        data: {
          phone: "+15555550000",
          displayName: "Device Test User",
        },
      });
      userId = user.id;
    });

    afterAll(async () => {
      // Clean up
      await prisma.session.deleteMany({ where: { userId } });
      await prisma.user.delete({ where: { id: userId } });
      await prisma.$disconnect();
    });

    it("should return true for first device", async () => {
      const isNew = await isNewDevice(
        userId,
        "mobile",
        "iPhone",
        "203.0.113.1"
      );

      expect(isNew).toBe(true);
    });

    it("should return false for existing device", async () => {
      // Create a session with this device
      await prisma.session.create({
        data: {
          userId,
          token: generateSessionToken(),
          deviceType: "mobile",
          deviceName: "iPhone",
          ipAddress: "203.0.113.1",
          location: null,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });

      const isNew = await isNewDevice(
        userId,
        "mobile",
        "iPhone",
        "203.0.113.1"
      );

      expect(isNew).toBe(false);

      // Clean up
      await prisma.session.deleteMany({
        where: { userId, deviceType: "mobile", deviceName: "iPhone" },
      });
    });

    it("should return true for different device type", async () => {
      // Create a session with desktop device
      await prisma.session.create({
        data: {
          userId,
          token: generateSessionToken(),
          deviceType: "desktop",
          deviceName: "Chrome on macOS",
          ipAddress: "203.0.113.1",
          location: null,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });

      // Check for mobile device
      const isNew = await isNewDevice(
        userId,
        "mobile",
        "iPhone",
        "203.0.113.1"
      );

      expect(isNew).toBe(true);

      // Clean up
      await prisma.session.deleteMany({ where: { userId } });
    });

    it("should return true for different IP address", async () => {
      // Create a session with one IP
      await prisma.session.create({
        data: {
          userId,
          token: generateSessionToken(),
          deviceType: "mobile",
          deviceName: "iPhone",
          ipAddress: "203.0.113.1",
          location: null,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });

      // Check for same device but different IP
      const isNew = await isNewDevice(
        userId,
        "mobile",
        "iPhone",
        "198.51.100.1"
      );

      expect(isNew).toBe(true);

      // Clean up
      await prisma.session.deleteMany({ where: { userId } });
    });
  });
});
