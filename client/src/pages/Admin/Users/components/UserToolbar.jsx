import { FaSearch } from 'react-icons/fa';

import { userRoleOptions, userStatusOptions } from '~/config/userManagement';

export default function UserToolbar({ filters, onFilterChange, onSubmit }) {
    return (
        <form className="user-toolbar" onSubmit={onSubmit}>
            <label className="search-box">
                <FaSearch />
                <input
                    placeholder="Tìm theo tên, email, mã người dùng"
                    value={filters.keyword}
                    onChange={(event) => onFilterChange('keyword', event.target.value)}
                />
            </label>
            <select value={filters.role} onChange={(event) => onFilterChange('role', event.target.value)}>
                <option value="">Tất cả vai trò</option>
                {userRoleOptions.map((role) => (
                    <option key={role.value} value={role.value}>
                        {role.label}
                    </option>
                ))}
            </select>
            <select value={filters.status} onChange={(event) => onFilterChange('status', event.target.value)}>
                <option value="">Tất cả trạng thái</option>
                {userStatusOptions.map((status) => (
                    <option key={status.value} value={status.value}>
                        {status.label}
                    </option>
                ))}
            </select>
            <button type="submit">Lọc</button>
        </form>
    );
}
