import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { EventWall } from "./EventWall";
import * as api from "../services/api";

// Mock the API module
vi.mock("../services/api", () => ({
  getWallPosts: vi.fn(),
  createWallPost: vi.fn(),
  deleteWallPost: vi.fn(),
  addReaction: vi.fn(),
  removeReaction: vi.fn(),
  pinWallPost: vi.fn(),
  unpinWallPost: vi.fn(),
  getModerationLog: vi.fn(),
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
      isPinned: false,
      pinnedAt: null,
      author: {
        id: "user-1",
        displayName: "John Doe",
        photoUrl: null,
        isOrganizer: true,
      },
      reactionCount: 2,
      userHasReacted: false,
      replyCount: 1,
      replies: [
        {
          id: "reply-1",
          content: "Welcome!",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          author: {
            id: "user-2",
            displayName: "Jane Smith",
            photoUrl: null,
            isOrganizer: false,
          },
          reactionCount: 0,
          userHasReacted: false,
        },
      ],
    },
    {
      id: "post-2",
      content: "Looking forward to this event!",
      createdAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
      updatedAt: new Date(Date.now() - 3600000).toISOString(),
      isPinned: false,
      pinnedAt: null,
      author: {
        id: "user-2",
        displayName: "Jane Smith",
        photoUrl: "https://example.com/photo.jpg",
        isOrganizer: false,
      },
      reactionCount: 0,
      userHasReacted: false,
      replyCount: 0,
      replies: [],
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
      // Jane Smith appears in multiple places (as reply author and post author)
      expect(screen.getAllByText("Jane Smith").length).toBeGreaterThanOrEqual(1);
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
        // John Doe has no photoUrl, should show 'J'. Jane Smith also has no photo in replies, so multiple 'J's.
        expect(screen.getAllByText("J").length).toBeGreaterThanOrEqual(1);
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
        isPinned: false,
        pinnedAt: null,
        author: {
          id: "user-1",
          displayName: "Test User",
          photoUrl: null,
          isOrganizer: false,
        },
        reactionCount: 0,
        userHasReacted: false,
        replyCount: 0,
        replies: [],
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
        isPinned: false,
        pinnedAt: null,
        author: {
          id: "user-1",
          displayName: "Test User",
          photoUrl: null,
          isOrganizer: false,
        },
        reactionCount: 0,
        userHasReacted: false,
        replyCount: 0,
        replies: [],
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
        // Should only have 1 delete button (for user-1's post, not for replies by other users)
        const deleteButtons = screen.getAllByTitle("Delete");
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

      expect(screen.queryAllByTitle("Delete")).toHaveLength(0);
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

      const deleteButton = screen.getByTitle("Delete");
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
        isPinned: false,
        pinnedAt: null,
        author: {
          id: "user-1",
          displayName: "Test User",
          photoUrl: null,
          isOrganizer: false,
        },
        reactionCount: 0,
        userHasReacted: false,
        replyCount: 0,
        replies: [],
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
        isPinned: false,
        pinnedAt: null,
        author: {
          id: "user-1",
          displayName: "Test User",
          photoUrl: null,
          isOrganizer: false,
        },
        reactionCount: 0,
        userHasReacted: false,
        replyCount: 0,
        replies: [],
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

  describe("Reactions", () => {
    beforeEach(() => {
      vi.mocked(api.isAuthenticated).mockReturnValue(true);
    });

    it("should display reaction count", async () => {
      vi.mocked(api.getWallPosts).mockResolvedValue({
        canAccessWall: true,
        posts: mockPosts,
      });

      render(<EventWall eventId="event-1" />);

      await waitFor(() => {
        // Post-1 has 2 reactions
        expect(screen.getByText("2")).toBeInTheDocument();
      });
    });

    it("should add reaction when heart button is clicked", async () => {
      const postsWithNoReaction: api.WallPost[] = [
        {
          ...mockPosts[0],
          reactionCount: 0,
          userHasReacted: false,
        },
      ];

      vi.mocked(api.getWallPosts).mockResolvedValue({
        canAccessWall: true,
        posts: postsWithNoReaction,
      });

      vi.mocked(api.addReaction).mockResolvedValue({
        reaction: { id: "reaction-1", type: "HEART", createdAt: new Date().toISOString() },
        reactionCount: 1,
        userHasReacted: true,
      });

      render(<EventWall eventId="event-1" />);

      await waitFor(() => {
        expect(screen.getByText("Hello everyone!")).toBeInTheDocument();
      });

      // Find and click the heart button (first one for the post)
      const heartButtons = screen.getAllByRole("button").filter(
        (btn) => btn.querySelector("svg")
      );
      fireEvent.click(heartButtons[0]);

      await waitFor(() => {
        expect(api.addReaction).toHaveBeenCalledWith("event-1", "post-1");
      });
    });

    it("should remove reaction when heart button is clicked on already-reacted post", async () => {
      const postsWithReaction: api.WallPost[] = [
        {
          ...mockPosts[0],
          reactionCount: 1,
          userHasReacted: true,
          replies: [],
        },
      ];

      vi.mocked(api.getWallPosts).mockResolvedValue({
        canAccessWall: true,
        posts: postsWithReaction,
      });

      vi.mocked(api.removeReaction).mockResolvedValue({
        message: "Reaction removed",
        reactionCount: 0,
        userHasReacted: false,
      });

      render(<EventWall eventId="event-1" />);

      await waitFor(() => {
        expect(screen.getByText("Hello everyone!")).toBeInTheDocument();
      });

      // Find and click the heart button
      const heartButtons = screen.getAllByRole("button").filter(
        (btn) => btn.querySelector("svg")
      );
      fireEvent.click(heartButtons[0]);

      await waitFor(() => {
        expect(api.removeReaction).toHaveBeenCalledWith("event-1", "post-1");
      });
    });
  });

  describe("Replies", () => {
    beforeEach(() => {
      vi.mocked(api.isAuthenticated).mockReturnValue(true);
    });

    it("should display replies under posts", async () => {
      vi.mocked(api.getWallPosts).mockResolvedValue({
        canAccessWall: true,
        posts: mockPosts,
      });

      render(<EventWall eventId="event-1" />);

      await waitFor(() => {
        // Reply to first post
        expect(screen.getByText("Welcome!")).toBeInTheDocument();
      });
    });

    it("should display reply count on posts", async () => {
      vi.mocked(api.getWallPosts).mockResolvedValue({
        canAccessWall: true,
        posts: mockPosts,
      });

      render(<EventWall eventId="event-1" />);

      await waitFor(() => {
        expect(screen.getByText("1 reply")).toBeInTheDocument();
      });
    });

    it("should show reply form when Reply button is clicked", async () => {
      const postsWithoutReplies: api.WallPost[] = [
        {
          ...mockPosts[0],
          replies: [],
          replyCount: 0,
        },
      ];

      vi.mocked(api.getWallPosts).mockResolvedValue({
        canAccessWall: true,
        posts: postsWithoutReplies,
      });

      render(<EventWall eventId="event-1" />);

      await waitFor(() => {
        expect(screen.getByText("Hello everyone!")).toBeInTheDocument();
      });

      // Click Reply button
      const replyButton = screen.getByText("Reply");
      fireEvent.click(replyButton);

      await waitFor(() => {
        expect(screen.getByPlaceholderText("Write a reply...")).toBeInTheDocument();
      });
    });
  });

  describe("Moderation features", () => {
    beforeEach(() => {
      vi.mocked(api.isAuthenticated).mockReturnValue(true);
    });

    it("should show pinned posts with pinned indicator", async () => {
      const pinnedPost: api.WallPost = {
        ...mockPosts[0],
        isPinned: true,
        pinnedAt: new Date().toISOString(),
      };

      vi.mocked(api.getWallPosts).mockResolvedValue({
        canAccessWall: true,
        posts: [pinnedPost],
      });

      render(<EventWall eventId="event-1" />);

      await waitFor(() => {
        expect(screen.getByText("Pinned")).toBeInTheDocument();
      });
    });

    it("should show pin button for organizers", async () => {
      vi.mocked(api.getWallPosts).mockResolvedValue({
        canAccessWall: true,
        posts: mockPosts,
      });

      render(<EventWall eventId="event-1" currentUserId="user-1" isOrganizer={true} />);

      await waitFor(() => {
        // Should have pin buttons (one for each post)
        const pinButtons = screen.getAllByTitle("Pin to top");
        expect(pinButtons.length).toBeGreaterThan(0);
      });
    });

    it("should not show pin button for non-organizers", async () => {
      vi.mocked(api.getWallPosts).mockResolvedValue({
        canAccessWall: true,
        posts: mockPosts,
      });

      render(<EventWall eventId="event-1" currentUserId="user-1" isOrganizer={false} />);

      await waitFor(() => {
        expect(screen.getByText("Hello everyone!")).toBeInTheDocument();
      });

      expect(screen.queryByTitle("Pin to top")).not.toBeInTheDocument();
    });

    it("should show moderation log button for organizers", async () => {
      vi.mocked(api.getWallPosts).mockResolvedValue({
        canAccessWall: true,
        posts: [],
      });

      render(<EventWall eventId="event-1" currentUserId="user-1" isOrganizer={true} />);

      await waitFor(() => {
        expect(screen.getByText("Moderation Log")).toBeInTheDocument();
      });
    });

    it("should not show moderation log button for non-organizers", async () => {
      vi.mocked(api.getWallPosts).mockResolvedValue({
        canAccessWall: true,
        posts: [],
      });

      render(<EventWall eventId="event-1" currentUserId="user-1" isOrganizer={false} />);

      await waitFor(() => {
        expect(screen.getByText("Event Wall")).toBeInTheDocument();
      });

      expect(screen.queryByText("Moderation Log")).not.toBeInTheDocument();
    });

    it("should allow organizer to delete another user's post", async () => {
      vi.mocked(api.getWallPosts).mockResolvedValue({
        canAccessWall: true,
        posts: [mockPosts[1]], // Jane's post (user-2)
      });
      vi.mocked(api.deleteWallPost).mockResolvedValue({
        message: "Post deleted",
        moderatorDeleted: true,
      });

      // User-1 is organizer, viewing user-2's post
      render(<EventWall eventId="event-1" currentUserId="user-1" isOrganizer={true} />);

      await waitFor(() => {
        expect(screen.getByText("Looking forward to this event!")).toBeInTheDocument();
      });

      // Organizer should see delete button for another user's post
      const deleteButton = screen.getByTitle("Delete (moderator)");
      fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(api.deleteWallPost).toHaveBeenCalledWith("event-1", "post-2");
      });
    });

    it("should pin a post when pin button is clicked", async () => {
      vi.mocked(api.getWallPosts).mockResolvedValue({
        canAccessWall: true,
        posts: mockPosts,
      });
      vi.mocked(api.pinWallPost).mockResolvedValue({
        message: "Post pinned successfully",
        isPinned: true,
        pinnedAt: new Date().toISOString(),
      });

      render(<EventWall eventId="event-1" currentUserId="user-1" isOrganizer={true} />);

      await waitFor(() => {
        expect(screen.getByText("Hello everyone!")).toBeInTheDocument();
      });

      const pinButtons = screen.getAllByTitle("Pin to top");
      fireEvent.click(pinButtons[0]);

      await waitFor(() => {
        expect(api.pinWallPost).toHaveBeenCalledWith("event-1", "post-1");
      });
    });

    it("should unpin a post when unpin button is clicked", async () => {
      const pinnedPosts: api.WallPost[] = [
        {
          ...mockPosts[0],
          isPinned: true,
          pinnedAt: new Date().toISOString(),
        },
      ];

      vi.mocked(api.getWallPosts).mockResolvedValue({
        canAccessWall: true,
        posts: pinnedPosts,
      });
      vi.mocked(api.unpinWallPost).mockResolvedValue({
        message: "Post unpinned successfully",
        isPinned: false,
        pinnedAt: null,
      });

      render(<EventWall eventId="event-1" currentUserId="user-1" isOrganizer={true} />);

      await waitFor(() => {
        expect(screen.getByText("Pinned")).toBeInTheDocument();
      });

      const unpinButton = screen.getByTitle("Unpin");
      fireEvent.click(unpinButton);

      await waitFor(() => {
        expect(api.unpinWallPost).toHaveBeenCalledWith("event-1", "post-1");
      });
    });

    it("should open moderation log modal when button is clicked", async () => {
      vi.mocked(api.getWallPosts).mockResolvedValue({
        canAccessWall: true,
        posts: [],
      });
      vi.mocked(api.getModerationLog).mockResolvedValue({
        logs: [
          {
            id: "log-1",
            action: "DELETE" as const,
            moderator: { id: "user-1", displayName: "John Doe" },
            targetPostId: "post-1",
            postContent: "Deleted content",
            postAuthor: { id: "user-2", displayName: "Jane Smith" },
            createdAt: new Date().toISOString(),
          },
        ],
      });

      render(<EventWall eventId="event-1" currentUserId="user-1" isOrganizer={true} />);

      await waitFor(() => {
        expect(screen.getByText("Moderation Log")).toBeInTheDocument();
      });

      const modLogButton = screen.getByText("Moderation Log");
      fireEvent.click(modLogButton);

      await waitFor(() => {
        expect(api.getModerationLog).toHaveBeenCalledWith("event-1");
      });

      await waitFor(() => {
        expect(screen.getByText("deleted a post")).toBeInTheDocument();
      });
    });
  });
});
