import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import DataTable from '~/components/common/DataTable';
import PageShell from '~/components/common/PageShell';
import SimpleFormDialog from '~/components/common/SimpleFormDialog';
import lmsService from '~/services/lms.service';
import { normalizeList } from './utils';

const fields = [
    { name: 'code', label: 'Mã khoa/phòng' },
    { name: 'name', label: 'Tên khoa/phòng' }
];

const columns = [
    { key: 'code', label: 'Mã' },
    { key: 'name', label: 'Tên' },
    { key: 'createdAt', label: 'Ngày tạo', render: (row) => row.createdAt?.slice(0, 10) }
];

export default function DepartmentsPage() {
    const [editing, setEditing] = useState(null);
    const [open, setOpen] = useState(false);
    const [selectedIds, setSelectedIds] = useState([]);
    const queryClient = useQueryClient();
    const { data, isPending } = useQuery({ queryKey: ['departments'], queryFn: lmsService.listDepartments });
    const list = normalizeList(data);

    const toggleDepartment = (id) => {
        setSelectedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
    };

    const togglePage = (ids) => {
        setSelectedIds((current) => {
            const allSelected = ids.length > 0 && ids.every((id) => current.includes(id));
            if (allSelected) return current.filter((id) => !ids.includes(id));
            return [...new Set([...current, ...ids])];
        });
    };

    const save = useMutation({
        mutationFn: (payload) =>
            editing ? lmsService.updateDepartment(editing.publicId, payload) : lmsService.createDepartment(payload),
        onSuccess: async () => {
            toast.success('Đã lưu khoa/phòng');
            setOpen(false);
            setEditing(null);
            await queryClient.invalidateQueries({ queryKey: ['departments'] });
        }
    });

    const remove = useMutation({
        mutationFn: lmsService.deleteDepartment,
        onSuccess: async () => {
            toast.success('Đã xóa khoa/phòng');
            await queryClient.invalidateQueries({ queryKey: ['departments'] });
        }
    });

    return (
        <PageShell title="Khoa và phòng ban" description="Quản lý đơn vị đào tạo trong LMS." actionLabel="Thêm khoa" onAction={() => setOpen(true)}>
            <DataTable
                columns={columns}
                rows={list.items}
                loading={isPending}
                selectable
                selectedIds={selectedIds}
                onToggleRow={toggleDepartment}
                onTogglePage={togglePage}
                actions={[
                    {
                        label: 'Sửa',
                        onClick: (row) => {
                            setEditing(row);
                            setOpen(true);
                        }
                    },
                    { label: 'Xóa', variant: 'destructive', onClick: (row) => remove.mutate(row.publicId) }
                ]}
            />

            <SimpleFormDialog
                open={open}
                onOpenChange={(value) => {
                    setOpen(value);
                    if (!value) setEditing(null);
                }}
                title={editing ? 'Sửa khoa/phòng' : 'Thêm khoa/phòng'}
                fields={fields}
                initialValues={editing}
                onSubmit={(payload) => save.mutate(payload)}
                submitting={save.isPending}
            />
        </PageShell>
    );
}
