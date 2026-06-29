-- CreateTable
CREATE TABLE `Role` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `publicId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `isSystem` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Role_publicId_key`(`publicId`),
    UNIQUE INDEX `Role_code_key`(`code`),
    INDEX `Role_code_idx`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Permission` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `publicId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `module` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Permission_publicId_key`(`publicId`),
    UNIQUE INDEX `Permission_code_key`(`code`),
    INDEX `Permission_module_idx`(`module`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RolePermission` (
    `roleId` INTEGER NOT NULL,
    `permissionId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `RolePermission_permissionId_idx`(`permissionId`),
    PRIMARY KEY (`roleId`, `permissionId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Seed dynamic roles
INSERT INTO `Role` (`publicId`, `code`, `name`, `description`, `isSystem`, `updatedAt`) VALUES
    (UUID(), 'ADMIN', 'Administrator', 'Quản trị hệ thống', true, NOW(3)),
    (UUID(), 'HR', 'HR', 'Nhân sự', true, NOW(3)),
    (UUID(), 'PRINCIPAL', 'Hiệu trưởng', 'Hiệu trưởng', true, NOW(3)),
    (UUID(), 'TRAINING_OFFICER', 'Phòng đào tạo', 'Phòng đào tạo', true, NOW(3)),
    (UUID(), 'DEPARTMENT_HEAD', 'Trưởng bộ môn', 'Trưởng bộ môn', true, NOW(3)),
    (UUID(), 'LECTURER', 'Giảng viên', 'Giảng viên', true, NOW(3)),
    (UUID(), 'STUDENT', 'Sinh viên', 'Sinh viên', true, NOW(3));

-- Seed permission catalog
INSERT INTO `Permission` (`publicId`, `code`, `name`, `module`, `updatedAt`) VALUES
    (UUID(), 'users.read', 'Xem danh sách', 'users', NOW(3)),
    (UUID(), 'users.create', 'Tạo mới', 'users', NOW(3)),
    (UUID(), 'users.update', 'Chỉnh sửa', 'users', NOW(3)),
    (UUID(), 'users.status', 'Khóa/Mở khóa', 'users', NOW(3)),
    (UUID(), 'departments.read', 'Xem khoa/phòng ban', 'departments', NOW(3)),
    (UUID(), 'departments.create', 'Tạo khoa/phòng ban', 'departments', NOW(3)),
    (UUID(), 'departments.update', 'Cập nhật khoa/phòng ban', 'departments', NOW(3)),
    (UUID(), 'departments.delete', 'Xóa khoa/phòng ban', 'departments', NOW(3)),
    (UUID(), 'system.permissions.manage', 'Quản lý phân quyền', 'system', NOW(3)),
    (UUID(), 'system.audit.read', 'Xem Audit Log', 'system', NOW(3)),
    (UUID(), 'curriculum.read', 'Xem chương trình', 'curriculum', NOW(3)),
    (UUID(), 'curriculum.create', 'Tạo chương trình', 'curriculum', NOW(3)),
    (UUID(), 'courses.read', 'Xem môn học', 'courses', NOW(3)),
    (UUID(), 'courses.update', 'Cập nhật môn học', 'courses', NOW(3)),
    (UUID(), 'course_proposals.create', 'Tạo đề xuất', 'course_proposals', NOW(3)),
    (UUID(), 'course_proposals.approve', 'Duyệt đề xuất', 'course_proposals', NOW(3)),
    (UUID(), 'course_proposals.history.read', 'Xem lịch sử xử lý', 'course_proposals', NOW(3)),
    (UUID(), 'classes.read', 'Xem lớp học', 'classes', NOW(3)),
    (UUID(), 'classes.create', 'Tạo lớp', 'classes', NOW(3)),
    (UUID(), 'classes.assign_lecturer', 'Gán giảng viên', 'classes', NOW(3)),
    (UUID(), 'classes.registration.toggle', 'Mở/Đóng đăng ký', 'classes', NOW(3)),
    (UUID(), 'lessons.read', 'Xem bài học', 'lessons', NOW(3)),
    (UUID(), 'lessons.create', 'Tạo bài học', 'lessons', NOW(3)),
    (UUID(), 'exams.read', 'Xem bài thi', 'exams', NOW(3)),
    (UUID(), 'exams.create', 'Tạo bài thi', 'exams', NOW(3)),
    (UUID(), 'exams.submit', 'Làm bài thi', 'exams', NOW(3)),
    (UUID(), 'exams.grade', 'Chấm điểm', 'exams', NOW(3)),
    (UUID(), 'grades.read', 'Xem điểm', 'grades', NOW(3)),
    (UUID(), 'grades.calculate', 'Tính điểm', 'grades', NOW(3)),
    (UUID(), 'grades.export', 'Xuất bảng điểm', 'grades', NOW(3));

-- Give admin full permission initially. Other roles can be configured later.
INSERT INTO `RolePermission` (`roleId`, `permissionId`)
SELECT r.id, p.id
FROM `Role` r
CROSS JOIN `Permission` p
WHERE r.code = 'ADMIN';

-- Seed default permissions for every built-in role. These are editable later.
INSERT INTO `RolePermission` (`roleId`, `permissionId`)
SELECT r.id, p.id
FROM `Role` r
JOIN `Permission` p ON p.code IN (
    'users.read',
    'users.create',
    'users.update',
    'users.status',
    'departments.read'
)
WHERE r.code = 'HR';

INSERT INTO `RolePermission` (`roleId`, `permissionId`)
SELECT r.id, p.id
FROM `Role` r
JOIN `Permission` p ON p.code IN (
    'departments.read',
    'curriculum.read',
    'courses.read',
    'course_proposals.approve',
    'course_proposals.history.read',
    'classes.read',
    'grades.read',
    'grades.export'
)
WHERE r.code = 'PRINCIPAL';

INSERT INTO `RolePermission` (`roleId`, `permissionId`)
SELECT r.id, p.id
FROM `Role` r
JOIN `Permission` p ON p.code IN (
    'departments.read',
    'curriculum.read',
    'curriculum.create',
    'courses.read',
    'courses.update',
    'course_proposals.approve',
    'course_proposals.history.read',
    'classes.read',
    'classes.create',
    'classes.assign_lecturer',
    'classes.registration.toggle',
    'grades.read',
    'grades.calculate',
    'grades.export'
)
WHERE r.code = 'TRAINING_OFFICER';

INSERT INTO `RolePermission` (`roleId`, `permissionId`)
SELECT r.id, p.id
FROM `Role` r
JOIN `Permission` p ON p.code IN (
    'departments.read',
    'courses.read',
    'courses.update',
    'course_proposals.create',
    'course_proposals.history.read',
    'classes.read',
    'classes.assign_lecturer',
    'lessons.read',
    'exams.read',
    'grades.read'
)
WHERE r.code = 'DEPARTMENT_HEAD';

INSERT INTO `RolePermission` (`roleId`, `permissionId`)
SELECT r.id, p.id
FROM `Role` r
JOIN `Permission` p ON p.code IN (
    'courses.read',
    'classes.read',
    'lessons.read',
    'lessons.create',
    'exams.read',
    'exams.create',
    'exams.grade',
    'grades.read',
    'grades.calculate'
)
WHERE r.code = 'LECTURER';

INSERT INTO `RolePermission` (`roleId`, `permissionId`)
SELECT r.id, p.id
FROM `Role` r
JOIN `Permission` p ON p.code IN (
    'courses.read',
    'classes.read',
    'lessons.read',
    'exams.read',
    'exams.submit',
    'grades.read'
)
WHERE r.code = 'STUDENT';

-- Move existing users from enum role to dynamic role relation.
ALTER TABLE `User` ADD COLUMN `roleId` INTEGER NULL;

UPDATE `User` u
JOIN `Role` r ON r.code = u.`role`
SET u.`roleId` = r.`id`;

UPDATE `User` u
JOIN `Role` r ON r.code = 'STUDENT'
SET u.`roleId` = r.`id`
WHERE u.`roleId` IS NULL;

DROP INDEX `User_role_idx` ON `User`;
ALTER TABLE `User` DROP COLUMN `role`;
ALTER TABLE `User` MODIFY `roleId` INTEGER NOT NULL;
CREATE INDEX `User_roleId_idx` ON `User`(`roleId`);

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `Role`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RolePermission` ADD CONSTRAINT `RolePermission_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `Role`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RolePermission` ADD CONSTRAINT `RolePermission_permissionId_fkey` FOREIGN KEY (`permissionId`) REFERENCES `Permission`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
