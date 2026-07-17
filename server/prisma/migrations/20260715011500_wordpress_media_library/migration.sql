ALTER TABLE `Media`
    DROP FOREIGN KEY `Media_uploadedById_fkey`;

ALTER TABLE `Media`
    MODIFY COLUMN `type` ENUM('IMAGE', 'PDF', 'DOCUMENT') NOT NULL,
    MODIFY COLUMN `uploadedById` INTEGER NULL,
    ADD COLUMN `title` VARCHAR(191) NULL,
    ADD COLUMN `altText` VARCHAR(191) NULL,
    ADD COLUMN `caption` TEXT NULL,
    ADD COLUMN `description` TEXT NULL,
    ADD COLUMN `folder` VARCHAR(191) NOT NULL DEFAULT 'common',
    ADD COLUMN `width` INTEGER NULL,
    ADD COLUMN `height` INTEGER NULL,
    ADD COLUMN `updatedAt` DATETIME(3) NULL;

-- Các tệp cũ đang nằm trực tiếp trong thư mục gốc.
UPDATE `Media` SET `folder` = '', `updatedAt` = `createdAt`;

ALTER TABLE `Media`
    MODIFY COLUMN `updatedAt` DATETIME(3) NOT NULL;

CREATE INDEX `Media_type_createdAt_idx` ON `Media`(`type`, `createdAt`);
CREATE INDEX `Media_folder_createdAt_idx` ON `Media`(`folder`, `createdAt`);

ALTER TABLE `Media`
    ADD CONSTRAINT `Media_uploadedById_fkey`
        FOREIGN KEY (`uploadedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
