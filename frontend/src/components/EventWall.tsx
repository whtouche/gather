import { useEffect, useState } from "react";
import {
  getWallPosts,
  createWallPost,
  deleteWallPost,
  addReaction,
  removeReaction,
  pinWallPost,
  unpinWallPost,
  getModerationLog,
  isApiError,
  isAuthenticated,
  type WallPost,
  type WallReply,
  type ModerationLogEntry,
} from "../services/api";

interface EventWallProps {
  eventId: string;
  currentUserId?: string;
  isOrganizer?: boolean;
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

// Icons as components
function HeartIcon({ filled }: { filled: boolean }) {
  if (filled) {
    return (
      <svg className="h-5 w-5 text-red-500" fill="currentColor" viewBox="0 0 24 24">
        <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
      </svg>
    );
  }
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
      />
    </svg>
  );
}

function ReplyIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.586 1.641a4.483 4.483 0 01-.923 1.785A5.969 5.969 0 006 21c1.282 0 2.47-.402 3.445-1.087.81.22 1.668.337 2.555.337z"
      />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
      />
    </svg>
  );
}

function PinIcon({ filled }: { filled?: boolean }) {
  if (filled) {
    return (
      <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M16.5 3c-1.74 0-3.41.81-4.5 2.09C10.91 3.81 9.24 3 7.5 3 4.42 3 2 5.42 2 8.5c0 3.78 3.4 6.86 8.55 11.54L12 21.35l1.45-1.32C18.6 15.36 22 12.28 22 8.5 22 5.42 19.58 3 16.5 3z" />
      </svg>
    );
  }
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
      />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
      />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

interface ReplyFormProps {
  eventId: string;
  parentId: string;
  onReplyCreated: (reply: WallReply) => void;
  onCancel: () => void;
}

function ReplyForm({ eventId, parentId, onReplyCreated, onCancel }: ReplyFormProps) {
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setError("");

    try {
      const response = await createWallPost(eventId, content, parentId);
      onReplyCreated(response.post as unknown as WallReply);
      setContent("");
    } catch (err) {
      if (isApiError(err)) {
        setError(err.message);
      } else {
        setError("Failed to post reply");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-3 ml-13">
      <div className="border border-gray-200 rounded-lg focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Write a reply..."
          className="w-full px-3 py-2 text-sm text-gray-900 placeholder-gray-500 border-0 rounded-t-lg focus:ring-0 resize-none"
          rows={2}
          maxLength={1000}
          autoFocus
        />
        <div className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-b-lg">
          <span className="text-xs text-gray-500">{content.length}/1000</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!content.trim() || isSubmitting}
              className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:bg-blue-400 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "Replying..." : "Reply"}
            </button>
          </div>
        </div>
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </form>
  );
}

interface PostItemProps {
  post: WallPost | WallReply;
  eventId: string;
  currentUserId?: string;
  isOrganizer?: boolean;
  onDelete: (postId: string) => void;
  onReactionChange: (postId: string, reactionCount: number, userHasReacted: boolean) => void;
  onPinChange?: (postId: string, isPinned: boolean, pinnedAt: string | null) => void;
  onReplyCreated?: (parentId: string, reply: WallReply) => void;
  deletingPostId: string | null;
  pinningPostId: string | null;
  isReply?: boolean;
  depth?: number;
}

function PostItem({
  post,
  eventId,
  currentUserId,
  isOrganizer = false,
  onDelete,
  onReactionChange,
  onPinChange,
  onReplyCreated,
  deletingPostId,
  pinningPostId,
  isReply = false,
  depth = 0,
}: PostItemProps) {
  const [isReacting, setIsReacting] = useState(false);
  const [showReplyForm, setShowReplyForm] = useState(false);

  const isTopLevelPost = !isReply && depth === 0;
  const wallPost = isTopLevelPost ? (post as WallPost) : null;
  const isPinned = wallPost?.isPinned ?? false;
  const canPin = isOrganizer && isTopLevelPost && onPinChange;
  const canDelete = currentUserId === post.author.id || isOrganizer;

  const handleReactionClick = async () => {
    if (isReacting) return;

    setIsReacting(true);
    try {
      if (post.userHasReacted) {
        const response = await removeReaction(eventId, post.id);
        onReactionChange(post.id, response.reactionCount, response.userHasReacted);
      } else {
        const response = await addReaction(eventId, post.id);
        onReactionChange(post.id, response.reactionCount, response.userHasReacted);
      }
    } catch (err) {
      if (isApiError(err)) {
        alert(err.message);
      }
    } finally {
      setIsReacting(false);
    }
  };

  const handleReplyCreated = (reply: WallReply) => {
    setShowReplyForm(false);
    if (onReplyCreated) {
      onReplyCreated(post.id, reply);
    }
  };

  // Can reply if depth < 2
  const canReply = depth < 2 && onReplyCreated;

  const handlePinClick = async () => {
    if (!canPin || pinningPostId === post.id) return;

    try {
      if (isPinned) {
        const response = await unpinWallPost(eventId, post.id);
        onPinChange(post.id, response.isPinned, response.pinnedAt);
      } else {
        const response = await pinWallPost(eventId, post.id);
        onPinChange(post.id, response.isPinned, response.pinnedAt);
      }
    } catch (err) {
      if (isApiError(err)) {
        alert(err.message);
      }
    }
  };

  return (
    <div className={`${isReply ? "ml-10 mt-3" : ""}`}>
      <div className={`${isReply ? "border-l-2 border-gray-100 pl-4" : isPinned ? "border-2 border-yellow-300 bg-yellow-50 rounded-lg p-4" : "border border-gray-100 rounded-lg p-4"}`}>
        {/* Pinned indicator */}
        {isPinned && !isReply && (
          <div className="flex items-center gap-1.5 text-yellow-700 text-xs font-medium mb-2">
            <PinIcon filled />
            <span>Pinned</span>
          </div>
        )}
        {/* Post header */}
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-3">
            {post.author.photoUrl ? (
              <img
                src={post.author.photoUrl}
                alt={post.author.displayName}
                className={`${isReply ? "w-8 h-8" : "w-10 h-10"} rounded-full object-cover`}
              />
            ) : (
              <div
                className={`${isReply ? "w-8 h-8" : "w-10 h-10"} bg-gray-200 rounded-full flex items-center justify-center`}
              >
                <span className={`${isReply ? "text-xs" : "text-sm"} font-medium text-gray-600`}>
                  {post.author.displayName.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <span className={`font-medium text-gray-900 ${isReply ? "text-sm" : ""}`}>
                  {post.author.displayName}
                </span>
                {post.author.isOrganizer && (
                  <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-medium rounded-full">
                    Organizer
                  </span>
                )}
              </div>
              <span className={`${isReply ? "text-xs" : "text-sm"} text-gray-500`}>
                {formatRelativeTime(post.createdAt)}
              </span>
            </div>
          </div>

          {/* Moderation buttons */}
          <div className="flex items-center gap-1">
            {/* Pin/Unpin button (organizers only, top-level posts only) */}
            {canPin && (
              <button
                onClick={handlePinClick}
                disabled={pinningPostId === post.id}
                className={`p-1 transition-colors ${
                  isPinned
                    ? "text-yellow-500 hover:text-yellow-600"
                    : "text-gray-400 hover:text-yellow-500"
                }`}
                title={isPinned ? "Unpin" : "Pin to top"}
              >
                {pinningPostId === post.id ? <SpinnerIcon /> : <PinIcon filled={isPinned} />}
              </button>
            )}
            {/* Delete button (author or organizer) */}
            {canDelete && (
              <button
                onClick={() => onDelete(post.id)}
                disabled={deletingPostId === post.id}
                className="text-gray-400 hover:text-red-500 transition-colors p-1"
                title={isOrganizer && currentUserId !== post.author.id ? "Delete (moderator)" : "Delete"}
              >
                {deletingPostId === post.id ? <SpinnerIcon /> : <TrashIcon />}
              </button>
            )}
          </div>
        </div>

        {/* Post content */}
        <p className={`text-gray-700 whitespace-pre-wrap ${isReply ? "text-sm" : ""}`}>{post.content}</p>

        {/* Image attachment (top-level posts only) */}
        {isTopLevelPost && wallPost?.imageUrl && (
          <div className="mt-3">
            <img
              src={wallPost.imageUrl}
              alt="Post attachment"
              className="max-w-full max-h-96 rounded-lg object-contain"
              style={{
                width: wallPost.imageWidth ? `${wallPost.imageWidth}px` : 'auto',
                height: wallPost.imageHeight ? `${wallPost.imageHeight}px` : 'auto',
                maxWidth: '100%',
                maxHeight: '24rem',
              }}
            />
          </div>
        )}

        {/* Link preview (top-level posts only) */}
        {isTopLevelPost && wallPost?.linkUrl && !wallPost?.imageUrl && (
          <a
            href={wallPost.linkUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 block border border-gray-200 rounded-lg overflow-hidden hover:border-gray-300 transition-colors"
          >
            {wallPost.linkImageUrl && (
              <img
                src={wallPost.linkImageUrl}
                alt={wallPost.linkTitle || 'Link preview'}
                className="w-full h-48 object-cover"
              />
            )}
            <div className="p-3 bg-gray-50">
              {wallPost.linkTitle && (
                <p className="font-medium text-gray-900 text-sm line-clamp-1">{wallPost.linkTitle}</p>
              )}
              {wallPost.linkDescription && (
                <p className="text-xs text-gray-600 mt-1 line-clamp-2">{wallPost.linkDescription}</p>
              )}
              <p className="text-xs text-gray-400 mt-1 truncate">{wallPost.linkUrl}</p>
            </div>
          </a>
        )}

        {/* Actions bar */}
        <div className="flex items-center gap-4 mt-3">
          {/* Reaction button */}
          <button
            onClick={handleReactionClick}
            disabled={isReacting}
            className={`flex items-center gap-1.5 text-sm transition-colors ${
              post.userHasReacted
                ? "text-red-500"
                : "text-gray-500 hover:text-red-500"
            } disabled:opacity-50`}
          >
            <HeartIcon filled={post.userHasReacted} />
            <span>{post.reactionCount > 0 ? post.reactionCount : ""}</span>
          </button>

          {/* Reply button */}
          {canReply && (
            <button
              onClick={() => setShowReplyForm(!showReplyForm)}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-blue-500 transition-colors"
            >
              <ReplyIcon />
              <span>
                {!isReply && (post as WallPost).replyCount > 0
                  ? `${(post as WallPost).replyCount} ${(post as WallPost).replyCount === 1 ? "reply" : "replies"}`
                  : "Reply"}
              </span>
            </button>
          )}
        </div>

        {/* Reply form */}
        {showReplyForm && (
          <ReplyForm
            eventId={eventId}
            parentId={post.id}
            onReplyCreated={handleReplyCreated}
            onCancel={() => setShowReplyForm(false)}
          />
        )}
      </div>

      {/* Nested replies */}
      {post.replies && post.replies.length > 0 && (
        <div className="space-y-0">
          {post.replies.map((reply) => (
            <PostItem
              key={reply.id}
              post={reply}
              eventId={eventId}
              currentUserId={currentUserId}
              isOrganizer={isOrganizer}
              onDelete={onDelete}
              onReactionChange={onReactionChange}
              onReplyCreated={onReplyCreated}
              deletingPostId={deletingPostId}
              pinningPostId={pinningPostId}
              isReply={true}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * EventWall component - displays the event wall with posts, reactions, and replies
 */
export function EventWall({ eventId, currentUserId, isOrganizer = false }: EventWallProps) {
  const [posts, setPosts] = useState<WallPost[]>([]);
  const [canAccess, setCanAccess] = useState<boolean | null>(null);
  const [accessMessage, setAccessMessage] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [newPostContent, setNewPostContent] = useState("");
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null);
  const [pinningPostId, setPinningPostId] = useState<string | null>(null);
  const [showModerationLog, setShowModerationLog] = useState(false);
  const [moderationLogs, setModerationLogs] = useState<ModerationLogEntry[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

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

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.match(/^image\/(jpeg|png)$/)) {
      setSubmitError("Only JPEG and PNG images are allowed");
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setSubmitError("Image must be 5MB or less");
      return;
    }

    setSelectedImage(file);
    setSubmitError("");

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
  };

  const handleSubmitPost = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newPostContent.trim() || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError("");

    try {
      const response = await createWallPost(eventId, newPostContent, undefined, selectedImage || undefined);
      // Add new post after pinned posts (which are at the top)
      setPosts((prev) => {
        const pinnedPosts = prev.filter((p) => p.isPinned);
        const unpinnedPosts = prev.filter((p) => !p.isPinned);
        return [...pinnedPosts, response.post, ...unpinnedPosts];
      });
      setNewPostContent("");
      setSelectedImage(null);
      setImagePreview(null);
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
      // Remove post or reply from state
      setPosts((prev) => removePostOrReply(prev, postId));
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

  // Helper to recursively remove a post or reply from the state
  const removePostOrReply = (posts: WallPost[], postId: string): WallPost[] => {
    return posts
      .filter((post) => post.id !== postId)
      .map((post) => ({
        ...post,
        replies: removeReplyFromReplies(post.replies, postId),
        replyCount: countReplies(removeReplyFromReplies(post.replies, postId)),
      }));
  };

  const removeReplyFromReplies = (replies: WallReply[], postId: string): WallReply[] => {
    return replies
      .filter((reply) => reply.id !== postId)
      .map((reply) => ({
        ...reply,
        replies: reply.replies ? removeReplyFromReplies(reply.replies, postId) : undefined,
      }));
  };

  const countReplies = (replies: WallReply[]): number => {
    return replies.reduce((count, reply) => {
      return count + 1 + (reply.replies ? countReplies(reply.replies) : 0);
    }, 0);
  };

  const handleReactionChange = (postId: string, reactionCount: number, userHasReacted: boolean) => {
    setPosts((prev) => updateReactionInPosts(prev, postId, reactionCount, userHasReacted));
  };

  // Helper to recursively update reaction in posts/replies
  const updateReactionInPosts = (
    posts: WallPost[],
    postId: string,
    reactionCount: number,
    userHasReacted: boolean
  ): WallPost[] => {
    return posts.map((post) => {
      if (post.id === postId) {
        return { ...post, reactionCount, userHasReacted };
      }
      return {
        ...post,
        replies: updateReactionInReplies(post.replies, postId, reactionCount, userHasReacted),
      };
    });
  };

  const updateReactionInReplies = (
    replies: WallReply[],
    postId: string,
    reactionCount: number,
    userHasReacted: boolean
  ): WallReply[] => {
    return replies.map((reply) => {
      if (reply.id === postId) {
        return { ...reply, reactionCount, userHasReacted };
      }
      return {
        ...reply,
        replies: reply.replies
          ? updateReactionInReplies(reply.replies, postId, reactionCount, userHasReacted)
          : undefined,
      };
    });
  };

  const handleReplyCreated = (parentId: string, reply: WallReply) => {
    setPosts((prev) => addReplyToPosts(prev, parentId, reply));
  };

  const handlePinChange = (postId: string, isPinned: boolean, pinnedAt: string | null) => {
    setPinningPostId(postId);
    setPosts((prev) => {
      const updatedPosts = prev.map((post) =>
        post.id === postId ? { ...post, isPinned, pinnedAt } : post
      );
      // Re-sort: pinned posts first (by pinnedAt desc), then by createdAt desc
      return updatedPosts.sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        if (a.isPinned && b.isPinned) {
          return new Date(b.pinnedAt || 0).getTime() - new Date(a.pinnedAt || 0).getTime();
        }
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
    });
    setPinningPostId(null);
  };

  const handleOpenModerationLog = async () => {
    setShowModerationLog(true);
    setLoadingLogs(true);
    try {
      const response = await getModerationLog(eventId);
      setModerationLogs(response.logs);
    } catch (err) {
      if (isApiError(err)) {
        alert(err.message);
      }
    } finally {
      setLoadingLogs(false);
    }
  };

  // Helper to add reply to the correct parent
  const addReplyToPosts = (posts: WallPost[], parentId: string, reply: WallReply): WallPost[] => {
    return posts.map((post) => {
      if (post.id === parentId) {
        return {
          ...post,
          replies: [...post.replies, reply],
          replyCount: post.replyCount + 1,
        };
      }
      return {
        ...post,
        replies: addReplyToReplies(post.replies, parentId, reply),
        replyCount: post.replyCount + (hasParentInReplies(post.replies, parentId) ? 1 : 0),
      };
    });
  };

  const addReplyToReplies = (replies: WallReply[], parentId: string, newReply: WallReply): WallReply[] => {
    return replies.map((reply) => {
      if (reply.id === parentId) {
        return {
          ...reply,
          replies: [...(reply.replies || []), newReply],
          replyCount: (reply.replyCount || 0) + 1,
        };
      }
      return {
        ...reply,
        replies: reply.replies ? addReplyToReplies(reply.replies, parentId, newReply) : undefined,
      };
    });
  };

  const hasParentInReplies = (replies: WallReply[], parentId: string): boolean => {
    for (const reply of replies) {
      if (reply.id === parentId) return true;
      if (reply.replies && hasParentInReplies(reply.replies, parentId)) return true;
    }
    return false;
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
      {/* Header with moderation log button */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Event Wall</h2>
        {isOrganizer && (
          <button
            onClick={handleOpenModerationLog}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
            title="View moderation log"
          >
            <ShieldIcon />
            <span>Moderation Log</span>
          </button>
        )}
      </div>

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
          {imagePreview && (
            <div className="px-4 py-2 relative">
              <img src={imagePreview} alt="Preview" className="max-w-xs max-h-64 rounded-lg object-cover" />
              <button
                type="button"
                onClick={handleRemoveImage}
                className="absolute top-4 left-6 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}
          <div className="flex items-center justify-between px-4 py-2 bg-gray-50 rounded-b-lg">
            <div className="flex items-center gap-2">
              <label className="cursor-pointer text-gray-500 hover:text-gray-700 transition-colors">
                <input
                  type="file"
                  accept="image/jpeg,image/png"
                  onChange={handleImageSelect}
                  className="hidden"
                  disabled={isSubmitting}
                />
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </label>
              <span className="text-sm text-gray-500">{newPostContent.length}/2000</span>
            </div>
            <button
              type="submit"
              disabled={!newPostContent.trim() || isSubmitting}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:bg-blue-400 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "Posting..." : "Post"}
            </button>
          </div>
        </div>
        {submitError && <p className="mt-2 text-sm text-red-600">{submitError}</p>}
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
            <PostItem
              key={post.id}
              post={post}
              eventId={eventId}
              currentUserId={currentUserId}
              isOrganizer={isOrganizer}
              onDelete={handleDeletePost}
              onReactionChange={handleReactionChange}
              onPinChange={handlePinChange}
              onReplyCreated={handleReplyCreated}
              deletingPostId={deletingPostId}
              pinningPostId={pinningPostId}
            />
          ))}
        </div>
      )}

      {/* Moderation Log Modal */}
      {showModerationLog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">Moderation Log</h3>
              <button
                onClick={() => setShowModerationLog(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[60vh]">
              {loadingLogs ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : moderationLogs.length === 0 ? (
                <p className="text-center text-gray-500 py-8">No moderation actions yet</p>
              ) : (
                <div className="space-y-3">
                  {moderationLogs.map((log) => (
                    <div key={log.id} className="border border-gray-100 rounded-lg p-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="font-medium text-gray-900">{log.moderator.displayName}</span>
                          <span className="text-gray-500 mx-1">
                            {log.action === "DELETE" && "deleted a post"}
                            {log.action === "PIN" && "pinned a post"}
                            {log.action === "UNPIN" && "unpinned a post"}
                          </span>
                          {log.postAuthor && (
                            <span className="text-gray-500">
                              by <span className="font-medium text-gray-700">{log.postAuthor.displayName}</span>
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-gray-400">
                          {formatRelativeTime(log.createdAt)}
                        </span>
                      </div>
                      {log.postContent && (
                        <div className="mt-2 p-2 bg-gray-50 rounded text-sm text-gray-600 truncate">
                          {log.postContent.length > 100 ? `${log.postContent.slice(0, 100)}...` : log.postContent}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default EventWall;
