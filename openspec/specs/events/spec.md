# Events Specification

## Purpose

This specification defines event creation, management, and the event lifecycle for the event planning application.

## Event Creation

### Requirement: Event Required Fields

The system SHALL require specific fields when creating an event.

#### Scenario: Creating a new event
- GIVEN an authenticated user
- WHEN they create a new event
- THEN the following fields SHALL be required:
  - Title (text, max 200 characters)
  - Description (text, max 5000 characters)
  - Date and time (start datetime, timezone-aware)
  - Location (text description or address)
- AND the creating user SHALL automatically become the event organizer

#### Scenario: Event validation
- GIVEN a user submitting event creation form
- WHEN any required field is missing or invalid
- THEN the system SHALL display specific validation errors
- AND the event SHALL NOT be created

### Requirement: Event Optional Fields

The system SHALL support optional fields for events.

#### Scenario: Optional event details
- GIVEN a user creating or editing an event
- WHEN they configure optional fields
- THEN the following optional fields SHALL be available:
  - End date/time
  - Event image/banner
  - Capacity limit (max attendees)
  - RSVP deadline
  - Event category/type
  - Dress code
  - Additional notes

### Requirement: Event Privacy Settings

The system SHALL allow organizers to configure event privacy.

#### Scenario: Privacy configuration
- GIVEN an organizer creating or editing an event
- WHEN they configure privacy settings
- THEN the following options SHALL be available:
  - Attendee list visible to: All attendees / Organizers only
  - Event discoverable: Yes (via direct link) / No (invitation only)
  - Allow attendees to share invite link: Yes / No

## Event Management

### Requirement: Organizer Role Assignment

The system SHALL allow organizers to promote attendees to organizer role.

#### Scenario: Promoting an attendee
- GIVEN an organizer viewing the attendee list
- WHEN they select an attendee and choose "Make Organizer"
- THEN the attendee SHALL receive organizer permissions
- AND the attendee SHALL be notified of their new role

#### Scenario: Organizer permissions
- GIVEN a user with organizer role for an event
- WHEN they access the event
- THEN they SHALL be able to:
  - Edit event details
  - Manage attendee list
  - Send invitations
  - Send mass communications
  - Manage the event questionnaire
  - Moderate wall posts
  - Promote/demote other organizers (except original creator)

### Requirement: Event Editing

The system SHALL allow organizers to edit event details after creation.

#### Scenario: Editing event details
- GIVEN an organizer viewing their event
- WHEN they edit event details
- THEN all editable fields SHALL be modifiable
- AND attendees SHALL be notified of significant changes (date, time, location)

#### Scenario: Change notification
- GIVEN an event with attendees
- WHEN the organizer changes date, time, or location
- THEN all users who RSVP'd (yes, no, or maybe) SHALL receive a notification
- AND they SHALL be prompted to reconfirm their RSVP

### Requirement: Event Cancellation

The system SHALL allow organizers to cancel events.

#### Scenario: Cancelling an event
- GIVEN an organizer managing their event
- WHEN they choose to cancel the event
- THEN they SHALL be prompted to confirm
- AND they MAY provide a cancellation message
- AND all invited users SHALL be notified of the cancellation
- AND the event SHALL be marked as cancelled (not deleted)

## Event Lifecycle

### Requirement: Event States

The system SHALL track event state through its lifecycle.

#### Scenario: Event states
- GIVEN any event in the system
- WHEN its state is evaluated
- THEN it SHALL be in one of these states:
  - **Draft**: Event created but not yet published
  - **Published**: Event is active and accepting RSVPs
  - **Closed**: RSVP deadline passed, no new RSVPs accepted
  - **Ongoing**: Event start time has passed, end time not reached
  - **Completed**: Event end time has passed
  - **Cancelled**: Event was cancelled by organizer

### Requirement: Automatic State Transitions

The system SHALL automatically transition events between states.

#### Scenario: State transitions
- GIVEN a published event
- WHEN the RSVP deadline passes
- THEN the event SHALL transition to "Closed" state

- GIVEN a published or closed event
- WHEN the event start time passes
- THEN the event SHALL transition to "Ongoing" state

- GIVEN an ongoing event
- WHEN the event end time passes (or a default duration after start if no end time)
- THEN the event SHALL transition to "Completed" state

## Event Discovery

### Requirement: User Event Dashboard

The system SHALL provide users with organized views of their events.

#### Scenario: Upcoming events view
- GIVEN an authenticated user
- WHEN they view their dashboard
- THEN they SHALL see a list of upcoming events they are:
  - Organizing
  - Attending (RSVP yes)
  - Pending response (RSVP maybe or no response)
- AND events SHALL be sorted by date ascending

#### Scenario: Past events view
- GIVEN an authenticated user
- WHEN they view their past events
- THEN they SHALL see separate lists for:
  - Past attended events (RSVP yes, event completed)
  - Past organized events
- AND events SHALL be sorted by date descending

### Requirement: Event Search

The system SHALL allow users to search their events.

#### Scenario: Searching events
- GIVEN an authenticated user
- WHEN they search their events
- THEN they SHALL be able to filter by:
  - Event title
  - Date range
  - Event state (upcoming, past, cancelled)
  - Role (organizer, attendee)
