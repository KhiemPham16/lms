ALTER TABLE `Notification`
    ADD COLUMN `announcementId` INTEGER NULL;

CREATE INDEX `Notification_announcementId_idx` ON `Notification`(`announcementId`);
CREATE UNIQUE INDEX `Notification_recipientId_announcementId_key`
    ON `Notification`(`recipientId`, `announcementId`);

ALTER TABLE `Notification`
    ADD CONSTRAINT `Notification_announcementId_fkey`
        FOREIGN KEY (`announcementId`) REFERENCES `Announcement`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
