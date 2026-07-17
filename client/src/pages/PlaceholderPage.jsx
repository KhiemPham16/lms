import { FiFilter, FiPlus, FiRefreshCcw } from 'react-icons/fi';

import { moduleMeta } from '~/shared/constants/modules.js';
import ui from '~/shared/styles/ui.module.scss';
import styles from './PlaceholderPage.module.scss';

const acceptanceMap = {
    users: ['Tạo tài khoản đúng vai trò', 'Khóa/mở khóa tài khoản', 'Reset mật khẩu và ghi audit log'],
    subjects: ['Không trùng mã môn', 'Có luồng đề xuất và phê duyệt', 'Môn đã có lớp chỉ được inactive'],
    classes: ['Tự tạo Chương 1 sau khi tạo lớp', 'Kiểm tra sức chứa', 'Kiểm tra trùng lịch'],
    enrollments: ['Đăng ký bằng transaction', 'Không vượt sức chứa', 'Có thông báo kết quả'],
    lessons: ['Hỗ trợ Text, Video, PDF', 'Ghi nhận tiến độ', 'Công khai/ẩn nội dung'],
    assignments: ['Code, trắc nghiệm, tự luận', 'Chấm tự động khi có thể', 'Hỗ trợ nộp lại theo cấu hình'],
    assessments: ['Tự động lưu lượt làm', 'Ghi nhận blur/visibilitychange', 'Tự động nộp khi hết giờ'],
    grades: ['Tổng tỷ lệ bằng 100%', 'Duyệt và khóa điểm', 'Điều chỉnh sau khóa bằng phiếu'],
    reports: ['Lọc theo kỳ/môn/lớp', 'Phân trang dữ liệu lớn', 'Xuất Excel/PDF khi backend sẵn sàng'],
    auditLog: ['Lọc theo user/module/action', 'Xem dữ liệu trước/sau', 'Ghi IP và user-agent'],
    settings: ['Chính sách token', 'Chính sách upload', 'Chế độ bảo trì']
};

export function PlaceholderPage({ moduleKey }) {
    const meta = moduleMeta[moduleKey] ?? moduleMeta.dashboard;
    const Icon = meta.icon;
    const checks = acceptanceMap[moduleKey] ?? ['Cần API contract', 'Cần DTO và quyền truy cập', 'Cần test workflow'];

    return (
        <div className={ui.pageStack}>
            <section className={ui.moduleHeader}>
                <div className={ui.moduleHeaderIcon}>
                    <Icon />
                </div>
                <div>
                    <p className={ui.eyebrow}>Khung module</p>
                    <h2>{meta.label}</h2>
                    <p>{meta.description}</p>
                </div>
            </section>

            <section className={ui.toolbar}>
                <button className={ui.primaryButton} type="button">
                    <FiPlus /> Tạo mới
                </button>
                <button className={ui.secondaryButton} type="button">
                    <FiFilter /> Bộ lọc
                </button>
                <button className={ui.secondaryButton} type="button">
                    <FiRefreshCcw /> Tải lại
                </button>
            </section>

            <section className={ui.tablePanel}>
                <div className={ui.sectionHeading}>
                    <div>
                        <p className={ui.eyebrow}>Nghiệm thu</p>
                        <h3>Tiêu chí cần bám khi nối API</h3>
                    </div>
                </div>
                <div className={ui.responsiveTable}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>Hạng mục</th>
                                <th>Trạng thái</th>
                                <th>Ghi chú frontend</th>
                            </tr>
                        </thead>
                        <tbody>
                            {checks.map((check) => (
                                <tr key={check}>
                                    <td>{check}</td>
                                    <td>
                                        <span className={ui.statusPill}>Chờ API</span>
                                    </td>
                                    <td>Cần validate form, phân trang và thông báo lỗi rõ ràng.</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    );
}
