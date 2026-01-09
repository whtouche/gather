# Messaging Specification

## Purpose

This specification defines the event message board (wall) functionality and mass communication features for organizers.

## Event Wall

### Requirement: Wall Access Control

The system SHALL restrict wall access to confirmed attendees.

#### Scenario: Wall visibility for attendees
- GIVEN a user who has RSVP'd "yes" to an event
- WHEN they view the event page
- THEN they SHALL see the event wall
- AND they SHALL be able to read all wall posts

#### Scenario: Wall visibility for non-attendees
- GIVEN a user who has not RSVP'd or RSVP'd "no" or "maybe"
- WHEN they view the event page
- THEN they SHALL NOT see the event wall
- AND they SHALL see a message indicating wall access requires "yes" RSVP

### Requirement: Wall Posting

The system SHALL allow attendees to post messages to the event wall.

#### Scenario: Creating a wall post
- GIVEN an attendee viewing the event wall
- WHEN they submit a new post
- THEN the post SHALL appear on the wall
- AND the post SHALL display:
  - Author's display name
  - Post content
  - Timestamp
  - Author's role (organizer badge if applicable)

#### Scenario: Post content types
- GIVEN an attendee creating a wall post
- WHEN they compose the message
- THEN they SHALL be able to include:
  - Plain text (required, max 2000 characters)
  - A single image attachment (optional)
  - A link (optional, with preview)

### Requirement: Wall Post Interactions

The system SHALL support basic interactions with wall posts.

#### Scenario: Reacting to posts
- GIVEN an attendee viewing a wall post
- WHEN they react to the post
- THEN they SHALL be able to add a reaction (like/heart)
- AND the reaction count SHALL be displayed
- AND they SHALL be able to remove their reaction

#### Scenario: Replying to posts
- GIVEN an attendee viewing a wall post
- WHEN they reply to the post
- THEN the reply SHALL be nested under the original post
- AND replies SHALL support the same content types as posts
- AND reply depth SHALL be limited to 2 levels

### Requirement: Wall Moderation

The system SHALL provide moderation capabilities for organizers.

#### Scenario: Deleting inappropriate posts
- GIVEN an organizer viewing the event wall
- WHEN they delete a post
- THEN the post SHALL be removed from the wall
- AND the post author SHALL be notified
- AND a moderation log entry SHALL be created

#### Scenario: Pinning important posts
- GIVEN an organizer creating or viewing a post
- WHEN they pin the post
- THEN the post SHALL appear at the top of the wall
- AND the post SHALL be marked as pinned
- AND only organizers SHALL be able to pin/unpin posts

### Requirement: Wall Notifications

The system SHALL notify users of wall activity.

#### Scenario: New post notifications
- GIVEN an event with wall activity
- WHEN a new post is created
- THEN attendees with notifications enabled SHALL receive a notification
- AND the notification SHALL be batched (not real-time spam)

#### Scenario: Reply notifications
- GIVEN a user whose post received a reply
- WHEN the reply is posted
- THEN the original poster SHALL receive a notification

## Mass Communication

### Requirement: Mass Email Communication

The system SHALL allow organizers to send mass emails to event participants.

#### Scenario: Sending mass email
- GIVEN an organizer managing their event
- WHEN they compose a mass email
- THEN they SHALL specify:
  - Subject line
  - Message body (rich text)
  - Target audience (all RSVP'd, yes only, maybe only, etc.)
- AND the email SHALL be sent to all matching recipients

#### Scenario: Email content
- GIVEN a mass email being sent
- WHEN the email is delivered
- THEN it SHALL include:
  - Event name in subject prefix
  - Message content from organizer
  - Link to view event in app
  - Unsubscribe link for future event emails

### Requirement: Mass SMS Communication

The system SHALL allow organizers to send mass SMS to event participants.

#### Scenario: Sending mass SMS
- GIVEN an organizer managing their event
- WHEN they compose a mass SMS
- THEN they SHALL specify:
  - Message text (max 160 characters for single SMS)
  - Target audience
- AND the SMS SHALL be sent to recipients with phone numbers

#### Scenario: SMS opt-out
- GIVEN a user receiving event SMS
- WHEN they reply STOP
- THEN they SHALL be opted out of SMS for that event
- AND they SHALL continue to receive email communications

### Requirement: Communication Limits

The system SHALL enforce limits on mass communications to prevent spam.

#### Scenario: Rate limiting
- GIVEN an organizer sending mass communications
- WHEN they attempt to send
- THEN the system SHALL enforce configurable rate limits for:
  - Maximum mass emails per event
  - Maximum mass SMS per event
  - Minimum interval between mass communications

#### Scenario: Limit warnings
- GIVEN an organizer approaching communication limits
- WHEN they compose a new message
- THEN they SHALL see remaining quota
- AND they SHALL be warned if near the limit

### Requirement: Communication History

The system SHALL maintain a history of mass communications.

#### Scenario: Viewing communication history
- GIVEN an organizer managing their event
- WHEN they view communication history
- THEN they SHALL see:
  - All sent mass communications
  - Send timestamp
  - Recipient count
  - Delivery statistics (sent, delivered, failed)

## Notification Preferences

### Requirement: User Notification Settings

The system SHALL allow users to configure notification preferences.

#### Scenario: Global notification settings
- GIVEN an authenticated user
- WHEN they configure notification settings
- THEN they SHALL be able to toggle:
  - Email notifications (on/off)
  - SMS notifications (on/off)
  - Push notifications (on/off)
  - Wall activity notifications (on/off)

#### Scenario: Per-event notification settings
- GIVEN a user who is an attendee of an event
- WHEN they configure event-specific settings
- THEN they SHALL be able to mute notifications for that specific event
- AND this SHALL override global settings for that event only
