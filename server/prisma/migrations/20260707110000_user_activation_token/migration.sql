ALTER TABLE `User`
    ADD COLUMN `activationToken` VARCHAR(191) NULL,
    ADD COLUMN `activationTokenExpiresAt` DATETIME(3) NULL;

CREATE UNIQUE INDEX `User_activationToken_key` ON `User`(`activationToken`);
CREATE INDEX `User_activationToken_idx` ON `User`(`activationToken`);
