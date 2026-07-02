-- Add course-level assignment data.
ALTER TABLE `Course` ADD COLUMN `departmentHeadId` INTEGER NULL;

CREATE TABLE `CourseLecturer` (
    `courseId` INTEGER NOT NULL,
    `lecturerId` INTEGER NOT NULL,
    `assignedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CourseLecturer_lecturerId_idx`(`lecturerId`),
    PRIMARY KEY (`courseId`, `lecturerId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `Course_departmentHeadId_idx` ON `Course`(`departmentHeadId`);

ALTER TABLE `Course` ADD CONSTRAINT `Course_departmentHeadId_fkey` FOREIGN KEY (`departmentHeadId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `CourseLecturer` ADD CONSTRAINT `CourseLecturer_courseId_fkey` FOREIGN KEY (`courseId`) REFERENCES `Course`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `CourseLecturer` ADD CONSTRAINT `CourseLecturer_lecturerId_fkey` FOREIGN KEY (`lecturerId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
