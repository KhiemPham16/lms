const moduleContent = {
    departments: {
        title: 'Phòng ban',
        description: 'Quản lý khoa, phòng ban và đơn vị phụ trách trong hệ thống.',
        endpoints: ['GET /departments', 'POST /departments', 'PATCH /departments/:publicId', 'DELETE /departments/:publicId'],
        nextFeatures: ['Danh sách phòng ban', 'Tạo và cập nhật phòng ban', 'Xóa mềm phòng ban', 'Gán người dùng theo phòng ban']
    },
    roles: {
        title: 'Vai trò',
        description: 'Quản lý vai trò, nhóm quyền và phân quyền động.',
        endpoints: ['GET /roles', 'GET /roles/permissions', 'POST /roles', 'PUT /roles/:publicId/permissions'],
        nextFeatures: ['Danh sách vai trò', 'Tạo và sửa vai trò', 'Ma trận phân quyền', 'Gán quyền theo module']
    },
    courses: {
        title: 'Khóa học',
        description: 'Quản lý đề xuất, phê duyệt, phân công và trạng thái khóa học.',
        endpoints: [
            'GET /courses',
            'POST /courses',
            'POST /courses/proposals',
            'PATCH /courses/:publicId/status',
            'PATCH /courses/:publicId/lecturers'
        ],
        nextFeatures: ['Danh sách khóa học', 'Tạo đề xuất khóa học', 'Phê duyệt khóa học', 'Phân công trưởng bộ môn và giảng viên']
    },
    classes: {
        title: 'Lớp học',
        description: 'Quản lý lớp học, giảng viên, trưởng lớp, bài học và tiến độ.',
        endpoints: [
            'GET /classes',
            'GET /classes/summary',
            'POST /classes',
            'PATCH /classes/:publicId/status',
            'POST /classes/:targetPublicId/copy-content-from/:sourcePublicId'
        ],
        nextFeatures: ['Danh sách lớp học', 'Tạo lớp từ khóa học', 'Gán giảng viên', 'Quản lý bài học', 'Theo dõi tiến độ và điểm số']
    }
};

export default function ModuleRoadmap({ module }) {
    const content = moduleContent[module];

    if (!content) {
        return null;
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold">{content.title}</h1>
                <p className="text-muted-foreground">{content.description}</p>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
                <section className="rounded-lg border bg-background p-5">
                    <h2 className="mb-3 text-lg font-semibold">API đã có</h2>
                    <div className="space-y-2">
                        {content.endpoints.map((endpoint) => (
                            <div key={endpoint} className="rounded-md bg-muted px-3 py-2 font-mono text-sm">
                                {endpoint}
                            </div>
                        ))}
                    </div>
                </section>

                <section className="rounded-lg border bg-background p-5">
                    <h2 className="mb-3 text-lg font-semibold">Chức năng nên làm tiếp</h2>
                    <ul className="space-y-2 text-sm">
                        {content.nextFeatures.map((feature) => (
                            <li key={feature} className="rounded-md border px-3 py-2">
                                {feature}
                            </li>
                        ))}
                    </ul>
                </section>
            </div>
        </div>
    );
}
