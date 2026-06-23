/*
  Warnings:

  - Added the required column `departmentHeadId` to the `Class` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `class` DROP FOREIGN KEY `Class_lecturerId_fkey`;

-- AlterTable
ALTER TABLE `auditlog` ALTER COLUMN `publicId` DROP DEFAULT;

-- AlterTable
ALTER TABLE `class` ADD COLUMN `departmentHeadId` INTEGER NOT NULL,
    MODIFY `lecturerId` INTEGER NULL;

-- AlterTable
ALTER TABLE `course` ADD COLUMN `requiresPrincipalApproval` BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX `Class_departmentHeadId_idx` ON `Class`(`departmentHeadId`);

-- AddForeignKey
ALTER TABLE `Class` ADD CONSTRAINT `Class_lecturerId_fkey` FOREIGN KEY (`lecturerId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Class` ADD CONSTRAINT `Class_departmentHeadId_fkey` FOREIGN KEY (`departmentHeadId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
