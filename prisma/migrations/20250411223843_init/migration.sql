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
    "status" TEXT DEFAULT 'PENDING'
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
    "output" TEXT
);

-- CreateTable
CREATE TABLE "File" (
    "fileId" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "mimetype" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "path" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "CommentAttachment" (
    "attachmentId" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "commentId" INTEGER NOT NULL,
    "attachmentFileId" INTEGER NOT NULL,
    CONSTRAINT "CommentAttachment_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "Comments" ("commentId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CommentAttachment_attachmentFileId_fkey" FOREIGN KEY ("attachmentFileId") REFERENCES "File" ("fileId") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Comments" (
    "commentId" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "commentText" TEXT,
    "commentSource" TEXT NOT NULL,
    "commentSourceId" INTEGER,
    "byUser" INTEGER,
    "byUsername" TEXT,
    CONSTRAINT "Comments_byUser_fkey" FOREIGN KEY ("byUser") REFERENCES "User" ("userId") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Device" (
    "deviceId" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "deviceToken" TEXT NOT NULL,
    "userId" INTEGER,
    CONSTRAINT "Device_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("userId") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NotificationToken" (
    "notificationTokenId" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "token" TEXT,
    "deviceId" INTEGER,
    CONSTRAINT "NotificationToken_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device" ("deviceId") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Notification" (
    "notificationId" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "notificationTokensId" TEXT NOT NULL,
    "dataJson" TEXT,
    "notificationJson" TEXT
);

-- CreateTable
CREATE TABLE "Log" (
    "logId" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "level" INTEGER NOT NULL,
    "title" TEXT,
    "logText" TEXT,
    "source" TEXT,
    CONSTRAINT "Log_level_fkey" FOREIGN KEY ("level") REFERENCES "LogLevel" ("levelId") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LogLevel" (
    "levelId" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT
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
    CONSTRAINT "User_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region" ("regionId") ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT "User_authorizationProfileId_fkey" FOREIGN KEY ("authorizationProfileId") REFERENCES "AuthoritiesProfile" ("profileId") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserNotification" (
    "notificationId" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT,
    "contents" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "userId" INTEGER NOT NULL,
    "notificationResourceId" INTEGER,
    CONSTRAINT "UserNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("userId") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserNotification_notificationResourceId_fkey" FOREIGN KEY ("notificationResourceId") REFERENCES "NotificationResource" ("resourceId") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NotificationResource" (
    "resourceId" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "contents" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "UserNotificationTag" (
    "relationId" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "tagId" INTEGER,
    "notificationId" INTEGER,
    "notificationResourceId" INTEGER,
    CONSTRAINT "UserNotificationTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "NotificationTag" ("tagId") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "UserNotificationTag_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "UserNotification" ("notificationId") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "UserNotificationTag_notificationResourceId_fkey" FOREIGN KEY ("notificationResourceId") REFERENCES "NotificationResource" ("resourceId") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NotificationTag" (
    "tagId" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "color" TEXT,
    "label" TEXT
);

-- CreateTable
CREATE TABLE "UserAuthority" (
    "authorityId" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "keyName" TEXT NOT NULL,
    "userId" INTEGER,
    "all" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "UserAuthority_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("userId") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserDynamicAuthority" (
    "dynamicAuthorityId" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "dynamicAuthorityKey" TEXT NOT NULL,
    "all" BOOLEAN NOT NULL DEFAULT true,
    "authorityId" INTEGER,
    CONSTRAINT "UserDynamicAuthority_authorityId_fkey" FOREIGN KEY ("authorityId") REFERENCES "UserAuthority" ("authorityId") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserDynamicAuthorityValue" (
    "valueId" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "value" TEXT NOT NULL,
    "dynamicAuthorityId" INTEGER,
    CONSTRAINT "UserDynamicAuthorityValue_dynamicAuthorityId_fkey" FOREIGN KEY ("dynamicAuthorityId") REFERENCES "UserDynamicAuthority" ("dynamicAuthorityId") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuthoritiesProfile" (
    "profileId" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "defaultHomePageName" TEXT
);

-- CreateTable
CREATE TABLE "ProfileAuthority" (
    "authorityId" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "keyName" TEXT NOT NULL,
    "profileId" INTEGER,
    "all" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "ProfileAuthority_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "AuthoritiesProfile" ("profileId") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProfileDynamicAuthority" (
    "dynamicAuthorityId" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "dynamicAuthorityKey" TEXT NOT NULL,
    "all" BOOLEAN NOT NULL DEFAULT true,
    "authorityId" INTEGER,
    CONSTRAINT "ProfileDynamicAuthority_authorityId_fkey" FOREIGN KEY ("authorityId") REFERENCES "ProfileAuthority" ("authorityId") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProfileDynamicAuthorityValue" (
    "valueId" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "value" TEXT NOT NULL,
    "dynamicAuthorityId" INTEGER,
    CONSTRAINT "ProfileDynamicAuthorityValue_dynamicAuthorityId_fkey" FOREIGN KEY ("dynamicAuthorityId") REFERENCES "ProfileDynamicAuthority" ("dynamicAuthorityId") ON DELETE SET NULL ON UPDATE CASCADE
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
    CONSTRAINT "UserLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("userId") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Country" (
    "countryId" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT
);

-- CreateTable
CREATE TABLE "City" (
    "cityId" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "countryId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    CONSTRAINT "City_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country" ("countryId") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Region" (
    "regionId" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "cityId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    CONSTRAINT "Region_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City" ("cityId") ON DELETE RESTRICT ON UPDATE CASCADE
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
CREATE INDEX "File_name_idx" ON "File"("name");

-- CreateIndex
CREATE INDEX "File_mimetype_idx" ON "File"("mimetype");

-- CreateIndex
CREATE INDEX "File_path_idx" ON "File"("path");

-- CreateIndex
CREATE INDEX "commentId" ON "CommentAttachment"("commentId");

-- CreateIndex
CREATE INDEX "byUser" ON "Comments"("byUser");

-- CreateIndex
CREATE INDEX "Device_deviceToken_idx" ON "Device"("deviceToken");

-- CreateIndex
CREATE INDEX "userId" ON "Device"("userId");

-- CreateIndex
CREATE INDEX "NotificationToken_token_idx" ON "NotificationToken"("token");

-- CreateIndex
CREATE INDEX "NotificationToken_deviceId_idx" ON "NotificationToken"("deviceId");

-- CreateIndex
CREATE INDEX "Log_level_idx" ON "Log"("level");

-- CreateIndex
CREATE INDEX "Log_title_idx" ON "Log"("title");

-- CreateIndex
CREATE INDEX "level" ON "Log"("level");

-- CreateIndex
CREATE INDEX "User_active_idx" ON "User"("active");

-- CreateIndex
CREATE INDEX "User_username_idx" ON "User"("username");

-- CreateIndex
CREATE INDEX "User_regionId_idx" ON "User"("regionId");

-- CreateIndex
CREATE INDEX "User_authorizationProfileId_idx" ON "User"("authorizationProfileId");

-- CreateIndex
CREATE INDEX "UserNotification_userId_idx" ON "UserNotification"("userId");

-- CreateIndex
CREATE INDEX "UserNotificationTag_notificationId_idx" ON "UserNotificationTag"("notificationId");

-- CreateIndex
CREATE INDEX "UserNotificationTag_notificationResourceId_idx" ON "UserNotificationTag"("notificationResourceId");

-- CreateIndex
CREATE INDEX "UserNotificationTag_tagId_idx" ON "UserNotificationTag"("tagId");

-- CreateIndex
CREATE INDEX "UserAuthority_keyName_idx" ON "UserAuthority"("keyName");

-- CreateIndex
CREATE INDEX "UserAuthority_userId_idx" ON "UserAuthority"("userId");

-- CreateIndex
CREATE INDEX "UserDynamicAuthority_dynamicAuthorityKey_idx" ON "UserDynamicAuthority"("dynamicAuthorityKey");

-- CreateIndex
CREATE INDEX "UserDynamicAuthority_authorityId_idx" ON "UserDynamicAuthority"("authorityId");

-- CreateIndex
CREATE INDEX "UserDynamicAuthorityValue_dynamicAuthorityId_idx" ON "UserDynamicAuthorityValue"("dynamicAuthorityId");

-- CreateIndex
CREATE INDEX "ProfileAuthority_keyName_idx" ON "ProfileAuthority"("keyName");

-- CreateIndex
CREATE INDEX "ProfileAuthority_profileId_idx" ON "ProfileAuthority"("profileId");

-- CreateIndex
CREATE INDEX "ProfileDynamicAuthority_dynamicAuthorityKey_idx" ON "ProfileDynamicAuthority"("dynamicAuthorityKey");

-- CreateIndex
CREATE INDEX "ProfileDynamicAuthority_authorityId_idx" ON "ProfileDynamicAuthority"("authorityId");

-- CreateIndex
CREATE INDEX "ProfileDynamicAuthorityValue_dynamicAuthorityId_idx" ON "ProfileDynamicAuthorityValue"("dynamicAuthorityId");

-- CreateIndex
CREATE INDEX "UserLog_userId_idx" ON "UserLog"("userId");

-- CreateIndex
CREATE INDEX "countryId" ON "City"("countryId");

-- CreateIndex
CREATE INDEX "cityId" ON "Region"("cityId");
