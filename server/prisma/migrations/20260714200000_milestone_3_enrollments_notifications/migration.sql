ALTER TABLE `AuditLog` MODIFY `action`
ENUM('CREATE','UPDATE','STATUS_CHANGE','LOGIN','LOGOUT','RESET_PASSWORD','CHANGE_PASSWORD','APPROVE','REJECT','ASSIGN','ENROLL','DROP') NOT NULL;

ALTER TABLE `User` ADD COLUMN `academicProgramId` INTEGER NULL;
CREATE INDEX `User_academicProgramId_idx` ON `User`(`academicProgramId`);

CREATE TABLE `Enrollment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `publicId` VARCHAR(191) NOT NULL,
    `classId` INTEGER NOT NULL,
    `studentId` INTEGER NOT NULL,
    `status` ENUM('ACTIVE','DROPPED') NOT NULL DEFAULT 'ACTIVE',
    `enrolledAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `droppedAt` DATETIME(3) NULL,
    `finalScore` DECIMAL(4,2) NULL,
    `passed` BOOLEAN NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    UNIQUE INDEX `Enrollment_publicId_key`(`publicId`),
    UNIQUE INDEX `Enrollment_classId_studentId_key`(`classId`,`studentId`),
    INDEX `Enrollment_studentId_status_idx`(`studentId`,`status`),
    INDEX `Enrollment_classId_status_idx`(`classId`,`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `Notification` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `publicId` VARCHAR(191) NOT NULL,
    `recipientId` INTEGER NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `message` TEXT NOT NULL,
    `data` JSON NULL,
    `readAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE INDEX `Notification_publicId_key`(`publicId`),
    INDEX `Notification_recipientId_readAt_createdAt_idx`(`recipientId`,`readAt`,`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `User` ADD CONSTRAINT `User_academicProgramId_fkey`
    FOREIGN KEY (`academicProgramId`) REFERENCES `AcademicProgram`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `Enrollment` ADD CONSTRAINT `Enrollment_classId_fkey`
    FOREIGN KEY (`classId`) REFERENCES `Class`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `Enrollment` ADD CONSTRAINT `Enrollment_studentId_fkey`
    FOREIGN KEY (`studentId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_recipientId_fkey`
    FOREIGN KEY (`recipientId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
