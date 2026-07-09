import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ChevronRight, Sparkles, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import PageShell from '~/components/common/PageShell';
import SimpleFormDialog from '~/components/common/SimpleFormDialog';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Card, CardContent } from '~/components/ui/card';
import lmsService from '~/services/lms.service';
import useAuthStore from '~/stores/auth.store';
import useDebounce from '~/hooks/useDebounce';
import { normalizeList } from './utils';

const courseStatusLabel = {
    DRAFT: 'Bản nháp',
    PENDING_PDT: 'Chờ PĐT',
    PDT_APPROVED: 'PĐT đã duyệt',
    PDT_REJECTED: 'PĐT từ chối',
    PENDING_PRINCIPAL: 'Chờ Hiệu trưởng',
    PRINCIPAL_APPROVED: 'Hiệu trưởng đã duyệt',
    PRINCIPAL_REJECTED: 'Hiệu trưởng từ chối',
    ACTIVE: 'Đang mở',
    INACTIVE: 'Tạm ngưng'
};

const roleCanCreateOfficialCourse = (roleCode) => ['ADMIN', 'TRAINING_OFFICER'].includes(roleCode);
const roleCanProposeCourse = (roleCode) => ['ADMIN', 'DEPARTMENT_HEAD'].includes(roleCode);
const roleCanApprovePdt = (roleCode) => ['ADMIN', 'TRAINING_OFFICER'].includes(roleCode);
const roleCanApprovePrincipal = (roleCode) => ['ADMIN', 'PRINCIPAL'].includes(roleCode);

const courseBanners = [
    { gradient: 'from-fuchsia-500 via-pink-500 to-rose-400', accent: 'bg-pink-300/35', mark: '✦' },
    { gradient: 'from-sky-500 via-blue-500 to-indigo-500', accent: 'bg-cyan-200/30', mark: '</>' },
    { gradient: 'from-emerald-500 via-teal-500 to-cyan-500', accent: 'bg-lime-200/30', mark: '{}' },
    { gradient: 'from-amber-500 via-orange-500 to-red-500', accent: 'bg-yellow-200/30', mark: '01' },
    { gradient: 'from-violet-500 via-purple-500 to-indigo-500', accent: 'bg-violet-200/30', mark: '∑' },
    { gradient: 'from-slate-700 via-slate-600 to-gray-500', accent: 'bg-white/20', mark: 'AI' }
];

const courseBannerFor = (course) => {
    const key = `${course.code || ''}${course.name || ''}`;
    const index = Array.from(key).reduce((total, char) => total + char.charCodeAt(0), 0) % courseBanners.length;
    return courseBanners[index];
};

export default function CoursesPage() {
    const [search, setSearch] = useState('');
    const [open, setOpen] = useState(false);
    const keyword = useDebounce(search, 400);
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const user = useAuthStore((state) => state.user);
    const roleCode = user?.role?.code;
    const isStudent = roleCode === 'STUDENT';
    const canCreateOrProposeCourse = roleCanCreateOfficialCourse(roleCode) || roleCanProposeCourse(roleCode);

    const coursesQuery = useQuery({
        queryKey: ['courses', keyword],
        queryFn: () => lmsService.listCourses({ page: 1, limit: 60, keyword: keyword || undefined })
    });
    const departmentsQuery = useQuery({
        queryKey: ['departments'],
        queryFn: lmsService.listDepartments
    });
    const myEnrollmentsQuery = useQuery({
        queryKey: ['my-enrollments'],
        queryFn: lmsService.listMyEnrollments,
        enabled: isStudent
    });

    const courses = normalizeList(coursesQuery.data).items;
    const myEnrollments = Array.isArray(myEnrollmentsQuery.data) ? myEnrollmentsQuery.data : [];
    const departmentOptions = useMemo(() => {
        const items = Array.isArray(departmentsQuery.data) ? departmentsQuery.data : departmentsQuery.data?.items || [];
        return items.map((department) => ({
            value: String(department.id),
            label: department.code ? `${department.name} (${department.code})` : department.name
        }));
    }, [departmentsQuery.data]);

    const courseFields = useMemo(() => {
        const fields = [
            { name: 'code', label: 'Mã môn học' },
            { name: 'name', label: 'Tên môn học' },
            { name: 'description', label: 'Mô tả', type: 'textarea', optional: true },
            { name: 'credits', label: 'Số tín chỉ', type: 'number' },
            {
                name: 'departmentId',
                label: 'Khoa quản lý',
                type: 'select',
                valueType: 'number',
                placeholder: departmentsQuery.isPending ? 'Đang tải khoa...' : 'Chọn khoa',
                disabled: departmentsQuery.isPending || departmentOptions.length === 0,
                options: departmentOptions
            }
        ];

        if (roleCanCreateOfficialCourse(roleCode)) {
            fields.push({ name: 'requestedClassCount', label: 'Số lớp dự kiến', type: 'number', optional: true });
        }

        return fields;
    }, [departmentOptions, departmentsQuery.isPending, roleCode]);

    const refreshCourses = async () => {
        await queryClient.invalidateQueries({ queryKey: ['courses'] });
    };

    const saveCourse = useMutation({
        mutationFn: (payload) =>
            roleCanCreateOfficialCourse(roleCode) ? lmsService.createCourse(payload) : lmsService.createCourseProposal(payload),
        onSuccess: async () => {
            toast.success(roleCanCreateOfficialCourse(roleCode) ? 'Đã submit môn lên Hiệu trưởng' : 'Đã gửi đề xuất môn cho PĐT');
            setOpen(false);
            await refreshCourses();
        }
    });

    const decideCourse = useMutation({
        mutationFn: ({ course, level, action }) => {
            const payload = { action };
            return level === 'PDT'
                ? lmsService.decideCourseByTrainingOffice(course.publicId, payload)
                : lmsService.decideCourseByPrincipal(course.publicId, payload);
        },
        onSuccess: async () => {
            toast.success('Đã cập nhật luồng duyệt môn học');
            await refreshCourses();
        }
    });

    const openCourseDialog = () => {
        if (!roleCanCreateOfficialCourse(roleCode) && !roleCanProposeCourse(roleCode)) {
            toast.error('Vai trò hiện tại chưa được tạo hoặc đề xuất môn học');
            return;
        }
        setOpen(true);
    };

    return (
        <PageShell
            title="Môn học"
            description="Danh sách môn học. Chọn một môn để xem các lớp học phần của môn đó."
            search={search}
            onSearchChange={setSearch}
            actionLabel={roleCanCreateOfficialCourse(roleCode) ? 'Thêm môn học' : 'Đề xuất môn học'}
            onAction={canCreateOrProposeCourse ? openCourseDialog : undefined}
        >
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                {coursesQuery.isPending ? (
                    Array.from({ length: 8 }).map((_, index) => <div key={index} className="h-80 animate-pulse rounded-lg bg-muted" />)
                ) : courses.length === 0 ? (
                    <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground md:col-span-2 xl:col-span-3">
                        Chưa có môn học phù hợp.
                    </div>
                ) : (
                    courses.map((course) => {
                        const canPdtDecision = roleCanApprovePdt(roleCode) && course.status === 'PENDING_PDT';
                        const canPrincipalDecision = roleCanApprovePrincipal(roleCode) && course.status === 'PENDING_PRINCIPAL';
                        const enrolledClass = myEnrollments.find(
                            (enrollment) => enrollment.class?.course?.publicId === course.publicId && enrollment.status !== 'DROPPED'
                        )?.class;

                        const openCourseClasses = () => {
                            if (isStudent && enrolledClass?.publicId) {
                                navigate(`/classes/${enrolledClass.publicId}/learn`);
                                return;
                            }
                            navigate(`/courses/${course.publicId}/classes`);
                        };

                        return (
                            <Card
                                key={course.publicId}
                                role="button"
                                tabIndex={0}
                                className="group min-h-80 cursor-pointer overflow-hidden rounded-lg py-0 transition hover:border-primary/60 hover:shadow-md focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                                onClick={openCourseClasses}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter' || event.key === ' ') {
                                        event.preventDefault();
                                        openCourseClasses();
                                    }
                                }}
                            >
                                <CardContent className="p-0">
                                    <div className={`relative h-44 overflow-hidden bg-gradient-to-br ${courseBannerFor(course).gradient} p-5 text-white`}>
                                        <div className={`absolute left-1/2 top-8 size-28 -translate-x-1/2 rounded-full ${courseBannerFor(course).accent} blur-sm`} />
                                        <div className={`absolute bottom-5 right-5 size-16 rounded-2xl border-8 border-white/15 ${courseBannerFor(course).accent}`} />
                                        <div className="absolute bottom-4 right-6 text-5xl font-black text-white/20">
                                            {courseBannerFor(course).mark}
                                        </div>
                                        <div className="relative flex h-full flex-col items-center justify-between text-center">
                                            <div />
                                            <div>
                                                <h2 className="line-clamp-2 text-2xl font-bold leading-tight drop-shadow-sm">{course.name}</h2>
                                                <p className="mt-1 text-sm text-white/85">LMS Classroom</p>
                                            </div>
                                            <Sparkles className="size-4 text-white/85" />
                                        </div>
                                    </div>

                                    <div className="space-y-3 p-4">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <p className="line-clamp-1 font-semibold">{course.name}</p>
                                                <p className="mt-1 text-sm text-muted-foreground">{course.code}</p>
                                            </div>
                                            <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5" />
                                        </div>

                                    <div className="flex items-center justify-between gap-2">
                                        <Badge variant={course.status === 'ACTIVE' ? 'default' : 'secondary'}>
                                            {courseStatusLabel[course.status] || course.status}
                                        </Badge>
                                        <span className="text-sm text-muted-foreground">{course.classCount || 0} lớp học phần</span>
                                    </div>

                                    {(canPdtDecision || canPrincipalDecision) && (
                                        <div className="flex gap-2" onClick={(event) => event.stopPropagation()}>
                                            <Button
                                                type="button"
                                                size="sm"
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    decideCourse.mutate({
                                                        course,
                                                        level: canPdtDecision ? 'PDT' : 'PRINCIPAL',
                                                        action: 'APPROVED'
                                                    });
                                                }}
                                                disabled={decideCourse.isPending}
                                            >
                                                <Check className="size-4" />
                                                Duyệt
                                            </Button>
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="destructive"
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    decideCourse.mutate({
                                                        course,
                                                        level: canPdtDecision ? 'PDT' : 'PRINCIPAL',
                                                        action: 'REJECTED'
                                                    });
                                                }}
                                                disabled={decideCourse.isPending}
                                            >
                                                <X className="size-4" />
                                                Từ chối
                                            </Button>
                                        </div>
                                    )}
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })
                )}
            </div>

            <SimpleFormDialog
                open={open}
                onOpenChange={setOpen}
                title={roleCanCreateOfficialCourse(roleCode) ? 'Thêm môn học có trong giáo trình' : 'Đề xuất môn học mới'}
                fields={courseFields}
                onSubmit={(payload) => saveCourse.mutate(payload)}
                submitting={saveCourse.isPending}
            />
        </PageShell>
    );
}
