-- CreateTable
CREATE TABLE "Email" (
    "EmailId" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "from" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "cc" TEXT,
    "subject" TEXT,
    "emailText" TEXT,
    "templatePath" TEXT,
    "emailHtmlFileFullPath" TEXT,
    "status" TEXT DEFAULT 'PENDING',
    "createdByUserId" INTEGER,
    "createdByUserUsername" TEXT,
    "createdByUserFullName" TEXT,
    "updatedByUserId" INTEGER,
    "updatedByUserUsername" TEXT,
    "updatedByUserFullName" TEXT,
    "createdAt" DATETIME DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME,
    "deleted" BOOLEAN DEFAULT false,
    CONSTRAINT "Email_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("userId") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Email_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User" ("userId") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Job" (
    "jobId" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT,
    "handler" TEXT NOT NULL,
    "handlerType" TEXT NOT NULL DEFAULT 'HANDLER_NAME',
    "argumentJson" TEXT,
    "designatedDate" DATETIME NOT NULL,
    "cronSchedule" TEXT,
    "repeatCount" INTEGER DEFAULT -1,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "output" TEXT,
    "createdByUserId" INTEGER,
    "createdByUserUsername" TEXT,
    "createdByUserFullName" TEXT,
    "updatedByUserId" INTEGER,
    "updatedByUserUsername" TEXT,
    "updatedByUserFullName" TEXT,
    "createdAt" DATETIME DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME,
    "deleted" BOOLEAN DEFAULT false,
    CONSTRAINT "Job_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("userId") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Job_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User" ("userId") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "File" (
    "fileId" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "mimetype" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "path" TEXT NOT NULL,
    "createdByUserId" INTEGER,
    "createdByUserUsername" TEXT,
    "createdByUserFullName" TEXT,
    "updatedByUserId" INTEGER,
    "updatedByUserUsername" TEXT,
    "updatedByUserFullName" TEXT,
    "createdAt" DATETIME DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME,
    "deleted" BOOLEAN DEFAULT false,
    CONSTRAINT "File_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("userId") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "File_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User" ("userId") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CommentAttachment" (
    "attachmentId" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "commentId" INTEGER NOT NULL,
    "attachmentFileId" INTEGER NOT NULL,
    "createdByUserId" INTEGER,
    "createdByUserUsername" TEXT,
    "createdByUserFullName" TEXT,
    "updatedByUserId" INTEGER,
    "updatedByUserUsername" TEXT,
    "updatedByUserFullName" TEXT,
    "createdAt" DATETIME DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME,
    "deleted" BOOLEAN DEFAULT false,
    CONSTRAINT "CommentAttachment_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "Comments" ("commentId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CommentAttachment_attachmentFileId_fkey" FOREIGN KEY ("attachmentFileId") REFERENCES "File" ("fileId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CommentAttachment_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("userId") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CommentAttachment_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User" ("userId") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Comments" (
    "commentId" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "commentText" TEXT,
    "commentSource" TEXT NOT NULL,
    "commentSourceId" INTEGER,
    "byUser" INTEGER,
    "byUsername" TEXT,
    "createdByUserId" INTEGER,
    "createdByUserUsername" TEXT,
    "createdByUserFullName" TEXT,
    "updatedByUserId" INTEGER,
    "updatedByUserUsername" TEXT,
    "updatedByUserFullName" TEXT,
    "createdAt" DATETIME DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME,
    "deleted" BOOLEAN DEFAULT false,
    CONSTRAINT "Comments_byUser_fkey" FOREIGN KEY ("byUser") REFERENCES "User" ("userId") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Comments_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("userId") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Comments_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User" ("userId") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Device" (
    "deviceId" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "deviceToken" TEXT NOT NULL,
    "userId" INTEGER,
    "createdByUserId" INTEGER,
    "createdByUserUsername" TEXT,
    "createdByUserFullName" TEXT,
    "updatedByUserId" INTEGER,
    "updatedByUserUsername" TEXT,
    "updatedByUserFullName" TEXT,
    "createdAt" DATETIME DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME,
    "deleted" BOOLEAN DEFAULT false,
    CONSTRAINT "Device_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("userId") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Device_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("userId") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Device_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User" ("userId") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NotificationToken" (
    "notificationTokenId" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "token" TEXT,
    "deviceId" INTEGER,
    "createdByUserId" INTEGER,
    "createdByUserUsername" TEXT,
    "createdByUserFullName" TEXT,
    "updatedByUserId" INTEGER,
    "updatedByUserUsername" TEXT,
    "updatedByUserFullName" TEXT,
    "createdAt" DATETIME DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME,
    "deleted" BOOLEAN DEFAULT false,
    CONSTRAINT "NotificationToken_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device" ("deviceId") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "NotificationToken_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("userId") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "NotificationToken_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User" ("userId") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Notification" (
    "notificationId" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "notificationTokensId" TEXT NOT NULL,
    "dataJson" TEXT,
    "notificationJson" TEXT,
    "createdByUserId" INTEGER,
    "createdByUserUsername" TEXT,
    "createdByUserFullName" TEXT,
    "updatedByUserId" INTEGER,
    "updatedByUserUsername" TEXT,
    "updatedByUserFullName" TEXT,
    "createdAt" DATETIME DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME,
    "deleted" BOOLEAN DEFAULT false,
    CONSTRAINT "Notification_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("userId") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Notification_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User" ("userId") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Log" (
    "logId" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "level" INTEGER NOT NULL,
    "title" TEXT,
    "logText" TEXT,
    "source" TEXT,
    "createdByUserId" INTEGER,
    "createdByUserUsername" TEXT,
    "createdByUserFullName" TEXT,
    "updatedByUserId" INTEGER,
    "updatedByUserUsername" TEXT,
    "updatedByUserFullName" TEXT,
    "createdAt" DATETIME DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME,
    "deleted" BOOLEAN DEFAULT false,
    CONSTRAINT "Log_level_fkey" FOREIGN KEY ("level") REFERENCES "LogLevel" ("levelId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Log_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("userId") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Log_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User" ("userId") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LogLevel" (
    "levelId" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdByUserId" INTEGER,
    "createdByUserUsername" TEXT,
    "createdByUserFullName" TEXT,
    "updatedByUserId" INTEGER,
    "updatedByUserUsername" TEXT,
    "updatedByUserFullName" TEXT,
    "createdAt" DATETIME DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME,
    "deleted" BOOLEAN DEFAULT false,
    CONSTRAINT "LogLevel_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("userId") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "LogLevel_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User" ("userId") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserNotification" (
    "notificationId" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT,
    "contents" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "userId" INTEGER NOT NULL,
    "notificationResourceId" INTEGER,
    "createdByUserId" INTEGER,
    "createdByUserUsername" TEXT,
    "createdByUserFullName" TEXT,
    "updatedByUserId" INTEGER,
    "updatedByUserUsername" TEXT,
    "updatedByUserFullName" TEXT,
    "createdAt" DATETIME DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME,
    "deleted" BOOLEAN DEFAULT false,
    CONSTRAINT "UserNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("userId") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserNotification_notificationResourceId_fkey" FOREIGN KEY ("notificationResourceId") REFERENCES "NotificationResource" ("resourceId") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "UserNotification_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("userId") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "UserNotification_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User" ("userId") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NotificationResource" (
    "resourceId" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "contents" TEXT NOT NULL,
    "createdByUserId" INTEGER,
    "createdByUserUsername" TEXT,
    "createdByUserFullName" TEXT,
    "updatedByUserId" INTEGER,
    "updatedByUserUsername" TEXT,
    "updatedByUserFullName" TEXT,
    "createdAt" DATETIME DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME,
    "deleted" BOOLEAN DEFAULT false,
    CONSTRAINT "NotificationResource_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("userId") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "NotificationResource_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User" ("userId") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserNotificationTag" (
    "relationId" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "tagId" INTEGER,
    "notificationId" INTEGER,
    "notificationResourceId" INTEGER,
    "createdByUserId" INTEGER,
    "createdByUserUsername" TEXT,
    "createdByUserFullName" TEXT,
    "updatedByUserId" INTEGER,
    "updatedByUserUsername" TEXT,
    "updatedByUserFullName" TEXT,
    "createdAt" DATETIME DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME,
    "deleted" BOOLEAN DEFAULT false,
    CONSTRAINT "UserNotificationTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "NotificationTag" ("tagId") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "UserNotificationTag_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "UserNotification" ("notificationId") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "UserNotificationTag_notificationResourceId_fkey" FOREIGN KEY ("notificationResourceId") REFERENCES "NotificationResource" ("resourceId") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "UserNotificationTag_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("userId") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "UserNotificationTag_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User" ("userId") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NotificationTag" (
    "tagId" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "color" TEXT,
    "label" TEXT,
    "createdByUserId" INTEGER,
    "createdByUserUsername" TEXT,
    "createdByUserFullName" TEXT,
    "updatedByUserId" INTEGER,
    "updatedByUserUsername" TEXT,
    "updatedByUserFullName" TEXT,
    "createdAt" DATETIME DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME,
    "deleted" BOOLEAN DEFAULT false,
    CONSTRAINT "NotificationTag_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("userId") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "NotificationTag_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User" ("userId") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserAuthority" (
    "authorityId" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "keyName" TEXT NOT NULL,
    "userId" INTEGER,
    "all" BOOLEAN NOT NULL DEFAULT true,
    "createdByUserId" INTEGER,
    "createdByUserUsername" TEXT,
    "createdByUserFullName" TEXT,
    "updatedByUserId" INTEGER,
    "updatedByUserUsername" TEXT,
    "updatedByUserFullName" TEXT,
    "createdAt" DATETIME DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME,
    "deleted" BOOLEAN DEFAULT false,
    CONSTRAINT "UserAuthority_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("userId") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "UserAuthority_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("userId") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "UserAuthority_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User" ("userId") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserDynamicAuthority" (
    "dynamicAuthorityId" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "dynamicAuthorityKey" TEXT NOT NULL,
    "all" BOOLEAN NOT NULL DEFAULT true,
    "authorityId" INTEGER,
    "createdByUserId" INTEGER,
    "createdByUserUsername" TEXT,
    "createdByUserFullName" TEXT,
    "updatedByUserId" INTEGER,
    "updatedByUserUsername" TEXT,
    "updatedByUserFullName" TEXT,
    "createdAt" DATETIME DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME,
    "deleted" BOOLEAN DEFAULT false,
    CONSTRAINT "UserDynamicAuthority_authorityId_fkey" FOREIGN KEY ("authorityId") REFERENCES "UserAuthority" ("authorityId") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "UserDynamicAuthority_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("userId") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "UserDynamicAuthority_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User" ("userId") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserDynamicAuthorityValue" (
    "valueId" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "value" TEXT NOT NULL,
    "dynamicAuthorityId" INTEGER,
    "createdByUserId" INTEGER,
    "createdByUserUsername" TEXT,
    "createdByUserFullName" TEXT,
    "updatedByUserId" INTEGER,
    "updatedByUserUsername" TEXT,
    "updatedByUserFullName" TEXT,
    "createdAt" DATETIME DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME,
    "deleted" BOOLEAN DEFAULT false,
    CONSTRAINT "UserDynamicAuthorityValue_dynamicAuthorityId_fkey" FOREIGN KEY ("dynamicAuthorityId") REFERENCES "UserDynamicAuthority" ("dynamicAuthorityId") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "UserDynamicAuthorityValue_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("userId") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "UserDynamicAuthorityValue_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User" ("userId") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuthoritiesProfile" (
    "profileId" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "defaultHomePageName" TEXT,
    "createdByUserId" INTEGER,
    "createdByUserUsername" TEXT,
    "createdByUserFullName" TEXT,
    "updatedByUserId" INTEGER,
    "updatedByUserUsername" TEXT,
    "updatedByUserFullName" TEXT,
    "createdAt" DATETIME DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME,
    "deleted" BOOLEAN DEFAULT false,
    CONSTRAINT "AuthoritiesProfile_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("userId") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AuthoritiesProfile_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User" ("userId") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProfileAuthority" (
    "authorityId" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "keyName" TEXT NOT NULL,
    "profileId" INTEGER,
    "all" BOOLEAN NOT NULL DEFAULT true,
    "createdByUserId" INTEGER,
    "createdByUserUsername" TEXT,
    "createdByUserFullName" TEXT,
    "updatedByUserId" INTEGER,
    "updatedByUserUsername" TEXT,
    "updatedByUserFullName" TEXT,
    "createdAt" DATETIME DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME,
    "deleted" BOOLEAN DEFAULT false,
    CONSTRAINT "ProfileAuthority_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "AuthoritiesProfile" ("profileId") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ProfileAuthority_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("userId") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ProfileAuthority_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User" ("userId") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProfileDynamicAuthority" (
    "dynamicAuthorityId" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "dynamicAuthorityKey" TEXT NOT NULL,
    "all" BOOLEAN NOT NULL DEFAULT true,
    "authorityId" INTEGER,
    "createdByUserId" INTEGER,
    "createdByUserUsername" TEXT,
    "createdByUserFullName" TEXT,
    "updatedByUserId" INTEGER,
    "updatedByUserUsername" TEXT,
    "updatedByUserFullName" TEXT,
    "createdAt" DATETIME DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME,
    "deleted" BOOLEAN DEFAULT false,
    CONSTRAINT "ProfileDynamicAuthority_authorityId_fkey" FOREIGN KEY ("authorityId") REFERENCES "ProfileAuthority" ("authorityId") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ProfileDynamicAuthority_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("userId") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ProfileDynamicAuthority_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User" ("userId") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProfileDynamicAuthorityValue" (
    "valueId" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "value" TEXT NOT NULL,
    "dynamicAuthorityId" INTEGER,
    "createdByUserId" INTEGER,
    "createdByUserUsername" TEXT,
    "createdByUserFullName" TEXT,
    "updatedByUserId" INTEGER,
    "updatedByUserUsername" TEXT,
    "updatedByUserFullName" TEXT,
    "createdAt" DATETIME DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME,
    "deleted" BOOLEAN DEFAULT false,
    CONSTRAINT "ProfileDynamicAuthorityValue_dynamicAuthorityId_fkey" FOREIGN KEY ("dynamicAuthorityId") REFERENCES "ProfileDynamicAuthority" ("dynamicAuthorityId") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ProfileDynamicAuthorityValue_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("userId") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ProfileDynamicAuthorityValue_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User" ("userId") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserLog" (
    "logId" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER,
    "summary" TEXT,
    "titleDisplay" TEXT,
    "title" TEXT,
    "model" TEXT,
    "modelKey" TEXT,
    "modelId" INTEGER,
    "variables" TEXT,
    "createdByUserId" INTEGER,
    "createdByUserUsername" TEXT,
    "createdByUserFullName" TEXT,
    "updatedByUserId" INTEGER,
    "updatedByUserUsername" TEXT,
    "updatedByUserFullName" TEXT,
    "createdAt" DATETIME DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME,
    "deleted" BOOLEAN DEFAULT false,
    CONSTRAINT "UserLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("userId") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "UserLog_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("userId") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "UserLog_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User" ("userId") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Country" (
    "countryId" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdByUserId" INTEGER,
    "createdByUserUsername" TEXT,
    "createdByUserFullName" TEXT,
    "updatedByUserId" INTEGER,
    "updatedByUserUsername" TEXT,
    "updatedByUserFullName" TEXT,
    "createdAt" DATETIME DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME,
    "deleted" BOOLEAN DEFAULT false,
    CONSTRAINT "Country_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("userId") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Country_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User" ("userId") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "City" (
    "cityId" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "countryId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdByUserId" INTEGER,
    "createdByUserUsername" TEXT,
    "createdByUserFullName" TEXT,
    "updatedByUserId" INTEGER,
    "updatedByUserUsername" TEXT,
    "updatedByUserFullName" TEXT,
    "createdAt" DATETIME DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME,
    "deleted" BOOLEAN DEFAULT false,
    CONSTRAINT "City_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country" ("countryId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "City_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("userId") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "City_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User" ("userId") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Region" (
    "regionId" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "cityId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "createdByUserId" INTEGER,
    "createdByUserUsername" TEXT,
    "createdByUserFullName" TEXT,
    "updatedByUserId" INTEGER,
    "updatedByUserUsername" TEXT,
    "updatedByUserFullName" TEXT,
    "createdAt" DATETIME DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME,
    "deleted" BOOLEAN DEFAULT false,
    CONSTRAINT "Region_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City" ("cityId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Region_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("userId") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Region_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User" ("userId") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "User" (
    "userId" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "lastOnline" DATETIME,
    "lastOffline" DATETIME,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "fullName" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "unverifiedEmail" TEXT,
    "email" TEXT,
    "unverifiedPhone" TEXT,
    "phone" TEXT,
    "userType" TEXT NOT NULL,
    "regionId" INTEGER,
    "nearestPoint" TEXT,
    "defaultHomePageName" TEXT,
    "authorizationProfileId" INTEGER,
    "createdByUserId" INTEGER,
    "createdByUserUsername" TEXT,
    "createdByUserFullName" TEXT,
    "updatedByUserId" INTEGER,
    "updatedByUserUsername" TEXT,
    "updatedByUserFullName" TEXT,
    "createdAt" DATETIME DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME,
    "deleted" BOOLEAN DEFAULT false,
    CONSTRAINT "User_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region" ("regionId") ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT "User_authorizationProfileId_fkey" FOREIGN KEY ("authorizationProfileId") REFERENCES "AuthoritiesProfile" ("profileId") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "User_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("userId") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "User_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User" ("userId") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Email_from_idx" ON "Email"("from");

-- CreateIndex
CREATE INDEX "Email_to_idx" ON "Email"("to");

-- CreateIndex
CREATE INDEX "Email_subject_idx" ON "Email"("subject");

-- CreateIndex
CREATE INDEX "Email_status_idx" ON "Email"("status");

-- CreateIndex
CREATE INDEX "Email_createdByUserId_idx" ON "Email"("createdByUserId");

-- CreateIndex
CREATE INDEX "Email_updatedByUserId_idx" ON "Email"("updatedByUserId");

-- CreateIndex
CREATE INDEX "Email_deleted_idx" ON "Email"("deleted");

-- CreateIndex
CREATE INDEX "Job_title_idx" ON "Job"("title");

-- CreateIndex
CREATE INDEX "Job_handlerType_idx" ON "Job"("handlerType");

-- CreateIndex
CREATE INDEX "Job_designatedDate_idx" ON "Job"("designatedDate");

-- CreateIndex
CREATE INDEX "Job_cronSchedule_idx" ON "Job"("cronSchedule");

-- CreateIndex
CREATE INDEX "Job_repeatCount_idx" ON "Job"("repeatCount");

-- CreateIndex
CREATE INDEX "Job_status_idx" ON "Job"("status");

-- CreateIndex
CREATE INDEX "Job_createdByUserId_idx" ON "Job"("createdByUserId");

-- CreateIndex
CREATE INDEX "Job_updatedByUserId_idx" ON "Job"("updatedByUserId");

-- CreateIndex
CREATE INDEX "Job_deleted_idx" ON "Job"("deleted");

-- CreateIndex
CREATE INDEX "File_name_idx" ON "File"("name");

-- CreateIndex
CREATE INDEX "File_mimetype_idx" ON "File"("mimetype");

-- CreateIndex
CREATE INDEX "File_path_idx" ON "File"("path");

-- CreateIndex
CREATE INDEX "File_createdByUserId_idx" ON "File"("createdByUserId");

-- CreateIndex
CREATE INDEX "File_updatedByUserId_idx" ON "File"("updatedByUserId");

-- CreateIndex
CREATE INDEX "File_deleted_idx" ON "File"("deleted");

-- CreateIndex
CREATE INDEX "commentId" ON "CommentAttachment"("commentId");

-- CreateIndex
CREATE INDEX "CommentAttachment_createdByUserId_idx" ON "CommentAttachment"("createdByUserId");

-- CreateIndex
CREATE INDEX "CommentAttachment_updatedByUserId_idx" ON "CommentAttachment"("updatedByUserId");

-- CreateIndex
CREATE INDEX "CommentAttachment_deleted_idx" ON "CommentAttachment"("deleted");

-- CreateIndex
CREATE INDEX "byUser" ON "Comments"("byUser");

-- CreateIndex
CREATE INDEX "Comments_createdByUserId_idx" ON "Comments"("createdByUserId");

-- CreateIndex
CREATE INDEX "Comments_updatedByUserId_idx" ON "Comments"("updatedByUserId");

-- CreateIndex
CREATE INDEX "Comments_deleted_idx" ON "Comments"("deleted");

-- CreateIndex
CREATE INDEX "Device_deviceToken_idx" ON "Device"("deviceToken");

-- CreateIndex
CREATE INDEX "userId" ON "Device"("userId");

-- CreateIndex
CREATE INDEX "Device_createdByUserId_idx" ON "Device"("createdByUserId");

-- CreateIndex
CREATE INDEX "Device_updatedByUserId_idx" ON "Device"("updatedByUserId");

-- CreateIndex
CREATE INDEX "Device_deleted_idx" ON "Device"("deleted");

-- CreateIndex
CREATE INDEX "NotificationToken_token_idx" ON "NotificationToken"("token");

-- CreateIndex
CREATE INDEX "NotificationToken_deviceId_idx" ON "NotificationToken"("deviceId");

-- CreateIndex
CREATE INDEX "NotificationToken_createdByUserId_idx" ON "NotificationToken"("createdByUserId");

-- CreateIndex
CREATE INDEX "NotificationToken_updatedByUserId_idx" ON "NotificationToken"("updatedByUserId");

-- CreateIndex
CREATE INDEX "NotificationToken_deleted_idx" ON "NotificationToken"("deleted");

-- CreateIndex
CREATE INDEX "Notification_createdByUserId_idx" ON "Notification"("createdByUserId");

-- CreateIndex
CREATE INDEX "Notification_updatedByUserId_idx" ON "Notification"("updatedByUserId");

-- CreateIndex
CREATE INDEX "Notification_deleted_idx" ON "Notification"("deleted");

-- CreateIndex
CREATE INDEX "Log_level_idx" ON "Log"("level");

-- CreateIndex
CREATE INDEX "Log_title_idx" ON "Log"("title");

-- CreateIndex
CREATE INDEX "level" ON "Log"("level");

-- CreateIndex
CREATE INDEX "Log_createdByUserId_idx" ON "Log"("createdByUserId");

-- CreateIndex
CREATE INDEX "Log_updatedByUserId_idx" ON "Log"("updatedByUserId");

-- CreateIndex
CREATE INDEX "Log_deleted_idx" ON "Log"("deleted");

-- CreateIndex
CREATE INDEX "LogLevel_createdByUserId_idx" ON "LogLevel"("createdByUserId");

-- CreateIndex
CREATE INDEX "LogLevel_updatedByUserId_idx" ON "LogLevel"("updatedByUserId");

-- CreateIndex
CREATE INDEX "LogLevel_deleted_idx" ON "LogLevel"("deleted");

-- CreateIndex
CREATE INDEX "UserNotification_userId_idx" ON "UserNotification"("userId");

-- CreateIndex
CREATE INDEX "UserNotification_createdByUserId_idx" ON "UserNotification"("createdByUserId");

-- CreateIndex
CREATE INDEX "UserNotification_updatedByUserId_idx" ON "UserNotification"("updatedByUserId");

-- CreateIndex
CREATE INDEX "UserNotification_deleted_idx" ON "UserNotification"("deleted");

-- CreateIndex
CREATE INDEX "NotificationResource_createdByUserId_idx" ON "NotificationResource"("createdByUserId");

-- CreateIndex
CREATE INDEX "NotificationResource_updatedByUserId_idx" ON "NotificationResource"("updatedByUserId");

-- CreateIndex
CREATE INDEX "NotificationResource_deleted_idx" ON "NotificationResource"("deleted");

-- CreateIndex
CREATE INDEX "UserNotificationTag_notificationId_idx" ON "UserNotificationTag"("notificationId");

-- CreateIndex
CREATE INDEX "UserNotificationTag_notificationResourceId_idx" ON "UserNotificationTag"("notificationResourceId");

-- CreateIndex
CREATE INDEX "UserNotificationTag_tagId_idx" ON "UserNotificationTag"("tagId");

-- CreateIndex
CREATE INDEX "UserNotificationTag_createdByUserId_idx" ON "UserNotificationTag"("createdByUserId");

-- CreateIndex
CREATE INDEX "UserNotificationTag_updatedByUserId_idx" ON "UserNotificationTag"("updatedByUserId");

-- CreateIndex
CREATE INDEX "UserNotificationTag_deleted_idx" ON "UserNotificationTag"("deleted");

-- CreateIndex
CREATE INDEX "NotificationTag_createdByUserId_idx" ON "NotificationTag"("createdByUserId");

-- CreateIndex
CREATE INDEX "NotificationTag_updatedByUserId_idx" ON "NotificationTag"("updatedByUserId");

-- CreateIndex
CREATE INDEX "NotificationTag_deleted_idx" ON "NotificationTag"("deleted");

-- CreateIndex
CREATE INDEX "UserAuthority_keyName_idx" ON "UserAuthority"("keyName");

-- CreateIndex
CREATE INDEX "UserAuthority_userId_idx" ON "UserAuthority"("userId");

-- CreateIndex
CREATE INDEX "UserAuthority_createdByUserId_idx" ON "UserAuthority"("createdByUserId");

-- CreateIndex
CREATE INDEX "UserAuthority_updatedByUserId_idx" ON "UserAuthority"("updatedByUserId");

-- CreateIndex
CREATE INDEX "UserAuthority_deleted_idx" ON "UserAuthority"("deleted");

-- CreateIndex
CREATE INDEX "UserDynamicAuthority_dynamicAuthorityKey_idx" ON "UserDynamicAuthority"("dynamicAuthorityKey");

-- CreateIndex
CREATE INDEX "UserDynamicAuthority_authorityId_idx" ON "UserDynamicAuthority"("authorityId");

-- CreateIndex
CREATE INDEX "UserDynamicAuthority_createdByUserId_idx" ON "UserDynamicAuthority"("createdByUserId");

-- CreateIndex
CREATE INDEX "UserDynamicAuthority_updatedByUserId_idx" ON "UserDynamicAuthority"("updatedByUserId");

-- CreateIndex
CREATE INDEX "UserDynamicAuthority_deleted_idx" ON "UserDynamicAuthority"("deleted");

-- CreateIndex
CREATE INDEX "UserDynamicAuthorityValue_dynamicAuthorityId_idx" ON "UserDynamicAuthorityValue"("dynamicAuthorityId");

-- CreateIndex
CREATE INDEX "UserDynamicAuthorityValue_createdByUserId_idx" ON "UserDynamicAuthorityValue"("createdByUserId");

-- CreateIndex
CREATE INDEX "UserDynamicAuthorityValue_updatedByUserId_idx" ON "UserDynamicAuthorityValue"("updatedByUserId");

-- CreateIndex
CREATE INDEX "UserDynamicAuthorityValue_deleted_idx" ON "UserDynamicAuthorityValue"("deleted");

-- CreateIndex
CREATE INDEX "AuthoritiesProfile_createdByUserId_idx" ON "AuthoritiesProfile"("createdByUserId");

-- CreateIndex
CREATE INDEX "AuthoritiesProfile_updatedByUserId_idx" ON "AuthoritiesProfile"("updatedByUserId");

-- CreateIndex
CREATE INDEX "AuthoritiesProfile_deleted_idx" ON "AuthoritiesProfile"("deleted");

-- CreateIndex
CREATE INDEX "ProfileAuthority_keyName_idx" ON "ProfileAuthority"("keyName");

-- CreateIndex
CREATE INDEX "ProfileAuthority_profileId_idx" ON "ProfileAuthority"("profileId");

-- CreateIndex
CREATE INDEX "ProfileAuthority_createdByUserId_idx" ON "ProfileAuthority"("createdByUserId");

-- CreateIndex
CREATE INDEX "ProfileAuthority_updatedByUserId_idx" ON "ProfileAuthority"("updatedByUserId");

-- CreateIndex
CREATE INDEX "ProfileAuthority_deleted_idx" ON "ProfileAuthority"("deleted");

-- CreateIndex
CREATE INDEX "ProfileDynamicAuthority_dynamicAuthorityKey_idx" ON "ProfileDynamicAuthority"("dynamicAuthorityKey");

-- CreateIndex
CREATE INDEX "ProfileDynamicAuthority_authorityId_idx" ON "ProfileDynamicAuthority"("authorityId");

-- CreateIndex
CREATE INDEX "ProfileDynamicAuthority_createdByUserId_idx" ON "ProfileDynamicAuthority"("createdByUserId");

-- CreateIndex
CREATE INDEX "ProfileDynamicAuthority_updatedByUserId_idx" ON "ProfileDynamicAuthority"("updatedByUserId");

-- CreateIndex
CREATE INDEX "ProfileDynamicAuthority_deleted_idx" ON "ProfileDynamicAuthority"("deleted");

-- CreateIndex
CREATE INDEX "ProfileDynamicAuthorityValue_dynamicAuthorityId_idx" ON "ProfileDynamicAuthorityValue"("dynamicAuthorityId");

-- CreateIndex
CREATE INDEX "ProfileDynamicAuthorityValue_createdByUserId_idx" ON "ProfileDynamicAuthorityValue"("createdByUserId");

-- CreateIndex
CREATE INDEX "ProfileDynamicAuthorityValue_updatedByUserId_idx" ON "ProfileDynamicAuthorityValue"("updatedByUserId");

-- CreateIndex
CREATE INDEX "ProfileDynamicAuthorityValue_deleted_idx" ON "ProfileDynamicAuthorityValue"("deleted");

-- CreateIndex
CREATE INDEX "UserLog_userId_idx" ON "UserLog"("userId");

-- CreateIndex
CREATE INDEX "UserLog_createdByUserId_idx" ON "UserLog"("createdByUserId");

-- CreateIndex
CREATE INDEX "UserLog_updatedByUserId_idx" ON "UserLog"("updatedByUserId");

-- CreateIndex
CREATE INDEX "UserLog_deleted_idx" ON "UserLog"("deleted");

-- CreateIndex
CREATE INDEX "Country_createdByUserId_idx" ON "Country"("createdByUserId");

-- CreateIndex
CREATE INDEX "Country_updatedByUserId_idx" ON "Country"("updatedByUserId");

-- CreateIndex
CREATE INDEX "Country_deleted_idx" ON "Country"("deleted");

-- CreateIndex
CREATE INDEX "countryId" ON "City"("countryId");

-- CreateIndex
CREATE INDEX "City_createdByUserId_idx" ON "City"("createdByUserId");

-- CreateIndex
CREATE INDEX "City_updatedByUserId_idx" ON "City"("updatedByUserId");

-- CreateIndex
CREATE INDEX "City_deleted_idx" ON "City"("deleted");

-- CreateIndex
CREATE INDEX "cityId" ON "Region"("cityId");

-- CreateIndex
CREATE INDEX "Region_createdByUserId_idx" ON "Region"("createdByUserId");

-- CreateIndex
CREATE INDEX "Region_updatedByUserId_idx" ON "Region"("updatedByUserId");

-- CreateIndex
CREATE INDEX "Region_deleted_idx" ON "Region"("deleted");

-- CreateIndex
CREATE INDEX "User_active_idx" ON "User"("active");

-- CreateIndex
CREATE INDEX "User_username_idx" ON "User"("username");

-- CreateIndex
CREATE INDEX "User_regionId_idx" ON "User"("regionId");

-- CreateIndex
CREATE INDEX "User_authorizationProfileId_idx" ON "User"("authorizationProfileId");

-- CreateIndex
CREATE INDEX "User_createdByUserId_idx" ON "User"("createdByUserId");

-- CreateIndex
CREATE INDEX "User_updatedByUserId_idx" ON "User"("updatedByUserId");

-- CreateIndex
CREATE INDEX "User_deleted_idx" ON "User"("deleted");
