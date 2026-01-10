import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { EventSearchFilter } from "./EventSearchFilter";
import type { EventSearchFilters } from "../services/api";

describe("EventSearchFilter", () => {
  it("should render search input", () => {
    const onSearch = vi.fn();
    render(<EventSearchFilter onSearch={onSearch} />);

    expect(screen.getByPlaceholderText("Search events by title...")).toBeInTheDocument();
  });

  it("should render filter button", () => {
    const onSearch = vi.fn();
    render(<EventSearchFilter onSearch={onSearch} />);

    expect(screen.getByText("Filters")).toBeInTheDocument();
  });

  it("should expand filters when clicking filter button", async () => {
    const onSearch = vi.fn();
    render(<EventSearchFilter onSearch={onSearch} />);

    const filterButton = screen.getByText("Filters");
    fireEvent.click(filterButton);

    await waitFor(() => {
      expect(screen.getByLabelText("Start Date")).toBeInTheDocument();
      expect(screen.getByLabelText("End Date")).toBeInTheDocument();
      expect(screen.getByLabelText("Event Status")).toBeInTheDocument();
      expect(screen.getByLabelText("My Role")).toBeInTheDocument();
    });
  });

  it("should call onSearch with title filter when search button clicked", () => {
    const onSearch = vi.fn();
    render(<EventSearchFilter onSearch={onSearch} />);

    const searchInput = screen.getByPlaceholderText("Search events by title...");
    fireEvent.change(searchInput, { target: { value: "Summer Party" } });

    const searchButton = screen.getByText("Search");
    fireEvent.click(searchButton);

    expect(onSearch).toHaveBeenCalledWith({
      title: "Summer Party",
    });
  });

  it("should call onSearch when Enter key pressed in search input", () => {
    const onSearch = vi.fn();
    render(<EventSearchFilter onSearch={onSearch} />);

    const searchInput = screen.getByPlaceholderText("Search events by title...");
    fireEvent.change(searchInput, { target: { value: "Winter Ball" } });
    fireEvent.keyDown(searchInput, { key: "Enter", code: "Enter" });

    expect(onSearch).toHaveBeenCalledWith({
      title: "Winter Ball",
    });
  });

  it("should trim whitespace from title search", () => {
    const onSearch = vi.fn();
    render(<EventSearchFilter onSearch={onSearch} />);

    const searchInput = screen.getByPlaceholderText("Search events by title...");
    fireEvent.change(searchInput, { target: { value: "  Spaced Title  " } });

    const searchButton = screen.getByText("Search");
    fireEvent.click(searchButton);

    expect(onSearch).toHaveBeenCalledWith({
      title: "Spaced Title",
    });
  });

  it("should not include empty title in search filters", () => {
    const onSearch = vi.fn();
    render(<EventSearchFilter onSearch={onSearch} />);

    const searchButton = screen.getByText("Search");
    fireEvent.click(searchButton);

    expect(onSearch).toHaveBeenCalledWith({});
  });

  it("should handle date range filters", async () => {
    const onSearch = vi.fn();
    render(<EventSearchFilter onSearch={onSearch} />);

    // Expand filters
    const filterButton = screen.getByText("Filters");
    fireEvent.click(filterButton);

    await waitFor(() => {
      expect(screen.getByLabelText("Start Date")).toBeInTheDocument();
    });

    // Set date range
    const startDateInput = screen.getByLabelText("Start Date");
    const endDateInput = screen.getByLabelText("End Date");

    fireEvent.change(startDateInput, { target: { value: "2024-01-01" } });
    fireEvent.change(endDateInput, { target: { value: "2024-12-31" } });

    const searchButton = screen.getByText("Search");
    fireEvent.click(searchButton);

    expect(onSearch).toHaveBeenCalledWith({
      startDate: "2024-01-01",
      endDate: "2024-12-31",
    });
  });

  it("should handle state filter", async () => {
    const onSearch = vi.fn();
    render(<EventSearchFilter onSearch={onSearch} />);

    // Expand filters
    const filterButton = screen.getByText("Filters");
    fireEvent.click(filterButton);

    await waitFor(() => {
      expect(screen.getByLabelText("Event Status")).toBeInTheDocument();
    });

    // Select state
    const stateSelect = screen.getByLabelText("Event Status");
    fireEvent.change(stateSelect, { target: { value: "upcoming" } });

    const searchButton = screen.getByText("Search");
    fireEvent.click(searchButton);

    expect(onSearch).toHaveBeenCalledWith({
      state: "upcoming",
    });
  });

  it("should handle role filter", async () => {
    const onSearch = vi.fn();
    render(<EventSearchFilter onSearch={onSearch} />);

    // Expand filters
    const filterButton = screen.getByText("Filters");
    fireEvent.click(filterButton);

    await waitFor(() => {
      expect(screen.getByLabelText("My Role")).toBeInTheDocument();
    });

    // Select role
    const roleSelect = screen.getByLabelText("My Role");
    fireEvent.change(roleSelect, { target: { value: "organizer" } });

    const searchButton = screen.getByText("Search");
    fireEvent.click(searchButton);

    expect(onSearch).toHaveBeenCalledWith({
      role: "organizer",
    });
  });

  it("should combine multiple filters", async () => {
    const onSearch = vi.fn();
    render(<EventSearchFilter onSearch={onSearch} />);

    // Set title
    const searchInput = screen.getByPlaceholderText("Search events by title...");
    fireEvent.change(searchInput, { target: { value: "Party" } });

    // Expand filters
    const filterButton = screen.getByText("Filters");
    fireEvent.click(filterButton);

    await waitFor(() => {
      expect(screen.getByLabelText("Event Status")).toBeInTheDocument();
    });

    // Set state and role
    const stateSelect = screen.getByLabelText("Event Status");
    fireEvent.change(stateSelect, { target: { value: "upcoming" } });

    const roleSelect = screen.getByLabelText("My Role");
    fireEvent.change(roleSelect, { target: { value: "organizer" } });

    const searchButton = screen.getByText("Search");
    fireEvent.click(searchButton);

    expect(onSearch).toHaveBeenCalledWith({
      title: "Party",
      state: "upcoming",
      role: "organizer",
    });
  });

  it("should show active filter count badge", async () => {
    const onSearch = vi.fn();
    render(<EventSearchFilter onSearch={onSearch} />);

    // Set title
    const searchInput = screen.getByPlaceholderText("Search events by title...");
    fireEvent.change(searchInput, { target: { value: "Party" } });

    // Expand filters
    const filterButton = screen.getByText("Filters");
    fireEvent.click(filterButton);

    await waitFor(() => {
      expect(screen.getByLabelText("Event Status")).toBeInTheDocument();
    });

    // Set state
    const stateSelect = screen.getByLabelText("Event Status");
    fireEvent.change(stateSelect, { target: { value: "upcoming" } });

    // Should show badge with count of 2 (title + state)
    await waitFor(() => {
      expect(screen.getByText("2")).toBeInTheDocument();
    });
  });

  it("should show clear button when filters are active", async () => {
    const onSearch = vi.fn();
    render(<EventSearchFilter onSearch={onSearch} />);

    // Set title
    const searchInput = screen.getByPlaceholderText("Search events by title...");
    fireEvent.change(searchInput, { target: { value: "Party" } });

    // Clear button should appear
    await waitFor(() => {
      expect(screen.getByText("Clear")).toBeInTheDocument();
    });
  });

  it("should reset all filters when clear button clicked", async () => {
    const onSearch = vi.fn();
    render(<EventSearchFilter onSearch={onSearch} />);

    // Set title
    const searchInput = screen.getByPlaceholderText("Search events by title...");
    fireEvent.change(searchInput, { target: { value: "Party" } });

    // Expand filters
    const filterButton = screen.getByText("Filters");
    fireEvent.click(filterButton);

    await waitFor(() => {
      expect(screen.getByLabelText("Event Status")).toBeInTheDocument();
    });

    // Set state
    const stateSelect = screen.getByLabelText("Event Status");
    fireEvent.change(stateSelect, { target: { value: "upcoming" } });

    // Click clear
    const clearButton = screen.getByText("Clear");
    fireEvent.click(clearButton);

    expect(onSearch).toHaveBeenCalledWith({});

    // Inputs should be reset
    expect(searchInput).toHaveValue("");
    expect(stateSelect).toHaveValue("");
  });

  it("should initialize with provided initial filters", () => {
    const onSearch = vi.fn();
    const initialFilters: EventSearchFilters = {
      title: "Initial Search",
      state: "upcoming",
      role: "organizer",
    };

    render(<EventSearchFilter onSearch={onSearch} initialFilters={initialFilters} />);

    const searchInput = screen.getByPlaceholderText("Search events by title...");
    expect(searchInput).toHaveValue("Initial Search");
  });

  it("should not show clear button when no filters are active", () => {
    const onSearch = vi.fn();
    render(<EventSearchFilter onSearch={onSearch} />);

    expect(screen.queryByText("Clear")).not.toBeInTheDocument();
  });

  it("should toggle filter expansion", async () => {
    const onSearch = vi.fn();
    render(<EventSearchFilter onSearch={onSearch} />);

    const filterButton = screen.getByText("Filters");

    // Click to expand
    fireEvent.click(filterButton);
    await waitFor(() => {
      expect(screen.getByLabelText("Start Date")).toBeInTheDocument();
    });

    // Click to collapse
    fireEvent.click(filterButton);
    await waitFor(() => {
      expect(screen.queryByLabelText("Start Date")).not.toBeInTheDocument();
    });
  });
});
