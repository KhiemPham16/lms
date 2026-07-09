import { useMemo, useState } from 'react';
import { ImageIcon, X } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

import MediaPickerDialog from '~/components/common/MediaPickerDialog';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Textarea } from '~/components/ui/textarea';
import usersService from '~/services/users.service';
import useAuthStore from '~/stores/auth.store';
import { resolveMediaUrl } from '~/utils/media-url';

const toDateInput = (value) => (value ? String(value).slice(0, 10) : '');

function buildInitialValues(user) {
    return {
        code: user?.code || '',
        fullName: user?.fullName || '',
        email: user?.email || '',
        phone: user?.phone || '',
        gender: user?.gender || '',
        dateOfBirth: toDateInput(user?.dateOfBirth),
        avatarUrl: user?.avatarUrl || '',
        address: user?.address || '',
        departmentId: user?.departmentId || ''
    };
}

function cleanPayload(values, allowedFields) {
    return allowedFields.reduce((payload, field) => {
        const value = values[field];
        if (value === undefined || value === null || value === '') {
            payload[field] = field === 'avatarUrl' || field === 'address' ? '' : undefined;
            return payload;
        }
        payload[field] = field === 'departmentId' ? Number(value) : value;
        return payload;
    }, {});
}

export default function ProfilePage() {
    const user = useAuthStore((state) => state.user);
    const initialize = useAuthStore((state) => state.initialize);
    const roleCode = user?.role?.code;
    const canEditAll = ['ADMIN', 'PRINCIPAL'].includes(roleCode);
    const canEditHrProfile = roleCode === 'HR';
    const allowedFields = useMemo(() => {
        if (canEditAll) return ['fullName', 'email', 'phone', 'gender', 'dateOfBirth', 'avatarUrl', 'address', 'departmentId'];
        if (canEditHrProfile) return ['gender', 'dateOfBirth', 'avatarUrl', 'address'];
        return ['avatarUrl', 'address'];
    }, [canEditAll, canEditHrProfile]);
    const [values, setValues] = useState(() => buildInitialValues(user));
    const [mediaOpen, setMediaOpen] = useState(false);

    const save = useMutation({
        mutationFn: () => usersService.updateMyProfile(cleanPayload(values, allowedFields)),
        onSuccess: (updatedUser) => {
            initialize(updatedUser);
            setValues(buildInitialValues(updatedUser));
            toast.success('Đã cập nhật hồ sơ');
        },
        onError: (error) => {
            const message = error?.response?.data?.message;
            toast.error(Array.isArray(message) ? message.join(', ') : message || 'Không thể cập nhật hồ sơ');
        }
    });

    const setField = (field, value) => {
        setValues((current) => ({ ...current, [field]: value }));
    };
    const isEditable = (field) => allowedFields.includes(field);

    return (
        <div className="mx-auto max-w-4xl space-y-5">
            <div>
                <h1 className="text-2xl font-semibold">Hồ sơ cá nhân</h1>
                <p className="text-sm text-muted-foreground">Cập nhật thông tin cá nhân theo quyền của tài khoản.</p>
            </div>

            <Card className="rounded-lg">
                <CardHeader>
                    <CardTitle>Thông tin hồ sơ</CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                        <div className="flex size-24 items-center justify-center overflow-hidden rounded-lg border bg-muted">
                            {values.avatarUrl ? (
                                <img src={resolveMediaUrl(values.avatarUrl)} alt="Ảnh đại diện" className="h-full w-full object-cover" />
                            ) : (
                                <ImageIcon className="size-8 text-muted-foreground" />
                            )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <Button type="button" variant="outline" onClick={() => setMediaOpen(true)} disabled={!isEditable('avatarUrl')}>
                                Chọn ảnh
                            </Button>
                            {values.avatarUrl ? (
                                <Button type="button" variant="ghost" size="icon" onClick={() => setField('avatarUrl', '')} disabled={!isEditable('avatarUrl')}>
                                    <X className="size-4" />
                                </Button>
                            ) : null}
                        </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="code">Mã người dùng</Label>
                            <Input id="code" value={values.code} onChange={(event) => setField('code', event.target.value)} disabled={!isEditable('code')} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="fullName">Họ tên</Label>
                            <Input id="fullName" value={values.fullName} onChange={(event) => setField('fullName', event.target.value)} disabled={!isEditable('fullName')} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input id="email" type="email" value={values.email} onChange={(event) => setField('email', event.target.value)} disabled={!isEditable('email')} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="phone">Số điện thoại</Label>
                            <Input id="phone" value={values.phone} onChange={(event) => setField('phone', event.target.value)} disabled={!isEditable('phone')} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="gender">Giới tính</Label>
                            <select
                                id="gender"
                                value={values.gender}
                                onChange={(event) => setField('gender', event.target.value)}
                                disabled={!isEditable('gender')}
                                className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <option value="">Không chọn</option>
                                <option value="MALE">Nam</option>
                                <option value="FEMALE">Nữ</option>
                                <option value="OTHER">Khác</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="dateOfBirth">Ngày sinh</Label>
                            <Input id="dateOfBirth" type="date" value={values.dateOfBirth} onChange={(event) => setField('dateOfBirth', event.target.value)} disabled={!isEditable('dateOfBirth')} />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="address">Địa chỉ</Label>
                        <Textarea id="address" value={values.address} onChange={(event) => setField('address', event.target.value)} disabled={!isEditable('address')} />
                    </div>

                    <div className="flex justify-end">
                        <Button type="button" onClick={() => save.mutate()} disabled={save.isPending}>
                            {save.isPending ? 'Đang lưu...' : 'Lưu thay đổi'}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <MediaPickerDialog
                open={mediaOpen}
                onOpenChange={setMediaOpen}
                value={values.avatarUrl}
                title="Chọn ảnh đại diện"
                onSelect={(url) => setField('avatarUrl', url)}
            />
        </div>
    );
}
