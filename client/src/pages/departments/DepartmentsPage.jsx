import classNames from 'classnames';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FiEdit2, FiLayers, FiLoader, FiPlus, FiRefreshCcw, FiSearch, FiTrash2, FiX } from 'react-icons/fi';
import { toast } from 'sonner';

import { adminModulesApi } from '~/shared/api/adminModulesApi.js';
import { getApiMessage } from '~/shared/api/http.js';
import { ModalBackdrop } from '~/shared/components/ModalBackdrop.jsx';
import { userRoles } from '~/shared/constants/roles.js';
import { useAuthStore } from '~/shared/store/authStore.js';
import ui from '~/shared/styles/ui.module.scss';
import styles from './DepartmentsPage.module.scss';

const emptyForm = {
    code: '',
    name: '',
    description: '',
    isActive: true
};

const toItems = (value) => {
    if (Array.isArray(value)) return value;
    if (Array.isArray(value?.items)) return value.items;
    if (Array.isArray(value?.data)) return value.data;
    return [];
};

const dependencyKeys = ['users', 'subjects', 'subjectProposals', 'classes'];
const dependencyLabels = {
    users: 'người dùng',
    subjects: 'môn học',
    subjectProposals: 'đề xuất môn',
    classes: 'lớp học'
};

const getDependencyCount = (department) => dependencyKeys.reduce(
    (total, key) => total + (Number(department?._count?.[key]) || 0),
    0
);

const getDependencySummary = (department) => dependencyKeys
    .map((key) => ({ key, count: Number(department?._count?.[key]) || 0 }))
    .filter((item) => item.count > 0)
    .map((item) => `${item.count} ${dependencyLabels[item.key]}`)
    .join(', ');

const getDeleteAvailability = (department) => {
    const counts = department?._count ?? {};
    const hasAllDependencyCounts = dependencyKeys.every((key) => Object.prototype.hasOwnProperty.call(counts, key));
    const dependencyCount = getDependencyCount(department);

    return {
        dependencyCount,
        canDelete: typeof department?.canDelete === 'boolean'
            ? department.canDelete
            : hasAllDependencyCounts && dependencyCount === 0,
        hasAllDependencyCounts
    };
};

export function DepartmentsPage() {
    const user = useAuthStore((state) => state.user);
    const canManageDepartments = [userRoles.ADMIN, userRoles.PRINCIPAL, userRoles.TRAINING_OFFICER].includes(user?.role);
    const [departments, setDepartments] = useState([]);
    const [keyword, setKeyword] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [editingDepartment, setEditingDepartment] = useState(null);
    const [form, setForm] = useState(emptyForm);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [deletingPublicId, setDeletingPublicId] = useState(null);

    const loadDepartments = useCallback(async () => {
        setIsLoading(true);
        try {
            const result = await adminModulesApi.listDepartments();
            setDepartments(toItems(result));
        } catch (error) {
            toast.error(getApiMessage(error, 'Không tải được danh sách phòng ban'));
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        const task = window.setTimeout(loadDepartments, 0);
        return () => window.clearTimeout(task);
    }, [loadDepartments]);

    const filteredDepartments = useMemo(() => {
        const normalizedKeyword = keyword.trim().toLowerCase();
        return departments.filter((department) => {
            const matchesStatus = statusFilter === 'ALL' || String(department.isActive) === statusFilter;
            const matchesKeyword = !normalizedKeyword || [department.code, department.name, department.description]
                .filter(Boolean)
                .some((value) => String(value).toLowerCase().includes(normalizedKeyword));
            return matchesStatus && matchesKeyword;
        });
    }, [departments, keyword, statusFilter]);

    const openCreateModal = () => {
        setEditingDepartment(null);
        setForm(emptyForm);
        setIsModalOpen(true);
    };

    const openEditModal = (department) => {
        setEditingDepartment(department);
        setForm({
            code: department.code ?? '',
            name: department.name ?? '',
            description: department.description ?? '',
            isActive: department.isActive !== false
        });
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setEditingDepartment(null);
        setForm(emptyForm);
        setIsModalOpen(false);
    };

    const saveDepartment = async (event) => {
        event.preventDefault();
        setIsSaving(true);
        const payload = {
            code: form.code.trim(),
            name: form.name.trim(),
            description: form.description.trim() || undefined
        };

        try {
            if (editingDepartment) {
                await adminModulesApi.updateDepartment(editingDepartment.publicId, {
                    ...payload,
                    isActive: form.isActive
                });
                toast.success('Đã cập nhật phòng ban');
            } else {
                await adminModulesApi.createDepartment(payload);
                toast.success('Đã tạo phòng ban');
            }
            closeModal();
            await loadDepartments();
        } catch (error) {
            toast.error(getApiMessage(error, 'Không lưu được phòng ban'));
        } finally {
            setIsSaving(false);
        }
    };

    const toggleDepartmentStatus = async (department) => {
        try {
            await adminModulesApi.updateDepartment(department.publicId, { isActive: !department.isActive });
            toast.success(department.isActive ? 'Đã ngừng hoạt động phòng ban' : 'Đã kích hoạt phòng ban');
            await loadDepartments();
        } catch (error) {
            toast.error(getApiMessage(error, 'Không cập nhật được trạng thái phòng ban'));
        }
    };

    const deleteDepartment = async (department) => {
        const { canDelete, dependencyCount } = getDeleteAvailability(department);
        if (!canDelete) {
            if (dependencyCount === 0) {
                toast.error('BE chưa trả đủ dữ liệu để xác nhận phòng ban có thể xóa');
                return;
            }
            toast.error('Chỉ được xóa phòng ban chưa có dữ liệu liên kết');
            return;
        }
        if (!window.confirm(`Xóa phòng ban ${department.code} - ${department.name}?`)) return;

        setDeletingPublicId(department.publicId);
        try {
            const result = await adminModulesApi.deleteDepartment(department.publicId);
            setDepartments((current) => current.filter((item) => item.publicId !== department.publicId));
            toast.success(result?.message || 'Đã xóa phòng ban');
        } catch (error) {
            toast.error(getApiMessage(error, 'Không xóa được phòng ban'));
        } finally {
            setDeletingPublicId(null);
        }
    };

    return (
        <div className={ui.pageStack}>
            <section className={ui.moduleHeader}>
                <div className={ui.moduleHeaderIcon}><FiLayers /></div>
                <div>
                    <p className={ui.eyebrow}>Departments</p>
                    <h2>Quản lý phòng ban và bộ môn</h2>
                </div>
            </section>

            <section className={styles.toolbar}>
                <label className={classNames(ui.field, styles.searchField)}>
                    Tìm kiếm
                    <span className={ui.inputControl}>
                        <FiSearch />
                        <input type="search" value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="Mã, tên hoặc mô tả" />
                    </span>
                </label>
                <label className={ui.field}>
                    Trạng thái
                    <select className={ui.plainInput} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                        <option value="ALL">Tất cả</option>
                        <option value="true">Đang hoạt động</option>
                        <option value="false">Ngừng hoạt động</option>
                    </select>
                </label>
                <div className={styles.toolbarActions}>
                    <button className={ui.secondaryButton} type="button" onClick={loadDepartments} disabled={isLoading}>
                        <FiRefreshCcw /> Tải lại
                    </button>
                    {canManageDepartments ? (
                        <button className={ui.primaryButton} type="button" onClick={openCreateModal}>
                            <FiPlus /> Thêm phòng ban
                        </button>
                    ) : null}
                </div>
            </section>

            <section className={ui.tablePanel}>
                <div className={ui.sectionHeading}>
                    <div>
                        <p className={ui.eyebrow}>Danh sách</p>
                        <h3>{filteredDepartments.length} phòng ban</h3>
                    </div>
                </div>
                <div className={ui.responsiveTable}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>Mã</th>
                                <th>Phòng ban / Bộ môn</th>
                                <th>Dữ liệu liên kết</th>
                                <th>Trạng thái</th>
                                {canManageDepartments ? <th>Thao tác</th> : null}
                            </tr>
                        </thead>
                        <tbody>
                            {filteredDepartments.map((department) => {
                                const { canDelete, dependencyCount, hasAllDependencyCounts } = getDeleteAvailability(department);
                                const dependencySummary = getDependencySummary(department);
                                const isDeleting = deletingPublicId === department.publicId;
                                return (
                                    <tr key={department.publicId}>
                                        <td><strong>{department.code}</strong></td>
                                        <td>
                                            <strong>{department.name}</strong>
                                            <span>{department.description || 'Chưa có mô tả'}</span>
                                        </td>
                                        <td>
                                            <strong>{dependencyCount}</strong>
                                            <span className={styles.dependencySummary} title={dependencySummary || 'Chưa có dữ liệu liên kết'}>
                                                {dependencySummary || 'Chưa có dữ liệu liên kết'}
                                            </span>
                                        </td>
                                        <td>
                                            {canManageDepartments ? (
                                                <button
                                                    className={classNames(ui.statusPill, department.isActive ? ui.statusPillActive : ui.statusPillInactive, styles.statusButton)}
                                                    type="button"
                                                    onClick={() => toggleDepartmentStatus(department)}
                                                    disabled={isDeleting}
                                                    title="Đổi trạng thái"
                                                >
                                                    {department.isActive ? 'Đang hoạt động' : 'Ngừng hoạt động'}
                                                </button>
                                            ) : (
                                                <span className={classNames(ui.statusPill, department.isActive ? ui.statusPillActive : ui.statusPillInactive)}>
                                                    {department.isActive ? 'Đang hoạt động' : 'Ngừng hoạt động'}
                                                </span>
                                            )}
                                        </td>
                                        {canManageDepartments ? <td>
                                            <div className={styles.tableActions}>
                                                <button className={ui.iconButton} type="button" onClick={() => openEditModal(department)} disabled={isDeleting} title="Cập nhật phòng ban" aria-label="Cập nhật phòng ban">
                                                    <FiEdit2 />
                                                </button>
                                                <button
                                                    className={classNames(ui.iconButton, ui.dangerButton)}
                                                    type="button"
                                                    onClick={() => deleteDepartment(department)}
                                                    disabled={!canDelete || isDeleting}
                                                    title={isDeleting
                                                        ? 'Đang xóa phòng ban'
                                                        : canDelete
                                                        ? 'Xóa phòng ban'
                                                        : dependencyCount > 0
                                                            ? `Không thể xóa: ${dependencySummary}`
                                                            : hasAllDependencyCounts
                                                                ? 'Không thể xóa phòng ban'
                                                                : 'BE chưa trả đủ dữ liệu kiểm tra xóa'}
                                                    aria-label={isDeleting ? 'Đang xóa phòng ban' : 'Xóa phòng ban'}
                                                >
                                                    {isDeleting ? <FiLoader className={styles.spinningIcon} /> : <FiTrash2 />}
                                                </button>
                                            </div>
                                        </td> : null}
                                    </tr>
                                );
                            })}
                            {!isLoading && filteredDepartments.length === 0 ? (
                                <tr><td className={styles.emptyCell} colSpan={canManageDepartments ? 5 : 4}>Không có phòng ban phù hợp.</td></tr>
                            ) : null}
                            {isLoading ? (
                                <tr><td className={styles.emptyCell} colSpan={canManageDepartments ? 5 : 4}>Đang tải danh sách phòng ban...</td></tr>
                            ) : null}
                        </tbody>
                    </table>
                </div>
            </section>

            {canManageDepartments && isModalOpen ? (
                <ModalBackdrop onClose={closeModal}>
                    <form className={ui.modal} onSubmit={saveDepartment}>
                        <div className={ui.modalHeader}>
                            <div>
                                <p className={ui.eyebrow}>{editingDepartment ? 'Cập nhật' : 'Tạo mới'}</p>
                                <h3>{editingDepartment ? 'Cập nhật phòng ban' : 'Thêm phòng ban'}</h3>
                            </div>
                            <button className={ui.iconButton} type="button" onClick={closeModal} aria-label="Đóng"><FiX /></button>
                        </div>
                        <div className={ui.modalGrid}>
                            <label className={ui.field}>
                                Mã phòng ban
                                <input className={ui.plainInput} value={form.code} onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))} maxLength="30" required />
                            </label>
                            <label className={ui.field}>
                                Tên phòng ban
                                <input className={ui.plainInput} value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} maxLength="150" required />
                            </label>
                            <label className={classNames(ui.field, ui.modalFull)}>
                                Mô tả
                                <textarea className={styles.textarea} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} maxLength="1000" />
                            </label>
                            {editingDepartment ? (
                                <label className={styles.checkboxLine}>
                                    <input type="checkbox" checked={form.isActive} onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))} />
                                    Đang hoạt động
                                </label>
                            ) : null}
                        </div>
                        <div className={ui.modalFooter}>
                            <button className={ui.secondaryButton} type="button" onClick={closeModal} disabled={isSaving}>Hủy</button>
                            <button className={ui.primaryButton} type="submit" disabled={isSaving}>
                                {isSaving ? 'Đang lưu...' : 'Lưu phòng ban'}
                            </button>
                        </div>
                    </form>
                </ModalBackdrop>
            ) : null}
        </div>
    );
}
