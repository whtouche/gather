import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { PrivateNoteCard } from "../PrivateNoteCard";

describe("PrivateNoteCard", () => {
  const mockOnSave = vi.fn();
  const mockOnDelete = vi.fn();

  const mockNote = {
    id: "note-1",
    targetUserId: "user-2",
    targetUserDisplayName: "John Doe",
    targetUserPhotoUrl: null,
    content: "Great person to work with!",
    tags: ["colleague", "reliable"],
    createdAt: "2024-01-10T00:00:00Z",
    updatedAt: "2024-01-10T00:00:00Z",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnSave.mockResolvedValue(undefined);
    mockOnDelete.mockResolvedValue(undefined);
  });

  describe("Display mode (no note exists)", () => {
    it("should show Add Note button when no note exists", () => {
      render(
        <PrivateNoteCard
          note={null}
          targetUserId="user-2"
          targetUserDisplayName="John Doe"
          onSave={mockOnSave}
        />
      );

      expect(screen.getByText(/Add Note/i)).toBeInTheDocument();
      expect(screen.getByText(/private note about John Doe/i)).toBeInTheDocument();
    });

    it("should enter edit mode when Add Note is clicked", () => {
      render(
        <PrivateNoteCard
          note={null}
          targetUserId="user-2"
          targetUserDisplayName="John Doe"
          onSave={mockOnSave}
        />
      );

      const addButton = screen.getByText(/Add Note/i);
      fireEvent.click(addButton);

      expect(screen.getByPlaceholderText(/Add your private notes here/i)).toBeInTheDocument();
      expect(screen.getByText(/Save Note/i)).toBeInTheDocument();
    });
  });

  describe("Display mode (note exists)", () => {
    it("should display note content", () => {
      render(
        <PrivateNoteCard
          note={mockNote}
          targetUserId="user-2"
          targetUserDisplayName="John Doe"
          onSave={mockOnSave}
          onDelete={mockOnDelete}
        />
      );

      expect(screen.getByText("Great person to work with!")).toBeInTheDocument();
    });

    it("should display tags", () => {
      render(
        <PrivateNoteCard
          note={mockNote}
          targetUserId="user-2"
          targetUserDisplayName="John Doe"
          onSave={mockOnSave}
          onDelete={mockOnDelete}
        />
      );

      expect(screen.getByText("colleague")).toBeInTheDocument();
      expect(screen.getByText("reliable")).toBeInTheDocument();
    });

    it("should show Edit and Delete buttons", () => {
      render(
        <PrivateNoteCard
          note={mockNote}
          targetUserId="user-2"
          targetUserDisplayName="John Doe"
          onSave={mockOnSave}
          onDelete={mockOnDelete}
        />
      );

      expect(screen.getByText("Edit")).toBeInTheDocument();
      expect(screen.getByText("Delete")).toBeInTheDocument();
    });

    it("should display last updated timestamp", () => {
      render(
        <PrivateNoteCard
          note={mockNote}
          targetUserId="user-2"
          targetUserDisplayName="John Doe"
          onSave={mockOnSave}
          onDelete={mockOnDelete}
        />
      );

      expect(screen.getByText(/Last updated:/i)).toBeInTheDocument();
    });
  });

  describe("Edit mode", () => {
    it("should enter edit mode when Edit button is clicked", () => {
      render(
        <PrivateNoteCard
          note={mockNote}
          targetUserId="user-2"
          targetUserDisplayName="John Doe"
          onSave={mockOnSave}
          onDelete={mockOnDelete}
        />
      );

      const editButton = screen.getByText("Edit");
      fireEvent.click(editButton);

      expect(screen.getByDisplayValue("Great person to work with!")).toBeInTheDocument();
      expect(screen.getByText(/Save Note/i)).toBeInTheDocument();
    });

    it("should allow editing content", () => {
      render(
        <PrivateNoteCard
          note={mockNote}
          targetUserId="user-2"
          targetUserDisplayName="John Doe"
          onSave={mockOnSave}
          onDelete={mockOnDelete}
        />
      );

      const editButton = screen.getByText("Edit");
      fireEvent.click(editButton);

      const textarea = screen.getByDisplayValue("Great person to work with!");
      fireEvent.change(textarea, { target: { value: "Updated content" } });

      expect(screen.getByDisplayValue("Updated content")).toBeInTheDocument();
    });

    it("should show character count", () => {
      render(
        <PrivateNoteCard
          note={null}
          targetUserId="user-2"
          targetUserDisplayName="John Doe"
          onSave={mockOnSave}
        />
      );

      const addButton = screen.getByText(/Add Note/i);
      fireEvent.click(addButton);

      expect(screen.getByText(/0 \/ 5000 characters/i)).toBeInTheDocument();

      const textarea = screen.getByPlaceholderText(/Add your private notes here/i);
      fireEvent.change(textarea, { target: { value: "Hello" } });

      expect(screen.getByText(/5 \/ 5000 characters/i)).toBeInTheDocument();
    });

    it("should enforce 5000 character limit", () => {
      render(
        <PrivateNoteCard
          note={null}
          targetUserId="user-2"
          targetUserDisplayName="John Doe"
          onSave={mockOnSave}
        />
      );

      const addButton = screen.getByText(/Add Note/i);
      fireEvent.click(addButton);

      const textarea = screen.getByPlaceholderText(/Add your private notes here/i);
      const longText = "a".repeat(5001);
      fireEvent.change(textarea, { target: { value: longText } });

      // The maxLength attribute should prevent this, but value will be truncated
      expect((textarea as HTMLTextAreaElement).value.length).toBeLessThanOrEqual(5000);
    });

    it("should allow adding tags", () => {
      render(
        <PrivateNoteCard
          note={null}
          targetUserId="user-2"
          targetUserDisplayName="John Doe"
          onSave={mockOnSave}
        />
      );

      const addButton = screen.getByText(/Add Note/i);
      fireEvent.click(addButton);

      const tagInput = screen.getByPlaceholderText(/Add a tag/i);
      fireEvent.change(tagInput, { target: { value: "friend" } });

      const addTagButton = screen.getByText(/^Add$/);
      fireEvent.click(addTagButton);

      expect(screen.getByText("friend")).toBeInTheDocument();
    });

    it("should allow adding tag with Enter key", () => {
      render(
        <PrivateNoteCard
          note={null}
          targetUserId="user-2"
          targetUserDisplayName="John Doe"
          onSave={mockOnSave}
        />
      );

      const addButton = screen.getByText(/Add Note/i);
      fireEvent.click(addButton);

      const tagInput = screen.getByPlaceholderText(/Add a tag/i);
      fireEvent.change(tagInput, { target: { value: "friend" } });
      fireEvent.keyDown(tagInput, { key: "Enter", code: "Enter" });

      expect(screen.getByText("friend")).toBeInTheDocument();
    });

    it("should allow removing tags", () => {
      render(
        <PrivateNoteCard
          note={mockNote}
          targetUserId="user-2"
          targetUserDisplayName="John Doe"
          onSave={mockOnSave}
          onDelete={mockOnDelete}
        />
      );

      const editButton = screen.getByText("Edit");
      fireEvent.click(editButton);

      const colleagueTag = screen.getByText("colleague").closest("span");
      const removeButton = colleagueTag?.querySelector("button");

      if (removeButton) {
        fireEvent.click(removeButton);
      }

      expect(screen.queryByText("colleague")).not.toBeInTheDocument();
    });

    it("should prevent adding more than 5 tags", () => {
      render(
        <PrivateNoteCard
          note={null}
          targetUserId="user-2"
          targetUserDisplayName="John Doe"
          onSave={mockOnSave}
        />
      );

      const addButton = screen.getByText(/Add Note/i);
      fireEvent.click(addButton);

      // Add 5 tags
      for (let i = 1; i <= 5; i++) {
        const tagInput = screen.getByPlaceholderText(/Add a tag/i);
        fireEvent.change(tagInput, { target: { value: `tag${i}` } });
        const addTagButton = screen.getByText(/^Add$/);
        fireEvent.click(addTagButton);
      }

      // Try to add 6th tag
      const tagInput = screen.getByPlaceholderText(/Add a tag/i);
      fireEvent.change(tagInput, { target: { value: "tag6" } });
      const addTagButton = screen.getByText(/^Add$/);
      fireEvent.click(addTagButton);

      expect(screen.getByText(/Maximum 5 tags allowed/i)).toBeInTheDocument();
    });

    it("should prevent adding duplicate tags", () => {
      render(
        <PrivateNoteCard
          note={null}
          targetUserId="user-2"
          targetUserDisplayName="John Doe"
          onSave={mockOnSave}
        />
      );

      const addButton = screen.getByText(/Add Note/i);
      fireEvent.click(addButton);

      const tagInput = screen.getByPlaceholderText(/Add a tag/i);

      // Add first tag
      fireEvent.change(tagInput, { target: { value: "friend" } });
      const addTagButton = screen.getByText(/^Add$/);
      fireEvent.click(addTagButton);

      // Try to add same tag again
      fireEvent.change(tagInput, { target: { value: "friend" } });
      fireEvent.click(addTagButton);

      expect(screen.getByText(/Tag already exists/i)).toBeInTheDocument();
    });

    it("should prevent adding tags longer than 30 characters", () => {
      render(
        <PrivateNoteCard
          note={null}
          targetUserId="user-2"
          targetUserDisplayName="John Doe"
          onSave={mockOnSave}
        />
      );

      const addButton = screen.getByText(/Add Note/i);
      fireEvent.click(addButton);

      const tagInput = screen.getByPlaceholderText(/Add a tag/i);
      const longTag = "a".repeat(31);

      fireEvent.change(tagInput, { target: { value: longTag } });
      const addTagButton = screen.getByText(/^Add$/);
      fireEvent.click(addTagButton);

      expect(screen.getByText(/Tag must not exceed 30 characters/i)).toBeInTheDocument();
    });

    it("should enforce 30 character limit on tag input", () => {
      render(
        <PrivateNoteCard
          note={null}
          targetUserId="user-2"
          targetUserDisplayName="John Doe"
          onSave={mockOnSave}
        />
      );

      const addButton = screen.getByText(/Add Note/i);
      fireEvent.click(addButton);

      const tagInput = screen.getByPlaceholderText(/Add a tag/i) as HTMLInputElement;
      expect(tagInput.maxLength).toBe(30);
    });
  });

  describe("Save functionality", () => {
    it("should call onSave with content and tags", async () => {
      render(
        <PrivateNoteCard
          note={null}
          targetUserId="user-2"
          targetUserDisplayName="John Doe"
          onSave={mockOnSave}
        />
      );

      const addButton = screen.getByText(/Add Note/i);
      fireEvent.click(addButton);

      const textarea = screen.getByPlaceholderText(/Add your private notes here/i);
      fireEvent.change(textarea, { target: { value: "New note content" } });

      const tagInput = screen.getByPlaceholderText(/Add a tag/i);
      fireEvent.change(tagInput, { target: { value: "friend" } });
      const addTagButton = screen.getByText(/^Add$/);
      fireEvent.click(addTagButton);

      const saveButton = screen.getByText(/Save Note/i);
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith("New note content", ["friend"]);
      });
    });

    it("should trim content before saving", async () => {
      render(
        <PrivateNoteCard
          note={null}
          targetUserId="user-2"
          targetUserDisplayName="John Doe"
          onSave={mockOnSave}
        />
      );

      const addButton = screen.getByText(/Add Note/i);
      fireEvent.click(addButton);

      const textarea = screen.getByPlaceholderText(/Add your private notes here/i);
      fireEvent.change(textarea, { target: { value: "  Content with spaces  " } });

      const saveButton = screen.getByText(/Save Note/i);
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith("Content with spaces", []);
      });
    });

    it("should prevent saving empty content", async () => {
      render(
        <PrivateNoteCard
          note={null}
          targetUserId="user-2"
          targetUserDisplayName="John Doe"
          onSave={mockOnSave}
        />
      );

      const addButton = screen.getByText(/Add Note/i);
      fireEvent.click(addButton);

      const saveButton = screen.getByText(/Save Note/i);
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/Note content cannot be empty/i)).toBeInTheDocument();
      });

      expect(mockOnSave).not.toHaveBeenCalled();
    });

    it("should prevent saving content over 5000 characters", async () => {
      render(
        <PrivateNoteCard
          note={null}
          targetUserId="user-2"
          targetUserDisplayName="John Doe"
          onSave={mockOnSave}
        />
      );

      const addButton = screen.getByText(/Add Note/i);
      fireEvent.click(addButton);

      // Manually override validation to test the check
      const saveButton = screen.getByText(/Save Note/i);

      // This would normally be prevented by maxLength, but we test the validation
      const component = screen.getByPlaceholderText(/Add your private notes here/i);
      Object.defineProperty(component, 'value', {
        writable: true,
        value: 'a'.repeat(5001)
      });

      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/Note content cannot exceed 5000 characters/i)).toBeInTheDocument();
      });

      expect(mockOnSave).not.toHaveBeenCalled();
    });

    it("should show loading state while saving", async () => {
      let resolveSave: () => void;
      const savePromise = new Promise<void>((resolve) => {
        resolveSave = resolve;
      });
      mockOnSave.mockReturnValue(savePromise);

      render(
        <PrivateNoteCard
          note={null}
          targetUserId="user-2"
          targetUserDisplayName="John Doe"
          onSave={mockOnSave}
        />
      );

      const addButton = screen.getByText(/Add Note/i);
      fireEvent.click(addButton);

      const textarea = screen.getByPlaceholderText(/Add your private notes here/i);
      fireEvent.change(textarea, { target: { value: "New note" } });

      const saveButton = screen.getByText(/Save Note/i);
      fireEvent.click(saveButton);

      expect(screen.getByText(/Saving/i)).toBeInTheDocument();

      resolveSave!();
      await waitFor(() => {
        expect(screen.queryByText(/Saving/i)).not.toBeInTheDocument();
      });
    });

    it("should display error message on save failure", async () => {
      mockOnSave.mockRejectedValue(new Error("Failed to save"));

      render(
        <PrivateNoteCard
          note={null}
          targetUserId="user-2"
          targetUserDisplayName="John Doe"
          onSave={mockOnSave}
        />
      );

      const addButton = screen.getByText(/Add Note/i);
      fireEvent.click(addButton);

      const textarea = screen.getByPlaceholderText(/Add your private notes here/i);
      fireEvent.change(textarea, { target: { value: "New note" } });

      const saveButton = screen.getByText(/Save Note/i);
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/Failed to save/i)).toBeInTheDocument();
      });
    });

    it("should exit edit mode after successful save", async () => {
      render(
        <PrivateNoteCard
          note={null}
          targetUserId="user-2"
          targetUserDisplayName="John Doe"
          onSave={mockOnSave}
        />
      );

      const addButton = screen.getByText(/Add Note/i);
      fireEvent.click(addButton);

      const textarea = screen.getByPlaceholderText(/Add your private notes here/i);
      fireEvent.change(textarea, { target: { value: "New note" } });

      const saveButton = screen.getByText(/Save Note/i);
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.queryByPlaceholderText(/Add your private notes here/i)).not.toBeInTheDocument();
      });
    });
  });

  describe("Cancel functionality", () => {
    it("should restore original values when canceling edit", () => {
      render(
        <PrivateNoteCard
          note={mockNote}
          targetUserId="user-2"
          targetUserDisplayName="John Doe"
          onSave={mockOnSave}
          onDelete={mockOnDelete}
        />
      );

      const editButton = screen.getByText("Edit");
      fireEvent.click(editButton);

      const textarea = screen.getByDisplayValue("Great person to work with!");
      fireEvent.change(textarea, { target: { value: "Changed content" } });

      const cancelButton = screen.getByText("Cancel");
      fireEvent.click(cancelButton);

      expect(screen.getByText("Great person to work with!")).toBeInTheDocument();
    });

    it("should clear form when canceling new note", () => {
      render(
        <PrivateNoteCard
          note={null}
          targetUserId="user-2"
          targetUserDisplayName="John Doe"
          onSave={mockOnSave}
        />
      );

      const addButton = screen.getByText(/Add Note/i);
      fireEvent.click(addButton);

      const textarea = screen.getByPlaceholderText(/Add your private notes here/i);
      fireEvent.change(textarea, { target: { value: "Some content" } });

      const cancelButton = screen.getByText("Cancel");
      fireEvent.click(cancelButton);

      expect(screen.getByText(/Add Note/i)).toBeInTheDocument();
    });
  });

  describe("Delete functionality", () => {
    it("should show confirmation dialog before deleting", () => {
      const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);

      render(
        <PrivateNoteCard
          note={mockNote}
          targetUserId="user-2"
          targetUserDisplayName="John Doe"
          onSave={mockOnSave}
          onDelete={mockOnDelete}
        />
      );

      const deleteButton = screen.getByText("Delete");
      fireEvent.click(deleteButton);

      expect(confirmSpy).toHaveBeenCalledWith(
        expect.stringContaining("delete your note about John Doe")
      );

      confirmSpy.mockRestore();
    });

    it("should call onDelete when confirmed", async () => {
      const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

      render(
        <PrivateNoteCard
          note={mockNote}
          targetUserId="user-2"
          targetUserDisplayName="John Doe"
          onSave={mockOnSave}
          onDelete={mockOnDelete}
        />
      );

      const deleteButton = screen.getByText("Delete");
      fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(mockOnDelete).toHaveBeenCalled();
      });

      confirmSpy.mockRestore();
    });

    it("should not call onDelete when cancelled", () => {
      const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);

      render(
        <PrivateNoteCard
          note={mockNote}
          targetUserId="user-2"
          targetUserDisplayName="John Doe"
          onSave={mockOnSave}
          onDelete={mockOnDelete}
        />
      );

      const deleteButton = screen.getByText("Delete");
      fireEvent.click(deleteButton);

      expect(mockOnDelete).not.toHaveBeenCalled();

      confirmSpy.mockRestore();
    });

    it("should show deleting state", async () => {
      const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
      let resolveDelete: () => void;
      const deletePromise = new Promise<void>((resolve) => {
        resolveDelete = resolve;
      });
      mockOnDelete.mockReturnValue(deletePromise);

      render(
        <PrivateNoteCard
          note={mockNote}
          targetUserId="user-2"
          targetUserDisplayName="John Doe"
          onSave={mockOnSave}
          onDelete={mockOnDelete}
        />
      );

      const deleteButton = screen.getByText("Delete");
      fireEvent.click(deleteButton);

      expect(screen.getByText(/Deleting/i)).toBeInTheDocument();

      resolveDelete!();
      await waitFor(() => {
        expect(screen.queryByText(/Deleting/i)).not.toBeInTheDocument();
      });

      confirmSpy.mockRestore();
    });

    it("should display error on delete failure", async () => {
      const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
      mockOnDelete.mockRejectedValue(new Error("Failed to delete"));

      render(
        <PrivateNoteCard
          note={mockNote}
          targetUserId="user-2"
          targetUserDisplayName="John Doe"
          onSave={mockOnSave}
          onDelete={mockOnDelete}
        />
      );

      const deleteButton = screen.getByText("Delete");
      fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(screen.getByText(/Failed to delete/i)).toBeInTheDocument();
      });

      confirmSpy.mockRestore();
    });
  });
});
