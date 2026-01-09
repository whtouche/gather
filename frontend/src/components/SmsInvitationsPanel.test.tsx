import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { SmsInvitationsPanel } from "./SmsInvitationsPanel";
import * as api from "../services/api";

// Mock the API module
vi.mock("../services/api", () => ({
  getSmsInvitations: vi.fn(),
  isApiError: vi.fn((error): error is api.ApiError => {
    return (
      typeof error === "object" &&
      error !== null &&
      "message" in error &&
      "statusCode" in error
    );
  }),
}));

describe("SmsInvitationsPanel", () => {
  const mockQuota: api.SmsQuotaInfo = {
    dailyCount: 10,
    dailyLimit: 100,
    dailyRemaining: 90,
    totalCount: 50,
    totalLimit: 500,
    totalRemaining: 450,
    atDailyLimit: false,
    atTotalLimit: false,
  };

  const mockStats: api.SmsInvitationStats = {
    total: 5,
    pending: 0,
    sent: 3,
    rsvpd: 2,
    failed: 0,
  };

  const mockInvitations: api.SmsInvitation[] = [
    {
      id: "inv-1",
      phone: "***4567",
      recipientName: "John Doe",
      status: "SENT",
      sentAt: "2024-01-15T10:00:00Z",
      rsvpAt: null,
      createdAt: "2024-01-15T09:59:00Z",
    },
    {
      id: "inv-2",
      phone: "***8901",
      recipientName: null,
      status: "RSVPD",
      sentAt: "2024-01-15T09:00:00Z",
      rsvpAt: "2024-01-15T10:30:00Z",
      createdAt: "2024-01-15T08:59:00Z",
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should show loading state initially", () => {
    vi.mocked(api.getSmsInvitations).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    render(<SmsInvitationsPanel eventId="test-event" />);
    expect(screen.getByText("SMS Invitations")).toBeInTheDocument();
  });

  it("should display invitations when loaded", async () => {
    vi.mocked(api.getSmsInvitations).mockResolvedValue({
      invitations: mockInvitations,
      stats: mockStats,
      quota: mockQuota,
    });

    render(<SmsInvitationsPanel eventId="test-event" />);

    await waitFor(() => {
      expect(screen.getByText("John Doe")).toBeInTheDocument();
    });
    expect(screen.getByText("***4567")).toBeInTheDocument();
    expect(screen.getByText("***8901")).toBeInTheDocument();
  });

  it("should display stats when loaded", async () => {
    vi.mocked(api.getSmsInvitations).mockResolvedValue({
      invitations: mockInvitations,
      stats: mockStats,
      quota: mockQuota,
    });

    render(<SmsInvitationsPanel eventId="test-event" />);

    await waitFor(() => {
      expect(screen.getByText("5")).toBeInTheDocument(); // Total
    });
    expect(screen.getByText("3")).toBeInTheDocument(); // Sent
    expect(screen.getByText("2")).toBeInTheDocument(); // RSVP'd
  });

  it("should show empty state when no invitations", async () => {
    vi.mocked(api.getSmsInvitations).mockResolvedValue({
      invitations: [],
      stats: { total: 0, pending: 0, sent: 0, rsvpd: 0, failed: 0 },
      quota: mockQuota,
    });

    render(<SmsInvitationsPanel eventId="test-event" />);

    await waitFor(() => {
      expect(
        screen.getByText(/No SMS invitations sent yet/)
      ).toBeInTheDocument();
    });
  });

  it("should show error state on API failure", async () => {
    vi.mocked(api.getSmsInvitations).mockRejectedValue(
      new Error("Network error")
    );

    render(<SmsInvitationsPanel eventId="test-event" />);

    await waitFor(() => {
      expect(
        screen.getByText("Failed to load SMS invitations")
      ).toBeInTheDocument();
    });
  });

  it("should display quota information", async () => {
    vi.mocked(api.getSmsInvitations).mockResolvedValue({
      invitations: mockInvitations,
      stats: mockStats,
      quota: mockQuota,
    });

    render(<SmsInvitationsPanel eventId="test-event" />);

    await waitFor(() => {
      expect(screen.getByText(/90\/100 daily/)).toBeInTheDocument();
    });
    expect(screen.getByText(/450\/500 total remaining/)).toBeInTheDocument();
  });

  it("should refresh when refreshKey changes", async () => {
    vi.mocked(api.getSmsInvitations).mockResolvedValue({
      invitations: mockInvitations,
      stats: mockStats,
      quota: mockQuota,
    });

    const { rerender } = render(
      <SmsInvitationsPanel eventId="test-event" refreshKey={0} />
    );

    await waitFor(() => {
      expect(api.getSmsInvitations).toHaveBeenCalledTimes(1);
    });

    rerender(<SmsInvitationsPanel eventId="test-event" refreshKey={1} />);

    await waitFor(() => {
      expect(api.getSmsInvitations).toHaveBeenCalledTimes(2);
    });
  });

  it("should display correct status badges", async () => {
    vi.mocked(api.getSmsInvitations).mockResolvedValue({
      invitations: mockInvitations,
      stats: mockStats,
      quota: mockQuota,
    });

    render(<SmsInvitationsPanel eventId="test-event" />);

    await waitFor(() => {
      // Check for status badges specifically (they have the rounded-full class)
      const sentBadges = screen.getAllByText("Sent");
      const rsvpBadges = screen.getAllByText("RSVP'd");

      // There should be multiple "Sent" elements (stats label, table header, status badge)
      expect(sentBadges.length).toBeGreaterThan(0);
      // There should be multiple "RSVP'd" elements (stats label, status badge)
      expect(rsvpBadges.length).toBeGreaterThan(0);

      // Check that at least one is a status badge (has the badge styling)
      const sentBadge = sentBadges.find(el => el.className.includes('rounded-full'));
      expect(sentBadge).toBeDefined();
    });
  });
});
