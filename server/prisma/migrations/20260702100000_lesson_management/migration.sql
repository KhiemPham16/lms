CREATE TABLE `Lesson` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `publicId` VARCHAR(191) NOT NULL,
    `classId` INTEGER NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `chapter` VARCHAR(191) NULL,
    `orderIndex` INTEGER NOT NULL,
    `durationMinutes` INTEGER NULL,
    `status` ENUM('DRAFT', 'PUBLISHED', 'HIDDEN', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    `primaryContentType` ENUM('TEXT', 'VIDEO', 'FILE', 'IMAGE', 'LINK', 'CODE', 'ASSIGNMENT', 'EXAM') NOT NULL DEFAULT 'TEXT',
    `allowStudentView` BOOLEAN NOT NULL DEFAULT true,
    `allowDownload` BOOLEAN NOT NULL DEFAULT true,
    `requirePreviousCompletion` BOOLEAN NOT NULL DEFAULT false,
    `availableFrom` DATETIME(3) NULL,
    `availableUntil` DATETIME(3) NULL,
    `trackProgress` BOOLEAN NOT NULL DEFAULT true,
    `hasVideo` BOOLEAN NOT NULL DEFAULT false,
    `hasAttachment` BOOLEAN NOT NULL DEFAULT false,
    `hasLinkedExam` BOOLEAN NOT NULL DEFAULT false,
    `publishedAt` DATETIME(3) NULL,
    `publishedById` INTEGER NULL,
    `hiddenAt` DATETIME(3) NULL,
    `hiddenById` INTEGER NULL,
    `hiddenReason` TEXT NULL,
    `createdById` INTEGER NOT NULL,
    `deletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Lesson_publicId_key`(`publicId`),
    UNIQUE INDEX `Lesson_classId_orderIndex_key`(`classId`, `orderIndex`),
    INDEX `Lesson_classId_idx`(`classId`),
    INDEX `Lesson_createdById_idx`(`createdById`),
    INDEX `Lesson_publishedById_idx`(`publishedById`),
    INDEX `Lesson_hiddenById_idx`(`hiddenById`),
    INDEX `Lesson_status_idx`(`status`),
    INDEX `Lesson_primaryContentType_idx`(`primaryContentType`),
    INDEX `Lesson_deletedAt_idx`(`deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `LessonContentBlock` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `publicId` VARCHAR(191) NOT NULL,
    `lessonId` INTEGER NOT NULL,
    `type` ENUM('TEXT', 'VIDEO', 'FILE', 'IMAGE', 'LINK', 'CODE', 'ASSIGNMENT', 'EXAM') NOT NULL,
    `title` VARCHAR(191) NULL,
    `content` TEXT NULL,
    `fileUrl` VARCHAR(191) NULL,
    `fileName` VARCHAR(191) NULL,
    `fileSize` INTEGER NULL,
    `mimeType` VARCHAR(191) NULL,
    `orderIndex` INTEGER NOT NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `LessonContentBlock_publicId_key`(`publicId`),
    INDEX `LessonContentBlock_lessonId_idx`(`lessonId`),
    INDEX `LessonContentBlock_type_idx`(`type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `LessonAttachment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `publicId` VARCHAR(191) NOT NULL,
    `lessonId` INTEGER NOT NULL,
    `fileName` VARCHAR(191) NOT NULL,
    `fileUrl` VARCHAR(191) NOT NULL,
    `fileSize` INTEGER NULL,
    `mimeType` VARCHAR(191) NULL,
    `uploadedById` INTEGER NULL,
    `uploadedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `LessonAttachment_publicId_key`(`publicId`),
    INDEX `LessonAttachment_lessonId_idx`(`lessonId`),
    INDEX `LessonAttachment_uploadedById_idx`(`uploadedById`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `LessonProgress` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `publicId` VARCHAR(191) NOT NULL,
    `lessonId` INTEGER NOT NULL,
    `studentId` INTEGER NOT NULL,
    `status` ENUM('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED') NOT NULL DEFAULT 'NOT_STARTED',
    `progressPercent` INTEGER NOT NULL DEFAULT 0,
    `lastViewedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `LessonProgress_publicId_key`(`publicId`),
    UNIQUE INDEX `LessonProgress_lessonId_studentId_key`(`lessonId`, `studentId`),
    INDEX `LessonProgress_lessonId_idx`(`lessonId`),
    INDEX `LessonProgress_studentId_idx`(`studentId`),
    INDEX `LessonProgress_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `Lesson` ADD CONSTRAINT `Lesson_classId_fkey` FOREIGN KEY (`classId`) REFERENCES `Class`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `Lesson` ADD CONSTRAINT `Lesson_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Lesson` ADD CONSTRAINT `Lesson_publishedById_fkey` FOREIGN KEY (`publishedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `Lesson` ADD CONSTRAINT `Lesson_hiddenById_fkey` FOREIGN KEY (`hiddenById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `LessonContentBlock` ADD CONSTRAINT `LessonContentBlock_lessonId_fkey` FOREIGN KEY (`lessonId`) REFERENCES `Lesson`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `LessonAttachment` ADD CONSTRAINT `LessonAttachment_lessonId_fkey` FOREIGN KEY (`lessonId`) REFERENCES `Lesson`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `LessonProgress` ADD CONSTRAINT `LessonProgress_lessonId_fkey` FOREIGN KEY (`lessonId`) REFERENCES `Lesson`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `LessonProgress` ADD CONSTRAINT `LessonProgress_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

