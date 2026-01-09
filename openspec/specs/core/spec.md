# Core System Specification

**Requirement Range:** REQ-CORE-001 to REQ-CORE-010

## Purpose

This specification defines the core architecture and privacy principles for a privacy-focused event planning application. The system enables users to create events, invite attendees, manage RSVPs, and communicate with event participants.

## Privacy Principles

### REQ-CORE-001: Minimal Data Collection
**Priority:** High | **Traces to:** BG-001, UG-007

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

### REQ-CORE-002: Data Encryption
**Priority:** High | **Traces to:** BG-001, REQ-SEC-001, REQ-SEC-002

The system SHALL encrypt all sensitive data at rest and in transit.

#### Scenario: Data storage
- GIVEN any user data being persisted
- WHEN the data is written to storage
- THEN personal identifiable information (PII) SHALL be encrypted at rest using AES-256

#### Scenario: Data transmission
- GIVEN any data being transmitted
- WHEN data moves between client and server
- THEN all transmissions SHALL use TLS 1.3 or higher

### REQ-CORE-003: User Data Control
**Priority:** High | **Traces to:** BG-001, UG-007, REQ-LEGAL-002, REQ-LEGAL-003

The system SHALL provide users with full control over their personal data.

#### Scenario: Data export
- GIVEN a user requesting their data
- WHEN they initiate a data export
- THEN the system SHALL queue the export and notify the user when ready
- AND the export SHALL include all personal data within 72 hours

#### Scenario: Account deletion
- GIVEN a user requesting account deletion
- WHEN they confirm the deletion request
- THEN all personal data SHALL be permanently deleted after a 14-day grace period
- AND the user SHALL receive confirmation of deletion

### REQ-CORE-004: No Third-Party Tracking
**Priority:** High | **Traces to:** BG-001

The system SHALL NOT include third-party tracking, analytics, or advertising scripts that collect user behavior data.

#### Scenario: Page load
- GIVEN any page in the application
- WHEN the page loads
- THEN no third-party tracking pixels or scripts SHALL execute
- AND no user data SHALL be sent to external analytics services

## System Roles

### REQ-CORE-005: Role Definitions
**Priority:** High | **Traces to:** UG-001, UG-004

The system SHALL support the following user roles with distinct permissions.

#### Scenario: Role hierarchy
- GIVEN the role system
- WHEN roles are evaluated
- THEN the following roles SHALL exist:
  - **User**: Base authenticated user who can create events and RSVP
  - **Attendee**: User who has RSVP'd "yes" to an event; can view wall and attendee list
  - **Organizer**: User who created an event or was promoted; can manage all event aspects

### REQ-CORE-006: Role Permissions Matrix
**Priority:** High | **Traces to:** REQ-SEC-003

The system SHALL enforce the following permissions by role:

| Permission | User | Attendee | Organizer |
|------------|------|----------|-----------|
| View event details | Yes | Yes | Yes |
| RSVP to event | Yes | Yes | Yes |
| View attendee list | No | Yes* | Yes |
| Post to event wall | No | Yes | Yes |
| Edit event details | No | No | Yes |
| Send invitations | No | No | Yes |
| Cancel event | No | No | Yes |
| Promote to organizer | No | No | Yes |

*Subject to event privacy settings

## Data Retention

### REQ-CORE-007: Event Data Retention
**Priority:** Medium | **Traces to:** REQ-LEGAL-001

The system SHALL retain event data according to defined retention policies.

#### Scenario: Past event data
- GIVEN an event that has concluded
- WHEN the configured retention period (default: 2 years) has passed
- THEN the organizer SHALL be notified 30 days before data archival
- AND after the grace period, event data MAY be archived or deleted per organizer preference

### REQ-CORE-008: Message Retention
**Priority:** Medium | **Traces to:** REQ-LEGAL-001

The system SHALL allow organizers to configure message retention for event walls.

#### Scenario: Wall message cleanup
- GIVEN an event with message retention configured
- WHEN the retention period expires
- THEN wall messages older than the retention period SHALL be automatically deleted
- AND users SHALL NOT be individually notified of message deletion

### REQ-CORE-009: Session Data Retention
**Priority:** Medium | **Traces to:** REQ-SEC-011

The system SHALL automatically clean up expired session data.

#### Scenario: Session cleanup
- GIVEN expired user sessions in the database
- WHEN the daily cleanup job runs
- THEN sessions older than 30 days past expiration SHALL be permanently deleted

### REQ-CORE-010: Audit Log Retention
**Priority:** Low | **Traces to:** REQ-SEC-012, REQ-LOG-004

The system SHALL retain audit logs for security and compliance purposes.

#### Scenario: Audit log retention
- GIVEN security-relevant actions (login, permission changes, data access)
- WHEN the action occurs
- THEN an audit log entry SHALL be created
- AND logs SHALL be retained for minimum 90 days
