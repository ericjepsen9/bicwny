-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('admin', 'coach', 'student');

-- CreateEnum
CREATE TYPE "ClassMemberRole" AS ENUM ('coach', 'student');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('system', 'class_announcement', 'class_session', 'class_session_soon', 'achievement', 'reminder');

-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('single', 'fill', 'multi', 'open', 'sort', 'match', 'verse', 'chain', 'flip', 'image', 'listen', 'flow', 'guided', 'scenario');

-- CreateEnum
CREATE TYPE "Visibility" AS ENUM ('public', 'class_private', 'draft');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "Sm2Status" AS ENUM ('new', 'learning', 'review', 'mastered');

-- CreateEnum
CREATE TYPE "ReportReason" AS ENUM ('wrong_answer', 'sensitive', 'doctrine_error', 'typo', 'other');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('pending', 'accepted', 'rejected');

-- CreateEnum
CREATE TYPE "ProviderRole" AS ENUM ('primary', 'fallback', 'disabled');

-- CreateEnum
CREATE TYPE "HealthStatus" AS ENUM ('healthy', 'degraded', 'down', 'quota_exceeded');

-- CreateEnum
CREATE TYPE "OveragePolicy" AS ENUM ('stop', 'pay_as_you_go', 'fallback');

-- CreateEnum
CREATE TYPE "PeriodType" AS ENUM ('year', 'month', 'day', 'hour', 'minute');

-- CreateEnum
CREATE TYPE "LogKind" AS ENUM ('error', 'slow_request', 'slow_query');

-- CreateEnum
CREATE TYPE "FeedbackKind" AS ENUM ('suggestion', 'bug', 'praise', 'other');

-- CreateEnum
CREATE TYPE "FeedbackStatus" AS ENUM ('open', 'triaged', 'resolved', 'wontfix');

-- CreateEnum
CREATE TYPE "PracticeProjectScope" AS ENUM ('user', 'class');

-- CreateEnum
CREATE TYPE "PracticeTaskScope" AS ENUM ('self', 'class');

-- CreateEnum
CREATE TYPE "PracticeTaskMode" AS ENUM ('daily', 'fixed');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "emailVerifiedAt" TIMESTAMP(3),
    "passwordHash" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'student',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "dharmaName" TEXT,
    "avatar" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Taipei',
    "locale" TEXT NOT NULL DEFAULT 'zh-Hans',
    "hasOnboarded" BOOLEAN NOT NULL DEFAULT false,
    "contentCohort" TEXT,
    "meditationVisibleToClass" BOOLEAN NOT NULL DEFAULT false,
    "practiceVisibleToClass" BOOLEAN NOT NULL DEFAULT false,
    "eveningReminderEnabled" BOOLEAN NOT NULL DEFAULT true,
    "eveningReminderHour" INTEGER,
    "dailyDigestEnabled" BOOLEAN NOT NULL DEFAULT true,
    "dailyDigestHour" INTEGER,
    "weeklyReportEnabled" BOOLEAN NOT NULL DEFAULT true,
    "weeklyReportWeekday" INTEGER,
    "weeklyReportHour" INTEGER,
    "quietHoursStart" INTEGER NOT NULL DEFAULT 22,
    "quietHoursEnd" INTEGER NOT NULL DEFAULT 7,
    "currentSessionId" TEXT,
    "notificationV2Enabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Class" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "joinCode" TEXT NOT NULL,
    "coverEmoji" TEXT NOT NULL DEFAULT '📚',
    "courseId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Class_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassMember" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "ClassMemberRole" NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removedAt" TIMESTAMP(3),

    CONSTRAINT "ClassMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "refreshTokenHash" TEXT NOT NULL,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "AuthSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeletedEmail" (
    "email" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeletedEmail_pkey" PRIMARY KEY ("email")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requestIp" TEXT,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailVerificationToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailVerificationToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "link" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "eventKind" TEXT,
    "eventId" TEXT,
    "tier" TEXT,
    "severity" TEXT,
    "contentHash" TEXT,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalyticsEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "sessionId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "properties" JSONB NOT NULL DEFAULT '{}',
    "page" TEXT,
    "referrer" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "platform" TEXT NOT NULL DEFAULT 'web',
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sessionId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deactivatedAt" TIMESTAMP(3),

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassSession" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startAt" TIMESTAMP(3) NOT NULL,
    "durationMin" INTEGER NOT NULL DEFAULT 60,
    "liveLink" TEXT,
    "editVersion" INTEGER NOT NULL DEFAULT 1,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClassSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationDispatchLog" (
    "id" TEXT NOT NULL,
    "eventKind" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "notificationId" TEXT,
    "pushedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "channel" TEXT NOT NULL DEFAULT 'push',
    "success" BOOLEAN NOT NULL DEFAULT true,
    "error" TEXT,
    "severity" TEXT NOT NULL DEFAULT 'normal',

    CONSTRAINT "NotificationDispatchLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationRule" (
    "id" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "classId" TEXT,
    "assignmentId" TEXT,
    "triggerType" TEXT NOT NULL,
    "defaultHour" INTEGER,
    "defaultWeekday" INTEGER,
    "meta" JSONB NOT NULL DEFAULT '{}',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Course" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "titleTraditional" TEXT,
    "author" TEXT,
    "authorInfo" TEXT,
    "description" TEXT,
    "coverEmoji" TEXT NOT NULL DEFAULT '🪷',
    "coverImageUrl" TEXT,
    "category" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "licenseInfo" TEXT,
    "lastImportClientToken" TEXT,
    "lastImportSummary" JSONB,
    "archivedAt" TIMESTAMP(3),
    "contentVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Chapter" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "titleTraditional" TEXT,

    CONSTRAINT "Chapter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lesson" (
    "id" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "titleTraditional" TEXT,
    "referenceText" TEXT,
    "teachingSummary" TEXT,

    CONSTRAINT "Lesson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserCourseEnrollment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'self',
    "enrolledViaClassId" TEXT,
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastStudiedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "currentLessonId" TEXT,
    "lessonsCompleted" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "meditationsCompleted" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "UserCourseEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Meditation" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT,
    "courseId" TEXT,
    "title" TEXT NOT NULL,
    "titleTraditional" TEXT,
    "description" TEXT,
    "videoUrl" TEXT NOT NULL,
    "videoDurationSec" INTEGER NOT NULL,
    "slideImageUrls" JSONB,
    "slidesPdfUrl" TEXT,
    "chapters" JSONB,
    "transcriptVtt" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "authorName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "Meditation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeditationSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "meditationId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "videoWatchedSec" INTEGER NOT NULL DEFAULT 0,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "insightNotes" TEXT,
    "practiceNotes" TEXT,
    "shareScope" TEXT NOT NULL DEFAULT 'self',

    CONSTRAINT "MeditationSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL,
    "type" "QuestionType" NOT NULL,
    "courseId" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "difficulty" INTEGER NOT NULL DEFAULT 2,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "questionText" TEXT NOT NULL,
    "correctText" TEXT NOT NULL,
    "wrongText" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "visibility" "Visibility" NOT NULL DEFAULT 'public',
    "ownerClassId" TEXT,
    "reviewStatus" "ReviewStatus" NOT NULL DEFAULT 'approved',
    "cohort" TEXT,
    "contentVersion" INTEGER NOT NULL DEFAULT 1,
    "createdByUserId" TEXT,
    "reviewed" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserAnswer" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "answer" JSONB NOT NULL,
    "isCorrect" BOOLEAN,
    "score" INTEGER,
    "aiGrade" JSONB,
    "timeSpentMs" INTEGER,
    "classId" TEXT,
    "requestId" TEXT,
    "answeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sm2Card" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "easeFactor" DOUBLE PRECISION NOT NULL DEFAULT 2.5,
    "interval" INTEGER NOT NULL DEFAULT 0,
    "repetitions" INTEGER NOT NULL DEFAULT 0,
    "dueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastReviewed" TIMESTAMP(3),
    "lastRating" INTEGER,
    "status" "Sm2Status" NOT NULL DEFAULT 'new',

    CONSTRAINT "Sm2Card_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserFavorite" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserFavorite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserMistakeBook" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "lastWrongAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "wrongCount" INTEGER NOT NULL DEFAULT 1,
    "removedAt" TIMESTAMP(3),

    CONSTRAINT "UserMistakeBook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionReport" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "reason" "ReportReason" NOT NULL,
    "details" TEXT,
    "status" "ReportStatus" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "handledByUserId" TEXT,
    "handledAt" TIMESTAMP(3),
    "note" TEXT,
    "acceptAction" TEXT,

    CONSTRAINT "QuestionReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LlmProviderConfig" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "apiKeyEnv" TEXT NOT NULL,
    "defaultModel" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "role" "ProviderRole" NOT NULL DEFAULT 'fallback',
    "priority" INTEGER NOT NULL DEFAULT 50,
    "yearlyTokenQuota" BIGINT,
    "monthlyTokenQuota" BIGINT,
    "dailyRequestQuota" INTEGER,
    "rpmLimit" INTEGER,
    "concurrencyLimit" INTEGER,
    "reservePercent" DOUBLE PRECISION NOT NULL DEFAULT 5,
    "enabledFrom" TIMESTAMP(3),
    "enabledUntil" TIMESTAMP(3),
    "overagePolicy" "OveragePolicy" NOT NULL DEFAULT 'stop',
    "healthStatus" "HealthStatus" NOT NULL DEFAULT 'healthy',
    "consecutiveErrors" INTEGER NOT NULL DEFAULT 0,
    "circuitOpenUntil" TIMESTAMP(3),
    "lastErrorAt" TIMESTAMP(3),
    "lastSuccessAt" TIMESTAMP(3),
    "inputCostPer1k" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "outputCostPer1k" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LlmProviderConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LlmProviderUsage" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "periodType" "PeriodType" NOT NULL,
    "periodKey" TEXT NOT NULL,
    "tokenCount" BIGINT NOT NULL DEFAULT 0,
    "inputTokens" BIGINT NOT NULL DEFAULT 0,
    "outputTokens" BIGINT NOT NULL DEFAULT 0,
    "requestCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "cost" DECIMAL(14,6) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LlmProviderUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LlmScenarioConfig" (
    "id" TEXT NOT NULL,
    "scenario" TEXT NOT NULL,
    "primaryProviderId" TEXT NOT NULL,
    "primaryModel" TEXT NOT NULL,
    "fallbackProviderId" TEXT,
    "fallbackModel" TEXT,
    "temperature" DOUBLE PRECISION NOT NULL DEFAULT 0.3,
    "maxTokens" INTEGER NOT NULL DEFAULT 1500,
    "promptTemplateId" TEXT,
    "estimatedTokensPerCall" INTEGER NOT NULL DEFAULT 1200,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LlmScenarioConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LlmPromptTemplate" (
    "id" TEXT NOT NULL,
    "scenario" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByAdminId" TEXT,

    CONSTRAINT "LlmPromptTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LlmCallLog" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "scenario" TEXT NOT NULL,
    "userId" TEXT,
    "coachId" TEXT,
    "providerUsed" TEXT NOT NULL,
    "providerTried" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "switched" BOOLEAN NOT NULL DEFAULT false,
    "switchReason" TEXT,
    "model" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL,
    "outputTokens" INTEGER NOT NULL,
    "cost" DECIMAL(14,6) NOT NULL DEFAULT 0,
    "latencyMs" INTEGER NOT NULL,
    "success" BOOLEAN NOT NULL,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "promptHash" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LlmCallLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "before" JSONB,
    "after" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ErrorLog" (
    "id" TEXT NOT NULL,
    "kind" "LogKind" NOT NULL,
    "message" TEXT NOT NULL,
    "stack" TEXT,
    "context" JSONB,
    "userId" TEXT,
    "requestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ErrorLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemSetting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "ContentSeed" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "appliedBy" TEXT,
    "notes" TEXT,

    CONSTRAINT "ContentSeed_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentRelease" (
    "id" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "change" TEXT NOT NULL,
    "oldVersion" INTEGER,
    "newVersion" INTEGER,
    "diff" JSONB,
    "byUserId" TEXT,
    "bySeed" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentRelease_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Experiment" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "description" TEXT,
    "variants" JSONB NOT NULL,
    "goalEvent" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Experiment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExperimentExposure" (
    "id" TEXT NOT NULL,
    "experimentKey" TEXT NOT NULL,
    "userId" TEXT,
    "sessionId" TEXT,
    "variant" TEXT NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExperimentExposure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Feedback" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "kind" "FeedbackKind" NOT NULL DEFAULT 'other',
    "status" "FeedbackStatus" NOT NULL DEFAULT 'open',
    "message" TEXT NOT NULL,
    "contactEmail" TEXT,
    "page" TEXT,
    "userAgent" TEXT,
    "appVersion" TEXT,
    "sessionId" TEXT,
    "handledByUserId" TEXT,
    "handledAt" TIMESTAMP(3),
    "response" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PracticeCategory" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PracticeCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PracticeProject" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "emoji" TEXT,
    "scope" "PracticeProjectScope" NOT NULL,
    "classId" TEXT,
    "ownerId" TEXT,
    "isBuiltin" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMP(3),
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PracticeProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PracticeEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PracticeEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PracticeDailySummary" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "count" INTEGER NOT NULL,

    CONSTRAINT "PracticeDailySummary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PracticeGoal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "dailyTarget" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PracticeGoal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PracticeTask" (
    "id" TEXT NOT NULL,
    "scope" "PracticeTaskScope" NOT NULL,
    "mode" "PracticeTaskMode" NOT NULL,
    "ownerId" TEXT NOT NULL,
    "classId" TEXT,
    "userId" TEXT,
    "projectId" TEXT NOT NULL,
    "title" TEXT,
    "target" INTEGER NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PracticeTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PracticeMakeup" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PracticeMakeup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassAnnouncement" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "imageUrls" JSONB,
    "pinnedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClassAnnouncement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LessonReadingProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "scrollPercent" INTEGER NOT NULL DEFAULT 0,
    "totalSeconds" INTEGER NOT NULL DEFAULT 0,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "lastReadAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LessonReadingProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TibetanDay" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "lunar" TEXT NOT NULL,
    "tibetan" TEXT NOT NULL,
    "tibetanMonth" TEXT NOT NULL,
    "isIntercalary" BOOLEAN NOT NULL DEFAULT false,
    "tags" JSONB NOT NULL DEFAULT '[]',
    "auspicious" BOOLEAN NOT NULL DEFAULT false,
    "events" JSONB NOT NULL DEFAULT '[]',
    "publicHoliday" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TibetanDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Note" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lessonId" TEXT,
    "courseId" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "tags" JSONB NOT NULL DEFAULT '[]',
    "visibility" TEXT NOT NULL DEFAULT 'private',
    "anchorText" TEXT,
    "anchorIndex" INTEGER,
    "pinnedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Note_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NoteReport" (
    "id" TEXT NOT NULL,
    "noteId" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "handledById" TEXT,
    "handledAt" TIMESTAMP(3),

    CONSTRAINT "NoteReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Highlight" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "paragraphIndex" INTEGER NOT NULL,
    "textStart" INTEGER NOT NULL,
    "textEnd" INTEGER NOT NULL,
    "anchorText" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT 'yellow',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Highlight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HomePoster" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "caption" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HomePoster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DharmaAssembly" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'assembly',
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "coverImage" TEXT,
    "externalLink" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DharmaAssembly_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pushEnabled" BOOLEAN NOT NULL DEFAULT true,
    "pushTypes" JSONB NOT NULL DEFAULT '{}',
    "homeCardEnabled" BOOLEAN NOT NULL DEFAULT true,
    "auspiciousDayCard" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserAchievementUnlock" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "badgeId" TEXT NOT NULL,
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notifiedAt" TIMESTAMP(3),

    CONSTRAINT "UserAchievementUnlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemAnnouncement" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'normal',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "contentHash" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemAnnouncement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrphanedFile" (
    "id" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "variantPaths" TEXT[],
    "markedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrphanedFile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE UNIQUE INDEX "Class_joinCode_key" ON "Class"("joinCode");

-- CreateIndex
CREATE INDEX "Class_courseId_idx" ON "Class"("courseId");

-- CreateIndex
CREATE INDEX "ClassMember_userId_role_idx" ON "ClassMember"("userId", "role");

-- CreateIndex
CREATE INDEX "ClassMember_classId_role_idx" ON "ClassMember"("classId", "role");

-- CreateIndex
CREATE INDEX "ClassMember_userId_removedAt_idx" ON "ClassMember"("userId", "removedAt");

-- CreateIndex
CREATE INDEX "ClassMember_classId_removedAt_role_idx" ON "ClassMember"("classId", "removedAt", "role");

-- CreateIndex
CREATE UNIQUE INDEX "ClassMember_classId_userId_key" ON "ClassMember"("classId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "AuthSession_refreshTokenHash_key" ON "AuthSession"("refreshTokenHash");

-- CreateIndex
CREATE INDEX "AuthSession_userId_expiresAt_idx" ON "AuthSession"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "AuthSession_userId_revokedAt_idx" ON "AuthSession"("userId", "revokedAt");

-- CreateIndex
CREATE INDEX "DeletedEmail_deletedAt_idx" ON "DeletedEmail"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_usedAt_idx" ON "PasswordResetToken"("userId", "usedAt");

-- CreateIndex
CREATE INDEX "PasswordResetToken_expiresAt_idx" ON "PasswordResetToken"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "EmailVerificationToken_tokenHash_key" ON "EmailVerificationToken"("tokenHash");

-- CreateIndex
CREATE INDEX "EmailVerificationToken_userId_usedAt_idx" ON "EmailVerificationToken"("userId", "usedAt");

-- CreateIndex
CREATE INDEX "EmailVerificationToken_expiresAt_idx" ON "EmailVerificationToken"("expiresAt");

-- CreateIndex
CREATE INDEX "Notification_userId_isRead_createdAt_idx" ON "Notification"("userId", "isRead", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_deletedAt_idx" ON "Notification"("userId", "deletedAt");

-- CreateIndex
CREATE INDEX "Notification_userId_eventKind_eventId_idx" ON "Notification"("userId", "eventKind", "eventId");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_event_createdAt_idx" ON "AnalyticsEvent"("event", "createdAt");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_userId_createdAt_idx" ON "AnalyticsEvent"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_sessionId_idx" ON "AnalyticsEvent"("sessionId");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_createdAt_idx" ON "AnalyticsEvent"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX "PushSubscription_userId_idx" ON "PushSubscription"("userId");

-- CreateIndex
CREATE INDEX "PushSubscription_userId_isActive_idx" ON "PushSubscription"("userId", "isActive");

-- CreateIndex
CREATE INDEX "PushSubscription_lastSeenAt_idx" ON "PushSubscription"("lastSeenAt");

-- CreateIndex
CREATE INDEX "ClassSession_classId_startAt_idx" ON "ClassSession"("classId", "startAt");

-- CreateIndex
CREATE INDEX "ClassSession_startAt_idx" ON "ClassSession"("startAt");

-- CreateIndex
CREATE INDEX "NotificationDispatchLog_eventKind_eventId_tier_idx" ON "NotificationDispatchLog"("eventKind", "eventId", "tier");

-- CreateIndex
CREATE INDEX "NotificationDispatchLog_userId_pushedAt_idx" ON "NotificationDispatchLog"("userId", "pushedAt");

-- CreateIndex
CREATE INDEX "NotificationDispatchLog_userId_channel_pushedAt_idx" ON "NotificationDispatchLog"("userId", "channel", "pushedAt");

-- CreateIndex
CREATE INDEX "NotificationDispatchLog_userId_channel_severity_pushedAt_idx" ON "NotificationDispatchLog"("userId", "channel", "severity", "pushedAt");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationDispatchLog_eventKind_eventId_tier_userId_chann_key" ON "NotificationDispatchLog"("eventKind", "eventId", "tier", "userId", "channel");

-- CreateIndex
CREATE INDEX "NotificationRule_scope_triggerType_isActive_idx" ON "NotificationRule"("scope", "triggerType", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationRule_scope_triggerType_classId_assignmentId_key" ON "NotificationRule"("scope", "triggerType", "classId", "assignmentId");

-- CreateIndex
CREATE UNIQUE INDEX "Course_slug_key" ON "Course"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Chapter_courseId_order_key" ON "Chapter"("courseId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "Lesson_chapterId_order_key" ON "Lesson"("chapterId", "order");

-- CreateIndex
CREATE INDEX "UserCourseEnrollment_enrolledViaClassId_idx" ON "UserCourseEnrollment"("enrolledViaClassId");

-- CreateIndex
CREATE INDEX "UserCourseEnrollment_userId_enrolledViaClassId_idx" ON "UserCourseEnrollment"("userId", "enrolledViaClassId");

-- CreateIndex
CREATE UNIQUE INDEX "UserCourseEnrollment_userId_courseId_key" ON "UserCourseEnrollment"("userId", "courseId");

-- CreateIndex
CREATE INDEX "Meditation_lessonId_idx" ON "Meditation"("lessonId");

-- CreateIndex
CREATE INDEX "Meditation_courseId_idx" ON "Meditation"("courseId");

-- CreateIndex
CREATE INDEX "MeditationSession_userId_meditationId_idx" ON "MeditationSession"("userId", "meditationId");

-- CreateIndex
CREATE INDEX "MeditationSession_userId_completedAt_idx" ON "MeditationSession"("userId", "completedAt");

-- CreateIndex
CREATE INDEX "MeditationSession_completedAt_idx" ON "MeditationSession"("completedAt");

-- CreateIndex
CREATE INDEX "MeditationSession_meditationId_completedAt_idx" ON "MeditationSession"("meditationId", "completedAt");

-- CreateIndex
CREATE INDEX "Question_lessonId_idx" ON "Question"("lessonId");

-- CreateIndex
CREATE INDEX "Question_chapterId_idx" ON "Question"("chapterId");

-- CreateIndex
CREATE INDEX "Question_courseId_visibility_idx" ON "Question"("courseId", "visibility");

-- CreateIndex
CREATE INDEX "Question_reviewStatus_idx" ON "Question"("reviewStatus");

-- CreateIndex
CREATE INDEX "Question_ownerClassId_idx" ON "Question"("ownerClassId");

-- CreateIndex
CREATE INDEX "Question_createdByUserId_idx" ON "Question"("createdByUserId");

-- CreateIndex
CREATE INDEX "Question_cohort_idx" ON "Question"("cohort");

-- CreateIndex
CREATE INDEX "Question_courseId_reviewStatus_visibility_lessonId_idx" ON "Question"("courseId", "reviewStatus", "visibility", "lessonId");

-- CreateIndex
CREATE INDEX "UserAnswer_userId_questionId_idx" ON "UserAnswer"("userId", "questionId");

-- CreateIndex
CREATE INDEX "UserAnswer_userId_answeredAt_idx" ON "UserAnswer"("userId", "answeredAt");

-- CreateIndex
CREATE INDEX "UserAnswer_classId_answeredAt_idx" ON "UserAnswer"("classId", "answeredAt");

-- CreateIndex
CREATE INDEX "UserAnswer_answeredAt_idx" ON "UserAnswer"("answeredAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserAnswer_userId_questionId_requestId_key" ON "UserAnswer"("userId", "questionId", "requestId");

-- CreateIndex
CREATE INDEX "Sm2Card_userId_dueDate_idx" ON "Sm2Card"("userId", "dueDate");

-- CreateIndex
CREATE INDEX "Sm2Card_userId_courseId_dueDate_idx" ON "Sm2Card"("userId", "courseId", "dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "Sm2Card_userId_questionId_key" ON "Sm2Card"("userId", "questionId");

-- CreateIndex
CREATE INDEX "UserFavorite_userId_createdAt_idx" ON "UserFavorite"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserFavorite_userId_questionId_key" ON "UserFavorite"("userId", "questionId");

-- CreateIndex
CREATE INDEX "UserMistakeBook_userId_removedAt_lastWrongAt_idx" ON "UserMistakeBook"("userId", "removedAt", "lastWrongAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserMistakeBook_userId_questionId_key" ON "UserMistakeBook"("userId", "questionId");

-- CreateIndex
CREATE INDEX "QuestionReport_status_createdAt_idx" ON "QuestionReport"("status", "createdAt");

-- CreateIndex
CREATE INDEX "QuestionReport_questionId_status_idx" ON "QuestionReport"("questionId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "LlmProviderConfig_name_key" ON "LlmProviderConfig"("name");

-- CreateIndex
CREATE INDEX "LlmProviderUsage_providerId_periodType_idx" ON "LlmProviderUsage"("providerId", "periodType");

-- CreateIndex
CREATE UNIQUE INDEX "LlmProviderUsage_providerId_periodType_periodKey_key" ON "LlmProviderUsage"("providerId", "periodType", "periodKey");

-- CreateIndex
CREATE UNIQUE INDEX "LlmScenarioConfig_scenario_key" ON "LlmScenarioConfig"("scenario");

-- CreateIndex
CREATE UNIQUE INDEX "LlmPromptTemplate_scenario_version_key" ON "LlmPromptTemplate"("scenario", "version");

-- CreateIndex
CREATE UNIQUE INDEX "LlmCallLog_requestId_key" ON "LlmCallLog"("requestId");

-- CreateIndex
CREATE INDEX "LlmCallLog_timestamp_idx" ON "LlmCallLog"("timestamp");

-- CreateIndex
CREATE INDEX "LlmCallLog_userId_timestamp_idx" ON "LlmCallLog"("userId", "timestamp");

-- CreateIndex
CREATE INDEX "LlmCallLog_providerUsed_timestamp_idx" ON "LlmCallLog"("providerUsed", "timestamp");

-- CreateIndex
CREATE INDEX "LlmCallLog_scenario_timestamp_idx" ON "LlmCallLog"("scenario", "timestamp");

-- CreateIndex
CREATE INDEX "LlmCallLog_promptHash_idx" ON "LlmCallLog"("promptHash");

-- CreateIndex
CREATE INDEX "AuditLog_timestamp_idx" ON "AuditLog"("timestamp");

-- CreateIndex
CREATE INDEX "AuditLog_adminId_timestamp_idx" ON "AuditLog"("adminId", "timestamp");

-- CreateIndex
CREATE INDEX "AuditLog_action_timestamp_idx" ON "AuditLog"("action", "timestamp");

-- CreateIndex
CREATE INDEX "AuditLog_targetType_targetId_idx" ON "AuditLog"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "ErrorLog_kind_createdAt_idx" ON "ErrorLog"("kind", "createdAt");

-- CreateIndex
CREATE INDEX "ErrorLog_requestId_idx" ON "ErrorLog"("requestId");

-- CreateIndex
CREATE INDEX "ErrorLog_userId_createdAt_idx" ON "ErrorLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ErrorLog_createdAt_idx" ON "ErrorLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ContentSeed_name_key" ON "ContentSeed"("name");

-- CreateIndex
CREATE INDEX "ContentRelease_entity_entityId_idx" ON "ContentRelease"("entity", "entityId");

-- CreateIndex
CREATE INDEX "ContentRelease_createdAt_idx" ON "ContentRelease"("createdAt");

-- CreateIndex
CREATE INDEX "ContentRelease_bySeed_idx" ON "ContentRelease"("bySeed");

-- CreateIndex
CREATE UNIQUE INDEX "Experiment_key_key" ON "Experiment"("key");

-- CreateIndex
CREATE INDEX "Experiment_isActive_idx" ON "Experiment"("isActive");

-- CreateIndex
CREATE INDEX "ExperimentExposure_experimentKey_variant_idx" ON "ExperimentExposure"("experimentKey", "variant");

-- CreateIndex
CREATE INDEX "ExperimentExposure_firstSeenAt_idx" ON "ExperimentExposure"("firstSeenAt");

-- CreateIndex
CREATE UNIQUE INDEX "ExperimentExposure_experimentKey_userId_key" ON "ExperimentExposure"("experimentKey", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "ExperimentExposure_experimentKey_sessionId_key" ON "ExperimentExposure"("experimentKey", "sessionId");

-- CreateIndex
CREATE INDEX "Feedback_status_createdAt_idx" ON "Feedback"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Feedback_userId_createdAt_idx" ON "Feedback"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Feedback_kind_createdAt_idx" ON "Feedback"("kind", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PracticeCategory_key_key" ON "PracticeCategory"("key");

-- CreateIndex
CREATE INDEX "PracticeProject_scope_classId_idx" ON "PracticeProject"("scope", "classId");

-- CreateIndex
CREATE INDEX "PracticeProject_scope_ownerId_idx" ON "PracticeProject"("scope", "ownerId");

-- CreateIndex
CREATE INDEX "PracticeProject_categoryId_scope_idx" ON "PracticeProject"("categoryId", "scope");

-- CreateIndex
CREATE INDEX "PracticeEntry_userId_createdAt_idx" ON "PracticeEntry"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "PracticeEntry_userId_projectId_createdAt_idx" ON "PracticeEntry"("userId", "projectId", "createdAt");

-- CreateIndex
CREATE INDEX "PracticeEntry_userId_categoryId_createdAt_idx" ON "PracticeEntry"("userId", "categoryId", "createdAt");

-- CreateIndex
CREATE INDEX "PracticeDailySummary_userId_date_idx" ON "PracticeDailySummary"("userId", "date");

-- CreateIndex
CREATE INDEX "PracticeDailySummary_userId_categoryId_date_idx" ON "PracticeDailySummary"("userId", "categoryId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "PracticeDailySummary_userId_projectId_date_key" ON "PracticeDailySummary"("userId", "projectId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "PracticeGoal_userId_projectId_key" ON "PracticeGoal"("userId", "projectId");

-- CreateIndex
CREATE INDEX "PracticeTask_scope_classId_archivedAt_idx" ON "PracticeTask"("scope", "classId", "archivedAt");

-- CreateIndex
CREATE INDEX "PracticeTask_scope_userId_archivedAt_idx" ON "PracticeTask"("scope", "userId", "archivedAt");

-- CreateIndex
CREATE INDEX "PracticeMakeup_userId_createdAt_idx" ON "PracticeMakeup"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PracticeMakeup_userId_date_key" ON "PracticeMakeup"("userId", "date");

-- CreateIndex
CREATE INDEX "ClassAnnouncement_classId_archivedAt_pinnedAt_createdAt_idx" ON "ClassAnnouncement"("classId", "archivedAt", "pinnedAt", "createdAt");

-- CreateIndex
CREATE INDEX "ClassAnnouncement_authorId_idx" ON "ClassAnnouncement"("authorId");

-- CreateIndex
CREATE INDEX "LessonReadingProgress_userId_lastReadAt_idx" ON "LessonReadingProgress"("userId", "lastReadAt");

-- CreateIndex
CREATE INDEX "LessonReadingProgress_userId_courseId_idx" ON "LessonReadingProgress"("userId", "courseId");

-- CreateIndex
CREATE INDEX "LessonReadingProgress_userId_isCompleted_idx" ON "LessonReadingProgress"("userId", "isCompleted");

-- CreateIndex
CREATE UNIQUE INDEX "LessonReadingProgress_userId_lessonId_key" ON "LessonReadingProgress"("userId", "lessonId");

-- CreateIndex
CREATE UNIQUE INDEX "TibetanDay_date_key" ON "TibetanDay"("date");

-- CreateIndex
CREATE INDEX "TibetanDay_date_idx" ON "TibetanDay"("date");

-- CreateIndex
CREATE INDEX "TibetanDay_auspicious_idx" ON "TibetanDay"("auspicious");

-- CreateIndex
CREATE INDEX "Note_userId_updatedAt_idx" ON "Note"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "Note_userId_lessonId_idx" ON "Note"("userId", "lessonId");

-- CreateIndex
CREATE INDEX "Note_userId_archivedAt_idx" ON "Note"("userId", "archivedAt");

-- CreateIndex
CREATE INDEX "Note_visibility_updatedAt_idx" ON "Note"("visibility", "updatedAt");

-- CreateIndex
CREATE INDEX "Note_lessonId_anchorIndex_idx" ON "Note"("lessonId", "anchorIndex");

-- CreateIndex
CREATE INDEX "NoteReport_status_createdAt_idx" ON "NoteReport"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "NoteReport_noteId_reporterId_key" ON "NoteReport"("noteId", "reporterId");

-- CreateIndex
CREATE INDEX "Highlight_userId_lessonId_idx" ON "Highlight"("userId", "lessonId");

-- CreateIndex
CREATE INDEX "Highlight_lessonId_paragraphIndex_idx" ON "Highlight"("lessonId", "paragraphIndex");

-- CreateIndex
CREATE INDEX "HomePoster_year_month_idx" ON "HomePoster"("year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "HomePoster_year_month_key" ON "HomePoster"("year", "month");

-- CreateIndex
CREATE INDEX "DharmaAssembly_startAt_endAt_deletedAt_idx" ON "DharmaAssembly"("startAt", "endAt", "deletedAt");

-- CreateIndex
CREATE INDEX "DharmaAssembly_createdAt_idx" ON "DharmaAssembly"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationPreference_userId_key" ON "NotificationPreference"("userId");

-- CreateIndex
CREATE INDEX "UserAchievementUnlock_userId_notifiedAt_idx" ON "UserAchievementUnlock"("userId", "notifiedAt");

-- CreateIndex
CREATE INDEX "UserAchievementUnlock_unlockedAt_idx" ON "UserAchievementUnlock"("unlockedAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserAchievementUnlock_userId_badgeId_key" ON "UserAchievementUnlock"("userId", "badgeId");

-- CreateIndex
CREATE INDEX "SystemAnnouncement_revokedAt_expiresAt_idx" ON "SystemAnnouncement"("revokedAt", "expiresAt");

-- CreateIndex
CREATE INDEX "SystemAnnouncement_createdAt_idx" ON "SystemAnnouncement"("createdAt");

-- CreateIndex
CREATE INDEX "OrphanedFile_markedAt_idx" ON "OrphanedFile"("markedAt");

-- AddForeignKey
ALTER TABLE "Class" ADD CONSTRAINT "Class_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassMember" ADD CONSTRAINT "ClassMember_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassMember" ADD CONSTRAINT "ClassMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailVerificationToken" ADD CONSTRAINT "EmailVerificationToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassSession" ADD CONSTRAINT "ClassSession_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chapter" ADD CONSTRAINT "Chapter_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCourseEnrollment" ADD CONSTRAINT "UserCourseEnrollment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCourseEnrollment" ADD CONSTRAINT "UserCourseEnrollment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCourseEnrollment" ADD CONSTRAINT "UserCourseEnrollment_enrolledViaClassId_fkey" FOREIGN KEY ("enrolledViaClassId") REFERENCES "Class"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meditation" ADD CONSTRAINT "Meditation_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meditation" ADD CONSTRAINT "Meditation_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeditationSession" ADD CONSTRAINT "MeditationSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeditationSession" ADD CONSTRAINT "MeditationSession_meditationId_fkey" FOREIGN KEY ("meditationId") REFERENCES "Meditation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_ownerClassId_fkey" FOREIGN KEY ("ownerClassId") REFERENCES "Class"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAnswer" ADD CONSTRAINT "UserAnswer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAnswer" ADD CONSTRAINT "UserAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAnswer" ADD CONSTRAINT "UserAnswer_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sm2Card" ADD CONSTRAINT "Sm2Card_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sm2Card" ADD CONSTRAINT "Sm2Card_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sm2Card" ADD CONSTRAINT "Sm2Card_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserFavorite" ADD CONSTRAINT "UserFavorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserFavorite" ADD CONSTRAINT "UserFavorite_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserMistakeBook" ADD CONSTRAINT "UserMistakeBook_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserMistakeBook" ADD CONSTRAINT "UserMistakeBook_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionReport" ADD CONSTRAINT "QuestionReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionReport" ADD CONSTRAINT "QuestionReport_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LlmProviderUsage" ADD CONSTRAINT "LlmProviderUsage_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "LlmProviderConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExperimentExposure" ADD CONSTRAINT "ExperimentExposure_experimentKey_fkey" FOREIGN KEY ("experimentKey") REFERENCES "Experiment"("key") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_handledByUserId_fkey" FOREIGN KEY ("handledByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PracticeProject" ADD CONSTRAINT "PracticeProject_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "PracticeCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PracticeProject" ADD CONSTRAINT "PracticeProject_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PracticeProject" ADD CONSTRAINT "PracticeProject_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PracticeEntry" ADD CONSTRAINT "PracticeEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PracticeEntry" ADD CONSTRAINT "PracticeEntry_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "PracticeProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PracticeDailySummary" ADD CONSTRAINT "PracticeDailySummary_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PracticeDailySummary" ADD CONSTRAINT "PracticeDailySummary_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "PracticeProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PracticeGoal" ADD CONSTRAINT "PracticeGoal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PracticeGoal" ADD CONSTRAINT "PracticeGoal_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "PracticeProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PracticeTask" ADD CONSTRAINT "PracticeTask_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "PracticeProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PracticeTask" ADD CONSTRAINT "PracticeTask_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PracticeMakeup" ADD CONSTRAINT "PracticeMakeup_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassAnnouncement" ADD CONSTRAINT "ClassAnnouncement_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonReadingProgress" ADD CONSTRAINT "LessonReadingProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonReadingProgress" ADD CONSTRAINT "LessonReadingProgress_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteReport" ADD CONSTRAINT "NoteReport_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "Note"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteReport" ADD CONSTRAINT "NoteReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Highlight" ADD CONSTRAINT "Highlight_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Highlight" ADD CONSTRAINT "Highlight_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAchievementUnlock" ADD CONSTRAINT "UserAchievementUnlock_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

