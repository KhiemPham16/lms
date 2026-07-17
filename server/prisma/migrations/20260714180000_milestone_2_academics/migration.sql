ALTER TABLE `AuditLog` MODIFY `action`
ENUM('CREATE','UPDATE','STATUS_CHANGE','LOGIN','LOGOUT','RESET_PASSWORD','CHANGE_PASSWORD','APPROVE','REJECT','ASSIGN') NOT NULL;

CREATE TABLE `AcademicProgram` (
  `id` INTEGER NOT NULL AUTO_INCREMENT, `publicId` VARCHAR(191) NOT NULL,
  `code` VARCHAR(191) NOT NULL, `name` VARCHAR(191) NOT NULL, `description` TEXT NULL,
  `totalCredits` INTEGER NOT NULL DEFAULT 0, `isActive` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `AcademicProgram_publicId_key`(`publicId`), UNIQUE INDEX `AcademicProgram_code_key`(`code`), PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `Subject` (
  `id` INTEGER NOT NULL AUTO_INCREMENT, `publicId` VARCHAR(191) NOT NULL,
  `code` VARCHAR(191) NOT NULL, `name` VARCHAR(191) NOT NULL, `description` TEXT NULL,
  `credits` INTEGER NOT NULL, `assignmentWeight` DECIMAL(5,2) NOT NULL DEFAULT 10,
  `quizWeight` DECIMAL(5,2) NOT NULL DEFAULT 20, `midtermWeight` DECIMAL(5,2) NOT NULL DEFAULT 20,
  `finalWeight` DECIMAL(5,2) NOT NULL DEFAULT 50, `passScore` DECIMAL(4,2) NOT NULL DEFAULT 4,
  `isActive` BOOLEAN NOT NULL DEFAULT true, `departmentId` INTEGER NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `Subject_publicId_key`(`publicId`), UNIQUE INDEX `Subject_code_key`(`code`),
  INDEX `Subject_departmentId_idx`(`departmentId`), PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ProgramSubject` (
  `programId` INTEGER NOT NULL, `subjectId` INTEGER NOT NULL, `semesterOrder` INTEGER NULL,
  `isRequired` BOOLEAN NOT NULL DEFAULT true, INDEX `ProgramSubject_subjectId_idx`(`subjectId`),
  PRIMARY KEY (`programId`,`subjectId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `SubjectPrerequisite` (
  `subjectId` INTEGER NOT NULL, `prerequisiteId` INTEGER NOT NULL,
  INDEX `SubjectPrerequisite_prerequisiteId_idx`(`prerequisiteId`), PRIMARY KEY (`subjectId`,`prerequisiteId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `SubjectLecturer` (
  `subjectId` INTEGER NOT NULL, `lecturerId` INTEGER NOT NULL,
  `assignedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `SubjectLecturer_lecturerId_idx`(`lecturerId`), PRIMARY KEY (`subjectId`,`lecturerId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `SubjectProposal` (
  `id` INTEGER NOT NULL AUTO_INCREMENT, `publicId` VARCHAR(191) NOT NULL,
  `code` VARCHAR(191) NOT NULL, `name` VARCHAR(191) NOT NULL, `description` TEXT NULL, `credits` INTEGER NOT NULL,
  `assignmentWeight` DECIMAL(5,2) NOT NULL, `quizWeight` DECIMAL(5,2) NOT NULL,
  `midtermWeight` DECIMAL(5,2) NOT NULL, `finalWeight` DECIMAL(5,2) NOT NULL,
  `passScore` DECIMAL(4,2) NOT NULL DEFAULT 4,
  `status` ENUM('DRAFT','PENDING_TRAINING','PENDING_PRINCIPAL','APPROVED','REJECTED') NOT NULL DEFAULT 'DRAFT',
  `rejectionReason` TEXT NULL, `departmentId` INTEGER NOT NULL, `proposedById` INTEGER NOT NULL,
  `trainingReviewedById` INTEGER NULL, `principalReviewedById` INTEGER NULL, `approvedSubjectId` INTEGER NULL,
  `submittedAt` DATETIME(3) NULL, `trainingReviewedAt` DATETIME(3) NULL, `principalReviewedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `SubjectProposal_publicId_key`(`publicId`), INDEX `SubjectProposal_status_createdAt_idx`(`status`,`createdAt`),
  INDEX `SubjectProposal_departmentId_idx`(`departmentId`), PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `Semester` (
  `id` INTEGER NOT NULL AUTO_INCREMENT, `publicId` VARCHAR(191) NOT NULL,
  `code` VARCHAR(191) NOT NULL, `name` VARCHAR(191) NOT NULL,
  `startDate` DATETIME(3) NOT NULL, `endDate` DATETIME(3) NOT NULL,
  `registrationStart` DATETIME(3) NOT NULL, `registrationEnd` DATETIME(3) NOT NULL,
  `status` ENUM('PLANNED','ACTIVE','CLOSED') NOT NULL DEFAULT 'PLANNED',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `Semester_publicId_key`(`publicId`), UNIQUE INDEX `Semester_code_key`(`code`), PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ClassProposal` (
  `id` INTEGER NOT NULL AUTO_INCREMENT, `publicId` VARCHAR(191) NOT NULL,
  `subjectId` INTEGER NOT NULL, `semesterId` INTEGER NOT NULL, `proposedById` INTEGER NOT NULL,
  `requestedClassCount` INTEGER NOT NULL, `maxStudentsPerClass` INTEGER NOT NULL, `note` TEXT NULL,
  `status` ENUM('PENDING','APPROVED','REJECTED') NOT NULL DEFAULT 'PENDING', `rejectionReason` TEXT NULL,
  `reviewedById` INTEGER NULL, `reviewedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `ClassProposal_publicId_key`(`publicId`), INDEX `ClassProposal_status_createdAt_idx`(`status`,`createdAt`),
  INDEX `ClassProposal_subjectId_semesterId_idx`(`subjectId`,`semesterId`), PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `Class` (
  `id` INTEGER NOT NULL AUTO_INCREMENT, `publicId` VARCHAR(191) NOT NULL,
  `code` VARCHAR(191) NOT NULL, `name` VARCHAR(191) NOT NULL, `subjectId` INTEGER NOT NULL,
  `semesterId` INTEGER NOT NULL, `departmentId` INTEGER NOT NULL, `managerId` INTEGER NOT NULL,
  `lecturerId` INTEGER NULL, `classProposalId` INTEGER NULL, `maxStudents` INTEGER NOT NULL,
  `registrationStart` DATETIME(3) NOT NULL, `registrationEnd` DATETIME(3) NOT NULL,
  `status` ENUM('DRAFT','OPEN_REGISTRATION','CLOSED_REGISTRATION','IN_PROGRESS','COMPLETED','CANCELLED') NOT NULL DEFAULT 'DRAFT',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `Class_publicId_key`(`publicId`), UNIQUE INDEX `Class_code_key`(`code`),
  INDEX `Class_subjectId_semesterId_idx`(`subjectId`,`semesterId`), INDEX `Class_departmentId_idx`(`departmentId`),
  INDEX `Class_managerId_idx`(`managerId`), INDEX `Class_lecturerId_idx`(`lecturerId`), PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ClassSchedule` (
  `id` INTEGER NOT NULL AUTO_INCREMENT, `classId` INTEGER NOT NULL,
  `weekDay` ENUM('MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY','SUNDAY') NOT NULL,
  `startTime` VARCHAR(5) NOT NULL, `endTime` VARCHAR(5) NOT NULL, `room` VARCHAR(191) NULL,
  UNIQUE INDEX `ClassSchedule_classId_weekDay_startTime_key`(`classId`,`weekDay`,`startTime`),
  INDEX `ClassSchedule_classId_idx`(`classId`), PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `Subject` ADD CONSTRAINT `Subject_departmentId_fkey` FOREIGN KEY (`departmentId`) REFERENCES `Department`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `ProgramSubject` ADD CONSTRAINT `ProgramSubject_programId_fkey` FOREIGN KEY (`programId`) REFERENCES `AcademicProgram`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ProgramSubject` ADD CONSTRAINT `ProgramSubject_subjectId_fkey` FOREIGN KEY (`subjectId`) REFERENCES `Subject`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `SubjectPrerequisite` ADD CONSTRAINT `SubjectPrerequisite_subjectId_fkey` FOREIGN KEY (`subjectId`) REFERENCES `Subject`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `SubjectPrerequisite` ADD CONSTRAINT `SubjectPrerequisite_prerequisiteId_fkey` FOREIGN KEY (`prerequisiteId`) REFERENCES `Subject`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `SubjectLecturer` ADD CONSTRAINT `SubjectLecturer_subjectId_fkey` FOREIGN KEY (`subjectId`) REFERENCES `Subject`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `SubjectLecturer` ADD CONSTRAINT `SubjectLecturer_lecturerId_fkey` FOREIGN KEY (`lecturerId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `SubjectProposal` ADD CONSTRAINT `SubjectProposal_departmentId_fkey` FOREIGN KEY (`departmentId`) REFERENCES `Department`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `SubjectProposal` ADD CONSTRAINT `SubjectProposal_proposedById_fkey` FOREIGN KEY (`proposedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `SubjectProposal` ADD CONSTRAINT `SubjectProposal_trainingReviewedById_fkey` FOREIGN KEY (`trainingReviewedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `SubjectProposal` ADD CONSTRAINT `SubjectProposal_principalReviewedById_fkey` FOREIGN KEY (`principalReviewedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `SubjectProposal` ADD CONSTRAINT `SubjectProposal_approvedSubjectId_fkey` FOREIGN KEY (`approvedSubjectId`) REFERENCES `Subject`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `ClassProposal` ADD CONSTRAINT `ClassProposal_subjectId_fkey` FOREIGN KEY (`subjectId`) REFERENCES `Subject`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `ClassProposal` ADD CONSTRAINT `ClassProposal_semesterId_fkey` FOREIGN KEY (`semesterId`) REFERENCES `Semester`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `ClassProposal` ADD CONSTRAINT `ClassProposal_proposedById_fkey` FOREIGN KEY (`proposedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `ClassProposal` ADD CONSTRAINT `ClassProposal_reviewedById_fkey` FOREIGN KEY (`reviewedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `Class` ADD CONSTRAINT `Class_subjectId_fkey` FOREIGN KEY (`subjectId`) REFERENCES `Subject`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Class` ADD CONSTRAINT `Class_semesterId_fkey` FOREIGN KEY (`semesterId`) REFERENCES `Semester`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Class` ADD CONSTRAINT `Class_departmentId_fkey` FOREIGN KEY (`departmentId`) REFERENCES `Department`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Class` ADD CONSTRAINT `Class_managerId_fkey` FOREIGN KEY (`managerId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Class` ADD CONSTRAINT `Class_lecturerId_fkey` FOREIGN KEY (`lecturerId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `Class` ADD CONSTRAINT `Class_classProposalId_fkey` FOREIGN KEY (`classProposalId`) REFERENCES `ClassProposal`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `ClassSchedule` ADD CONSTRAINT `ClassSchedule_classId_fkey` FOREIGN KEY (`classId`) REFERENCES `Class`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
