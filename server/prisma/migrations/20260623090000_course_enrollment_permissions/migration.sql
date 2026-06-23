INSERT IGNORE INTO `Permission` (`publicId`, `code`, `name`, `module`, `updatedAt`) VALUES
    (UUID(), 'enrollments.read', 'Xem dang ky lop', 'enrollments', NOW(3)),
    (UUID(), 'enrollments.create', 'Dang ky lop', 'enrollments', NOW(3)),
    (UUID(), 'enrollments.drop', 'Huy dang ky lop', 'enrollments', NOW(3));

INSERT IGNORE INTO `RolePermission` (`roleId`, `permissionId`)
SELECT r.id, p.id
FROM `Role` r
CROSS JOIN `Permission` p
WHERE r.code = 'ADMIN'
  AND p.code IN ('enrollments.read', 'enrollments.create', 'enrollments.drop');

INSERT IGNORE INTO `RolePermission` (`roleId`, `permissionId`)
SELECT r.id, p.id
FROM `Role` r
JOIN `Permission` p ON p.code = 'enrollments.read'
WHERE r.code IN ('PRINCIPAL', 'TRAINING_OFFICER', 'DEPARTMENT_HEAD', 'LECTURER');

INSERT IGNORE INTO `RolePermission` (`roleId`, `permissionId`)
SELECT r.id, p.id
FROM `Role` r
JOIN `Permission` p ON p.code IN ('enrollments.create', 'enrollments.drop')
WHERE r.code = 'STUDENT';
