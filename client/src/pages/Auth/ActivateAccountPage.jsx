import { useEffect, useRef, useState } from 'react';
import { FiAlertCircle, FiArrowRight, FiCheckCircle, FiLoader } from 'react-icons/fi';
import { Link, useSearchParams } from 'react-router-dom';

import { apiClient, getApiMessage } from '~/shared/api/http.js';
import ui from '~/shared/styles/ui.module.scss';
import styles from './AuthPages.module.scss';

export function ActivateAccountPage() {
    const [params] = useSearchParams();
    const token = params.get('token')?.trim() ?? '';
    const hasValidToken = token.length >= 10;
    const hasStarted = useRef(false);
    const [result, setResult] = useState(() => hasValidToken
        ? { status: 'loading', message: 'Đang kích hoạt tài khoản...' }
        : { status: 'error', message: 'Liên kết kích hoạt không hợp lệ hoặc đã bị thiếu.' });

    useEffect(() => {
        if (hasStarted.current) return;
        hasStarted.current = true;

        if (!hasValidToken) return;

        const activate = async () => {
            try {
                const response = await apiClient.post('/auth/activate', { token }, { _skipAuthRefresh: true });
                window.history.replaceState(window.history.state, '', '/activate');
                setResult({
                    status: 'success',
                    message: response.data?.message ?? 'Kích hoạt tài khoản thành công'
                });
            } catch (error) {
                setResult({
                    status: 'error',
                    message: getApiMessage(error, 'Không thể kích hoạt tài khoản')
                });
            }
        };

        void activate();
    }, [hasValidToken, token]);

    const isLoading = result.status === 'loading';
    const isSuccess = result.status === 'success';

    return (
        <section className={styles.card} aria-live="polite">
            <div className={`${styles.resultIcon} ${isSuccess ? styles.resultIconSuccess : result.status === 'error' ? styles.resultIconError : ''}`}>
                {isLoading ? <FiLoader className={styles.spinningIcon} /> : isSuccess ? <FiCheckCircle /> : <FiAlertCircle />}
            </div>
            <div className={styles.resultContent}>
                <p className={ui.eyebrow}>{isLoading ? 'Đang xử lý' : isSuccess ? 'Kích hoạt thành công' : 'Kích hoạt không thành công'}</p>
                <h2>{isLoading ? 'Đang kích hoạt tài khoản' : isSuccess ? 'Tài khoản đã sẵn sàng' : 'Không thể kích hoạt'}</h2>
                <p className={ui.muted}>{result.message}</p>
            </div>
            {!isLoading ? (
                <Link className={isSuccess ? ui.primaryButton : ui.secondaryButton} to="/login">
                    {isSuccess ? 'Đăng nhập ngay' : 'Quay lại đăng nhập'} <FiArrowRight />
                </Link>
            ) : null}
        </section>
    );
}
