import { Fragment, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, KeyRound, Pencil, Save, Search, ShieldCheck, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Checkbox } from '~/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '~/components/ui/dialog';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import { Textarea } from '~/components/ui/textarea';
import lmsService from '~/services/lms.service';
import { normalizeList } from './utils';

const roleFormDefault = { code: '', name: '', description: '' };

const moduleLabels = {
    audit: 'Nhật ký hệ thống',
    classes: 'Lớp học',
    courses: 'Môn học',
    departments: 'Khoa / phòng ban',
    enrollments: 'Ghi danh',
    exams: 'Bài kiểm tra',
    grades: 'Điểm số',
    lessons: 'Bài học',
    media: 'Media',
    notifications: 'Thông báo',
    roles: 'Vai trò',
    system: 'Hệ thống',
    users: 'Người dùng'
};

const actionLabels = {
    approve: 'Duyệt',
    assign: 'Phân công',
    create: 'Tạo mới',
    delete: 'Xóa',
    export: 'Xuất dữ liệu',
    grade: 'Chấm điểm',
    import: 'Nhập dữ liệu',
    manage: 'Quản lý',
    publish: 'Xuất bản',
    read: 'Xem',
    status: 'Đổi trạng thái',
    update: 'Cập nhật'
};

const formatDateTime = (value) => {
    if (!value) return 'Chưa cập nhật';
    return new Intl.DateTimeFormat('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }).format(new Date(value));
};

const normalizePermissionPayload = (payload) => {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.items)) return payload.items;
    if (payload?.groups && typeof payload.groups === 'object') return Object.values(payload.groups).flat();
    return [];
};

const getPermissionLabel = (permission) => {
    if (permission.name && permission.name !== permission.code) return permission.name;
    const action = permission.code?.split('.').at(-1);
    return actionLabels[action] || permission.code;
};

const groupPermissions = (permissions) => {
    const groups = permissions.reduce((result, permission) => {
        const moduleKey = permission.module || permission.code?.split('.')[0] || 'system';
        if (!result[moduleKey]) result[moduleKey] = [];
        result[moduleKey].push(permission);
        return result;
    }, {});

    return Object.entries(groups).map(([moduleKey, items]) => ({
        moduleKey,
        title: moduleLabels[moduleKey] || moduleKey,
        permissions: [...items].sort((a, b) => a.code.localeCompare(b.code))
    }));
};

const rolePermissionCodes = (role) =>
    role?.permissionCodes || role?.permissions?.map((permission) => permission.code) || [];

export default function RolesPage() {
    const [selectedRoleId, setSelectedRoleId] = useState('');
    const [selectedPermissions, setSelectedPermissions] = useState([]);
    const [keyword, setKeyword] = useState('');
    const [moduleFilter, setModuleFilter] = useState('ALL');
    const [reason, setReason] = useState('');
    const [roleDialogOpen, setRoleDialogOpen] = useState(false);
    const [editingRole, setEditingRole] = useState(null);
    const [roleForm, setRoleForm] = useState(roleFormDefault);
    const [copySourceId, setCopySourceId] = useState('');
    const queryClient = useQueryClient();

    const rolesQuery = useQuery({ queryKey: ['roles'], queryFn: lmsService.listRoles });
    const permissionsQuery = useQuery({ queryKey: ['role-permissions'], queryFn: lmsService.listPermissions });
    const roles = normalizeList(rolesQuery.data).items;
    const permissions = normalizePermissionPayload(permissionsQuery.data);
    const selectedRole = roles.find((role) => role.publicId === selectedRoleId) || roles[0] || null;
    const savedPermissions = rolePermissionCodes(selectedRole);
    const selectedCodes = selectedRoleId === selectedRole?.publicId ? selectedPermissions : savedPermissions;
    const hasChanges = JSON.stringify([...selectedCodes].sort()) !== JSON.stringify([...savedPermissions].sort());

    const permissionGroups = useMemo(() => groupPermissions(permissions), [permissions]);
    const moduleOptions = useMemo(
        () => [{ moduleKey: 'ALL', title: 'Tất cả phân hệ' }, ...permissionGroups],
        [permissionGroups]
    );
    const visibleGroups = useMemo(() => {
        const normalizedKeyword = keyword.trim().toLowerCase();
        return permissionGroups
            .filter((group) => moduleFilter === 'ALL' || group.moduleKey === moduleFilter)
            .map((group) => ({
                ...group,
                permissions: group.permissions.filter((permission) => {
                    if (!normalizedKeyword) return true;
                    return `${permission.code} ${permission.name || ''} ${permission.description || ''}`
                        .toLowerCase()
                        .includes(normalizedKeyword);
                })
            }))
            .filter((group) => group.permissions.length > 0);
    }, [keyword, moduleFilter, permissionGroups]);

    const selectedCount = selectedCodes.length;
    const permissionCount = permissions.length;
    const canEditSelectedRole = selectedRole && selectedRole.code !== 'ADMIN';

    const resetSelectionFromRole = (role) => {
        setSelectedRoleId(role?.publicId || '');
        setSelectedPermissions(rolePermissionCodes(role));
        setReason('');
    };

    const saveRole = useMutation({
        mutationFn: (payload) =>
            editingRole
                ? lmsService.updateRole(editingRole.publicId, payload)
                : lmsService.createRole({ ...payload, isSystem: false }),
        onSuccess: async (role) => {
            toast.success(editingRole ? 'Đã cập nhật vai trò' : 'Đã tạo vai trò');
            setRoleDialogOpen(false);
            setEditingRole(null);
            setRoleForm(roleFormDefault);
            await queryClient.invalidateQueries({ queryKey: ['roles'] });
            setSelectedRoleId(role.publicId);
            setSelectedPermissions(rolePermissionCodes(role));
        }
    });

    const savePermissions = useMutation({
        mutationFn: () =>
            lmsService.updateRolePermissions(selectedRole.publicId, {
                permissionCodes: selectedCodes,
                reason: reason.trim() || undefined
            }),
        onSuccess: async (role) => {
            toast.success('Đã lưu phân quyền');
            setReason('');
            await queryClient.invalidateQueries({ queryKey: ['roles'] });
            setSelectedRoleId(role.publicId);
            setSelectedPermissions(rolePermissionCodes(role));
        }
    });

    const removeRole = useMutation({
        mutationFn: lmsService.deleteRole,
        onSuccess: async () => {
            toast.success('Đã xóa vai trò');
            setSelectedRoleId('');
            setSelectedPermissions([]);
            await queryClient.invalidateQueries({ queryKey: ['roles'] });
        }
    });

    const openCreateRole = () => {
        setEditingRole(null);
        setRoleForm(roleFormDefault);
        setRoleDialogOpen(true);
    };

    const openEditRole = () => {
        if (!canEditSelectedRole) {
            toast.error('Không thể sửa vai trò ADMIN');
            return;
        }
        setEditingRole(selectedRole);
        setRoleForm({
            code: selectedRole.code || '',
            name: selectedRole.name || '',
            description: selectedRole.description || ''
        });
        setRoleDialogOpen(true);
    };

    const handleRoleSubmit = (event) => {
        event.preventDefault();
        saveRole.mutate({
            code: roleForm.code.trim().toUpperCase(),
            name: roleForm.name.trim(),
            description: roleForm.description.trim() || undefined
        });
    };

    const applyDependencies = (codes) => {
        const next = new Set(codes);
        permissions.forEach((permission) => {
            const [moduleKey, action] = permission.code.split('.');
            if (action !== 'read' && next.has(permission.code)) {
                const readPermission = permissions.find((item) => item.code === `${moduleKey}.read`);
                if (readPermission) next.add(readPermission.code);
            }
        });
        return [...next].filter((code) => permissions.some((permission) => permission.code === code));
    };

    const togglePermission = (permissionCode) => {
        if (!canEditSelectedRole) {
            toast.error('Không thể sửa quyền của ADMIN');
            return;
        }

        if (selectedRoleId !== selectedRole.publicId) {
            setSelectedRoleId(selectedRole.publicId);
        }
        setSelectedPermissions((current) => {
            const base = selectedRoleId === selectedRole.publicId ? current : savedPermissions;
            const exists = base.includes(permissionCode);
            const next = exists ? base.filter((code) => code !== permissionCode) : [...base, permissionCode];
            return applyDependencies(next);
        });
    };

    const toggleModule = (group) => {
        if (!canEditSelectedRole) {
            toast.error('Không thể sửa quyền của ADMIN');
            return;
        }

        if (selectedRoleId !== selectedRole.publicId) {
            setSelectedRoleId(selectedRole.publicId);
        }
        const groupCodes = group.permissions.map((permission) => permission.code);
        const allChecked = groupCodes.every((code) => selectedCodes.includes(code));
        setSelectedPermissions((current) => {
            const base = selectedRoleId === selectedRole.publicId ? current : savedPermissions;
            const next = allChecked
                ? base.filter((code) => !groupCodes.includes(code))
                : [...new Set([...base, ...groupCodes])];
            return applyDependencies(next);
        });
    };

    const copyPermissions = () => {
        const sourceRole = roles.find((role) => role.publicId === copySourceId);
        if (!sourceRole) return;
        if (selectedRoleId !== selectedRole.publicId) {
            setSelectedRoleId(selectedRole.publicId);
        }
        setSelectedPermissions(rolePermissionCodes(sourceRole));
        toast.success(`Đã sao chép quyền từ ${sourceRole.name}`);
    };

    return (
        <div className="flex h-[calc(100vh-7rem)] min-h-0 flex-col gap-5 overflow-hidden">
            <div className="shrink-0 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                    <h1 className="text-2xl font-semibold tracking-normal">Vai trò và phân quyền</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        RBAC động: quyền được lấy từ backend và gán trực tiếp cho từng vai trò.
                    </p>
                </div>
                <Button type="button" onClick={openCreateRole}>
                    Thêm vai trò
                </Button>
            </div>

            <div className="grid shrink-0 gap-3 sm:grid-cols-3">
                <div className="rounded-lg border bg-card p-4 shadow-sm">
                    <p className="text-sm text-muted-foreground">Vai trò</p>
                    <p className="mt-1 text-2xl font-semibold">{roles.length}</p>
                </div>
                <div className="rounded-lg border bg-card p-4 shadow-sm">
                    <p className="text-sm text-muted-foreground">Quyền trong hệ thống</p>
                    <p className="mt-1 text-2xl font-semibold">{permissionCount}</p>
                </div>
                <div className="rounded-lg border bg-card p-4 shadow-sm">
                    <p className="text-sm text-muted-foreground">Quyền đang chọn</p>
                    <p className="mt-1 text-2xl font-semibold">{selectedCount}</p>
                </div>
            </div>

            <Tabs defaultValue="editor" className="flex min-h-0 flex-1 flex-col">
                <TabsList className="shrink-0 self-start">
                    <TabsTrigger value="editor">Cấu hình quyền</TabsTrigger>
                    <TabsTrigger value="matrix">Ma trận quyền</TabsTrigger>
                </TabsList>

                <TabsContent value="editor" className="mt-3 min-h-0 flex-1 overflow-hidden data-[state=inactive]:hidden">
                    <div className="grid h-full min-h-0 overflow-hidden rounded-lg border bg-card shadow-sm lg:grid-cols-[300px_1fr]">
                        <aside className="flex min-h-0 flex-col border-b bg-muted/30 p-3 lg:border-r lg:border-b-0">
                            <div className="mb-3 flex items-center justify-between px-1">
                                <span className="text-xs font-medium uppercase text-muted-foreground">
                                    Danh sách vai trò
                                </span>
                                {rolesQuery.isPending ? (
                                    <span className="text-xs text-muted-foreground">Đang tải...</span>
                                ) : null}
                            </div>
                            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                                {roles.map((role) => {
                                    const active = selectedRole?.publicId === role.publicId;
                                    return (
                                        <button
                                            key={role.publicId}
                                            type="button"
                                            onClick={() => resetSelectionFromRole(role)}
                                            className={`w-full rounded-md border p-3 text-left transition ${
                                                active
                                                    ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                                                    : 'bg-card hover:bg-muted/50'
                                            }`}
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="min-w-0">
                                                    <p className="truncate font-medium">{role.name}</p>
                                                    <p className="truncate text-xs text-muted-foreground">
                                                        {role.code}
                                                    </p>
                                                </div>
                                                <Badge variant={role.isSystem ? 'secondary' : 'outline'}>
                                                    {role.isSystem ? 'Hệ thống' : 'Tùy chỉnh'}
                                                </Badge>
                                            </div>
                                            <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                                                {role.description || 'Chưa có mô tả'}
                                            </p>
                                            <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                                                <span>{rolePermissionCodes(role).length} quyền</span>
                                                <span>{role._count?.users ?? 0} người dùng</span>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </aside>

                        <main className="flex min-h-0 min-w-0 flex-col">
                            {selectedRole ? (
                                <>
                                    <div className="shrink-0 flex flex-col gap-3 border-b p-4 xl:flex-row xl:items-start xl:justify-between">
                                        <div>
                                            <div className="flex flex-wrap items-center gap-2">
                                                <ShieldCheck className="size-5 text-primary" />
                                                <h2 className="text-lg font-semibold">{selectedRole.name}</h2>
                                                <Badge variant="outline">{selectedRole.code}</Badge>
                                            </div>
                                            <p className="mt-1 text-sm text-muted-foreground">
                                                {selectedRole.description || 'Vai trò chưa có mô tả.'}
                                            </p>
                                            <p className="mt-1 text-xs text-muted-foreground">
                                                Cập nhật lần cuối: {formatDateTime(selectedRole.updatedAt)}
                                            </p>
                                        </div>

                                        <div className="flex flex-wrap gap-2">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                onClick={openEditRole}
                                                disabled={!canEditSelectedRole}
                                            >
                                                <Pencil className="size-4" />
                                                Sửa
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="destructive"
                                                disabled={selectedRole.isSystem || removeRole.isPending}
                                                onClick={() => removeRole.mutate(selectedRole.publicId)}
                                            >
                                                <Trash2 className="size-4" />
                                                Xóa
                                            </Button>
                                        </div>
                                    </div>

                                    <div className="grid shrink-0 gap-3 border-b p-4 xl:grid-cols-[1fr_220px_280px]">
                                        <div className="relative">
                                            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                                            <Input
                                                value={keyword}
                                                onChange={(event) => setKeyword(event.target.value)}
                                                className="pl-9"
                                                placeholder="Tìm quyền theo mã hoặc tên..."
                                            />
                                        </div>
                                        <Select value={moduleFilter} onValueChange={setModuleFilter}>
                                            <SelectTrigger className="w-full">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {moduleOptions.map((module) => (
                                                    <SelectItem key={module.moduleKey} value={module.moduleKey}>
                                                        {module.title}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <div className="flex gap-2">
                                            <Select value={copySourceId} onValueChange={setCopySourceId}>
                                                <SelectTrigger className="w-full">
                                                    <SelectValue placeholder="Sao chép từ..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {roles
                                                        .filter((role) => role.publicId !== selectedRole.publicId)
                                                        .map((role) => (
                                                            <SelectItem key={role.publicId} value={role.publicId}>
                                                                {role.name}
                                                            </SelectItem>
                                                        ))}
                                                </SelectContent>
                                            </Select>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                onClick={copyPermissions}
                                                disabled={!copySourceId || !canEditSelectedRole}
                                            >
                                                <Copy className="size-4" />
                                            </Button>
                                        </div>
                                    </div>

                                    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
                                        {permissionsQuery.isPending ? (
                                            <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
                                                Đang tải danh mục quyền...
                                            </div>
                                        ) : visibleGroups.length === 0 ? (
                                            <div className="flex h-40 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
                                                Không tìm thấy quyền phù hợp
                                            </div>
                                        ) : (
                                            visibleGroups.map((group) => {
                                                const groupCodes = group.permissions.map(
                                                    (permission) => permission.code
                                                );
                                                const checkedCount = groupCodes.filter((code) =>
                                                    selectedCodes.includes(code)
                                                ).length;
                                                const allChecked = checkedCount === groupCodes.length;
                                                return (
                                                    <section key={group.moduleKey} className="rounded-lg border">
                                                        <header className="flex flex-col gap-3 border-b p-3 sm:flex-row sm:items-center sm:justify-between">
                                                            <div
                                                                role="button"
                                                                tabIndex={0}
                                                                className="flex items-center gap-2 text-left"
                                                                onClick={() => toggleModule(group)}
                                                                onKeyDown={(event) => {
                                                                    if (event.key === 'Enter' || event.key === ' ') {
                                                                        event.preventDefault();
                                                                        toggleModule(group);
                                                                    }
                                                                }}
                                                            >
                                                                <Checkbox
                                                                    checked={allChecked}
                                                                    disabled={!canEditSelectedRole}
                                                                />
                                                                <span>
                                                                    <span className="block font-medium">
                                                                        {group.title}
                                                                    </span>
                                                                    <span className="block text-xs text-muted-foreground">
                                                                        {checkedCount}/{groupCodes.length} quyền
                                                                        được chọn
                                                                    </span>
                                                                </span>
                                                            </div>
                                                            <Badge variant="outline">{group.moduleKey}</Badge>
                                                        </header>
                                                        <div className="grid gap-2 p-3 md:grid-cols-2">
                                                            {group.permissions.map((permission) => {
                                                                const checked = selectedCodes.includes(permission.code);
                                                                return (
                                                                    <label
                                                                        key={permission.publicId || permission.code}
                                                                        className={`flex cursor-pointer gap-3 rounded-md border p-3 transition ${
                                                                            checked
                                                                                ? 'border-primary bg-primary/5'
                                                                                : 'hover:border-primary/50'
                                                                        } ${!canEditSelectedRole ? 'cursor-not-allowed opacity-70' : ''}`}
                                                                    >
                                                                        <Checkbox
                                                                            checked={checked}
                                                                            disabled={!canEditSelectedRole}
                                                                            onCheckedChange={() =>
                                                                                togglePermission(permission.code)
                                                                            }
                                                                        />
                                                                        <span className="min-w-0">
                                                                            <span className="block text-sm font-medium">
                                                                                {getPermissionLabel(permission)}
                                                                            </span>
                                                                            <span className="block break-words text-xs text-muted-foreground">
                                                                                {permission.code}
                                                                            </span>
                                                                            {permission.description ? (
                                                                                <span className="mt-1 block text-xs text-muted-foreground">
                                                                                    {permission.description}
                                                                                </span>
                                                                            ) : null}
                                                                        </span>
                                                                    </label>
                                                                );
                                                            })}
                                                        </div>
                                                    </section>
                                                );
                                            })
                                        )}
                                    </div>

                                    <div className="grid shrink-0 gap-3 border-t bg-muted/30 p-4 lg:grid-cols-[1fr_auto]">
                                        <Textarea
                                            value={reason}
                                            onChange={(event) => setReason(event.target.value)}
                                            placeholder="Lý do thay đổi quyền, ví dụ: cập nhật theo phân công học kỳ mới"
                                            disabled={!canEditSelectedRole}
                                        />
                                        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                onClick={() => resetSelectionFromRole(selectedRole)}
                                                disabled={!hasChanges}
                                            >
                                                Hoàn tác
                                            </Button>
                                            <Button
                                                type="button"
                                                onClick={() => savePermissions.mutate()}
                                                disabled={
                                                    !canEditSelectedRole || !hasChanges || savePermissions.isPending
                                                }
                                            >
                                                <Save className="size-4" />
                                                Lưu phân quyền
                                            </Button>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="flex h-full min-h-[50vh] items-center justify-center text-sm text-muted-foreground">
                                    Chưa có vai trò để cấu hình
                                </div>
                            )}
                        </main>
                    </div>
                </TabsContent>

                <TabsContent value="matrix" className="mt-3 min-h-0 flex-1 overflow-hidden data-[state=inactive]:hidden">
                    <div className="h-full min-h-0 overflow-hidden rounded-lg border bg-card shadow-sm">
                        <div className="h-full min-h-0 overflow-auto">
                            <table className="w-full min-w-[900px] text-sm">
                                <thead className="sticky top-0 bg-slate-50 text-slate-700">
                                    <tr className="border-b">
                                        <th className="w-72 p-3 text-left font-medium">Quyền</th>
                                        {roles.map((role) => (
                                            <th key={role.publicId} className="p-3 text-center font-medium">
                                                {role.name}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {permissionGroups.map((group) => (
                                        <Fragment key={group.moduleKey}>
                                            <tr key={`${group.moduleKey}-header`} className="bg-muted/40">
                                                <td colSpan={roles.length + 1} className="p-3 font-medium">
                                                    {group.title}
                                                </td>
                                            </tr>
                                            {group.permissions.map((permission) => (
                                                <tr key={permission.code} className="border-t">
                                                    <td className="p-3">
                                                        <div className="flex items-center gap-2">
                                                            <KeyRound className="size-4 text-muted-foreground" />
                                                            <span>
                                                                <span className="block font-medium">
                                                                    {getPermissionLabel(permission)}
                                                                </span>
                                                                <span className="block text-xs text-muted-foreground">
                                                                    {permission.code}
                                                                </span>
                                                            </span>
                                                        </div>
                                                    </td>
                                                    {roles.map((role) => (
                                                        <td
                                                            key={`${role.publicId}-${permission.code}`}
                                                            className="p-3 text-center"
                                                        >
                                                            {rolePermissionCodes(role).includes(permission.code) ? (
                                                                <span className="inline-flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                                                                    ✓
                                                                </span>
                                                            ) : (
                                                                <span className="text-muted-foreground">-</span>
                                                            )}
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </Fragment>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </TabsContent>
            </Tabs>

            <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingRole ? 'Sửa vai trò' : 'Thêm vai trò'}</DialogTitle>
                    </DialogHeader>
                    <form className="space-y-4" onSubmit={handleRoleSubmit}>
                        <div className="space-y-1.5">
                            <Label htmlFor="role-code">Mã vai trò</Label>
                            <Input
                                id="role-code"
                                value={roleForm.code}
                                onChange={(event) =>
                                    setRoleForm((current) => ({ ...current, code: event.target.value }))
                                }
                                placeholder="VD: TRAINING_ASSISTANT"
                                disabled={editingRole?.code === 'ADMIN'}
                                required
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="role-name">Tên vai trò</Label>
                            <Input
                                id="role-name"
                                value={roleForm.name}
                                onChange={(event) =>
                                    setRoleForm((current) => ({ ...current, name: event.target.value }))
                                }
                                placeholder="VD: Trợ lý đào tạo"
                                required
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="role-description">Mô tả</Label>
                            <Textarea
                                id="role-description"
                                value={roleForm.description}
                                onChange={(event) =>
                                    setRoleForm((current) => ({ ...current, description: event.target.value }))
                                }
                                placeholder="Mô tả phạm vi sử dụng vai trò"
                            />
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setRoleDialogOpen(false)}>
                                Hủy
                            </Button>
                            <Button type="submit" disabled={saveRole.isPending}>
                                Lưu
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}


