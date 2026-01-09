# User Management Specification

**Requirement Range:** REQ-USER-001 to REQ-USER-015

## Purpose

This specification defines user registration, authentication, and profile management for the event planning application.

## Registration

### REQ-USER-001: Low-Barrier Registration
**Priority:** High | **Traces to:** UG-004, US-AUTH-001, SM-001

The system SHALL allow users to register with minimal required information to reduce friction.

#### Scenario: Standard registration
- GIVEN a new user visiting the registration page
- WHEN they submit the registration form
- THEN only phone number and display name SHALL be required
- AND the system SHALL send a verification code to the phone number within 5 seconds

#### Scenario: Phone verification
- GIVEN a user who has submitted their phone number
- WHEN they enter the verification code within 10 minutes
- THEN their account SHALL be created upon successful verification
- AND they SHALL be logged in automatically

### REQ-USER-002: Email Registration Option
**Priority:** High | **Traces to:** US-AUTH-002

The system SHALL allow users to register with email instead of phone number.

#### Scenario: Email registration
- GIVEN a new user preferring email registration
- WHEN they submit their email address and display name
- THEN the system SHALL send a verification code to the email
- AND the verification code SHALL expire after 10 minutes

### REQ-USER-003: Quick Registration for Invitees
**Priority:** High | **Traces to:** US-AUTH-006, SM-003

The system SHALL allow invited users to create accounts with minimal friction during the RSVP process.

#### Scenario: Registration via invitation link
- GIVEN a user clicking an event invitation link
- WHEN they do not have an existing account
- THEN they SHALL be prompted to create an account with:
  - Phone number OR email address (required)
  - Display name (required)
- AND upon verification, they SHALL be directed to the RSVP flow

#### Scenario: Email-based quick registration
- GIVEN an invited user choosing email registration
- WHEN they submit their email and display name
- THEN the system SHALL send a verification code to their email
- AND upon verification, their account SHALL be created and redirected to RSVP

### REQ-USER-004: Existing Account Detection
**Priority:** Medium | **Traces to:** US-AUTH-006

The system SHALL detect existing accounts during invite registration.

#### Scenario: Existing account detected
- GIVEN a user registering via invitation link
- WHEN the phone number or email matches an existing account
- THEN the system SHALL prompt the user to log in instead
- AND after login, they SHALL be directed to the RSVP flow

## Authentication

### REQ-USER-005: Passwordless Authentication
**Priority:** High | **Traces to:** US-AUTH-003, REQ-SEC-004, REQ-SEC-005

The system SHALL use passwordless authentication via one-time codes.

#### Scenario: Login flow
- GIVEN a returning user
- WHEN they enter their phone number or email
- THEN the system SHALL send a one-time verification code
- AND the code SHALL be 6 digits
- AND the code SHALL expire after 10 minutes
- AND the code SHALL be invalidated after successful use

#### Scenario: Invalid code handling
- GIVEN a user entering a verification code
- WHEN the code is incorrect or expired
- THEN the system SHALL display a clear error message
- AND the user MAY request a new code

### REQ-USER-006: Rate Limiting on Authentication
**Priority:** High | **Traces to:** REQ-SEC-006

The system SHALL rate limit authentication attempts to prevent abuse.

#### Scenario: Rate limiting
- GIVEN a user or IP address making login attempts
- WHEN more than 5 failed attempts occur in 15 minutes
- THEN further attempts SHALL be blocked for 15 minutes
- AND the user SHALL be informed of the lockout

### REQ-USER-007: Session Management
**Priority:** High | **Traces to:** US-AUTH-004, REQ-SEC-011

The system SHALL manage user sessions securely.

#### Scenario: Session creation
- GIVEN an authenticated user
- WHEN they complete login
- THEN a session token SHALL be created with 256-bit entropy
- AND the session SHALL be valid for 30 days by default
- AND the session SHALL include device information

#### Scenario: Session invalidation
- GIVEN an authenticated user
- WHEN they explicitly log out
- THEN the session SHALL be immediately invalidated
- AND the session token SHALL no longer be accepted

### REQ-USER-008: Multi-Device Support
**Priority:** Medium | **Traces to:** US-AUTH-005

The system SHALL allow users to be logged in on multiple devices simultaneously.

#### Scenario: New device login
- GIVEN a user logged in on one device
- WHEN they log in on another device
- THEN both sessions SHALL remain active
- AND the user MAY be notified of the new login (based on preferences)

#### Scenario: Session management view
- GIVEN an authenticated user
- WHEN they view their security settings
- THEN they SHALL see all active sessions with:
  - Device type/name
  - Last activity timestamp
  - Location (approximate, based on IP)
- AND they SHALL be able to revoke any session

## Profile Management

### REQ-USER-009: Required Profile Fields
**Priority:** High | **Traces to:** REQ-CORE-001

The system SHALL require only essential profile information.

#### Scenario: Required fields
- GIVEN any user account
- WHEN the profile is viewed
- THEN the following fields SHALL be present:
  - Display name (required, 1-100 characters)
  - Phone number OR email (at least one required)
- AND all other fields SHALL be optional

### REQ-USER-010: Optional Profile Information
**Priority:** Medium | **Traces to:** UG-007

The system SHALL allow users to optionally complete their profile with additional information.

#### Scenario: Optional profile fields
- GIVEN an authenticated user
- WHEN they edit their profile
- THEN the following optional fields SHALL be available:
  - Profile photo (JPEG/PNG, max 5MB)
  - Bio/description (max 500 characters)
  - Email address (if not used for registration)
  - Phone number (if not used for registration)
  - Location (city/region text, not precise coordinates)

### REQ-USER-011: Profile Visibility Settings
**Priority:** Medium | **Traces to:** UG-007, US-PRV-001

The system SHALL allow users to control profile field visibility.

#### Scenario: Profile visibility configuration
- GIVEN a user editing their profile
- WHEN they configure visibility settings
- THEN they SHALL be able to set each optional field as:
  - **Connections**: Visible to users they've attended events with
  - **Organizers Only**: Visible only to event organizers
  - **Private**: Not visible to others
- AND the default visibility SHALL be "Connections"

### REQ-USER-012: Display Name Management
**Priority:** High | **Traces to:** REQ-CORE-001

The system SHALL allow users to manage how their name appears to others.

#### Scenario: Name display
- GIVEN a user with a display name set
- WHEN other users view their profile or event participation
- THEN only the display name SHALL be shown
- AND the system SHALL NOT expose phone numbers or emails to other users

## Account Management

### REQ-USER-013: Account Deactivation
**Priority:** Medium | **Traces to:** US-PRV-003

The system SHALL allow users to temporarily deactivate their account.

#### Scenario: Deactivation
- GIVEN an authenticated user
- WHEN they choose to deactivate their account
- THEN their profile SHALL be hidden from other users
- AND their event history SHALL be preserved
- AND they SHALL be able to reactivate by logging in

### REQ-USER-014: Account Deletion Request
**Priority:** High | **Traces to:** US-PRV-003, REQ-LEGAL-003

The system SHALL allow users to permanently delete their account per privacy principles.

#### Scenario: Deletion request
- GIVEN an authenticated user
- WHEN they request account deletion
- THEN they SHALL receive a confirmation prompt warning of permanent deletion
- AND upon confirmation, deletion SHALL be scheduled for 14 days later
- AND they SHALL receive email/SMS confirmation

#### Scenario: Deletion cancellation
- GIVEN a user with pending deletion
- WHEN they log in within the 14-day grace period
- THEN they SHALL be prompted to cancel the deletion
- AND cancellation SHALL restore full account access

### REQ-USER-015: Account Deletion Execution
**Priority:** High | **Traces to:** REQ-LEGAL-003, REQ-CORE-003

The system SHALL execute account deletion completely.

#### Scenario: Deletion execution
- GIVEN a confirmed deletion request
- WHEN the 14-day grace period has passed without cancellation
- THEN all personal data SHALL be permanently deleted
- AND event participation records SHALL be anonymized to "Deleted User"
- AND wall posts SHALL be attributed to "Deleted User"
- AND the user SHALL receive final confirmation email
