INSERT IGNORE INTO `RolePermission` (`roleId`, `permissionId`)
SELECT r.id, p.id
FROM `Role` r
JOIN `Permission` p ON p.code = 'course_proposals.create'
WHERE r.code = 'TRAINING_OFFICER';
