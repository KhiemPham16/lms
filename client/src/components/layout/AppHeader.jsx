import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Button } from '~/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from '~/components/ui/dropdown-menu';
import lmsService from '~/services/lms.service';
import useAuthStore from '~/stores/auth.store';
import { removeAccessToken } from '~/utils/token';

export default function AppHeader() {
    const user = useAuthStore((state) => state.user);
    const logout = useAuthStore((state) => state.logout);
    const queryClient = useQueryClient();

    const notifications = useQuery({
        queryKey: ['header-notifications'],
        queryFn: () => lmsService.listNotifications({ page: 1, limit: 5 })
    });

    const unread = useQuery({
        queryKey: ['header-notifications-unread'],
        queryFn: lmsService.unreadNotifications
    });

    const markAllRead = useMutation({
        mutationFn: lmsService.markAllNotificationsRead,
        onSuccess: async () => {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['header-notifications'] }),
                queryClient.invalidateQueries({ queryKey: ['header-notifications-unread'] }),
                queryClient.invalidateQueries({ queryKey: ['notifications'] })
            ]);
        }
    });

    const handleLogout = () => {
        removeAccessToken();
        logout();
    };

    const items = notifications.data?.items ?? [];
    const unreadCount = unread.data?.count ?? unread.data?.total ?? 0;

    return (
        <header className="flex h-16 items-center justify-between border-b border-border bg-card px-6 shadow-xs">
            <h1 className="text-lg font-semibold">Bảng điều khiển LMS</h1>

            <div className="flex items-center gap-3 text-sm">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="relative" aria-label="Thông báo">
                            <Bell className="size-4" />
                            {unreadCount > 0 ? (
                                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-destructive-foreground">
                                    {unreadCount > 9 ? '9+' : unreadCount}
                                </span>
                            ) : null}
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-80">
                        <DropdownMenuLabel className="flex items-center justify-between">
                            <span>Thông báo</span>
                            <button
                                type="button"
                                className="text-xs text-primary hover:underline"
                                onClick={() => markAllRead.mutate()}
                            >
                                Đánh dấu đã đọc
                            </button>
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {notifications.isPending ? (
                            <DropdownMenuItem>Đang tải thông báo...</DropdownMenuItem>
                        ) : items.length === 0 ? (
                            <DropdownMenuItem>Chưa có thông báo</DropdownMenuItem>
                        ) : (
                            items.map((item) => (
                                <DropdownMenuItem key={item.publicId} className="flex flex-col items-start gap-1 whitespace-normal">
                                    <span className="font-medium">{item.title}</span>
                                    <span className="line-clamp-2 text-xs text-muted-foreground">{item.message}</span>
                                </DropdownMenuItem>
                            ))
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild>
                            <Link to="/notifications">Xem tất cả thông báo</Link>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>

                <span>{user?.fullName || user?.email}</span>
                <Button variant="outline" size="sm" onClick={handleLogout}>
                    Đăng xuất
                </Button>
            </div>
        </header>
    );
}
