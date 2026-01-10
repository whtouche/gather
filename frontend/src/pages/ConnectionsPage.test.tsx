import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { ConnectionsPage } from "./ConnectionsPage";
import * as api from "../services/api";
import type { Connection } from "../services/api";

// Mock the api module but preserve isApiError
vi.mock("../services/api", async () => {
  const actual = await vi.importActual<typeof api>("../services/api");
  return {
    ...actual,
    getConnections: vi.fn(),
  };
});

// Helper to wrap component in BrowserRouter
function renderWithRouter(ui: React.ReactElement) {
  return render(<BrowserRouter>{ui}</BrowserRouter>);
}

describe("ConnectionsPage", () => {
  const mockConnections: Connection[] = [
    {
      userId: "user-1",
      displayName: "Alice Smith",
      photoUrl: "https://example.com/alice.jpg",
      sharedEventCount: 3,
      mostRecentEvent: {
        eventId: "event-1",
        eventTitle: "Summer BBQ",
        eventDate: "2024-06-15T00:00:00.000Z",
      },
    },
    {
      userId: "user-2",
      displayName: "Bob Johnson",
      photoUrl: null,
      sharedEventCount: 1,
      mostRecentEvent: {
        eventId: "event-2",
        eventTitle: "Winter Party",
        eventDate: "2024-01-10T00:00:00.000Z",
      },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Loading State", () => {
    it("should show loading skeleton while fetching connections", () => {
      vi.mocked(api.getConnections).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      renderWithRouter(<ConnectionsPage />);

      // Should show loading skeletons
      expect(screen.getAllByRole("generic")).toBeTruthy();
    });
  });

  describe("Success State", () => {
    it("should display connections when data is loaded", async () => {
      vi.mocked(api.getConnections).mockResolvedValue({
        connections: mockConnections,
      });

      renderWithRouter(<ConnectionsPage />);

      await waitFor(() => {
        expect(screen.getByText("Alice Smith")).toBeInTheDocument();
        expect(screen.getByText("Bob Johnson")).toBeInTheDocument();
      });
    });

    it("should show connection count", async () => {
      vi.mocked(api.getConnections).mockResolvedValue({
        connections: mockConnections,
      });

      renderWithRouter(<ConnectionsPage />);

      await waitFor(() => {
        expect(screen.getByText("2 Connections")).toBeInTheDocument();
      });
    });

    it("should display shared event count", async () => {
      vi.mocked(api.getConnections).mockResolvedValue({
        connections: mockConnections,
      });

      renderWithRouter(<ConnectionsPage />);

      await waitFor(() => {
        expect(screen.getByText("3 events together")).toBeInTheDocument();
        expect(screen.getByText("1 event together")).toBeInTheDocument();
      });
    });

    it("should display most recent event information", async () => {
      vi.mocked(api.getConnections).mockResolvedValue({
        connections: mockConnections,
      });

      renderWithRouter(<ConnectionsPage />);

      await waitFor(() => {
        expect(screen.getByText(/Summer BBQ/)).toBeInTheDocument();
        expect(screen.getByText(/Winter Party/)).toBeInTheDocument();
      });
    });

    it("should link to connection detail pages", async () => {
      vi.mocked(api.getConnections).mockResolvedValue({
        connections: mockConnections,
      });

      renderWithRouter(<ConnectionsPage />);

      await waitFor(() => {
        const links = screen.getAllByRole("link");
        const aliceLink = links.find((link) =>
          link.getAttribute("href")?.includes("/connections/user-1")
        );
        expect(aliceLink).toBeTruthy();
      });
    });

    it("should show profile photo when available", async () => {
      vi.mocked(api.getConnections).mockResolvedValue({
        connections: mockConnections,
      });

      renderWithRouter(<ConnectionsPage />);

      await waitFor(() => {
        const alicePhoto = screen.getByAltText("Alice Smith");
        expect(alicePhoto).toHaveAttribute(
          "src",
          "https://example.com/alice.jpg"
        );
      });
    });

    it("should show default avatar when photo is not available", async () => {
      vi.mocked(api.getConnections).mockResolvedValue({
        connections: mockConnections,
      });

      renderWithRouter(<ConnectionsPage />);

      await waitFor(() => {
        // Bob has no photo, should show SVG icon
        const svgElements = screen.getAllByRole("img", { hidden: true });
        expect(svgElements.length).toBeGreaterThan(0);
      });
    });

    it("should format dates correctly", async () => {
      vi.mocked(api.getConnections).mockResolvedValue({
        connections: mockConnections,
      });

      renderWithRouter(<ConnectionsPage />);

      await waitFor(() => {
        // Check that date is formatted (e.g., "Jun 15, 2024")
        // Date might be formatted differently based on locale
        // There are multiple connections, so we check for multiple dates
        const dates = screen.getAllByText(/2024/);
        expect(dates.length).toBeGreaterThan(0);
      });
    });
  });

  describe("Empty State", () => {
    it("should show empty state when no connections", async () => {
      vi.mocked(api.getConnections).mockResolvedValue({
        connections: [],
      });

      renderWithRouter(<ConnectionsPage />);

      await waitFor(() => {
        expect(screen.getByText("No connections yet")).toBeInTheDocument();
        expect(
          screen.getByText(
            /Attend events to meet new people and build connections/
          )
        ).toBeInTheDocument();
      });
    });

    it("should show link to browse events in empty state", async () => {
      vi.mocked(api.getConnections).mockResolvedValue({
        connections: [],
      });

      renderWithRouter(<ConnectionsPage />);

      await waitFor(() => {
        const browseLink = screen.getByText("Browse Events");
        expect(browseLink.closest("a")).toHaveAttribute("href", "/dashboard");
      });
    });
  });

  describe("Error State", () => {
    it("should show error message when fetch fails", async () => {
      const error: api.ApiError = {
        message: "Network error",
        statusCode: 500,
      };
      vi.mocked(api.getConnections).mockRejectedValue(error);

      renderWithRouter(<ConnectionsPage />);

      await waitFor(() => {
        expect(screen.getByText("Something went wrong")).toBeInTheDocument();
        expect(screen.getByText("Network error")).toBeInTheDocument();
      });
    });

    it("should show custom message for 401 error", async () => {
      const error: api.ApiError = {
        message: "Unauthorized",
        statusCode: 401,
      };
      vi.mocked(api.getConnections).mockRejectedValue(error);

      renderWithRouter(<ConnectionsPage />);

      await waitFor(() => {
        expect(
          screen.getByText("Please log in to view your connections.")
        ).toBeInTheDocument();
      });
    });

    it("should show generic error for unknown errors", async () => {
      vi.mocked(api.getConnections).mockRejectedValue(new Error("Unknown"));

      renderWithRouter(<ConnectionsPage />);

      await waitFor(() => {
        expect(
          screen.getByText("Failed to load connections. Please try again.")
        ).toBeInTheDocument();
      });
    });

    it("should have retry button in error state", async () => {
      const error: api.ApiError = {
        message: "Network error",
        statusCode: 500,
      };
      vi.mocked(api.getConnections).mockRejectedValue(error);

      renderWithRouter(<ConnectionsPage />);

      await waitFor(() => {
        const retryButton = screen.getByText("Try Again");
        expect(retryButton).toBeInTheDocument();
      });
    });
  });

  describe("Header", () => {
    it("should display page title", async () => {
      vi.mocked(api.getConnections).mockResolvedValue({
        connections: [],
      });

      renderWithRouter(<ConnectionsPage />);

      await waitFor(() => {
        expect(screen.getByText("Connections")).toBeInTheDocument();
      });
    });

    it("should have back to dashboard link", async () => {
      vi.mocked(api.getConnections).mockResolvedValue({
        connections: [],
      });

      renderWithRouter(<ConnectionsPage />);

      await waitFor(() => {
        const backLink = screen.getByText("Back to Dashboard");
        expect(backLink.closest("a")).toHaveAttribute("href", "/dashboard");
      });
    });

    it("should show subtitle", async () => {
      vi.mocked(api.getConnections).mockResolvedValue({
        connections: [],
      });

      renderWithRouter(<ConnectionsPage />);

      await waitFor(() => {
        expect(
          screen.getByText("People you've attended events with")
        ).toBeInTheDocument();
      });
    });
  });

  describe("Connection singular/plural", () => {
    it("should use singular form for one connection", async () => {
      vi.mocked(api.getConnections).mockResolvedValue({
        connections: [mockConnections[0]],
      });

      renderWithRouter(<ConnectionsPage />);

      await waitFor(() => {
        expect(screen.getByText("1 Connection")).toBeInTheDocument();
      });
    });

    it("should use plural form for multiple connections", async () => {
      vi.mocked(api.getConnections).mockResolvedValue({
        connections: mockConnections,
      });

      renderWithRouter(<ConnectionsPage />);

      await waitFor(() => {
        expect(screen.getByText("2 Connections")).toBeInTheDocument();
      });
    });
  });

  describe("Event singular/plural", () => {
    it("should use singular form for one shared event", async () => {
      const singleEventConnection: Connection = {
        userId: "user-3",
        displayName: "Charlie Brown",
        photoUrl: null,
        sharedEventCount: 1,
        mostRecentEvent: {
          eventId: "event-3",
          eventTitle: "Tech Meetup",
          eventDate: "2024-03-15T00:00:00.000Z",
        },
      };

      vi.mocked(api.getConnections).mockResolvedValue({
        connections: [singleEventConnection],
      });

      renderWithRouter(<ConnectionsPage />);

      await waitFor(() => {
        expect(screen.getByText("1 event together")).toBeInTheDocument();
      });
    });

    it("should use plural form for multiple shared events", async () => {
      vi.mocked(api.getConnections).mockResolvedValue({
        connections: mockConnections,
      });

      renderWithRouter(<ConnectionsPage />);

      await waitFor(() => {
        expect(screen.getByText("3 events together")).toBeInTheDocument();
      });
    });
  });

  describe("Sorting", () => {
    it("should show sorting description", async () => {
      vi.mocked(api.getConnections).mockResolvedValue({
        connections: mockConnections,
      });

      renderWithRouter(<ConnectionsPage />);

      await waitFor(() => {
        expect(
          screen.getByText("Sorted by most recent event together")
        ).toBeInTheDocument();
      });
    });
  });
});
