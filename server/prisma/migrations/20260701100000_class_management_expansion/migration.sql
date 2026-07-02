-- Expand class management metadata and statuses.
ALTER TABLE `Class`
    MODIFY `status` ENUM('UPCOMING', 'OPEN', 'CLOSED', 'DRAFT', 'OPEN_REGISTRATION', 'CLOSED_REGISTRATION', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'FULL') NOT NULL DEFAULT 'DRAFT',
    ADD COLUMN `description` TEXT NULL,
    ADD COLUMN `assistantId` INTEGER NULL,
    ADD COLUMN `semester` VARCHAR(191) NULL,
    ADD COLUMN `academicYear` VARCHAR(191) NULL,
    ADD COLUMN `minStudents` INTEGER NULL,
    ADD COLUMN `allowWaitlist` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `weeklySchedule` JSON NULL,
    ADD COLUMN `studyShift` VARCHAR(191) NULL,
    ADD COLUMN `room` VARCHAR(191) NULL,
    ADD COLUMN `onlineUrl` VARCHAR(191) NULL,
    ADD COLUMN `registrationStartDate` DATETIME(3) NULL,
    ADD COLUMN `registrationEndDate` DATETIME(3) NULL,
    ADD COLUMN `registrationOpenedAt` DATETIME(3) NULL,
    ADD COLUMN `registrationClosedAt` DATETIME(3) NULL,
    ADD COLUMN `allowStudentDrop` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `checkScheduleConflict` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `autoCloseWhenFull` BOOLEAN NOT NULL DEFAULT true;

UPDATE `Class` SET `status` = 'DRAFT' WHERE `status` = 'UPCOMING';
UPDATE `Class` SET `status` = 'OPEN_REGISTRATION' WHERE `status` = 'OPEN';
UPDATE `Class` SET `status` = 'CLOSED_REGISTRATION' WHERE `status` = 'CLOSED';

ALTER TABLE `Class`
    MODIFY `status` ENUM('DRAFT', 'OPEN_REGISTRATION', 'CLOSED_REGISTRATION', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'FULL') NOT NULL DEFAULT 'DRAFT';

CREATE INDEX `Class_assistantId_idx` ON `Class`(`assistantId`);
CREATE INDEX `Class_semester_idx` ON `Class`(`semester`);
CREATE INDEX `Class_academicYear_idx` ON `Class`(`academicYear`);

ALTER TABLE `Class` ADD CONSTRAINT `Class_assistantId_fkey` FOREIGN KEY (`assistantId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
