-- Add lifecycle statuses without mixing them with account access status.
ALTER TABLE `AuditLog`
    MODIFY COLUMN `action` ENUM('CREATE', 'UPDATE', 'DELETE', 'STATUS_CHANGE', 'LOGIN', 'LOGOUT', 'RESET_PASSWORD', 'CHANGE_PASSWORD', 'APPROVE', 'REJECT', 'ASSIGN', 'ENROLL', 'DROP') NOT NULL;

ALTER TABLE `User`
    ADD COLUMN `studentStatus` ENUM('STUDYING', 'RESERVED', 'GRADUATED', 'DROPPED_OUT', 'SUSPENDED') NULL,
    ADD COLUMN `studentStatusChangedAt` DATETIME(3) NULL,
    ADD COLUMN `studentStatusChangedById` INTEGER NULL,
    ADD COLUMN `employmentStatus` ENUM('WORKING', 'ON_LEAVE', 'CONTRACT_ENDED', 'RESIGNED', 'TERMINATED') NULL,
    ADD COLUMN `employmentStatusChangedAt` DATETIME(3) NULL,
    ADD COLUMN `employmentEndedAt` DATETIME(3) NULL,
    ADD COLUMN `employmentStatusChangedById` INTEGER NULL;

UPDATE `User`
SET `studentStatus` = 'STUDYING'
WHERE `role` = 'STUDENT';

UPDATE `User`
SET `employmentStatus` = 'WORKING'
WHERE `role` <> 'STUDENT';

CREATE INDEX `User_studentStatus_idx` ON `User`(`studentStatus`);
CREATE INDEX `User_employmentStatus_idx` ON `User`(`employmentStatus`);
CREATE INDEX `User_studentStatusChangedById_idx` ON `User`(`studentStatusChangedById`);
CREATE INDEX `User_employmentStatusChangedById_idx` ON `User`(`employmentStatusChangedById`);

ALTER TABLE `User`
    ADD CONSTRAINT `User_studentStatusChangedById_fkey`
        FOREIGN KEY (`studentStatusChangedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT `User_employmentStatusChangedById_fkey`
        FOREIGN KEY (`employmentStatusChangedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
