import { Navigate, useParams } from 'react-router-dom';

import { flowWorkspaces } from '~/config/flowNavigation';
import AdminAuditLogs from '~/pages/Admin/AuditLogs';
import AdminPermissions from '~/pages/Admin/Permissions';
import AdminUsers from '~/pages/Admin/Users';
import ClassesPage from '~/pages/Classes';
import CoursesPage from '~/pages/Courses';
import FlowWorkbench from '~/pages/FlowWorkbench';

const moduleKeyBySegment = {
    users: 'users',
    departments: 'departments',
    permissions: 'permissions',
    'audit-logs': 'audit',
    curriculums: 'curriculums',
    subjects: 'subjects',
    classes: 'classes',
    lessons: 'lessons',
    exams: 'exams',
    grades: 'grades',
    proposals: 'proposals',
    registration: 'registration'
};

export default function WorkspaceModuleRoute() {
    const { workspaceKey, moduleSegment } = useParams();

    const workspace = flowWorkspaces[workspaceKey];

    if (!workspace) {
        return <Navigate to="/" replace />;
    }

    const moduleKey = moduleKeyBySegment[moduleSegment] || moduleSegment;
    const modulePath = `${workspace.basePath}/${moduleSegment}`;
    const module = workspace.modules.find((item) => item.key === moduleKey && item.path === modulePath);

    if (!module) {
        return <Navigate to={workspace.dashboardPath} replace />;
    }

    if (moduleKey === 'users') {
        return <AdminUsers workspaceKey={workspaceKey} />;
    }

    if (moduleKey === 'permissions') {
        return <AdminPermissions workspaceKey={workspaceKey} />;
    }

    if (moduleKey === 'audit') {
        return <AdminAuditLogs workspaceKey={workspaceKey} />;
    }

    if (moduleKey === 'subjects' || moduleKey === 'proposals') {
        return <CoursesPage workspaceKey={workspaceKey} />;
    }

    if (moduleKey === 'classes' || moduleKey === 'registration') {
        return <ClassesPage workspaceKey={workspaceKey} />;
    }

    return <FlowWorkbench workspaceKey={workspaceKey} moduleKey={moduleKey} />;
}
