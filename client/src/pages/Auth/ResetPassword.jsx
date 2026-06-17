import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { MdArrowBack, MdEmail, MdVisibility, MdVisibilityOff } from 'react-icons/md';
import { BiReset } from 'react-icons/bi';
import classNames from 'classnames/bind';

import { routes } from '~/config/routes';
import { authService } from '~/services/authService';

import styles from './Auth.module.scss';

const cx = classNames.bind(styles);

export default function ResetPassword() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [email, setEmail] = useState(searchParams.get('email') || '');
    const [otp, setOtp] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (event) => {
        event.preventDefault();
        setError('');

        if (newPassword !== confirmPassword) {
            const message = 'Mật khẩu xác nhận không khớp';
            setError(message);
            toast.error(message);
            return;
        }

        setIsLoading(true);

        try {
            const result = await authService.resetPassword(email.trim(), otp.trim(), newPassword);

            toast.success(result.message || 'Đặt lại mật khẩu thành công');
            navigate(routes.login, { replace: true });
        } catch (error) {
            const message = error.response?.data?.message || 'Không thể đặt lại mật khẩu';

            setError(message);
            toast.error(message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className={cx('container')}>
            <div className={cx('loginCard')}>
                <div className={cx('logoWrapper')}>
                    <div className={cx('blueIcon')}>
                        <BiReset size={36} color="#ffffff" />
                    </div>
                </div>

                <h2 className={cx('title')}>Đặt lại mật khẩu</h2>
                <p className={cx('subtitle')}>Nhập email, mã OTP và mật khẩu mới để cập nhật tài khoản</p>

                <form onSubmit={handleSubmit} className={cx('form')}>
                    <div className={cx('inputGroup')}>
                        <label htmlFor="resetEmail">Email</label>
                        <div className={cx('inputWrapper')}>
                            <input
                                type="email"
                                id="resetEmail"
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
                        <label htmlFor="otp">Mã OTP</label>
                        <div className={cx('inputWrapper')}>
                            <input
                                type="text"
                                id="otp"
                                inputMode="numeric"
                                placeholder="Nhập mã OTP"
                                value={otp}
                                onChange={(event) => setOtp(event.target.value)}
                                disabled={isLoading}
                                required
                            />
                        </div>
                    </div>

                    <div className={cx('inputGroup')}>
                        <label htmlFor="newPassword">Mật khẩu mới</label>
                        <div className={cx('inputWrapper')}>
                            <input
                                type={showPassword ? 'text' : 'password'}
                                id="newPassword"
                                placeholder="Tối thiểu 6 ký tự"
                                value={newPassword}
                                onChange={(event) => setNewPassword(event.target.value)}
                                disabled={isLoading}
                                minLength={6}
                                required
                            />
                            <button
                                type="button"
                                className={cx('toggleVisibility')}
                                onClick={() => setShowPassword((current) => !current)}
                                aria-label="Toggle new password visibility"
                                disabled={isLoading}
                            >
                                {showPassword ? <MdVisibilityOff /> : <MdVisibility />}
                            </button>
                        </div>
                    </div>

                    <div className={cx('inputGroup')}>
                        <label htmlFor="confirmPassword">Xác nhận mật khẩu</label>
                        <div className={cx('inputWrapper')}>
                            <input
                                type={showConfirmPassword ? 'text' : 'password'}
                                id="confirmPassword"
                                placeholder="Nhập lại mật khẩu mới"
                                value={confirmPassword}
                                onChange={(event) => setConfirmPassword(event.target.value)}
                                disabled={isLoading}
                                minLength={6}
                                required
                            />
                            <button
                                type="button"
                                className={cx('toggleVisibility')}
                                onClick={() => setShowConfirmPassword((current) => !current)}
                                aria-label="Toggle confirm password visibility"
                                disabled={isLoading}
                            >
                                {showConfirmPassword ? <MdVisibilityOff /> : <MdVisibility />}
                            </button>
                        </div>
                    </div>

                    {error && <p className={cx('errorMessage')}>{error}</p>}

                    <button type="submit" className={cx('submitBtn')} disabled={isLoading}>
                        {isLoading ? 'Đang cập nhật...' : 'Cập nhật mật khẩu'}
                    </button>

                    <div className={cx('backToLogin')}>
                        <Link to={routes.login}>
                            <MdArrowBack size={18} />
                            Quay lại đăng nhập
                        </Link>
                    </div>
                </form>
            </div>
        </div>
    );
}
