import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, GraduationCap, MoreHorizontal, Plus } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';

import DataTable from '~/components/common/DataTable';
import PageShell from '~/components/common/PageShell';
import Pagination from '~/components/common/Pagination';
import SimpleFormDialog from '~/components/common/SimpleFormDialog';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from '~/components/ui/dropdown-menu';
import lmsService from '~/services/lms.service';
import useAuthStore from '~/stores/auth.store';
import { displayDate, normalizeList } from './utils';

const classStatusLabel = {
    DRAFT: 'Bản nháp',
    OPEN_REGISTRATION: 'Đang mở đăng ký',
    CLOSED_REGISTRATION: 'Đã đóng đăng ký',
    FULL: 'Đã đủ sĩ số',
    IN_PROGRESS: 'Đang học',
    COMPLETED: 'Đã hoàn thành',
    CANCELLED: 'Đã hủy'
};

const classColumns = [
    { key: 'code', label: 'Mã lớp học phần' },
    { key: 'name', label: 'Tên lớp' },
    { key: 'semester', label: 'Học kỳ' },
    { key: 'academicYear', label: 'Năm học' },
    { key: 'lecturer', label: 'Giảng viên', render: (row) => row.lecturer?.fullName || 'Chưa phân công' },
    { key: 'enrolledCount', label: 'Sĩ số', render: (row) => `${row.enrolledCount || 0}/${row.maxStudents || 0}` },
    { key: 'status', label: 'Trạng thái', render: (row) => <Badge variant={row.status === 'OPEN_REGISTRATION' ? 'default' : 'secondary'}>{classStatusLabel[row.status] || row.status}</Badge> },
    { key: 'startDate', label: 'Bắt đầu', render: (row) => displayDate(row.startDate) }
];

const classFields = [
    { name: 'code', label: 'Mã lớp học phần' },
    { name: 'name', label: 'Tên lớp' },
    { name: 'semester', label: 'Học kỳ', optional: true },
    { name: 'academicYear', label: 'Năm học', optional: true },
    { name: 'maxStudents', label: 'Sĩ số tối đa', type: 'number' },
    { name: 'startDate', label: 'Ngày bắt đầu', type: 'date' },
    { name: 'endDate', label: 'Ngày kết thúc', type: 'date' },
    { name: 'room', label: 'Phòng học', optional: true },
    { name: 'onlineUrl', label: 'Link học online', optional: true }
];

const canDeleteClassRole = (roleCode) => ['ADMIN', 'TRAINING_OFFICER', 'PRINCIPAL'].includes(roleCode);
const canOpenRegistration = (row) => ['DRAFT', 'CLOSED_REGISTRATION'].includes(row.status);
const hasNoStudents = (row) => (row.enrolledCount ?? 0) === 0;

export default function ClassesPage() {
    const { publicId } = useParams();
    const [page, setPage] = useState(1);
    const [open, setOpen] = useState(false);
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const currentUser = useAuthStore((state) => state.user);
    const roleCode = currentUser?.role?.code;
    const isStudent = roleCode === 'STUDENT';
    const canCreateClass = !isStudent;

    const courseQuery = useQuery({
        queryKey: ['course', publicId],
        enabled: Boolean(publicId),
        queryFn: () => lmsService.getCourse(publicId)
    });

    const course = courseQuery.data;
    const classesQuery = useQuery({
        queryKey: ['course-classes', course?.id, page],
        enabled: Boolean(course?.id),
        queryFn: () => lmsService.listClasses({ page, limit: 10, courseId: course.id })
    });
    const myEnrollmentsQuery = useQuery({
        queryKey: ['my-enrollments'],
        queryFn: lmsService.listMyEnrollments,
        enabled: isStudent
    });

    const classes = normalizeList(classesQuery.data);
    const myEnrollments = Array.isArray(myEnrollmentsQuery.data) ? myEnrollmentsQuery.data : [];
    const enrolledInCourse = myEnrollments.find(
        (enrollment) => enrollment.class?.course?.publicId === publicId && enrollment.status !== 'DROPPED'
    );

    const description = useMemo(() => {
        if (!course) return publicId;
        return `${course.code} - ${course.name}`;
    }, [course, publicId]);

    const refresh = async () => {
        await Promise.all([
            queryClient.invalidateQueries({ queryKey: ['course-classes'] }),
            queryClient.invalidateQueries({ queryKey: ['course', publicId] }),
            queryClient.invalidateQueries({ queryKey: ['my-enrollments'] })
        ]);
    };

    const saveClass = useMutation({
        mutationFn: (payload) => lmsService.createClass({ ...payload, coursePublicId: course.publicId }),
        onSuccess: async () => {
            toast.success('Đã tạo lớp học phần');
            setOpen(false);
            await refresh();
        }
    });

    const openRegistration = useMutation({
        mutationFn: (row) => lmsService.updateClassStatus(row.publicId, 'OPEN_REGISTRATION'),
        onSuccess: async () => {
            toast.success('Đã mở đăng ký lớp học phần');
            await refresh();
        },
        onError: (error) => {
            toast.error(error?.response?.data?.message || 'Không thể mở đăng ký lớp học phần');
        }
    });

    const deleteClass = useMutation({
        mutationFn: (row) => lmsService.deleteClass(row.publicId),
        onSuccess: async () => {
            toast.success('Đã xóa lớp học phần');
            await refresh();
        },
        onError: (error) => {
            toast.error(error?.response?.data?.message || 'Không thể xóa lớp học phần');
        }
    });

    const enrollClass = useMutation({
        mutationFn: (row) => lmsService.enrollClass(row.publicId),
        onSuccess: async (_data, row) => {
            toast.success('Đăng ký lớp học phần thành công');
            await refresh();
            navigate(`/classes/${row.publicId}/learn`);
        },
        onError: (error) => {
            toast.error(error?.response?.data?.message || 'Không thể đăng ký lớp học phần');
        }
    });

    const openCreateClass = () => {
        if (!course) return;
        if (course.status !== 'ACTIVE') {
            toast.error('Chỉ tạo lớp học phần từ môn đã ACTIVE');
            return;
        }
        setOpen(true);
    };

    const isRowEnrolled = (row) => enrolledInCourse?.class?.publicId === row.publicId;
    const canRegisterRow = (row) => row.status === 'OPEN_REGISTRATION' && !enrolledInCourse;
    const visibleRows = isStudent
        ? classes.items.filter((row) => row.status === 'OPEN_REGISTRATION' || isRowEnrolled(row))
        : classes.items;

    const actions = isStudent
        ? [
              {
                  label: (row) => {
                      if (isRowEnrolled(row)) return 'Vào học';
                      if (enrolledInCourse) return 'Đã đăng ký lớp khác';
                      if (row.status === 'OPEN_REGISTRATION') return 'Đăng ký';
                      return 'Chưa mở';
                  },
                  variant: (row) => (isRowEnrolled(row) || canRegisterRow(row) ? 'default' : 'secondary'),
                  disabled: (row) => !isRowEnrolled(row) && !canRegisterRow(row),
                  onClick: (row) => {
                      if (isRowEnrolled(row)) {
                          navigate(`/classes/${row.publicId}/learn`);
                          return;
                      }
                      if (canRegisterRow(row)) enrollClass.mutate(row);
                  }
              }
          ]
        : [];

    const renderClassActions = (row) => (
        <div className="flex justify-end">
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button type="button" variant="ghost" size="icon" aria-label="Mở thao tác lớp">
                        <MoreHorizontal className="size-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem
                        disabled={!canOpenRegistration(row) || openRegistration.isPending}
                        onClick={() => openRegistration.mutate(row)}
                    >
                        Mở đăng ký
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate(`/classes/${row.publicId}/content`)}>
                        Chỉnh sửa nội dung
                    </DropdownMenuItem>
                    {canDeleteClassRole(roleCode) ? (
                        <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                variant="destructive"
                                disabled={deleteClass.isPending || !hasNoStudents(row)}
                                onClick={() => {
                                    if (!hasNoStudents(row)) {
                                        toast.error('Lớp đã có sinh viên nên không được xóa');
                                        return;
                                    }
                                    if (window.confirm(`Xóa lớp học phần ${row.code}?`)) {
                                        deleteClass.mutate(row);
                                    }
                                }}
                            >
                                Xóa
                            </DropdownMenuItem>
                        </>
                    ) : null}
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );

    return (
        <PageShell title="Lớp học phần" description={description}>
            <div className="flex flex-wrap items-center justify-between gap-2">
                <Button type="button" variant="outline" asChild>
                    <Link to="/courses">
                        <ArrowLeft className="size-4" />
                        Quay lại môn học
                    </Link>
                </Button>
                {canCreateClass ? (
                    <Button type="button" onClick={openCreateClass} disabled={!course}>
                        <Plus className="size-4" />
                        Tạo lớp học phần
                    </Button>
                ) : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border p-4">
                    <p className="text-sm text-muted-foreground">Mã môn</p>
                    <p className="mt-1 text-xl font-semibold">{course?.code || '-'}</p>
                </div>
                <div className="rounded-lg border p-4">
                    <p className="text-sm text-muted-foreground">Trạng thái môn</p>
                    <div className="mt-2">
                        <Badge>{course?.status || '-'}</Badge>
                    </div>
                </div>
                <div className="rounded-lg border p-4">
                    <p className="text-sm text-muted-foreground">Số lớp học phần</p>
                    <p className="mt-1 text-xl font-semibold">{isStudent ? visibleRows.length : classes.meta.total || 0}</p>
                </div>
            </div>

            <section className="space-y-3">
                <div>
                    <h2 className="flex items-center gap-2 font-semibold">
                        <GraduationCap className="size-5" />
                        Danh sách lớp học phần
                    </h2>
                    <p className="text-sm text-muted-foreground">
                        Sinh viên chỉ được ghi danh một lớp học phần trong cùng một môn học.
                    </p>
                </div>

                <DataTable
                    columns={classColumns}
                    rows={visibleRows}
                    loading={courseQuery.isPending || classesQuery.isPending || (isStudent && myEnrollmentsQuery.isPending)}
                    actions={actions}
                    renderActions={!isStudent ? renderClassActions : undefined}
                />
                <Pagination page={page} totalPages={classes.meta.totalPages} onPageChange={setPage} />
            </section>

            {canCreateClass ? (
                <SimpleFormDialog
                    open={open}
                    onOpenChange={setOpen}
                    title={course ? `Tạo lớp học phần cho ${course.code}` : 'Tạo lớp học phần'}
                    fields={classFields}
                    onSubmit={(payload) => saveClass.mutate(payload)}
                    submitting={saveClass.isPending}
                />
            ) : null}
        </PageShell>
    );
}
