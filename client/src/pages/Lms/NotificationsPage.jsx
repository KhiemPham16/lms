import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import DataTable from '~/components/common/DataTable';
import PageShell from '~/components/common/PageShell';
import lmsService from '~/services/lms.service';
import { displayDate, normalizeList } from './utils';

const columns = [
    { key: 'title', label: 'Tiêu đề' },
    { key: 'message', label: 'Nội dung' },
    { key: 'isRead', label: 'Trạng thái', render: (row) => (row.isRead ? 'Đã đọc' : 'Chưa đọc'), badge: true },
    { key: 'createdAt', label: 'Ngày tạo', render: (row) => displayDate(row.createdAt) }
];

export default function NotificationsPage() {
    const queryClient = useQueryClient();
    const { data, isPending } = useQuery({ queryKey: ['notifications'], queryFn: () => lmsService.listNotifications({ page: 1, limit: 50 }) });
    const list = normalizeList(data);

    const markAll = useMutation({
        mutationFn: lmsService.markAllNotificationsRead,
        onSuccess: async () => {
            toast.success('Đã đánh dấu tất cả là đã đọc');
            await queryClient.invalidateQueries({ queryKey: ['notifications'] });
        }
    });

    return (
        <PageShell title="Thông báo" description="Theo dõi thông báo cá nhân trong hệ thống." actionLabel="Đánh dấu đã đọc" onAction={() => markAll.mutate()}>
            <DataTable columns={columns} rows={list.items} loading={isPending} />
        </PageShell>
    );
}
