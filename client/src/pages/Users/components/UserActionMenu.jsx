import { MoreHorizontal } from 'lucide-react';

import { Button } from '~/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from '~/components/ui/dropdown-menu';

export default function UserActionMenu({ user, onAction, canManage = true, canResetPassword = false }) {
    const canResendActivation = user.status === 'PENDING' && user.emailVerified !== true;
    const showResetOnly = !canManage && canResetPassword;

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreHorizontal className="h-4 w-4" />
                </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem onClick={() => onAction('view', user)}>Xem chi tiết</DropdownMenuItem>

                {showResetOnly ? (
                    <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => onAction('reset-password', user)}>Đặt lại mật khẩu</DropdownMenuItem>
                    </>
                ) : null}

                {canManage ? (
                    <>
                        <DropdownMenuItem onClick={() => onAction('edit', user)}>Chỉnh sửa</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onAction('role', user)}>Đổi vai trò</DropdownMenuItem>

                        <DropdownMenuSeparator />

                        <DropdownMenuItem onClick={() => onAction('status', user)}>
                            {user.status === 'LOCKED' ? 'Mở khóa tài khoản' : 'Khóa tài khoản'}
                        </DropdownMenuItem>

                        <DropdownMenuItem onClick={() => onAction('reset-password', user)}>Đặt lại mật khẩu</DropdownMenuItem>

                        {canResendActivation && (
                            <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => onAction('resend-activation', user)}>
                                    Gửi lại email kích hoạt
                                </DropdownMenuItem>
                            </>
                        )}

                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" onClick={() => onAction('delete', user)}>
                            Xóa người dùng
                        </DropdownMenuItem>
                    </>
                ) : null}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
