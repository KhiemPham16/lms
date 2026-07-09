import { Card, CardContent } from '~/components/ui/card';
import { Checkbox } from '~/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '~/components/ui/table';
import UserActionMenu from './UserActionMenu';

export default function UserTable({
    users,
    loading,
    onAction,
    selectedIds = [],
    onToggleUser,
    onTogglePage,
    canManageUser
}) {
    const selectableUsers = users.filter((user) => canManageUser?.(user) ?? true);
    const allSelected =
        selectableUsers.length > 0 && selectableUsers.every((user) => selectedIds.includes(user.publicId));
    const someSelected = selectableUsers.some((user) => selectedIds.includes(user.publicId));

    return (
        <Card className="rounded-lg py-0">
            <CardContent className="p-0">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-10">
                                <Checkbox
                                    checked={allSelected || (someSelected ? 'indeterminate' : false)}
                                    disabled={selectableUsers.length === 0}
                                    onCheckedChange={() => onTogglePage?.(selectableUsers.map((user) => user.publicId))}
                                    aria-label="Chọn tất cả tài khoản có thể thao tác"
                                />
                            </TableHead>
                            <TableHead>Mã</TableHead>
                            <TableHead>Họ Tên</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Vai trò</TableHead>
                            <TableHead>Phòng ban</TableHead>
                            <TableHead>Trạng thái</TableHead>
                            <TableHead className="w-20 text-right">Thao tac</TableHead>
                        </TableRow>
                    </TableHeader>

                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={8} className="h-24 text-center">
                                    Dang tai...
                                </TableCell>
                            </TableRow>
                        ) : users.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={8} className="h-24 text-center">
                                    Khong co du lieu
                                </TableCell>
                            </TableRow>
                        ) : (
                            users.map((user) => {
                                const canManage = canManageUser?.(user) ?? true;

                                return (
                                    <TableRow key={user.publicId} className={!canManage ? 'bg-muted/30' : undefined}>
                                        <TableCell>
                                            <Checkbox
                                                checked={selectedIds.includes(user.publicId)}
                                                disabled={!canManage}
                                                onCheckedChange={() => onToggleUser?.(user.publicId)}
                                                aria-label={`Ch?n ${user.fullName}`}
                                            />
                                        </TableCell>
                                        <TableCell>{user.code}</TableCell>
                                        <TableCell>
                                            <div className="font-medium">{user.fullName}</div>
                                            {!canManage ? (
                                                <div className="text-xs text-muted-foreground">
                                                    Tài khoản được bảo vệ
                                                </div>
                                            ) : null}
                                        </TableCell>
                                        <TableCell>{user.email}</TableCell>
                                        <TableCell>{user.role?.name}</TableCell>
                                        <TableCell>{user.department?.name}</TableCell>
                                        <TableCell>{user.status}</TableCell>
                                        <TableCell className="text-right">
                                            <UserActionMenu user={user} onAction={onAction} canManage={canManage} />
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
