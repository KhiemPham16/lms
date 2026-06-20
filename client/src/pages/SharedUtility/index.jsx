import { useNavigate } from 'react-router-dom';
import { FaArrowLeft, FaBell, FaCog, FaUserCheck } from 'react-icons/fa';

import { routes } from '~/config/routes';
import './SharedUtility.scss';

const pageMeta = {
    profile: {
        title: 'Thông tin cá nhân',
        description: 'Xem hồ sơ cá nhân, thông tin liên hệ, vai trò hiện tại và đổi mật khẩu.',
        icon: FaUserCheck,
        items: ['Thông tin hồ sơ', 'Vai trò và trạng thái tài khoản', 'Đổi mật khẩu']
    },
    notifications: {
        title: 'Thông báo',
        description: 'Theo dõi thông báo từ hệ thống, lớp học, đề xuất, bài kiểm tra và bảng điểm.',
        icon: FaBell,
        items: ['Thông báo hệ thống', 'Thông báo lớp học', 'Thông báo kết quả xử lý']
    },
    settings: {
        title: 'Cài đặt',
        description: 'Thiết lập trải nghiệm sử dụng và các tùy chọn tài khoản.',
        icon: FaCog,
        items: ['Tùy chọn giao diện', 'Bảo mật tài khoản', 'Cấu hình thông báo']
    }
};

export default function SharedUtility({ type }) {
    const navigate = useNavigate();
    const meta = pageMeta[type] || pageMeta.profile;
    const Icon = meta.icon;

    return (
        <main className="utility-page">
            <section className="utility-panel">
                <button type="button" className="utility-back" onClick={() => navigate(-1)}>
                    <FaArrowLeft />
                    Quay lại
                </button>
                <div className="utility-icon">
                    <Icon />
                </div>
                <h1>{meta.title}</h1>
                <p>{meta.description}</p>
                <div className="utility-list">
                    {meta.items.map((item) => (
                        <button key={item} type="button">
                            {item}
                        </button>
                    ))}
                </div>
                <button type="button" className="utility-home" onClick={() => navigate(routes.admin)}>
                    Về Dashboard
                </button>
            </section>
        </main>
    );
}
