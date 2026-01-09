# Invitations & RSVP Specification

## Purpose

This specification defines the invitation system, RSVP functionality, and custom questionnaires for events.

## Invitation Methods

### Requirement: Shareable Invitation Link

The system SHALL generate unique invitation links for events.

#### Scenario: Generating invitation link
- GIVEN an organizer viewing their event
- WHEN they request an invitation link
- THEN a unique, secure link SHALL be generated
- AND the link SHALL be copyable to clipboard
- AND the link SHALL remain valid until the event is cancelled or completed

#### Scenario: Link security
- GIVEN an invitation link
- WHEN the link is accessed
- THEN it SHALL use a cryptographically random token
- AND the token SHALL NOT expose event ID or user information in the URL

### Requirement: In-App Invitations via Email

The system SHALL allow organizers to send invitations via email.

#### Scenario: Email invitation
- GIVEN an organizer inviting via email
- WHEN they enter one or more email addresses
- THEN the system SHALL send invitation emails
- AND each email SHALL contain a unique invitation link
- AND the email SHALL include event details (title, date, location)

#### Scenario: Email invitation tracking
- GIVEN email invitations sent for an event
- WHEN the organizer views invitation status
- THEN they SHALL see:
  - Email address (partially masked for privacy)
  - Sent timestamp
  - Status (sent, opened, RSVP'd)

### Requirement: In-App Invitations via SMS

The system SHALL allow organizers to send invitations via SMS/text message.

#### Scenario: SMS invitation
- GIVEN an organizer inviting via SMS
- WHEN they enter one or more phone numbers
- THEN the system SHALL send invitation text messages
- AND each SMS SHALL contain a shortened invitation link
- AND the SMS SHALL include event title and date

#### Scenario: SMS invitation limits
- GIVEN an organizer sending SMS invitations
- WHEN they attempt to send invitations
- THEN the system SHALL enforce reasonable rate limits
- AND the organizer SHALL be informed of remaining SMS quota

### Requirement: Invite from Previous Attendees

The system SHALL allow organizers to invite people from their event history.

#### Scenario: Viewing invitable contacts
- GIVEN an organizer creating a new event
- WHEN they choose to invite from history
- THEN they SHALL see a list of users they have:
  - Previously organized events for
  - Attended events with
- AND the list SHALL show display name and last event attended together

#### Scenario: Bulk invitation from history
- GIVEN an organizer selecting contacts from history
- WHEN they select multiple contacts and send invitations
- THEN invitations SHALL be sent via each user's preferred contact method
- AND the organizer SHALL see confirmation of invitations sent

## RSVP System

### Requirement: RSVP Options

The system SHALL provide standard RSVP response options.

#### Scenario: RSVP submission
- GIVEN a user viewing an event invitation
- WHEN they respond to the invitation
- THEN they SHALL choose from:
  - **Yes** - Will attend
  - **No** - Will not attend
  - **Maybe** - Undecided
- AND their response SHALL be recorded with timestamp

### Requirement: RSVP Modification

The system SHALL allow users to change their RSVP.

#### Scenario: Changing RSVP
- GIVEN a user who has previously RSVP'd
- WHEN they access the event before the RSVP deadline
- THEN they SHALL be able to change their response
- AND the organizer SHALL be notified of the change

#### Scenario: RSVP after deadline
- GIVEN an event with a passed RSVP deadline
- WHEN a user attempts to RSVP or change their RSVP
- THEN the system SHALL prevent the change
- AND the user SHALL be informed to contact the organizer

### Requirement: Attendee Visibility

The system SHALL control visibility of the attendee list based on RSVP status.

#### Scenario: Viewing attendee list as attendee
- GIVEN a user who has RSVP'd "yes"
- WHEN they view the event attendee list
- THEN they SHALL see other users who RSVP'd "yes"
- AND they SHALL see display names (not contact info)
- AND the list SHALL indicate organizers

#### Scenario: Attendee list privacy for non-attendees
- GIVEN a user who has not RSVP'd or RSVP'd "no" or "maybe"
- WHEN they attempt to view the attendee list
- THEN they SHALL NOT see individual attendees
- AND they MAY see aggregate count (e.g., "15 attending")

### Requirement: Capacity Management

The system SHALL enforce event capacity limits.

#### Scenario: RSVP when at capacity
- GIVEN an event at maximum capacity
- WHEN a new user attempts to RSVP "yes"
- THEN they SHALL be informed the event is full
- AND they SHALL be offered to join a waitlist (if enabled)

#### Scenario: Waitlist management
- GIVEN an event with a waitlist
- WHEN an attendee changes RSVP from "yes" to "no"
- THEN the first waitlisted user SHALL be notified
- AND they SHALL have a limited window to confirm attendance

## Questionnaire System

### Requirement: Custom Questionnaire Creation

The system SHALL allow organizers to create custom questionnaires for RSVP.

#### Scenario: Creating a questionnaire
- GIVEN an organizer configuring their event
- WHEN they create a questionnaire
- THEN they SHALL be able to add multiple questions
- AND each question SHALL have a configurable type:
  - Short text (single line)
  - Long text (paragraph)
  - Single choice (radio buttons)
  - Multiple choice (checkboxes)
  - Yes/No
  - Number
  - Date

#### Scenario: Question configuration
- GIVEN an organizer adding a question
- WHEN they configure the question
- THEN they SHALL specify:
  - Question text
  - Question type
  - Whether response is required or optional
  - Help text (optional)
  - For choice questions: list of options

### Requirement: Questionnaire Display

The system SHALL display the questionnaire during RSVP.

#### Scenario: RSVP with questionnaire
- GIVEN a user RSVP'ing "yes" to an event with a questionnaire
- WHEN they submit their RSVP
- THEN they SHALL be presented with the questionnaire
- AND required questions SHALL be clearly marked
- AND they SHALL not complete RSVP until required questions are answered

#### Scenario: Questionnaire for maybe responses
- GIVEN a user RSVP'ing "maybe" to an event with a questionnaire
- WHEN they submit their response
- THEN the questionnaire SHALL NOT be required
- AND they MAY optionally complete it

### Requirement: Questionnaire Response Management

The system SHALL allow organizers to view and export questionnaire responses.

#### Scenario: Viewing responses
- GIVEN an organizer viewing their event
- WHEN they access questionnaire responses
- THEN they SHALL see all responses grouped by question
- AND they SHALL be able to filter by attendee
- AND they SHALL see which attendees have not completed the questionnaire

#### Scenario: Exporting responses
- GIVEN an organizer with questionnaire responses
- WHEN they export responses
- THEN they SHALL receive a CSV file
- AND the file SHALL include attendee name and all responses
- AND the export SHALL respect privacy (no contact info unless user consented)

### Requirement: Questionnaire Editing

The system SHALL allow organizers to modify questionnaires with restrictions.

#### Scenario: Editing questionnaire before responses
- GIVEN an event with no questionnaire responses yet
- WHEN the organizer edits the questionnaire
- THEN all changes SHALL be allowed

#### Scenario: Editing questionnaire after responses
- GIVEN an event with existing questionnaire responses
- WHEN the organizer attempts to edit
- THEN they MAY add new optional questions
- AND they SHALL NOT delete questions with responses
- AND they SHALL NOT change question types
- AND they SHALL be warned about limitations
