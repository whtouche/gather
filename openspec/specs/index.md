# Event Planning App - OpenSpec Index

## Overview

A privacy-focused event planning application that enables users to create events, invite attendees, manage RSVPs, and communicate with participants. The system prioritizes user privacy through minimal data collection, encryption, and user data control.

## Specification Domains

### [Core System](./core/spec.md)
Defines system architecture, privacy principles, data retention policies, and role definitions.

**Key Requirements:**
- Minimal data collection
- Data encryption at rest and in transit
- User data export and deletion rights
- No third-party tracking

### [User Management](./users/spec.md)
Defines user registration, authentication, and profile management.

**Key Requirements:**
- Low-barrier registration (phone number + name only required)
- Passwordless authentication via one-time codes
- Optional profile completion
- Quick registration flow for invited users

### [Events](./events/spec.md)
Defines event creation, management, and lifecycle.

**Key Requirements:**
- Required fields: title, description, date/time, location
- Event states: Draft, Published, Closed, Ongoing, Completed, Cancelled
- Organizer role assignment and management
- User dashboard with upcoming, past attended, and past organized events

### [Invitations & RSVP](./invitations/spec.md)
Defines the invitation system, RSVP functionality, and custom questionnaires.

**Key Requirements:**
- Shareable invitation links
- In-app invitations via email or SMS
- RSVP options: Yes, No, Maybe
- Custom questionnaires with configurable required/optional questions
- Capacity management with optional waitlist
- Invite from previous event attendees

### [Messaging](./messaging/spec.md)
Defines event wall functionality and mass communication features.

**Key Requirements:**
- Event wall accessible only to confirmed attendees (RSVP yes)
- Post, reply, and react functionality
- Organizer moderation capabilities
- Mass email and SMS communication for organizers
- Communication rate limits to prevent spam

### [Social Features](./social/spec.md)
Defines connections (shared event history) and private notes.

**Key Requirements:**
- View list of users attended events with
- Private notes on user profiles (visible only to note creator)
- Quick invite from connections when creating new events
- Profile privacy controls

## Data Model Summary

### Core Entities
- **User**: Account holder with phone/email, display name, optional profile
- **Event**: Gathering with title, description, date/time, location
- **RSVP**: User response to event invitation (yes/no/maybe)
- **WallPost**: Message posted to event wall by attendee
- **Invitation**: Record of invitation sent via link/email/SMS
- **Questionnaire**: Custom questions for event RSVP
- **QuestionnaireResponse**: User answers to questionnaire
- **PrivateNote**: Personal notes on other users (private to creator)
- **Connection**: Implicit relationship via shared event attendance

### Role Model
- **User**: Base authenticated user
- **Attendee**: User who RSVP'd "yes" to an event
- **Organizer**: Event creator or promoted attendee with management permissions

## Privacy Principles

1. **Minimal Data Collection**: Only collect what's necessary
2. **Encryption**: All PII encrypted at rest, TLS 1.3+ in transit
3. **User Control**: Export all data, delete account permanently
4. **No Tracking**: No third-party analytics or advertising
5. **Access Control**: Attendee lists and walls only visible to confirmed attendees
6. **Private Notes**: Completely private, never exposed to noted user

## Technical Considerations

### Authentication
- Passwordless via SMS/email one-time codes
- Configurable session duration
- Multi-device support with session management

### Communication Services
- Email delivery service integration required
- SMS gateway integration required
- Rate limiting on mass communications
- Delivery tracking and statistics

### Scalability Considerations
- Event wall pagination for large events
- Connection list pagination for active users
- Background processing for mass communications
- Image storage and CDN for wall attachments
