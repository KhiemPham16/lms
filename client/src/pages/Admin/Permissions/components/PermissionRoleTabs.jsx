import { permissionRoles } from '~/config/permissionManagement';

export default function PermissionRoleTabs({ activeRole, onChangeRole }) {
    return (
        <div className="role-tabs" aria-label="Danh sách vai trò">
            {permissionRoles.map((role) => {
                const Icon = role.icon;
                return (
                    <button
                        className={role.id === activeRole ? 'is-active' : ''}
                        key={role.id}
                        type="button"
                        onClick={() => onChangeRole(role.id)}
                    >
                        <Icon />
                        {role.label}
                    </button>
                );
            })}
        </div>
    );
}
