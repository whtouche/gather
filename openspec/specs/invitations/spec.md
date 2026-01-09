# Invitations & RSVP Specification

**Requirement Range:** REQ-INV-001 to REQ-INV-025

## Purpose

This specification defines the invitation system, RSVP functionality, and custom questionnaires for events.

## Invitation Methods

### REQ-INV-001: Shareable Invitation Link
**Priority:** High | **Traces to:** US-INV-001, SM-003

The system SHALL generate unique invitation links for events.

#### Scenario: Generating invitation link
- GIVEN an organizer viewing their published event
- WHEN they request an invitation link
- THEN a unique, secure link SHALL be generated
- AND the link SHALL use a 256-bit cryptographically random token
- AND the link SHALL be copyable to clipboard
- AND the link SHALL remain valid until the event is cancelled or completed

#### Scenario: Link security
- GIVEN an invitation link
- WHEN the link is accessed
- THEN it SHALL NOT expose event ID or user information in the URL path
- AND the token SHALL be the only identifier visible

### REQ-INV-002: Invitation Link Validation
**Priority:** High | **Traces to:** US-INV-001

The system SHALL validate invitation links before displaying event details.

#### Scenario: Valid link access
- GIVEN a valid invitation link
- WHEN a user accesses it
- THEN they SHALL see the event preview with:
  - Event title, description, date/time, location
  - Organizer display name
  - Current RSVP count (X attending)
  - Options to register/login and RSVP

#### Scenario: Invalid link access
- GIVEN an invalid or expired invitation link
- WHEN a user accesses it
- THEN they SHALL see an error message
- AND be offered to check if they have the correct link

### REQ-INV-003: Email Invitations
**Priority:** Medium | **Traces to:** US-INV-002, REQ-PERF-009

The system SHALL allow organizers to send invitations via email.

#### Scenario: Sending email invitation
- GIVEN an organizer inviting via email
- WHEN they enter one or more email addresses
- THEN the system SHALL send invitation emails within 30 seconds
- AND each email SHALL contain a unique invitation link
- AND the email SHALL include:
  - Event title in subject line
  - Event details (title, date, time, location, description excerpt)
  - Organizer name
  - Direct RSVP link

### REQ-INV-004: Email Invitation Tracking
**Priority:** Medium | **Traces to:** US-INV-004

The system SHALL track email invitation status.

#### Scenario: Viewing email invitation status
- GIVEN email invitations sent for an event
- WHEN the organizer views invitation status
- THEN they SHALL see for each invitation:
  - Email address (partially masked: jo***@example.com)
  - Recipient name (if provided)
  - Status: PENDING, SENT, OPENED, RSVPD, FAILED
  - Sent timestamp
  - RSVP response (if applicable)

### REQ-INV-005: SMS Invitations
**Priority:** Medium | **Traces to:** US-INV-003, REQ-PERF-010

The system SHALL allow organizers to send invitations via SMS.

#### Scenario: Sending SMS invitation
- GIVEN an organizer inviting via SMS
- WHEN they enter one or more phone numbers
- THEN the system SHALL send invitation text messages within 10 seconds
- AND each SMS SHALL contain:
  - Event title
  - Date and time
  - Shortened invitation link

#### Scenario: SMS character limit
- GIVEN an SMS invitation being composed
- WHEN the message is generated
- THEN it SHALL fit within 160 characters for single SMS
- OR use multi-part SMS if necessary

### REQ-INV-006: SMS Invitation Limits
**Priority:** Medium | **Traces to:** REQ-SEC-006

The system SHALL enforce limits on SMS invitations.

#### Scenario: Rate limiting
- GIVEN an organizer sending SMS invitations
- WHEN they attempt to send
- THEN the system SHALL enforce:
  - Maximum 100 SMS per event per day
  - Maximum 500 SMS per event total
- AND warn when approaching limits

### REQ-INV-007: Invitation Deduplication
**Priority:** Medium | **Traces to:** US-INV-002

The system SHALL prevent duplicate invitations to the same recipient.

#### Scenario: Duplicate prevention
- GIVEN an email/phone already invited to an event
- WHEN an organizer attempts to send another invitation
- THEN the system SHALL warn about the existing invitation
- AND offer to resend instead of creating a duplicate

## RSVP System

### REQ-INV-008: RSVP Options
**Priority:** High | **Traces to:** US-INV-005, SM-003

The system SHALL provide standard RSVP response options.

#### Scenario: RSVP submission
- GIVEN a user viewing an event invitation
- WHEN they respond to the invitation
- THEN they SHALL choose from:
  - **Yes** - Will attend
  - **No** - Will not attend
  - **Maybe** - Undecided
- AND their response SHALL be recorded with timestamp

### REQ-INV-009: RSVP for Authenticated Users
**Priority:** High | **Traces to:** US-INV-005

The system SHALL allow authenticated users to RSVP directly.

#### Scenario: Quick RSVP
- GIVEN an authenticated user viewing an event
- WHEN they click an RSVP option
- THEN their response SHALL be recorded immediately
- AND they SHALL see confirmation of their response
- AND the organizer SHALL be notified

### REQ-INV-010: RSVP for New Users
**Priority:** High | **Traces to:** US-AUTH-006, US-INV-005

The system SHALL guide new users through registration before RSVP.

#### Scenario: New user RSVP flow
- GIVEN a non-authenticated user clicking RSVP
- WHEN they select their response
- THEN they SHALL be prompted to register/login first
- AND after authentication, their RSVP SHALL be recorded automatically

### REQ-INV-011: RSVP Modification
**Priority:** High | **Traces to:** US-INV-006

The system SHALL allow users to change their RSVP before deadlines.

#### Scenario: Changing RSVP
- GIVEN a user who has previously RSVP'd
- WHEN they access the event before the RSVP deadline
- THEN they SHALL see their current response highlighted
- AND they SHALL be able to change their response
- AND the organizer SHALL be notified of the change

### REQ-INV-012: RSVP After Deadline
**Priority:** High | **Traces to:** REQ-EVT-012

The system SHALL prevent RSVP changes after deadline.

#### Scenario: RSVP blocked after deadline
- GIVEN an event with a passed RSVP deadline
- WHEN a user attempts to RSVP or change their RSVP
- THEN the system SHALL prevent the change
- AND display message: "RSVP deadline has passed. Contact the organizer if you need to make changes."

### REQ-INV-013: RSVP Change Notifications
**Priority:** Medium | **Traces to:** US-INV-006

The system SHALL notify organizers of RSVP changes.

#### Scenario: Organizer notification
- GIVEN a user changing their RSVP
- WHEN the change is submitted
- THEN all event organizers SHALL receive an in-app notification
- AND the notification SHALL show: user name, old response, new response

## Attendee Visibility

### REQ-INV-014: Attendee List for Confirmed Attendees
**Priority:** High | **Traces to:** UG-006

The system SHALL show attendee lists to confirmed attendees.

#### Scenario: Viewing attendee list as attendee
- GIVEN a user who has RSVP'd "Yes"
- WHEN they view the event attendee list
- THEN they SHALL see other users who RSVP'd "Yes"
- AND they SHALL see:
  - Display names only (not contact info)
  - Profile photos (if set)
  - Organizer badge (if applicable)

### REQ-INV-015: Attendee Privacy for Non-Attendees
**Priority:** High | **Traces to:** UG-007

The system SHALL protect attendee privacy from non-attendees.

#### Scenario: Attendee list for non-attendees
- GIVEN a user who has not RSVP'd or RSVP'd "No" or "Maybe"
- WHEN they attempt to view the attendee list
- THEN they SHALL NOT see individual attendees
- AND they SHALL see only aggregate count: "X attending"

### REQ-INV-016: Attendee List Privacy Settings
**Priority:** Medium | **Traces to:** REQ-EVT-003

The system SHALL respect event privacy settings for attendee visibility.

#### Scenario: Organizers-only attendee list
- GIVEN an event with attendee list set to "Organizers only"
- WHEN a non-organizer attendee views the event
- THEN they SHALL NOT see the attendee list
- AND they SHALL see only: "X attending"

## Capacity Management

### REQ-INV-017: Capacity Enforcement
**Priority:** Medium | **Traces to:** US-EVT-006

The system SHALL enforce event capacity limits on RSVPs.

#### Scenario: RSVP when at capacity
- GIVEN an event at maximum capacity
- WHEN a new user attempts to RSVP "Yes"
- THEN they SHALL be informed: "This event is at capacity"
- AND if waitlist is enabled, they SHALL be offered: "Join waitlist"

### REQ-INV-018: Waitlist Management
**Priority:** Low | **Traces to:** US-EVT-006

The system SHALL manage event waitlists.

#### Scenario: Joining waitlist
- GIVEN an event at capacity with waitlist enabled
- WHEN a user joins the waitlist
- THEN they SHALL be added with timestamp
- AND they SHALL see their position in queue

#### Scenario: Spot opens from waitlist
- GIVEN an event with waitlist and an attendee changing to "No"
- WHEN a spot opens
- THEN the first waitlisted user SHALL be notified
- AND they SHALL have 24 hours to confirm attendance
- AND if not confirmed, the next waitlisted user SHALL be notified

## Questionnaire System

### REQ-INV-019: Questionnaire Creation
**Priority:** Medium | **Traces to:** US-INV-007

The system SHALL allow organizers to create custom questionnaires.

#### Scenario: Creating a questionnaire
- GIVEN an organizer configuring their event
- WHEN they create a questionnaire
- THEN they SHALL be able to add questions with types:
  - Short text (single line, max 200 characters)
  - Long text (paragraph, max 2000 characters)
  - Single choice (radio buttons, 2-10 options)
  - Multiple choice (checkboxes, 2-10 options)
  - Yes/No (boolean)
  - Number (integer or decimal)
  - Date (date picker)

### REQ-INV-020: Question Configuration
**Priority:** Medium | **Traces to:** US-INV-007

The system SHALL allow detailed question configuration.

#### Scenario: Configuring a question
- GIVEN an organizer adding a question
- WHEN they configure the question
- THEN they SHALL specify:
  - Question text (required, max 500 characters)
  - Question type (required)
  - Required or optional (default: optional)
  - Help text (optional, max 200 characters)
  - For choice questions: list of options

### REQ-INV-021: Questionnaire Display
**Priority:** Medium | **Traces to:** US-INV-007

The system SHALL display questionnaires during RSVP.

#### Scenario: RSVP "Yes" with questionnaire
- GIVEN a user RSVP'ing "Yes" to an event with a questionnaire
- WHEN they submit their RSVP
- THEN they SHALL be presented with the questionnaire
- AND required questions SHALL be marked with asterisk
- AND they SHALL NOT complete RSVP until required questions are answered

#### Scenario: RSVP "Maybe" with questionnaire
- GIVEN a user RSVP'ing "Maybe" to an event with a questionnaire
- WHEN they submit their response
- THEN the questionnaire SHALL be optional
- AND they MAY skip or complete it

### REQ-INV-022: Questionnaire Response Storage
**Priority:** Medium | **Traces to:** US-INV-007

The system SHALL store questionnaire responses with RSVPs.

#### Scenario: Response storage
- GIVEN a user completing a questionnaire
- WHEN they submit their answers
- THEN responses SHALL be linked to their RSVP
- AND responses SHALL be editable until RSVP deadline

### REQ-INV-023: Response Management for Organizers
**Priority:** Medium | **Traces to:** UG-002

The system SHALL allow organizers to view and export responses.

#### Scenario: Viewing responses
- GIVEN an organizer viewing their event
- WHEN they access questionnaire responses
- THEN they SHALL see:
  - Summary statistics for each question
  - Individual responses grouped by question
  - Filter by attendee
  - List of attendees who haven't completed questionnaire

#### Scenario: Exporting responses
- GIVEN an organizer with questionnaire responses
- WHEN they export responses
- THEN they SHALL receive a CSV file with:
  - Attendee display name
  - RSVP status
  - All question responses
- AND the export SHALL NOT include contact info unless explicitly consented

### REQ-INV-024: Questionnaire Editing Restrictions
**Priority:** Low | **Traces to:** US-INV-007

The system SHALL restrict questionnaire editing after responses.

#### Scenario: Editing before responses
- GIVEN an event with no questionnaire responses yet
- WHEN the organizer edits the questionnaire
- THEN all changes SHALL be allowed

#### Scenario: Editing after responses
- GIVEN an event with existing questionnaire responses
- WHEN the organizer attempts to edit
- THEN they MAY add new optional questions
- AND they SHALL NOT delete questions with responses
- AND they SHALL NOT change question types
- AND they SHALL see warning about limitations

### REQ-INV-025: Invite from Previous Attendees
**Priority:** Low | **Traces to:** US-SOC-003

The system SHALL allow organizers to invite from previous event attendees.

#### Scenario: Viewing invitable contacts
- GIVEN an organizer creating a new event
- WHEN they choose to invite from history
- THEN they SHALL see a list of users from:
  - Events they previously organized
  - Events they attended
- AND the list SHALL show:
  - Display name
  - Last event attended together
  - Number of shared events

#### Scenario: Bulk invitation
- GIVEN an organizer selecting previous attendees
- WHEN they select multiple contacts and send invitations
- THEN invitations SHALL be sent via each user's registered contact method
- AND the organizer SHALL NOT see the recipient's contact details
