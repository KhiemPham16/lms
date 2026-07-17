import { useCallback, useEffect, useMemo, useState } from 'react';
import { FiCode, FiLayers, FiRefreshCcw } from 'react-icons/fi';
import { toast } from 'sonner';

import { adminModulesApi } from '~/shared/api/adminModulesApi.js';
import { getApiMessage } from '~/shared/api/http.js';
import { moduleMeta } from '~/shared/constants/modules.js';
import ui from '~/shared/styles/ui.module.scss';
import styles from './AdminModulePages.module.scss';

const toItems = (value) => (Array.isArray(value) ? value : value?.data ?? value?.items ?? []);
const fmtDateTime = (value) => (value ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : '-');

export function LearningAdminPage({ moduleKey }) {
    const meta = moduleMeta[moduleKey] ?? moduleMeta.lessons;
    const Icon = moduleKey === 'lessons' ? FiLayers : FiCode;
    const [classes, setClasses] = useState([]);
    const [selectedClassId, setSelectedClassId] = useState('');
    const [content, setContent] = useState(null);
    const [assessments, setAssessments] = useState([]);
    const [loading, setLoading] = useState(false);

    const selectedClass = useMemo(() => classes.find((item) => item.publicId === selectedClassId), [classes, selectedClassId]);

    const loadClasses = useCallback(async () => {
        try {
            const classResult = await adminModulesApi.listClasses();
            const classItems = toItems(classResult);
            setClasses(classItems);
            setSelectedClassId((current) => current || classItems[0]?.publicId || '');
        } catch (error) {
            toast.error(getApiMessage(error, 'Không tải được danh sách lớp'));
        }
    }, []);

    const loadLearningData = useCallback(async (classPublicId = selectedClassId) => {
        if (!classPublicId) return;
        setLoading(true);
        try {
            const [contentResult, assessmentResult] = await Promise.all([
                adminModulesApi.classContent(classPublicId).catch((error) => ({ error })),
                adminModulesApi.classAssessments(classPublicId).catch((error) => ({ error }))
            ]);
            if (contentResult.error) toast.error(getApiMessage(contentResult.error, 'Không tải được nội dung lớp'));
            else setContent(contentResult);
            if (assessmentResult.error) toast.error(getApiMessage(assessmentResult.error, 'Không tải được bài kiểm tra'));
            else setAssessments(toItems(assessmentResult));
        } finally {
            setLoading(false);
        }
    }, [selectedClassId]);

    useEffect(() => {
        const task = window.setTimeout(() => {
            loadClasses();
        }, 0);

        return () => window.clearTimeout(task);
    }, [loadClasses]);

    useEffect(() => {
        const task = window.setTimeout(() => {
            if (selectedClassId) loadLearningData(selectedClassId);
        }, 0);

        return () => window.clearTimeout(task);
    }, [loadLearningData, selectedClassId]);

    const sections = content?.sections ?? content?.lessonSections ?? [];

    return (
        <div className={ui.pageStack}>
            <section className={ui.moduleHeader}>
                <div className={ui.moduleHeaderIcon}><Icon /></div>
                <div>
                    <p className={ui.eyebrow}>Learning</p>
                    <h2>{meta.label}</h2>
                    <p>Dữ liệu lấy từ module learning của BE theo từng lớp học.</p>
                </div>
            </section>

            <section className={styles.toolbarGrid}>
                <label className={ui.field}>
                    Chọn lớp học
                    <select className={styles.select} value={selectedClassId} onChange={(event) => setSelectedClassId(event.target.value)}>
                        {classes.map((classItem) => (
                            <option key={classItem.publicId} value={classItem.publicId}>{classItem.code} - {classItem.name}</option>
                        ))}
                    </select>
                </label>
                <div className={styles.toolbarWide}>
                    <span className={styles.hint}>Môn: {selectedClass?.subject?.name ?? '-'}</span>
                </div>
                <button className={ui.secondaryButton} type="button" onClick={() => loadLearningData()} disabled={loading || !selectedClassId}>
                    <FiRefreshCcw /> Tải lại
                </button>
            </section>

            {(moduleKey === 'lessons' || moduleKey === 'assignments') && (
                <section className={ui.tablePanel}>
                    <div className={ui.sectionHeading}>
                        <div>
                            <p className={ui.eyebrow}>Nội dung lớp</p>
                            <h3>{sections.length} chương/bài học</h3>
                        </div>
                    </div>
                    <div className={styles.listStack}>
                        {sections.map((section) => (
                            <article className={styles.recordCard} key={section.publicId ?? section.id}>
                                <strong>{section.title}</strong>
                                <span>Thứ tự: {section.sortOrder ?? '-'}</span>
                                <div className={ui.responsiveTable}>
                                    <table className={styles.table}>
                                        <tbody>
                                            {(section.lessons ?? []).map((lesson) => (
                                                <tr key={lesson.publicId ?? lesson.id}>
                                                    <td><strong>{lesson.title}</strong><span>{lesson.type}</span></td>
                                                    <td>{lesson.isPublished ? 'Đã công khai' : 'Đang ẩn'}</td>
                                                    <td>{lesson.mediaPublicId ?? lesson.resourceUrl ?? lesson.youtubeVideoId ?? '-'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </article>
                        ))}
                        {!sections.length ? <div className={styles.emptyState}>Chưa có nội dung hoặc BE không trả dữ liệu cho lớp này.</div> : null}
                    </div>
                </section>
            )}

            {moduleKey === 'assessments' && (
                <section className={ui.tablePanel}>
                    <div className={ui.sectionHeading}>
                        <div>
                            <p className={ui.eyebrow}>Kiểm tra & thi</p>
                            <h3>{assessments.length} bài đánh giá</h3>
                        </div>
                    </div>
                    <div className={ui.responsiveTable}>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>Tiêu đề</th>
                                    <th>Loại</th>
                                    <th>Thời gian</th>
                                    <th>Cấu hình</th>
                                    <th>Trạng thái</th>
                                </tr>
                            </thead>
                            <tbody>
                                {assessments.map((assessment) => (
                                    <tr key={assessment.publicId}>
                                        <td><strong>{assessment.title}</strong><span>{assessment.description ?? '-'}</span></td>
                                        <td>{assessment.category}</td>
                                        <td>{fmtDateTime(assessment.openAt)}<span>{fmtDateTime(assessment.closeAt)}</span></td>
                                        <td>{assessment.durationMinutes ?? '-'} phút<span>{assessment.maxAttempts ?? 1} lượt</span></td>
                                        <td><span className={ui.statusPill}>{assessment.isPublished ? 'Đã công khai' : 'Đang ẩn'}</span></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            )}

        </div>
    );
}
