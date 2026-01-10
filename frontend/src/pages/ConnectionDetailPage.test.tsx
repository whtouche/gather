import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { BrowserRouter, MemoryRouter, Route, Routes } from "react-router-dom";
import { ConnectionDetailPage } from "./ConnectionDetailPage";
import * as api from "../services/api";
import type { ConnectionDetail, SharedEvent } from "../services/api";

// Mock the api module but preserve isApiError
vi.mock("../services/api", async () => {
  const actual = await vi.importActual<typeof api>("../services/api");
  return {
    ...actual,
    getConnectionDetail: vi.fn(),
  };
});

// Helper to render component with router and route params
function renderWithRouter(userId: string) {
  return render(
    <MemoryRouter initialEntries={[`/connections/${userId}`]}>
      <Routes>
        <Route path="/connections/:userId" element={<ConnectionDetailPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("ConnectionDetailPage", () => {
  const mockSharedEvents: SharedEvent[] = [
    {
      eventId: "event-1",
      eventTitle: "Summer BBQ",
      eventDate: "2024-06-15T00:00:00.000Z",
      eventLocation: "Central Park",
      userRole: "ORGANIZER",
    },
    {
      eventId: "event-2",
      eventTitle: "Winter Party",
      eventDate: "2024-01-10T00:00:00.000Z",
      eventLocation: "Downtown Hall",
      userRole: "ATTENDEE",
    },
  ];

  const mockConnection: ConnectionDetail = {
    userId: "user-456",
    displayName: "Alice Smith",
    photoUrl: "https://example.com/alice.jpg",
    bio: "Software engineer and tech enthusiast",
    location: "San Francisco, CA",
    sharedEvents: mockSharedEvents,
    totalSharedEvents: 2,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Loading State", () => {
    it("should show loading skeleton while fetching connection details", () => {
      vi.mocked(api.getConnectionDetail).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      renderWithRouter("user-456");

      // Should show loading skeletons with animate-pulse class
      expect(document.querySelector(".animate-pulse")).toBeTruthy();
    });
  });

  describe("Success State", () => {
    it("should display connection details when data is loaded", async () => {
      vi.mocked(api.getConnectionDetail).mockResolvedValue({
        connection: mockConnection,
      });

      renderWithRouter("user-456");

      await waitFor(() => {
        expect(screen.getByText("Alice Smith")).toBeInTheDocument();
        expect(screen.getByText("Software engineer and tech enthusiast")).toBeInTheDocument();
        expect(screen.getByText("San Francisco, CA")).toBeInTheDocument();
      });
    });

    it("should display profile photo when available", async () => {
      vi.mocked(api.getConnectionDetail).mockResolvedValue({
        connection: mockConnection,
      });

      renderWithRouter("user-456");

      await waitFor(() => {
        const photo = screen.getByAltText("Alice Smith");
        expect(photo).toHaveAttribute("src", "https://example.com/alice.jpg");
      });
    });

    it("should show default avatar when photo is not available", async () => {
      const connectionWithoutPhoto = {
        ...mockConnection,
        photoUrl: null,
      };

      vi.mocked(api.getConnectionDetail).mockResolvedValue({
        connection: connectionWithoutPhoto,
      });

      renderWithRouter("user-456");

      await waitFor(() => {
        // Should show first letter of name
        expect(screen.getByText("A")).toBeInTheDocument();
      });
    });

    it("should display total shared events count", async () => {
      vi.mocked(api.getConnectionDetail).mockResolvedValue({
        connection: mockConnection,
      });

      renderWithRouter("user-456");

      await waitFor(() => {
        expect(screen.getByText("2 events together")).toBeInTheDocument();
      });
    });

    it("should use singular form for one event", async () => {
      const connectionWithOneEvent = {
        ...mockConnection,
        sharedEvents: [mockSharedEvents[0]],
        totalSharedEvents: 1,
      };

      vi.mocked(api.getConnectionDetail).mockResolvedValue({
        connection: connectionWithOneEvent,
      });

      renderWithRouter("user-456");

      await waitFor(() => {
        expect(screen.getByText("1 event together")).toBeInTheDocument();
      });
    });

    it("should display all shared events", async () => {
      vi.mocked(api.getConnectionDetail).mockResolvedValue({
        connection: mockConnection,
      });

      renderWithRouter("user-456");

      await waitFor(() => {
        expect(screen.getByText("Summer BBQ")).toBeInTheDocument();
        expect(screen.getByText("Winter Party")).toBeInTheDocument();
        expect(screen.getByText("Central Park")).toBeInTheDocument();
        expect(screen.getByText("Downtown Hall")).toBeInTheDocument();
      });
    });

    it("should show organizer badge for organizer events", async () => {
      vi.mocked(api.getConnectionDetail).mockResolvedValue({
        connection: mockConnection,
      });

      renderWithRouter("user-456");

      await waitFor(() => {
        expect(screen.getByText("Organizer")).toBeInTheDocument();
      });
    });

    it("should not show organizer badge for attendee events", async () => {
      const connectionAsAttendee = {
        ...mockConnection,
        sharedEvents: [
          {
            ...mockSharedEvents[1],
            userRole: "ATTENDEE" as const,
          },
        ],
        totalSharedEvents: 1,
      };

      vi.mocked(api.getConnectionDetail).mockResolvedValue({
        connection: connectionAsAttendee,
      });

      renderWithRouter("user-456");

      await waitFor(() => {
        expect(screen.queryByText("Organizer")).not.toBeInTheDocument();
      });
    });

    it("should link to event pages from shared events", async () => {
      vi.mocked(api.getConnectionDetail).mockResolvedValue({
        connection: mockConnection,
      });

      renderWithRouter("user-456");

      await waitFor(() => {
        const links = screen.getAllByRole("link");
        const eventLink = links.find((link) =>
          link.getAttribute("href")?.includes("/events/event-1")
        );
        expect(eventLink).toBeTruthy();
      });
    });

    it("should hide bio section when bio is null", async () => {
      const connectionWithoutBio = {
        ...mockConnection,
        bio: null,
      };

      vi.mocked(api.getConnectionDetail).mockResolvedValue({
        connection: connectionWithoutBio,
      });

      renderWithRouter("user-456");

      await waitFor(() => {
        expect(screen.queryByText("About")).not.toBeInTheDocument();
      });
    });

    it("should hide location when location is null", async () => {
      const connectionWithoutLocation = {
        ...mockConnection,
        location: null,
      };

      vi.mocked(api.getConnectionDetail).mockResolvedValue({
        connection: connectionWithoutLocation,
      });

      renderWithRouter("user-456");

      await waitFor(() => {
        expect(screen.queryByText("San Francisco, CA")).not.toBeInTheDocument();
      });
    });

    it("should format dates correctly", async () => {
      vi.mocked(api.getConnectionDetail).mockResolvedValue({
        connection: mockConnection,
      });

      renderWithRouter("user-456");

      await waitFor(() => {
        // Dates should be formatted (e.g., "Jun 15, 2024")
        const dates = screen.getAllByText(/2024/);
        expect(dates.length).toBeGreaterThan(0);
      });
    });
  });

  describe("Empty State", () => {
    it("should show empty state when no events match filters", async () => {
      const connectionWithNoFilteredEvents = {
        ...mockConnection,
        sharedEvents: [],
        totalSharedEvents: 0,
      };

      vi.mocked(api.getConnectionDetail).mockResolvedValue({
        connection: connectionWithNoFilteredEvents,
      });

      renderWithRouter("user-456");

      await waitFor(() => {
        expect(screen.getByText("No events match the current filters.")).toBeInTheDocument();
      });
    });
  });

  describe("Error State", () => {
    it("should show error message when fetch fails", async () => {
      const error: api.ApiError = {
        message: "Network error",
        statusCode: 500,
      };
      vi.mocked(api.getConnectionDetail).mockRejectedValue(error);

      renderWithRouter("user-456");

      await waitFor(() => {
        expect(screen.getByText("Something went wrong")).toBeInTheDocument();
        expect(screen.getByText("Network error")).toBeInTheDocument();
      });
    });

    it("should show custom message for 404 error", async () => {
      const error: api.ApiError = {
        message: "Not found",
        statusCode: 404,
      };
      vi.mocked(api.getConnectionDetail).mockRejectedValue(error);

      renderWithRouter("user-456");

      await waitFor(() => {
        expect(
          screen.getByText(
            "Connection not found. You must have attended at least one event together."
          )
        ).toBeInTheDocument();
      });
    });

    it("should show custom message for 401 error", async () => {
      const error: api.ApiError = {
        message: "Unauthorized",
        statusCode: 401,
      };
      vi.mocked(api.getConnectionDetail).mockRejectedValue(error);

      renderWithRouter("user-456");

      await waitFor(() => {
        expect(
          screen.getByText("Please log in to view connection details.")
        ).toBeInTheDocument();
      });
    });

    it("should show generic error for unknown errors", async () => {
      vi.mocked(api.getConnectionDetail).mockRejectedValue(new Error("Unknown"));

      renderWithRouter("user-456");

      await waitFor(() => {
        expect(
          screen.getByText("Failed to load connection details. Please try again.")
        ).toBeInTheDocument();
      });
    });

    it("should have retry button in error state", async () => {
      const error: api.ApiError = {
        message: "Network error",
        statusCode: 500,
      };
      vi.mocked(api.getConnectionDetail).mockRejectedValue(error);

      renderWithRouter("user-456");

      await waitFor(() => {
        const retryButton = screen.getByText("Try Again");
        expect(retryButton).toBeInTheDocument();
      });
    });
  });

  describe("Header", () => {
    it("should display page title", async () => {
      vi.mocked(api.getConnectionDetail).mockResolvedValue({
        connection: mockConnection,
      });

      renderWithRouter("user-456");

      await waitFor(() => {
        expect(screen.getByText("Connection Details")).toBeInTheDocument();
      });
    });

    it("should have back to connections link", async () => {
      vi.mocked(api.getConnectionDetail).mockResolvedValue({
        connection: mockConnection,
      });

      renderWithRouter("user-456");

      await waitFor(() => {
        const backLink = screen.getByText("Back to Connections");
        expect(backLink.closest("a")).toHaveAttribute("href", "/connections");
      });
    });

    it("should show subtitle", async () => {
      vi.mocked(api.getConnectionDetail).mockResolvedValue({
        connection: mockConnection,
      });

      renderWithRouter("user-456");

      await waitFor(() => {
        expect(
          screen.getByText("Shared event history and profile information")
        ).toBeInTheDocument();
      });
    });
  });

  describe("Invalid User ID", () => {
    it("should handle missing user ID parameter", async () => {
      render(
        <BrowserRouter>
          <ConnectionDetailPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText("Invalid Connection")).toBeInTheDocument();
        expect(screen.getByText("No user ID provided.")).toBeInTheDocument();
      });
    });

    it("should show link to connections page when no user ID", async () => {
      render(
        <BrowserRouter>
          <ConnectionDetailPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        const backLink = screen.getByText("Back to Connections");
        expect(backLink.closest("a")).toHaveAttribute("href", "/connections");
      });
    });
  });

  describe("Shared Events Section", () => {
    it("should display shared events count in section header", async () => {
      vi.mocked(api.getConnectionDetail).mockResolvedValue({
        connection: mockConnection,
      });

      renderWithRouter("user-456");

      await waitFor(() => {
        expect(screen.getByText("Shared Events (2)")).toBeInTheDocument();
      });
    });

    it("should show events sorted by date descending", async () => {
      vi.mocked(api.getConnectionDetail).mockResolvedValue({
        connection: mockConnection,
      });

      renderWithRouter("user-456");

      await waitFor(() => {
        const eventTitles = screen.getAllByText(/BBQ|Party/);
        // Summer BBQ (June 2024) should appear before Winter Party (Jan 2024)
        expect(eventTitles[0].textContent).toContain("Summer BBQ");
      });
    });
  });
});
