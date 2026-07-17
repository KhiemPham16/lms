import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { FiEye, FiEyeOff, FiLock, FiLogIn, FiMail } from 'react-icons/fi';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { z } from 'zod';

import { getApiMessage } from '~/shared/api/http.js';
import ui from '~/shared/styles/ui.module.scss';
import { useAuthStore } from '~/shared/store/authStore.js';
import styles from './AuthPages.module.scss';

const rememberedLoginKey = 'lms-remembered-login';

const getRememberedLogin = () => {
    try {
        const rememberedLogin = localStorage.getItem(rememberedLoginKey);
        return rememberedLogin ? JSON.parse(rememberedLogin) : null;
    } catch {
        localStorage.removeItem(rememberedLoginKey);
        return null;
    }
};

const loginSchema = z.object({
    email: z.email('Email không hợp lệ'),
    password: z.string().min(6, 'Mật khẩu tối thiểu 6 ký tự')
});

export function LoginPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const login = useAuthStore((state) => state.login);
    const isLoading = useAuthStore((state) => state.isLoading);
    const user = useAuthStore((state) => state.user);
    const [rememberedLogin] = useState(getRememberedLogin);
    const [showPassword, setShowPassword] = useState(false);
    const [rememberPassword, setRememberPassword] = useState(Boolean(rememberedLogin?.password));

    const {
        register,
        handleSubmit,
        formState: { errors }
    } = useForm({
        resolver: zodResolver(loginSchema),
        defaultValues: {
            email: rememberedLogin?.email ?? '',
            password: rememberedLogin?.password ?? ''
        }
    });

    const syncRememberedLogin = (values) => {
        if (!rememberPassword) {
            localStorage.removeItem(rememberedLoginKey);
            return;
        }

        localStorage.setItem(
            rememberedLoginKey,
            JSON.stringify({
                email: values.email,
                password: values.password
            })
        );
    };

    const onSubmit = async (values) => {
        try {
            syncRememberedLogin(values);
            await login(values);
            const homePath = useAuthStore.getState().user?.homePath ?? user?.homePath ?? '/dashboard';
            toast.success('Đăng nhập thành công');
            navigate(location.state?.from?.pathname ?? homePath, { replace: true });
        } catch (error) {
            toast.error(getApiMessage(error, 'Đăng nhập thất bại'));
        }
    };

    return (
        <form className={styles.card} onSubmit={handleSubmit(onSubmit)}>
            <div>
                <p className={ui.eyebrow}>Đăng nhập</p>
                <h2>Chào mừng quay lại</h2>
                <p className={ui.muted}>Đăng nhập để vào dashboard theo đúng vai trò của bạn.</p>
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
                <span>Mật khẩu</span>
                <div className={ui.inputControl}>
                    <FiLock />
                    <input
                        type={showPassword ? 'text' : 'password'}
                        autoComplete={rememberPassword ? 'current-password' : 'off'}
                        {...register('password')}
                    />
                    <button
                        className={ui.inputAction}
                        type="button"
                        aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                        title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                        onClick={() => setShowPassword((current) => !current)}
                    >
                        {showPassword ? <FiEyeOff /> : <FiEye />}
                    </button>
                </div>
                {errors.password && <small className={ui.fieldError}>{errors.password.message}</small>}
            </label>

            <div className={styles.formRow}>
                <label className={styles.checkboxField}>
                    <input
                        type="checkbox"
                        checked={rememberPassword}
                        onChange={(event) => {
                            const checked = event.target.checked;
                            setRememberPassword(checked);

                            if (!checked) {
                                localStorage.removeItem(rememberedLoginKey);
                            }
                        }}
                    />
                    <span>Ghi nhớ mật khẩu</span>
                </label>
                <Link to="/forgot-password">Quên mật khẩu?</Link>
            </div>

            <button className={ui.primaryButton} type="submit" disabled={isLoading}>
                <FiLogIn />
                {isLoading ? 'Đang xử lý...' : 'Đăng nhập'}
            </button>
        </form>
    );
}
