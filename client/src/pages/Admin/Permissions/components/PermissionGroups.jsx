import { FaChevronDown, FaChevronUp } from 'react-icons/fa';

import { permissionGroups } from '~/config/permissionManagement';
import PermissionCheckbox from './PermissionCheckbox';

export default function PermissionGroups({
    selectedPermissions,
    hasWildcard,
    openGroups,
    onTogglePermission,
    onToggleGroup,
    onToggleOpenGroup
}) {
    return (
        <section className="permission-card">
            {permissionGroups.map((group) => {
                const Icon = group.icon;
                const permissionIds = group.permissions.map((permission) => permission.id);
                const allSelected = hasWildcard || permissionIds.every((id) => selectedPermissions.includes(id));
                const isOpen = openGroups[group.id];

                return (
                    <div className="permission-group" key={group.id}>
                        <div className="permission-group__head">
                            <div>
                                <Icon />
                                <h2>{group.title}</h2>
                            </div>
                            <div className="permission-group__tools">
                                <PermissionCheckbox
                                    label="Chọn tất cả"
                                    checked={allSelected}
                                    onChange={() => onToggleGroup(group)}
                                />
                                <button
                                    type="button"
                                    aria-label={isOpen ? 'Thu gọn nhóm quyền' : 'Mở nhóm quyền'}
                                    onClick={() => onToggleOpenGroup(group.id)}
                                >
                                    {isOpen ? <FaChevronUp /> : <FaChevronDown />}
                                </button>
                            </div>
                        </div>

                        {isOpen ? (
                            <div className="permission-list">
                                {group.permissions.map((permission) => (
                                    <PermissionCheckbox
                                        key={permission.id}
                                        label={permission.label}
                                        checked={hasWildcard || selectedPermissions.includes(permission.id)}
                                        onChange={() => onTogglePermission(permission.id)}
                                    />
                                ))}
                            </div>
                        ) : null}
                    </div>
                );
            })}
        </section>
    );
}
