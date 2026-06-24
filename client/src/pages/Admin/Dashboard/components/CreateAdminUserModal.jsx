import { useEffect, useState } from 'react';
import classNames from 'classnames/bind';
import { FiX } from 'react-icons/fi';

import styles from '../AdminDashboard.module.scss';

const cx = classNames.bind(styles);

function Field({ label, error, children }) {
    return (
        <label className={cx('field')}>
            <span>{label}</span>
            {children}
            {error && <small>{error}</small>}
        </label>
    );
}

export default function CreateAdminUserModal({ role, onClose, onSubmit }) {
    const [submitting, setSubmitting] = useState(false);
    const [errors, setErrors] = useState({});
    const [form, setForm] = useState({
        fullName: '',
        email: '',
        phone: '',
        role: role || 'HR',
        password: '123456',
        confirmPassword: '123456',
        status: 'ACTIVE',
        sendEmail: true
    });

    useEffect(() => {
        setForm((current) => ({ ...current, role: role || 'HR' }));
    }, [role]);

    if (!role) return null;

    const update = (field, value) => {
        setForm((current) => ({ ...current, [field]: value }));
        setErrors((current) => ({ ...current, [field]: '' }));
    };

    const validate = () => {
        const nextErrors = {};
        if (!form.fullName.trim()) nextErrors.fullName = 'Vui lòng nhập họ tên';
        if (!/^\S+@\S+\.\S+$/.test(form.email)) nextErrors.email = 'Email không hợp lệ';
        if (form.phone && !/^[0-9+\s-]{8,15}$/.test(form.phone)) nextErrors.phone = 'Số điện thoại không hợp lệ';
        if (form.password.length < 6) nextErrors.password = 'Mật khẩu tối thiểu 6 ký tự';
        if (form.password !== form.confirmPassword) nextErrors.confirmPassword = 'Mật khẩu xác nhận chưa khớp';
        if (!['HR', 'PRINCIPAL'].includes(form.role)) nextErrors.role = 'Chỉ được tạo HR hoặc Hiệu trưởng';
        setErrors(nextErrors);
        return Object.keys(nextErrors).length === 0;
    };

    const submit = async (event) => {
        event.preventDefault();
        if (!validate()) return;
        setSubmitting(true);
        const ok = await onSubmit({
            fullName: form.fullName,
            email: form.email,
            phone: form.phone || undefined,
            role: form.role,
            password: form.password,
            status: form.status
        });
        setSubmitting(false);
        if (ok) onClose();
    };

    return (
        <div className={cx('modalBackdrop')} role="presentation">
            <form className={cx('modal')} onSubmit={submit}>
                <div className={cx('modalHeader')}>
                    <div>
                        <span>Tài khoản quản trị cấp cao</span>
                        <h2>Tạo {role === 'HR' ? 'HR' : 'Hiệu trưởng'}</h2>
                    </div>
                    <button type="button" onClick={onClose} aria-label="Đóng"><FiX /></button>
                </div>
                <div className={cx('formGrid')}>
                    <Field label="Họ và tên" error={errors.fullName}>
                        <input value={form.fullName} onChange={(event) => update('fullName', event.target.value)} />
                    </Field>
                    <Field label="Email" error={errors.email}>
                        <input type="email" value={form.email} onChange={(event) => update('email', event.target.value)} />
                    </Field>
                    <Field label="Số điện thoại" error={errors.phone}>
                        <input value={form.phone} onChange={(event) => update('phone', event.target.value)} />
                    </Field>
                    <Field label="Vai trò" error={errors.role}>
                        <select value={form.role} onChange={(event) => update('role', event.target.value)}>
                            <option value="HR">HR</option>
                            <option value="PRINCIPAL">Hiệu trưởng</option>
                        </select>
                    </Field>
                    <Field label="Mật khẩu tạm thời" error={errors.password}>
                        <input type="password" value={form.password} onChange={(event) => update('password', event.target.value)} />
                    </Field>
                    <Field label="Xác nhận mật khẩu" error={errors.confirmPassword}>
                        <input type="password" value={form.confirmPassword} onChange={(event) => update('confirmPassword', event.target.value)} />
                    </Field>
                    <Field label="Trạng thái">
                        <select value={form.status} onChange={(event) => update('status', event.target.value)}>
                            <option value="ACTIVE">Hoạt động</option>
                            <option value="INACTIVE">Chưa kích hoạt</option>
                            <option value="LOCKED">Bị khóa</option>
                        </select>
                    </Field>
                    <label className={cx('checkboxField')}>
                        <input type="checkbox" checked={form.sendEmail} onChange={(event) => update('sendEmail', event.target.checked)} />
                        Gửi thông tin đăng nhập qua email
                    </label>
                </div>
                <div className={cx('modalActions')}>
                    <button type="button" onClick={onClose}>Hủy</button>
                    <button type="submit" disabled={submitting}>{submitting ? 'Đang tạo...' : 'Tạo tài khoản'}</button>
                </div>
            </form>
        </div>
    );
}
