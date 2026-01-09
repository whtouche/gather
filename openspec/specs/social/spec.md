# Social Features Specification

## Purpose

This specification defines social features including viewing shared event history with other users and private note-taking on user profiles.

## Event Connections

### Requirement: Shared Event History

The system SHALL track and display users who have attended events together.

#### Scenario: Viewing connections list
- GIVEN an authenticated user
- WHEN they view their connections/contacts page
- THEN they SHALL see a list of users they have attended events with
- AND the list SHALL include:
  - User's display name
  - Profile photo (if set)
  - Number of shared events
  - Most recent shared event name and date

#### Scenario: Connection criteria
- GIVEN two users
- WHEN determining if they are "connected"
- THEN they SHALL be considered connected if:
  - Both RSVP'd "yes" to the same event
  - AND the event has reached "Completed" state
- AND connections SHALL only be visible to each other after event completion

### Requirement: Connection Details

The system SHALL provide detailed view of shared history with a connection.

#### Scenario: Viewing connection details
- GIVEN a user viewing a specific connection
- WHEN they access the connection details
- THEN they SHALL see:
  - The connected user's public profile information
  - List of all events attended together
  - Any private notes they've made about this user

#### Scenario: Connection filtering
- GIVEN a user with many connections
- WHEN they browse their connections
- THEN they SHALL be able to filter by:
  - Name search
  - Events attended together (specific event)
  - Date range of shared events
  - Has notes / No notes

### Requirement: Connection Sorting

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

### Requirement: Private Note Creation

The system SHALL allow users to create private notes on other users' profiles.

#### Scenario: Adding a private note
- GIVEN a user viewing another user's profile (a connection)
- WHEN they add a private note
- THEN the note SHALL be saved
- AND the note SHALL only be visible to the note creator
- AND the noted user SHALL NOT be notified or aware of the note

#### Scenario: Note content
- GIVEN a user creating a private note
- WHEN they compose the note
- THEN they SHALL be able to enter:
  - Text content (max 5000 characters)
  - Optional tags/labels for organization
- AND the note SHALL record creation timestamp

### Requirement: Private Note Privacy

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

### Requirement: Private Note Management

The system SHALL provide note management capabilities.

#### Scenario: Editing notes
- GIVEN a user with an existing note on a profile
- WHEN they edit the note
- THEN changes SHALL be saved
- AND edit timestamp SHALL be recorded
- AND original creation timestamp SHALL be preserved

#### Scenario: Deleting notes
- GIVEN a user with a note on a profile
- WHEN they delete the note
- THEN the note SHALL be permanently removed
- AND deletion SHALL not require confirmation for notes

#### Scenario: Viewing all notes
- GIVEN a user with multiple private notes
- WHEN they access their notes section
- THEN they SHALL see all their notes across all profiles
- AND notes SHALL be searchable by content
- AND notes SHALL be filterable by tag

## Profile Viewing

### Requirement: Profile Access for Connections

The system SHALL control profile access based on connection status.

#### Scenario: Viewing a connection's profile
- GIVEN a user viewing another user they are connected with
- WHEN they access the profile
- THEN they SHALL see:
  - Display name
  - Profile photo (if set)
  - Bio (if shared with attendees)
  - Shared events list
  - Option to add/view private notes

#### Scenario: Viewing a non-connection's profile
- GIVEN a user viewing another user they are not connected with
- WHEN they access the profile
- THEN they SHALL see limited information:
  - Display name
  - Profile photo (if set)
- AND they SHALL NOT see bio or detailed information
- AND they SHALL NOT be able to add private notes

### Requirement: Profile Privacy Controls

The system SHALL respect user privacy preferences when displaying profiles.

#### Scenario: Hidden profile
- GIVEN a user who has hidden their profile
- WHEN others attempt to view their profile
- THEN only their display name SHALL be visible
- AND they SHALL appear normally in attendee lists
- AND private notes can still be added about them

## Invitation Integration

### Requirement: Invite from Connections

The system SHALL integrate connections with the invitation system.

#### Scenario: Quick invite from connections
- GIVEN an organizer creating a new event
- WHEN they choose to invite from connections
- THEN they SHALL see their full connections list
- AND they SHALL be able to:
  - Select multiple connections
  - Filter by events attended together
  - Search by name or notes content
- AND selected connections SHALL receive invitations

#### Scenario: Connection invitation method
- GIVEN an organizer inviting connections
- WHEN invitations are sent
- THEN each user SHALL receive invitation via their preferred method:
  - Email if email is their primary contact
  - SMS if phone is their primary contact
- AND the organizer SHALL NOT see the recipient's contact details

### Requirement: Connection Suggestions

The system SHALL suggest connections to invite based on event history.

#### Scenario: Smart suggestions
- GIVEN an organizer inviting guests
- WHEN they view connection suggestions
- THEN the system SHALL suggest users who:
  - Have attended similar events (same category/type)
  - Were attendees at the organizer's previous events
  - Have been co-attendees at multiple events
- AND suggestions SHALL be ranked by relevance
