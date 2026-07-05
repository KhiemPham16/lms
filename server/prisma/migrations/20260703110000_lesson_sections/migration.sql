-- Split lesson organization into sections while keeping old class-level lessons valid.

CREATE TABLE `LessonSection` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `publicId` VARCHAR(191) NOT NULL,
    `classId` INTEGER NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `sortOrder` INTEGER NOT NULL,
    `isPublished` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `LessonSection_publicId_key`(`publicId`),
    UNIQUE INDEX `LessonSection_classId_sortOrder_key`(`classId`, `sortOrder`),
    INDEX `LessonSection_classId_idx`(`classId`),
    INDEX `LessonSection_isPublished_idx`(`isPublished`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `Lesson` DROP INDEX `Lesson_classId_sortOrder_key`;
ALTER TABLE `Lesson` ADD COLUMN `sectionId` INTEGER NULL;

CREATE UNIQUE INDEX `Lesson_sectionId_sortOrder_key` ON `Lesson`(`sectionId`, `sortOrder`);
CREATE INDEX `Lesson_sectionId_idx` ON `Lesson`(`sectionId`);

ALTER TABLE `LessonSection` ADD CONSTRAINT `LessonSection_classId_fkey` FOREIGN KEY (`classId`) REFERENCES `Class`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `Lesson` ADD CONSTRAINT `Lesson_sectionId_fkey` FOREIGN KEY (`sectionId`) REFERENCES `LessonSection`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
