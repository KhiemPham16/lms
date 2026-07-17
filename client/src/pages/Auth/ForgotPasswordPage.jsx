import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { FiArrowLeft, FiMail, FiSend } from 'react-icons/fi';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { z } from 'zod';

import { apiClient, getApiMessage } from '~/shared/api/http.js';
import ui from '~/shared/styles/ui.module.scss';
import styles from './AuthPages.module.scss';

const schema = z.object({
    email: z.email('Email không hợp lệ')
});

export function ForgotPasswordPage() {
    const navigate = useNavigate();
    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting }
    } = useForm({ resolver: zodResolver(schema), defaultValues: { email: '' } });

    const onSubmit = async (values) => {
        try {
            const response = await apiClient.post('/auth/forgot-password', values, { _skipAuthRefresh: true });
            toast.success(response.data?.message ?? 'Nếu email tồn tại, hệ thống sẽ gửi mã xác nhận');
            navigate(`/reset-password?email=${encodeURIComponent(values.email)}`);
        } catch (error) {
            toast.error(getApiMessage(error, 'Không thể gửi yêu cầu'));
        }
    };

    return (
        <form className={styles.card} onSubmit={handleSubmit(onSubmit)}>
            <Link className={ui.textLink} to="/login">
                <FiArrowLeft /> Quay lại đăng nhập
            </Link>
            <div>
                <p className={ui.eyebrow}>Khôi phục</p>
                <h2>Quên mật khẩu</h2>
                <p className={ui.muted}>Nhập email để nhận mã OTP đặt lại mật khẩu.</p>
            </div>
            <label className={ui.field}>
                <span>Email</span>
                <div className={ui.inputControl}>
                    <FiMail />
                    <input type="email" autoComplete="email" {...register('email')} />
                </div>
                {errors.email && <small className={ui.fieldError}>{errors.email.message}</small>}
            </label>
            <button className={ui.primaryButton} type="submit" disabled={isSubmitting}>
                <FiSend />
                {isSubmitting ? 'Đang gửi...' : 'Gửi mã OTP'}
            </button>
        </form>
    );
}
