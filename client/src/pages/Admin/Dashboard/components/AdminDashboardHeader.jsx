import { FiBell, FiChevronDown, FiMoon, FiSearch, FiSun } from 'react-icons/fi';
import classNames from 'classnames/bind';

import styles from '../AdminDashboard.module.scss';

const cx = classNames.bind(styles);

export default function AdminDashboardHeader({ darkMode, onToggleTheme }) {
    return (
        <header className={cx('header')}>
            <div>
                <div>
                    <span>Trang chủ / Dashboard</span>
                    <h1>Tổng quan hệ thống</h1>
                </div>
            </div>
            <div className={cx('headerActions')}>
                <label className={cx('searchBox')}>
                    <FiSearch />
                    <input type="search" placeholder="Tìm người dùng..." />
                </label>
                <button type="button" className={cx('iconButton')} aria-label="Thông báo">
                    <FiBell />
                    <span className={cx('badge')}>5</span>
                </button>
                <button type="button" className={cx('iconButton')} onClick={onToggleTheme} aria-label="Đổi giao diện">
                    {darkMode ? <FiSun /> : <FiMoon />}
                </button>
                <button type="button" className={cx('accountButton')}>
                    Admin <FiChevronDown />
                </button>
            </div>
        </header>
    );
}
