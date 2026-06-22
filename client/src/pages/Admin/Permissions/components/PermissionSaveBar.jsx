import { FaRegSave } from 'react-icons/fa';

export default function PermissionSaveBar({ activeRoleLabel, hasChanges, isSaving, onReset, onSave }) {
    return (
        <footer className="permission-savebar">
            <span>
                Đang chỉnh sửa quyền cho: <strong>{activeRoleLabel}</strong>
            </span>
            <div>
                <button type="button" onClick={onReset} disabled={!hasChanges || isSaving}>
                    Hủy thay đổi
                </button>
                <button type="button" className="permission-save" onClick={onSave} disabled={!hasChanges || isSaving}>
                    <FaRegSave />
                    {isSaving ? 'Đang lưu...' : 'Lưu cấu hình'}
                </button>
            </div>
        </footer>
    );
}
