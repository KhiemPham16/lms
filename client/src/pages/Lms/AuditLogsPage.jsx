import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import DataTable from '~/components/common/DataTable';
import PageShell from '~/components/common/PageShell';
import Pagination from '~/components/common/Pagination';
import lmsService from '~/services/lms.service';
import useDebounce from '~/hooks/useDebounce';
import { displayDate, normalizeList } from './utils';

const columns = [
    { key: 'action', label: 'Hành động', badge: true },
    { key: 'module', label: 'Module' },
    { key: 'actor', label: 'Người thực hiện', render: (row) => row.actor?.fullName || row.actorName },
    { key: 'targetType', label: 'Đối tượng' },
    { key: 'createdAt', label: 'Thời gian', render: (row) => displayDate(row.createdAt) }
];

export default function AuditLogsPage() {
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const keyword = useDebounce(search, 400);
    const { data, isPending } = useQuery({
        queryKey: ['audit-logs', page, keyword],
        queryFn: () => lmsService.listAuditLogs({ page, limit: 20, keyword: keyword || undefined })
    });
    const list = normalizeList(data);

    return (
        <PageShell
            title="Nhật ký hệ thống"
            description="Kiểm tra các thay đổi quan trọng trong LMS."
            search={search}
            onSearchChange={(value) => {
                setSearch(value);
                setPage(1);
            }}
        >
            <DataTable columns={columns} rows={list.items} loading={isPending} />
            <Pagination page={page} totalPages={list.meta.totalPages} onPageChange={setPage} />
        </PageShell>
    );
}
