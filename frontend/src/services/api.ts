const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

/**
 * API error type
 */
export interface ApiError {
  message: string;
  code?: string;
  statusCode: number;
}

/**
 * Check if an error is an API error
 */
export function isApiError(error: unknown): error is ApiError {
  return (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    "statusCode" in error
  );
}

/**
 * Make an API request
 */
async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  // Add auth token if available
  const token = localStorage.getItem("authToken");
  if (token) {
    (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const data = await response.json();

  if (!response.ok) {
    const error: ApiError = {
      message: data.message || "An error occurred",
      code: data.code,
      statusCode: response.status,
    };
    throw error;
  }

  return data;
}

/**
 * Event preview data from invitation link
 */
export interface EventPreview {
  id: string;
  title: string;
  description: string;
  dateTime: string;
  endDateTime: string | null;
  timezone: string;
  location: string;
  imageUrl: string | null;
  capacity: number | null;
  state: string;
  category: string | null;
  creator: {
    id: string;
    displayName: string;
    photoUrl: string | null;
  };
  attendeeCount: number;
}

/**
 * Invite link data
 */
export interface InviteLink {
  id: string;
  token: string;
  isActive: boolean;
  createdAt: string;
  expiresAt: string | null;
}

// =============================================================================
// Dashboard Types
// =============================================================================

/**
 * Base event data for dashboard cards
 */
export interface DashboardEvent {
  id: string;
  title: string;
  dateTime: string;
  endDateTime: string | null;
  timezone: string;
  location: string;
  state: string;
  imageUrl: string | null;
  category: string | null;
}

/**
 * Event data for events the user is organizing
 */
export interface OrganizingEvent extends DashboardEvent {
  rsvpCounts: {
    yes: number;
    no: number;
    maybe: number;
  };
}

/**
 * Event data for events the user is attending
 */
export interface AttendingEvent extends DashboardEvent {
  rsvpStatus: string;
  isOrganizer: boolean;
}

/**
 * Event data for events pending user response
 */
export interface PendingEvent extends DashboardEvent {
  rsvpStatus: string | null;
  isOrganizer: boolean;
}

/**
 * Dashboard response containing all event categories
 */
export interface DashboardResponse {
  organizing: OrganizingEvent[];
  attending: AttendingEvent[];
  pending: PendingEvent[];
}

/**
 * Past events dashboard response
 */
export interface PastDashboardResponse {
  pastOrganizing: OrganizingEvent[];
  pastAttending: AttendingEvent[];
}

/**
 * Validate an invitation token and get event preview
 */
export async function validateInviteToken(
  token: string
): Promise<{ valid: boolean; event: EventPreview }> {
  return request(`/invitations/${token}`);
}

/**
 * Generate a new invitation link for an event (organizers only)
 */
export async function generateInviteLink(
  eventId: string
): Promise<{ inviteLink: InviteLink }> {
  return request(`/events/${eventId}/invitations`, {
    method: "POST",
  });
}

// =============================================================================
// Dashboard API
// =============================================================================

/**
 * Get dashboard data for the authenticated user
 */
export async function getDashboard(): Promise<DashboardResponse> {
  return request("/dashboard");
}

/**
 * Get past events for the authenticated user
 */
export async function getPastEvents(): Promise<PastDashboardResponse> {
  return request("/dashboard/past");
}

/**
 * Search filters for events
 */
export interface EventSearchFilters {
  title?: string;
  startDate?: string;
  endDate?: string;
  state?: "upcoming" | "past" | "cancelled";
  role?: "organizer" | "attendee";
  page?: number;
  limit?: number;
}

/**
 * Event search result
 */
export interface SearchEvent extends DashboardEvent {
  isOrganizer: boolean;
  rsvpStatus: string | null;
  rsvpCounts?: {
    yes: number;
    no: number;
    maybe: number;
  };
}

/**
 * Event search response with pagination
 */
export interface EventSearchResponse {
  events: SearchEvent[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Search and filter events for the authenticated user
 */
export async function searchEvents(filters?: EventSearchFilters): Promise<EventSearchResponse> {
  const params = new URLSearchParams();

  if (filters?.title) params.append("title", filters.title);
  if (filters?.startDate) params.append("startDate", filters.startDate);
  if (filters?.endDate) params.append("endDate", filters.endDate);
  if (filters?.state) params.append("state", filters.state);
  if (filters?.role) params.append("role", filters.role);
  if (filters?.page) params.append("page", filters.page.toString());
  if (filters?.limit) params.append("limit", filters.limit.toString());

  const queryString = params.toString();
  return request(`/dashboard/search${queryString ? `?${queryString}` : ""}`);
}

// =============================================================================
// Invite Registration Types & API
// =============================================================================

/**
 * Profile visibility options
 */
export type ProfileVisibility = "CONNECTIONS" | "ORGANIZERS_ONLY" | "PRIVATE";

/**
 * User data returned from auth endpoints
 */
export interface User {
  id: string;
  phone: string | null;
  email: string | null;
  displayName: string;
  photoUrl?: string | null;
  bio?: string | null;
  location?: string | null;
  photoVisibility?: ProfileVisibility;
  bioVisibility?: ProfileVisibility;
  locationVisibility?: ProfileVisibility;
  createdAt: string;
  updatedAt?: string;
}

/**
 * Event info returned with invite registration
 */
export interface InviteEventInfo {
  id: string;
  title: string;
  dateTime: string;
  location: string;
}

/**
 * Response from invite registration start
 */
export interface InviteRegisterStartResponse {
  message: string;
  destination: string;
  existingUser: boolean;
  eventId: string;
  eventTitle: string;
}

/**
 * Response from invite registration verify
 */
export interface InviteRegisterVerifyResponse {
  user: User;
  token: string;
  expiresAt: string;
  isNewUser: boolean;
  event: InviteEventInfo;
}

/**
 * Start invite registration - send verification code
 */
export async function startInviteRegistration(data: {
  phone?: string;
  email?: string;
  displayName: string;
  inviteToken: string;
}): Promise<InviteRegisterStartResponse> {
  return request("/auth/register/invite/start", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/**
 * Verify invite registration - create account or log in
 */
export async function verifyInviteRegistration(data: {
  phone?: string;
  email?: string;
  code: string;
  displayName: string;
  inviteToken: string;
  deviceInfo?: string;
}): Promise<InviteRegisterVerifyResponse> {
  return request("/auth/register/invite/verify", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/**
 * Store auth token in localStorage
 */
export function setAuthToken(token: string): void {
  localStorage.setItem("authToken", token);
}

/**
 * Get auth token from localStorage
 */
export function getAuthToken(): string | null {
  return localStorage.getItem("authToken");
}

/**
 * Remove auth token from localStorage
 */
export function clearAuthToken(): void {
  localStorage.removeItem("authToken");
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  return !!getAuthToken();
}

// =============================================================================
// Login API Types & Functions
// =============================================================================

/**
 * Response from login start
 */
export interface LoginStartResponse {
  message: string;
  destination: string;
}

/**
 * Response from login verify
 */
export interface LoginVerifyResponse {
  user: User;
  token: string;
  expiresAt: string;
}

/**
 * Start login - send verification code to existing user
 */
export async function startLogin(data: {
  phone?: string;
  email?: string;
}): Promise<LoginStartResponse> {
  return request("/auth/login/start", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/**
 * Verify login - verify code and create session
 */
export async function verifyLogin(data: {
  phone?: string;
  email?: string;
  code: string;
  deviceInfo?: string;
}): Promise<LoginVerifyResponse> {
  return request("/auth/login/verify", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// =============================================================================
// Register API Types & Functions
// =============================================================================

/**
 * Response from register start
 */
export interface RegisterStartResponse {
  message: string;
  destination: string;
}

/**
 * Response from register verify
 */
export interface RegisterVerifyResponse {
  user: User;
  token: string;
  expiresAt: string;
}

/**
 * Start registration - send verification code
 */
export async function startRegistration(data: {
  phone?: string;
  email?: string;
  displayName: string;
}): Promise<RegisterStartResponse> {
  return request("/auth/register/start", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/**
 * Verify registration code and create account
 */
export async function verifyRegistration(data: {
  phone?: string;
  email?: string;
  code: string;
  displayName: string;
  deviceInfo?: string;
}): Promise<RegisterVerifyResponse> {
  return request("/auth/register/verify", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// =============================================================================
// Session Management Types & API
// =============================================================================

/**
 * Active session information
 */
export interface Session {
  id: string;
  deviceType: string | null;
  deviceName: string | null;
  location: string | null;
  ipAddress: string | null;
  lastActiveAt: string;
  createdAt: string;
  expiresAt: string;
  isCurrent: boolean;
}

/**
 * Response from GET /api/auth/sessions
 */
export interface SessionsResponse {
  sessions: Session[];
}

/**
 * Get all active sessions for the current user
 */
export async function getSessions(): Promise<SessionsResponse> {
  return request("/auth/sessions", {
    method: "GET",
  });
}

/**
 * Revoke a specific session
 */
export async function revokeSession(sessionId: string): Promise<{ message: string }> {
  return request(`/auth/sessions/${sessionId}`, {
    method: "DELETE",
  });
}

// =============================================================================
// Event Details Types & API
// =============================================================================

/**
 * Creator/organizer info for event details
 */
export interface EventUser {
  id: string;
  displayName: string;
  photoUrl: string | null;
}

/**
 * Full event details returned from GET /api/events/:id
 */
export interface EventDetails {
  id: string;
  title: string;
  description: string;
  dateTime: string;
  endDateTime: string | null;
  timezone: string;
  location: string;
  imageUrl: string | null;
  capacity: number | null;
  waitlistEnabled: boolean;
  rsvpDeadline: string | null;
  category: string | null;
  dressCode: string | null;
  notes: string | null;
  state: string;
  attendeeListVisibility: string;
  allowInviteSharing: boolean;
  creator: EventUser;
  organizers: EventUser[];
  rsvpCounts?: {
    yes: number;
    no: number;
    maybe: number;
  };
  userRsvp: string | null;
  needsReconfirmation?: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Response from GET /api/events/:id
 */
export interface EventDetailsResponse {
  event: EventDetails;
  isOrganizer: boolean;
}

/**
 * Get event details by ID
 */
export async function getEvent(eventId: string): Promise<EventDetailsResponse> {
  return request(`/events/${eventId}`);
}

/**
 * Create event input data
 */
export interface CreateEventInput {
  title: string;
  description: string;
  dateTime: string;
  location: string;
  endDateTime?: string;
  timezone?: string;
  imageUrl?: string;
  capacity?: number;
  waitlistEnabled?: boolean;
  rsvpDeadline?: string;
  category?: string;
  dressCode?: string;
  notes?: string;
  attendeeListVisibility?: "ATTENDEES_ONLY" | "ORGANIZERS_ONLY";
  allowInviteSharing?: boolean;
}

/**
 * Event returned from create endpoint
 */
export interface CreatedEvent {
  id: string;
  title: string;
  description: string;
  dateTime: string;
  endDateTime: string | null;
  timezone: string;
  location: string;
  imageUrl: string | null;
  capacity: number | null;
  waitlistEnabled: boolean;
  rsvpDeadline: string | null;
  category: string | null;
  dressCode: string | null;
  notes: string | null;
  state: string;
  attendeeListVisibility: string;
  allowInviteSharing: boolean;
  creatorId: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Response from create event endpoint
 */
export interface CreateEventResponse {
  event: CreatedEvent;
}

/**
 * Create a new event (requires authentication)
 */
export async function createEvent(
  data: CreateEventInput | Record<string, unknown>
): Promise<CreateEventResponse> {
  return request("/events", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/**
 * Publish a draft event (organizers only)
 */
export async function publishEvent(eventId: string): Promise<{ event: EventDetails; message: string }> {
  return request(`/events/${eventId}/publish`, {
    method: "POST",
  });
}

// =============================================================================
// Attendee List Types & API
// =============================================================================

/**
 * Attendee info returned from public attendee list endpoint
 */
export interface Attendee {
  id: string;
  displayName: string;
  photoUrl: string | null;
  isOrganizer: boolean;
}

/**
 * Response from GET /api/events/:id/attendees/public
 */
export interface AttendeesResponse {
  attendeeCount: number;
  canViewAttendees: boolean;
  attendees: Attendee[] | null;
}

/**
 * Get public attendee information for an event
 * Returns full attendee list if user has permission, otherwise just count
 */
export async function getEventAttendees(eventId: string): Promise<AttendeesResponse> {
  return request(`/events/${eventId}/attendees/public`);
}

// =============================================================================
// Organizer Management Types & API
// =============================================================================

/**
 * Full attendee info returned for organizers
 */
export interface OrganizerAttendee {
  id: string;
  displayName: string;
  photoUrl: string | null;
  email: string | null;
  phone: string | null;
  rsvpStatus: "YES" | "NO" | "MAYBE";
  rsvpDate: string;
  isOrganizer: boolean;
  isCreator: boolean;
}

/**
 * Response from GET /api/events/:id/attendees (organizers only)
 */
export interface OrganizerAttendeesResponse {
  attendees: OrganizerAttendee[];
  total: number;
  counts: {
    yes: number;
    no: number;
    maybe: number;
  };
}

/**
 * Get full attendee list for an event (organizers only)
 */
export async function getFullAttendeeList(eventId: string): Promise<OrganizerAttendeesResponse> {
  return request(`/events/${eventId}/attendees`);
}

/**
 * Promote a user to organizer (organizers only)
 */
export async function promoteToOrganizer(
  eventId: string,
  userId: string
): Promise<{ message: string; organizer: { id: string; displayName: string; photoUrl: string | null } }> {
  return request(`/events/${eventId}/organizers`, {
    method: "POST",
    body: JSON.stringify({ userId }),
  });
}

/**
 * Demote an organizer (organizers only, cannot demote creator)
 */
export async function demoteOrganizer(
  eventId: string,
  userId: string
): Promise<{ message: string }> {
  return request(`/events/${eventId}/organizers/${userId}`, {
    method: "DELETE",
  });
}

// =============================================================================
// Update Event Types & API
// =============================================================================

/**
 * Update event input data (all fields optional)
 */
export interface UpdateEventInput {
  title?: string;
  description?: string;
  dateTime?: string;
  endDateTime?: string | null;
  timezone?: string;
  location?: string;
  imageUrl?: string | null;
  capacity?: number | null;
  waitlistEnabled?: boolean;
  rsvpDeadline?: string | null;
  category?: string | null;
  dressCode?: string | null;
  notes?: string | null;
  attendeeListVisibility?: "ATTENDEES_ONLY" | "ORGANIZERS_ONLY";
  allowInviteSharing?: boolean;
}

/**
 * Update event details (organizers only)
 */
export async function updateEvent(
  eventId: string,
  data: UpdateEventInput
): Promise<{ event: CreatedEvent }> {
  return request(`/events/${eventId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

// =============================================================================
// Event Lifecycle Management Types & API
// =============================================================================

/**
 * Cancel event response type
 */
export interface CancelEventResponse {
  event: {
    id: string;
    title: string;
    description: string;
    dateTime: string;
    endDateTime: string | null;
    timezone: string;
    location: string;
    imageUrl: string | null;
    capacity: number | null;
    rsvpDeadline: string | null;
    category: string | null;
    dressCode: string | null;
    notes: string | null;
    state: string;
    attendeeListVisibility: string;
    allowInviteSharing: boolean;
    creatorId: string;
    createdAt: string;
    updatedAt: string;
  };
  message: string;
  notifiedCount: number;
}

/**
 * Cancel an event (organizers only)
 * @param eventId - The ID of the event to cancel
 * @param message - Optional cancellation message to send to attendees
 */
export async function cancelEvent(
  eventId: string,
  message?: string
): Promise<CancelEventResponse> {
  return request(`/events/${eventId}/cancel`, {
    method: "POST",
    body: JSON.stringify({ message }),
  });
}

/**
 * Event state response type
 */
export interface EventStateResponse {
  eventId: string;
  state: string;
  storedState: string;
  stateLabel: string;
  canAcceptRsvps: boolean;
  rsvpDeadlinePassed: boolean;
  rsvpDeadline: string | null;
  dateTime: string;
  endDateTime: string | null;
}

/**
 * Get the computed state of an event
 * @param eventId - The ID of the event
 */
export async function getEventState(eventId: string): Promise<EventStateResponse> {
  return request(`/events/${eventId}/state`);
}

// =============================================================================
// Notification Types & API
// =============================================================================

/**
 * Notification type enum
 */
export type NotificationType = "EVENT_UPDATED" | "EVENT_CANCELLED" | "RSVP_RECONFIRM" | "WAITLIST_SPOT_AVAILABLE";

/**
 * Notification object
 */
export interface Notification {
  id: string;
  type: NotificationType;
  message: string;
  read: boolean;
  eventId: string | null;
  event: {
    id: string;
    title: string;
    state: string;
  } | null;
  createdAt: string;
}

/**
 * Response from GET /api/notifications
 */
export interface NotificationsResponse {
  notifications: Notification[];
  unreadCount: number;
}

/**
 * Response from GET /api/notifications/unread-count
 */
export interface UnreadCountResponse {
  unreadCount: number;
}

/**
 * Get notifications for the authenticated user
 * @param unreadOnly - If true, only return unread notifications
 */
export async function getNotifications(unreadOnly = false): Promise<NotificationsResponse> {
  const query = unreadOnly ? "?unreadOnly=true" : "";
  return request(`/notifications${query}`);
}

/**
 * Get unread notification count
 */
export async function getUnreadNotificationCount(): Promise<UnreadCountResponse> {
  return request("/notifications/unread-count");
}

/**
 * Mark a notification as read
 */
export async function markNotificationRead(notificationId: string): Promise<{ notification: Notification }> {
  return request(`/notifications/${notificationId}`, {
    method: "PATCH",
    body: JSON.stringify({ read: true }),
  });
}

/**
 * Mark all notifications as read
 */
export async function markAllNotificationsRead(): Promise<{ message: string }> {
  return request("/notifications/mark-all-read", {
    method: "POST",
  });
}

/**
 * Delete a notification
 */
export async function deleteNotification(notificationId: string): Promise<{ message: string }> {
  return request(`/notifications/${notificationId}`, {
    method: "DELETE",
  });
}

// =============================================================================
// Email Invitation Types & API
// =============================================================================

/**
 * Email invitation status enum
 */
export type EmailInvitationStatus = "PENDING" | "SENT" | "OPENED" | "RSVPD" | "FAILED";

/**
 * Email invitation recipient
 */
export interface EmailInvitationRecipient {
  email: string;
  name?: string;
}

/**
 * Email invitation send result for a single recipient
 */
export interface EmailInvitationSendResult {
  email: string;
  success: boolean;
  error?: string;
  alreadyInvited?: boolean;
}

/**
 * Response from sending email invitations
 */
export interface SendEmailInvitationsResponse {
  message: string;
  sent: number;
  failed: number;
  alreadyInvited: number;
  results: EmailInvitationSendResult[];
}

/**
 * Email invitation record
 */
export interface EmailInvitation {
  id: string;
  email: string;
  recipientName: string | null;
  status: EmailInvitationStatus;
  sentAt: string | null;
  openedAt: string | null;
  rsvpAt: string | null;
  createdAt: string;
}

/**
 * Email invitation statistics
 */
export interface EmailInvitationStats {
  total: number;
  pending: number;
  sent: number;
  opened: number;
  rsvpd: number;
  failed: number;
}

/**
 * Response from getting email invitations
 */
export interface GetEmailInvitationsResponse {
  invitations: EmailInvitation[];
  stats: EmailInvitationStats;
}

/**
 * Send email invitations to one or more recipients (organizers only)
 */
export async function sendEmailInvitations(
  eventId: string,
  recipients: EmailInvitationRecipient[]
): Promise<SendEmailInvitationsResponse> {
  return request(`/events/${eventId}/invitations/email`, {
    method: "POST",
    body: JSON.stringify({ recipients }),
  });
}

/**
 * Get email invitation list and stats for an event (organizers only)
 */
export async function getEmailInvitations(eventId: string): Promise<GetEmailInvitationsResponse> {
  return request(`/events/${eventId}/invitations/email`);
}

// =============================================================================
// SMS Invitation Types & API
// =============================================================================

/**
 * SMS invitation status enum
 */
export type SmsInvitationStatus = "PENDING" | "SENT" | "RSVPD" | "FAILED";

/**
 * SMS invitation recipient
 */
export interface SmsInvitationRecipient {
  phone: string;
  name?: string;
}

/**
 * SMS invitation send result for a single recipient
 */
export interface SmsInvitationSendResult {
  phone: string;
  success: boolean;
  error?: string;
  alreadyInvited?: boolean;
}

/**
 * SMS quota information
 */
export interface SmsQuotaInfo {
  dailyCount: number;
  dailyLimit: number;
  dailyRemaining: number;
  totalCount: number;
  totalLimit: number;
  totalRemaining: number;
  atDailyLimit: boolean;
  atTotalLimit: boolean;
}

/**
 * Response from sending SMS invitations
 */
export interface SendSmsInvitationsResponse {
  message: string;
  sent: number;
  failed: number;
  alreadyInvited: number;
  results: SmsInvitationSendResult[];
  quota: SmsQuotaInfo;
}

/**
 * SMS invitation record
 */
export interface SmsInvitation {
  id: string;
  phone: string;
  recipientName: string | null;
  status: SmsInvitationStatus;
  sentAt: string | null;
  rsvpAt: string | null;
  createdAt: string;
}

/**
 * SMS invitation statistics
 */
export interface SmsInvitationStats {
  total: number;
  pending: number;
  sent: number;
  rsvpd: number;
  failed: number;
}

/**
 * Response from getting SMS invitations
 */
export interface GetSmsInvitationsResponse {
  invitations: SmsInvitation[];
  stats: SmsInvitationStats;
  quota: SmsQuotaInfo;
}

/**
 * Send SMS invitations to one or more recipients (organizers only)
 */
export async function sendSmsInvitations(
  eventId: string,
  recipients: SmsInvitationRecipient[]
): Promise<SendSmsInvitationsResponse> {
  return request(`/events/${eventId}/invitations/sms`, {
    method: "POST",
    body: JSON.stringify({ recipients }),
  });
}

/**
 * Get SMS invitation list and stats for an event (organizers only)
 */
export async function getSmsInvitations(eventId: string): Promise<GetSmsInvitationsResponse> {
  return request(`/events/${eventId}/invitations/sms`);
}

/**
 * Get SMS quota info for an event (organizers only)
 */
export async function getSmsQuota(eventId: string): Promise<{ quota: SmsQuotaInfo }> {
  return request(`/events/${eventId}/invitations/sms/quota`);
}

// =============================================================================
// Mass Email Communication Types & API
// =============================================================================

/**
 * Target audience for mass communications
 */
export type TargetAudience = "ALL" | "YES_ONLY" | "MAYBE_ONLY" | "NO_ONLY" | "WAITLIST_ONLY";

/**
 * Mass email quota information
 */
export interface MassEmailQuota {
  used: number;
  limit: number;
  remaining: number;
  canSendNow: boolean;
  nextSendAllowed?: string;
  approachingLimit: boolean;
  atLimit: boolean;
}

/**
 * Recipient preview for mass email
 */
export interface MassEmailRecipientPreview {
  displayName: string;
  email: string;
}

/**
 * Response from GET /api/events/:id/messages/email/preview
 */
export interface MassEmailPreviewResponse {
  count: number;
  preview: MassEmailRecipientPreview[];
  hasMore: boolean;
}

/**
 * Response from POST /api/events/:id/messages/email
 */
export interface SendMassEmailResponse {
  message: string;
  id: string;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  quota: MassEmailQuota;
}

/**
 * Mass email history record
 */
export interface MassEmailRecord {
  id: string;
  subject: string | null;
  body: string;
  targetAudience: string;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  openedCount: number;
  sentAt: string;
  organizer: {
    id: string;
    displayName: string;
  };
}

/**
 * Response from GET /api/events/:id/messages/email/history
 */
export interface MassEmailHistoryResponse {
  messages: MassEmailRecord[];
  total: number;
}

/**
 * Mass email recipient details
 */
export interface MassEmailRecipientDetail {
  userId: string;
  displayName: string;
  email: string;
  status: string;
  sentAt: string | null;
  openedAt: string | null;
}

/**
 * Mass email details
 */
export interface MassEmailDetails {
  id: string;
  subject: string | null;
  body: string;
  targetAudience: string;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  openedCount: number;
  sentAt: string;
  recipients: MassEmailRecipientDetail[];
}

/**
 * Get mass email quota for an event (organizers only)
 */
export async function getMassEmailQuota(eventId: string): Promise<{ quota: MassEmailQuota }> {
  return request(`/events/${eventId}/messages/email/quota`);
}

/**
 * Preview recipients for a mass email (organizers only)
 */
export async function previewMassEmailRecipients(
  eventId: string,
  audience: TargetAudience
): Promise<MassEmailPreviewResponse> {
  return request(`/events/${eventId}/messages/email/preview?audience=${audience}`);
}

/**
 * Send a mass email to event attendees (organizers only)
 */
export async function sendMassEmail(
  eventId: string,
  data: { subject: string; body: string; targetAudience: TargetAudience }
): Promise<SendMassEmailResponse> {
  return request(`/events/${eventId}/messages/email`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/**
 * Get mass email history for an event (organizers only)
 */
export async function getMassEmailHistory(
  eventId: string,
  limit?: number,
  offset?: number
): Promise<MassEmailHistoryResponse> {
  const params = new URLSearchParams();
  if (limit) params.set("limit", String(limit));
  if (offset) params.set("offset", String(offset));
  const query = params.toString() ? `?${params.toString()}` : "";
  return request(`/events/${eventId}/messages/email/history${query}`);
}

/**
 * Get details of a specific mass email (organizers only)
 */
export async function getMassEmailDetails(
  eventId: string,
  messageId: string
): Promise<MassEmailDetails> {
  return request(`/events/${eventId}/messages/email/${messageId}`);
}

// =============================================================================
// Mass SMS Communication Types & API
// =============================================================================

/**
 * Mass SMS quota information
 */
export interface MassSmsQuota {
  used: number;
  limit: number;
  remaining: number;
  canSendNow: boolean;
  nextSendAllowed?: string;
  approachingLimit: boolean;
  atLimit: boolean;
}

/**
 * Recipient preview for mass SMS
 */
export interface MassSmsRecipientPreview {
  displayName: string;
  phone: string;
}

/**
 * Response from GET /api/events/:id/messages/sms/preview
 */
export interface MassSmsPreviewResponse {
  count: number;
  optedOutCount: number;
  preview: MassSmsRecipientPreview[];
  hasMore: boolean;
}

/**
 * Response from POST /api/events/:id/messages/sms
 */
export interface SendMassSmsResponse {
  message: string;
  id: string;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  optedOutCount: number;
  quota: MassSmsQuota;
}

/**
 * Mass SMS history record
 */
export interface MassSmsRecord {
  id: string;
  body: string;
  targetAudience: string;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  sentAt: string;
  organizer: {
    id: string;
    displayName: string;
  };
}

/**
 * Response from GET /api/events/:id/messages/sms/history
 */
export interface MassSmsHistoryResponse {
  messages: MassSmsRecord[];
  total: number;
}

/**
 * Mass SMS recipient details
 */
export interface MassSmsRecipientDetail {
  userId: string;
  displayName: string;
  phone: string;
  status: string;
  sentAt: string | null;
}

/**
 * Mass SMS details
 */
export interface MassSmsDetails {
  id: string;
  body: string;
  targetAudience: string;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  sentAt: string;
  recipients: MassSmsRecipientDetail[];
}

/**
 * Get mass SMS quota for an event (organizers only)
 */
export async function getMassSmsQuota(eventId: string): Promise<{ quota: MassSmsQuota }> {
  return request(`/events/${eventId}/messages/sms/quota`);
}

/**
 * Preview recipients for a mass SMS (organizers only)
 */
export async function previewMassSmsRecipients(
  eventId: string,
  audience: TargetAudience
): Promise<MassSmsPreviewResponse> {
  return request(`/events/${eventId}/messages/sms/preview?audience=${audience}`);
}

/**
 * Send a mass SMS to event attendees (organizers only)
 */
export async function sendMassSms(
  eventId: string,
  data: { message: string; targetAudience: TargetAudience }
): Promise<SendMassSmsResponse> {
  return request(`/events/${eventId}/messages/sms`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/**
 * Get mass SMS history for an event (organizers only)
 */
export async function getMassSmsHistory(
  eventId: string,
  limit?: number,
  offset?: number
): Promise<MassSmsHistoryResponse> {
  const params = new URLSearchParams();
  if (limit) params.set("limit", String(limit));
  if (offset) params.set("offset", String(offset));
  const query = params.toString() ? `?${params.toString()}` : "";
  return request(`/events/${eventId}/messages/sms/history${query}`);
}

/**
 * Get details of a specific mass SMS (organizers only)
 */
export async function getMassSmsDetails(
  eventId: string,
  messageId: string
): Promise<MassSmsDetails> {
  return request(`/events/${eventId}/messages/sms/${messageId}`);
}

/**
 * Opt out of SMS for an event
 */
export async function optOutOfEventSms(eventId: string): Promise<{ message: string }> {
  return request(`/events/${eventId}/messages/sms/opt-out`, {
    method: "POST",
  });
}

// =============================================================================
// Profile Types & API
// =============================================================================

/**
 * Full user profile with visibility settings
 */
export interface UserProfile {
  id: string;
  phone: string | null;
  email: string | null;
  displayName: string;
  photoUrl: string | null;
  bio: string | null;
  location: string | null;
  photoVisibility: ProfileVisibility;
  bioVisibility: ProfileVisibility;
  locationVisibility: ProfileVisibility;
  emailNotifications: boolean;
  smsNotifications: boolean;
  wallActivityNotifications: boolean;
  connectionEventNotifications: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Response from GET /api/profile
 */
export interface GetProfileResponse {
  profile: UserProfile;
}

/**
 * Update profile input data
 */
export interface UpdateProfileInput {
  displayName?: string;
  photoUrl?: string | null;
  bio?: string | null;
  location?: string | null;
  photoVisibility?: ProfileVisibility;
  bioVisibility?: ProfileVisibility;
  locationVisibility?: ProfileVisibility;
  emailNotifications?: boolean;
  smsNotifications?: boolean;
  wallActivityNotifications?: boolean;
  connectionEventNotifications?: boolean;
}

/**
 * Response from PATCH /api/profile
 */
export interface UpdateProfileResponse {
  profile: UserProfile;
}

/**
 * Public user profile (visibility-filtered)
 */
export interface PublicUserProfile {
  id: string;
  displayName: string;
  photoUrl?: string | null;
  bio?: string | null;
  location?: string | null;
}

/**
 * Response from GET /api/users/:id
 */
export interface GetPublicProfileResponse {
  user: PublicUserProfile;
  relationship: {
    isSelf: boolean;
    isConnection: boolean;
    isOrganizer: boolean;
  };
}

/**
 * Get current user's profile
 */
export async function getProfile(): Promise<GetProfileResponse> {
  return request("/profile");
}

/**
 * Update current user's profile
 */
export async function updateProfile(data: UpdateProfileInput): Promise<UpdateProfileResponse> {
  return request("/profile", {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

/**
 * Get a user's public profile
 */
export async function getPublicProfile(userId: string): Promise<GetPublicProfileResponse> {
  return request(`/users/${userId}`);
}

/**
 * Get current user data (alias for /auth/me)
 */
export async function getCurrentUser(): Promise<{ user: User }> {
  return request("/auth/me");
}

// =============================================================================
// Notification Preferences Types & API
// =============================================================================

/**
 * Per-event notification settings
 */
export interface EventNotificationSettings {
  eventId: string;
  muteAll: boolean;
  muteWallOnly: boolean;
}

/**
 * Response from GET /api/profile/events/:eventId/notifications
 */
export interface GetEventNotificationSettingsResponse {
  settings: EventNotificationSettings;
}

/**
 * Update event notification settings input
 */
export interface UpdateEventNotificationSettingsInput {
  muteAll?: boolean;
  muteWallOnly?: boolean;
}

/**
 * Response from PATCH /api/profile/events/:eventId/notifications
 */
export interface UpdateEventNotificationSettingsResponse {
  settings: EventNotificationSettings;
}

/**
 * Get notification settings for a specific event
 */
export async function getEventNotificationSettings(
  eventId: string
): Promise<GetEventNotificationSettingsResponse> {
  return request(`/profile/events/${eventId}/notifications`);
}

/**
 * Update notification settings for a specific event
 */
export async function updateEventNotificationSettings(
  eventId: string,
  data: UpdateEventNotificationSettingsInput
): Promise<UpdateEventNotificationSettingsResponse> {
  return request(`/profile/events/${eventId}/notifications`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

// =============================================================================
// Event Wall Types & API
// =============================================================================

/**
 * Wall post author info
 */
export interface WallPostAuthor {
  id: string;
  displayName: string;
  photoUrl: string | null;
  isOrganizer: boolean;
}

/**
 * Wall reply (nested under posts)
 */
export interface WallReply {
  id: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  author: WallPostAuthor;
  reactionCount: number;
  userHasReacted: boolean;
  replies?: WallReply[];
  replyCount?: number;
}

/**
 * Wall post
 */
export interface WallPost {
  id: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  isPinned: boolean;
  pinnedAt: string | null;
  author: WallPostAuthor;
  reactionCount: number;
  userHasReacted: boolean;
  replyCount: number;
  replies: WallReply[];
}

/**
 * Response from GET /api/events/:id/wall
 */
export interface GetWallPostsResponse {
  canAccessWall: boolean;
  message?: string;
  posts: WallPost[] | null;
}

/**
 * Response from POST /api/events/:id/wall
 */
export interface CreateWallPostResponse {
  post: WallPost;
}

/**
 * Get wall posts for an event (confirmed attendees only)
 */
export async function getWallPosts(eventId: string): Promise<GetWallPostsResponse> {
  return request(`/events/${eventId}/wall`);
}

/**
 * Create a new wall post or reply (confirmed attendees only)
 * @param parentId - Optional parent post ID for replies
 */
export async function createWallPost(
  eventId: string,
  content: string,
  parentId?: string
): Promise<CreateWallPostResponse> {
  return request(`/events/${eventId}/wall`, {
    method: "POST",
    body: JSON.stringify({ content, parentId }),
  });
}

/**
 * Delete a wall post (author or organizer)
 */
export async function deleteWallPost(
  eventId: string,
  postId: string
): Promise<{ message: string; moderatorDeleted: boolean }> {
  return request(`/events/${eventId}/wall/${postId}`, {
    method: "DELETE",
  });
}

/**
 * Response from adding a reaction
 */
export interface AddReactionResponse {
  reaction: {
    id: string;
    type: string;
    createdAt: string;
  };
  reactionCount: number;
  userHasReacted: boolean;
}

/**
 * Response from removing a reaction
 */
export interface RemoveReactionResponse {
  message: string;
  reactionCount: number;
  userHasReacted: boolean;
}

/**
 * Add a reaction to a wall post (confirmed attendees only)
 */
export async function addReaction(eventId: string, postId: string): Promise<AddReactionResponse> {
  return request(`/events/${eventId}/wall/${postId}/reactions`, {
    method: "POST",
  });
}

/**
 * Remove own reaction from a wall post (confirmed attendees only)
 */
export async function removeReaction(eventId: string, postId: string): Promise<RemoveReactionResponse> {
  return request(`/events/${eventId}/wall/${postId}/reactions`, {
    method: "DELETE",
  });
}

/**
 * Response from pinning a post
 */
export interface PinPostResponse {
  message: string;
  isPinned: boolean;
  pinnedAt: string | null;
}

/**
 * Pin a wall post (organizers only)
 */
export async function pinWallPost(eventId: string, postId: string): Promise<PinPostResponse> {
  return request(`/events/${eventId}/wall/${postId}/pin`, {
    method: "POST",
  });
}

/**
 * Unpin a wall post (organizers only)
 */
export async function unpinWallPost(eventId: string, postId: string): Promise<PinPostResponse> {
  return request(`/events/${eventId}/wall/${postId}/pin`, {
    method: "DELETE",
  });
}

/**
 * Moderation log entry
 */
export interface ModerationLogEntry {
  id: string;
  action: "DELETE" | "PIN" | "UNPIN";
  moderator: {
    id: string;
    displayName: string;
  };
  targetPostId: string | null;
  postContent: string | null;
  postAuthor: {
    id: string;
    displayName: string;
  } | null;
  createdAt: string;
}

/**
 * Response from getting moderation log
 */
export interface GetModerationLogResponse {
  logs: ModerationLogEntry[];
}

/**
 * Get moderation log for an event (organizers only)
 */
export async function getModerationLog(eventId: string): Promise<GetModerationLogResponse> {
  return request(`/events/${eventId}/wall/moderation-log`);
}

// =============================================================================
// Waitlist Types & API
// =============================================================================

/**
 * Waitlist entry info
 */
export interface WaitlistEntry {
  id: string;
  position: number | null;
  totalWaitlist?: number;
  createdAt: string;
  notifiedAt: string | null;
  expiresAt: string | null;
}

/**
 * Response from GET /api/events/:id/waitlist
 */
export interface WaitlistStatusResponse {
  onWaitlist: boolean;
  waitlist: WaitlistEntry | null;
  waitlistEnabled: boolean;
  capacity: number | null;
}

/**
 * Response from POST /api/events/:id/waitlist
 */
export interface JoinWaitlistResponse {
  message: string;
  waitlist: {
    id: string;
    position: number | null;
    createdAt: string;
  };
}

/**
 * Get user's waitlist status for an event
 */
export async function getWaitlistStatus(eventId: string): Promise<WaitlistStatusResponse> {
  return request(`/events/${eventId}/waitlist`);
}

/**
 * Join the waitlist for an event
 */
export async function joinWaitlist(eventId: string): Promise<JoinWaitlistResponse> {
  return request(`/events/${eventId}/waitlist`, {
    method: "POST",
  });
}

/**
 * Leave the waitlist for an event
 */
export async function leaveWaitlist(eventId: string): Promise<{ message: string }> {
  return request(`/events/${eventId}/waitlist`, {
    method: "DELETE",
  });
}

/**
 * Confirm attendance from waitlist notification
 */
export async function confirmWaitlistSpot(eventId: string): Promise<{ message: string; rsvp: { eventId: string; userId: string; response: string } }> {
  return request(`/events/${eventId}/waitlist/confirm`, {
    method: "POST",
  });
}

// =============================================================================
// Previous Attendees Types & API
// =============================================================================

/**
 * Previous attendee information
 */
export interface PreviousAttendee {
  userId: string;
  displayName: string;
  photoUrl: string | null;
  email: string | null;
  phone: string | null;
  hasEmail: boolean;
  hasPhone: boolean;
  lastEventId: string;
  lastEventTitle: string;
  lastEventDate: string;
  sharedEventCount: number;
}

/**
 * Response from GET /api/events/:id/previous-attendees
 */
export interface PreviousAttendeesResponse {
  attendees: PreviousAttendee[];
  total: number;
}

/**
 * Response from POST /api/events/:id/previous-attendees/invite
 */
export interface InvitePreviousAttendeesResponse {
  message: string;
  sent: number;
  failed: number;
  alreadyInvited: number;
  alreadyRsvpd: number;
  results: Array<{
    userId: string;
    displayName: string;
    contactMethod: "email" | "sms" | null;
    contact: string | null;
    success: boolean;
    error?: string;
    alreadyInvited?: boolean;
    alreadyRsvpd?: boolean;
  }>;
}

/**
 * Get list of users from previous events (organizers only)
 */
export async function getPreviousAttendees(
  eventId: string,
  filterEventId?: string
): Promise<PreviousAttendeesResponse> {
  const params = new URLSearchParams();
  if (filterEventId) {
    params.append("filterEventId", filterEventId);
  }
  const query = params.toString();
  const endpoint = `/events/${eventId}/previous-attendees${query ? `?${query}` : ""}`;
  return request(endpoint);
}

/**
 * Send invitations to selected previous attendees (organizers only)
 */
export async function invitePreviousAttendees(
  eventId: string,
  userIds: string[]
): Promise<InvitePreviousAttendeesResponse> {
  return request(`/events/${eventId}/previous-attendees/invite`, {
    method: "POST",
    body: JSON.stringify({ userIds }),
  });
}

// =============================================================================
// Questionnaire API
// =============================================================================

export type QuestionType =
  | "SHORT_TEXT"
  | "LONG_TEXT"
  | "SINGLE_CHOICE"
  | "MULTIPLE_CHOICE"
  | "YES_NO"
  | "NUMBER"
  | "DATE";

export interface QuestionnaireQuestion {
  id: string;
  eventId: string;
  questionText: string;
  questionType: QuestionType;
  isRequired: boolean;
  helpText: string | null;
  orderIndex: number;
  choices: string[] | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateQuestionInput {
  questionText: string;
  questionType: QuestionType;
  isRequired?: boolean;
  helpText?: string;
  choices?: string[];
}

export interface UpdateQuestionInput {
  questionText?: string;
  isRequired?: boolean;
  helpText?: string | null;
  choices?: string[];
  orderIndex?: number;
}

/**
 * Get all questions for an event's questionnaire
 */
export async function getQuestionnaire(
  eventId: string
): Promise<QuestionnaireQuestion[]> {
  const response = await request<{ questions: QuestionnaireQuestion[] }>(
    `/events/${eventId}/questionnaire`
  );
  return response.questions;
}

/**
 * Create a new question for an event's questionnaire
 */
export async function createQuestion(
  eventId: string,
  input: CreateQuestionInput
): Promise<QuestionnaireQuestion> {
  const response = await request<{ question: QuestionnaireQuestion }>(
    `/events/${eventId}/questionnaire`,
    {
      method: "POST",
      body: JSON.stringify(input),
    }
  );
  return response.question;
}

/**
 * Update a question
 */
export async function updateQuestion(
  eventId: string,
  questionId: string,
  input: UpdateQuestionInput
): Promise<QuestionnaireQuestion> {
  const response = await request<{ question: QuestionnaireQuestion }>(
    `/events/${eventId}/questionnaire/${questionId}`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    }
  );
  return response.question;
}

/**
 * Delete a question
 */
export async function deleteQuestion(
  eventId: string,
  questionId: string
): Promise<void> {
  await request<void>(`/events/${eventId}/questionnaire/${questionId}`, {
    method: "DELETE",
  });
}

/**
 * Reorder questions
 */
export async function reorderQuestions(
  eventId: string,
  questionIds: string[]
): Promise<QuestionnaireQuestion[]> {
  const response = await request<{ questions: QuestionnaireQuestion[] }>(
    `/events/${eventId}/questionnaire/reorder`,
    {
      method: "POST",
      body: JSON.stringify({ questionIds }),
    }
  );
  return response.questions;
}

// =============================================================================
// Connections Types & API
// =============================================================================

/**
 * Connection data for a user
 */
export interface Connection {
  userId: string;
  displayName: string;
  photoUrl: string | null;
  sharedEventCount: number;
  mostRecentEvent: {
    eventId: string;
    eventTitle: string;
    eventDate: string;
  } | null;
}

/**
 * Connections response
 */
export interface ConnectionsResponse {
  connections: Connection[];
}

export interface SharedEvent {
  eventId: string;
  eventTitle: string;
  eventDate: string;
  eventLocation: string;
  userRole: "ORGANIZER" | "ATTENDEE";
}

export interface ConnectionDetail {
  userId: string;
  displayName: string;
  photoUrl: string | null;
  bio: string | null;
  location: string | null;
  sharedEvents: SharedEvent[];
  totalSharedEvents: number;
}

export interface ConnectionDetailResponse {
  connection: ConnectionDetail;
}

export interface ConnectionsFilters {
  name?: string;
  eventId?: string;
  startDate?: string;
  endDate?: string;
  sort?: "recent" | "frequency" | "alphabetical";
}

export interface ConnectionDetailFilters {
  eventId?: string;
  startDate?: string;
  endDate?: string;
}

/**
 * Get connections for the authenticated user
 */
export async function getConnections(filters?: ConnectionsFilters): Promise<ConnectionsResponse> {
  const params = new URLSearchParams();
  if (filters?.name) params.append("name", filters.name);
  if (filters?.eventId) params.append("eventId", filters.eventId);
  if (filters?.startDate) params.append("startDate", filters.startDate);
  if (filters?.endDate) params.append("endDate", filters.endDate);
  if (filters?.sort) params.append("sort", filters.sort);

  const queryString = params.toString();
  return request(`/connections${queryString ? `?${queryString}` : ""}`);
}

/**
 * Get detailed information about a specific connection
 */
export async function getConnectionDetail(
  userId: string,
  filters?: ConnectionDetailFilters
): Promise<ConnectionDetailResponse> {
  const params = new URLSearchParams();
  if (filters?.eventId) params.append("eventId", filters.eventId);
  if (filters?.startDate) params.append("startDate", filters.startDate);
  if (filters?.endDate) params.append("endDate", filters.endDate);

  const queryString = params.toString();
  return request(`/connections/${userId}${queryString ? `?${queryString}` : ""}`);
}

// =============================================================================
// Private Notes Types & API
// =============================================================================

/**
 * Private note data
 */
export interface PrivateNote {
  id: string;
  targetUserId: string;
  targetUserDisplayName: string;
  targetUserPhotoUrl: string | null;
  content: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Private notes list response
 */
export interface PrivateNotesListResponse {
  notes: PrivateNote[];
}

/**
 * Create private note request
 */
export interface CreatePrivateNoteRequest {
  targetUserId: string;
  content: string;
  tags?: string[];
}

/**
 * Update private note request
 */
export interface UpdatePrivateNoteRequest {
  content: string;
  tags?: string[];
}

/**
 * Filters for private notes list
 */
export interface PrivateNotesFilters {
  targetUserId?: string;
  search?: string;
  sort?: "recent" | "oldest" | "alphabetical";
}

/**
 * Get all private notes for the authenticated user
 */
export async function getPrivateNotes(filters?: PrivateNotesFilters): Promise<PrivateNotesListResponse> {
  const params = new URLSearchParams();
  if (filters?.targetUserId) params.append("targetUserId", filters.targetUserId);
  if (filters?.search) params.append("search", filters.search);
  if (filters?.sort) params.append("sort", filters.sort);

  const queryString = params.toString();
  return request(`/private-notes${queryString ? `?${queryString}` : ""}`);
}

/**
 * Get private note for a specific user
 */
export async function getPrivateNote(targetUserId: string): Promise<PrivateNote> {
  return request(`/private-notes/${targetUserId}`);
}

/**
 * Create a new private note
 */
export async function createPrivateNote(data: CreatePrivateNoteRequest): Promise<PrivateNote> {
  return request("/private-notes", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/**
 * Update an existing private note
 */
export async function updatePrivateNote(
  targetUserId: string,
  data: UpdatePrivateNoteRequest
): Promise<PrivateNote> {
  return request(`/private-notes/${targetUserId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

/**
 * Delete a private note
 */
export async function deletePrivateNote(targetUserId: string): Promise<void> {
  await request(`/private-notes/${targetUserId}`, {
    method: "DELETE",
  });
}

export default {
  validateInviteToken,
  generateInviteLink,
  getDashboard,
  getPastEvents,
  startInviteRegistration,
  verifyInviteRegistration,
  startLogin,
  verifyLogin,
  startRegistration,
  verifyRegistration,
  setAuthToken,
  getAuthToken,
  clearAuthToken,
  isAuthenticated,
  getEvent,
  createEvent,
  publishEvent,
  getEventAttendees,
  getFullAttendeeList,
  promoteToOrganizer,
  demoteOrganizer,
  updateEvent,
  cancelEvent,
  getEventState,
  getNotifications,
  getUnreadNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  sendEmailInvitations,
  getEmailInvitations,
  sendSmsInvitations,
  getSmsInvitations,
  getSmsQuota,
  getMassEmailQuota,
  previewMassEmailRecipients,
  sendMassEmail,
  getMassEmailHistory,
  getMassEmailDetails,
  getMassSmsQuota,
  previewMassSmsRecipients,
  sendMassSms,
  getMassSmsHistory,
  getMassSmsDetails,
  optOutOfEventSms,
  getProfile,
  updateProfile,
  getPublicProfile,
  getCurrentUser,
  getWallPosts,
  createWallPost,
  deleteWallPost,
  addReaction,
  removeReaction,
  pinWallPost,
  unpinWallPost,
  getModerationLog,
  getWaitlistStatus,
  joinWaitlist,
  leaveWaitlist,
  confirmWaitlistSpot,
  getPreviousAttendees,
  invitePreviousAttendees,
  getQuestionnaire,
  createQuestion,
  updateQuestion,
  deleteQuestion,
  reorderQuestions,
  getConnections,
};
