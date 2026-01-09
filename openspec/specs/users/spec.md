# User Management Specification

## Purpose

This specification defines user registration, authentication, and profile management for the event planning application.

## Registration

### Requirement: Low-Barrier Registration

The system SHALL allow users to register with minimal required information to reduce friction.

#### Scenario: Standard registration
- GIVEN a new user visiting the registration page
- WHEN they submit the registration form
- THEN only phone number and display name SHALL be required
- AND the system SHALL send a verification code to the phone number

#### Scenario: Phone verification
- GIVEN a user who has submitted their phone number
- WHEN they enter the verification code
- THEN their account SHALL be created upon successful verification
- AND they SHALL be logged in automatically

### Requirement: Quick Registration for Invitees

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
- THEN the system SHALL send a verification link to their email
- AND upon clicking the link, their account SHALL be created

## Authentication

### Requirement: Passwordless Authentication

The system SHALL use passwordless authentication via one-time codes.

#### Scenario: Login flow
- GIVEN a returning user
- WHEN they enter their phone number or email
- THEN the system SHALL send a one-time verification code
- AND the code SHALL expire after a short period
- AND the code SHALL be invalidated after successful use

#### Scenario: Session management
- GIVEN an authenticated user
- WHEN they are logged in
- THEN their session SHALL remain active for a configured duration
- AND the session SHALL be invalidated on explicit logout

### Requirement: Multi-Device Support

The system SHALL allow users to be logged in on multiple devices simultaneously.

#### Scenario: New device login
- GIVEN a user logged in on one device
- WHEN they log in on another device
- THEN both sessions SHALL remain active
- AND the user SHALL be notified of the new login

#### Scenario: Session management view
- GIVEN an authenticated user
- WHEN they view their security settings
- THEN they SHALL see all active sessions
- AND they SHALL be able to revoke any session

## Profile Management

### Requirement: Optional Profile Information

The system SHALL allow users to optionally complete their profile with additional information.

#### Scenario: Profile fields
- GIVEN an authenticated user
- WHEN they edit their profile
- THEN the following optional fields SHALL be available:
  - Profile photo
  - Bio/description
  - Email address (if not used for registration)
  - Phone number (if not used for registration)
  - Location (city/region, not precise)
  - Social links (optional, user-defined)

#### Scenario: Profile visibility settings
- GIVEN a user editing their profile
- WHEN they configure visibility settings
- THEN they SHALL be able to set each optional field as:
  - Visible to all attendees of shared events
  - Visible only to organizers
  - Private (not visible to others)

### Requirement: Display Name Management

The system SHALL allow users to manage how their name appears to others.

#### Scenario: Name display
- GIVEN a user with a display name set
- WHEN other users view their profile or event participation
- THEN only the display name SHALL be shown
- AND the system SHALL NOT expose phone numbers or emails to other users by default

## Account Management

### Requirement: Account Deactivation

The system SHALL allow users to temporarily deactivate their account.

#### Scenario: Deactivation
- GIVEN an authenticated user
- WHEN they choose to deactivate their account
- THEN their profile SHALL be hidden from other users
- AND their event history SHALL be preserved
- AND they SHALL be able to reactivate by logging in

### Requirement: Account Deletion

The system SHALL allow users to permanently delete their account per privacy principles.

#### Scenario: Deletion request
- GIVEN an authenticated user
- WHEN they request account deletion
- THEN they SHALL receive a confirmation prompt
- AND upon confirmation, deletion SHALL be scheduled
- AND they SHALL have a grace period to cancel the deletion

#### Scenario: Deletion execution
- GIVEN a confirmed deletion request
- WHEN the grace period has passed without cancellation
- THEN all personal data SHALL be permanently deleted
- AND event participation records SHALL be anonymized
- AND wall posts SHALL be attributed to "Deleted User"
