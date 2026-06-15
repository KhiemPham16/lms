import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { MdEmail, MdVisibility, MdVisibilityOff, MdLock } from 'react-icons/md';
import classNames from 'classnames/bind';

import { getDashboardRouteByRole, routes } from '~/config/routes';
import { useAuthStore } from '~/stores/authStore';

import styles from './Auth.module.scss';

const cx = classNames.bind(styles);

export default function Login() {
    const navigate = useNavigate();
    const location = useLocation();
    const login = useAuthStore((state) => state.login);
    const isLoading = useAuthStore((state) => state.isLoading);
    const error = useAuthStore((state) => state.error);

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);

    const handleSubmit = async (event) => {
        event.preventDefault();

        try {
            const user = await login({
                email: email.trim(),
                password,
                remember: rememberMe
            });

            const fallbackPath = getDashboardRouteByRole(user.role);
            const redirectPath = location.state?.from?.pathname || fallbackPath;

            toast.success('Đăng nhập thành công');
            navigate(redirectPath, { replace: true });
        } catch (error) {
            toast.error(error.message);
        }
    };

    return (
        <div className={cx('container')}>
            <div className={cx('loginCard')}>
                <div className={cx('logoWrapper')}>
                    <div className={cx('blueIcon')}>
                        <MdLock size={32} color="#ffffff" />
                    </div>
                </div>
                <h2 className={cx('title')}>Đăng nhập</h2>
                <p className={cx('subtitle')}>Nhập email và mật khẩu để truy cập hệ thống LMS</p>

                <form onSubmit={handleSubmit} className={cx('form')}>
                    <div className={cx('inputGroup')}>
                        <label htmlFor="email">Email</label>
                        <div className={cx('inputWrapper')}>
                            <input
                                type="email"
                                id="email"
                                placeholder="example@lms.com"
                                value={email}
                                onChange={(event) => setEmail(event.target.value)}
                                disabled={isLoading}
                                required
                            />
                            <MdEmail className={cx('inputIcon')} />
                        </div>
                    </div>

                    <div className={cx('inputGroup')}>
                        <div className={cx('labelRow')}>
                            <label htmlFor="password">Mật khẩu</label>
                            <Link to={routes.forgotPassword} className={cx('forgotLink')}>
                                Quên mật khẩu?
                            </Link>
                        </div>
                        <div className={cx('inputWrapper')}>
                            <input
                                type={showPassword ? 'text' : 'password'}
                                id="password"
                                placeholder="Nhập mật khẩu"
                                value={password}
                                onChange={(event) => setPassword(event.target.value)}
                                disabled={isLoading}
                                required
                            />
                            <button
                                type="button"
                                className={cx('toggleVisibility')}
                                onClick={() => setShowPassword((current) => !current)}
                                aria-label="Toggle password visibility"
                                disabled={isLoading}
                            >
                                {showPassword ? <MdVisibilityOff /> : <MdVisibility />}
                            </button>
                        </div>
                    </div>

                    <div className={cx('rememberMeGroup')}>
                        <input
                            type="checkbox"
                            id="rememberMe"
                            checked={rememberMe}
                            onChange={(event) => setRememberMe(event.target.checked)}
                            disabled={isLoading}
                        />
                        <label htmlFor="rememberMe">Ghi nhớ đăng nhập</label>
                    </div>

                    {error && <p className={cx('errorMessage')}>{error}</p>}

                    <button type="submit" className={cx('submitBtn')} disabled={isLoading}>
                        {isLoading ? 'Đang đăng nhập...' : 'Đăng nhập'}
                    </button>
                </form>
            </div>
        </div>
    );
}
