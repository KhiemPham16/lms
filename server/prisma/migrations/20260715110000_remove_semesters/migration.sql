ALTER TABLE `ClassProposal`
    ADD COLUMN `registrationStart` DATETIME(3) NULL,
    ADD COLUMN `registrationEnd` DATETIME(3) NULL;

UPDATE `ClassProposal` AS proposal
JOIN `Semester` AS semester ON semester.`id` = proposal.`semesterId`
SET proposal.`registrationStart` = semester.`registrationStart`,
    proposal.`registrationEnd` = semester.`registrationEnd`;

ALTER TABLE `ClassProposal`
    MODIFY `registrationStart` DATETIME(3) NOT NULL,
    MODIFY `registrationEnd` DATETIME(3) NOT NULL;

CREATE INDEX `ClassProposal_subjectId_status_idx` ON `ClassProposal`(`subjectId`, `status`);
CREATE INDEX `Class_subjectId_idx` ON `Class`(`subjectId`);

ALTER TABLE `ClassProposal` DROP FOREIGN KEY `ClassProposal_semesterId_fkey`;
ALTER TABLE `Class` DROP FOREIGN KEY `Class_semesterId_fkey`;

DROP INDEX `ClassProposal_subjectId_semesterId_idx` ON `ClassProposal`;
DROP INDEX `Class_subjectId_semesterId_idx` ON `Class`;

ALTER TABLE `ClassProposal` DROP COLUMN `semesterId`;
ALTER TABLE `Class` DROP COLUMN `semesterId`;

DROP TABLE `Semester`;
