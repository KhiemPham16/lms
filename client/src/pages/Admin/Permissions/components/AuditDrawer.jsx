import { FaTimes } from 'react-icons/fa';

import { auditPermissionChanges } from '~/config/permissionManagement';

export default function AuditDrawer({ adminName, activeRoleLabel, onClose }) {
    return (
        <div className="audit-layer" role="presentation">
            <button
                className="audit-backdrop"
                type="button"
                aria-label="Đóng chi tiết lịch sử"
                onClick={onClose}
            />
            <aside className="audit-drawer" aria-label="Chi tiết lịch sử thay đổi">
                <header>
                    <div>
                        <h2>Chi tiết lịch sử thay đổi</h2>
                        <p>Hành động: Cập nhật phân quyền</p>
                    </div>
                    <button type="button" aria-label="Đóng" onClick={onClose}>
                        <FaTimes />
                    </button>
                </header>

                <div className="audit-summary">
                    <div>
                        <span>Người thực hiện:</span>
                        <strong>{adminName}</strong>
                    </div>
                    <div>
                        <span>Thời gian:</span>
                        <strong>24/10/2023 - 14:30:22</strong>
                    </div>
                    <div>
                        <span>Đối tượng:</span>
                        <strong className="is-link">Vai trò '{activeRoleLabel}'</strong>
                    </div>
                    <div>
                        <span>IP:</span>
                        <strong>113.161.x.x</strong>
                    </div>
                </div>

                <section className="audit-detail">
                    <h3>Chi tiết thay đổi</h3>
                    <div className="audit-table">
                        <div className="audit-table__head">
                            <span>Quyền hạn</span>
                            <span>Giá trị cũ</span>
                            <span>Giá trị mới</span>
                        </div>
                        {auditPermissionChanges.map((item) => (
                            <div className="audit-table__row" key={item.permission}>
                                <span>{item.permission}</span>
                                <em className={item.oldValue ? 'is-on' : ''}>{item.oldValue ? 'BẬT' : 'TẮT'}</em>
                                <em className={item.newValue ? 'is-on' : ''}>{item.newValue ? 'BẬT' : 'TẮT'}</em>
                            </div>
                        ))}
                    </div>
                </section>

                <footer>
                    <button type="button" onClick={onClose}>
                        Đóng
                    </button>
                </footer>
            </aside>
        </div>
    );
}
