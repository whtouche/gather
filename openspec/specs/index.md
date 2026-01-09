# Gather - Application Specifications

**Application Name:** Gather
**Version:** 1.0
**Last Updated:** January 2026

---

## Overview

Gather is a privacy-focused event planning web application that enables users to create events, invite attendees, manage RSVPs, and communicate with participants. The system prioritizes user privacy through minimal data collection, encryption, and user data control.

## Document Structure

### Master Requirements Document

**[Requirements Specification](./requirements.md)** - The comprehensive requirements document containing:
- Introduction, scope, and definitions
- Business goals, user goals, and success metrics
- User stories with acceptance criteria
- Non-functional requirements (performance, security, accessibility)
- Technical requirements and technology stack
- Design considerations
- Testing and QA strategy
- Deployment and release procedures
- Maintenance and support plan

### Domain Specifications

| Domain | Document | Requirements | Description |
|--------|----------|--------------|-------------|
| Core System | [core/spec.md](./core/spec.md) | REQ-CORE-001 to REQ-CORE-010 | Privacy principles, roles, data retention |
| User Management | [users/spec.md](./users/spec.md) | REQ-USER-001 to REQ-USER-015 | Registration, authentication, profiles |
| Events | [events/spec.md](./events/spec.md) | REQ-EVT-001 to REQ-EVT-020 | Event creation, lifecycle, discovery |
| Invitations & RSVP | [invitations/spec.md](./invitations/spec.md) | REQ-INV-001 to REQ-INV-025 | Invitations, RSVP, questionnaires |
| Messaging | [messaging/spec.md](./messaging/spec.md) | REQ-MSG-001 to REQ-MSG-018 | Event wall, mass communications |
| Social Features | [social/spec.md](./social/spec.md) | REQ-SOC-001 to REQ-SOC-012 | Connections, private notes |

**Total Requirements:** 100 functional requirements

### Implementation Roadmap

**[ROADMAP.md](../ROADMAP.md)** - Development phases and feature prioritization

---

## Quick Reference

### Core Entities

| Entity | Description |
|--------|-------------|
| **User** | Account holder with phone/email, display name, optional profile |
| **Event** | Gathering with title, description, date/time, location |
| **RSVP** | User response to event invitation (Yes/No/Maybe) |
| **InviteLink** | Shareable token-based invitation URL |
| **EmailInvitation** | Email-based invitation with tracking |
| **Notification** | System notification (event updates, RSVP changes) |
| **WallPost** | Message posted to event wall by attendee |
| **Questionnaire** | Custom questions for event RSVP |
| **QuestionnaireResponse** | User answers to questionnaire |
| **PrivateNote** | Personal notes on connections (private to creator) |
| **Connection** | Implicit relationship via shared event attendance |

### Role Model

| Role | Description | Key Permissions |
|------|-------------|-----------------|
| **User** | Base authenticated user | Create events, RSVP to events |
| **Attendee** | User who RSVP'd "Yes" | View wall, view attendee list |
| **Organizer** | Event creator or promoted user | Full event management |

### Event States

```
DRAFT → PUBLISHED → CLOSED → ONGOING → COMPLETED
                ↘ CANCELLED
```

| State | Description | RSVP Allowed |
|-------|-------------|--------------|
| DRAFT | Not yet published | No |
| PUBLISHED | Active, accepting RSVPs | Yes |
| CLOSED | RSVP deadline passed | No |
| ONGOING | Event in progress | No |
| COMPLETED | Event finished | No |
| CANCELLED | Cancelled by organizer | No |

---

## Privacy Principles

1. **Minimal Data Collection** (REQ-CORE-001): Only collect what's necessary
2. **Encryption** (REQ-CORE-002): All PII encrypted at rest (AES-256), TLS 1.3+ in transit
3. **User Control** (REQ-CORE-003): Export all data, delete account permanently
4. **No Tracking** (REQ-CORE-004): No third-party analytics or advertising
5. **Access Control** (REQ-INV-014, REQ-INV-015): Attendee lists only visible to confirmed attendees
6. **Private Notes** (REQ-SOC-008): Completely private, never exposed to noted user

---

## Technical Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, Vite, TypeScript, Tailwind CSS |
| Backend | Node.js 20 LTS, Express 4, TypeScript |
| Database | PostgreSQL 15, Prisma ORM |
| Cache | Redis 7 |
| External Services | Email (SendGrid/SES), SMS (Twilio/SNS) |

See [requirements.md Section 6](./requirements.md#6-technical-requirements) for full technical specifications.

---

## Key Metrics

| Metric | Target | Reference |
|--------|--------|-----------|
| Registration Conversion | > 60% | SM-001 |
| RSVP Response Rate | > 70% | SM-003 |
| API Response Time (p95) | < 300ms | REQ-PERF-002 |
| System Uptime | > 99.5% | REQ-REL-001 |
| WCAG Compliance | Level AA | REQ-ACC-001 |

---

## Document Conventions

### Requirement Format

All requirements follow this format:

```markdown
### REQ-[DOMAIN]-[NUMBER]: [Title]
**Priority:** High/Medium/Low | **Traces to:** [Related IDs]

[Description using RFC language (SHALL, SHOULD, MAY)]

#### Scenario: [Name]
- GIVEN [precondition]
- WHEN [action]
- THEN [expected outcome]
- AND [additional outcomes]
```

### Priority Levels

| Priority | Definition | Roadmap Groups |
|----------|------------|----------------|
| High | Core functionality | Groups A-C |
| Medium | Important features | Groups D-F |
| Low | Nice-to-have | Groups G-J |

### RFC Language

| Term | Meaning |
|------|---------|
| SHALL / MUST | Absolute requirement |
| SHOULD | Recommended |
| MAY | Optional |
| SHALL NOT | Absolute prohibition |

---

## Related Documents

- [Master Requirements](./requirements.md)
- [Implementation Roadmap](../ROADMAP.md)
- [Technical Configuration](../../CLAUDE.md)
