import { useEffect, useState } from "react";
import {
  getWallPosts,
  createWallPost,
  deleteWallPost,
  isApiError,
  isAuthenticated,
  type WallPost,
} from "../services/api";

interface EventWallProps {
  eventId: string;
  currentUserId?: string;
}

/**
 * Format a relative timestamp (e.g., "2 hours ago")
 */
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) {
    return "just now";
  } else if (diffMins < 60) {
    return `${diffMins} minute${diffMins === 1 ? "" : "s"} ago`;
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  } else if (diffDays < 7) {
    return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
  } else {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
  }
}

/**
 * EventWall component - displays the event wall with posts
 */
export function EventWall({ eventId, currentUserId }: EventWallProps) {
  const [posts, setPosts] = useState<WallPost[]>([]);
  const [canAccess, setCanAccess] = useState<boolean | null>(null);
  const [accessMessage, setAccessMessage] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [newPostContent, setNewPostContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null);

  const loggedIn = isAuthenticated();

  useEffect(() => {
    const fetchWall = async () => {
      if (!loggedIn) {
        setCanAccess(false);
        setAccessMessage("Sign in and RSVP 'Yes' to access the event wall");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError("");

      try {
        const response = await getWallPosts(eventId);
        setCanAccess(response.canAccessWall);
        if (response.canAccessWall && response.posts) {
          setPosts(response.posts);
        } else {
          setAccessMessage(response.message || "RSVP 'Yes' to access the event wall");
        }
      } catch (err) {
        if (isApiError(err)) {
          setError(err.message);
        } else {
          setError("Failed to load event wall");
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchWall();
  }, [eventId, loggedIn]);

  const handleSubmitPost = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newPostContent.trim() || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError("");

    try {
      const response = await createWallPost(eventId, newPostContent);
      // Add new post to the top of the list
      setPosts((prev) => [response.post, ...prev]);
      setNewPostContent("");
    } catch (err) {
      if (isApiError(err)) {
        setSubmitError(err.message);
      } else {
        setSubmitError("Failed to post message");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (deletingPostId) return;

    setDeletingPostId(postId);

    try {
      await deleteWallPost(eventId, postId);
      setPosts((prev) => prev.filter((post) => post.id !== postId));
    } catch (err) {
      if (isApiError(err)) {
        alert(err.message);
      } else {
        alert("Failed to delete post");
      }
    } finally {
      setDeletingPostId(null);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Event Wall</h2>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Event Wall</h2>
        <div className="text-center py-4">
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  // No access state
  if (!canAccess) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Event Wall</h2>
        <div className="text-center py-8">
          <div className="mx-auto w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <svg
              className="h-6 w-6 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>
          <p className="text-gray-600">{accessMessage}</p>
        </div>
      </div>
    );
  }

  // Full wall view
  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Event Wall</h2>

      {/* New post form */}
      <form onSubmit={handleSubmitPost} className="mb-6">
        <div className="border border-gray-200 rounded-lg focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500">
          <textarea
            value={newPostContent}
            onChange={(e) => setNewPostContent(e.target.value)}
            placeholder="Share something with other attendees..."
            className="w-full px-4 py-3 text-gray-900 placeholder-gray-500 border-0 rounded-t-lg focus:ring-0 resize-none"
            rows={3}
            maxLength={2000}
          />
          <div className="flex items-center justify-between px-4 py-2 bg-gray-50 rounded-b-lg">
            <span className="text-sm text-gray-500">
              {newPostContent.length}/2000
            </span>
            <button
              type="submit"
              disabled={!newPostContent.trim() || isSubmitting}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:bg-blue-400 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "Posting..." : "Post"}
            </button>
          </div>
        </div>
        {submitError && (
          <p className="mt-2 text-sm text-red-600">{submitError}</p>
        )}
      </form>

      {/* Posts list */}
      {posts.length === 0 ? (
        <div className="text-center py-8">
          <div className="mx-auto w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <svg
              className="h-6 w-6 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
          </div>
          <p className="text-gray-600">No posts yet. Be the first to share something!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <div key={post.id} className="border border-gray-100 rounded-lg p-4">
              {/* Post header */}
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-3">
                  {post.author.photoUrl ? (
                    <img
                      src={post.author.photoUrl}
                      alt={post.author.displayName}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                      <span className="text-sm font-medium text-gray-600">
                        {post.author.displayName.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">
                        {post.author.displayName}
                      </span>
                      {post.author.isOrganizer && (
                        <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-medium rounded-full">
                          Organizer
                        </span>
                      )}
                    </div>
                    <span className="text-sm text-gray-500">
                      {formatRelativeTime(post.createdAt)}
                    </span>
                  </div>
                </div>

                {/* Delete button (only for author) */}
                {currentUserId === post.author.id && (
                  <button
                    onClick={() => handleDeletePost(post.id)}
                    disabled={deletingPostId === post.id}
                    className="text-gray-400 hover:text-red-500 transition-colors p-1"
                    title="Delete post"
                  >
                    {deletingPostId === post.id ? (
                      <svg
                        className="h-5 w-5 animate-spin"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                    ) : (
                      <svg
                        className="h-5 w-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    )}
                  </button>
                )}
              </div>

              {/* Post content */}
              <p className="text-gray-700 whitespace-pre-wrap">{post.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default EventWall;
