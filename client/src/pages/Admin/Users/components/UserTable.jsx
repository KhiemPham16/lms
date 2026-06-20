import { FaEdit, FaLock, FaUnlock } from 'react-icons/fa';

import { userRoleLabels, userStatusLabels } from '~/config/userManagement';
import { formatDate } from '~/utils/formatDate';
import { getInitials } from '~/utils/string';

export default function UserTable({
    users,
    meta,
    loading,
    canUpdate = true,
    canLock = true,
    currentUserPublicId,
    onEdit,
    onChangeStatus,
    onChangePage
}) {
    return (
        <section className="user-table-card">
            <div className="user-table">
                <div className="user-table__head">
                    <span>Người dùng</span>
                    <span>Vai trò</span>
                    <span>Trạng thái</span>
                    <span>Ngày tạo</span>
                    <span>Thao tác</span>
                </div>
                {loading ? (
                    <div className="user-empty">Đang tải danh sách người dùng...</div>
                ) : users.length ? (
                    users.map((user) => {
                        const isCurrentUser = user.publicId === currentUserPublicId;

                        return (
                        <div className="user-table__row" key={user.publicId}>
                            <div className="user-identity">
                                <div>{getInitials(user.fullName)}</div>
                                <span>
                                    <strong>{user.fullName}</strong>
                                    <small>
                                        {user.code} • {user.email}
                                    </small>
                                </span>
                            </div>
                            <em className="role-pill">{userRoleLabels[user.role] || user.role}</em>
                            <em className={`status-pill status-${user.status}`}>
                                {userStatusLabels[user.status] || user.status}
                            </em>
                            <time>{formatDate(user.createdAt)}</time>
                            <div className="row-actions">
                                {canUpdate ? (
                                    <button type="button" onClick={() => onEdit(user)} title="Cập nhật tài khoản">
                                        <FaEdit />
                                    </button>
                                ) : null}
                                {canLock && !isCurrentUser ? (
                                    <button
                                        type="button"
                                        className={user.status === 'LOCKED' ? 'is-unlock' : 'is-lock'}
                                        onClick={() => onChangeStatus(user)}
                                        title={user.status === 'LOCKED' ? 'Mở khóa tài khoản' : 'Khóa tài khoản'}
                                    >
                                        {user.status === 'LOCKED' ? <FaUnlock /> : <FaLock />}
                                    </button>
                                ) : null}
                            </div>
                        </div>
                        );
                    })
                ) : (
                    <div className="user-empty">Không có người dùng phù hợp.</div>
                )}
            </div>

            <footer className="user-pagination">
                <span>
                    Trang {meta.page} / {meta.totalPages || 1}
                </span>
                <div>
                    <button type="button" disabled={meta.page <= 1} onClick={() => onChangePage(meta.page - 1)}>
                        Trước
                    </button>
                    <button
                        type="button"
                        disabled={meta.page >= meta.totalPages}
                        onClick={() => onChangePage(meta.page + 1)}
                    >
                        Sau
                    </button>
                </div>
            </footer>
        </section>
    );
}
