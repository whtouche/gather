# Social Features Specification

**Requirement Range:** REQ-SOC-001 to REQ-SOC-012

## Purpose

This specification defines social features including viewing shared event history with other users and private note-taking on user profiles.

## Event Connections

### REQ-SOC-001: Shared Event History
**Priority:** Low | **Traces to:** US-SOC-001, UG-006

The system SHALL track and display users who have attended events together.

#### Scenario: Viewing connections list
- GIVEN an authenticated user
- WHEN they view their connections page
- THEN they SHALL see a list of users they have attended events with
- AND the list SHALL include:
  - User's display name
  - Profile photo (if set)
  - Number of shared events
  - Most recent shared event name and date

### REQ-SOC-002: Connection Criteria
**Priority:** Low | **Traces to:** US-SOC-001

The system SHALL define clear criteria for connections.

#### Scenario: Connection establishment
- GIVEN two users
- WHEN determining if they are "connected"
- THEN they SHALL be considered connected if:
  - Both RSVP'd "Yes" to the same event
  - AND the event has reached "Completed" state
- AND connections SHALL only be visible after event completion

### REQ-SOC-003: Connection Details
**Priority:** Low | **Traces to:** US-SOC-001

The system SHALL provide detailed view of shared history with a connection.

#### Scenario: Viewing connection details
- GIVEN a user viewing a specific connection
- WHEN they access the connection details
- THEN they SHALL see:
  - The connected user's public profile information
  - List of all events attended together (sorted by date descending)
  - Any private notes they've made about this user

### REQ-SOC-004: Connection Filtering
**Priority:** Low | **Traces to:** US-SOC-001

The system SHALL support filtering connections.

#### Scenario: Filtering connections
- GIVEN a user with many connections
- WHEN they filter their connections
- THEN they SHALL be able to filter by:
  - Name search (display name)
  - Specific event attended together
  - Date range of shared events
  - Has notes / No notes

### REQ-SOC-005: Connection Sorting
**Priority:** Low | **Traces to:** US-SOC-001

The system SHALL provide multiple ways to sort connections.

#### Scenario: Sorting options
- GIVEN a user viewing their connections
- WHEN they choose a sort option
- THEN they SHALL be able to sort by:
  - Most recent event together (default)
  - Most events together
  - Alphabetical by name
  - Recently added notes

## Private Notes

### REQ-SOC-006: Private Note Creation
**Priority:** Low | **Traces to:** US-SOC-002

The system SHALL allow users to create private notes on connections.

#### Scenario: Adding a private note
- GIVEN a user viewing a connection's profile
- WHEN they add a private note
- THEN the note SHALL be saved
- AND the note SHALL only be visible to the note creator
- AND the noted user SHALL NOT be notified or aware of the note

### REQ-SOC-007: Note Content
**Priority:** Low | **Traces to:** US-SOC-002

The system SHALL support structured note content.

#### Scenario: Note content
- GIVEN a user creating a private note
- WHEN they compose the note
- THEN they SHALL be able to enter:
  - Text content (required, 1-5000 characters)
  - Optional tags/labels (max 5 tags, max 30 characters each)
- AND the note SHALL record:
  - Creation timestamp
  - Last modified timestamp

### REQ-SOC-008: Private Note Privacy
**Priority:** High | **Traces to:** REQ-CORE-001, US-SOC-002

The system SHALL ensure private notes remain completely private.

#### Scenario: Note visibility
- GIVEN a user with private notes on profiles
- WHEN anyone else accesses the noted user's profile
- THEN the notes SHALL NOT be visible
- AND no indication of note existence SHALL be shown

#### Scenario: Note in data exports
- GIVEN a user requesting data export
- WHEN the export is generated
- THEN their own private notes SHALL be included
- AND notes others have made about them SHALL NOT be included
- AND the system SHALL NOT indicate if others have notes about them

### REQ-SOC-009: Private Note Management
**Priority:** Low | **Traces to:** US-SOC-002

The system SHALL provide note management capabilities.

#### Scenario: Editing notes
- GIVEN a user with an existing note on a profile
- WHEN they edit the note
- THEN changes SHALL be saved immediately
- AND last modified timestamp SHALL be updated
- AND original creation timestamp SHALL be preserved

#### Scenario: Deleting notes
- GIVEN a user with a note on a profile
- WHEN they delete the note
- THEN the note SHALL be permanently removed
- AND deletion SHALL not require confirmation

#### Scenario: Viewing all notes
- GIVEN a user with multiple private notes
- WHEN they access their notes section
- THEN they SHALL see all their notes across all profiles
- AND notes SHALL be searchable by content and tags
- AND notes SHALL be sortable by date or connection name

## Profile Viewing

### REQ-SOC-010: Profile Access for Connections
**Priority:** Low | **Traces to:** UG-006

The system SHALL control profile access based on connection status.

#### Scenario: Viewing a connection's profile
- GIVEN a user viewing another user they are connected with
- WHEN they access the profile
- THEN they SHALL see:
  - Display name
  - Profile photo (if set)
  - Bio (if shared with connections)
  - Location (if shared with connections)
  - Shared events list
  - Option to add/view private notes

#### Scenario: Viewing a non-connection's profile
- GIVEN a user viewing another user they are NOT connected with
- WHEN they access the profile
- THEN they SHALL see limited information:
  - Display name
  - Profile photo (if set)
- AND they SHALL NOT see bio, location, or detailed information
- AND they SHALL NOT be able to add private notes

### REQ-SOC-011: Profile Privacy Controls
**Priority:** Medium | **Traces to:** UG-007, US-PRV-001

The system SHALL respect user privacy preferences when displaying profiles.

#### Scenario: Hidden profile
- GIVEN a user who has hidden their profile
- WHEN others attempt to view their profile
- THEN only their display name SHALL be visible
- AND they SHALL appear normally in attendee lists
- AND private notes CAN still be added about them
- AND their profile photo SHALL NOT be visible

## Invitation Integration

### REQ-SOC-012: Invite from Connections
**Priority:** Low | **Traces to:** US-SOC-003, REQ-INV-025

The system SHALL integrate connections with the invitation system.

#### Scenario: Quick invite from connections
- GIVEN an organizer creating a new event
- WHEN they choose to invite from connections
- THEN they SHALL see their full connections list
- AND they SHALL be able to:
  - Select multiple connections with checkboxes
  - Filter by events attended together
  - Search by name or note content
- AND selected connections SHALL receive invitations via their preferred method

#### Scenario: Privacy in invitations
- GIVEN an organizer inviting connections
- WHEN invitations are sent
- THEN each user SHALL receive invitation via their registered contact method
- AND the organizer SHALL NOT see the recipient's email or phone number
