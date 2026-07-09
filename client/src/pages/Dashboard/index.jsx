import { useQueries, useQuery } from '@tanstack/react-query';
import {
    Activity,
    BookOpen,
    Building2,
    Clock,
    GraduationCap,
    Lock,
    UserCheck,
    UserMinus,
    Users,
    ClipboardCheck,
    ClipboardList
} from 'lucide-react';
import { Link } from 'react-router-dom';

import { Button } from '~/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { userHasAnyPermission } from '~/config/navigation';
import { normalizeList } from '~/pages/Lms/utils';
import lmsService from '~/services/lms.service';
import usersService from '~/services/users.service';
import useAuthStore from '~/stores/auth.store';

const chartColors = ['bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-cyan-500', 'bg-violet-500'];
const statusLabels = {
    active: 'Đang hoạt động',
    pending: 'Chờ kích hoạt',
    locked: 'Đã khóa'
};
const statusColors = {
    active: '#2563eb',
    pending: '#f59e0b',
    locked: '#ef4444'
};

function getTotal(data) {
    return data?.total ?? 0;
}

function StatCard({ title, value, icon: Icon, description }) {
    return (
        <Card className="rounded-lg">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
                <Icon className="size-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-3xl font-semibold">{value ?? 0}</div>
                {description ? <p className="mt-1 text-xs text-muted-foreground">{description}</p> : null}
            </CardContent>
        </Card>
    );
}

function VerticalChart({ items, emptyText }) {
    const maxValue = Math.max(...items.map((item) => item.value), 0);

    if (!items.length) {
        return <div className="rounded-lg border p-4 text-sm text-muted-foreground">{emptyText}</div>;
    }

    return (
        <div className="flex h-72 items-end gap-3 overflow-x-auto rounded-lg border p-4">
            {items.map((item, index) => {
                const height = maxValue > 0 ? Math.max((item.value / maxValue) * 100, item.value > 0 ? 10 : 2) : 2;

                return (
                    <div key={item.code || item.name} className="flex min-w-20 flex-1 flex-col items-center gap-2">
                        <div className="text-sm font-semibold">{item.value}</div>
                        <div className="flex h-44 w-full items-end justify-center">
                            <div
                                className={`w-12 rounded-t-md ${chartColors[index % chartColors.length]}`}
                                style={{ height: `${height}%` }}
                                title={`${item.name}: ${item.value}`}
                            />
                        </div>
                        <div className="max-w-24 text-center text-xs text-muted-foreground">{item.name}</div>
                    </div>
                );
            })}
        </div>
    );
}

function StatusDonut({ summary }) {
    const active = summary?.active ?? 0;
    const pending = summary?.pending ?? 0;
    const locked = summary?.locked ?? 0;
    const total = active + pending + locked;
    const activeAngle = total ? (active / total) * 360 : 0;
    const pendingAngle = total ? (pending / total) * 360 : 0;
    const background = total
        ? `conic-gradient(${statusColors.active} 0 ${activeAngle}deg, ${statusColors.pending} ${activeAngle}deg ${
              activeAngle + pendingAngle
          }deg, ${statusColors.locked} ${activeAngle + pendingAngle}deg 360deg)`
        : 'conic-gradient(#e5e7eb 0 360deg)';

    return (
        <div className="grid gap-6 md:grid-cols-[220px_1fr] md:items-center">
            <div className="relative mx-auto size-48 rounded-full" style={{ background }}>
                <div className="absolute inset-8 flex flex-col items-center justify-center rounded-full bg-card">
                    <span className="text-3xl font-semibold">{total}</span>
                    <span className="text-xs text-muted-foreground">tài khoản</span>
                </div>
            </div>
            <div className="space-y-3">
                {[
                    ['active', active],
                    ['pending', pending],
                    ['locked', locked]
                ].map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between rounded-lg border p-3">
                        <div className="flex items-center gap-2">
                            <span className="size-3 rounded-full" style={{ backgroundColor: statusColors[key] }} />
                            <span className="text-sm">{statusLabels[key]}</span>
                        </div>
                        <span className="font-semibold">{value}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

function EnrollmentDonut({ summary }) {
    const enrolled = summary?.enrolledStudents ?? 0;
    const notEnrolled = summary?.notEnrolledStudents ?? 0;
    const total = enrolled + notEnrolled;
    const enrolledAngle = total ? (enrolled / total) * 360 : 0;
    const background = total
        ? `conic-gradient(#2563eb 0 ${enrolledAngle}deg, #e5e7eb ${enrolledAngle}deg 360deg)`
        : 'conic-gradient(#e5e7eb 0 360deg)';

    return (
        <div className="grid gap-6 md:grid-cols-[220px_1fr] md:items-center">
            <div className="relative mx-auto size-48 rounded-full" style={{ background }}>
                <div className="absolute inset-8 flex flex-col items-center justify-center rounded-full bg-card">
                    <span className="text-3xl font-semibold">{total}</span>
                    <span className="text-xs text-muted-foreground">sinh viên</span>
                </div>
            </div>
            <div className="space-y-3">
                <div className="flex items-center justify-between rounded-lg border p-3">
                    <div className="flex items-center gap-2">
                        <span className="size-3 rounded-full bg-blue-600" />
                        <span className="text-sm">Đã enroll</span>
                    </div>
                    <span className="font-semibold">{enrolled}</span>
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                    <div className="flex items-center gap-2">
                        <span className="size-3 rounded-full bg-muted-foreground/30" />
                        <span className="text-sm">Chưa enroll</span>
                    </div>
                    <span className="font-semibold">{notEnrolled}</span>
                </div>
            </div>
        </div>
    );
}

function DepartmentBars({ items }) {
    const sorted = [...items].sort((a, b) => b.value - a.value).slice(0, 8);
    const maxValue = Math.max(...sorted.map((item) => item.value), 0);

    if (!sorted.length) {
        return <div className="rounded-lg border p-4 text-sm text-muted-foreground">Chưa có dữ liệu khoa/phòng.</div>;
    }

    return (
        <div className="space-y-3">
            {sorted.map((item) => {
                const width = maxValue > 0 ? Math.max((item.value / maxValue) * 100, item.value > 0 ? 8 : 0) : 0;

                return (
                    <div key={item.publicId} className="grid gap-2 md:grid-cols-[180px_1fr_48px] md:items-center">
                        <div className="truncate text-sm font-medium">{item.name}</div>
                        <div className="h-8 overflow-hidden rounded-md bg-muted">
                            <div className="h-full rounded-md bg-blue-500" style={{ width: `${width}%` }} />
                        </div>
                        <div className="text-sm font-semibold md:text-right">{item.value}</div>
                    </div>
                );
            })}
        </div>
    );
}

function UserDashboard({ user, embedded = false }) {
    const canReadUsers = userHasAnyPermission(user, ['users.read']);
    const canReadDepartments = userHasAnyPermission(user, ['departments.read']);

    const userSummary = useQuery({
        queryKey: ['dashboard-users-summary'],
        queryFn: () => usersService.summary(),
        enabled: canReadUsers
    });
    const roles = useQuery({
        queryKey: ['dashboard-roles'],
        queryFn: lmsService.listRoles,
        enabled: canReadUsers
    });
    const departments = useQuery({
        queryKey: ['dashboard-departments'],
        queryFn: lmsService.listDepartments,
        enabled: canReadUsers && canReadDepartments
    });

    const roleSummaries = useQueries({
        queries: (roles.data ?? []).map((role) => ({
            queryKey: ['dashboard-role-summary', role.code],
            queryFn: () => usersService.summary({ role: role.code }),
            enabled: canReadUsers
        }))
    });
    const departmentSummaries = useQueries({
        queries: (departments.data?.items ?? departments.data ?? []).map((department) => ({
            queryKey: ['dashboard-department-summary', department.id],
            queryFn: () => usersService.summary({ departmentId: department.id }),
            enabled: canReadUsers && canReadDepartments
        }))
    });

    const roleChart = (roles.data ?? []).map((role, index) => ({
        ...role,
        value: getTotal(roleSummaries[index]?.data)
    }));
    const visibleRoleChart = roleChart.some((item) => item.value > 0) ? roleChart.filter((item) => item.value > 0) : roleChart;
    const departmentList = departments.data?.items ?? departments.data ?? [];
    const departmentChart = departmentList.map((department, index) => ({
        ...department,
        value: getTotal(departmentSummaries[index]?.data)
    }));
    const summary = userSummary.data ?? {};

    return (
        <div className="space-y-6">
            {!embedded ? (
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                        <h1 className="text-2xl font-semibold">Dashboard người dùng</h1>
                        <p className="text-sm text-muted-foreground">Theo dõi người dùng, vai trò và khoa/phòng trong hệ thống.</p>
                    </div>
                    <Button asChild>
                        <Link to="/users">Quản lý người dùng</Link>
                    </Button>
                </div>
            ) : (
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                        <h2 className="text-xl font-semibold">Người dùng</h2>
                        <p className="text-sm text-muted-foreground">Vai trò, trạng thái tài khoản và khoa/phòng.</p>
                    </div>
                    <Button variant="outline" asChild>
                        <Link to="/users">Quản lý người dùng</Link>
                    </Button>
                </div>
            )}

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                <StatCard title="Tổng người dùng" value={summary.total} icon={Users} description="Tất cả tài khoản có thể quản lý" />
                <StatCard title="Đang hoạt động" value={summary.active} icon={UserCheck} description={summary.trends?.active} />
                <StatCard title="Chờ kích hoạt" value={summary.pending} icon={Clock} description={summary.trends?.pending} />
                <StatCard title="Đã khóa" value={summary.locked} icon={Lock} description={summary.trends?.locked} />
                <StatCard title="Mới trong tháng" value={summary.newThisMonth} icon={Activity} description={summary.trends?.newThisMonth} />
            </div>

            <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
                <Card className="rounded-lg">
                    <CardHeader>
                        <CardTitle>Người dùng theo vai trò</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <VerticalChart items={visibleRoleChart} emptyText="Chưa có dữ liệu vai trò." />
                    </CardContent>
                </Card>

                <Card className="rounded-lg">
                    <CardHeader>
                        <CardTitle>Trạng thái tài khoản</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <StatusDonut summary={summary} />
                    </CardContent>
                </Card>
            </div>

            <Card className="rounded-lg">
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Người dùng theo khoa/phòng</CardTitle>
                    <Building2 className="size-5 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <DepartmentBars items={departmentChart} />
                </CardContent>
            </Card>
        </div>
    );
}

function TrainingDashboard({ embedded = false }) {
    const courses = useQuery({
        queryKey: ['dashboard-training-courses'],
        queryFn: () => lmsService.listCourses({ page: 1, limit: 1 })
    });
    const classSummary = useQuery({
        queryKey: ['dashboard-training-classes-summary'],
        queryFn: () => lmsService.classSummary()
    });
    const enrollmentSummary = useQuery({
        queryKey: ['dashboard-training-enrollment-summary'],
        queryFn: lmsService.enrollmentSummary
    });
    const recentClasses = useQuery({
        queryKey: ['dashboard-training-recent-classes'],
        queryFn: () => lmsService.listClasses({ page: 1, limit: 5 })
    });

    const courseTotal = normalizeList(courses.data).meta.total;
    const classData = classSummary.data ?? {};
    const enrollmentData = enrollmentSummary.data ?? {};
    const latestClasses = normalizeList(recentClasses.data).items;
    const classStatusChart = [
        { code: 'DRAFT', name: 'Nháp', value: classData.draft ?? 0 },
        { code: 'OPEN_REGISTRATION', name: 'Mở ĐK', value: classData.openRegistration ?? 0 },
        { code: 'CLOSED_REGISTRATION', name: 'Đóng ĐK', value: classData.closedRegistration ?? 0 },
        { code: 'IN_PROGRESS', name: 'Đang học', value: classData.inProgress ?? 0 },
        { code: 'COMPLETED', name: 'Hoàn thành', value: classData.completed ?? 0 }
    ];

    return (
        <div className="space-y-6">
            {!embedded ? (
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                        <h1 className="text-2xl font-semibold">Dashboard đào tạo</h1>
                        <p className="text-sm text-muted-foreground">Theo dõi khóa học, lớp học và tình hình sinh viên enroll.</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Button variant="outline" asChild>
                            <Link to="/courses">Quản lý khóa học</Link>
                        </Button>
                    </div>
                </div>
            ) : (
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                        <h2 className="text-xl font-semibold">Đào tạo</h2>
                        <p className="text-sm text-muted-foreground">Khóa học, lớp học và tình hình sinh viên enroll.</p>
                    </div>
                    <Button variant="outline" asChild>
                        <Link to="/courses">Quản lý khóa học</Link>
                    </Button>
                </div>
            )}

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                <StatCard title="Khóa học" value={courseTotal} icon={BookOpen} description="Tổng môn/khóa trong hệ thống" />
                <StatCard title="Lớp học" value={classData.total} icon={GraduationCap} description={classData.trends?.total} />
                <StatCard title="Lượt enroll" value={enrollmentData.totalEnrollments} icon={Users} description="Tổng lượt đăng ký lớp" />
                <StatCard title="SV đã enroll" value={enrollmentData.enrolledStudents} icon={UserCheck} description="Sinh viên duy nhất" />
                <StatCard title="SV chưa enroll" value={enrollmentData.notEnrolledStudents} icon={UserMinus} description="Chưa tham gia lớp nào" />
            </div>

            <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
                <Card className="rounded-lg">
                    <CardHeader>
                        <CardTitle>Trạng thái lớp học</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <VerticalChart items={classStatusChart} emptyText="Chưa có dữ liệu lớp học." />
                    </CardContent>
                </Card>

                <Card className="rounded-lg">
                    <CardHeader>
                        <CardTitle>Sinh viên enroll</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <EnrollmentDonut summary={enrollmentData} />
                    </CardContent>
                </Card>
            </div>

            <Card className="rounded-lg">
                <CardHeader>
                    <CardTitle>Lớp học mới cập nhật</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    {latestClasses.length ? (
                        latestClasses.map((item) => (
                            <div key={item.publicId} className="grid gap-2 rounded-lg border p-3 md:grid-cols-[1fr_120px_120px] md:items-center">
                                <div>
                                    <p className="font-medium">{item.name}</p>
                                    <p className="text-sm text-muted-foreground">
                                        {item.code} - {item.course?.name || 'Chưa gắn khóa học'}
                                    </p>
                                </div>
                                <div className="text-sm text-muted-foreground">{item.status}</div>
                                <div className="text-sm font-semibold md:text-right">
                                    {item.enrolledCount || 0}/{item.maxStudents || 0} SV
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="rounded-lg border p-4 text-sm text-muted-foreground">Chưa có lớp học.</div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

function StudentDashboard() {
    const progress = useQuery({
        queryKey: ['dashboard-student-progress'],
        queryFn: lmsService.myCourseProgress
    });

    const items = progress.data?.items ?? [];
    const registeredClasses = items.length;
    const doneAssignments = items.reduce(
        (sum, item) => sum + (item.lessonProgress?.completed ?? 0) + (item.examProgress?.submitted ?? 0),
        0
    );
    const totalAssignments = items.reduce(
        (sum, item) => sum + (item.lessonProgress?.total ?? 0) + (item.examProgress?.total ?? 0),
        0
    );
    const notDoneAssignments = Math.max(totalAssignments - doneAssignments, 0);
    const averageProgress =
        items.length > 0 ? Math.round(items.reduce((sum, item) => sum + (item.overallRate ?? 0), 0) / items.length) : 0;
    const classProgressChart = items.map((item) => ({
        code: item.class?.publicId,
        name: item.class?.code || item.class?.name || 'Lớp học',
        value: item.overallRate ?? 0
    }));

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-2xl font-semibold">Dashboard học sinh</h1>
                    <p className="text-sm text-muted-foreground">Theo dõi lớp đã đăng ký và tiến độ bài tập của bạn.</p>
                </div>
                <Button asChild>
                    <Link to="/courses">Vào lớp học</Link>
                </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <StatCard title="Lớp đã đăng ký" value={registeredClasses} icon={GraduationCap} description="Lớp đang tham gia" />
                <StatCard title="Bài tập đã làm" value={doneAssignments} icon={ClipboardCheck} description="Lesson hoàn thành + exam đã nộp" />
                <StatCard title="Bài tập chưa làm" value={notDoneAssignments} icon={ClipboardList} description="Còn lại cần hoàn thành" />
                <StatCard title="Tiến độ trung bình" value={`${averageProgress}%`} icon={Activity} description="Tính theo các lớp đã đăng ký" />
            </div>

            <div className="grid gap-4 xl:grid-cols-[1.25fr_1fr]">
                <Card className="rounded-lg">
                    <CardHeader>
                        <CardTitle>Tiến độ theo lớp</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <VerticalChart items={classProgressChart} emptyText="Bạn chưa đăng ký lớp nào." />
                    </CardContent>
                </Card>

                <Card className="rounded-lg">
                    <CardHeader>
                        <CardTitle>Bài tập cần hoàn thành</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="rounded-lg border p-4">
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground">Đã làm</span>
                                <span className="font-semibold">{doneAssignments}</span>
                            </div>
                            <div className="mt-3 h-3 overflow-hidden rounded-full bg-muted">
                                <div
                                    className="h-full rounded-full bg-blue-500"
                                    style={{ width: `${totalAssignments > 0 ? (doneAssignments / totalAssignments) * 100 : 0}%` }}
                                />
                            </div>
                        </div>
                        <div className="rounded-lg border p-4">
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground">Chưa làm</span>
                                <span className="font-semibold">{notDoneAssignments}</span>
                            </div>
                            <div className="mt-3 h-3 overflow-hidden rounded-full bg-muted">
                                <div
                                    className="h-full rounded-full bg-amber-500"
                                    style={{ width: `${totalAssignments > 0 ? (notDoneAssignments / totalAssignments) * 100 : 0}%` }}
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card className="rounded-lg">
                <CardHeader>
                    <CardTitle>Danh sách lớp của tôi</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    {items.length ? (
                        items.map((item) => (
                            <div key={item.class?.publicId} className="grid gap-2 rounded-lg border p-3 md:grid-cols-[1fr_120px_120px] md:items-center">
                                <div>
                                    <p className="font-medium">{item.class?.name}</p>
                                    <p className="text-sm text-muted-foreground">
                                        {item.class?.code} - {item.class?.course?.name || 'Khóa học'}
                                    </p>
                                </div>
                                <div className="text-sm text-muted-foreground">
                                    Bài: {item.lessonProgress?.completed ?? 0}/{item.lessonProgress?.total ?? 0}
                                </div>
                                <div className="text-sm font-semibold md:text-right">
                                    Exam: {item.examProgress?.submitted ?? 0}/{item.examProgress?.total ?? 0}
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="rounded-lg border p-4 text-sm text-muted-foreground">Bạn chưa đăng ký lớp nào.</div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

function DepartmentHeadDashboard({ user }) {
    const departmentId = user?.departmentId;
    const departmentParams = departmentId ? { departmentId } : {};
    const courses = useQuery({
        queryKey: ['dashboard-department-head-courses', departmentId],
        queryFn: () => lmsService.listCourses({ page: 1, limit: 1, ...departmentParams }),
        enabled: Boolean(departmentId)
    });
    const classSummary = useQuery({
        queryKey: ['dashboard-department-head-classes-summary', departmentId],
        queryFn: () => lmsService.classSummary(departmentParams),
        enabled: Boolean(departmentId)
    });
    const lecturers = useQuery({
        queryKey: ['dashboard-department-head-lecturers', departmentId],
        queryFn: () => usersService.summary({ departmentId, role: 'LECTURER' }),
        enabled: Boolean(departmentId)
    });
    const students = useQuery({
        queryKey: ['dashboard-department-head-students', departmentId],
        queryFn: () => usersService.summary({ departmentId, role: 'STUDENT' }),
        enabled: Boolean(departmentId)
    });
    const recentClasses = useQuery({
        queryKey: ['dashboard-department-head-recent-classes', departmentId],
        queryFn: () => lmsService.listClasses({ page: 1, limit: 5, ...departmentParams }),
        enabled: Boolean(departmentId)
    });

    const courseTotal = normalizeList(courses.data).meta.total;
    const classData = classSummary.data ?? {};
    const latestClasses = normalizeList(recentClasses.data).items;
    const classStatusChart = [
        { code: 'DRAFT', name: 'Nháp', value: classData.draft ?? 0 },
        { code: 'OPEN_REGISTRATION', name: 'Mở ĐK', value: classData.openRegistration ?? 0 },
        { code: 'CLOSED_REGISTRATION', name: 'Đóng ĐK', value: classData.closedRegistration ?? 0 },
        { code: 'IN_PROGRESS', name: 'Đang học', value: classData.inProgress ?? 0 },
        { code: 'COMPLETED', name: 'Hoàn thành', value: classData.completed ?? 0 }
    ];
    const capacityItems = latestClasses.map((item) => ({
        code: item.publicId,
        name: item.code,
        value: item.maxStudents ? Math.round(((item.enrolledCount || 0) / item.maxStudents) * 100) : 0
    }));

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-2xl font-semibold">Dashboard trưởng bộ môn</h1>
                    <p className="text-sm text-muted-foreground">Theo dõi khóa học, lớp học, giảng viên và enroll trong khoa/bộ môn.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button variant="outline" asChild>
                        <Link to="/courses">Khóa học</Link>
                    </Button>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                <StatCard title="Khóa học trong khoa" value={courseTotal} icon={BookOpen} description="Theo khoa/phòng của TBM" />
                <StatCard title="Lớp học" value={classData.total} icon={GraduationCap} description={classData.trends?.total} />
                <StatCard title="SV enroll" value={classData.totalRegistered} icon={Users} description="Lượt enroll trong lớp của khoa" />
                <StatCard title="Giảng viên" value={lecturers.data?.total} icon={UserCheck} description="Giảng viên thuộc khoa" />
                <StatCard title="Sinh viên" value={students.data?.total} icon={Users} description="Sinh viên thuộc khoa" />
            </div>

            <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
                <Card className="rounded-lg">
                    <CardHeader>
                        <CardTitle>Trạng thái lớp học trong khoa</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <VerticalChart items={classStatusChart} emptyText="Chưa có dữ liệu lớp học." />
                    </CardContent>
                </Card>

                <Card className="rounded-lg">
                    <CardHeader>
                        <CardTitle>Tỉ lệ sĩ số lớp gần đây</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <VerticalChart items={capacityItems} emptyText="Chưa có lớp học gần đây." />
                    </CardContent>
                </Card>
            </div>

            <Card className="rounded-lg">
                <CardHeader>
                    <CardTitle>Lớp học của khoa/bộ môn</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    {latestClasses.length ? (
                        latestClasses.map((item) => (
                            <div key={item.publicId} className="grid gap-2 rounded-lg border p-3 md:grid-cols-[1fr_140px_120px] md:items-center">
                                <div>
                                    <p className="font-medium">{item.name}</p>
                                    <p className="text-sm text-muted-foreground">
                                        {item.code} - {item.course?.name || 'Khóa học'}
                                    </p>
                                </div>
                                <div className="text-sm text-muted-foreground">{item.lecturer?.fullName || 'Chưa phân công'}</div>
                                <div className="text-sm font-semibold md:text-right">
                                    {item.enrolledCount || 0}/{item.maxStudents || 0} SV
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="rounded-lg border p-4 text-sm text-muted-foreground">Chưa có lớp học trong khoa.</div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

function AdminDashboard({ user }) {
    return (
        <div className="space-y-10">
            <div>
                <h1 className="text-2xl font-semibold">Dashboard tổng quan</h1>
                <p className="text-sm text-muted-foreground">Admin xem toàn bộ số liệu người dùng, khóa học, lớp học và enroll.</p>
            </div>

            <TrainingDashboard embedded />
            <UserDashboard user={user} embedded />
        </div>
    );
}

export default function DashboardPage() {
    const user = useAuthStore((state) => state.user);

    if (['ADMIN', 'PRINCIPAL'].includes(user?.role?.code)) {
        return <AdminDashboard user={user} />;
    }

    if (user?.role?.code === 'STUDENT') {
        return <StudentDashboard />;
    }

    if (user?.role?.code === 'DEPARTMENT_HEAD') {
        return <DepartmentHeadDashboard user={user} />;
    }

    if (user?.role?.code === 'TRAINING_OFFICER') {
        return <TrainingDashboard />;
    }

    return <UserDashboard user={user} />;
}
