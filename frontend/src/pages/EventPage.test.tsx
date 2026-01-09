import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { EventPage } from "./EventPage";
import * as api from "../services/api";

// Mock the API module
vi.mock("../services/api", () => ({
  getEvent: vi.fn(),
  publishEvent: vi.fn(),
  isApiError: vi.fn((error): error is api.ApiError => {
    return (
      typeof error === "object" &&
      error !== null &&
      "message" in error &&
      "statusCode" in error
    );
  }),
  isAuthenticated: vi.fn(() => false),
  getAuthToken: vi.fn(() => null),
}));

// Mock the child components to simplify testing
vi.mock("../components/RSVPButtons", () => ({
  RSVPButtons: () => <div data-testid="rsvp-buttons">RSVP Buttons</div>,
}));

vi.mock("../components/InviteLinkButton", () => ({
  InviteLinkButton: ({ eventId }: { eventId: string }) => (
    <button data-testid="invite-link-button">Share Invite Link for {eventId}</button>
  ),
}));

vi.mock("../components/AttendeeList", () => ({
  AttendeeList: () => <div data-testid="attendee-list">Attendee List</div>,
}));

vi.mock("../components/CancelEventModal", () => ({
  CancelEventModal: () => null,
}));

vi.mock("../components/AttendeeListModal", () => ({
  AttendeeListModal: () => null,
}));

vi.mock("../components/EmailInviteModal", () => ({
  EmailInviteModal: () => null,
}));

vi.mock("../components/EmailInvitationsPanel", () => ({
  EmailInvitationsPanel: () => <div data-testid="email-invitations-panel">Email Invitations Panel</div>,
}));

vi.mock("../components/SmsInviteModal", () => ({
  SmsInviteModal: () => null,
}));

vi.mock("../components/SmsInvitationsPanel", () => ({
  SmsInvitationsPanel: () => <div data-testid="sms-invitations-panel">SMS Invitations Panel</div>,
}));

describe("EventPage", () => {
  const mockCreator = {
    id: "creator-123",
    displayName: "Test Organizer",
    photoUrl: null,
  };

  const baseEvent: api.EventDetails = {
    id: "event-123",
    title: "Test Event",
    description: "A test event description",
    dateTime: new Date(Date.now() + 86400000).toISOString(),
    endDateTime: null,
    timezone: "America/New_York",
    location: "Test Location",
    imageUrl: null,
    capacity: null,
    rsvpDeadline: null,
    category: "Party",
    dressCode: null,
    notes: null,
    state: "PUBLISHED",
    attendeeListVisibility: "ATTENDEES_ONLY",
    allowInviteSharing: false,
    creator: mockCreator,
    organizers: [mockCreator],
    rsvpCounts: { yes: 5, no: 2, maybe: 3 },
    userRsvp: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("loading state", () => {
    it("should show loading state initially", () => {
      vi.mocked(api.getEvent).mockImplementation(() => new Promise(() => {})); // Never resolves

      render(<EventPage eventId="event-123" />);
      expect(screen.getByText("Loading event details...")).toBeInTheDocument();
    });
  });

  describe("error state", () => {
    it("should show error when event is not found", async () => {
      const error: api.ApiError = {
        message: "Event not found",
        code: "EVENT_NOT_FOUND",
        statusCode: 404,
      };
      vi.mocked(api.getEvent).mockRejectedValue(error);
      vi.mocked(api.isApiError).mockReturnValue(true);

      render(<EventPage eventId="event-123" />);

      await waitFor(() => {
        expect(screen.getByText("Event Not Found")).toBeInTheDocument();
      });
    });
  });

  describe("attendee share section", () => {
    it("should NOT show share section for non-organizer without RSVP YES", async () => {
      vi.mocked(api.getEvent).mockResolvedValue({
        event: {
          ...baseEvent,
          allowInviteSharing: true,
          userRsvp: null,
        },
        isOrganizer: false,
      });
      vi.mocked(api.isAuthenticated).mockReturnValue(true);
      vi.mocked(api.getAuthToken).mockReturnValue("test-token");

      render(<EventPage eventId="event-123" />);

      await waitFor(() => {
        expect(screen.getByText("Test Event")).toBeInTheDocument();
      });

      // Share This Event section should not be visible
      expect(screen.queryByText("Share This Event")).not.toBeInTheDocument();
    });

    it("should NOT show share section when allowInviteSharing is false", async () => {
      vi.mocked(api.getEvent).mockResolvedValue({
        event: {
          ...baseEvent,
          allowInviteSharing: false,
          userRsvp: "YES",
        },
        isOrganizer: false,
      });
      vi.mocked(api.isAuthenticated).mockReturnValue(true);
      vi.mocked(api.getAuthToken).mockReturnValue("test-token");

      render(<EventPage eventId="event-123" />);

      await waitFor(() => {
        expect(screen.getByText("Test Event")).toBeInTheDocument();
      });

      // Share This Event section should not be visible
      expect(screen.queryByText("Share This Event")).not.toBeInTheDocument();
    });

    it("should show share section for confirmed attendee when invite sharing is enabled", async () => {
      vi.mocked(api.getEvent).mockResolvedValue({
        event: {
          ...baseEvent,
          allowInviteSharing: true,
          userRsvp: "YES",
          state: "PUBLISHED",
        },
        isOrganizer: false,
      });
      vi.mocked(api.isAuthenticated).mockReturnValue(true);
      vi.mocked(api.getAuthToken).mockReturnValue("test-token");

      render(<EventPage eventId="event-123" />);

      await waitFor(() => {
        expect(screen.getByText("Share This Event")).toBeInTheDocument();
      });

      expect(screen.getByText("Invite others to this event by sharing the invitation link.")).toBeInTheDocument();
      expect(screen.getByTestId("invite-link-button")).toBeInTheDocument();
    });

    it("should NOT show share section for organizers (they have it in organizer actions)", async () => {
      vi.mocked(api.getEvent).mockResolvedValue({
        event: {
          ...baseEvent,
          allowInviteSharing: true,
          userRsvp: "YES",
        },
        isOrganizer: true,
      });
      vi.mocked(api.isAuthenticated).mockReturnValue(true);
      vi.mocked(api.getAuthToken).mockReturnValue("test-token");

      render(<EventPage eventId="event-123" />);

      await waitFor(() => {
        expect(screen.getByText("Test Event")).toBeInTheDocument();
      });

      // The attendee share section should not appear (organizers have their own section)
      expect(screen.queryByText("Share This Event")).not.toBeInTheDocument();
    });

    it("should NOT show share section for MAYBE RSVP", async () => {
      vi.mocked(api.getEvent).mockResolvedValue({
        event: {
          ...baseEvent,
          allowInviteSharing: true,
          userRsvp: "MAYBE",
        },
        isOrganizer: false,
      });
      vi.mocked(api.isAuthenticated).mockReturnValue(true);
      vi.mocked(api.getAuthToken).mockReturnValue("test-token");

      render(<EventPage eventId="event-123" />);

      await waitFor(() => {
        expect(screen.getByText("Test Event")).toBeInTheDocument();
      });

      expect(screen.queryByText("Share This Event")).not.toBeInTheDocument();
    });

    it("should NOT show share section for draft events", async () => {
      vi.mocked(api.getEvent).mockResolvedValue({
        event: {
          ...baseEvent,
          allowInviteSharing: true,
          userRsvp: "YES",
          state: "DRAFT",
        },
        isOrganizer: false,
      });
      vi.mocked(api.isAuthenticated).mockReturnValue(true);
      vi.mocked(api.getAuthToken).mockReturnValue("test-token");

      render(<EventPage eventId="event-123" />);

      await waitFor(() => {
        expect(screen.getByText("Test Event")).toBeInTheDocument();
      });

      expect(screen.queryByText("Share This Event")).not.toBeInTheDocument();
    });

    it("should show share section for ongoing events when conditions are met", async () => {
      vi.mocked(api.getEvent).mockResolvedValue({
        event: {
          ...baseEvent,
          allowInviteSharing: true,
          userRsvp: "YES",
          state: "ONGOING",
        },
        isOrganizer: false,
      });
      vi.mocked(api.isAuthenticated).mockReturnValue(true);
      vi.mocked(api.getAuthToken).mockReturnValue("test-token");

      render(<EventPage eventId="event-123" />);

      await waitFor(() => {
        expect(screen.getByText("Share This Event")).toBeInTheDocument();
      });
    });
  });

  describe("organizer actions", () => {
    it("should show organizer actions for event organizer", async () => {
      vi.mocked(api.getEvent).mockResolvedValue({
        event: baseEvent,
        isOrganizer: true,
      });
      vi.mocked(api.isAuthenticated).mockReturnValue(true);
      vi.mocked(api.getAuthToken).mockReturnValue("test-token");

      render(<EventPage eventId="event-123" />);

      await waitFor(() => {
        expect(screen.getByText("Organizer Actions")).toBeInTheDocument();
      });

      expect(screen.getByText("Edit Event")).toBeInTheDocument();
    });

    it("should NOT show organizer actions for non-organizer", async () => {
      vi.mocked(api.getEvent).mockResolvedValue({
        event: baseEvent,
        isOrganizer: false,
      });
      vi.mocked(api.isAuthenticated).mockReturnValue(true);
      vi.mocked(api.getAuthToken).mockReturnValue("test-token");

      render(<EventPage eventId="event-123" />);

      await waitFor(() => {
        expect(screen.getByText("Test Event")).toBeInTheDocument();
      });

      expect(screen.queryByText("Organizer Actions")).not.toBeInTheDocument();
    });
  });
});
