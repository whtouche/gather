import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { RetentionSettings } from "../RetentionSettings";
import * as api from "../../services/api";

// Mock the API module
vi.mock("../../services/api", () => ({
  getEventRetentionSettings: vi.fn(),
  updateEventRetentionSettings: vi.fn(),
  archiveEvent: vi.fn(),
  scheduleEventForDeletion: vi.fn(),
  cancelScheduledDeletion: vi.fn(),
  isApiError: vi.fn((err) => err && typeof err === "object" && "message" in err),
}));

describe("RetentionSettings Component", () => {
  const mockEventId = "event123";
  const mockSettings = {
    dataRetentionMonths: 24,
    wallRetentionMonths: 6,
    retentionNotificationSent: false,
    retentionNotificationSentAt: null,
    archivedAt: null,
    scheduledForDeletionAt: null,
    estimatedArchivalDate: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.getEventRetentionSettings).mockResolvedValue(mockSettings);
  });

  describe("Rendering", () => {
    it("should not render for non-organizers", () => {
      const { container } = render(
        <RetentionSettings eventId={mockEventId} isOrganizer={false} />
      );
      expect(container.firstChild).toBeNull();
    });

    it("should show loading state initially for organizers", () => {
      render(<RetentionSettings eventId={mockEventId} isOrganizer={true} />);

      // Check for loading skeleton
      const skeletons = document.querySelectorAll(".animate-pulse");
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it("should render retention settings form for organizers", async () => {
      render(<RetentionSettings eventId={mockEventId} isOrganizer={true} />);

      await waitFor(() => {
        expect(screen.getByText("Data Retention Settings")).toBeInTheDocument();
      });

      expect(
        screen.getByLabelText(/Event Data Retention Period/i)
      ).toBeInTheDocument();
      expect(
        screen.getByLabelText(/Wall Message Retention Period/i)
      ).toBeInTheDocument();
    });

    it("should display current retention settings", async () => {
      render(<RetentionSettings eventId={mockEventId} isOrganizer={true} />);

      await waitFor(() => {
        const dataRetentionInput = screen.getByLabelText(
          /Event Data Retention Period/i
        ) as HTMLInputElement;
        expect(dataRetentionInput.value).toBe("24");

        const wallRetentionInput = screen.getByLabelText(
          /Wall Message Retention Period/i
        ) as HTMLInputElement;
        expect(wallRetentionInput.value).toBe("6");
      });
    });
  });

  describe("Update Retention Settings", () => {
    it("should update retention settings when form is submitted", async () => {
      vi.mocked(api.updateEventRetentionSettings).mockResolvedValue({
        message: "Success",
      });

      render(<RetentionSettings eventId={mockEventId} isOrganizer={true} />);

      await waitFor(() => {
        expect(screen.getByText("Data Retention Settings")).toBeInTheDocument();
      });

      const dataRetentionInput = screen.getByLabelText(
        /Event Data Retention Period/i
      ) as HTMLInputElement;
      fireEvent.change(dataRetentionInput, { target: { value: "12" } });

      const updateButton = screen.getByText("Update Retention Settings");
      fireEvent.click(updateButton);

      await waitFor(() => {
        expect(api.updateEventRetentionSettings).toHaveBeenCalledWith(
          mockEventId,
          {
            dataRetentionMonths: 12,
            wallRetentionMonths: 6,
          }
        );
      });
    });

    it("should validate data retention months is within range", async () => {
      render(<RetentionSettings eventId={mockEventId} isOrganizer={true} />);

      await waitFor(() => {
        expect(screen.getByText("Data Retention Settings")).toBeInTheDocument();
      });

      const dataRetentionInput = screen.getByLabelText(
        /Event Data Retention Period/i
      ) as HTMLInputElement;
      fireEvent.change(dataRetentionInput, { target: { value: "150" } });

      const updateButton = screen.getByText("Update Retention Settings");
      fireEvent.click(updateButton);

      await waitFor(() => {
        expect(
          screen.getByText(/Data retention must be between 1 and 120 months/i)
        ).toBeInTheDocument();
      });

      expect(api.updateEventRetentionSettings).not.toHaveBeenCalled();
    });

    it("should validate wall retention months is within range", async () => {
      render(<RetentionSettings eventId={mockEventId} isOrganizer={true} />);

      await waitFor(() => {
        expect(screen.getByText("Data Retention Settings")).toBeInTheDocument();
      });

      const wallRetentionInput = screen.getByLabelText(
        /Wall Message Retention Period/i
      ) as HTMLInputElement;
      fireEvent.change(wallRetentionInput, { target: { value: "200" } });

      const updateButton = screen.getByText("Update Retention Settings");
      fireEvent.click(updateButton);

      await waitFor(() => {
        expect(
          screen.getByText(/Wall retention must be between 1 and 120 months/i)
        ).toBeInTheDocument();
      });

      expect(api.updateEventRetentionSettings).not.toHaveBeenCalled();
    });

    it("should show success message after successful update", async () => {
      vi.mocked(api.updateEventRetentionSettings).mockResolvedValue({
        message: "Success",
      });

      render(<RetentionSettings eventId={mockEventId} isOrganizer={true} />);

      await waitFor(() => {
        expect(screen.getByText("Data Retention Settings")).toBeInTheDocument();
      });

      const updateButton = screen.getByText("Update Retention Settings");
      fireEvent.click(updateButton);

      await waitFor(() => {
        expect(
          screen.getByText(/Settings updated successfully/i)
        ).toBeInTheDocument();
      });
    });

    it("should handle API errors gracefully", async () => {
      vi.mocked(api.updateEventRetentionSettings).mockRejectedValue({
        message: "Network error",
      });

      render(<RetentionSettings eventId={mockEventId} isOrganizer={true} />);

      await waitFor(() => {
        expect(screen.getByText("Data Retention Settings")).toBeInTheDocument();
      });

      const updateButton = screen.getByText("Update Retention Settings");
      fireEvent.click(updateButton);

      await waitFor(() => {
        expect(screen.getByText(/Network error/i)).toBeInTheDocument();
      });
    });
  });

  describe("Archive Event", () => {
    it("should archive event when confirmed", async () => {
      vi.mocked(api.archiveEvent).mockResolvedValue({ message: "Success" });

      // Mock window.confirm
      const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

      render(<RetentionSettings eventId={mockEventId} isOrganizer={true} />);

      await waitFor(() => {
        expect(screen.getByText("Data Retention Settings")).toBeInTheDocument();
      });

      const archiveButton = screen.getByText("Archive Event Now");
      fireEvent.click(archiveButton);

      await waitFor(() => {
        expect(api.archiveEvent).toHaveBeenCalledWith(mockEventId);
      });

      confirmSpy.mockRestore();
    });

    it("should not archive event when cancelled", async () => {
      const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);

      render(<RetentionSettings eventId={mockEventId} isOrganizer={true} />);

      await waitFor(() => {
        expect(screen.getByText("Data Retention Settings")).toBeInTheDocument();
      });

      const archiveButton = screen.getByText("Archive Event Now");
      fireEvent.click(archiveButton);

      expect(api.archiveEvent).not.toHaveBeenCalled();
      confirmSpy.mockRestore();
    });

    it("should not show archive button for already archived events", async () => {
      vi.mocked(api.getEventRetentionSettings).mockResolvedValue({
        ...mockSettings,
        archivedAt: new Date().toISOString(),
      });

      render(<RetentionSettings eventId={mockEventId} isOrganizer={true} />);

      await waitFor(() => {
        expect(screen.getByText("Data Retention Settings")).toBeInTheDocument();
      });

      expect(screen.queryByText("Archive Event Now")).not.toBeInTheDocument();
      expect(screen.getByText(/Archived:/i)).toBeInTheDocument();
    });
  });

  describe("Schedule Deletion", () => {
    it("should schedule deletion with valid grace period", async () => {
      vi.mocked(api.scheduleEventForDeletion).mockResolvedValue({
        message: "Success",
        gracePeriodDays: 30,
      });

      const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

      render(<RetentionSettings eventId={mockEventId} isOrganizer={true} />);

      await waitFor(() => {
        expect(screen.getByText("Data Retention Settings")).toBeInTheDocument();
      });

      const scheduleButton = screen.getByText("Schedule Permanent Deletion");
      fireEvent.click(scheduleButton);

      await waitFor(() => {
        expect(api.scheduleEventForDeletion).toHaveBeenCalledWith(
          mockEventId,
          30
        );
      });

      confirmSpy.mockRestore();
    });

    it("should validate grace period is within range (too low)", async () => {
      const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

      render(<RetentionSettings eventId={mockEventId} isOrganizer={true} />);

      await waitFor(() => {
        expect(screen.getByText("Data Retention Settings")).toBeInTheDocument();
      });

      const gracePeriodInput = screen.getByLabelText(
        /Grace Period/i
      ) as HTMLInputElement;
      fireEvent.change(gracePeriodInput, { target: { value: "0" } });

      const scheduleButton = screen.getByText("Schedule Permanent Deletion");
      fireEvent.click(scheduleButton);

      await waitFor(() => {
        expect(
          screen.getByText(/Grace period must be between 1 and 365 days/i)
        ).toBeInTheDocument();
      });

      expect(api.scheduleEventForDeletion).not.toHaveBeenCalled();
      confirmSpy.mockRestore();
    });

    it("should validate grace period is within range (too high)", async () => {
      const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

      render(<RetentionSettings eventId={mockEventId} isOrganizer={true} />);

      await waitFor(() => {
        expect(screen.getByText("Data Retention Settings")).toBeInTheDocument();
      });

      const gracePeriodInput = screen.getByLabelText(
        /Grace Period/i
      ) as HTMLInputElement;
      fireEvent.change(gracePeriodInput, { target: { value: "400" } });

      const scheduleButton = screen.getByText("Schedule Permanent Deletion");
      fireEvent.click(scheduleButton);

      await waitFor(() => {
        expect(
          screen.getByText(/Grace period must be between 1 and 365 days/i)
        ).toBeInTheDocument();
      });

      expect(api.scheduleEventForDeletion).not.toHaveBeenCalled();
      confirmSpy.mockRestore();
    });
  });

  describe("Cancel Scheduled Deletion", () => {
    it("should cancel scheduled deletion", async () => {
      vi.mocked(api.getEventRetentionSettings).mockResolvedValue({
        ...mockSettings,
        scheduledForDeletionAt: new Date(
          Date.now() + 86400000 * 30
        ).toISOString(),
      });

      vi.mocked(api.cancelScheduledDeletion).mockResolvedValue({
        message: "Success",
      });

      render(<RetentionSettings eventId={mockEventId} isOrganizer={true} />);

      await waitFor(() => {
        expect(
          screen.getByText(/Scheduled for deletion:/i)
        ).toBeInTheDocument();
      });

      const cancelButton = screen.getByText("Cancel Deletion");
      fireEvent.click(cancelButton);

      await waitFor(() => {
        expect(api.cancelScheduledDeletion).toHaveBeenCalledWith(mockEventId);
      });
    });

    it("should show scheduled deletion warning", async () => {
      const deletionDate = new Date(Date.now() + 86400000 * 30);
      vi.mocked(api.getEventRetentionSettings).mockResolvedValue({
        ...mockSettings,
        scheduledForDeletionAt: deletionDate.toISOString(),
      });

      render(<RetentionSettings eventId={mockEventId} isOrganizer={true} />);

      await waitFor(() => {
        expect(
          screen.getByText(/Scheduled for deletion:/i)
        ).toBeInTheDocument();
        expect(
          screen.getByText(
            new RegExp(deletionDate.toLocaleDateString(), "i")
          )
        ).toBeInTheDocument();
      });
    });
  });

  describe("Display States", () => {
    it("should show estimated archival date when available", async () => {
      const archivalDate = new Date(Date.now() + 86400000 * 365);
      vi.mocked(api.getEventRetentionSettings).mockResolvedValue({
        ...mockSettings,
        estimatedArchivalDate: archivalDate.toISOString(),
      });

      render(<RetentionSettings eventId={mockEventId} isOrganizer={true} />);

      await waitFor(() => {
        expect(
          screen.getByText(/Estimated archival date:/i)
        ).toBeInTheDocument();
        expect(
          screen.getByText(
            new RegExp(archivalDate.toLocaleDateString(), "i")
          )
        ).toBeInTheDocument();
      });
    });

    it("should show retention notification status", async () => {
      const notificationDate = new Date(Date.now() - 86400000);
      vi.mocked(api.getEventRetentionSettings).mockResolvedValue({
        ...mockSettings,
        estimatedArchivalDate: new Date(
          Date.now() + 86400000 * 30
        ).toISOString(),
        retentionNotificationSent: true,
        retentionNotificationSentAt: notificationDate.toISOString(),
      });

      render(<RetentionSettings eventId={mockEventId} isOrganizer={true} />);

      await waitFor(() => {
        expect(
          screen.getByText(/Notification sent on/i)
        ).toBeInTheDocument();
      });
    });
  });
});
