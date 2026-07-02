import classNames from 'classnames/bind';

import AppSidebar from '~/components/AppSidebar';
import styles from './FlowWorkbench.module.scss';

const cx = classNames.bind(styles);

const moduleTitles = {
    audit: 'Nhật ký hệ thống',
    subjects: 'Môn học',
    classes: 'Lớp học',
    lessons: 'Bài học',
    exams: 'Bài kiểm tra',
    grades: 'Điểm số',
    permissions: 'Phân quyền',
    departments: 'Phòng ban / Bộ môn',
    proposals: 'Đề xuất',
    history: 'Lịch sử',
    registration: 'Đăng ký học'
};

export default function FlowWorkbench({ workspaceKey = 'student', moduleKey }) {
    const title = moduleTitles[moduleKey] || 'Dashboard';

    return (
        <div className={cx('flow-shell')}>
            <AppSidebar workspaceKey={workspaceKey} />
            <main className={cx('flow-main')}>
                <section className={cx('flow-empty')}>
                    <span>{workspaceKey.toUpperCase()}</span>
                    <h1>{title}</h1>
                    <p>Màn hình này đã được giữ chỗ để nối với các API backend tương ứng.</p>
                </section>
            </main>
        </div>
    );
}
