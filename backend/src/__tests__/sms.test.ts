import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database module before importing sms utils
vi.mock("../utils/db.js", () => ({
  prisma: {
    smsQuota: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
    },
    smsInvitation: {
      groupBy: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    inviteLink: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    event: {
      findUnique: vi.fn(),
    },
  },
}));

import { maskPhone } from "../utils/sms.js";

describe("SMS Utils", () => {
  describe("maskPhone", () => {
    it("should mask phone number showing only last 4 digits", () => {
      expect(maskPhone("+15551234567")).toBe("***4567");
    });

    it("should handle phone numbers without country code", () => {
      expect(maskPhone("5551234567")).toBe("***4567");
    });

    it("should handle phone numbers with formatting", () => {
      // Digits only are extracted, so dashes don't matter
      expect(maskPhone("555-123-4567")).toBe("***4567");
    });

    it("should return original for very short numbers", () => {
      expect(maskPhone("1234")).toBe("1234");
    });

    it("should handle empty string", () => {
      expect(maskPhone("")).toBe("");
    });

    it("should handle international numbers", () => {
      expect(maskPhone("+442012345678")).toBe("***5678");
    });
  });
});
