-- CreateEnum
CREATE TYPE "ProfileVisibility" AS ENUM ('CONNECTIONS', 'ORGANIZERS_ONLY', 'PRIVATE');

-- CreateEnum
CREATE TYPE "VerificationType" AS ENUM ('REGISTRATION', 'LOGIN', 'INVITE_REGISTRATION');

-- CreateEnum
CREATE TYPE "EventState" AS ENUM ('DRAFT', 'PUBLISHED', 'CLOSED', 'ONGOING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AttendeeListVisibility" AS ENUM ('ATTENDEES_ONLY', 'ORGANIZERS_ONLY');

-- CreateEnum
CREATE TYPE "RSVPResponse" AS ENUM ('YES', 'NO', 'MAYBE');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ORGANIZER');

-- CreateEnum
CREATE TYPE "EmailInvitationStatus" AS ENUM ('PENDING', 'SENT', 'OPENED', 'RSVPD', 'FAILED');

-- CreateEnum
CREATE TYPE "SmsInvitationStatus" AS ENUM ('PENDING', 'SENT', 'RSVPD', 'FAILED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('EVENT_UPDATED', 'EVENT_CANCELLED', 'RSVP_RECONFIRM', 'POST_DELETED_BY_MODERATOR', 'WAITLIST_SPOT_AVAILABLE', 'NEW_DEVICE_LOGIN');

-- CreateEnum
CREATE TYPE "ReactionType" AS ENUM ('HEART');

-- CreateEnum
CREATE TYPE "ModerationAction" AS ENUM ('DELETE', 'PIN', 'UNPIN');

-- CreateEnum
CREATE TYPE "CommunicationType" AS ENUM ('EMAIL', 'SMS');

-- CreateEnum
CREATE TYPE "TargetAudience" AS ENUM ('ALL', 'YES_ONLY', 'MAYBE_ONLY', 'NO_ONLY', 'WAITLIST_ONLY');

-- CreateEnum
CREATE TYPE "ContactMethod" AS ENUM ('EMAIL', 'SMS');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'OPENED', 'BOUNCED');

-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('SHORT_TEXT', 'LONG_TEXT', 'SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'YES_NO', 'NUMBER', 'DATE');

-- CreateEnum
CREATE TYPE "DataExportStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'EXPIRED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "displayName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "photoUrl" TEXT,
    "bio" TEXT,
    "location" TEXT,
    "photoVisibility" "ProfileVisibility" NOT NULL DEFAULT 'CONNECTIONS',
    "bioVisibility" "ProfileVisibility" NOT NULL DEFAULT 'CONNECTIONS',
    "locationVisibility" "ProfileVisibility" NOT NULL DEFAULT 'CONNECTIONS',
    "isProfileHidden" BOOLEAN NOT NULL DEFAULT false,
    "emailNotifications" BOOLEAN NOT NULL DEFAULT true,
    "smsNotifications" BOOLEAN NOT NULL DEFAULT true,
    "wallActivityNotifications" BOOLEAN NOT NULL DEFAULT true,
    "connectionEventNotifications" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deletionScheduledAt" TIMESTAMP(3),
    "deletionExecutionAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "deviceInfo" TEXT,
    "deviceType" TEXT,
    "deviceName" TEXT,
    "ipAddress" TEXT,
    "location" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationCode" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "inviteToken" TEXT,
    "code" TEXT NOT NULL,
    "type" "VerificationType" NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerificationCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "dateTime" TIMESTAMP(3) NOT NULL,
    "endDateTime" TIMESTAMP(3),
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "location" TEXT NOT NULL,
    "imageUrl" TEXT,
    "capacity" INTEGER,
    "waitlistEnabled" BOOLEAN NOT NULL DEFAULT false,
    "rsvpDeadline" TIMESTAMP(3),
    "category" TEXT,
    "dressCode" TEXT,
    "notes" TEXT,
    "state" "EventState" NOT NULL DEFAULT 'DRAFT',
    "attendeeListVisibility" "AttendeeListVisibility" NOT NULL DEFAULT 'ATTENDEES_ONLY',
    "allowInviteSharing" BOOLEAN NOT NULL DEFAULT true,
    "dataRetentionMonths" INTEGER NOT NULL DEFAULT 24,
    "wallRetentionMonths" INTEGER,
    "retentionNotificationSent" BOOLEAN NOT NULL DEFAULT false,
    "retentionNotificationSentAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "scheduledForDeletionAt" TIMESTAMP(3),
    "creatorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RSVP" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "response" "RSVPResponse" NOT NULL,
    "needsReconfirmation" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RSVP_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventRole" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'ORGANIZER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InviteLink" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "InviteLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailInvitation" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "inviteLinkId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "recipientName" TEXT,
    "status" "EmailInvitationStatus" NOT NULL DEFAULT 'PENDING',
    "sentAt" TIMESTAMP(3),
    "openedAt" TIMESTAMP(3),
    "rsvpAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmsInvitation" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "inviteLinkId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "recipientName" TEXT,
    "status" "SmsInvitationStatus" NOT NULL DEFAULT 'PENDING',
    "sentAt" TIMESTAMP(3),
    "rsvpAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SmsInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmsQuota" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "dailyCount" INTEGER NOT NULL DEFAULT 0,
    "dailyResetAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SmsQuota_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventId" TEXT,
    "type" "NotificationType" NOT NULL,
    "message" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WallPost" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "imageUrl" TEXT,
    "imageWidth" INTEGER,
    "imageHeight" INTEGER,
    "linkUrl" TEXT,
    "linkTitle" TEXT,
    "linkDescription" TEXT,
    "linkImageUrl" TEXT,
    "parentId" TEXT,
    "depth" INTEGER NOT NULL DEFAULT 0,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "pinnedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WallPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WallReaction" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "ReactionType" NOT NULL DEFAULT 'HEART',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WallReaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModerationLog" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "moderatorId" TEXT NOT NULL,
    "action" "ModerationAction" NOT NULL,
    "targetPostId" TEXT,
    "postContent" TEXT,
    "postAuthorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModerationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Waitlist" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notifiedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "Waitlist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MassCommunication" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "organizerId" TEXT NOT NULL,
    "type" "CommunicationType" NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "targetAudience" "TargetAudience" NOT NULL,
    "recipientCount" INTEGER NOT NULL DEFAULT 0,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "openedCount" INTEGER NOT NULL DEFAULT 0,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MassCommunication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MassCommunicationRecipient" (
    "id" TEXT NOT NULL,
    "massCommunicationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "contactMethod" "ContactMethod" NOT NULL,
    "recipient" TEXT NOT NULL,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "sentAt" TIMESTAMP(3),
    "openedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MassCommunicationRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MassCommunicationQuota" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "weeklyEmailCount" INTEGER NOT NULL DEFAULT 0,
    "weeklySmsCount" INTEGER NOT NULL DEFAULT 0,
    "weeklyResetAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastEmailAt" TIMESTAMP(3),
    "lastSmsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MassCommunicationQuota_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmsOptOut" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SmsOptOut_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionnaireQuestion" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "questionText" TEXT NOT NULL,
    "questionType" "QuestionType" NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "helpText" TEXT,
    "orderIndex" INTEGER NOT NULL,
    "choices" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuestionnaireQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionnaireResponse" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "response" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuestionnaireResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventNotificationSetting" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "muteAll" BOOLEAN NOT NULL DEFAULT false,
    "muteWallOnly" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventNotificationSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrivateNote" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "tags" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrivateNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataExport" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "DataExportStatus" NOT NULL DEFAULT 'PENDING',
    "fileUrl" TEXT,
    "expiresAt" TIMESTAMP(3),
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "DataExport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_phone_idx" ON "User"("phone");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_token_idx" ON "Session"("token");

-- CreateIndex
CREATE INDEX "VerificationCode_phone_code_idx" ON "VerificationCode"("phone", "code");

-- CreateIndex
CREATE INDEX "VerificationCode_email_code_idx" ON "VerificationCode"("email", "code");

-- CreateIndex
CREATE INDEX "VerificationCode_userId_idx" ON "VerificationCode"("userId");

-- CreateIndex
CREATE INDEX "Event_creatorId_idx" ON "Event"("creatorId");

-- CreateIndex
CREATE INDEX "Event_state_idx" ON "Event"("state");

-- CreateIndex
CREATE INDEX "Event_dateTime_idx" ON "Event"("dateTime");

-- CreateIndex
CREATE INDEX "RSVP_eventId_idx" ON "RSVP"("eventId");

-- CreateIndex
CREATE INDEX "RSVP_userId_idx" ON "RSVP"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "RSVP_eventId_userId_key" ON "RSVP"("eventId", "userId");

-- CreateIndex
CREATE INDEX "EventRole_eventId_idx" ON "EventRole"("eventId");

-- CreateIndex
CREATE INDEX "EventRole_userId_idx" ON "EventRole"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "EventRole_eventId_userId_key" ON "EventRole"("eventId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "InviteLink_token_key" ON "InviteLink"("token");

-- CreateIndex
CREATE INDEX "InviteLink_token_idx" ON "InviteLink"("token");

-- CreateIndex
CREATE INDEX "InviteLink_eventId_idx" ON "InviteLink"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "EmailInvitation_inviteLinkId_key" ON "EmailInvitation"("inviteLinkId");

-- CreateIndex
CREATE INDEX "EmailInvitation_eventId_idx" ON "EmailInvitation"("eventId");

-- CreateIndex
CREATE INDEX "EmailInvitation_email_idx" ON "EmailInvitation"("email");

-- CreateIndex
CREATE INDEX "EmailInvitation_status_idx" ON "EmailInvitation"("status");

-- CreateIndex
CREATE UNIQUE INDEX "SmsInvitation_inviteLinkId_key" ON "SmsInvitation"("inviteLinkId");

-- CreateIndex
CREATE INDEX "SmsInvitation_eventId_idx" ON "SmsInvitation"("eventId");

-- CreateIndex
CREATE INDEX "SmsInvitation_phone_idx" ON "SmsInvitation"("phone");

-- CreateIndex
CREATE INDEX "SmsInvitation_status_idx" ON "SmsInvitation"("status");

-- CreateIndex
CREATE UNIQUE INDEX "SmsQuota_eventId_key" ON "SmsQuota"("eventId");

-- CreateIndex
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");

-- CreateIndex
CREATE INDEX "Notification_eventId_idx" ON "Notification"("eventId");

-- CreateIndex
CREATE INDEX "Notification_userId_read_idx" ON "Notification"("userId", "read");

-- CreateIndex
CREATE INDEX "WallPost_eventId_idx" ON "WallPost"("eventId");

-- CreateIndex
CREATE INDEX "WallPost_authorId_idx" ON "WallPost"("authorId");

-- CreateIndex
CREATE INDEX "WallPost_eventId_createdAt_idx" ON "WallPost"("eventId", "createdAt");

-- CreateIndex
CREATE INDEX "WallPost_parentId_idx" ON "WallPost"("parentId");

-- CreateIndex
CREATE INDEX "WallPost_eventId_isPinned_pinnedAt_idx" ON "WallPost"("eventId", "isPinned", "pinnedAt");

-- CreateIndex
CREATE INDEX "WallReaction_postId_idx" ON "WallReaction"("postId");

-- CreateIndex
CREATE INDEX "WallReaction_userId_idx" ON "WallReaction"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "WallReaction_postId_userId_key" ON "WallReaction"("postId", "userId");

-- CreateIndex
CREATE INDEX "ModerationLog_eventId_idx" ON "ModerationLog"("eventId");

-- CreateIndex
CREATE INDEX "ModerationLog_moderatorId_idx" ON "ModerationLog"("moderatorId");

-- CreateIndex
CREATE INDEX "ModerationLog_eventId_createdAt_idx" ON "ModerationLog"("eventId", "createdAt");

-- CreateIndex
CREATE INDEX "Waitlist_eventId_idx" ON "Waitlist"("eventId");

-- CreateIndex
CREATE INDEX "Waitlist_userId_idx" ON "Waitlist"("userId");

-- CreateIndex
CREATE INDEX "Waitlist_eventId_createdAt_idx" ON "Waitlist"("eventId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Waitlist_eventId_userId_key" ON "Waitlist"("eventId", "userId");

-- CreateIndex
CREATE INDEX "MassCommunication_eventId_idx" ON "MassCommunication"("eventId");

-- CreateIndex
CREATE INDEX "MassCommunication_organizerId_idx" ON "MassCommunication"("organizerId");

-- CreateIndex
CREATE INDEX "MassCommunication_eventId_sentAt_idx" ON "MassCommunication"("eventId", "sentAt");

-- CreateIndex
CREATE INDEX "MassCommunicationRecipient_massCommunicationId_idx" ON "MassCommunicationRecipient"("massCommunicationId");

-- CreateIndex
CREATE INDEX "MassCommunicationRecipient_status_idx" ON "MassCommunicationRecipient"("status");

-- CreateIndex
CREATE UNIQUE INDEX "MassCommunicationRecipient_massCommunicationId_userId_key" ON "MassCommunicationRecipient"("massCommunicationId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "MassCommunicationQuota_eventId_key" ON "MassCommunicationQuota"("eventId");

-- CreateIndex
CREATE INDEX "SmsOptOut_eventId_idx" ON "SmsOptOut"("eventId");

-- CreateIndex
CREATE INDEX "SmsOptOut_userId_idx" ON "SmsOptOut"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SmsOptOut_eventId_userId_key" ON "SmsOptOut"("eventId", "userId");

-- CreateIndex
CREATE INDEX "QuestionnaireQuestion_eventId_idx" ON "QuestionnaireQuestion"("eventId");

-- CreateIndex
CREATE INDEX "QuestionnaireQuestion_eventId_orderIndex_idx" ON "QuestionnaireQuestion"("eventId", "orderIndex");

-- CreateIndex
CREATE INDEX "QuestionnaireResponse_questionId_idx" ON "QuestionnaireResponse"("questionId");

-- CreateIndex
CREATE INDEX "QuestionnaireResponse_eventId_userId_idx" ON "QuestionnaireResponse"("eventId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionnaireResponse_questionId_userId_key" ON "QuestionnaireResponse"("questionId", "userId");

-- CreateIndex
CREATE INDEX "EventNotificationSetting_eventId_idx" ON "EventNotificationSetting"("eventId");

-- CreateIndex
CREATE INDEX "EventNotificationSetting_userId_idx" ON "EventNotificationSetting"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "EventNotificationSetting_eventId_userId_key" ON "EventNotificationSetting"("eventId", "userId");

-- CreateIndex
CREATE INDEX "PrivateNote_creatorId_idx" ON "PrivateNote"("creatorId");

-- CreateIndex
CREATE INDEX "PrivateNote_targetUserId_idx" ON "PrivateNote"("targetUserId");

-- CreateIndex
CREATE INDEX "PrivateNote_creatorId_updatedAt_idx" ON "PrivateNote"("creatorId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PrivateNote_creatorId_targetUserId_key" ON "PrivateNote"("creatorId", "targetUserId");

-- CreateIndex
CREATE INDEX "DataExport_userId_idx" ON "DataExport"("userId");

-- CreateIndex
CREATE INDEX "DataExport_status_idx" ON "DataExport"("status");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationCode" ADD CONSTRAINT "VerificationCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RSVP" ADD CONSTRAINT "RSVP_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RSVP" ADD CONSTRAINT "RSVP_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventRole" ADD CONSTRAINT "EventRole_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventRole" ADD CONSTRAINT "EventRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InviteLink" ADD CONSTRAINT "InviteLink_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailInvitation" ADD CONSTRAINT "EmailInvitation_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailInvitation" ADD CONSTRAINT "EmailInvitation_inviteLinkId_fkey" FOREIGN KEY ("inviteLinkId") REFERENCES "InviteLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmsInvitation" ADD CONSTRAINT "SmsInvitation_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmsInvitation" ADD CONSTRAINT "SmsInvitation_inviteLinkId_fkey" FOREIGN KEY ("inviteLinkId") REFERENCES "InviteLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmsQuota" ADD CONSTRAINT "SmsQuota_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WallPost" ADD CONSTRAINT "WallPost_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WallPost" ADD CONSTRAINT "WallPost_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WallPost" ADD CONSTRAINT "WallPost_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "WallPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WallReaction" ADD CONSTRAINT "WallReaction_postId_fkey" FOREIGN KEY ("postId") REFERENCES "WallPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WallReaction" ADD CONSTRAINT "WallReaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Waitlist" ADD CONSTRAINT "Waitlist_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Waitlist" ADD CONSTRAINT "Waitlist_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MassCommunication" ADD CONSTRAINT "MassCommunication_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MassCommunication" ADD CONSTRAINT "MassCommunication_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MassCommunicationRecipient" ADD CONSTRAINT "MassCommunicationRecipient_massCommunicationId_fkey" FOREIGN KEY ("massCommunicationId") REFERENCES "MassCommunication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MassCommunicationRecipient" ADD CONSTRAINT "MassCommunicationRecipient_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MassCommunicationQuota" ADD CONSTRAINT "MassCommunicationQuota_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionnaireQuestion" ADD CONSTRAINT "QuestionnaireQuestion_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionnaireResponse" ADD CONSTRAINT "QuestionnaireResponse_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "QuestionnaireQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventNotificationSetting" ADD CONSTRAINT "EventNotificationSetting_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventNotificationSetting" ADD CONSTRAINT "EventNotificationSetting_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrivateNote" ADD CONSTRAINT "PrivateNote_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrivateNote" ADD CONSTRAINT "PrivateNote_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataExport" ADD CONSTRAINT "DataExport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
