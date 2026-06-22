import { FaTimes } from 'react-icons/fa';

import { userRoleOptions, userStatusOptions } from '~/config/userManagement';

export default function UserFormModal({
    mode,
    form,
    saving,
    disableRoleStatus = false,
    roleOptions = userRoleOptions,
    onChange,
    onClose,
    onSubmit
}) {
    return (
        <div className="user-modal" role="presentation">
            <button className="user-modal__backdrop" type="button" aria-label="Đóng form" onClick={onClose} />
            <form className="user-dialog" onSubmit={onSubmit}>
                <header>
                    <div>
                        <h2>{mode === 'create' ? 'Tạo tài khoản' : 'Cập nhật tài khoản'}</h2>
                        <p>
                            {mode === 'create'
                                ? 'Tạo tài khoản theo role backend đang hỗ trợ.'
                                : disableRoleStatus
                                  ? 'Bạn có thể sửa thông tin cá nhân, nhưng không thể đổi vai trò hoặc trạng thái của chính mình.'
                                  : 'Chỉnh sửa thông tin người dùng.'}
                        </p>
                    </div>
                    <button type="button" aria-label="Đóng" onClick={onClose}>
                        <FaTimes />
                    </button>
                </header>

                <div className="user-form-grid">
                    <label>
                        Mã người dùng
                        <input value={form.code} onChange={(event) => onChange('code', event.target.value)} required />
                    </label>
                    <label>
                        Họ tên
                        <input
                            value={form.fullName}
                            onChange={(event) => onChange('fullName', event.target.value)}
                            required
                        />
                    </label>
                    <label>
                        Email
                        <input
                            type="email"
                            value={form.email}
                            onChange={(event) => onChange('email', event.target.value)}
                            required
                        />
                    </label>
                    <label>
                        Số điện thoại
                        <input value={form.phone || ''} onChange={(event) => onChange('phone', event.target.value)} />
                    </label>
                    {mode === 'create' ? (
                        <label>
                            Mật khẩu mặc định
                            <input
                                type="password"
                                value={form.password}
                                minLength={6}
                                onChange={(event) => onChange('password', event.target.value)}
                            />
                        </label>
                    ) : null}
                    <label>
                        Vai trò
                        <select
                            value={form.role}
                            onChange={(event) => onChange('role', event.target.value)}
                            disabled={disableRoleStatus}
                            required
                        >
                            {roleOptions.map((role) => (
                                <option key={role.value} value={role.value}>
                                    {role.label}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label>
                        Trạng thái
                        <select
                            value={form.status}
                            onChange={(event) => onChange('status', event.target.value)}
                            disabled={disableRoleStatus}
                            required
                        >
                            {userStatusOptions.map((status) => (
                                <option key={status.value} value={status.value}>
                                    {status.label}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label>
                        Bộ môn/phòng ban ID
                        <input
                            type="number"
                            min="1"
                            value={form.departmentId || ''}
                            onChange={(event) => onChange('departmentId', event.target.value)}
                        />
                    </label>
                    <label className="is-wide">
                        Địa chỉ
                        <input value={form.address || ''} onChange={(event) => onChange('address', event.target.value)} />
                    </label>
                </div>

                <footer>
                    <button type="button" onClick={onClose}>
                        Hủy
                    </button>
                    <button type="submit" className="is-primary" disabled={saving}>
                        {saving ? 'Đang lưu...' : 'Lưu tài khoản'}
                    </button>
                </footer>
            </form>
        </div>
    );
}
