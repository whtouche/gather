import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { PreviousAttendeesModal } from "./PreviousAttendeesModal";
import * as api from "../services/api";

// Mock the API module
vi.mock("../services/api", () => ({
  getPreviousAttendees: vi.fn(),
  invitePreviousAttendees: vi.fn(),
  isApiError: vi.fn((error): error is api.ApiError => {
    return (
      typeof error === "object" &&
      error !== null &&
      "message" in error &&
      "statusCode" in error
    );
  }),
}));

describe("PreviousAttendeesModal", () => {
  const mockAttendees: api.PreviousAttendee[] = [
    {
      userId: "user-1",
      displayName: "John Doe",
      photoUrl: null,
      email: "jo***@example.com",
      phone: null,
      hasEmail: true,
      hasPhone: false,
      lastEventId: "event-1",
      lastEventTitle: "Summer BBQ",
      lastEventDate: "2024-06-15T18:00:00Z",
      sharedEventCount: 3,
    },
    {
      userId: "user-2",
      displayName: "Jane Smith",
      photoUrl: "https://example.com/photo.jpg",
      email: null,
      phone: "***5678",
      hasEmail: false,
      hasPhone: true,
      lastEventId: "event-2",
      lastEventTitle: "Holiday Party",
      lastEventDate: "2023-12-20T19:00:00Z",
      sharedEventCount: 1,
    },
    {
      userId: "user-3",
      displayName: "Bob Wilson",
      photoUrl: null,
      email: "bo***@test.com",
      phone: "***1234",
      hasEmail: true,
      hasPhone: true,
      lastEventId: "event-3",
      lastEventTitle: "Team Dinner",
      lastEventDate: "2024-03-10T20:00:00Z",
      sharedEventCount: 2,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should not render when isOpen is false", () => {
    render(
      <PreviousAttendeesModal
        eventId="test-event"
        isOpen={false}
        onClose={() => {}}
      />
    );

    expect(screen.queryByText("Invite from Previous Events")).not.toBeInTheDocument();
  });

  it("should render modal when isOpen is true", async () => {
    vi.mocked(api.getPreviousAttendees).mockResolvedValue({
      attendees: mockAttendees,
      total: 3,
    });

    render(
      <PreviousAttendeesModal
        eventId="test-event"
        isOpen={true}
        onClose={() => {}}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Invite from Previous Events")).toBeInTheDocument();
    });
  });

  it("should show loading state initially", () => {
    vi.mocked(api.getPreviousAttendees).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    render(
      <PreviousAttendeesModal
        eventId="test-event"
        isOpen={true}
        onClose={() => {}}
      />
    );

    expect(screen.getByText("Loading previous attendees...")).toBeInTheDocument();
  });

  it("should display list of attendees when loaded", async () => {
    vi.mocked(api.getPreviousAttendees).mockResolvedValue({
      attendees: mockAttendees,
      total: 3,
    });

    render(
      <PreviousAttendeesModal
        eventId="test-event"
        isOpen={true}
        onClose={() => {}}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("John Doe")).toBeInTheDocument();
    });
    expect(screen.getByText("Jane Smith")).toBeInTheDocument();
    expect(screen.getByText("Bob Wilson")).toBeInTheDocument();
  });

  it("should show empty state when no attendees", async () => {
    vi.mocked(api.getPreviousAttendees).mockResolvedValue({
      attendees: [],
      total: 0,
    });

    render(
      <PreviousAttendeesModal
        eventId="test-event"
        isOpen={true}
        onClose={() => {}}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("No previous attendees found")).toBeInTheDocument();
    });
    expect(screen.getByText("People from events you've organized or attended will appear here")).toBeInTheDocument();
  });

  it("should show error state on API failure", async () => {
    vi.mocked(api.getPreviousAttendees).mockRejectedValue(new Error("Network error"));

    render(
      <PreviousAttendeesModal
        eventId="test-event"
        isOpen={true}
        onClose={() => {}}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Failed to load previous attendees")).toBeInTheDocument();
    });
  });

  it("should display last event information", async () => {
    vi.mocked(api.getPreviousAttendees).mockResolvedValue({
      attendees: mockAttendees,
      total: 3,
    });

    render(
      <PreviousAttendeesModal
        eventId="test-event"
        isOpen={true}
        onClose={() => {}}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Summer BBQ/)).toBeInTheDocument();
    });
  });

  it("should display shared event count", async () => {
    vi.mocked(api.getPreviousAttendees).mockResolvedValue({
      attendees: mockAttendees,
      total: 3,
    });

    render(
      <PreviousAttendeesModal
        eventId="test-event"
        isOpen={true}
        onClose={() => {}}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("3 shared events")).toBeInTheDocument();
    });
    expect(screen.getByText("1 shared event")).toBeInTheDocument();
    expect(screen.getByText("2 shared events")).toBeInTheDocument();
  });

  it("should show contact method badges", async () => {
    vi.mocked(api.getPreviousAttendees).mockResolvedValue({
      attendees: mockAttendees,
      total: 3,
    });

    render(
      <PreviousAttendeesModal
        eventId="test-event"
        isOpen={true}
        onClose={() => {}}
      />
    );

    await waitFor(() => {
      const emailBadges = screen.getAllByText("Email");
      expect(emailBadges.length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText("SMS").length).toBeGreaterThan(0);
  });

  it("should allow selecting attendees", async () => {
    vi.mocked(api.getPreviousAttendees).mockResolvedValue({
      attendees: mockAttendees,
      total: 3,
    });

    render(
      <PreviousAttendeesModal
        eventId="test-event"
        isOpen={true}
        onClose={() => {}}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("John Doe")).toBeInTheDocument();
    });

    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxes[0]);

    await waitFor(() => {
      expect(checkboxes[0]).toBeChecked();
    });
  });

  it("should have Select All button", async () => {
    vi.mocked(api.getPreviousAttendees).mockResolvedValue({
      attendees: mockAttendees,
      total: 3,
    });

    render(
      <PreviousAttendeesModal
        eventId="test-event"
        isOpen={true}
        onClose={() => {}}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Select All")).toBeInTheDocument();
    });
  });

  it("should select all attendees when Select All is clicked", async () => {
    vi.mocked(api.getPreviousAttendees).mockResolvedValue({
      attendees: mockAttendees,
      total: 3,
    });

    render(
      <PreviousAttendeesModal
        eventId="test-event"
        isOpen={true}
        onClose={() => {}}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Select All")).toBeInTheDocument();
    });

    const selectAllButton = screen.getByText("Select All");
    fireEvent.click(selectAllButton);

    await waitFor(() => {
      const checkboxes = screen.getAllByRole("checkbox");
      checkboxes.forEach((checkbox) => {
        expect(checkbox).toBeChecked();
      });
    });
  });

  it("should have Clear button", async () => {
    vi.mocked(api.getPreviousAttendees).mockResolvedValue({
      attendees: mockAttendees,
      total: 3,
    });

    render(
      <PreviousAttendeesModal
        eventId="test-event"
        isOpen={true}
        onClose={() => {}}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Clear")).toBeInTheDocument();
    });
  });

  it("should send invitations when Send button is clicked", async () => {
    vi.mocked(api.getPreviousAttendees).mockResolvedValue({
      attendees: mockAttendees,
      total: 3,
    });

    const mockInviteResponse: api.InvitePreviousAttendeesResponse = {
      message: "Sent 2 invitation(s)",
      sent: 2,
      failed: 0,
      alreadyInvited: 0,
      alreadyRsvpd: 0,
      results: [],
    };

    vi.mocked(api.invitePreviousAttendees).mockResolvedValue(mockInviteResponse);

    const onInvitesSent = vi.fn();
    render(
      <PreviousAttendeesModal
        eventId="test-event"
        isOpen={true}
        onClose={() => {}}
        onInvitesSent={onInvitesSent}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("John Doe")).toBeInTheDocument();
    });

    // Select some attendees
    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxes[0]);
    fireEvent.click(checkboxes[1]);

    // Click send button
    const sendButton = screen.getByText(/Send Invitations \(2\)/);
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(api.invitePreviousAttendees).toHaveBeenCalledWith("test-event", ["user-1", "user-2"]);
    });

    await waitFor(() => {
      expect(screen.getByText("Sent 2 invitation(s)")).toBeInTheDocument();
    });
    expect(onInvitesSent).toHaveBeenCalled();
  });

  it("should disable send button when no selection", async () => {
    vi.mocked(api.getPreviousAttendees).mockResolvedValue({
      attendees: mockAttendees,
      total: 3,
    });

    render(
      <PreviousAttendeesModal
        eventId="test-event"
        isOpen={true}
        onClose={() => {}}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("John Doe")).toBeInTheDocument();
    });

    const sendButton = screen.getByText(/Send Invitations \(0\)/);
    expect(sendButton).toBeInTheDocument();
  });

  it("should call onClose when Cancel is clicked", async () => {
    vi.mocked(api.getPreviousAttendees).mockResolvedValue({
      attendees: mockAttendees,
      total: 3,
    });

    const onClose = vi.fn();
    render(
      <PreviousAttendeesModal
        eventId="test-event"
        isOpen={true}
        onClose={onClose}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("John Doe")).toBeInTheDocument();
    });

    const cancelButton = screen.getByText("Cancel");
    fireEvent.click(cancelButton);

    expect(onClose).toHaveBeenCalled();
  });

  it("should call onClose when X button is clicked", async () => {
    vi.mocked(api.getPreviousAttendees).mockResolvedValue({
      attendees: mockAttendees,
      total: 3,
    });

    const onClose = vi.fn();
    render(
      <PreviousAttendeesModal
        eventId="test-event"
        isOpen={true}
        onClose={onClose}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Invite from Previous Events")).toBeInTheDocument();
    });

    // Find and click the close button (X)
    const closeButton = screen.getByText("Invite from Previous Events")
      .closest("div")
      ?.querySelector("button");

    if (closeButton) {
      fireEvent.click(closeButton);
    }

    expect(onClose).toHaveBeenCalled();
  });

  it("should disable checkboxes for users without contact methods", async () => {
    const attendeeWithoutContact: api.PreviousAttendee = {
      userId: "user-4",
      displayName: "No Contact",
      photoUrl: null,
      email: null,
      phone: null,
      hasEmail: false,
      hasPhone: false,
      lastEventId: "event-4",
      lastEventTitle: "Old Event",
      lastEventDate: "2023-01-01T18:00:00Z",
      sharedEventCount: 1,
    };

    vi.mocked(api.getPreviousAttendees).mockResolvedValue({
      attendees: [attendeeWithoutContact],
      total: 1,
    });

    render(
      <PreviousAttendeesModal
        eventId="test-event"
        isOpen={true}
        onClose={() => {}}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("No Contact")).toBeInTheDocument();
    });

    // Check for the "No contact method" text in the component
    expect(screen.getByText(/No contact method/i)).toBeInTheDocument();

    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toBeDisabled();
  });

  it("should show results after sending invitations", async () => {
    vi.mocked(api.getPreviousAttendees).mockResolvedValue({
      attendees: mockAttendees,
      total: 3,
    });

    const mockInviteResponse: api.InvitePreviousAttendeesResponse = {
      message: "Sent 2 invitation(s)",
      sent: 2,
      failed: 1,
      alreadyInvited: 0,
      alreadyRsvpd: 0,
      results: [],
    };

    vi.mocked(api.invitePreviousAttendees).mockResolvedValue(mockInviteResponse);

    render(
      <PreviousAttendeesModal
        eventId="test-event"
        isOpen={true}
        onClose={() => {}}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("John Doe")).toBeInTheDocument();
    });

    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxes[0]);

    const sendButton = screen.getByText(/Send Invitations/);
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(screen.getByText("Sent 2 invitation(s)")).toBeInTheDocument();
    });
    expect(screen.getByText("Sent: 2")).toBeInTheDocument();
    expect(screen.getByText("Failed: 1")).toBeInTheDocument();
  });

  it("should display attendee count", async () => {
    vi.mocked(api.getPreviousAttendees).mockResolvedValue({
      attendees: mockAttendees,
      total: 3,
    });

    render(
      <PreviousAttendeesModal
        eventId="test-event"
        isOpen={true}
        onClose={() => {}}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("3 people from your previous events")).toBeInTheDocument();
    });
  });

  it("should reload attendees when modal is reopened", async () => {
    vi.mocked(api.getPreviousAttendees).mockResolvedValue({
      attendees: mockAttendees,
      total: 3,
    });

    const { rerender } = render(
      <PreviousAttendeesModal
        eventId="test-event"
        isOpen={false}
        onClose={() => {}}
      />
    );

    expect(api.getPreviousAttendees).not.toHaveBeenCalled();

    rerender(
      <PreviousAttendeesModal
        eventId="test-event"
        isOpen={true}
        onClose={() => {}}
      />
    );

    await waitFor(() => {
      expect(api.getPreviousAttendees).toHaveBeenCalledWith("test-event");
    });
  });

  it("should show sending state while invitations are being sent", async () => {
    vi.mocked(api.getPreviousAttendees).mockResolvedValue({
      attendees: mockAttendees,
      total: 3,
    });

    vi.mocked(api.invitePreviousAttendees).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    render(
      <PreviousAttendeesModal
        eventId="test-event"
        isOpen={true}
        onClose={() => {}}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("John Doe")).toBeInTheDocument();
    });

    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxes[0]);

    const sendButton = screen.getByText(/Send Invitations/);
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(screen.getByText("Sending invitations...")).toBeInTheDocument();
    });
  });
});
