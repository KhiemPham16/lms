export default function UserStats({ total, activeUsers, lockedUsers }) {
    return (
        <div className="user-stats">
            <article>
                <span>Tổng người dùng</span>
                <strong>{total}</strong>
            </article>
            <article>
                <span>Đang hiển thị active</span>
                <strong>{activeUsers}</strong>
            </article>
            <article>
                <span>Đã khóa trên trang</span>
                <strong>{lockedUsers}</strong>
            </article>
        </div>
    );
}
