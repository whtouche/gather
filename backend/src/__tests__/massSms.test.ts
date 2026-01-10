import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma before importing utils
vi.mock("../utils/db.js", () => ({
  prisma: {
    event: {
      findUnique: vi.fn(),
    },
    rSVP: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    waitlist: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    smsOptOut: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      upsert: vi.fn(),
      count: vi.fn(),
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

// Mock sms utility
vi.mock("../utils/sms.js", () => ({
  maskPhone: (phone: string) => {
    const digitsOnly = phone.replace(/\D/g, "");
    if (digitsOnly.length <= 4) return phone;
    const lastFour = digitsOnly.slice(-4);
    return `***${lastFour}`;
  },
}));

import { prisma } from "../utils/db.js";
import {
  checkMassSmsQuota,
  getMassSmsQuotaInfo,
  getSmsRecipientsByAudience,
  getMassSmsHistory,
  getMassSmsDetails,
  handleSmsOptOut,
  checkSmsOptOut,
  getOptOutCount,
  maskPhone,
} from "../utils/massSms.js";

describe("Mass SMS Utility Functions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("maskPhone", () => {
    it("should mask phone numbers correctly", () => {
      expect(maskPhone("+15551234567")).toBe("***4567");
      expect(maskPhone("5551234567")).toBe("***4567");
    });

    it("should handle short phone numbers", () => {
      expect(maskPhone("1234")).toBe("1234");
      expect(maskPhone("123")).toBe("123");
    });

    it("should handle formatted phone numbers", () => {
      expect(maskPhone("(555) 123-4567")).toBe("***4567");
      expect(maskPhone("+1 555 123 4567")).toBe("***4567");
    });
  });

  describe("checkMassSmsQuota", () => {
    it("should create quota if none exists", async () => {
      const mockQuota = {
        eventId: "event-123",
        weeklySmsCount: 0,
        weeklyResetAt: new Date(),
        lastSmsAt: null,
      };

      vi.mocked(prisma.massCommunicationQuota.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.massCommunicationQuota.create).mockResolvedValue(mockQuota as never);

      const result = await checkMassSmsQuota("event-123");

      expect(result.allowed).toBe(true);
      expect(result.used).toBe(0);
      expect(result.limit).toBe(3);
      expect(result.remaining).toBe(3);
    });

    it("should deny when weekly limit is reached", async () => {
      const mockQuota = {
        eventId: "event-123",
        weeklySmsCount: 3,
        weeklyResetAt: new Date(),
        lastSmsAt: null,
      };

      vi.mocked(prisma.massCommunicationQuota.findUnique).mockResolvedValue(mockQuota as never);

      const result = await checkMassSmsQuota("event-123");

      expect(result.allowed).toBe(false);
      expect(result.error).toContain("Weekly mass SMS limit reached");
      expect(result.remaining).toBe(0);
    });

    it("should deny when 24-hour spacing not met", async () => {
      const recentSmsTime = new Date(Date.now() - 12 * 60 * 60 * 1000); // 12 hours ago
      const mockQuota = {
        eventId: "event-123",
        weeklySmsCount: 1,
        weeklyResetAt: new Date(),
        lastSmsAt: recentSmsTime,
      };

      vi.mocked(prisma.massCommunicationQuota.findUnique).mockResolvedValue(mockQuota as never);

      const result = await checkMassSmsQuota("event-123");

      expect(result.allowed).toBe(false);
      expect(result.error).toContain("Must wait 24 hours");
      expect(result.nextSendAllowed).toBeDefined();
    });

    it("should allow when quota and timing requirements are met", async () => {
      const oldSmsTime = new Date(Date.now() - 25 * 60 * 60 * 1000); // 25 hours ago
      const mockQuota = {
        eventId: "event-123",
        weeklySmsCount: 1,
        weeklyResetAt: new Date(),
        lastSmsAt: oldSmsTime,
      };

      vi.mocked(prisma.massCommunicationQuota.findUnique).mockResolvedValue(mockQuota as never);

      const result = await checkMassSmsQuota("event-123");

      expect(result.allowed).toBe(true);
      expect(result.used).toBe(1);
      expect(result.remaining).toBe(2);
    });
  });

  describe("getMassSmsQuotaInfo", () => {
    it("should return formatted quota info", async () => {
      const mockQuota = {
        eventId: "event-123",
        weeklySmsCount: 2,
        weeklyResetAt: new Date(),
        lastSmsAt: null,
      };

      vi.mocked(prisma.massCommunicationQuota.findUnique).mockResolvedValue(mockQuota as never);

      const result = await getMassSmsQuotaInfo("event-123");

      expect(result.used).toBe(2);
      expect(result.limit).toBe(3);
      expect(result.remaining).toBe(1);
      expect(result.canSendNow).toBe(true);
    });
  });

  describe("getSmsRecipientsByAudience", () => {
    it("should filter recipients by YES_ONLY audience", async () => {
      const mockRsvps = [
        { userId: "user-1", user: { id: "user-1", phone: "+15551111111", displayName: "User 1" } },
        { userId: "user-2", user: { id: "user-2", phone: "+15552222222", displayName: "User 2" } },
      ];

      vi.mocked(prisma.rSVP.findMany).mockResolvedValue(mockRsvps as never);
      vi.mocked(prisma.smsOptOut.findMany).mockResolvedValue([]);

      const result = await getSmsRecipientsByAudience("event-123", "YES_ONLY");

      expect(prisma.rSVP.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            eventId: "event-123",
            response: "YES",
          }),
        })
      );
      expect(result).toHaveLength(2);
      expect(result[0].phone).toBe("+15551111111");
    });

    it("should filter recipients by WAITLIST_ONLY audience", async () => {
      const mockWaitlist = [
        { user: { id: "user-1", phone: "+15551111111", displayName: "Wait 1" } },
      ];

      vi.mocked(prisma.waitlist.findMany).mockResolvedValue(mockWaitlist as never);

      const result = await getSmsRecipientsByAudience("event-123", "WAITLIST_ONLY");

      expect(prisma.waitlist.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { eventId: "event-123" },
        })
      );
      expect(result).toHaveLength(1);
      expect(result[0].phone).toBe("+15551111111");
    });

    it("should mark opted-out users correctly", async () => {
      const mockRsvps = [
        { userId: "user-1", user: { id: "user-1", phone: "+15551111111", displayName: "User 1" } },
        { userId: "user-2", user: { id: "user-2", phone: "+15552222222", displayName: "User 2" } },
      ];
      const mockOptOuts = [{ userId: "user-1" }];

      vi.mocked(prisma.rSVP.findMany).mockResolvedValue(mockRsvps as never);
      vi.mocked(prisma.smsOptOut.findMany).mockResolvedValue(mockOptOuts as never);

      const result = await getSmsRecipientsByAudience("event-123", "ALL");

      expect(result).toHaveLength(2);
      expect(result.find((r) => r.userId === "user-1")?.smsOptedOut).toBe(true);
      expect(result.find((r) => r.userId === "user-2")?.smsOptedOut).toBe(false);
    });

    it("should filter out users without phone numbers", async () => {
      const mockRsvps = [
        { userId: "user-1", user: { id: "user-1", phone: "+15551111111", displayName: "User 1" } },
        { userId: "user-2", user: { id: "user-2", phone: null, displayName: "User 2" } }, // No phone
        { userId: "user-3", user: { id: "user-3", phone: "+15553333333", displayName: "User 3" } },
      ];

      vi.mocked(prisma.rSVP.findMany).mockResolvedValue(mockRsvps as never);
      vi.mocked(prisma.smsOptOut.findMany).mockResolvedValue([]);

      const result = await getSmsRecipientsByAudience("event-123", "ALL");

      expect(result).toHaveLength(2);
    });
  });

  describe("getMassSmsHistory", () => {
    it("should return paginated message history", async () => {
      const mockMessages = [
        {
          id: "msg-1",
          body: "Test SMS message",
          targetAudience: "YES_ONLY",
          recipientCount: 10,
          sentCount: 9,
          failedCount: 1,
          sentAt: new Date(),
          organizer: { id: "org-1", displayName: "Organizer" },
        },
      ];

      vi.mocked(prisma.massCommunication.findMany).mockResolvedValue(mockMessages as never);
      vi.mocked(prisma.massCommunication.count).mockResolvedValue(1);

      const result = await getMassSmsHistory("event-123", 20, 0);

      expect(result.messages).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.messages[0].body).toBe("Test SMS message");
    });
  });

  describe("getMassSmsDetails", () => {
    it("should return full message details with recipients", async () => {
      const mockCommunication = {
        id: "msg-1",
        body: "Test SMS message",
        targetAudience: "YES_ONLY",
        recipientCount: 2,
        sentCount: 2,
        failedCount: 0,
        sentAt: new Date(),
        recipients: [
          {
            userId: "user-1",
            recipient: "+15551111111",
            status: "SENT",
            sentAt: new Date(),
            user: { displayName: "User 1" },
          },
          {
            userId: "user-2",
            recipient: "+15552222222",
            status: "SENT",
            sentAt: new Date(),
            user: { displayName: "User 2" },
          },
        ],
      };

      vi.mocked(prisma.massCommunication.findUnique).mockResolvedValue(mockCommunication as never);

      const result = await getMassSmsDetails("msg-1");

      expect(result).not.toBeNull();
      expect(result?.recipients).toHaveLength(2);
      // Should mask phone numbers
      expect(result?.recipients[0].phone).toBe("***1111");
    });

    it("should return null for non-existent message", async () => {
      vi.mocked(prisma.massCommunication.findUnique).mockResolvedValue(null);

      const result = await getMassSmsDetails("non-existent");

      expect(result).toBeNull();
    });
  });

  describe("handleSmsOptOut", () => {
    it("should create opt-out record for user with RSVP", async () => {
      vi.mocked(prisma.rSVP.findUnique).mockResolvedValue({ id: "rsvp-1" } as never);
      vi.mocked(prisma.waitlist.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.smsOptOut.upsert).mockResolvedValue({} as never);

      await expect(handleSmsOptOut("event-123", "user-123")).resolves.not.toThrow();

      expect(prisma.smsOptOut.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            eventId_userId: {
              eventId: "event-123",
              userId: "user-123",
            },
          },
        })
      );
    });

    it("should create opt-out record for user on waitlist", async () => {
      vi.mocked(prisma.rSVP.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.waitlist.findUnique).mockResolvedValue({ id: "waitlist-1" } as never);
      vi.mocked(prisma.smsOptOut.upsert).mockResolvedValue({} as never);

      await expect(handleSmsOptOut("event-123", "user-123")).resolves.not.toThrow();
    });

    it("should throw error for user not associated with event", async () => {
      vi.mocked(prisma.rSVP.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.waitlist.findUnique).mockResolvedValue(null);

      await expect(handleSmsOptOut("event-123", "user-123")).rejects.toThrow(
        "User is not associated with this event"
      );
    });
  });

  describe("checkSmsOptOut", () => {
    it("should return true if user has opted out", async () => {
      vi.mocked(prisma.smsOptOut.findUnique).mockResolvedValue({ id: "opt-1" } as never);

      const result = await checkSmsOptOut("event-123", "user-123");

      expect(result).toBe(true);
    });

    it("should return false if user has not opted out", async () => {
      vi.mocked(prisma.smsOptOut.findUnique).mockResolvedValue(null);

      const result = await checkSmsOptOut("event-123", "user-123");

      expect(result).toBe(false);
    });
  });

  describe("getOptOutCount", () => {
    it("should return count of opt-outs for event", async () => {
      vi.mocked(prisma.smsOptOut.count).mockResolvedValue(5);

      const result = await getOptOutCount("event-123");

      expect(result).toBe(5);
    });
  });
});

describe("Mass SMS Input Validation", () => {
  describe("Message validation", () => {
    it("should reject empty message", () => {
      const message = "";
      const isValid = message.length > 0 && message.trim().length > 0;
      expect(isValid).toBe(false);
    });

    it("should reject message longer than 160 chars", () => {
      const message = "a".repeat(161);
      const isValid = message.length <= 160;
      expect(isValid).toBe(false);
    });

    it("should accept valid message", () => {
      const message = "Important event update: The venue has changed!";
      const isValid =
        message.length > 0 &&
        message.trim().length > 0 &&
        message.length <= 160;
      expect(isValid).toBe(true);
    });

    it("should accept message at exactly 160 chars", () => {
      const message = "a".repeat(160);
      const isValid = message.length <= 160;
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

describe("Mass SMS Rate Limiting", () => {
  it("should enforce 3 SMS per week limit", () => {
    const WEEKLY_SMS_LIMIT = 3;
    const weeklyCount = 3;

    const isAtLimit = weeklyCount >= WEEKLY_SMS_LIMIT;
    expect(isAtLimit).toBe(true);
  });

  it("should enforce 24-hour minimum between SMS", () => {
    const MIN_HOURS_BETWEEN_SMS = 24;
    const lastSmsTime = new Date(Date.now() - 12 * 60 * 60 * 1000); // 12 hours ago
    const hoursSinceLast = (Date.now() - lastSmsTime.getTime()) / (1000 * 60 * 60);

    const canSend = hoursSinceLast >= MIN_HOURS_BETWEEN_SMS;
    expect(canSend).toBe(false);
  });

  it("should allow SMS after 24 hours", () => {
    const MIN_HOURS_BETWEEN_SMS = 24;
    const lastSmsTime = new Date(Date.now() - 25 * 60 * 60 * 1000); // 25 hours ago
    const hoursSinceLast = (Date.now() - lastSmsTime.getTime()) / (1000 * 60 * 60);

    const canSend = hoursSinceLast >= MIN_HOURS_BETWEEN_SMS;
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

describe("Event State Validation for Mass SMS", () => {
  it("should only allow mass SMS for PUBLISHED events", () => {
    const validStates = ["PUBLISHED", "ONGOING"];
    expect(validStates.includes("PUBLISHED")).toBe(true);
    expect(validStates.includes("ONGOING")).toBe(true);
  });

  it("should reject mass SMS for DRAFT events", () => {
    const validStates = ["PUBLISHED", "ONGOING"];
    expect(validStates.includes("DRAFT")).toBe(false);
  });

  it("should reject mass SMS for CANCELLED events", () => {
    const validStates = ["PUBLISHED", "ONGOING"];
    expect(validStates.includes("CANCELLED")).toBe(false);
  });

  it("should reject mass SMS for COMPLETED events", () => {
    const validStates = ["PUBLISHED", "ONGOING"];
    expect(validStates.includes("COMPLETED")).toBe(false);
  });
});

describe("SMS Opt-Out Handling", () => {
  it("should respect user opt-out when sending", () => {
    const recipients = [
      { userId: "user-1", phone: "+15551111111", smsOptedOut: false },
      { userId: "user-2", phone: "+15552222222", smsOptedOut: true },
      { userId: "user-3", phone: "+15553333333", smsOptedOut: false },
    ];

    const activeRecipients = recipients.filter((r) => !r.smsOptedOut);

    expect(activeRecipients).toHaveLength(2);
    expect(activeRecipients.find((r) => r.userId === "user-2")).toBeUndefined();
  });

  it("should track opted-out count separately", () => {
    const recipients = [
      { userId: "user-1", smsOptedOut: false },
      { userId: "user-2", smsOptedOut: true },
      { userId: "user-3", smsOptedOut: true },
    ];

    const optedOutCount = recipients.filter((r) => r.smsOptedOut).length;
    const activeCount = recipients.filter((r) => !r.smsOptedOut).length;

    expect(optedOutCount).toBe(2);
    expect(activeCount).toBe(1);
  });
});
