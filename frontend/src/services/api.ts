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
export type NotificationType = "EVENT_UPDATED" | "EVENT_CANCELLED" | "RSVP_RECONFIRM";

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
 * Wall post
 */
export interface WallPost {
  id: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  author: WallPostAuthor;
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
 * Create a new wall post (confirmed attendees only)
 */
export async function createWallPost(eventId: string, content: string): Promise<CreateWallPostResponse> {
  return request(`/events/${eventId}/wall`, {
    method: "POST",
    body: JSON.stringify({ content }),
  });
}

/**
 * Delete a wall post (author only)
 */
export async function deleteWallPost(eventId: string, postId: string): Promise<{ message: string }> {
  return request(`/events/${eventId}/wall/${postId}`, {
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
  getProfile,
  updateProfile,
  getPublicProfile,
  getCurrentUser,
  getWallPosts,
  createWallPost,
  deleteWallPost,
};
