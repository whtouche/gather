# Events Specification

**Requirement Range:** REQ-EVT-001 to REQ-EVT-020

## Purpose

This specification defines event creation, management, and the event lifecycle for the event planning application.

## Event Creation

### REQ-EVT-001: Event Required Fields
**Priority:** High | **Traces to:** US-EVT-001, SM-002

The system SHALL require specific fields when creating an event.

#### Scenario: Creating a new event
- GIVEN an authenticated user
- WHEN they create a new event
- THEN the following fields SHALL be required:
  - Title (text, 1-200 characters)
  - Description (text, 1-5000 characters)
  - Date and time (start datetime, timezone-aware)
  - Location (text description or address, 1-500 characters)
- AND the creating user SHALL automatically become the event organizer

#### Scenario: Event validation
- GIVEN a user submitting event creation form
- WHEN any required field is missing or invalid
- THEN the system SHALL display specific validation errors inline
- AND the event SHALL NOT be created

### REQ-EVT-002: Event Optional Fields
**Priority:** Medium | **Traces to:** US-EVT-001

The system SHALL support optional fields for events.

#### Scenario: Optional event details
- GIVEN a user creating or editing an event
- WHEN they configure optional fields
- THEN the following optional fields SHALL be available:
  - End date/time (must be after start time)
  - Event image/banner (JPEG/PNG, max 5MB, 1200x630px recommended)
  - Capacity limit (positive integer, max attendees)
  - RSVP deadline (datetime, must be before event start)
  - Event category/type (from predefined list)
  - Dress code (text, max 100 characters)
  - Additional notes (text, max 2000 characters)

### REQ-EVT-003: Event Privacy Settings
**Priority:** Medium | **Traces to:** UG-007

The system SHALL allow organizers to configure event privacy.

#### Scenario: Privacy configuration
- GIVEN an organizer creating or editing an event
- WHEN they configure privacy settings
- THEN the following options SHALL be available:
  - Attendee list visible to: All attendees (default) / Organizers only
  - Allow attendees to share invite link: Yes (default) / No
- AND settings SHALL be changeable at any time before event completion

## Event Management

### REQ-EVT-004: Event Draft State
**Priority:** High | **Traces to:** US-EVT-001

The system SHALL support saving events as drafts.

#### Scenario: Creating a draft
- GIVEN an authenticated user creating an event
- WHEN they save without publishing
- THEN the event SHALL be saved in DRAFT state
- AND the event SHALL NOT be visible to anyone except the creator
- AND draft events SHALL appear in the creator's dashboard

### REQ-EVT-005: Event Publishing
**Priority:** High | **Traces to:** US-EVT-002

The system SHALL allow organizers to publish draft events.

#### Scenario: Publishing an event
- GIVEN an organizer with a draft event
- WHEN they publish the event
- THEN the event state SHALL change to PUBLISHED
- AND invite links SHALL become functional
- AND the event SHALL be visible to invitees

### REQ-EVT-006: Organizer Role Assignment
**Priority:** Medium | **Traces to:** UG-002

The system SHALL allow organizers to promote attendees to organizer role.

#### Scenario: Promoting an attendee
- GIVEN an organizer viewing the attendee list
- WHEN they select an attendee and choose "Make Organizer"
- THEN the attendee SHALL receive organizer permissions immediately
- AND the attendee SHALL be notified of their new role
- AND the action SHALL be logged

#### Scenario: Organizer permissions
- GIVEN a user with organizer role for an event
- WHEN they access the event
- THEN they SHALL be able to:
  - Edit event details
  - View complete attendee list with contact info
  - Send invitations
  - Send mass communications
  - Manage the event questionnaire
  - Moderate wall posts
  - Promote/demote other organizers (except original creator)
  - Cancel the event

### REQ-EVT-007: Organizer Demotion
**Priority:** Medium | **Traces to:** UG-002

The system SHALL allow organizers to demote other organizers.

#### Scenario: Demoting an organizer
- GIVEN an organizer managing an event
- WHEN they demote another organizer
- THEN that user SHALL lose organizer permissions
- AND the user SHALL retain their RSVP status
- AND the user SHALL be notified

#### Scenario: Original creator protection
- GIVEN the original event creator
- WHEN any organizer attempts to demote them
- THEN the system SHALL prevent the demotion
- AND display an error message

### REQ-EVT-008: Event Editing
**Priority:** High | **Traces to:** US-EVT-003

The system SHALL allow organizers to edit event details after creation.

#### Scenario: Editing event details
- GIVEN an organizer viewing their event
- WHEN they edit event details
- THEN all editable fields SHALL be modifiable
- AND changes SHALL be saved immediately
- AND a change history MAY be recorded

#### Scenario: Significant change detection
- GIVEN an event with attendees
- WHEN the organizer changes date, time, or location
- THEN the system SHALL flag these as "significant changes"
- AND trigger notification requirements per REQ-EVT-016

### REQ-EVT-009: Event Cancellation
**Priority:** High | **Traces to:** US-EVT-004

The system SHALL allow organizers to cancel events.

#### Scenario: Cancelling an event
- GIVEN an organizer managing their event
- WHEN they choose to cancel the event
- THEN they SHALL be prompted to confirm with a warning
- AND they MAY provide a cancellation message (max 500 characters)
- AND all RSVP'd users SHALL be notified
- AND the event SHALL be marked as CANCELLED (not deleted)
- AND all active invite links SHALL be deactivated

## Event Lifecycle

### REQ-EVT-010: Event States
**Priority:** High | **Traces to:** US-EVT-001

The system SHALL track event state through its lifecycle.

#### Scenario: Event states
- GIVEN any event in the system
- WHEN its state is evaluated
- THEN it SHALL be in one of these states:
  - **DRAFT**: Event created but not yet published
  - **PUBLISHED**: Event is active and accepting RSVPs
  - **CLOSED**: RSVP deadline passed, no new RSVPs accepted
  - **ONGOING**: Event start time has passed, end time not reached
  - **COMPLETED**: Event end time has passed
  - **CANCELLED**: Event was cancelled by organizer

### REQ-EVT-011: Automatic State Transitions
**Priority:** High | **Traces to:** US-EVT-001

The system SHALL automatically transition events between states based on time.

#### Scenario: RSVP deadline transition
- GIVEN a published event with an RSVP deadline
- WHEN the RSVP deadline passes
- THEN the event SHALL transition to CLOSED state
- AND new RSVPs SHALL be blocked

#### Scenario: Event start transition
- GIVEN a PUBLISHED or CLOSED event
- WHEN the event start time passes
- THEN the event SHALL transition to ONGOING state

#### Scenario: Event completion transition
- GIVEN an ONGOING event
- WHEN the event end time passes
- THEN the event SHALL transition to COMPLETED state

#### Scenario: Default end time
- GIVEN an ONGOING event without an end time
- WHEN 3 hours after start time passes
- THEN the event SHALL transition to COMPLETED state

### REQ-EVT-012: RSVP Deadline Enforcement
**Priority:** High | **Traces to:** US-EVT-005

The system SHALL enforce RSVP deadlines.

#### Scenario: RSVP before deadline
- GIVEN an event with an RSVP deadline
- WHEN a user attempts to RSVP before the deadline
- THEN the RSVP SHALL be accepted

#### Scenario: RSVP after deadline
- GIVEN an event with a passed RSVP deadline
- WHEN a user attempts to RSVP
- THEN the system SHALL reject the RSVP
- AND display a message indicating the deadline has passed
- AND suggest contacting the organizer

### REQ-EVT-013: Capacity Management
**Priority:** Medium | **Traces to:** US-EVT-006

The system SHALL enforce event capacity limits.

#### Scenario: RSVP when under capacity
- GIVEN an event with capacity limit not reached
- WHEN a user RSVPs "Yes"
- THEN the RSVP SHALL be accepted

#### Scenario: RSVP when at capacity
- GIVEN an event at maximum capacity
- WHEN a new user attempts to RSVP "Yes"
- THEN they SHALL be informed the event is full
- AND they MAY be offered to join a waitlist (if enabled)

## Event Discovery

### REQ-EVT-014: User Event Dashboard
**Priority:** High | **Traces to:** US-EVT-007, UG-005

The system SHALL provide users with organized views of their events.

#### Scenario: Upcoming events view
- GIVEN an authenticated user
- WHEN they view their dashboard
- THEN they SHALL see lists of upcoming events:
  - **Organizing**: Events they created or are organizers of
  - **Attending**: Events they RSVP'd "Yes" to
  - **Pending Response**: Events they RSVP'd "Maybe" or haven't responded to
- AND events SHALL be sorted by date ascending

### REQ-EVT-015: Past Events View
**Priority:** Medium | **Traces to:** US-EVT-008

The system SHALL provide users with views of their past events.

#### Scenario: Past events view
- GIVEN an authenticated user
- WHEN they view their past events
- THEN they SHALL see separate lists for:
  - Past organized events (events they organized, COMPLETED or CANCELLED)
  - Past attended events (events they RSVP'd "Yes" to, COMPLETED)
- AND events SHALL be sorted by date descending

## Event Notifications

### REQ-EVT-016: Significant Change Notifications
**Priority:** High | **Traces to:** US-EVT-003

The system SHALL notify attendees of significant event changes.

#### Scenario: Change notification
- GIVEN an event with attendees
- WHEN the organizer changes date, time, or location
- THEN all users who RSVP'd (Yes, No, or Maybe) SHALL receive a notification
- AND the notification SHALL describe what changed
- AND they SHALL be prompted to reconfirm their RSVP

### REQ-EVT-017: RSVP Reconfirmation
**Priority:** Medium | **Traces to:** US-EVT-003

The system SHALL track RSVP reconfirmation needs.

#### Scenario: Reconfirmation required
- GIVEN a user who received a significant change notification
- WHEN they view the event
- THEN they SHALL see a prompt to reconfirm their RSVP
- AND submitting any RSVP response SHALL clear the reconfirmation flag

### REQ-EVT-018: Cancellation Notifications
**Priority:** High | **Traces to:** US-EVT-004

The system SHALL notify all participants when an event is cancelled.

#### Scenario: Cancellation notification
- GIVEN an organizer cancelling an event
- WHEN the cancellation is confirmed
- THEN all users who received invitations or RSVP'd SHALL be notified
- AND the notification SHALL include any cancellation message

### REQ-EVT-019: Event Search
**Priority:** Low | **Traces to:** UG-005

The system SHALL allow users to search their events.

#### Scenario: Searching events
- GIVEN an authenticated user
- WHEN they search their events
- THEN they SHALL be able to filter by:
  - Event title (text search)
  - Date range (start and end dates)
  - Event state (upcoming, past, cancelled)
  - Role (organizer, attendee)
- AND results SHALL be paginated

### REQ-EVT-020: Event Data Visibility
**Priority:** High | **Traces to:** REQ-CORE-001

The system SHALL control event data visibility based on user role.

#### Scenario: Public event data
- GIVEN any user viewing an event (via invite link)
- WHEN the event details are displayed
- THEN they SHALL see: title, description, date/time, location, organizer name

#### Scenario: Attendee event data
- GIVEN a user who RSVP'd "Yes"
- WHEN they view the event
- THEN they SHALL additionally see: attendee list (per privacy settings), event wall

#### Scenario: Organizer event data
- GIVEN an event organizer
- WHEN they view the event
- THEN they SHALL additionally see: full attendee contact info, RSVP statistics, all controls
