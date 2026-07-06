INSERT IGNORE INTO `Permission` (`publicId`, `code`, `name`, `module`, `createdAt`, `updatedAt`) VALUES
    (UUID(), 'lessons.update', 'Chinh sua bai hoc', 'lessons', NOW(3), NOW(3)),
    (UUID(), 'lessons.publish', 'Xuat ban bai hoc', 'lessons', NOW(3), NOW(3)),
    (UUID(), 'lessons.delete', 'Xoa bai hoc', 'lessons', NOW(3), NOW(3));

INSERT IGNORE INTO `RolePermission` (`roleId`, `permissionId`, `createdAt`)
SELECT r.id, p.id, NOW(3)
FROM `Role` r
JOIN `Permission` p ON p.code IN ('lessons.update', 'lessons.publish', 'lessons.delete')
WHERE r.code IN ('ADMIN', 'LECTURER');

INSERT IGNORE INTO `RolePermission` (`roleId`, `permissionId`, `createdAt`)
SELECT r.id, p.id, NOW(3)
FROM `Role` r
JOIN `Permission` p ON p.code = 'lessons.read'
WHERE r.code IN ('TRAINING_OFFICER', 'PRINCIPAL');

