import { useQuery } from '@tanstack/react-query';
import { BookOpen, GraduationCap, Image, Users } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { userHasAnyPermission } from '~/config/navigation';
import { normalizeList } from '~/pages/Lms/utils';
import lmsService from '~/services/lms.service';
import usersService from '~/services/users.service';
import useAuthStore from '~/stores/auth.store';

const cards = [
    { title: 'Người dùng', key: 'users', icon: Users, permissions: ['users.read'] },
    { title: 'Môn học', key: 'courses', icon: BookOpen, permissions: ['courses.read'] },
    { title: 'Lớp học', key: 'classes', icon: GraduationCap, permissions: ['classes.read'] },
    { title: 'Media', key: 'media', icon: Image, permissions: ['media.read'] }
];

export default function DashboardPage() {
    const user = useAuthStore((state) => state.user);
    const visibleCards = cards.filter((card) => userHasAnyPermission(user, card.permissions));
    const canReadUsers = userHasAnyPermission(user, ['users.read']);
    const canReadCourses = userHasAnyPermission(user, ['courses.read']);
    const canReadClasses = userHasAnyPermission(user, ['classes.read']);
    const canReadMedia = userHasAnyPermission(user, ['media.read']);

    const users = useQuery({
        queryKey: ['dashboard-users'],
        queryFn: () => usersService.getAll({ page: 1, limit: 1 }),
        enabled: canReadUsers
    });
    const courses = useQuery({
        queryKey: ['dashboard-courses'],
        queryFn: () => lmsService.listCourses({ page: 1, limit: 1 }),
        enabled: canReadCourses
    });
    const classes = useQuery({
        queryKey: ['dashboard-classes'],
        queryFn: () => lmsService.listClasses({ page: 1, limit: 1 }),
        enabled: canReadClasses
    });
    const media = useQuery({
        queryKey: ['dashboard-media'],
        queryFn: () => lmsService.listMedia({ page: 1, limit: 1 }),
        enabled: canReadMedia
    });

    const totals = {
        users: normalizeList(users.data).meta.total,
        courses: normalizeList(courses.data).meta.total,
        classes: normalizeList(classes.data).meta.total,
        media: normalizeList(media.data).meta.total
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-semibold">Tổng quan LMS</h1>
                <p className="text-sm text-muted-foreground">Tổng quan vận hành hệ thống học tập.</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {visibleCards.map((card) => {
                    const Icon = card.icon;
                    return (
                        <Card key={card.key} className="rounded-lg">
                            <CardHeader className="flex flex-row items-center justify-between">
                                <CardTitle>{card.title}</CardTitle>
                                <Icon className="size-5 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-semibold">{totals[card.key] ?? '-'}</div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            <Card className="rounded-lg">
                <CardHeader>
                    <CardTitle>Luồng LMS chính</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 text-sm md:grid-cols-3">
                    <div className="rounded-lg border p-4">1. Tạo môn học và phê duyệt đề xuất</div>
                    <div className="rounded-lg border p-4">2. Mở lớp, gán giảng viên, quản lý sĩ số</div>
                    <div className="rounded-lg border p-4">3. Xây dựng bài học, bài kiểm tra và theo dõi tiến độ</div>
                </CardContent>
            </Card>
        </div>
    );
}
