import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { MdArrowBack, MdEmail } from 'react-icons/md';
import { BiReset } from 'react-icons/bi';
import classNames from 'classnames/bind';

import { routes } from '~/config/routes';
import { forgotPassword } from '~/services/authService';

import styles from './Auth.module.scss';

const cx = classNames.bind(styles);

export default function ForgotPassword() {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (event) => {
        event.preventDefault();
        setIsLoading(true);
        setError('');

        try {
            const trimmedEmail = email.trim();
            const result = await forgotPassword({ email: trimmedEmail });

            toast.success(result.message || 'Kiểm tra email để lấy mã OTP');
            navigate(`${routes.resetPassword}?email=${encodeURIComponent(trimmedEmail)}`);
        } catch (error) {
            const message = error.response?.data?.message || 'Không thể gửi yêu cầu đặt lại mật khẩu';
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

                <h2 className={cx('title')}>Quên mật khẩu</h2>
                <p className={cx('subtitle')}>Nhập email tài khoản để nhận mã OTP đặt lại mật khẩu</p>

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

                    {error && <p className={cx('errorMessage')}>{error}</p>}

                    <button type="submit" className={cx('submitBtn')} disabled={isLoading}>
                        {isLoading ? 'Đang gửi...' : 'Gửi mã OTP'}
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
