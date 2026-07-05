-- Store per-user notifications for class, lesson, exam and grade events.
CREATE TABLE `Notification` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `publicId` VARCHAR(191) NOT NULL,
    `recipientId` INTEGER NOT NULL,
    `actorId` INTEGER NULL,
    `type` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `message` TEXT NOT NULL,
    `data` JSON NULL,
    `readAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Notification_publicId_key`(`publicId`),
    INDEX `Notification_recipientId_idx`(`recipientId`),
    INDEX `Notification_actorId_idx`(`actorId`),
    INDEX `Notification_type_idx`(`type`),
    INDEX `Notification_readAt_idx`(`readAt`),
    INDEX `Notification_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `Notification` ADD CONSTRAINT `Notification_recipientId_fkey` FOREIGN KEY (`recipientId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO `Permission` (`publicId`, `code`, `name`, `module`, `createdAt`)
SELECT UUID(), 'notifications.read', 'Xem thong bao', 'notifications', NOW(3)
WHERE NOT EXISTS (
    SELECT 1 FROM `Permission` WHERE `code` = 'notifications.read'
);

INSERT IGNORE INTO `RolePermission` (`roleId`, `permissionId`)
SELECT r.id, p.id
FROM `Role` r
JOIN `Permission` p ON p.code = 'notifications.read'
WHERE r.code IN ('ADMIN', 'HR', 'PRINCIPAL', 'TRAINING_OFFICER', 'DEPARTMENT_HEAD', 'LECTURER', 'STUDENT');
