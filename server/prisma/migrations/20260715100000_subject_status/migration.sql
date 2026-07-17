ALTER TABLE `Subject`
    ADD COLUMN `status` ENUM('DRAFT', 'PUBLIC', 'ARCHIVE') NOT NULL DEFAULT 'DRAFT';

UPDATE `Subject`
SET `status` = CASE WHEN `isActive` = TRUE THEN 'PUBLIC' ELSE 'ARCHIVE' END;

ALTER TABLE `Subject`
    DROP COLUMN `isActive`;

CREATE INDEX `Subject_status_idx` ON `Subject`(`status`);

CREATE TABLE `SubjectRestoreRequest` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `publicId` VARCHAR(191) NOT NULL,
    `subjectId` INTEGER NOT NULL,
    `requestedById` INTEGER NOT NULL,
    `reviewedById` INTEGER NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `reason` TEXT NULL,
    `rejectionReason` TEXT NULL,
    `reviewedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `SubjectRestoreRequest_publicId_key`(`publicId`),
    INDEX `SubjectRestoreRequest_status_createdAt_idx`(`status`, `createdAt`),
    INDEX `SubjectRestoreRequest_subjectId_status_idx`(`subjectId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `SubjectRestoreRequest`
    ADD CONSTRAINT `SubjectRestoreRequest_subjectId_fkey` FOREIGN KEY (`subjectId`) REFERENCES `Subject`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT `SubjectRestoreRequest_requestedById_fkey` FOREIGN KEY (`requestedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT `SubjectRestoreRequest_reviewedById_fkey` FOREIGN KEY (`reviewedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
