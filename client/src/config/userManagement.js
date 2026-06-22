export const userRoleOptions = [
    { value: 'ADMIN', label: 'Admin' },
    { value: 'HR', label: 'HR' },
    { value: 'PRINCIPAL', label: 'Hiệu trưởng' },
    { value: 'TRAINING_OFFICER', label: 'Phòng đào tạo' },
    { value: 'DEPARTMENT_HEAD', label: 'Trưởng bộ môn' },
    { value: 'LECTURER', label: 'Giảng viên' },
    { value: 'STUDENT', label: 'Sinh viên' }
];

export const hrManagedRoleOptions = userRoleOptions.filter(
    (role) => !['ADMIN', 'HR', 'PRINCIPAL'].includes(role.value)
);

export const userStatusOptions = [
    { value: 'ACTIVE', label: 'Đang hoạt động' },
    { value: 'INACTIVE', label: 'Ngưng hoạt động' },
    { value: 'LOCKED', label: 'Đã khóa' }
];

export const userRoleLabels = userRoleOptions.reduce((labels, role) => ({ ...labels, [role.value]: role.label }), {});
export const userStatusLabels = userStatusOptions.reduce((labels, status) => ({ ...labels, [status.value]: status.label }), {});

export const emptyUserForm = {
    code: '',
    fullName: '',
    email: '',
    phone: '',
    password: '123456',
    role: 'PRINCIPAL',
    status: 'ACTIVE',
    gender: '',
    dateOfBirth: '',
    address: '',
    departmentId: ''
};

export const defaultUserFilters = {
    keyword: '',
    role: '',
    status: '',
    page: 1,
    limit: 10
};

export const defaultUserMeta = {
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1
};
