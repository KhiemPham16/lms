import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MdEmail, MdVisibility, MdVisibilityOff, MdLock } from 'react-icons/md';

import classNames from 'classnames/bind';
import styles from './Auth.module.scss';

import { useAuthStore } from '~/stores/useAuthStore';
import { routes, getDashboardRouteByRole } from '~/config/routes';

const cx = classNames.bind(styles);

export default function Login() {
    const { login, loading } = useAuthStore();

    const [formData, setFormData] = useState({
        email: '',
        password: ''
    });

    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);

    const navigate = useNavigate();

    const handleChange = (e) => {
        setFormData((prev) => ({
            ...prev,
            [e.target.name]: e.target.value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const success = await login(formData.email, formData.password);

        if (!success) return;

        const { user } = useAuthStore.getState();

        const role = (user?.role || user?.roleDetail?.code)?.toUpperCase();

        if (!role) {
            return;
        }

        const path = getDashboardRouteByRole(role);

        navigate(path, { replace: true });
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
                                name="email"
                                placeholder="example@lms.com"
                                value={formData.email}
                                onChange={handleChange}
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
                                name="password"
                                placeholder="Nhập mật khẩu"
                                value={formData.password}
                                onChange={handleChange}
                                required
                            />

                            <button
                                type="button"
                                className={cx('toggleVisibility')}
                                onClick={() => setShowPassword((current) => !current)}
                                aria-label="Toggle password visibility"
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
                        />

                        <label htmlFor="rememberMe">Ghi nhớ đăng nhập</label>
                    </div>

                    <button type="submit" className={cx('submitBtn')} disabled={loading}>
                        {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
                    </button>
                </form>
            </div>
        </div>
    );
}
