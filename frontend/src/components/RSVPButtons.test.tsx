import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { RSVPButtons } from "./RSVPButtons";

// Mock fetch globally
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

describe("RSVPButtons", () => {
  const defaultProps = {
    eventId: "event-123",
    authToken: "test-token",
    apiBaseUrl: "http://test-api.com/api",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  describe("Basic RSVP functionality", () => {
    it("should render RSVP buttons", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            rsvp: null,
            canModify: true,
            deadlinePassed: false,
            rsvpDeadline: null,
          }),
      });

      render(<RSVPButtons {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("Yes")).toBeInTheDocument();
        expect(screen.getByText("No")).toBeInTheDocument();
        expect(screen.getByText("Maybe")).toBeInTheDocument();
      });
    });

    it("should show current RSVP status", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            rsvp: { response: "YES" },
            canModify: true,
            deadlinePassed: false,
            rsvpDeadline: null,
          }),
      });

      render(<RSVPButtons {...defaultProps} initialRsvp="YES" />);

      await waitFor(() => {
        expect(screen.getByText("Yes, I'll attend")).toBeInTheDocument();
      });
    });
  });

  describe("Capacity and Waitlist", () => {
    it("should show at capacity message when event is full", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              rsvp: null,
              canModify: true,
              deadlinePassed: false,
              rsvpDeadline: null,
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              onWaitlist: false,
              waitlist: null,
              waitlistEnabled: true,
              capacity: 10,
            }),
        });

      render(
        <RSVPButtons
          {...defaultProps}
          capacity={10}
          currentYesCount={10}
          waitlistEnabled={false}
        />
      );

      await waitFor(() => {
        expect(screen.getByText("This event is at capacity")).toBeInTheDocument();
      });
    });

    it("should show join waitlist button when event is full and waitlist is enabled", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              rsvp: null,
              canModify: true,
              deadlinePassed: false,
              rsvpDeadline: null,
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              onWaitlist: false,
              waitlist: null,
              waitlistEnabled: true,
              capacity: 10,
            }),
        });

      render(
        <RSVPButtons
          {...defaultProps}
          capacity={10}
          currentYesCount={10}
          waitlistEnabled={true}
        />
      );

      await waitFor(() => {
        expect(screen.getByText("This event is at capacity")).toBeInTheDocument();
        expect(screen.getByText("Join Waitlist")).toBeInTheDocument();
      });
    });

    it("should hide Yes button when at capacity", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              rsvp: null,
              canModify: true,
              deadlinePassed: false,
              rsvpDeadline: null,
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              onWaitlist: false,
              waitlist: null,
              waitlistEnabled: true,
              capacity: 10,
            }),
        });

      render(
        <RSVPButtons
          {...defaultProps}
          capacity={10}
          currentYesCount={10}
          waitlistEnabled={true}
        />
      );

      await waitFor(() => {
        expect(screen.queryByText("Yes")).not.toBeInTheDocument();
        expect(screen.getByText("No")).toBeInTheDocument();
        expect(screen.getByText("Maybe")).toBeInTheDocument();
      });
    });

    it("should show Yes button if user already has YES RSVP at capacity", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              rsvp: { response: "YES" },
              canModify: true,
              deadlinePassed: false,
              rsvpDeadline: null,
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              onWaitlist: false,
              waitlist: null,
              waitlistEnabled: true,
              capacity: 10,
            }),
        });

      render(
        <RSVPButtons
          {...defaultProps}
          initialRsvp="YES"
          capacity={10}
          currentYesCount={10}
          waitlistEnabled={true}
        />
      );

      await waitFor(() => {
        expect(screen.getByText("Yes")).toBeInTheDocument();
      });
    });
  });

  describe("Waitlist status", () => {
    it("should show waitlist position when user is on waitlist", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              rsvp: null,
              canModify: true,
              deadlinePassed: false,
              rsvpDeadline: null,
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              onWaitlist: true,
              waitlist: {
                id: "waitlist-1",
                position: 3,
                totalWaitlist: 5,
                createdAt: new Date().toISOString(),
                notifiedAt: null,
                expiresAt: null,
              },
              waitlistEnabled: true,
              capacity: 10,
            }),
        });

      render(<RSVPButtons {...defaultProps} waitlistEnabled={true} />);

      await waitFor(() => {
        expect(screen.getByText("You're on the waitlist")).toBeInTheDocument();
        expect(screen.getByText(/Position: #3/)).toBeInTheDocument();
      });
    });

    it("should show leave waitlist button when on waitlist", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              rsvp: null,
              canModify: true,
              deadlinePassed: false,
              rsvpDeadline: null,
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              onWaitlist: true,
              waitlist: {
                id: "waitlist-1",
                position: 3,
                createdAt: new Date().toISOString(),
                notifiedAt: null,
                expiresAt: null,
              },
              waitlistEnabled: true,
              capacity: 10,
            }),
        });

      render(<RSVPButtons {...defaultProps} waitlistEnabled={true} />);

      await waitFor(() => {
        expect(screen.getByText("Leave waitlist")).toBeInTheDocument();
      });
    });

    it("should hide RSVP buttons when on waitlist", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              rsvp: null,
              canModify: true,
              deadlinePassed: false,
              rsvpDeadline: null,
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              onWaitlist: true,
              waitlist: {
                id: "waitlist-1",
                position: 3,
                createdAt: new Date().toISOString(),
                notifiedAt: null,
                expiresAt: null,
              },
              waitlistEnabled: true,
              capacity: 10,
            }),
        });

      render(<RSVPButtons {...defaultProps} waitlistEnabled={true} />);

      await waitFor(() => {
        expect(screen.getByText("You're on the waitlist")).toBeInTheDocument();
      });

      expect(screen.queryByText("Yes")).not.toBeInTheDocument();
      expect(screen.queryByText("No")).not.toBeInTheDocument();
      expect(screen.queryByText("Maybe")).not.toBeInTheDocument();
    });
  });

  describe("Waitlist notification (spot opened)", () => {
    it("should show spot available notification", async () => {
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              rsvp: null,
              canModify: true,
              deadlinePassed: false,
              rsvpDeadline: null,
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              onWaitlist: true,
              waitlist: {
                id: "waitlist-1",
                position: 1,
                createdAt: new Date().toISOString(),
                notifiedAt: new Date().toISOString(),
                expiresAt: expiresAt,
              },
              waitlistEnabled: true,
              capacity: 10,
            }),
        });

      render(<RSVPButtons {...defaultProps} waitlistEnabled={true} />);

      await waitFor(() => {
        expect(screen.getByText("A spot has opened up!")).toBeInTheDocument();
        expect(screen.getByText("Confirm My Spot")).toBeInTheDocument();
      });
    });

    it("should show expiry time in notification", async () => {
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              rsvp: null,
              canModify: true,
              deadlinePassed: false,
              rsvpDeadline: null,
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              onWaitlist: true,
              waitlist: {
                id: "waitlist-1",
                position: 1,
                createdAt: new Date().toISOString(),
                notifiedAt: new Date().toISOString(),
                expiresAt: expiresAt,
              },
              waitlistEnabled: true,
              capacity: 10,
            }),
        });

      render(<RSVPButtons {...defaultProps} waitlistEnabled={true} />);

      await waitFor(() => {
        expect(screen.getByText(/You have until/)).toBeInTheDocument();
      });
    });

    it("should confirm waitlist spot when button is clicked", async () => {
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              rsvp: null,
              canModify: true,
              deadlinePassed: false,
              rsvpDeadline: null,
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              onWaitlist: true,
              waitlist: {
                id: "waitlist-1",
                position: 1,
                createdAt: new Date().toISOString(),
                notifiedAt: new Date().toISOString(),
                expiresAt: expiresAt,
              },
              waitlistEnabled: true,
              capacity: 10,
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              message: "Your attendance has been confirmed!",
              rsvp: { eventId: "event-123", userId: "user-1", response: "YES" },
            }),
        });

      render(<RSVPButtons {...defaultProps} waitlistEnabled={true} />);

      await waitFor(() => {
        expect(screen.getByText("Confirm My Spot")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Confirm My Spot"));

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          "http://test-api.com/api/events/event-123/waitlist/confirm",
          expect.objectContaining({
            method: "POST",
          })
        );
      });
    });
  });

  describe("Joining and leaving waitlist", () => {
    it("should call join waitlist API when button is clicked", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              rsvp: null,
              canModify: true,
              deadlinePassed: false,
              rsvpDeadline: null,
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              onWaitlist: false,
              waitlist: null,
              waitlistEnabled: true,
              capacity: 10,
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              message: "You have been added to the waitlist",
              waitlist: {
                id: "waitlist-1",
                position: 1,
                createdAt: new Date().toISOString(),
              },
            }),
        });

      render(
        <RSVPButtons
          {...defaultProps}
          capacity={10}
          currentYesCount={10}
          waitlistEnabled={true}
        />
      );

      await waitFor(() => {
        expect(screen.getByText("Join Waitlist")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Join Waitlist"));

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          "http://test-api.com/api/events/event-123/waitlist",
          expect.objectContaining({
            method: "POST",
          })
        );
      });
    });

    it("should call leave waitlist API when button is clicked", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              rsvp: null,
              canModify: true,
              deadlinePassed: false,
              rsvpDeadline: null,
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              onWaitlist: true,
              waitlist: {
                id: "waitlist-1",
                position: 3,
                createdAt: new Date().toISOString(),
                notifiedAt: null,
                expiresAt: null,
              },
              waitlistEnabled: true,
              capacity: 10,
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              message: "You have been removed from the waitlist",
            }),
        });

      render(<RSVPButtons {...defaultProps} waitlistEnabled={true} />);

      await waitFor(() => {
        expect(screen.getByText("Leave waitlist")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Leave waitlist"));

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          "http://test-api.com/api/events/event-123/waitlist",
          expect.objectContaining({
            method: "DELETE",
          })
        );
      });
    });
  });

  describe("Error handling", () => {
    it("should show error message when join waitlist fails", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              rsvp: null,
              canModify: true,
              deadlinePassed: false,
              rsvpDeadline: null,
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              onWaitlist: false,
              waitlist: null,
              waitlistEnabled: true,
              capacity: 10,
            }),
        })
        .mockResolvedValueOnce({
          ok: false,
          json: () =>
            Promise.resolve({
              message: "Event is not at capacity",
            }),
        });

      render(
        <RSVPButtons
          {...defaultProps}
          capacity={10}
          currentYesCount={10}
          waitlistEnabled={true}
        />
      );

      await waitFor(() => {
        expect(screen.getByText("Join Waitlist")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Join Waitlist"));

      await waitFor(() => {
        expect(screen.getByText("Event is not at capacity")).toBeInTheDocument();
      });
    });

    it("should show error message when confirm spot fails", async () => {
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              rsvp: null,
              canModify: true,
              deadlinePassed: false,
              rsvpDeadline: null,
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              onWaitlist: true,
              waitlist: {
                id: "waitlist-1",
                position: 1,
                createdAt: new Date().toISOString(),
                notifiedAt: new Date().toISOString(),
                expiresAt: expiresAt,
              },
              waitlistEnabled: true,
              capacity: 10,
            }),
        })
        .mockResolvedValueOnce({
          ok: false,
          json: () =>
            Promise.resolve({
              message: "Your spot confirmation has expired",
            }),
        });

      render(<RSVPButtons {...defaultProps} waitlistEnabled={true} />);

      await waitFor(() => {
        expect(screen.getByText("Confirm My Spot")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Confirm My Spot"));

      await waitFor(() => {
        expect(screen.getByText("Your spot confirmation has expired")).toBeInTheDocument();
      });
    });
  });

  describe("Loading states", () => {
    it("should show loading state while fetching RSVP", () => {
      mockFetch.mockImplementation(() => new Promise(() => {})); // Never resolves

      render(<RSVPButtons {...defaultProps} />);

      expect(screen.getByText("Loading...")).toBeInTheDocument();
    });

    it("should show Joining... while joining waitlist", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              rsvp: null,
              canModify: true,
              deadlinePassed: false,
              rsvpDeadline: null,
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              onWaitlist: false,
              waitlist: null,
              waitlistEnabled: true,
              capacity: 10,
            }),
        })
        .mockImplementationOnce(() => new Promise(() => {})); // Never resolves

      render(
        <RSVPButtons
          {...defaultProps}
          capacity={10}
          currentYesCount={10}
          waitlistEnabled={true}
        />
      );

      await waitFor(() => {
        expect(screen.getByText("Join Waitlist")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Join Waitlist"));

      await waitFor(() => {
        expect(screen.getByText("Joining...")).toBeInTheDocument();
      });
    });

    it("should show Confirming... while confirming spot", async () => {
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              rsvp: null,
              canModify: true,
              deadlinePassed: false,
              rsvpDeadline: null,
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              onWaitlist: true,
              waitlist: {
                id: "waitlist-1",
                position: 1,
                createdAt: new Date().toISOString(),
                notifiedAt: new Date().toISOString(),
                expiresAt: expiresAt,
              },
              waitlistEnabled: true,
              capacity: 10,
            }),
        })
        .mockImplementationOnce(() => new Promise(() => {})); // Never resolves

      render(<RSVPButtons {...defaultProps} waitlistEnabled={true} />);

      await waitFor(() => {
        expect(screen.getByText("Confirm My Spot")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Confirm My Spot"));

      await waitFor(() => {
        expect(screen.getByText("Confirming...")).toBeInTheDocument();
      });
    });
  });
});
