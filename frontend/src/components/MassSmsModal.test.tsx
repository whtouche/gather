import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MassSmsModal } from "./MassSmsModal";
import * as api from "../services/api";

// Mock the API module
vi.mock("../services/api", () => ({
  sendMassSms: vi.fn(),
  getMassSmsQuota: vi.fn(),
  previewMassSmsRecipients: vi.fn(),
  isApiError: vi.fn((error): error is api.ApiError => {
    return (
      typeof error === "object" &&
      error !== null &&
      "message" in error &&
      "statusCode" in error
    );
  }),
}));

describe("MassSmsModal", () => {
  const mockQuota: api.MassSmsQuota = {
    used: 1,
    limit: 3,
    remaining: 2,
    canSendNow: true,
    approachingLimit: false,
    atLimit: false,
  };

  const mockPreview: api.MassSmsPreviewResponse = {
    count: 5,
    optedOutCount: 1,
    preview: [
      { displayName: "User 1", phone: "***1111" },
      { displayName: "User 2", phone: "***2222" },
    ],
    hasMore: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.getMassSmsQuota).mockResolvedValue({ quota: mockQuota });
    vi.mocked(api.previewMassSmsRecipients).mockResolvedValue(mockPreview);
  });

  it("should not render when isOpen is false", () => {
    render(
      <MassSmsModal
        eventId="test-event"
        isOpen={false}
        onClose={() => {}}
      />
    );

    expect(screen.queryByText("Send Mass SMS")).not.toBeInTheDocument();
  });

  it("should render modal when isOpen is true", async () => {
    render(
      <MassSmsModal
        eventId="test-event"
        isOpen={true}
        onClose={() => {}}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Send Mass SMS")).toBeInTheDocument();
    });
  });

  it("should load quota on mount", async () => {
    render(
      <MassSmsModal
        eventId="test-event"
        isOpen={true}
        onClose={() => {}}
      />
    );

    await waitFor(() => {
      expect(api.getMassSmsQuota).toHaveBeenCalledWith("test-event");
    });
    expect(screen.getByText(/1 of 3 mass SMS sent this week/)).toBeInTheDocument();
  });

  it("should display audience options", async () => {
    render(
      <MassSmsModal
        eventId="test-event"
        isOpen={true}
        onClose={() => {}}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Yes only")).toBeInTheDocument();
    });
    expect(screen.getByText("All RSVP'd")).toBeInTheDocument();
    expect(screen.getByText("Maybe only")).toBeInTheDocument();
    expect(screen.getByText("No only")).toBeInTheDocument();
    expect(screen.getByText("Waitlist only")).toBeInTheDocument();
  });

  it("should load recipient preview when audience changes", async () => {
    render(
      <MassSmsModal
        eventId="test-event"
        isOpen={true}
        onClose={() => {}}
      />
    );

    await waitFor(() => {
      expect(api.previewMassSmsRecipients).toHaveBeenCalledWith("test-event", "YES_ONLY");
    });
    expect(screen.getByText(/5 recipient\(s\) will receive this message/)).toBeInTheDocument();
  });

  it("should show opted out count when present", async () => {
    render(
      <MassSmsModal
        eventId="test-event"
        isOpen={true}
        onClose={() => {}}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/1 recipient\(s\) have opted out of SMS/)).toBeInTheDocument();
    });
  });

  it("should show character count", async () => {
    render(
      <MassSmsModal
        eventId="test-event"
        isOpen={true}
        onClose={() => {}}
      />
    );

    const textarea = await screen.findByPlaceholderText(/Write your SMS message here/);
    fireEvent.change(textarea, { target: { value: "Hello attendees!" } });

    // 160 - 16 = 144 characters remaining
    expect(screen.getByText("144")).toBeInTheDocument();
  });

  it("should show warning when approaching character limit", async () => {
    render(
      <MassSmsModal
        eventId="test-event"
        isOpen={true}
        onClose={() => {}}
      />
    );

    const textarea = await screen.findByPlaceholderText(/Write your SMS message here/);
    const longMessage = "a".repeat(145); // 15 characters remaining
    fireEvent.change(textarea, { target: { value: longMessage } });

    // Should show 15 (160 - 145)
    expect(screen.getByText("15")).toBeInTheDocument();
  });

  it("should disable preview button when message is empty", async () => {
    render(
      <MassSmsModal
        eventId="test-event"
        isOpen={true}
        onClose={() => {}}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Preview" })).toBeDisabled();
    });
  });

  it("should enable preview button when message is valid", async () => {
    render(
      <MassSmsModal
        eventId="test-event"
        isOpen={true}
        onClose={() => {}}
      />
    );

    const textarea = await screen.findByPlaceholderText(/Write your SMS message here/);
    fireEvent.change(textarea, { target: { value: "Hello attendees!" } });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Preview" })).not.toBeDisabled();
    });
  });

  it("should show error when message is too long", async () => {
    render(
      <MassSmsModal
        eventId="test-event"
        isOpen={true}
        onClose={() => {}}
      />
    );

    const textarea = await screen.findByPlaceholderText(/Write your SMS message here/);
    const longMessage = "a".repeat(165); // Over 160 characters
    fireEvent.change(textarea, { target: { value: longMessage } });

    // Character count should show negative
    expect(screen.getByText("-5")).toBeInTheDocument();
  });

  it("should transition to preview state when clicking Preview", async () => {
    render(
      <MassSmsModal
        eventId="test-event"
        isOpen={true}
        onClose={() => {}}
      />
    );

    const textarea = await screen.findByPlaceholderText(/Write your SMS message here/);
    fireEvent.change(textarea, { target: { value: "Hello attendees!" } });

    const previewButton = screen.getByRole("button", { name: "Preview" });
    fireEvent.click(previewButton);

    await waitFor(() => {
      expect(screen.getByText("Preview Message")).toBeInTheDocument();
    });
    expect(screen.getByText("Hello attendees!")).toBeInTheDocument();
  });

  it("should send SMS when clicking Send", async () => {
    const mockSendResponse: api.SendMassSmsResponse = {
      message: "Mass SMS sent successfully",
      id: "msg-1",
      recipientCount: 5,
      sentCount: 4,
      failedCount: 0,
      optedOutCount: 1,
      quota: { used: 2, limit: 3, remaining: 1, canSendNow: true, approachingLimit: false, atLimit: false },
    };

    vi.mocked(api.sendMassSms).mockResolvedValue(mockSendResponse);

    const onMessageSent = vi.fn();
    render(
      <MassSmsModal
        eventId="test-event"
        isOpen={true}
        onClose={() => {}}
        onMessageSent={onMessageSent}
      />
    );

    // Fill in message and go to preview
    const textarea = await screen.findByPlaceholderText(/Write your SMS message here/);
    fireEvent.change(textarea, { target: { value: "Hello attendees!" } });

    const previewButton = screen.getByRole("button", { name: "Preview" });
    fireEvent.click(previewButton);

    await waitFor(() => {
      expect(screen.getByText("Preview Message")).toBeInTheDocument();
    });

    // Click send
    const sendButton = screen.getByRole("button", { name: /Send to 5 recipient/ });
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(api.sendMassSms).toHaveBeenCalledWith("test-event", {
        message: "Hello attendees!",
        targetAudience: "YES_ONLY",
      });
    });

    // Should show results
    await waitFor(() => {
      expect(screen.getByText("SMS Sent!")).toBeInTheDocument();
    });
    expect(onMessageSent).toHaveBeenCalled();
  });

  it("should call onClose when Cancel is clicked", async () => {
    const onClose = vi.fn();
    render(
      <MassSmsModal
        eventId="test-event"
        isOpen={true}
        onClose={onClose}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Send Mass SMS")).toBeInTheDocument();
    });

    const cancelButton = screen.getByRole("button", { name: "Cancel" });
    fireEvent.click(cancelButton);

    expect(onClose).toHaveBeenCalled();
  });

  it("should show error message when quota exceeded", async () => {
    vi.mocked(api.getMassSmsQuota).mockResolvedValue({
      quota: {
        used: 3,
        limit: 3,
        remaining: 0,
        canSendNow: false,
        nextSendAllowed: "2024-01-16T10:00:00Z",
        approachingLimit: false,
        atLimit: true,
      },
    });

    render(
      <MassSmsModal
        eventId="test-event"
        isOpen={true}
        onClose={() => {}}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/3 of 3 mass SMS sent this week/)).toBeInTheDocument();
    });
  });

  it("should show API error when send fails", async () => {
    vi.mocked(api.sendMassSms).mockRejectedValue({
      message: "Rate limit exceeded",
      statusCode: 429,
    });
    vi.mocked(api.isApiError).mockReturnValue(true);

    render(
      <MassSmsModal
        eventId="test-event"
        isOpen={true}
        onClose={() => {}}
      />
    );

    // Fill in message and go to preview
    const textarea = await screen.findByPlaceholderText(/Write your SMS message here/);
    fireEvent.change(textarea, { target: { value: "Hello attendees!" } });

    const previewButton = screen.getByRole("button", { name: "Preview" });
    fireEvent.click(previewButton);

    await waitFor(() => {
      expect(screen.getByText("Preview Message")).toBeInTheDocument();
    });

    // Click send
    const sendButton = screen.getByRole("button", { name: /Send to 5 recipient/ });
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(screen.getByText("Rate limit exceeded")).toBeInTheDocument();
    });
  });

  it("should allow going back from preview to compose", async () => {
    render(
      <MassSmsModal
        eventId="test-event"
        isOpen={true}
        onClose={() => {}}
      />
    );

    // Fill in message and go to preview
    const textarea = await screen.findByPlaceholderText(/Write your SMS message here/);
    fireEvent.change(textarea, { target: { value: "Hello attendees!" } });

    const previewButton = screen.getByRole("button", { name: "Preview" });
    fireEvent.click(previewButton);

    await waitFor(() => {
      expect(screen.getByText("Preview Message")).toBeInTheDocument();
    });

    // Click back
    const backButton = screen.getByRole("button", { name: "Back" });
    fireEvent.click(backButton);

    await waitFor(() => {
      expect(screen.getByText("Send Mass SMS")).toBeInTheDocument();
    });
  });
});
