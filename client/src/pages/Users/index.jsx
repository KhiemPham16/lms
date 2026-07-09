import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';

import DataTable from '~/components/common/DataTable';
import PageShell from '~/components/common/PageShell';
import Pagination from '~/components/common/Pagination';
import SimpleFormDialog from '~/components/common/SimpleFormDialog';
import { Button } from '~/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '~/components/ui/dialog';
import { Label } from '~/components/ui/label';
import useUsers from '~/hooks/useUsers';
import UserTable from './components/UserTable';
import useDebounce from '~/hooks/useDebounce';
import CreateUserDialog from './components/CreateUserDialog';
import ImportUsersCsvDialog from './components/ImportUsersCsvDialog';
import useRoles from '~/hooks/useRoles';
import usersService from '~/services/users.service';
import useAuthStore from '~/stores/auth.store';

const editFields = [
    { name: 'code', label: 'Mã người dùng' },
    { name: 'fullName', label: 'Họ tên' },
    { name: 'email', label: 'Email', type: 'email' },
    { name: 'phone', label: 'Số điện thoại', optional: true },
    { name: 'address', label: 'Địa chỉ', type: 'textarea', optional: true }
];

const activityColumns = [
    { key: 'action', label: 'Hành động', badge: true },
    { key: 'module', label: 'Module' },
    { key: 'actor', label: 'Người thực hiện', render: (row) => row.actor?.fullName || row.actor?.email },
    { key: 'createdAt', label: 'Thời gian', render: (row) => row.createdAt?.slice(0, 10) }
];

const userGroups = {
    STUDENT: 'Quản lý sinh viên',
    'LECTURER,DEPARTMENT_HEAD': 'Quản lý giảng viên',
    'ADMIN,HR,TRAINING_OFFICER,PRINCIPAL': 'Quản lý nhân sự'
};

const sampleCsv = [
    'fullName,email,phone,password,role,status,gender,departmentId,cohortYear,code,dateOfBirth,address',
    'Nguyen Van Sinh,sinhvien1@lms.com,0901000001,Lms@123,STUDENT,PENDING,MALE,1,2026,,2008-01-15,"TP. Ho Chi Minh"',
    'Tran Thi Giang,giangvien1@lms.com,0901000002,Lms@123,LECTURER,PENDING,FEMALE,1,2026,,1990-05-20,"Ha Noi"'
].join('\n');

export default function UsersPage() {
    const [search, setSearch] = useState('');
    const [createOpen, setCreateOpen] = useState(false);
    const [importOpen, setImportOpen] = useState(false);
    const [viewUser, setViewUser] = useState(null);
    const [editUser, setEditUser] = useState(null);
    const [roleUser, setRoleUser] = useState(null);
    const [activities, setActivities] = useState([]);
    const [pagesByGroup, setPagesByGroup] = useState({});
    const [selectedIdsByGroup, setSelectedIdsByGroup] = useState({});
    const [searchParams] = useSearchParams();
    const keyword = useDebounce(search, 500);
    const queryClient = useQueryClient();
    const { data: roles = [] } = useRoles();
    const currentUser = useAuthStore((state) => state.user);
    const roleFilterKey = searchParams.get('roles') || '';
    const roleFilters = useMemo(() => roleFilterKey.split(',').map((role) => role.trim()).filter(Boolean), [roleFilterKey]);
    const pageTitle = userGroups[roleFilterKey] || 'Quản lý người dùng';
    const page = pagesByGroup[roleFilterKey] ?? 1;
    const selectedIds = selectedIdsByGroup[roleFilterKey] ?? [];
    const setPage = (nextPage) => {
        setPagesByGroup((current) => ({
            ...current,
            [roleFilterKey]: typeof nextPage === 'function' ? nextPage(current[roleFilterKey] ?? 1) : nextPage
        }));
    };
    const setSelectedIds = (nextIds) => {
        setSelectedIdsByGroup((current) => ({
            ...current,
            [roleFilterKey]: typeof nextIds === 'function' ? nextIds(current[roleFilterKey] ?? []) : nextIds
        }));
    };

    const { data, isPending } = useUsers({
        page,
        limit: 10,
        keyword,
        roles: roleFilters
    });

    const invalidateUsers = async () => {
        await queryClient.invalidateQueries({ queryKey: ['users'] });
    };

    const updateUser = useMutation({
        mutationFn: ({ publicId, payload }) => usersService.update(publicId, payload),
        onSuccess: async () => {
            toast.success('Đã cập nhật người dùng');
            setEditUser(null);
            await invalidateUsers();
        }
    });

    const updateRole = useMutation({
        mutationFn: ({ publicId, roleId, userIds }) =>
            userIds?.length ? usersService.bulkAssignRole(userIds, Number(roleId)) : usersService.updateRole(publicId, Number(roleId)),
        onSuccess: async () => {
            toast.success('Đã đổi vai trò');
            setRoleUser(null);
            setSelectedIds([]);
            await invalidateUsers();
        }
    });

    const updateStatus = useMutation({
        mutationFn: ({ publicId, status, userIds }) => {
            if (userIds?.length) {
                return status === 'LOCKED' ? usersService.bulkLock(userIds) : usersService.bulkUnlock(userIds);
            }
            return usersService.updateStatus(publicId, status);
        },
        onSuccess: async () => {
            toast.success('Đã cập nhật trạng thái');
            setSelectedIds([]);
            await invalidateUsers();
        }
    });

    const resetPassword = useMutation({
        mutationFn: usersService.resetPassword,
        onSuccess: (result) => {
            toast.success(result?.message ?? 'Đã đặt lại mật khẩu', {
                description: result?.temporaryPassword ? `Mật khẩu tạm: ${result.temporaryPassword}` : undefined
            });
        }
    });

    const resendActivation = useMutation({
        mutationFn: usersService.resendActivation,
        onSuccess: (result) => {
            toast.success(result?.message ?? 'Đã gửi lại email kích hoạt');
        }
    });

    const removeUser = useMutation({
        mutationFn: usersService.remove,
        onSuccess: async () => {
            toast.success('Đã xóa người dùng');
            await invalidateUsers();
        }
    });

    const loadActivities = useMutation({
        mutationFn: (publicId) => usersService.activities(publicId),
        onSuccess: (result) => {
            setActivities(result?.items ?? []);
        }
    });

    const viewOnlyRoles = ['ADMIN', 'PRINCIPAL'];
    const isViewOnlyRole = (user) => viewOnlyRoles.includes(user?.role?.code);
    const isCurrentUser = (user) => user?.publicId === currentUser?.publicId || user?.email === currentUser?.email;
    const canManageUser = (user) => !isViewOnlyRole(user) && !isCurrentUser(user);
    const canResetPasswordUser = (user) => canManageUser(user) || isCurrentUser(user);
    const getProtectedReason = (user) => {
        if (isCurrentUser(user)) return 'Tài khoản hiện tại - chỉ đặt lại mật khẩu';
        if (isViewOnlyRole(user)) return 'Chỉ được xem chi tiết';
        return 'Tài khoản được bảo vệ';
    };
    const users = data?.items ?? [];
    const selectedUsers = users.filter((user) => selectedIds.includes(user.publicId));
    const manageableSelectedIds = selectedUsers.filter(canManageUser).map((user) => user.publicId);
    const activationSelectedIds = selectedUsers
        .filter((user) => canManageUser(user) && user.status === 'PENDING' && user.emailVerified !== true)
        .map((user) => user.publicId);

    const toggleUserSelection = (publicId) => {
        setSelectedIds((current) => (current.includes(publicId) ? current.filter((id) => id !== publicId) : [...current, publicId]));
    };

    const togglePageSelection = (publicIds) => {
        setSelectedIds((current) => {
            const allSelected = publicIds.length > 0 && publicIds.every((id) => current.includes(id));
            if (allSelected) return current.filter((id) => !publicIds.includes(id));
            return [...new Set([...current, ...publicIds])];
        });
    };

    const guardManageUser = (user, type) => {
        if (type === 'reset-password' && canResetPasswordUser(user)) {
            return true;
        }

        if (!canManageUser(user)) {
            toast.error(getProtectedReason(user));
            return false;
        }
        return true;
    };

    const handleAction = (type, user) => {
        if (type === 'view') {
            setViewUser(user);
            setActivities([]);
            loadActivities.mutate(user.publicId);
            return;
        }

        if (!guardManageUser(user, type)) return;

        if (type === 'edit') {
            setEditUser(user);
            return;
        }

        if (type === 'role') {
            setRoleUser(user);
            return;
        }

        if (type === 'status') {
            updateStatus.mutate({
                publicId: user.publicId,
                status: user.status === 'LOCKED' ? 'ACTIVE' : 'LOCKED'
            });
            return;
        }

        if (type === 'reset-password') {
            resetPassword.mutate(user.publicId);
            return;
        }

        if (type === 'resend-activation') {
            if (user.status !== 'PENDING' || user.emailVerified === true) {
                toast.info('Tài khoản này đã được kích hoạt, không cần gửi lại email kích hoạt.');
                return;
            }

            resendActivation.mutate(user.publicId);
            return;
        }

        if (type === 'delete') {
            removeUser.mutate(user.publicId);
        }
    };

    const handleRoleSubmit = (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const roleId = form.get('roleId');
        if (!roleUser || !roleId) return;
        updateRole.mutate(roleUser.bulk ? { userIds: manageableSelectedIds, roleId } : { publicId: roleUser.publicId, roleId });
    };

    const handleEditSubmit = (payload) => {
        if (!editUser) return;
        updateUser.mutate({ publicId: editUser.publicId, payload });
    };

    const downloadSampleCsv = () => {
        const blob = new Blob([`\uFEFF${sampleCsv}`], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'mau-import-users.csv';
        link.click();
        URL.revokeObjectURL(url);
    };

    return (
        <PageShell
            title={pageTitle}
            description="Quản lý tài khoản trong hệ thống."
            search={search}
            onSearchChange={(value) => {
                setSearch(value);
                setPage(1);
                setSelectedIds([]);
            }}
            actionLabel="Thêm người dùng"
            onAction={() => setCreateOpen(true)}
            extraActions={
                <>
                    <Button type="button" variant="outline" onClick={downloadSampleCsv}>
                        Tải CSV mẫu
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setImportOpen(true)}>
                        Nhập CSV
                    </Button>
                </>
            }
        >

            {selectedIds.length > 0 ? (
                <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <p className="font-medium">{manageableSelectedIds.length} tài khoản đã chọn</p>
                        <p className="text-sm text-muted-foreground">
                            Tài khoản Admin được bảo vệ nên không thể chọn hoặc thao tác hàng loạt.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            disabled={manageableSelectedIds.length === 0 || updateStatus.isPending}
                            onClick={() => updateStatus.mutate({ userIds: manageableSelectedIds, status: 'LOCKED' })}
                        >
                            Khóa
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            disabled={manageableSelectedIds.length === 0 || updateStatus.isPending}
                            onClick={() => updateStatus.mutate({ userIds: manageableSelectedIds, status: 'ACTIVE' })}
                        >
                            Mở khóa
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            disabled={manageableSelectedIds.length === 0}
                            onClick={() => setRoleUser({ bulk: true })}
                        >
                            Gán vai trò
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            disabled={activationSelectedIds.length === 0 || resendActivation.isPending}
                            onClick={() => Promise.all(activationSelectedIds.map((id) => resendActivation.mutateAsync(id))).then(() => setSelectedIds([]))}
                        >
                            Gửi email kích hoạt
                        </Button>
                        <Button type="button" variant="ghost" onClick={() => setSelectedIds([])}>
                            Bỏ chọn
                        </Button>
                    </div>
                </div>
            ) : null}

            <UserTable
                users={users}
                loading={isPending}
                onAction={handleAction}
                selectedIds={selectedIds}
                onToggleUser={toggleUserSelection}
                onTogglePage={togglePageSelection}
                canManageUser={canManageUser}
                canResetPasswordUser={canResetPasswordUser}
                getProtectedReason={getProtectedReason}
            />

            <Pagination
                page={page}
                totalPages={data?.meta?.totalPages ?? 1}
                onPageChange={(nextPage) => {
                    setPage(nextPage);
                    setSelectedIds([]);
                }}
            />

            <CreateUserDialog open={createOpen} onOpenChange={setCreateOpen} />
            <ImportUsersCsvDialog open={importOpen} onOpenChange={setImportOpen} />

            {editUser ? (
                <SimpleFormDialog
                    open={Boolean(editUser)}
                    onOpenChange={(open) => !open && setEditUser(null)}
                    title="Cập nhật người dùng"
                    fields={editFields}
                    initialValues={editUser}
                    onSubmit={handleEditSubmit}
                    submitting={updateUser.isPending}
                />
            ) : null}

            <Dialog open={Boolean(roleUser)} onOpenChange={(open) => !open && setRoleUser(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{roleUser?.bulk ? 'Gán vai trò hàng loạt' : 'Đổi vai trò'}</DialogTitle>
                    </DialogHeader>
                    <form className="space-y-4" onSubmit={handleRoleSubmit}>
                        <div className="space-y-2">
                            <Label htmlFor="roleId">Vai trò</Label>
                            <select
                                id="roleId"
                                name="roleId"
                                defaultValue={roleUser?.bulk ? '' : (roleUser?.roleId ?? '')}
                                className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
                                required
                            >
                                <option value="">Chọn vai trò</option>
                                {roles.filter((role) => role.code !== 'ADMIN').map((role) => (
                                    <option key={role.publicId} value={role.id}>
                                        {role.name} ({role.code})
                                    </option>
                                ))}
                            </select>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setRoleUser(null)}>
                                Hủy
                            </Button>
                            <Button type="submit" disabled={updateRole.isPending}>
                                Lưu
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={Boolean(viewUser)} onOpenChange={(open) => !open && setViewUser(null)}>
                <DialogContent className="sm:max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>Chi tiết người dùng</DialogTitle>
                    </DialogHeader>
                    {viewUser ? (
                        <div className="space-y-4">
                            <div className="grid gap-3 text-sm md:grid-cols-2">
                                <p><strong>Mã:</strong> {viewUser.code}</p>
                                <p><strong>Họ tên:</strong> {viewUser.fullName}</p>
                                <p><strong>Email:</strong> {viewUser.email}</p>
                                <p><strong>Vai trò:</strong> {viewUser.role?.name}</p>
                                <p><strong>Phòng ban:</strong> {viewUser.department?.name || '-'}</p>
                                <p><strong>Trạng thái:</strong> {viewUser.status}</p>
                            </div>
                            <DataTable columns={activityColumns} rows={activities} loading={loadActivities.isPending} />
                        </div>
                    ) : null}
                </DialogContent>
            </Dialog>
        </PageShell>
    );
}
