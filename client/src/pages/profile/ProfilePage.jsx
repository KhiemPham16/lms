import classNames from 'classnames';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { FiCamera, FiEye, FiEyeOff, FiLock, FiMonitor, FiTrash2, FiUser, FiX } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { z } from 'zod';

import { apiClient, getApiMessage, resolveApiAssetUrl } from '~/shared/api/http.js';
import { ModalBackdrop } from '~/shared/components/ModalBackdrop.jsx';
import { roleLabels } from '~/shared/constants/roles.js';
import ui from '~/shared/styles/ui.module.scss';
import { useAuthStore } from '~/shared/store/authStore.js';
import styles from './ProfilePage.module.scss';

const passwordRule = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/;
const accountStatusLabels = {
    ACTIVE: 'Đang hoạt động',
    PENDING: 'Chờ kích hoạt',
    INACTIVE: 'Ngừng hoạt động',
    LOCKED: 'Đã khóa'
};

const changePasswordSchema = z
    .object({
        currentPassword: z.string().min(8, 'Mật khẩu hiện tại tối thiểu 8 ký tự'),
        newPassword: z
            .string()
            .min(8, 'Mật khẩu mới tối thiểu 8 ký tự')
            .regex(passwordRule, 'Mật khẩu mới phải có chữ hoa, chữ thường, số và ký tự đặc biệt'),
        confirmPassword: z.string().min(8, 'Vui lòng nhập lại mật khẩu mới')
    })
    .refine((values) => values.newPassword === values.confirmPassword, {
        message: 'Mật khẩu nhập lại không khớp',
        path: ['confirmPassword']
    });

export function ProfilePage() {
    const navigate = useNavigate();
    const user = useAuthStore((state) => state.user);
    const loadMe = useAuthStore((state) => state.loadMe);
    const clearSession = useAuthStore((state) => state.clearSession);
    const avatarInputRef = useRef(null);
    const [isAvatarSaving, setIsAvatarSaving] = useState(false);
    const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
    const [visibleFields, setVisibleFields] = useState({
        currentPassword: false,
        newPassword: false,
        confirmPassword: false
    });

    const {
        register,
        handleSubmit,
        reset,
        formState: { errors, isSubmitting }
    } = useForm({
        resolver: zodResolver(changePasswordSchema),
        defaultValues: {
            currentPassword: '',
            newPassword: '',
            confirmPassword: ''
        }
    });

    const closeChangePasswordModal = () => {
        setIsChangePasswordOpen(false);
        reset();
    };

    const togglePasswordVisibility = (fieldName) => {
        setVisibleFields((current) => ({
            ...current,
            [fieldName]: !current[fieldName]
        }));
    };

    const onChangePassword = async (values) => {
        try {
            const response = await apiClient.post('/auth/change-password', {
                currentPassword: values.currentPassword,
                newPassword: values.newPassword
            });

            toast.success(response.data?.message ?? 'Đổi mật khẩu thành công. Vui lòng đăng nhập lại');
            closeChangePasswordModal();
            clearSession();
            navigate('/login', { replace: true });
        } catch (error) {
            toast.error(getApiMessage(error, 'Không thể đổi mật khẩu'));
        }
    };

    const onAvatarSelected = async (event) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            toast.error('Vui lòng chọn một tệp hình ảnh');
            return;
        }

        const formData = new FormData();
        formData.append('file', file);
        setIsAvatarSaving(true);
        try {
            const response = await apiClient.post('/auth/avatar', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            await loadMe();
            toast.success(response.data?.message ?? 'Đã cập nhật ảnh đại diện');
        } catch (error) {
            toast.error(getApiMessage(error, 'Không thể cập nhật ảnh đại diện'));
        } finally {
            setIsAvatarSaving(false);
        }
    };

    const removeAvatar = async () => {
        if (!window.confirm('Xóa ảnh đại diện hiện tại?')) return;
        setIsAvatarSaving(true);
        try {
            const response = await apiClient.delete('/auth/avatar');
            await loadMe();
            toast.success(response.data?.message ?? 'Đã xóa ảnh đại diện');
        } catch (error) {
            toast.error(getApiMessage(error, 'Không thể xóa ảnh đại diện'));
        } finally {
            setIsAvatarSaving(false);
        }
    };

    const avatarUrl = resolveApiAssetUrl(user?.avatarUrl);

    const renderPasswordField = (name, label, autoComplete) => (
        <label className={ui.field}>
            <span>{label}</span>
            <div className={ui.inputControl}>
                <FiLock />
                <input type={visibleFields[name] ? 'text' : 'password'} autoComplete={autoComplete} {...register(name)} />
                <button
                    className={ui.inputAction}
                    type="button"
                    aria-label={visibleFields[name] ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    title={visibleFields[name] ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    onClick={() => togglePasswordVisibility(name)}
                >
                    {visibleFields[name] ? <FiEyeOff /> : <FiEye />}
                </button>
            </div>
            {errors[name] ? <small className={ui.fieldError}>{errors[name].message}</small> : null}
        </label>
    );

    return (
        <div className={ui.pageStack}>
            <section className={ui.moduleHeader}>
                <div className={ui.moduleHeaderIcon}>
                    {avatarUrl ? <img className={styles.headerAvatar} src={avatarUrl} alt="" /> : <FiUser />}
                </div>
                <div>
                    <p className={ui.eyebrow}>Hồ sơ cá nhân</p>
                    <h2>{user?.fullName ?? 'Người dùng'}</h2>
                    <p>{roleLabels[user?.role] ?? user?.role}</p>
                </div>
            </section>

            <section className={styles.grid}>
                <article className={classNames(styles.infoPanel, styles.avatarPanel)}>
                    <div className={styles.avatarPreview}>
                        {avatarUrl ? <img src={avatarUrl} alt={`Ảnh đại diện của ${user?.fullName ?? 'người dùng'}`} /> : <FiUser />}
                    </div>
                    <div className={styles.avatarContent}>
                        <div>
                            <h3>Ảnh đại diện</h3>
                            <p>Chọn ảnh JPG, PNG hoặc WebP. Hệ thống sẽ tự tối ưu ảnh sau khi tải lên.</p>
                        </div>
                        <div className={styles.avatarActions}>
                            <input ref={avatarInputRef} className={styles.fileInput} type="file" accept="image/*" onChange={onAvatarSelected} />
                            <button className={ui.primaryButton} type="button" onClick={() => avatarInputRef.current?.click()} disabled={isAvatarSaving}>
                                <FiCamera /> {isAvatarSaving ? 'Đang xử lý...' : avatarUrl ? 'Đổi ảnh' : 'Chọn ảnh'}
                            </button>
                            {avatarUrl ? (
                                <button className={ui.secondaryButton} type="button" onClick={removeAvatar} disabled={isAvatarSaving}>
                                    <FiTrash2 /> Xóa ảnh
                                </button>
                            ) : null}
                        </div>
                    </div>
                </article>

                <article className={styles.infoPanel}>
                    <h3>Thông tin tài khoản</h3>
                    <dl className={styles.definitionList}>
                        <div>
                            <dt>Mã người dùng</dt>
                            <dd>{user?.code ?? '-'}</dd>
                        </div>
                        <div>
                            <dt>Email</dt>
                            <dd>{user?.email ?? '-'}</dd>
                        </div>
                        <div>
                            <dt>Trạng thái</dt>
                            <dd>{accountStatusLabels[user?.status] ?? user?.status ?? '-'}</dd>
                        </div>
                        <div>
                            <dt>Đăng nhập gần nhất</dt>
                            <dd>{user?.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString('vi-VN') : '-'}</dd>
                        </div>
                    </dl>
                </article>

                <article className={styles.infoPanel}>
                    <h3>Tác vụ bảo mật</h3>
                    <button className={ui.secondaryButton} type="button" onClick={() => setIsChangePasswordOpen(true)}>
                        <FiLock /> Đổi mật khẩu
                    </button>
                    <button className={ui.secondaryButton} type="button">
                        <FiMonitor /> Đăng xuất tất cả thiết bị
                    </button>
                </article>
            </section>

            {isChangePasswordOpen ? (
                <ModalBackdrop onClose={closeChangePasswordModal}>
                    <form className={classNames(ui.modal, styles.passwordModal)} onSubmit={handleSubmit(onChangePassword)}>
                        <div className={ui.modalHeader}>
                            <div>
                                <p className={ui.eyebrow}>Bảo mật</p>
                                <h3>Đổi mật khẩu</h3>
                            </div>
                            <button className={ui.iconButton} type="button" onClick={closeChangePasswordModal} aria-label="Đóng">
                                <FiX />
                            </button>
                        </div>

                        <div className={styles.passwordFields}>
                            {renderPasswordField('currentPassword', 'Mật khẩu hiện tại', 'current-password')}
                            {renderPasswordField('newPassword', 'Mật khẩu mới', 'new-password')}
                            {renderPasswordField('confirmPassword', 'Nhập lại mật khẩu mới', 'new-password')}
                        </div>

                        <div className={ui.modalFooter}>
                            <button className={ui.secondaryButton} type="button" onClick={closeChangePasswordModal}>
                                Hủy
                            </button>
                            <button className={ui.primaryButton} type="submit" disabled={isSubmitting}>
                                {isSubmitting ? 'Đang cập nhật...' : 'Cập nhật mật khẩu'}
                            </button>
                        </div>
                    </form>
                </ModalBackdrop>
            ) : null}
        </div>
    );
}
