import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MassSmsHistoryPanel } from "./MassSmsHistoryPanel";
import * as api from "../services/api";

// Mock the API module
vi.mock("../services/api", () => ({
  getMassSmsHistory: vi.fn(),
  getMassSmsQuota: vi.fn(),
  isApiError: vi.fn((error): error is api.ApiError => {
    return (
      typeof error === "object" &&
      error !== null &&
      "message" in error &&
      "statusCode" in error
    );
  }),
}));

describe("MassSmsHistoryPanel", () => {
  const mockQuota: api.MassSmsQuota = {
    used: 1,
    limit: 3,
    remaining: 2,
    canSendNow: true,
    approachingLimit: false,
    atLimit: false,
  };

  const mockMessages: api.MassSmsRecord[] = [
    {
      id: "msg-1",
      body: "Event update: The venue has changed!",
      targetAudience: "YES_ONLY",
      recipientCount: 10,
      sentCount: 9,
      failedCount: 1,
      sentAt: "2024-01-15T10:00:00Z",
      organizer: { id: "org-1", displayName: "Event Organizer" },
    },
    {
      id: "msg-2",
      body: "Reminder: Event tomorrow at 6pm",
      targetAudience: "ALL",
      recipientCount: 15,
      sentCount: 15,
      failedCount: 0,
      sentAt: "2024-01-14T09:00:00Z",
      organizer: { id: "org-1", displayName: "Event Organizer" },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should show loading state initially", () => {
    vi.mocked(api.getMassSmsHistory).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );
    vi.mocked(api.getMassSmsQuota).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    render(<MassSmsHistoryPanel eventId="test-event" />);
    // Check for the loading skeleton by looking for animate-pulse class
    expect(document.querySelector(".animate-pulse")).toBeInTheDocument();
  });

  it("should display message history when loaded", async () => {
    vi.mocked(api.getMassSmsHistory).mockResolvedValue({
      messages: mockMessages,
      total: 2,
    });
    vi.mocked(api.getMassSmsQuota).mockResolvedValue({ quota: mockQuota });

    render(<MassSmsHistoryPanel eventId="test-event" />);

    await waitFor(() => {
      expect(screen.getByText("Mass SMS History")).toBeInTheDocument();
    });
    // Truncated message preview
    expect(screen.getByText(/Event update: The venue has changed!/)).toBeInTheDocument();
    expect(screen.getByText(/Reminder: Event tomorrow at 6pm/)).toBeInTheDocument();
  });

  it("should display quota information", async () => {
    vi.mocked(api.getMassSmsHistory).mockResolvedValue({
      messages: mockMessages,
      total: 2,
    });
    vi.mocked(api.getMassSmsQuota).mockResolvedValue({ quota: mockQuota });

    render(<MassSmsHistoryPanel eventId="test-event" />);

    await waitFor(() => {
      expect(screen.getByText(/2 of 3 remaining this week/)).toBeInTheDocument();
    });
  });

  it("should show empty state when no messages", async () => {
    vi.mocked(api.getMassSmsHistory).mockResolvedValue({
      messages: [],
      total: 0,
    });
    vi.mocked(api.getMassSmsQuota).mockResolvedValue({ quota: mockQuota });

    render(<MassSmsHistoryPanel eventId="test-event" />);

    await waitFor(() => {
      expect(screen.getByText("No mass SMS sent yet")).toBeInTheDocument();
    });
    expect(screen.getByText("Send your first mass SMS to see history here")).toBeInTheDocument();
  });

  it("should show error state on API failure", async () => {
    vi.mocked(api.getMassSmsHistory).mockRejectedValue(new Error("Network error"));
    vi.mocked(api.getMassSmsQuota).mockRejectedValue(new Error("Network error"));

    render(<MassSmsHistoryPanel eventId="test-event" />);

    await waitFor(() => {
      expect(screen.getByText("Failed to load message history")).toBeInTheDocument();
    });
  });

  it("should display audience badge", async () => {
    vi.mocked(api.getMassSmsHistory).mockResolvedValue({
      messages: mockMessages,
      total: 2,
    });
    vi.mocked(api.getMassSmsQuota).mockResolvedValue({ quota: mockQuota });

    render(<MassSmsHistoryPanel eventId="test-event" />);

    await waitFor(() => {
      expect(screen.getByText("Yes only")).toBeInTheDocument();
    });
    expect(screen.getByText("All RSVP'd")).toBeInTheDocument();
  });

  it("should display sent count", async () => {
    vi.mocked(api.getMassSmsHistory).mockResolvedValue({
      messages: mockMessages,
      total: 2,
    });
    vi.mocked(api.getMassSmsQuota).mockResolvedValue({ quota: mockQuota });

    render(<MassSmsHistoryPanel eventId="test-event" />);

    await waitFor(() => {
      expect(screen.getByText("9")).toBeInTheDocument(); // First message sent count
    });
  });

  it("should display failed count when present", async () => {
    vi.mocked(api.getMassSmsHistory).mockResolvedValue({
      messages: mockMessages,
      total: 2,
    });
    vi.mocked(api.getMassSmsQuota).mockResolvedValue({ quota: mockQuota });

    render(<MassSmsHistoryPanel eventId="test-event" />);

    await waitFor(() => {
      // First message has 1 failed
      expect(screen.getByText("1")).toBeInTheDocument();
    });
  });

  it("should expand message details on click", async () => {
    vi.mocked(api.getMassSmsHistory).mockResolvedValue({
      messages: mockMessages,
      total: 2,
    });
    vi.mocked(api.getMassSmsQuota).mockResolvedValue({ quota: mockQuota });

    render(<MassSmsHistoryPanel eventId="test-event" />);

    await waitFor(() => {
      expect(screen.getByText(/Event update: The venue has changed!/)).toBeInTheDocument();
    });

    // Click on the first message row
    const messageRow = screen.getByText(/Event update: The venue has changed!/).closest('div[class*="cursor-pointer"]');
    if (messageRow) {
      fireEvent.click(messageRow);
    }

    await waitFor(() => {
      // Should show full message in expanded view
      expect(screen.getByText("Message:")).toBeInTheDocument();
    });
  });

  it("should display organizer name", async () => {
    vi.mocked(api.getMassSmsHistory).mockResolvedValue({
      messages: mockMessages,
      total: 2,
    });
    vi.mocked(api.getMassSmsQuota).mockResolvedValue({ quota: mockQuota });

    render(<MassSmsHistoryPanel eventId="test-event" />);

    await waitFor(() => {
      const matches = screen.getAllByText(/Event Organizer/);
      expect(matches.length).toBeGreaterThan(0);
    });
  });

  it("should refresh when refreshKey changes", async () => {
    vi.mocked(api.getMassSmsHistory).mockResolvedValue({
      messages: mockMessages,
      total: 2,
    });
    vi.mocked(api.getMassSmsQuota).mockResolvedValue({ quota: mockQuota });

    const { rerender } = render(
      <MassSmsHistoryPanel eventId="test-event" refreshKey={0} />
    );

    await waitFor(() => {
      expect(api.getMassSmsHistory).toHaveBeenCalledTimes(1);
    });

    rerender(<MassSmsHistoryPanel eventId="test-event" refreshKey={1} />);

    await waitFor(() => {
      expect(api.getMassSmsHistory).toHaveBeenCalledTimes(2);
    });
  });

  it("should collapse expanded message on second click", async () => {
    vi.mocked(api.getMassSmsHistory).mockResolvedValue({
      messages: mockMessages,
      total: 2,
    });
    vi.mocked(api.getMassSmsQuota).mockResolvedValue({ quota: mockQuota });

    render(<MassSmsHistoryPanel eventId="test-event" />);

    await waitFor(() => {
      expect(screen.getByText(/Event update: The venue has changed!/)).toBeInTheDocument();
    });

    // Click to expand
    const messageRow = screen.getByText(/Event update: The venue has changed!/).closest('div[class*="cursor-pointer"]');
    if (messageRow) {
      fireEvent.click(messageRow);
    }

    await waitFor(() => {
      expect(screen.getByText("Message:")).toBeInTheDocument();
    });

    // Click again to collapse
    if (messageRow) {
      fireEvent.click(messageRow);
    }

    await waitFor(() => {
      expect(screen.queryByText("Message:")).not.toBeInTheDocument();
    });
  });

  it("should show character count in expanded view", async () => {
    vi.mocked(api.getMassSmsHistory).mockResolvedValue({
      messages: mockMessages,
      total: 2,
    });
    vi.mocked(api.getMassSmsQuota).mockResolvedValue({ quota: mockQuota });

    render(<MassSmsHistoryPanel eventId="test-event" />);

    await waitFor(() => {
      expect(screen.getByText(/Event update: The venue has changed!/)).toBeInTheDocument();
    });

    // Click to expand
    const messageRow = screen.getByText(/Event update: The venue has changed!/).closest('div[class*="cursor-pointer"]');
    if (messageRow) {
      fireEvent.click(messageRow);
    }

    await waitFor(() => {
      // Should show character count in format "XX/160 characters"
      expect(screen.getByText(/\/160 characters/)).toBeInTheDocument();
    });
  });
});
