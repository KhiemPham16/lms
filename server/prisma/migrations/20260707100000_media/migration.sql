-- Add media library support for LMS uploads.

CREATE TABLE `Media` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `publicId` VARCHAR(191) NOT NULL,
    `fileName` VARCHAR(191) NOT NULL,
    `originalName` VARCHAR(191) NOT NULL,
    `mimeType` VARCHAR(191) NOT NULL,
    `size` INTEGER NOT NULL,
    `url` VARCHAR(2048) NOT NULL,
    `type` ENUM('IMAGE', 'VIDEO', 'DOCUMENT') NOT NULL DEFAULT 'IMAGE',
    `alt` VARCHAR(191) NULL,
    `folder` VARCHAR(191) NULL,
    `uploadedById` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Media_publicId_key`(`publicId`),
    INDEX `Media_uploadedById_idx`(`uploadedById`),
    INDEX `Media_type_idx`(`type`),
    INDEX `Media_folder_idx`(`folder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `Media` ADD CONSTRAINT `Media_uploadedById_fkey` FOREIGN KEY (`uploadedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO `Permission` (`publicId`, `code`, `name`, `module`, `createdAt`, `updatedAt`)
VALUES
    (UUID(), 'media.read', 'Xem media', 'media', NOW(3), NOW(3)),
    (UUID(), 'media.create', 'Quan ly media', 'media', NOW(3), NOW(3))
ON DUPLICATE KEY UPDATE
    `name` = VALUES(`name`),
    `module` = VALUES(`module`),
    `updatedAt` = NOW(3);

INSERT IGNORE INTO `RolePermission` (`roleId`, `permissionId`, `createdAt`)
SELECT r.`id`, p.`id`, NOW(3)
FROM `Role` r
JOIN `Permission` p ON p.`code` IN ('media.read', 'media.create')
WHERE r.`code` IN ('ADMIN', 'TRAINING_OFFICER', 'DEPARTMENT_HEAD', 'LECTURER');
