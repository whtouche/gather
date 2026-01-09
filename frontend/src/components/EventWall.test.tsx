import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { EventWall } from "./EventWall";
import * as api from "../services/api";

// Mock the API module
vi.mock("../services/api", () => ({
  getWallPosts: vi.fn(),
  createWallPost: vi.fn(),
  deleteWallPost: vi.fn(),
  isApiError: vi.fn((error): error is api.ApiError => {
    return (
      typeof error === "object" &&
      error !== null &&
      "message" in error &&
      "statusCode" in error
    );
  }),
  isAuthenticated: vi.fn(),
}));

describe("EventWall", () => {
  const mockPosts: api.WallPost[] = [
    {
      id: "post-1",
      content: "Hello everyone!",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      author: {
        id: "user-1",
        displayName: "John Doe",
        photoUrl: null,
        isOrganizer: true,
      },
    },
    {
      id: "post-2",
      content: "Looking forward to this event!",
      createdAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
      updatedAt: new Date(Date.now() - 3600000).toISOString(),
      author: {
        id: "user-2",
        displayName: "Jane Smith",
        photoUrl: "https://example.com/photo.jpg",
        isOrganizer: false,
      },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Not authenticated", () => {
    it("should show login prompt when not authenticated", async () => {
      vi.mocked(api.isAuthenticated).mockReturnValue(false);

      render(<EventWall eventId="event-1" />);

      await waitFor(() => {
        expect(screen.getByText(/Sign in and RSVP 'Yes'/)).toBeInTheDocument();
      });
    });

    it("should not call API when not authenticated", async () => {
      vi.mocked(api.isAuthenticated).mockReturnValue(false);

      render(<EventWall eventId="event-1" />);

      await waitFor(() => {
        expect(screen.getByText("Event Wall")).toBeInTheDocument();
      });
      expect(api.getWallPosts).not.toHaveBeenCalled();
    });
  });

  describe("Authenticated - No access", () => {
    it("should show RSVP prompt when user cannot access wall", async () => {
      vi.mocked(api.isAuthenticated).mockReturnValue(true);
      vi.mocked(api.getWallPosts).mockResolvedValue({
        canAccessWall: false,
        message: "RSVP 'Yes' to access the event wall",
        posts: null,
      });

      render(<EventWall eventId="event-1" />);

      await waitFor(() => {
        expect(screen.getByText(/RSVP 'Yes' to access the event wall/)).toBeInTheDocument();
      });
    });
  });

  describe("Authenticated - Has access", () => {
    beforeEach(() => {
      vi.mocked(api.isAuthenticated).mockReturnValue(true);
    });

    it("should show loading state initially", () => {
      vi.mocked(api.getWallPosts).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      render(<EventWall eventId="event-1" />);
      expect(screen.getByText("Event Wall")).toBeInTheDocument();
    });

    it("should display posts when loaded", async () => {
      vi.mocked(api.getWallPosts).mockResolvedValue({
        canAccessWall: true,
        posts: mockPosts,
      });

      render(<EventWall eventId="event-1" />);

      await waitFor(() => {
        expect(screen.getByText("Hello everyone!")).toBeInTheDocument();
      });
      expect(screen.getByText("Looking forward to this event!")).toBeInTheDocument();
      expect(screen.getByText("John Doe")).toBeInTheDocument();
      expect(screen.getByText("Jane Smith")).toBeInTheDocument();
    });

    it("should show organizer badge for organizers", async () => {
      vi.mocked(api.getWallPosts).mockResolvedValue({
        canAccessWall: true,
        posts: mockPosts,
      });

      render(<EventWall eventId="event-1" />);

      await waitFor(() => {
        expect(screen.getByText("Organizer")).toBeInTheDocument();
      });
    });

    it("should display author avatar with first letter when no photo", async () => {
      vi.mocked(api.getWallPosts).mockResolvedValue({
        canAccessWall: true,
        posts: mockPosts,
      });

      render(<EventWall eventId="event-1" />);

      await waitFor(() => {
        // John Doe has no photoUrl, should show 'J'
        expect(screen.getByText("J")).toBeInTheDocument();
      });
    });

    it("should show empty state when no posts", async () => {
      vi.mocked(api.getWallPosts).mockResolvedValue({
        canAccessWall: true,
        posts: [],
      });

      render(<EventWall eventId="event-1" />);

      await waitFor(() => {
        expect(screen.getByText(/No posts yet/)).toBeInTheDocument();
      });
    });

    it("should show error state on API failure", async () => {
      vi.mocked(api.getWallPosts).mockRejectedValue(new Error("Network error"));

      render(<EventWall eventId="event-1" />);

      await waitFor(() => {
        expect(screen.getByText("Failed to load event wall")).toBeInTheDocument();
      });
    });

    it("should show API error message when available", async () => {
      const apiError: api.ApiError = {
        message: "Custom error message",
        statusCode: 500,
      };
      vi.mocked(api.getWallPosts).mockRejectedValue(apiError);
      vi.mocked(api.isApiError).mockReturnValue(true);

      render(<EventWall eventId="event-1" />);

      await waitFor(() => {
        expect(screen.getByText("Custom error message")).toBeInTheDocument();
      });
    });
  });

  describe("Creating posts", () => {
    beforeEach(() => {
      vi.mocked(api.isAuthenticated).mockReturnValue(true);
      vi.mocked(api.getWallPosts).mockResolvedValue({
        canAccessWall: true,
        posts: [],
      });
    });

    it("should show character count", async () => {
      render(<EventWall eventId="event-1" />);

      await waitFor(() => {
        expect(screen.getByText("0/2000")).toBeInTheDocument();
      });
    });

    it("should update character count as user types", async () => {
      render(<EventWall eventId="event-1" />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Share something/)).toBeInTheDocument();
      });

      const textarea = screen.getByPlaceholderText(/Share something/);
      fireEvent.change(textarea, { target: { value: "Hello" } });

      expect(screen.getByText("5/2000")).toBeInTheDocument();
    });

    it("should disable post button when empty", async () => {
      render(<EventWall eventId="event-1" />);

      await waitFor(() => {
        const button = screen.getByRole("button", { name: /Post/i });
        expect(button).toBeDisabled();
      });
    });

    it("should enable post button when content is entered", async () => {
      render(<EventWall eventId="event-1" />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Share something/)).toBeInTheDocument();
      });

      const textarea = screen.getByPlaceholderText(/Share something/);
      fireEvent.change(textarea, { target: { value: "Hello world" } });

      const button = screen.getByRole("button", { name: /Post/i });
      expect(button).not.toBeDisabled();
    });

    it("should create a post and add it to the list", async () => {
      const newPost: api.WallPost = {
        id: "post-new",
        content: "New post content",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        author: {
          id: "user-1",
          displayName: "Test User",
          photoUrl: null,
          isOrganizer: false,
        },
      };

      vi.mocked(api.createWallPost).mockResolvedValue({ post: newPost });

      render(<EventWall eventId="event-1" />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Share something/)).toBeInTheDocument();
      });

      const textarea = screen.getByPlaceholderText(/Share something/);
      fireEvent.change(textarea, { target: { value: "New post content" } });

      const button = screen.getByRole("button", { name: /Post/i });
      fireEvent.click(button);

      await waitFor(() => {
        expect(api.createWallPost).toHaveBeenCalledWith("event-1", "New post content");
      });

      await waitFor(() => {
        expect(screen.getByText("New post content")).toBeInTheDocument();
      });
    });

    it("should clear textarea after successful post", async () => {
      const newPost: api.WallPost = {
        id: "post-new",
        content: "Test content",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        author: {
          id: "user-1",
          displayName: "Test User",
          photoUrl: null,
          isOrganizer: false,
        },
      };

      vi.mocked(api.createWallPost).mockResolvedValue({ post: newPost });

      render(<EventWall eventId="event-1" />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Share something/)).toBeInTheDocument();
      });

      const textarea = screen.getByPlaceholderText(/Share something/) as HTMLTextAreaElement;
      fireEvent.change(textarea, { target: { value: "Test content" } });

      const button = screen.getByRole("button", { name: /Post/i });
      fireEvent.click(button);

      await waitFor(() => {
        expect(textarea.value).toBe("");
      });
    });

    it("should show error message on post failure", async () => {
      const apiError: api.ApiError = {
        message: "Failed to create post",
        statusCode: 400,
      };
      vi.mocked(api.createWallPost).mockRejectedValue(apiError);
      vi.mocked(api.isApiError).mockReturnValue(true);

      render(<EventWall eventId="event-1" />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Share something/)).toBeInTheDocument();
      });

      const textarea = screen.getByPlaceholderText(/Share something/);
      fireEvent.change(textarea, { target: { value: "Test content" } });

      const button = screen.getByRole("button", { name: /Post/i });
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText("Failed to create post")).toBeInTheDocument();
      });
    });

    it("should show Posting... while submitting", async () => {
      vi.mocked(api.createWallPost).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      render(<EventWall eventId="event-1" />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Share something/)).toBeInTheDocument();
      });

      const textarea = screen.getByPlaceholderText(/Share something/);
      fireEvent.change(textarea, { target: { value: "Test content" } });

      const button = screen.getByRole("button", { name: /Post/i });
      fireEvent.click(button);

      expect(screen.getByText("Posting...")).toBeInTheDocument();
    });
  });

  describe("Deleting posts", () => {
    beforeEach(() => {
      vi.mocked(api.isAuthenticated).mockReturnValue(true);
    });

    it("should show delete button only for current user's posts", async () => {
      vi.mocked(api.getWallPosts).mockResolvedValue({
        canAccessWall: true,
        posts: mockPosts,
      });

      // User is user-1
      render(<EventWall eventId="event-1" currentUserId="user-1" />);

      await waitFor(() => {
        // Should only have 1 delete button (for user-1's post)
        const deleteButtons = screen.getAllByTitle("Delete post");
        expect(deleteButtons).toHaveLength(1);
      });
    });

    it("should not show delete buttons when currentUserId is not provided", async () => {
      vi.mocked(api.getWallPosts).mockResolvedValue({
        canAccessWall: true,
        posts: mockPosts,
      });

      render(<EventWall eventId="event-1" />);

      await waitFor(() => {
        expect(screen.getByText("Hello everyone!")).toBeInTheDocument();
      });

      expect(screen.queryAllByTitle("Delete post")).toHaveLength(0);
    });

    it("should delete post and remove from list", async () => {
      vi.mocked(api.getWallPosts).mockResolvedValue({
        canAccessWall: true,
        posts: mockPosts,
      });
      vi.mocked(api.deleteWallPost).mockResolvedValue({ message: "Post deleted" });

      render(<EventWall eventId="event-1" currentUserId="user-1" />);

      await waitFor(() => {
        expect(screen.getByText("Hello everyone!")).toBeInTheDocument();
      });

      const deleteButton = screen.getByTitle("Delete post");
      fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(api.deleteWallPost).toHaveBeenCalledWith("event-1", "post-1");
      });

      await waitFor(() => {
        expect(screen.queryByText("Hello everyone!")).not.toBeInTheDocument();
      });
    });
  });

  describe("Relative time formatting", () => {
    it("should show 'just now' for very recent posts", async () => {
      const recentPost: api.WallPost = {
        id: "post-1",
        content: "Recent post",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        author: {
          id: "user-1",
          displayName: "Test User",
          photoUrl: null,
          isOrganizer: false,
        },
      };

      vi.mocked(api.isAuthenticated).mockReturnValue(true);
      vi.mocked(api.getWallPosts).mockResolvedValue({
        canAccessWall: true,
        posts: [recentPost],
      });

      render(<EventWall eventId="event-1" />);

      await waitFor(() => {
        expect(screen.getByText("just now")).toBeInTheDocument();
      });
    });

    it("should show minutes ago for older posts", async () => {
      const olderPost: api.WallPost = {
        id: "post-1",
        content: "Older post",
        createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5 minutes ago
        updatedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
        author: {
          id: "user-1",
          displayName: "Test User",
          photoUrl: null,
          isOrganizer: false,
        },
      };

      vi.mocked(api.isAuthenticated).mockReturnValue(true);
      vi.mocked(api.getWallPosts).mockResolvedValue({
        canAccessWall: true,
        posts: [olderPost],
      });

      render(<EventWall eventId="event-1" />);

      await waitFor(() => {
        expect(screen.getByText("5 minutes ago")).toBeInTheDocument();
      });
    });
  });
});
