import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { EventSearchPage } from "./EventSearchPage";
import * as api from "../services/api";
import type { EventSearchResponse } from "../services/api";

// Mock the API module
vi.mock("../services/api", () => ({
  searchEvents: vi.fn(),
  isApiError: vi.fn(),
}));

// Helper to wrap component in BrowserRouter
function renderWithRouter(ui: React.ReactElement) {
  return render(<BrowserRouter>{ui}</BrowserRouter>);
}

describe("EventSearchPage", () => {
  const mockSearchResponse: EventSearchResponse = {
    events: [
      {
        id: "event-1",
        title: "Summer Party",
        dateTime: new Date(Date.now() + 86400000).toISOString(),
        endDateTime: null,
        timezone: "America/New_York",
        location: "Park",
        state: "PUBLISHED",
        imageUrl: null,
        category: "Party",
        isOrganizer: true,
        rsvpStatus: null,
        rsvpCounts: { yes: 10, no: 2, maybe: 5 },
      },
      {
        id: "event-2",
        title: "Winter Ball",
        dateTime: new Date(Date.now() + 172800000).toISOString(),
        endDateTime: null,
        timezone: "America/New_York",
        location: "Ballroom",
        state: "PUBLISHED",
        imageUrl: null,
        category: "Formal",
        isOrganizer: false,
        rsvpStatus: "YES",
      },
    ],
    pagination: {
      page: 1,
      limit: 20,
      total: 2,
      totalPages: 1,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render page header", () => {
    vi.mocked(api.searchEvents).mockResolvedValue(mockSearchResponse);
    renderWithRouter(<EventSearchPage />);

    expect(screen.getByText("Search Events")).toBeInTheDocument();
    expect(screen.getByText("Find and filter your events")).toBeInTheDocument();
  });

  it("should render back to dashboard link", () => {
    vi.mocked(api.searchEvents).mockResolvedValue(mockSearchResponse);
    renderWithRouter(<EventSearchPage />);

    const backLink = screen.getByText("Back to Dashboard");
    expect(backLink).toBeInTheDocument();
    expect(backLink.closest("a")).toHaveAttribute("href", "/dashboard");
  });

  it("should load initial events on mount", async () => {
    vi.mocked(api.searchEvents).mockResolvedValue(mockSearchResponse);
    renderWithRouter(<EventSearchPage />);

    await waitFor(() => {
      expect(api.searchEvents).toHaveBeenCalledWith({});
    });

    await waitFor(() => {
      expect(screen.getByText("Summer Party")).toBeInTheDocument();
      expect(screen.getByText("Winter Ball")).toBeInTheDocument();
    });
  });

  it("should display loading skeleton while fetching", async () => {
    vi.mocked(api.searchEvents).mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(mockSearchResponse), 100))
    );

    renderWithRouter(<EventSearchPage />);

    // Should show loading skeletons
    const skeletons = document.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("should display event count", async () => {
    vi.mocked(api.searchEvents).mockResolvedValue(mockSearchResponse);
    renderWithRouter(<EventSearchPage />);

    await waitFor(() => {
      expect(screen.getByText("2 events found")).toBeInTheDocument();
    });
  });

  it("should display correct singular event count", async () => {
    const singleEventResponse: EventSearchResponse = {
      events: [mockSearchResponse.events[0]],
      pagination: {
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      },
    };

    vi.mocked(api.searchEvents).mockResolvedValue(singleEventResponse);
    renderWithRouter(<EventSearchPage />);

    await waitFor(() => {
      expect(screen.getByText("1 event found")).toBeInTheDocument();
    });
  });

  it("should display pagination info", async () => {
    vi.mocked(api.searchEvents).mockResolvedValue(mockSearchResponse);
    renderWithRouter(<EventSearchPage />);

    await waitFor(() => {
      expect(screen.getByText(/Showing 1-2 of 2/)).toBeInTheDocument();
    });
  });

  it("should handle search with filters", async () => {
    vi.mocked(api.searchEvents).mockResolvedValue(mockSearchResponse);
    
    renderWithRouter(<EventSearchPage />);

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText("Summer Party")).toBeInTheDocument();
    });

    // Perform search
    const searchInput = screen.getByPlaceholderText("Search events by title...");
    fireEvent.change(searchInput, { target: { value: "Party" } });

    const searchButton = screen.getByText("Search");
    fireEvent.click(searchButton);

    await waitFor(() => {
      expect(api.searchEvents).toHaveBeenCalledWith({
        title: "Party",
        page: 1,
      });
    });
  });

  it("should display empty state when no events found", async () => {
    const emptyResponse: EventSearchResponse = {
      events: [],
      pagination: {
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
      },
    };

    vi.mocked(api.searchEvents).mockResolvedValue(emptyResponse);
    renderWithRouter(<EventSearchPage />);

    await waitFor(() => {
      expect(screen.getByText("No events found")).toBeInTheDocument();
      expect(screen.getByText("Try adjusting your search filters")).toBeInTheDocument();
    });
  });

  it("should display error state on API error", async () => {
    const apiError = {
      statusCode: 500,
      message: "Server error",
    };

    vi.mocked(api.searchEvents).mockRejectedValue(apiError);
    vi.mocked(api.isApiError).mockReturnValue(true);

    renderWithRouter(<EventSearchPage />);

    await waitFor(() => {
      expect(screen.getByText("Something went wrong")).toBeInTheDocument();
      expect(screen.getByText("Server error")).toBeInTheDocument();
    });
  });

  it("should display generic error message on non-API error", async () => {
    vi.mocked(api.searchEvents).mockRejectedValue(new Error("Network error"));
    vi.mocked(api.isApiError).mockReturnValue(false);

    renderWithRouter(<EventSearchPage />);

    await waitFor(() => {
      expect(screen.getByText("Failed to search events. Please try again.")).toBeInTheDocument();
    });
  });

  it("should display auth error on 401", async () => {
    const authError = {
      statusCode: 401,
      message: "Unauthorized",
    };

    vi.mocked(api.searchEvents).mockRejectedValue(authError);
    vi.mocked(api.isApiError).mockReturnValue(true);

    renderWithRouter(<EventSearchPage />);

    await waitFor(() => {
      expect(screen.getByText("Please log in to search events.")).toBeInTheDocument();
    });
  });

  it("should retry on error when retry button clicked", async () => {
    const apiError = {
      statusCode: 500,
      message: "Server error",
    };

    vi.mocked(api.searchEvents).mockRejectedValueOnce(apiError).mockResolvedValue(mockSearchResponse);
    vi.mocked(api.isApiError).mockReturnValue(true);

        renderWithRouter(<EventSearchPage />);

    // Wait for error state
    await waitFor(() => {
      expect(screen.getByText("Try Again")).toBeInTheDocument();
    });

    // Click retry
    const retryButton = screen.getByText("Try Again");
    fireEvent.click(retryButton);

    // Should show success
    await waitFor(() => {
      expect(screen.getByText("Summer Party")).toBeInTheDocument();
    });
  });

  it("should handle pagination", async () => {
    const page1Response: EventSearchResponse = {
      events: [mockSearchResponse.events[0]],
      pagination: {
        page: 1,
        limit: 1,
        total: 2,
        totalPages: 2,
      },
    };

    const page2Response: EventSearchResponse = {
      events: [mockSearchResponse.events[1]],
      pagination: {
        page: 2,
        limit: 1,
        total: 2,
        totalPages: 2,
      },
    };

    vi.mocked(api.searchEvents).mockResolvedValueOnce(page1Response).mockResolvedValueOnce(page2Response);

        renderWithRouter(<EventSearchPage />);

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText("Summer Party")).toBeInTheDocument();
    });

    // Click next page
    const nextButton = screen.getByText("Next");
    fireEvent.click(nextButton);

    await waitFor(() => {
      expect(api.searchEvents).toHaveBeenCalledWith({ page: 2 });
    });

    await waitFor(() => {
      expect(screen.getByText("Winter Ball")).toBeInTheDocument();
    });
  });

  it("should not show pagination when only one page", async () => {
    vi.mocked(api.searchEvents).mockResolvedValue(mockSearchResponse);
    renderWithRouter(<EventSearchPage />);

    await waitFor(() => {
      expect(screen.getByText("Summer Party")).toBeInTheDocument();
    });

    // Pagination should not be visible when totalPages <= 1
    expect(screen.queryByText("Previous")).not.toBeInTheDocument();
    expect(screen.queryByText("Next")).not.toBeInTheDocument();
  });

  it("should disable previous button on first page", async () => {
    const multiPageResponse: EventSearchResponse = {
      events: [mockSearchResponse.events[0]],
      pagination: {
        page: 1,
        limit: 1,
        total: 2,
        totalPages: 2,
      },
    };

    vi.mocked(api.searchEvents).mockResolvedValue(multiPageResponse);
    renderWithRouter(<EventSearchPage />);

    await waitFor(() => {
      expect(screen.getByText("Summer Party")).toBeInTheDocument();
    });

    const previousButton = screen.getByText("Previous");
    expect(previousButton).toBeDisabled();
  });

  it("should disable next button on last page", async () => {
    const lastPageResponse: EventSearchResponse = {
      events: [mockSearchResponse.events[1]],
      pagination: {
        page: 2,
        limit: 1,
        total: 2,
        totalPages: 2,
      },
    };

    vi.mocked(api.searchEvents).mockResolvedValue(lastPageResponse);
    renderWithRouter(<EventSearchPage />);

    await waitFor(() => {
      expect(screen.getByText("Winter Ball")).toBeInTheDocument();
    });

    const nextButton = screen.getByText("Next");
    expect(nextButton).toBeDisabled();
  });

  it("should render EventCard with correct variant for organizer", async () => {
    vi.mocked(api.searchEvents).mockResolvedValue(mockSearchResponse);
    renderWithRouter(<EventSearchPage />);

    await waitFor(() => {
      expect(screen.getByText("Summer Party")).toBeInTheDocument();
    });

    // Organizer events should show RSVP counts
    expect(screen.getByText("Going")).toBeInTheDocument();
  });

  it("should render EventCard with correct variant for attendee", async () => {
    const attendeeResponse: EventSearchResponse = {
      events: [
        {
          ...mockSearchResponse.events[1],
          isOrganizer: false,
          rsvpStatus: "YES",
        },
      ],
      pagination: {
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      },
    };

    vi.mocked(api.searchEvents).mockResolvedValue(attendeeResponse);
    renderWithRouter(<EventSearchPage />);

    await waitFor(() => {
      expect(screen.getByText("Winter Ball")).toBeInTheDocument();
    });
  });

  it("should render search filter component", () => {
    vi.mocked(api.searchEvents).mockResolvedValue(mockSearchResponse);
    renderWithRouter(<EventSearchPage />);

    expect(screen.getByPlaceholderText("Search events by title...")).toBeInTheDocument();
    expect(screen.getByText("Filters")).toBeInTheDocument();
  });

  it("should preserve filters when paginating", async () => {
    const page1Response: EventSearchResponse = {
      events: [mockSearchResponse.events[0]],
      pagination: {
        page: 1,
        limit: 1,
        total: 2,
        totalPages: 2,
      },
    };

    vi.mocked(api.searchEvents).mockResolvedValue(page1Response);

        renderWithRouter(<EventSearchPage />);

    // Set a filter
    const searchInput = screen.getByPlaceholderText("Search events by title...");
    fireEvent.change(searchInput, { target: { value: "Party" } });

    const searchButton = screen.getByText("Search");
    fireEvent.click(searchButton);

    await waitFor(() => {
      expect(api.searchEvents).toHaveBeenCalledWith({
        title: "Party",
        page: 1,
      });
    });

    // Go to next page
    const nextButton = screen.getByText("Next");
    fireEvent.click(nextButton);

    // Should preserve the title filter
    await waitFor(() => {
      expect(api.searchEvents).toHaveBeenCalledWith({
        title: "Party",
        page: 2,
      });
    });
  });
});
