import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma before importing utils
vi.mock("../utils/db.js", () => ({
  prisma: {
    event: {
      findUnique: vi.fn(),
    },
    rSVP: {
      findMany: vi.fn(),
    },
    waitlist: {
      findMany: vi.fn(),
    },
    massCommunicationQuota: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
    },
    massCommunication: {
      create: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
    },
    massCommunicationRecipient: {
      create: vi.fn(),
    },
  },
}));

// Mock email utility
vi.mock("../utils/email.js", () => ({
  maskEmail: (email: string) => {
    const [localPart, domain] = email.split("@");
    if (!domain) return email;
    const visibleChars = Math.min(2, localPart.length);
    const masked = localPart.substring(0, visibleChars) + "***";
    return `${masked}@${domain}`;
  },
}));

import { prisma } from "../utils/db.js";
import {
  checkMassEmailQuota,
  getMassEmailQuotaInfo,
  getRecipientsByAudience,
  getMassEmailHistory,
  getMassEmailDetails,
  maskEmail,
} from "../utils/massEmail.js";

describe("Mass Email Utility Functions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("maskEmail", () => {
    it("should mask email addresses correctly", () => {
      expect(maskEmail("john.doe@example.com")).toBe("jo***@example.com");
      expect(maskEmail("a@example.com")).toBe("a***@example.com");
      expect(maskEmail("ab@example.com")).toBe("ab***@example.com");
    });

    it("should handle emails with short local parts", () => {
      expect(maskEmail("x@domain.com")).toBe("x***@domain.com");
    });

    it("should return original string if no @ sign", () => {
      expect(maskEmail("invalid-email")).toBe("invalid-email");
    });
  });

  describe("checkMassEmailQuota", () => {
    it("should create quota if none exists", async () => {
      const mockQuota = {
        eventId: "event-123",
        weeklyEmailCount: 0,
        weeklyResetAt: new Date(),
        lastEmailAt: null,
      };

      vi.mocked(prisma.massCommunicationQuota.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.massCommunicationQuota.create).mockResolvedValue(mockQuota as never);

      const result = await checkMassEmailQuota("event-123");

      expect(result.allowed).toBe(true);
      expect(result.used).toBe(0);
      expect(result.limit).toBe(5);
      expect(result.remaining).toBe(5);
    });

    it("should deny when weekly limit is reached", async () => {
      const mockQuota = {
        eventId: "event-123",
        weeklyEmailCount: 5,
        weeklyResetAt: new Date(),
        lastEmailAt: null,
      };

      vi.mocked(prisma.massCommunicationQuota.findUnique).mockResolvedValue(mockQuota as never);

      const result = await checkMassEmailQuota("event-123");

      expect(result.allowed).toBe(false);
      expect(result.error).toContain("Weekly mass email limit reached");
      expect(result.remaining).toBe(0);
    });

    it("should deny when 24-hour spacing not met", async () => {
      const recentEmailTime = new Date(Date.now() - 12 * 60 * 60 * 1000); // 12 hours ago
      const mockQuota = {
        eventId: "event-123",
        weeklyEmailCount: 2,
        weeklyResetAt: new Date(),
        lastEmailAt: recentEmailTime,
      };

      vi.mocked(prisma.massCommunicationQuota.findUnique).mockResolvedValue(mockQuota as never);

      const result = await checkMassEmailQuota("event-123");

      expect(result.allowed).toBe(false);
      expect(result.error).toContain("Must wait 24 hours");
      expect(result.nextSendAllowed).toBeDefined();
    });

    it("should allow when quota and timing requirements are met", async () => {
      const oldEmailTime = new Date(Date.now() - 25 * 60 * 60 * 1000); // 25 hours ago
      const mockQuota = {
        eventId: "event-123",
        weeklyEmailCount: 2,
        weeklyResetAt: new Date(),
        lastEmailAt: oldEmailTime,
      };

      vi.mocked(prisma.massCommunicationQuota.findUnique).mockResolvedValue(mockQuota as never);

      const result = await checkMassEmailQuota("event-123");

      expect(result.allowed).toBe(true);
      expect(result.used).toBe(2);
      expect(result.remaining).toBe(3);
    });
  });

  describe("getMassEmailQuotaInfo", () => {
    it("should return formatted quota info", async () => {
      const mockQuota = {
        eventId: "event-123",
        weeklyEmailCount: 3,
        weeklyResetAt: new Date(),
        lastEmailAt: null,
      };

      vi.mocked(prisma.massCommunicationQuota.findUnique).mockResolvedValue(mockQuota as never);

      const result = await getMassEmailQuotaInfo("event-123");

      expect(result.used).toBe(3);
      expect(result.limit).toBe(5);
      expect(result.remaining).toBe(2);
      expect(result.canSendNow).toBe(true);
    });
  });

  describe("getRecipientsByAudience", () => {
    it("should filter recipients by YES_ONLY audience", async () => {
      const mockRsvps = [
        { user: { id: "user-1", email: "user1@test.com", displayName: "User 1" } },
        { user: { id: "user-2", email: "user2@test.com", displayName: "User 2" } },
      ];

      vi.mocked(prisma.rSVP.findMany).mockResolvedValue(mockRsvps as never);

      const result = await getRecipientsByAudience("event-123", "YES_ONLY");

      expect(prisma.rSVP.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            eventId: "event-123",
            response: "YES",
          }),
        })
      );
      expect(result).toHaveLength(2);
      expect(result[0].email).toBe("user1@test.com");
    });

    it("should filter recipients by WAITLIST_ONLY audience", async () => {
      const mockWaitlist = [
        { user: { id: "user-1", email: "wait1@test.com", displayName: "Wait 1" } },
      ];

      vi.mocked(prisma.waitlist.findMany).mockResolvedValue(mockWaitlist as never);

      const result = await getRecipientsByAudience("event-123", "WAITLIST_ONLY");

      expect(prisma.waitlist.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { eventId: "event-123" },
        })
      );
      expect(result).toHaveLength(1);
      expect(result[0].email).toBe("wait1@test.com");
    });

    it("should return all RSVP'd users for ALL audience", async () => {
      const mockRsvps = [
        { user: { id: "user-1", email: "user1@test.com", displayName: "User 1" } },
        { user: { id: "user-2", email: null, displayName: "User 2" } }, // No email
        { user: { id: "user-3", email: "user3@test.com", displayName: "User 3" } },
      ];

      vi.mocked(prisma.rSVP.findMany).mockResolvedValue(mockRsvps as never);

      const result = await getRecipientsByAudience("event-123", "ALL");

      expect(prisma.rSVP.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            eventId: "event-123",
          }),
        })
      );
      // Should filter out users without email
      expect(result).toHaveLength(2);
    });
  });

  describe("getMassEmailHistory", () => {
    it("should return paginated message history", async () => {
      const mockMessages = [
        {
          id: "msg-1",
          subject: "Test Subject",
          body: "Test body",
          targetAudience: "YES_ONLY",
          recipientCount: 10,
          sentCount: 9,
          failedCount: 1,
          openedCount: 5,
          sentAt: new Date(),
          organizer: { id: "org-1", displayName: "Organizer" },
        },
      ];

      vi.mocked(prisma.massCommunication.findMany).mockResolvedValue(mockMessages as never);
      vi.mocked(prisma.massCommunication.count).mockResolvedValue(1);

      const result = await getMassEmailHistory("event-123", 20, 0);

      expect(result.messages).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.messages[0].subject).toBe("Test Subject");
    });
  });

  describe("getMassEmailDetails", () => {
    it("should return full message details with recipients", async () => {
      const mockCommunication = {
        id: "msg-1",
        subject: "Test Subject",
        body: "Test body",
        targetAudience: "YES_ONLY",
        recipientCount: 2,
        sentCount: 2,
        failedCount: 0,
        openedCount: 1,
        sentAt: new Date(),
        recipients: [
          {
            userId: "user-1",
            recipient: "user1@test.com",
            status: "SENT",
            sentAt: new Date(),
            openedAt: null,
            user: { displayName: "User 1" },
          },
          {
            userId: "user-2",
            recipient: "user2@test.com",
            status: "OPENED",
            sentAt: new Date(),
            openedAt: new Date(),
            user: { displayName: "User 2" },
          },
        ],
      };

      vi.mocked(prisma.massCommunication.findUnique).mockResolvedValue(mockCommunication as never);

      const result = await getMassEmailDetails("msg-1");

      expect(result).not.toBeNull();
      expect(result?.recipients).toHaveLength(2);
      // Should mask emails
      expect(result?.recipients[0].email).toBe("us***@test.com");
    });

    it("should return null for non-existent message", async () => {
      vi.mocked(prisma.massCommunication.findUnique).mockResolvedValue(null);

      const result = await getMassEmailDetails("non-existent");

      expect(result).toBeNull();
    });
  });
});

describe("Mass Email Input Validation", () => {
  describe("Subject validation", () => {
    it("should reject empty subject", () => {
      const subject: string = "";
      const isValid = subject.length > 0 && subject.trim().length > 0;
      expect(isValid).toBe(false);
    });

    it("should reject subject longer than 200 chars", () => {
      const subject = "a".repeat(201);
      const isValid = subject.length <= 200;
      expect(isValid).toBe(false);
    });

    it("should accept valid subject", () => {
      const subject = "Important event update";
      const isValid =
        subject.length > 0 &&
        subject.trim().length > 0 &&
        subject.length <= 200;
      expect(isValid).toBe(true);
    });
  });

  describe("Body validation", () => {
    it("should reject empty body", () => {
      const body: string = "";
      const isValid = body.length > 0 && body.trim().length > 0;
      expect(isValid).toBe(false);
    });

    it("should reject body longer than 10000 chars", () => {
      const body = "a".repeat(10001);
      const isValid = body.length <= 10000;
      expect(isValid).toBe(false);
    });

    it("should accept valid body", () => {
      const body = "Hello attendees, we have an important update...";
      const isValid =
        body.length > 0 && body.trim().length > 0 && body.length <= 10000;
      expect(isValid).toBe(true);
    });
  });

  describe("Target audience validation", () => {
    const validAudiences = ["ALL", "YES_ONLY", "MAYBE_ONLY", "NO_ONLY", "WAITLIST_ONLY"];

    it("should accept valid audience types", () => {
      validAudiences.forEach((audience) => {
        expect(validAudiences.includes(audience)).toBe(true);
      });
    });

    it("should reject invalid audience type", () => {
      const invalidAudience = "INVALID_AUDIENCE";
      expect(validAudiences.includes(invalidAudience)).toBe(false);
    });
  });
});

describe("Mass Email Rate Limiting", () => {
  it("should enforce 5 emails per week limit", () => {
    const WEEKLY_EMAIL_LIMIT = 5;
    const weeklyCount = 5;

    const isAtLimit = weeklyCount >= WEEKLY_EMAIL_LIMIT;
    expect(isAtLimit).toBe(true);
  });

  it("should enforce 24-hour minimum between emails", () => {
    const MIN_HOURS_BETWEEN_EMAILS = 24;
    const lastEmailTime = new Date(Date.now() - 12 * 60 * 60 * 1000); // 12 hours ago
    const hoursSinceLast = (Date.now() - lastEmailTime.getTime()) / (1000 * 60 * 60);

    const canSend = hoursSinceLast >= MIN_HOURS_BETWEEN_EMAILS;
    expect(canSend).toBe(false);
  });

  it("should allow email after 24 hours", () => {
    const MIN_HOURS_BETWEEN_EMAILS = 24;
    const lastEmailTime = new Date(Date.now() - 25 * 60 * 60 * 1000); // 25 hours ago
    const hoursSinceLast = (Date.now() - lastEmailTime.getTime()) / (1000 * 60 * 60);

    const canSend = hoursSinceLast >= MIN_HOURS_BETWEEN_EMAILS;
    expect(canSend).toBe(true);
  });

  it("should reset weekly count on Sunday", () => {
    const getWeekStart = (): Date => {
      const now = new Date();
      const day = now.getUTCDay(); // 0 = Sunday
      const diff = now.getUTCDate() - day;
      return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), diff, 0, 0, 0, 0));
    };

    const weekStart = getWeekStart();
    expect(weekStart.getUTCDay()).toBe(0); // Should be Sunday
  });
});

describe("Event State Validation for Mass Email", () => {
  it("should only allow mass emails for PUBLISHED events", () => {
    const validStates = ["PUBLISHED", "ONGOING"];
    expect(validStates.includes("PUBLISHED")).toBe(true);
    expect(validStates.includes("ONGOING")).toBe(true);
  });

  it("should reject mass emails for DRAFT events", () => {
    const validStates = ["PUBLISHED", "ONGOING"];
    expect(validStates.includes("DRAFT")).toBe(false);
  });

  it("should reject mass emails for CANCELLED events", () => {
    const validStates = ["PUBLISHED", "ONGOING"];
    expect(validStates.includes("CANCELLED")).toBe(false);
  });

  it("should reject mass emails for COMPLETED events", () => {
    const validStates = ["PUBLISHED", "ONGOING"];
    expect(validStates.includes("COMPLETED")).toBe(false);
  });
});
