import { useState } from "react";
import type { PrivateNote } from "../services/api";

interface PrivateNoteCardProps {
  note: PrivateNote | null;
  targetUserId: string;
  targetUserDisplayName: string;
  onSave: (content: string, tags: string[]) => Promise<void>;
  onDelete?: () => Promise<void>;
}

/**
 * Private note card component
 * Displays and allows editing of a private note for a connection
 */
export function PrivateNoteCard({
  note,
  targetUserId,
  targetUserDisplayName,
  onSave,
  onDelete,
}: PrivateNoteCardProps) {
  const [isEditing, setIsEditing] = useState(!note);
  const [content, setContent] = useState(note?.content || "");
  const [tags, setTags] = useState<string[]>(note?.tags || []);
  const [tagInput, setTagInput] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    // Validate content
    if (!content.trim()) {
      setError("Note content cannot be empty");
      return;
    }

    if (content.length > 5000) {
      setError("Note content cannot exceed 5000 characters");
      return;
    }

    // Validate tags
    if (tags.length > 5) {
      setError("Maximum 5 tags allowed");
      return;
    }

    for (const tag of tags) {
      if (tag.length > 30) {
        setError("Each tag must not exceed 30 characters");
        return;
      }
    }

    setError(null);
    setIsSaving(true);

    try {
      await onSave(content.trim(), tags);
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save note");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (note) {
      // Restore original values
      setContent(note.content);
      setTags(note.tags);
      setIsEditing(false);
    } else {
      // Clear form for new note
      setContent("");
      setTags([]);
      setIsEditing(false);
    }
    setError(null);
  };

  const handleDelete = async () => {
    if (!onDelete) return;

    const confirmed = window.confirm(
      `Are you sure you want to delete your note about ${targetUserDisplayName}?`
    );

    if (!confirmed) return;

    setIsDeleting(true);
    setError(null);

    try {
      await onDelete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete note");
      setIsDeleting(false);
    }
  };

  const handleAddTag = () => {
    const trimmedTag = tagInput.trim();

    if (!trimmedTag) return;

    if (tags.length >= 5) {
      setError("Maximum 5 tags allowed");
      return;
    }

    if (trimmedTag.length > 30) {
      setError("Tag must not exceed 30 characters");
      return;
    }

    if (tags.includes(trimmedTag)) {
      setError("Tag already exists");
      return;
    }

    setTags([...tags, trimmedTag]);
    setTagInput("");
    setError(null);
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((tag) => tag !== tagToRemove));
  };

  const handleTagInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddTag();
    }
  };

  if (!isEditing && !note) {
    // Show "Add Note" button
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-gray-500">Private Note</h3>
        </div>
        <p className="text-sm text-gray-600 mb-4">
          Add a private note about {targetUserDisplayName}. Only you can see this note.
        </p>
        <button
          onClick={() => setIsEditing(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Note
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-gray-500">Private Note</h3>
        {note && !isEditing && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsEditing(true)}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              Edit
            </button>
            {onDelete && (
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="text-sm text-red-600 hover:text-red-700 disabled:opacity-50"
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </button>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {isEditing ? (
        <div className="space-y-4">
          {/* Content textarea */}
          <div>
            <label htmlFor="noteContent" className="block text-sm font-medium text-gray-700 mb-1">
              Note Content
            </label>
            <textarea
              id="noteContent"
              rows={6}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Add your private notes here..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              maxLength={5000}
            />
            <p className="mt-1 text-xs text-gray-500">
              {content.length} / 5000 characters
            </p>
          </div>

          {/* Tags input */}
          <div>
            <label htmlFor="tagInput" className="block text-sm font-medium text-gray-700 mb-1">
              Tags (optional, max 5)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                id="tagInput"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagInputKeyDown}
                placeholder="Add a tag..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                maxLength={30}
              />
              <button
                onClick={handleAddTag}
                disabled={!tagInput.trim() || tags.length >= 5}
                className="px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add
              </button>
            </div>
            {tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                  >
                    {tag}
                    <button
                      onClick={() => handleRemoveTag(tag)}
                      className="ml-1.5 inline-flex items-center"
                    >
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 pt-2">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? "Saving..." : "Save Note"}
            </button>
            <button
              onClick={handleCancel}
              disabled={isSaving}
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div>
          {/* Display note content */}
          <div className="mb-4">
            <p className="text-gray-700 whitespace-pre-wrap">{note?.content}</p>
          </div>

          {/* Display tags */}
          {note?.tags && note.tags.length > 0 && (
            <div className="mb-4">
              <div className="flex flex-wrap gap-2">
                {note.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Metadata */}
          {note && (
            <div className="text-xs text-gray-500">
              Last updated: {new Date(note.updatedAt).toLocaleDateString(undefined, {
                year: "numeric",
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default PrivateNoteCard;
