-- Backfill default permissions for built-in dynamic roles.
-- INSERT IGNORE keeps this safe if the previous dynamic RBAC migration already inserted the same rows.

INSERT IGNORE INTO `RolePermission` (`roleId`, `permissionId`)
SELECT r.id, p.id
FROM `Role` r
CROSS JOIN `Permission` p
WHERE r.code = 'ADMIN';

INSERT IGNORE INTO `RolePermission` (`roleId`, `permissionId`)
SELECT r.id, p.id
FROM `Role` r
JOIN `Permission` p ON p.code IN (
    'users.read',
    'users.create',
    'users.update',
    'users.status',
    'departments.read',
    'system.audit.read'
)
WHERE r.code = 'HR';

INSERT IGNORE INTO `RolePermission` (`roleId`, `permissionId`)
SELECT r.id, p.id
FROM `Role` r
JOIN `Permission` p ON p.code IN (
    'departments.read',
    'system.audit.read',
    'curriculum.read',
    'courses.read',
    'course_proposals.approve',
    'course_proposals.history.read',
    'classes.read',
    'grades.read',
    'grades.export'
)
WHERE r.code = 'PRINCIPAL';

INSERT IGNORE INTO `RolePermission` (`roleId`, `permissionId`)
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

INSERT IGNORE INTO `RolePermission` (`roleId`, `permissionId`)
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

INSERT IGNORE INTO `RolePermission` (`roleId`, `permissionId`)
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

INSERT IGNORE INTO `RolePermission` (`roleId`, `permissionId`)
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

DELETE rp
FROM `RolePermission` rp
JOIN `Role` r ON r.id = rp.roleId
JOIN `Permission` p ON p.id = rp.permissionId
WHERE r.code <> 'ADMIN'
  AND p.code = 'system.permissions.manage';
