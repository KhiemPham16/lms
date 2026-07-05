-- Add coding lessons with multi-file starter code and student submissions.
ALTER TABLE `Lesson` MODIFY `type` ENUM('TEXT', 'VIDEO', 'DOCUMENT', 'FILE', 'LINK', 'CODE') NOT NULL DEFAULT 'TEXT';
ALTER TABLE `Lesson` ADD COLUMN `codeConfig` JSON NULL;

CREATE TABLE `CodeSubmission` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `publicId` VARCHAR(191) NOT NULL,
    `lessonId` INTEGER NOT NULL,
    `studentId` INTEGER NOT NULL,
    `files` JSON NOT NULL,
    `results` JSON NULL,
    `passed` BOOLEAN NOT NULL DEFAULT false,
    `score` DOUBLE NULL,
    `submittedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `CodeSubmission_publicId_key`(`publicId`),
    INDEX `CodeSubmission_lessonId_idx`(`lessonId`),
    INDEX `CodeSubmission_studentId_idx`(`studentId`),
    INDEX `CodeSubmission_passed_idx`(`passed`),
    INDEX `CodeSubmission_submittedAt_idx`(`submittedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `CodeSubmission` ADD CONSTRAINT `CodeSubmission_lessonId_fkey` FOREIGN KEY (`lessonId`) REFERENCES `Lesson`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `CodeSubmission` ADD CONSTRAINT `CodeSubmission_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
