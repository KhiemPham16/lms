DELETE rp
FROM `RolePermission` rp
JOIN `Role` r ON r.id = rp.roleId
JOIN `Permission` p ON p.id = rp.permissionId
WHERE r.code <> 'ADMIN'
  AND p.code = 'system.audit.read';
