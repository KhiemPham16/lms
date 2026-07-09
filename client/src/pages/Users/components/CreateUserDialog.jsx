import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { ImageIcon, X } from 'lucide-react';

import { Button } from '~/components/ui/button';
import MediaPickerDialog from '~/components/common/MediaPickerDialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '~/components/ui/dialog';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';
import { Textarea } from '~/components/ui/textarea';

import useCreateUser from '~/hooks/useCreateUser';
import useDepartments from '~/hooks/useDepartments';
import useRoles from '~/hooks/useRoles';
import { resolveMediaUrl } from '~/utils/media-url';
import createUserSchema from '~/validators/create-user.validator';

const EMPTY_VALUE = '__empty__';

const cleanPayload = (values) =>
    Object.entries(values).reduce((payload, [key, value]) => {
        if (value === undefined || value === null || value === '') return payload;
        if (key === 'roleId' || key === 'departmentId' || key === 'cohortYear') {
            payload[key] = Number(value);
            return payload;
        }
        payload[key] = typeof value === 'string' ? value.trim() : value;
        return payload;
    }, {});

export default function CreateUserDialog({ open, onOpenChange }) {
    const { data: roles = [], isPending: rolesLoading } = useRoles();
    const { data: departments = [], isPending: departmentsLoading } = useDepartments();
    const createUser = useCreateUser();

    const {
        register,
        control,
        handleSubmit,
        reset,
        setValue,
        formState: { errors }
    } = useForm({
        resolver: zodResolver(createUserSchema),
        defaultValues: {
            code: '',
            fullName: '',
            email: '',
            phone: '',
            password: '',
            roleId: '',
            status: 'PENDING',
            gender: undefined,
            avatarUrl: '',
            dateOfBirth: '',
            address: '',
            departmentId: '',
            cohortYear: new Date().getFullYear()
        }
    });
    const [mediaOpen, setMediaOpen] = useState(false);
    const avatarUrl = useWatch({ control, name: 'avatarUrl' });

    const handleOpenChange = (nextOpen) => {
        if (!nextOpen) reset();
        onOpenChange(nextOpen);
    };

    const onSubmit = (values) => {
        createUser.mutate(cleanPayload(values), {
            onSuccess: () => {
                reset();
                onOpenChange(false);
            }
        });
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
                <DialogHeader>
                    <DialogTitle>Thêm người dùng</DialogTitle>
                    <DialogDescription>
                        Tạo tài khoản mới. Mã người dùng và mật khẩu có thể để trống để hệ thống tự sinh theo backend.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="fullName">Họ tên</Label>
                            <Input id="fullName" {...register('fullName')} placeholder="Nguyễn Văn A" />
                            {errors.fullName && <p className="text-sm text-destructive">{errors.fullName.message}</p>}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input id="email" type="email" {...register('email')} placeholder="example@lms.com" />
                            {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
                        </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="phone">Số điện thoại</Label>
                            <Input id="phone" {...register('phone')} placeholder="0901234567" />
                            {errors.phone && <p className="text-sm text-destructive">{errors.phone.message}</p>}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password">Mật khẩu</Label>
                            <Input id="password" type="password" {...register('password')} placeholder="Lms@123" />
                            {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
                        </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-3">
                        <div className="space-y-2">
                            <Label htmlFor="code">Mã người dùng</Label>
                            <Input id="code" {...register('code')} placeholder="Tự sinh nếu bỏ trống" />
                            {errors.code && <p className="text-sm text-destructive">{errors.code.message}</p>}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="cohortYear">Năm khóa</Label>
                            <Input id="cohortYear" type="number" min="2000" max="2099" {...register('cohortYear')} />
                            {errors.cohortYear && <p className="text-sm text-destructive">{errors.cohortYear.message}</p>}
                        </div>
                        <div className="space-y-2">
                            <Label>Trạng thái</Label>
                            <Controller
                                control={control}
                                name="status"
                                render={({ field }) => (
                                    <Select value={field.value} onValueChange={field.onChange}>
                                        <SelectTrigger className="w-full">
                                            <SelectValue placeholder="Chọn trạng thái" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="ACTIVE">Đang hoạt động</SelectItem>
                                            <SelectItem value="PENDING">Chờ kích hoạt</SelectItem>
                                            <SelectItem value="INACTIVE">Ngừng hoạt động</SelectItem>
                                            <SelectItem value="LOCKED">Đã khóa</SelectItem>
                                        </SelectContent>
                                    </Select>
                                )}
                            />
                            {errors.status && <p className="text-sm text-destructive">{errors.status.message}</p>}
                        </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-3">
                        <div className="space-y-2">
                            <Label>Vai trò</Label>
                            <Controller
                                control={control}
                                name="roleId"
                                render={({ field }) => (
                                    <Select value={field.value} onValueChange={field.onChange} disabled={rolesLoading || createUser.isPending}>
                                        <SelectTrigger className="w-full">
                                            <SelectValue placeholder={rolesLoading ? 'Đang tải...' : 'Chọn vai trò'} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {roles.map((role) => (
                                                <SelectItem key={role.publicId} value={String(role.id)}>
                                                    {role.name} ({role.code})
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                )}
                            />
                            {errors.roleId && <p className="text-sm text-destructive">{errors.roleId.message}</p>}
                        </div>
                        <div className="space-y-2">
                            <Label>Phòng ban</Label>
                            <Controller
                                control={control}
                                name="departmentId"
                                render={({ field }) => (
                                    <Select
                                        value={field.value || EMPTY_VALUE}
                                        onValueChange={(value) => field.onChange(value === EMPTY_VALUE ? '' : value)}
                                        disabled={departmentsLoading || createUser.isPending}
                                    >
                                        <SelectTrigger className="w-full">
                                            <SelectValue placeholder={departmentsLoading ? 'Đang tải...' : 'Chọn phòng ban'} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value={EMPTY_VALUE}>Không chọn</SelectItem>
                                            {departments.map((department) => (
                                                <SelectItem key={department.publicId} value={String(department.id)}>
                                                    {department.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                )}
                            />
                            {errors.departmentId && <p className="text-sm text-destructive">{errors.departmentId.message}</p>}
                        </div>
                        <div className="space-y-2">
                            <Label>Giới tính</Label>
                            <Controller
                                control={control}
                                name="gender"
                                render={({ field }) => (
                                    <Select value={field.value || EMPTY_VALUE} onValueChange={(value) => field.onChange(value === EMPTY_VALUE ? undefined : value)}>
                                        <SelectTrigger className="w-full">
                                            <SelectValue placeholder="Chọn giới tính" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value={EMPTY_VALUE}>Không chọn</SelectItem>
                                            <SelectItem value="MALE">Nam</SelectItem>
                                            <SelectItem value="FEMALE">Nữ</SelectItem>
                                            <SelectItem value="OTHER">Khác</SelectItem>
                                        </SelectContent>
                                    </Select>
                                )}
                            />
                            {errors.gender && <p className="text-sm text-destructive">{errors.gender.message}</p>}
                        </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="dateOfBirth">Ngày sinh</Label>
                            <Input id="dateOfBirth" type="date" {...register('dateOfBirth')} />
                            {errors.dateOfBirth && <p className="text-sm text-destructive">{errors.dateOfBirth.message}</p>}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="avatarUrl">Ảnh đại diện</Label>
                            <input id="avatarUrl" type="hidden" {...register('avatarUrl')} />
                            <div className="flex items-center gap-3">
                                <div className="flex size-16 items-center justify-center overflow-hidden rounded-lg border bg-muted">
                                    {avatarUrl ? (
                                        <img src={resolveMediaUrl(avatarUrl)} alt="Ảnh đại diện" className="h-full w-full object-cover" />
                                    ) : (
                                        <ImageIcon className="size-6 text-muted-foreground" />
                                    )}
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    <Button type="button" variant="outline" onClick={() => setMediaOpen(true)}>
                                        Chọn ảnh
                                    </Button>
                                    {avatarUrl ? (
                                        <Button type="button" variant="ghost" size="icon" onClick={() => setValue('avatarUrl', '')}>
                                            <X className="size-4" />
                                        </Button>
                                    ) : null}
                                </div>
                            </div>
                            {errors.avatarUrl && <p className="text-sm text-destructive">{errors.avatarUrl.message}</p>}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="address">Địa chỉ</Label>
                        <Textarea id="address" {...register('address')} placeholder="TP. Hồ Chí Minh" />
                        {errors.address && <p className="text-sm text-destructive">{errors.address.message}</p>}
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                            Hủy
                        </Button>
                        <Button type="submit" disabled={createUser.isPending || rolesLoading}>
                            {createUser.isPending ? 'Đang tạo...' : 'Tạo người dùng'}
                        </Button>
                    </DialogFooter>
                </form>

                <MediaPickerDialog
                    open={mediaOpen}
                    onOpenChange={setMediaOpen}
                    value={avatarUrl}
                    title="Chọn ảnh đại diện"
                    onSelect={(url) => {
                        setValue('avatarUrl', url, { shouldDirty: true, shouldValidate: true });
                    }}
                />
            </DialogContent>
        </Dialog>
    );
}
