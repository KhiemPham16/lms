CREATE TABLE `Announcement` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `publicId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `message` TEXT NOT NULL,
    `category` ENUM('GENERAL', 'HOLIDAY', 'ACADEMIC', 'EVENT', 'EMERGENCY') NOT NULL DEFAULT 'GENERAL',
    `audience` ENUM('ALL', 'ROLES', 'DEPARTMENTS') NOT NULL DEFAULT 'ALL',
    `targetRoles` JSON NULL,
    `targetDepartmentIds` JSON NULL,
    `status` ENUM('DRAFT', 'SCHEDULED', 'PUBLISHING', 'PUBLISHED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `isPinned` BOOLEAN NOT NULL DEFAULT false,
    `scheduledAt` DATETIME(3) NULL,
    `publishedAt` DATETIME(3) NULL,
    `expiresAt` DATETIME(3) NULL,
    `cancelledAt` DATETIME(3) NULL,
    `createdById` INTEGER NOT NULL,
    `publishedById` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Announcement_publicId_key`(`publicId`),
    INDEX `Announcement_status_scheduledAt_idx`(`status`, `scheduledAt`),
    INDEX `Announcement_status_publishedAt_expiresAt_idx`(`status`, `publishedAt`, `expiresAt`),
    INDEX `Announcement_createdById_idx`(`createdById`),
    INDEX `Announcement_publishedById_idx`(`publishedById`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `Announcement`
    ADD CONSTRAINT `Announcement_createdById_fkey`
        FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT `Announcement_publishedById_fkey`
        FOREIGN KEY (`publishedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
