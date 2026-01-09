import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { EventCard } from "./EventCard";
import type { OrganizingEvent, AttendingEvent, PendingEvent } from "../services/api";

// Helper to wrap component in BrowserRouter
function renderWithRouter(ui: React.ReactElement) {
  return render(<BrowserRouter>{ui}</BrowserRouter>);
}

describe("EventCard", () => {
  const baseEvent = {
    id: "event-123",
    title: "Test Event",
    dateTime: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
    endDateTime: null,
    timezone: "America/New_York",
    location: "Test Location",
    state: "PUBLISHED",
    imageUrl: null,
    category: "Party",
  };

  describe("organizing variant", () => {
    it("should render event title", () => {
      const event: OrganizingEvent = {
        ...baseEvent,
        rsvpCounts: { yes: 5, no: 2, maybe: 3 },
      };

      renderWithRouter(<EventCard event={event} variant="organizing" />);
      expect(screen.getByText("Test Event")).toBeInTheDocument();
    });

    it("should display RSVP counts", () => {
      const event: OrganizingEvent = {
        ...baseEvent,
        rsvpCounts: { yes: 5, no: 2, maybe: 3 },
      };

      renderWithRouter(<EventCard event={event} variant="organizing" />);
      expect(screen.getByText("Going")).toBeInTheDocument();
      expect(screen.getByText("5")).toBeInTheDocument();
    });

    it("should link to event details page", () => {
      const event: OrganizingEvent = {
        ...baseEvent,
        rsvpCounts: { yes: 5, no: 2, maybe: 3 },
      };

      renderWithRouter(<EventCard event={event} variant="organizing" />);
      const link = screen.getByRole("link");
      expect(link).toHaveAttribute("href", "/events/event-123");
    });

    it("should display location", () => {
      const event: OrganizingEvent = {
        ...baseEvent,
        rsvpCounts: { yes: 5, no: 2, maybe: 3 },
      };

      renderWithRouter(<EventCard event={event} variant="organizing" />);
      expect(screen.getByText("Test Location")).toBeInTheDocument();
    });

    it("should show Organizer badge", () => {
      const event: OrganizingEvent = {
        ...baseEvent,
        rsvpCounts: { yes: 5, no: 2, maybe: 3 },
      };

      renderWithRouter(<EventCard event={event} variant="organizing" />);
      expect(screen.getByText("Organizer")).toBeInTheDocument();
    });
  });

  describe("attending variant", () => {
    it("should render event title", () => {
      const event: AttendingEvent = {
        ...baseEvent,
        rsvpStatus: "YES",
        isOrganizer: false,
      };

      renderWithRouter(<EventCard event={event} variant="attending" />);
      expect(screen.getByText("Test Event")).toBeInTheDocument();
    });

    it("should show RSVP status Going for YES", () => {
      const event: AttendingEvent = {
        ...baseEvent,
        rsvpStatus: "YES",
        isOrganizer: false,
      };

      renderWithRouter(<EventCard event={event} variant="attending" />);
      expect(screen.getByText("Going")).toBeInTheDocument();
    });

    it("should show RSVP status Maybe for MAYBE", () => {
      const event: AttendingEvent = {
        ...baseEvent,
        rsvpStatus: "MAYBE",
        isOrganizer: false,
      };

      renderWithRouter(<EventCard event={event} variant="attending" />);
      expect(screen.getByText("Maybe")).toBeInTheDocument();
    });

    it("should show RSVP status Not Going for NO", () => {
      const event: AttendingEvent = {
        ...baseEvent,
        rsvpStatus: "NO",
        isOrganizer: false,
      };

      renderWithRouter(<EventCard event={event} variant="attending" />);
      expect(screen.getByText("Not Going")).toBeInTheDocument();
    });
  });

  describe("pending variant", () => {
    it("should render event title", () => {
      const event: PendingEvent = {
        ...baseEvent,
        rsvpStatus: null,
        isOrganizer: false,
      };

      renderWithRouter(<EventCard event={event} variant="pending" />);
      expect(screen.getByText("Test Event")).toBeInTheDocument();
    });
  });

  describe("event state display", () => {
    it("should show Draft badge for draft events", () => {
      const event: OrganizingEvent = {
        ...baseEvent,
        state: "DRAFT",
        rsvpCounts: { yes: 0, no: 0, maybe: 0 },
      };

      renderWithRouter(<EventCard event={event} variant="organizing" />);
      expect(screen.getByText("Draft")).toBeInTheDocument();
    });

    it("should show RSVPs Closed badge for closed events", () => {
      const event: OrganizingEvent = {
        ...baseEvent,
        state: "CLOSED",
        rsvpCounts: { yes: 5, no: 2, maybe: 3 },
      };

      renderWithRouter(<EventCard event={event} variant="organizing" />);
      expect(screen.getByText("RSVPs Closed")).toBeInTheDocument();
    });

    it("should show Happening Now badge for ongoing events", () => {
      const event: OrganizingEvent = {
        ...baseEvent,
        state: "ONGOING",
        rsvpCounts: { yes: 5, no: 2, maybe: 3 },
      };

      renderWithRouter(<EventCard event={event} variant="organizing" />);
      expect(screen.getByText("Happening Now")).toBeInTheDocument();
    });
  });

  describe("category display", () => {
    it("should display category when present", () => {
      const event: OrganizingEvent = {
        ...baseEvent,
        category: "Birthday",
        rsvpCounts: { yes: 5, no: 2, maybe: 3 },
      };

      renderWithRouter(<EventCard event={event} variant="organizing" />);
      expect(screen.getByText("Birthday")).toBeInTheDocument();
    });

    it("should not crash when category is null", () => {
      const event: OrganizingEvent = {
        ...baseEvent,
        category: null,
        rsvpCounts: { yes: 5, no: 2, maybe: 3 },
      };

      renderWithRouter(<EventCard event={event} variant="organizing" />);
      expect(screen.getByText("Test Event")).toBeInTheDocument();
    });
  });

  describe("relative date display", () => {
    it("should show Tomorrow for events tomorrow", () => {
      const event: OrganizingEvent = {
        ...baseEvent,
        dateTime: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
        rsvpCounts: { yes: 5, no: 2, maybe: 3 },
      };

      renderWithRouter(<EventCard event={event} variant="organizing" />);
      expect(screen.getByText("Tomorrow")).toBeInTheDocument();
    });
  });
});
