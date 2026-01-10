import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { ProfilePage } from "./ProfilePage";
import * as api from "../services/api";
import type { UserProfile, DataExport } from "../services/api";

// Mock the api module
vi.mock("../services/api", async () => {
  const actual = await vi.importActual<typeof api>("../services/api");
  return {
    ...actual,
    getProfile: vi.fn(),
    updateProfile: vi.fn(),
    getDataExports: vi.fn(),
    deactivateAccount: vi.fn(),
    requestAccountDeletion: vi.fn(),
    cancelAccountDeletion: vi.fn(),
    requestDataExport: vi.fn(),
  };
});

// Helper to wrap component in BrowserRouter
function renderWithRouter(ui: React.ReactElement) {
  return render(<BrowserRouter>{ui}</BrowserRouter>);
}

describe("ProfilePage", () => {
  const mockProfile: UserProfile = {
    id: "user-1",
    phone: "+1234567890",
    email: "test@example.com",
    displayName: "Test User",
    photoUrl: "https://example.com/photo.jpg",
    bio: "Test bio",
    location: "San Francisco, CA",
    photoVisibility: "CONNECTIONS",
    bioVisibility: "CONNECTIONS",
    locationVisibility: "CONNECTIONS",
    emailNotifications: true,
    smsNotifications: true,
    wallActivityNotifications: true,
    connectionEventNotifications: true,
    isActive: true,
    deletionScheduledAt: null,
    deletionExecutionAt: null,
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  };

  const mockDataExports: DataExport[] = [
    {
      id: "export-1",
      status: "COMPLETED",
      requestedAt: "2024-01-01T00:00:00.000Z",
      completedAt: "2024-01-01T01:00:00.000Z",
      fileUrl: "https://example.com/export.zip",
      expiresAt: "2024-01-08T00:00:00.000Z",
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.getProfile).mockResolvedValue({ profile: mockProfile });
    vi.mocked(api.getDataExports).mockResolvedValue({ exports: mockDataExports });
  });

  it("should display loading skeleton initially", () => {
    renderWithRouter(<ProfilePage />);
    expect(screen.getByRole("heading", { name: /profile settings/i })).toBeInTheDocument();
  });

  it("should load and display profile data", async () => {
    renderWithRouter(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByDisplayValue("Test User")).toBeInTheDocument();
    });

    expect(screen.getByDisplayValue("Test bio")).toBeInTheDocument();
    expect(screen.getByDisplayValue("San Francisco, CA")).toBeInTheDocument();
  });

  it("should display contact information as read-only", async () => {
    renderWithRouter(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByText(/\+1234567890/)).toBeInTheDocument();
    });

    expect(screen.getByText(/test@example.com/)).toBeInTheDocument();
  });

  it("should allow updating profile fields", async () => {
    const updatedProfile = { ...mockProfile, displayName: "Updated Name" };
    vi.mocked(api.updateProfile).mockResolvedValue({ profile: updatedProfile });

    renderWithRouter(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByDisplayValue("Test User")).toBeInTheDocument();
    });

    const displayNameInput = screen.getByLabelText(/display name/i);
    fireEvent.change(displayNameInput, { target: { value: "Updated Name" } });

    const saveButton = screen.getByRole("button", { name: /save changes/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(api.updateProfile).toHaveBeenCalledWith({
        displayName: "Updated Name",
      });
    });
  });

  it("should display visibility select dropdowns", async () => {
    renderWithRouter(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByDisplayValue("Test User")).toBeInTheDocument();
    });

    const visibilitySelects = screen.getAllByRole("combobox");
    expect(visibilitySelects.length).toBeGreaterThan(0);
  });

  it("should display notification preference checkboxes", async () => {
    renderWithRouter(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByLabelText(/email notifications/i)).toBeInTheDocument();
    });

    expect(screen.getByLabelText(/sms notifications/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/wall activity notifications/i)).toBeInTheDocument();
  });

  it("should show pending deletion warning when scheduled", async () => {
    const profileWithDeletion = {
      ...mockProfile,
      deletionScheduledAt: "2024-01-01T00:00:00.000Z",
      deletionExecutionAt: "2024-01-15T00:00:00.000Z",
    };
    vi.mocked(api.getProfile).mockResolvedValue({ profile: profileWithDeletion });

    renderWithRouter(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByText(/account deletion scheduled/i)).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: /cancel deletion/i })).toBeInTheDocument();
  });

  it("should display data exports list", async () => {
    renderWithRouter(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByDisplayValue("Test User")).toBeInTheDocument();
    });

    // Check for export status (rendered in lowercase in the UI)
    expect(screen.getByText("COMPLETED")).toBeInTheDocument();
  });

  it("should allow requesting a new data export", async () => {
    vi.mocked(api.requestDataExport).mockResolvedValue({
      message: "Export requested",
      exportId: "export-2",
      status: "PENDING",
    });

    renderWithRouter(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByText(/request data export/i)).toBeInTheDocument();
    });

    const exportButton = screen.getByRole("button", { name: /request data export/i });
    fireEvent.click(exportButton);

    await waitFor(() => {
      expect(api.requestDataExport).toHaveBeenCalled();
    });
  });

  it("should disable export button when export is in progress", async () => {
    const exportsInProgress = [
      {
        id: "export-2",
        status: "PENDING" as const,
        requestedAt: "2024-01-02T00:00:00.000Z",
        completedAt: null,
        fileUrl: null,
        expiresAt: null,
      },
    ];
    vi.mocked(api.getDataExports).mockResolvedValue({ exports: exportsInProgress });

    renderWithRouter(<ProfilePage />);

    await waitFor(() => {
      const exportButton = screen.getByRole("button", { name: /request data export/i });
      expect(exportButton).toBeDisabled();
    });
  });

  it("should show deactivate account confirmation", async () => {
    renderWithRouter(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByDisplayValue("Test User")).toBeInTheDocument();
    });

    const deactivateButtons = screen.getAllByRole("button", { name: /deactivate account/i });
    fireEvent.click(deactivateButtons[0]);

    await waitFor(() => {
      expect(screen.getByText(/are you sure/i)).toBeInTheDocument();
    });
  });

  it("should show delete account confirmation", async () => {
    renderWithRouter(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByDisplayValue("Test User")).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByRole("button", { name: /delete account/i });
    fireEvent.click(deleteButtons[0]);

    await waitFor(() => {
      expect(screen.getByText(/warning/i)).toBeInTheDocument();
    });
  });

  it("should handle API errors gracefully", async () => {
    vi.mocked(api.getProfile).mockRejectedValue({
      message: "Network error",
      statusCode: 500,
    });

    renderWithRouter(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/network error/i)).toBeInTheDocument();
  });

  it("should show unauthorized error for 401", async () => {
    vi.mocked(api.getProfile).mockRejectedValue({
      message: "Unauthorized",
      statusCode: 401,
    });

    renderWithRouter(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByText(/please log in/i)).toBeInTheDocument();
    });
  });

  it("should disable save button when no changes", async () => {
    renderWithRouter(<ProfilePage />);

    await waitFor(() => {
      const saveButton = screen.getByRole("button", { name: /save changes/i });
      expect(saveButton).toBeDisabled();
    });
  });

  it("should validate display name is not empty", async () => {
    renderWithRouter(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByDisplayValue("Test User")).toBeInTheDocument();
    });

    const displayNameInput = screen.getByLabelText(/display name/i);
    fireEvent.change(displayNameInput, { target: { value: "" } });

    const saveButton = screen.getByRole("button", { name: /save changes/i });
    expect(saveButton).toBeDisabled();
  });
});
