# Core System Specification

## Purpose

This specification defines the core architecture and privacy principles for a privacy-focused event planning application. The system enables users to create events, invite attendees, manage RSVPs, and communicate with event participants.

## Privacy Principles

### Requirement: Minimal Data Collection

The system SHALL collect only the minimum data necessary to provide the service. User data collection SHALL be limited to information explicitly required for core functionality.

#### Scenario: New user registration
- GIVEN a new user signing up
- WHEN they complete registration
- THEN only phone number and display name are stored as required fields
- AND all other profile fields remain optional

#### Scenario: Data access by other users
- GIVEN a user viewing another user's profile
- WHEN the profile is displayed
- THEN only information the profile owner has chosen to share SHALL be visible

### Requirement: Data Encryption

The system SHALL encrypt all sensitive data at rest and in transit.

#### Scenario: Data storage
- GIVEN any user data being persisted
- WHEN the data is written to storage
- THEN personal identifiable information (PII) SHALL be encrypted at rest

#### Scenario: Data transmission
- GIVEN any data being transmitted
- WHEN data moves between client and server
- THEN all transmissions SHALL use TLS 1.3 or higher

### Requirement: User Data Control

The system SHALL provide users with full control over their personal data.

#### Scenario: Data export
- GIVEN a user requesting their data
- WHEN they initiate a data export
- THEN the system SHALL queue the export and notify the user when ready

#### Scenario: Account deletion
- GIVEN a user requesting account deletion
- WHEN they confirm the deletion request
- THEN all personal data SHALL be permanently deleted after a grace period
- AND the user SHALL receive confirmation of deletion

### Requirement: No Third-Party Tracking

The system SHALL NOT include third-party tracking, analytics, or advertising scripts that collect user behavior data.

#### Scenario: Page load
- GIVEN any page in the application
- WHEN the page loads
- THEN no third-party tracking pixels or scripts SHALL execute

## System Roles

### Requirement: Role Definitions

The system SHALL support the following user roles with distinct permissions.

#### Scenario: Role hierarchy
- GIVEN the role system
- WHEN roles are evaluated
- THEN the following roles SHALL exist:
  - **User**: Base authenticated user
  - **Attendee**: User who has RSVP'd "yes" to an event
  - **Organizer**: User who created an event or was promoted to organizer

## Data Retention

### Requirement: Event Data Retention

The system SHALL retain event data according to defined retention policies.

#### Scenario: Past event data
- GIVEN an event that has concluded
- WHEN the configured retention period has passed
- THEN the organizer SHALL be notified about upcoming data archival
- AND after a grace period, event data MAY be archived or deleted per organizer preference

### Requirement: Message Retention

The system SHALL allow organizers to configure message retention for event walls.

#### Scenario: Wall message cleanup
- GIVEN an event with message retention configured
- WHEN the retention period expires
- THEN wall messages older than the retention period SHALL be automatically deleted
