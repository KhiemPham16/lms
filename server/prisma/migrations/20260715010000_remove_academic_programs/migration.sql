ALTER TABLE `User`
    DROP FOREIGN KEY `User_academicProgramId_fkey`;

DROP INDEX `User_academicProgramId_idx` ON `User`;

ALTER TABLE `User`
    DROP COLUMN `academicProgramId`;

DROP TABLE `ProgramSubject`;
DROP TABLE `AcademicProgram`;
