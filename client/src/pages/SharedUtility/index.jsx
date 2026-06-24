import { FiBell, FiSettings, FiUser } from 'react-icons/fi';

const config = {
    profile: {
        icon: FiUser,
        title: 'Hồ sơ cá nhân',
        description: 'Thông tin tài khoản, vai trò và quyền truy cập của người dùng hiện tại.'
    },
    notifications: {
        icon: FiBell,
        title: 'Thông báo',
        description: 'Các thông báo hệ thống, cảnh báo tài khoản và cập nhật mới.'
    },
    settings: {
        icon: FiSettings,
        title: 'Cài đặt',
        description: 'Cấu hình tài khoản, giao diện và các tùy chọn bảo mật.'
    }
};

export default function SharedUtility({ type = 'profile' }) {
    const item = config[type] || config.profile;
    const Icon = item.icon;

    return (
        <main style={{ minHeight: '100vh', background: '#f5f7fb', padding: 28 }}>
            <section style={{
                minHeight: 'calc(100vh - 56px)',
                border: '1px solid #e5e7eb',
                borderRadius: 14,
                background: '#fff',
                display: 'grid',
                placeContent: 'center',
                textAlign: 'center',
                gap: 10,
                color: '#1f2937'
            }}>
                <Icon size={32} color="#2a83e9" />
                <h1 style={{ margin: 0 }}>{item.title}</h1>
                <p style={{ margin: 0, color: '#6b7280' }}>{item.description}</p>
            </section>
        </main>
    );
}
