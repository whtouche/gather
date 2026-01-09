# Messaging Specification

**Requirement Range:** REQ-MSG-001 to REQ-MSG-018

## Purpose

This specification defines the event message board (wall) functionality and mass communication features for organizers.

## Event Wall

### REQ-MSG-001: Wall Access Control
**Priority:** Medium | **Traces to:** US-COM-001, REQ-CORE-006

The system SHALL restrict wall access to confirmed attendees.

#### Scenario: Wall visibility for attendees
- GIVEN a user who has RSVP'd "Yes" to an event
- WHEN they view the event page
- THEN they SHALL see the event wall section
- AND they SHALL be able to read all wall posts

#### Scenario: Wall visibility for non-attendees
- GIVEN a user who has not RSVP'd or RSVP'd "No" or "Maybe"
- WHEN they view the event page
- THEN they SHALL NOT see the event wall
- AND they SHALL see message: "RSVP 'Yes' to access the event wall"

### REQ-MSG-002: Wall Posting
**Priority:** Medium | **Traces to:** US-COM-001

The system SHALL allow attendees to post messages to the event wall.

#### Scenario: Creating a wall post
- GIVEN an attendee viewing the event wall
- WHEN they submit a new post
- THEN the post SHALL appear at the top of the wall (newest first)
- AND the post SHALL display:
  - Author's display name
  - Author's profile photo (if set)
  - Post content
  - Timestamp (relative, e.g., "2 hours ago")
  - Organizer badge (if applicable)

### REQ-MSG-003: Post Content Constraints
**Priority:** Medium | **Traces to:** US-COM-001

The system SHALL enforce content constraints on wall posts.

#### Scenario: Post content types
- GIVEN an attendee creating a wall post
- WHEN they compose the message
- THEN they SHALL be able to include:
  - Plain text (required, 1-2000 characters)
  - A single image attachment (optional, JPEG/PNG, max 5MB)
  - A link (optional, with automatic preview generation)
- AND HTML/scripts SHALL be sanitized

### REQ-MSG-004: Wall Post Reactions
**Priority:** Low | **Traces to:** US-COM-002

The system SHALL support reactions on wall posts.

#### Scenario: Reacting to posts
- GIVEN an attendee viewing a wall post
- WHEN they react to the post
- THEN they SHALL be able to add a heart/like reaction
- AND the reaction count SHALL be displayed
- AND clicking again SHALL remove their reaction

### REQ-MSG-005: Wall Post Replies
**Priority:** Low | **Traces to:** US-COM-002

The system SHALL support replies to wall posts.

#### Scenario: Replying to posts
- GIVEN an attendee viewing a wall post
- WHEN they reply to the post
- THEN the reply SHALL be nested under the original post
- AND replies SHALL support text only (max 1000 characters)
- AND reply depth SHALL be limited to 2 levels (post → reply → reply)
- AND further replies SHALL be added at level 2

### REQ-MSG-006: Post Deletion by Author
**Priority:** Medium | **Traces to:** US-COM-001

The system SHALL allow authors to delete their own posts.

#### Scenario: Author deletion
- GIVEN a user who authored a wall post
- WHEN they delete their post
- THEN the post SHALL be removed from the wall
- AND any replies SHALL also be removed
- AND deletion SHALL not require confirmation

## Wall Moderation

### REQ-MSG-007: Organizer Post Deletion
**Priority:** Medium | **Traces to:** US-COM-004

The system SHALL provide moderation capabilities for organizers.

#### Scenario: Deleting inappropriate posts
- GIVEN an organizer viewing the event wall
- WHEN they delete a post
- THEN the post SHALL be removed from the wall
- AND the post author SHALL receive a notification
- AND a moderation log entry SHALL be created

### REQ-MSG-008: Post Pinning
**Priority:** Low | **Traces to:** US-COM-004

The system SHALL allow organizers to pin important posts.

#### Scenario: Pinning posts
- GIVEN an organizer viewing a post
- WHEN they pin the post
- THEN the post SHALL appear at the top of the wall (above other posts)
- AND the post SHALL be visually marked as pinned
- AND multiple posts MAY be pinned (sorted by pin time)

#### Scenario: Unpinning posts
- GIVEN an organizer viewing a pinned post
- WHEN they unpin the post
- THEN the post SHALL return to its chronological position

### REQ-MSG-009: Moderation Log
**Priority:** Low | **Traces to:** REQ-SEC-012

The system SHALL maintain a moderation log for accountability.

#### Scenario: Moderation logging
- GIVEN any moderation action (delete, pin, unpin)
- WHEN the action is performed
- THEN a log entry SHALL be created with:
  - Moderator (organizer) name
  - Action type
  - Target post/content
  - Timestamp
- AND logs SHALL be viewable by all organizers

## Wall Notifications

### REQ-MSG-010: Wall Activity Notifications
**Priority:** Low | **Traces to:** US-COM-005

The system SHALL notify users of wall activity.

#### Scenario: New post notifications
- GIVEN an event with wall activity
- WHEN a new post is created
- THEN attendees with wall notifications enabled SHALL receive notification
- AND notifications SHALL be batched (max 1 per hour per event)

#### Scenario: Reply notifications
- GIVEN a user whose post received a reply
- WHEN the reply is posted
- THEN the original poster SHALL receive a notification immediately

## Mass Communication

### REQ-MSG-011: Mass Email Communication
**Priority:** Medium | **Traces to:** US-COM-003

The system SHALL allow organizers to send mass emails to event participants.

#### Scenario: Composing mass email
- GIVEN an organizer managing their event
- WHEN they compose a mass email
- THEN they SHALL specify:
  - Subject line (required, max 200 characters)
  - Message body (required, rich text, max 10000 characters)
  - Target audience:
    - All RSVP'd users
    - Yes only
    - Maybe only
    - No only
    - Waitlist only

#### Scenario: Email delivery
- GIVEN a mass email being sent
- WHEN the email is delivered
- THEN it SHALL include:
  - "[Event Name]" prefix in subject
  - Message content from organizer
  - Link to view event in app
  - Unsubscribe link for future event emails

### REQ-MSG-012: Mass SMS Communication
**Priority:** Medium | **Traces to:** US-COM-003

The system SHALL allow organizers to send mass SMS to event participants.

#### Scenario: Composing mass SMS
- GIVEN an organizer managing their event
- WHEN they compose a mass SMS
- THEN they SHALL specify:
  - Message text (required, max 160 characters)
  - Target audience (same options as email)
- AND character count SHALL be displayed in real-time

#### Scenario: SMS opt-out
- GIVEN a user receiving event SMS
- WHEN they reply STOP
- THEN they SHALL be opted out of SMS for that event
- AND they SHALL continue to receive email communications
- AND organizers SHALL see opt-out status

### REQ-MSG-013: Communication Targeting
**Priority:** Medium | **Traces to:** US-COM-003

The system SHALL accurately target communications.

#### Scenario: Audience targeting
- GIVEN an organizer selecting a target audience
- WHEN they preview recipients
- THEN they SHALL see:
  - Count of recipients
  - Breakdown by contact method (email vs SMS)
- AND they SHALL be able to exclude specific users

### REQ-MSG-014: Communication Rate Limits
**Priority:** Medium | **Traces to:** REQ-SEC-006

The system SHALL enforce limits on mass communications.

#### Scenario: Rate limiting
- GIVEN an organizer sending mass communications
- WHEN they attempt to send
- THEN the system SHALL enforce:
  - Maximum 5 mass emails per event per week
  - Maximum 3 mass SMS per event per week
  - Minimum 24 hours between mass communications of same type

#### Scenario: Limit warnings
- GIVEN an organizer approaching communication limits
- WHEN they compose a new message
- THEN they SHALL see remaining quota
- AND they SHALL see warning when at 80% of limit

### REQ-MSG-015: Communication History
**Priority:** Medium | **Traces to:** US-COM-003

The system SHALL maintain a history of mass communications.

#### Scenario: Viewing communication history
- GIVEN an organizer managing their event
- WHEN they view communication history
- THEN they SHALL see:
  - All sent mass communications
  - Type (email/SMS)
  - Subject/preview
  - Send timestamp
  - Recipient count
  - Delivery statistics (sent, delivered, failed, opened for email)

## Notification Preferences

### REQ-MSG-016: Global Notification Settings
**Priority:** Medium | **Traces to:** US-COM-005

The system SHALL allow users to configure notification preferences.

#### Scenario: Global settings
- GIVEN an authenticated user
- WHEN they configure notification settings
- THEN they SHALL be able to toggle:
  - Email notifications (on/off, default: on)
  - SMS notifications (on/off, default: on)
  - Wall activity notifications (on/off, default: on)
  - New event notifications from connections (on/off, default: on)

### REQ-MSG-017: Per-Event Notification Settings
**Priority:** Low | **Traces to:** US-COM-005

The system SHALL allow event-specific notification settings.

#### Scenario: Per-event settings
- GIVEN a user who is an attendee of an event
- WHEN they configure event-specific settings
- THEN they SHALL be able to:
  - Mute all notifications for this event
  - Mute wall notifications only
- AND event mute SHALL override global settings

### REQ-MSG-018: Notification Delivery
**Priority:** High | **Traces to:** REQ-PERF-009, REQ-PERF-010

The system SHALL deliver notifications reliably.

#### Scenario: Notification delivery
- GIVEN a notification to be sent
- WHEN the notification is triggered
- THEN:
  - In-app notifications SHALL appear within 5 seconds
  - Email notifications SHALL be sent within 30 seconds
  - SMS notifications SHALL be sent within 10 seconds
- AND delivery failures SHALL be logged and retried
