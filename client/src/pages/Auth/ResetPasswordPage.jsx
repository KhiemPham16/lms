import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { FiArrowLeft, FiKey, FiLock, FiMail, FiRefreshCcw } from 'react-icons/fi';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { z } from 'zod';

import { apiClient, getApiMessage } from '~/shared/api/http.js';
import ui from '~/shared/styles/ui.module.scss';
import styles from './AuthPages.module.scss';

const schema = z.object({
    email: z.email('Email không hợp lệ'),
    otp: z.string().regex(/^\d{6}$/, 'OTP gồm 6 chữ số'),
    newPassword: z
        .string()
        .min(8, 'Mật khẩu mới tối thiểu 8 ký tự')
        .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/, 'Mật khẩu phải có chữ hoa, chữ thường, số và ký tự đặc biệt')
});

export function ResetPasswordPage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const emailFromQuery = searchParams.get('email') ?? '';
    const {
        register,
        handleSubmit,
        getValues,
        formState: { errors, isSubmitting }
    } = useForm({ resolver: zodResolver(schema), defaultValues: { email: emailFromQuery, otp: '', newPassword: '' } });

    const resendOtp = async () => {
        const email = getValues('email');
        if (!email) {
            toast.error('Vui lòng nhập email trước khi gửi lại OTP');
            return;
        }

        try {
            const response = await apiClient.post('/auth/forgot-password', { email }, { _skipAuthRefresh: true });
            toast.success(response.data?.message ?? 'Đã gửi lại mã OTP');
        } catch (error) {
            toast.error(getApiMessage(error, 'Không thể gửi lại OTP'));
        }
    };

    const onSubmit = async (values) => {
        try {
            const response = await apiClient.post('/auth/reset-password', values, { _skipAuthRefresh: true });
            toast.success(response.data?.message ?? 'Đặt lại mật khẩu thành công');
            navigate('/login');
        } catch (error) {
            toast.error(getApiMessage(error, 'Không thể đặt lại mật khẩu'));
        }
    };

    return (
        <form className={styles.card} onSubmit={handleSubmit(onSubmit)}>
            <Link className={ui.textLink} to="/login">
                <FiArrowLeft /> Quay lại đăng nhập
            </Link>
            <div>
                <p className={ui.eyebrow}>Bảo mật</p>
                <h2>Nhập mã OTP</h2>
                <p className={ui.muted}>Dùng mã OTP từ email để tạo mật khẩu mới.</p>
            </div>
            <label className={ui.field}>
                <span>Email</span>
                <div className={ui.inputControl}>
                    <FiMail />
                    <input type="email" autoComplete="email" {...register('email')} />
                </div>
                {errors.email && <small className={ui.fieldError}>{errors.email.message}</small>}
            </label>
            <label className={ui.field}>
                <span>Mã OTP</span>
                <div className={ui.inputControl}>
                    <FiKey />
                    <input inputMode="numeric" autoComplete="one-time-code" maxLength={6} {...register('otp')} />
                </div>
                {errors.otp && <small className={ui.fieldError}>{errors.otp.message}</small>}
            </label>
            <label className={ui.field}>
                <span>Mật khẩu mới</span>
                <div className={ui.inputControl}>
                    <FiLock />
                    <input type="password" autoComplete="new-password" {...register('newPassword')} />
                </div>
                {errors.newPassword && <small className={ui.fieldError}>{errors.newPassword.message}</small>}
            </label>
            <button className={ui.primaryButton} type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Đang cập nhật...' : 'Cập nhật mật khẩu'}
            </button>
            <button className={ui.secondaryButton} type="button" onClick={resendOtp} disabled={isSubmitting}>
                <FiRefreshCcw /> Gửi lại OTP
            </button>
        </form>
    );
}
