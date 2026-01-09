# Product Roadmap

> *"The best parties start with a simple invitation."*

This roadmap organizes features into parallel work groups. Each group contains features that can be built simultaneously by different agents or teams. Groups must be completed in sequence (A before B, B before C, etc.).

---

## Group A: The Foundation [DONE]
**Theme: "Let's get this party started"**

Everything starts here. These are the building blocks that make everything else possible.

### A1: Database & Core Infrastructure [DONE]
Set up the data layer and core architecture.
- Database schema for users, events, RSVPs
- API framework setup
- Environment configuration
- Basic error handling

### A2: User Authentication [DONE]
*Because you can't crash a party if nobody knows who you are.*
- Phone number registration with verification codes
- Email registration with verification links
- Passwordless login flow (magic codes)
- Session management
- Basic logout functionality

### A3: Event Creation (Basics) [DONE]
*The "what, when, where" of any good gathering.*
- Create event with required fields (title, description, date/time, location)
- Event validation
- Draft and Published states
- Automatic organizer role assignment
- View single event page

**Dependencies:** None - this is where it all begins!

---

## Group B: The Guest List [DONE]
**Theme: "You're invited!"**

Now that events exist, let's get people to them.

### B1: Shareable Invitation Links [DONE]
*The digital equivalent of a paper invite, but way easier to share.*
- Generate unique, secure invitation tokens
- Copy-to-clipboard functionality
- Link validation and access
- Event preview for link visitors

### B2: Basic RSVP System [DONE]
*Yes, No, Maybe - the eternal question.*
- RSVP response options (Yes / No / Maybe)
- Record responses with timestamps
- Change RSVP (before deadline)
- Organizer notification on RSVP changes

### B3: Quick Registration for Invitees [DONE]
*Frictionless onboarding for the "just here for the party" crowd.*
- Registration via invitation link flow
- Minimal fields (phone OR email + name)
- Direct to RSVP after verification
- Merge with existing account if found

### B4: User Dashboard (Basic) [DONE]
*Your party command center.*
- List of upcoming events (organizing)
- List of upcoming events (attending)
- List of events pending response
- Basic event cards with key info

**Dependencies:** Requires Group A complete

---

## Group C: The Party Gets Real [DONE]
**Theme: "Now we're cooking"**

The core experience takes shape. Multiple agents can tackle these in parallel.

### C1: Event Lifecycle Management [DONE]
*Events have seasons too.*
- All event states (Draft, Published, Closed, Ongoing, Completed, Cancelled)
- Automatic state transitions based on dates
- Event cancellation with notification
- RSVP deadline enforcement

### C2: Organizer Powers [DONE]
*With great power comes great party responsibility.*
- Edit event details
- Promote attendees to organizer
- View complete attendee list
- Demote organizers (except original creator)

### C3: Attendee List & Privacy [DONE]
*Who's coming? (Only if you're coming too.)*
- Attendee list visible only to confirmed attendees
- Display names only (no contact info exposed)
- Organizer badges on attendee list
- Aggregate count for non-attendees ("15 attending")

### C4: Event Change Notifications [DONE]
*Plans change. People should know.*
- Notify attendees of significant changes (date, time, location)
- Prompt to reconfirm RSVP after major changes
- Cancellation notifications

### C5: Past Events View [DONE]
*Remember that one party?*
- Past attended events list
- Past organized events list
- Sort by date descending
- Event history preservation

**Dependencies:** Requires Group B complete

---

## Group D: Communication Station [DONE]
**Theme: "Spread the word"**

Time to reach out and touch someone (digitally, of course).

### D1: Email Invitations [DONE]
*The fancy way to say "you're invited."*
- Send invitations via email
- Unique invitation link per recipient
- Event details in email body
- Track sent/opened/RSVP'd status

### D2: SMS Invitations [DONE]
*For when email feels too formal.*
- Send invitations via SMS
- Shortened invitation links
- Basic rate limiting
- SMS quota tracking

### D3: Profile Management [DONE]
*Express yourself (but only if you want to).*
- Optional profile fields (photo, bio, location)
- Profile visibility settings (per-field)
- Display name management
- View other users' public profiles

### D4: Event Privacy Settings [DONE]
*Your party, your rules.*
- Attendee list visibility control (all attendees vs organizers only)
- Discoverable vs invitation-only toggle
- Allow/disallow invite link sharing

**Dependencies:** Requires Group C complete

---

## Group E: The Wall
**Theme: "Let's chat"**

The social heart of every event.

### E1: Event Wall (Basic) [DONE]
*Where the pre-party conversation happens.*
- Wall access control (confirmed attendees only)
- Create text posts (max 2000 characters)
- Display posts with author, timestamp, role badge
- Chronological post feed

### E2: Wall Interactions [DONE]
*React, reply, repeat.*
- Like/heart reactions on posts
- Reply to posts (nested, 2-level max)
- Remove own reactions
- Post and reply count display

### E3: Wall Moderation
*Keep the vibes good.*
- Organizer delete posts capability
- Pin important posts to top
- Moderation log for accountability
- Author notification on deletion

### E4: Capacity & Waitlist
*Popular parties need crowd control.*
- Set maximum capacity on events
- Block RSVP when full
- Waitlist signup
- Auto-notify waitlist when spot opens

**Dependencies:** Requires Group D complete

---

## Group F: Organizer Superpowers
**Theme: "Level up your hosting game"**

Advanced tools for the discerning party planner.

### F1: Mass Email Communication
*Blast those updates.*
- Compose mass emails to attendees
- Target specific audiences (all, yes only, maybe only)
- Event name in subject prefix
- Unsubscribe link included
- Delivery statistics

### F2: Mass SMS Communication
*Quick hits for quick updates.*
- Compose mass SMS (160 char limit)
- Target specific audiences
- STOP opt-out handling
- Delivery tracking

### F3: Communication Rate Limits
*Don't be that host who over-communicates.*
- Configurable rate limits per event
- Limit warnings when approaching quota
- Communication history view
- Delivery stats dashboard

### F4: Invite from Previous Attendees
*Your party people rolodex.*
- View list of users from past events
- Filter by events attended together
- Bulk select and invite
- Send via preferred contact method

**Dependencies:** Requires Group E complete

---

## Group G: Custom Questions
**Theme: "Tell me more"**

Gather the info you need.

### G1: Questionnaire Builder
*Ask away.*
- Create custom questions for events
- Multiple question types (text, choice, yes/no, number, date)
- Mark questions required or optional
- Add help text to questions

### G2: Questionnaire During RSVP
*Capture responses when it counts.*
- Display questionnaire on "Yes" RSVP
- Required question enforcement
- Optional questionnaire for "Maybe" responses
- Save responses with RSVP

### G3: Response Management
*Make sense of all those answers.*
- View responses grouped by question
- Filter responses by attendee
- See who hasn't completed questionnaire
- CSV export of all responses

### G4: Questionnaire Editing
*Adapt as you go (with guardrails).*
- Full editing before any responses
- Add optional questions after responses
- Prevent deletion of answered questions
- Type change restrictions with warnings

**Dependencies:** Requires Group E complete (can run parallel with Group F)

---

## Group H: Social Layer
**Theme: "It's who you know"**

Build connections beyond single events.

### H1: Event Connections
*Your party people.*
- Track shared event attendance
- Connections list (people attended events with)
- Show number of shared events
- Most recent event together

### H2: Connection Details
*Deep dive on your connections.*
- View shared event history with someone
- Access public profile info
- Filter connections by event, date, name
- Sort by recency, frequency, alphabetical

### H3: Private Notes
*Your secret CRM for people.*
- Add private notes on any connection's profile
- Notes visible only to creator
- Edit and delete notes
- Search notes content

### H4: Invite from Connections
*Quick invite your regulars.*
- Browse connections when creating event
- Filter by shared events
- Search by name or note content
- Bulk invite selected connections

**Dependencies:** Requires Group F complete

---

## Group I: Polish & Delight
**Theme: "The finishing touches"**

The features that make people smile.

### I1: Notification Preferences
*You control the volume.*
- Global notification toggles (email, SMS, push)
- Per-event mute option
- Wall activity notification settings
- Notification batching for wall posts

### I2: Event Search & Filter
*Find that one party.*
- Search by event title
- Filter by date range
- Filter by state (upcoming, past, cancelled)
- Filter by role (organizer, attendee)

### I3: Multi-Device Sessions
*Party planning from anywhere.*
- View all active sessions
- New device login notifications
- Revoke individual sessions
- Session management UI

### I4: Account Management
*In case you need to peace out.*
- Account deactivation (temporary)
- Account deletion request with grace period
- Data export request
- Reactivation on login

**Dependencies:** Requires Group H complete

---

## Group J: Advanced & Future
**Theme: "Someday / Maybe"**

Nice-to-haves for when the core is solid.

### J1: Wall Media
*Pictures or it didn't happen.*
- Image attachments on posts
- Link previews
- Image storage and CDN
- Basic image moderation

### J2: Smart Suggestions
*AI-powered party planning.*
- Suggest connections based on event similarity
- Recommend people from previous events
- Relevance ranking for suggestions

### J3: Data Retention System
*Keep it tidy.*
- Configurable retention periods per event
- Organizer notification before archival
- Auto-archive/delete old data
- Wall message retention settings

### J4: Advanced Profile Privacy
*For the privacy maximalists.*
- Fully hidden profile option
- Granular field-level controls
- Still appear in attendee lists
- Profile hiding doesn't affect notes

**Dependencies:** Requires Group I complete

---

## Visual Dependency Map

```
Group A (Foundation)
    │
    ▼
Group B (Guest List)
    │
    ▼
Group C (Party Gets Real)
    │
    ▼
Group D (Communication)
    │
    ▼
Group E (The Wall)
    │
    ├──────────────┐
    ▼              ▼
Group F         Group G
(Organizer)     (Questions)
    │              │
    └──────┬───────┘
           ▼
       Group H (Social)
           │
           ▼
       Group I (Polish)
           │
           ▼
       Group J (Future)
```

---

## Parallel Work Summary

| Phase | Groups | Can Work In Parallel |
|-------|--------|---------------------|
| 1 | A | A1, A2, A3 (all parallel) |
| 2 | B | B1, B2, B3, B4 (all parallel) |
| 3 | C | C1, C2, C3, C4, C5 (all parallel) |
| 4 | D | D1, D2, D3, D4 (all parallel) |
| 5 | E | E1, E2, E3, E4 (all parallel) |
| 6 | F + G | All F and G items (all parallel) |
| 7 | H | H1, H2, H3, H4 (all parallel) |
| 8 | I | I1, I2, I3, I4 (all parallel) |
| 9 | J | J1, J2, J3, J4 (all parallel) |

---

## Quick Reference: Priority Levels

**Must Have (Groups A-C):**
The absolute minimum for a working product. Users can create events, invite people, and track RSVPs.

**Should Have (Groups D-F):**
Email/SMS invitations, event wall, and mass communication. This is where the app becomes genuinely useful.

**Nice to Have (Groups G-H):**
Questionnaires and social features. These differentiate the product and build stickiness.

**Future (Groups I-J):**
Polish, advanced features, and nice-to-haves. Build these when the core is rock solid.

---

*Remember: The goal isn't to build everything—it's to build something people love, one delightful feature at a time.*
