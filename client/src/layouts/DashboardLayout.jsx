import { Outlet } from 'react-router-dom';

import AppHeader from '~/components/layout/AppHeader';
import AppSidebar from '~/components/layout/AppSidebar';

export default function DashboardLayout() {
    return (
        <div className="flex min-h-screen bg-transparent">
            <AppSidebar />

            <div className="flex flex-1 flex-col">
                <AppHeader />

                <main className="flex-1 p-6">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
