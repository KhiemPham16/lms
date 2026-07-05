-- Add exams, attempts, answers, and calculated gradebook rows.

CREATE TABLE `Exam` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `publicId` VARCHAR(191) NOT NULL,
    `classId` INTEGER NOT NULL,
    `sectionId` INTEGER NULL,
    `lessonId` INTEGER NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `durationMinutes` INTEGER NULL,
    `maxAttempts` INTEGER NOT NULL DEFAULT 1,
    `passScore` DOUBLE NOT NULL DEFAULT 5,
    `isPublished` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Exam_publicId_key`(`publicId`),
    INDEX `Exam_classId_idx`(`classId`),
    INDEX `Exam_sectionId_idx`(`sectionId`),
    INDEX `Exam_lessonId_idx`(`lessonId`),
    INDEX `Exam_isPublished_idx`(`isPublished`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ExamQuestion` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `publicId` VARCHAR(191) NOT NULL,
    `examId` INTEGER NOT NULL,
    `type` ENUM('SINGLE_CHOICE', 'MULTIPLE_CHOICE') NOT NULL DEFAULT 'SINGLE_CHOICE',
    `content` TEXT NOT NULL,
    `points` DOUBLE NOT NULL DEFAULT 1,
    `sortOrder` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ExamQuestion_publicId_key`(`publicId`),
    UNIQUE INDEX `ExamQuestion_examId_sortOrder_key`(`examId`, `sortOrder`),
    INDEX `ExamQuestion_examId_idx`(`examId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ExamOption` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `publicId` VARCHAR(191) NOT NULL,
    `questionId` INTEGER NOT NULL,
    `content` TEXT NOT NULL,
    `isCorrect` BOOLEAN NOT NULL DEFAULT false,
    `sortOrder` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ExamOption_publicId_key`(`publicId`),
    UNIQUE INDEX `ExamOption_questionId_sortOrder_key`(`questionId`, `sortOrder`),
    INDEX `ExamOption_questionId_idx`(`questionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ExamAttempt` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `publicId` VARCHAR(191) NOT NULL,
    `examId` INTEGER NOT NULL,
    `studentId` INTEGER NOT NULL,
    `status` ENUM('IN_PROGRESS', 'SUBMITTED') NOT NULL DEFAULT 'IN_PROGRESS',
    `score` DOUBLE NULL,
    `focusLostCount` INTEGER NOT NULL DEFAULT 0,
    `violationCount` INTEGER NOT NULL DEFAULT 0,
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `submittedAt` DATETIME(3) NULL,

    UNIQUE INDEX `ExamAttempt_publicId_key`(`publicId`),
    INDEX `ExamAttempt_examId_idx`(`examId`),
    INDEX `ExamAttempt_studentId_idx`(`studentId`),
    INDEX `ExamAttempt_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ExamAnswer` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `attemptId` INTEGER NOT NULL,
    `questionId` INTEGER NOT NULL,
    `optionId` INTEGER NOT NULL,

    UNIQUE INDEX `ExamAnswer_attemptId_questionId_optionId_key`(`attemptId`, `questionId`, `optionId`),
    INDEX `ExamAnswer_attemptId_idx`(`attemptId`),
    INDEX `ExamAnswer_questionId_idx`(`questionId`),
    INDEX `ExamAnswer_optionId_idx`(`optionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `Grade` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `publicId` VARCHAR(191) NOT NULL,
    `classId` INTEGER NOT NULL,
    `studentId` INTEGER NOT NULL,
    `finalScore` DOUBLE NOT NULL,
    `passScore` DOUBLE NOT NULL DEFAULT 5,
    `status` ENUM('PASS', 'FAIL') NOT NULL,
    `calculatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Grade_publicId_key`(`publicId`),
    UNIQUE INDEX `Grade_classId_studentId_key`(`classId`, `studentId`),
    INDEX `Grade_classId_idx`(`classId`),
    INDEX `Grade_studentId_idx`(`studentId`),
    INDEX `Grade_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `Exam` ADD CONSTRAINT `Exam_classId_fkey` FOREIGN KEY (`classId`) REFERENCES `Class`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `Exam` ADD CONSTRAINT `Exam_sectionId_fkey` FOREIGN KEY (`sectionId`) REFERENCES `LessonSection`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `Exam` ADD CONSTRAINT `Exam_lessonId_fkey` FOREIGN KEY (`lessonId`) REFERENCES `Lesson`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `ExamQuestion` ADD CONSTRAINT `ExamQuestion_examId_fkey` FOREIGN KEY (`examId`) REFERENCES `Exam`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ExamOption` ADD CONSTRAINT `ExamOption_questionId_fkey` FOREIGN KEY (`questionId`) REFERENCES `ExamQuestion`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ExamAttempt` ADD CONSTRAINT `ExamAttempt_examId_fkey` FOREIGN KEY (`examId`) REFERENCES `Exam`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ExamAttempt` ADD CONSTRAINT `ExamAttempt_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ExamAnswer` ADD CONSTRAINT `ExamAnswer_attemptId_fkey` FOREIGN KEY (`attemptId`) REFERENCES `ExamAttempt`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ExamAnswer` ADD CONSTRAINT `ExamAnswer_questionId_fkey` FOREIGN KEY (`questionId`) REFERENCES `ExamQuestion`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ExamAnswer` ADD CONSTRAINT `ExamAnswer_optionId_fkey` FOREIGN KEY (`optionId`) REFERENCES `ExamOption`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `Grade` ADD CONSTRAINT `Grade_classId_fkey` FOREIGN KEY (`classId`) REFERENCES `Class`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `Grade` ADD CONSTRAINT `Grade_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
