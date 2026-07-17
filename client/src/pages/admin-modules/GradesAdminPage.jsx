import classNames from 'classnames';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FiAlertTriangle, FiAward, FiRefreshCcw, FiSearch, FiSend } from 'react-icons/fi';
import { toast } from 'sonner';

import { adminModulesApi } from '~/shared/api/adminModulesApi.js';
import { getApiMessage } from '~/shared/api/http.js';
import { userRoles } from '~/shared/constants/roles.js';
import { useAuthStore } from '~/shared/store/authStore.js';
import ui from '~/shared/styles/ui.module.scss';
import styles from './AdminModulePages.module.scss';

const toItems = (value) => (Array.isArray(value) ? value : value?.data ?? value?.items ?? []);
const categoryLabels = {
    ASSIGNMENT: 'Bài tập',
    QUIZ: 'Kiểm tra',
    MIDTERM: 'Giữa kỳ',
    FINAL: 'Cuối kỳ'
};

const getCategoryScore = (row, category) => {
    if (Array.isArray(row.categoryScores)) {
        return row.categoryScores.find((item) => item.category === category)?.score ?? '-';
    }
    return row.categoryScores?.[category] ?? '-';
};

const formatScore = (value) => {
    if (value === null || value === undefined || value === '') return '-';
    const score = Number(value);
    return Number.isFinite(score) ? score.toFixed(2) : '-';
};

export function GradesAdminPage() {
    const user = useAuthStore((state) => state.user);
    const isTrainingOfficer = user?.role === userRoles.TRAINING_OFFICER;
    const isDepartmentHead = user?.role === userRoles.DEPARTMENT_HEAD;
    const [classes, setClasses] = useState([]);
    const [selectedClassId, setSelectedClassId] = useState('');
    const [departmentFilter, setDepartmentFilter] = useState('ALL');
    const [classSearch, setClassSearch] = useState('');
    const [gradebook, setGradebook] = useState(null);
    const [loadingClasses, setLoadingClasses] = useState(false);
    const [loadingGradebook, setLoadingGradebook] = useState(false);
    const [publishing, setPublishing] = useState(false);
    const [scopeMessage, setScopeMessage] = useState('');

    const departments = useMemo(() => Array.from(new Map(classes
        .filter((item) => item.department?.publicId)
        .map((item) => [item.department.publicId, item.department])).values()), [classes]);

    const filteredClasses = useMemo(() => {
        const keyword = classSearch.trim().toLowerCase();
        return classes.filter((item) => {
            const matchesDepartment = departmentFilter === 'ALL' || item.department?.publicId === departmentFilter;
            const matchesSearch = !keyword || [item.code, item.name, item.subject?.code, item.subject?.name]
                .filter(Boolean)
                .some((value) => value.toLowerCase().includes(keyword));
            return matchesDepartment && matchesSearch;
        });
    }, [classSearch, classes, departmentFilter]);

    const selectedClass = useMemo(() => classes.find((item) => item.publicId === selectedClassId), [classes, selectedClassId]);
    const rows = gradebook?.students ?? [];
    const publishedCount = rows.filter((row) => row.savedFinalScore !== null && row.savedFinalScore !== undefined).length;

    const loadClasses = useCallback(async () => {
        setLoadingClasses(true);
        setScopeMessage('');
        try {
            const [classResult, subjectResult] = await Promise.all([
                adminModulesApi.listClasses(),
                isDepartmentHead ? adminModulesApi.listSubjects() : Promise.resolve([])
            ]);
            let classItems = toItems(classResult);

            if (isDepartmentHead) {
                const managedDepartmentIds = new Set(toItems(subjectResult)
                    .filter((subject) => subject.department?.users?.some((head) => head.publicId === user?.publicId))
                    .map((subject) => subject.department.publicId));
                classItems.filter((item) => item.manager?.publicId === user?.publicId)
                    .forEach((item) => {
                        if (item.department?.publicId) managedDepartmentIds.add(item.department.publicId);
                    });
                classItems = classItems.filter((item) => managedDepartmentIds.has(item.department?.publicId));
                if (!managedDepartmentIds.size) setScopeMessage('Tài khoản Trưởng bộ môn chưa xác định được phòng ban quản lý.');
            }

            setClasses(classItems);
            setSelectedClassId((current) => classItems.some((item) => item.publicId === current)
                ? current
                : (classItems[0]?.publicId ?? ''));
        } catch (error) {
            toast.error(getApiMessage(error, 'Không tải được danh sách lớp'));
        } finally {
            setLoadingClasses(false);
        }
    }, [isDepartmentHead, user?.publicId]);

    const loadGradebook = useCallback(async (classPublicId = selectedClassId) => {
        if (!classPublicId) {
            setGradebook(null);
            return;
        }
        setLoadingGradebook(true);
        try {
            setGradebook(await adminModulesApi.classGradebook(classPublicId));
        } catch (error) {
            setGradebook(null);
            toast.error(getApiMessage(error, 'Không tải được bảng điểm lớp'));
        } finally {
            setLoadingGradebook(false);
        }
    }, [selectedClassId]);

    const publishGrades = async () => {
        if (!selectedClassId || !isTrainingOfficer) return;
        if (!window.confirm(`Công bố điểm lớp ${selectedClass?.code ?? ''} cho sinh viên?`)) return;

        setPublishing(true);
        try {
            const result = await adminModulesApi.finalizeClass(selectedClassId);
            toast.success(result?.message ?? 'Đã công bố điểm cho sinh viên');
            await loadGradebook(selectedClassId);
        } catch (error) {
            toast.error(getApiMessage(error, 'Chưa thể công bố điểm lớp'));
        } finally {
            setPublishing(false);
        }
    };

    useEffect(() => {
        const task = window.setTimeout(loadClasses, 0);
        return () => window.clearTimeout(task);
    }, [loadClasses]);

    useEffect(() => {
        const task = window.setTimeout(() => loadGradebook(selectedClassId), 0);
        return () => window.clearTimeout(task);
    }, [loadGradebook, selectedClassId]);

    useEffect(() => {
        const task = window.setTimeout(() => {
            if (filteredClasses.some((item) => item.publicId === selectedClassId)) return;
            setSelectedClassId(filteredClasses[0]?.publicId ?? '');
        }, 0);
        return () => window.clearTimeout(task);
    }, [filteredClasses, selectedClassId]);

    return (
        <div className={ui.pageStack}>
            <section className={ui.moduleHeader}>
                <div className={ui.moduleHeaderIcon}><FiAward /></div>
                <div>
                    <p className={ui.eyebrow}>{isDepartmentHead ? 'Bộ môn' : 'Phòng đào tạo'}</p>
                    <h2>{isDepartmentHead ? 'Bảng điểm bộ môn' : 'Bảng điểm toàn trường'}</h2>
                </div>
            </section>

            <section className={styles.toolbarGrid}>
                <label className={ui.field}>
                    Tìm lớp
                    <span className={ui.inputControl}>
                        <FiSearch />
                        <input value={classSearch} onChange={(event) => setClassSearch(event.target.value)} placeholder="Mã lớp hoặc môn học" />
                    </span>
                </label>
                {isTrainingOfficer ? (
                    <label className={ui.field}>
                        Phòng ban / Bộ môn
                        <select className={styles.select} value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)}>
                            <option value="ALL">Tất cả phòng ban</option>
                            {departments.map((department) => <option value={department.publicId} key={department.publicId}>{department.code} - {department.name}</option>)}
                        </select>
                    </label>
                ) : null}
                <label className={ui.field}>
                    Lớp học
                    <select className={styles.select} value={selectedClassId} onChange={(event) => setSelectedClassId(event.target.value)} disabled={!filteredClasses.length}>
                        {!filteredClasses.length ? <option value="">Không có lớp phù hợp</option> : null}
                        {filteredClasses.map((classItem) => (
                            <option key={classItem.publicId} value={classItem.publicId}>{classItem.code} - {classItem.subject?.name ?? classItem.name}</option>
                        ))}
                    </select>
                </label>
                <div className={styles.filterAction}>
                    <button className={ui.secondaryButton} type="button" onClick={loadClasses} disabled={loadingClasses}>
                        <FiRefreshCcw /> Tải lại
                    </button>
                </div>
            </section>

            {scopeMessage ? <section className={styles.blockerPanel}><span><FiAlertTriangle /> {scopeMessage}</span></section> : null}

            <section className={ui.tablePanel}>
                <div className={ui.sectionHeading}>
                    <div>
                        <p className={ui.eyebrow}>{selectedClass?.department?.name ?? 'Bảng điểm'}</p>
                        <h3>{selectedClass ? `${selectedClass.code} - ${selectedClass.subject?.name ?? selectedClass.name}` : 'Chưa chọn lớp'}</h3>
                        {gradebook ? <p className={styles.hint}>{rows.length} sinh viên · {publishedCount} đã công bố</p> : null}
                    </div>
                    <div className={styles.inlineActions}>
                        <button className={ui.secondaryButton} type="button" onClick={() => loadGradebook()} disabled={loadingGradebook || !selectedClassId}>
                            <FiRefreshCcw /> Tải bảng điểm
                        </button>
                        {isTrainingOfficer ? (
                            <button className={ui.primaryButton} type="button" onClick={publishGrades} disabled={publishing || !gradebook?.canFinalize || !rows.length}>
                                <FiSend /> {publishing ? 'Đang công bố...' : 'Công bố điểm'}
                            </button>
                        ) : null}
                    </div>
                </div>

                <div className={ui.responsiveTable}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>Sinh viên</th>
                                {Object.entries(categoryLabels).map(([category, label]) => <th key={category}>{label}</th>)}
                                <th>Tạm tính</th>
                                <th>Điểm công bố</th>
                                <th>Trạng thái</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row) => {
                                const isPublished = row.savedFinalScore !== null && row.savedFinalScore !== undefined;
                                const passed = isPublished ? row.savedPassed : row.passed;
                                return (
                                    <tr key={row.enrollmentPublicId}>
                                        <td><strong>{row.student?.fullName ?? '-'}</strong><span>{row.student?.code ?? '-'}</span></td>
                                        {Object.keys(categoryLabels).map((category) => <td key={category}>{formatScore(getCategoryScore(row, category))}</td>)}
                                        <td><strong>{formatScore(row.calculatedScore)}</strong></td>
                                        <td><strong>{formatScore(row.savedFinalScore)}</strong></td>
                                        <td>
                                            <span className={classNames(ui.statusPill, isPublished ? ui.statusPillActive : ui.statusPillPending)}>
                                                {isPublished ? (passed ? 'Đã công bố · Đạt' : 'Đã công bố · Không đạt') : 'Chưa công bố'}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                            {!loadingGradebook && !rows.length ? (
                                <tr><td className={styles.emptyCell} colSpan="8">Chưa có sinh viên hoặc dữ liệu điểm.</td></tr>
                            ) : null}
                            {loadingGradebook ? (
                                <tr><td className={styles.emptyCell} colSpan="8">Đang tải bảng điểm...</td></tr>
                            ) : null}
                        </tbody>
                    </table>
                </div>
            </section>

            {gradebook?.blockers?.length ? (
                <section className={styles.blockerPanel}>
                    <strong>Chưa thể công bố điểm</strong>
                    {gradebook.blockers.map((item) => <span key={item}><FiAlertTriangle /> {item}</span>)}
                </section>
            ) : null}
        </div>
    );
}
