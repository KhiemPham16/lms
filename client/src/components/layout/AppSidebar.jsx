import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';

import { getVisibleNavigationItems } from '~/config/navigation';
import useAuthStore from '~/stores/auth.store';

function isMenuActive(location, menu) {
    if (location.pathname !== menu.path) return false;
    if (!menu.children?.length) return true;
    return menu.children.some((child) => `${location.pathname}${location.search}` === child.path);
}

export default function AppSidebar() {
    const user = useAuthStore((state) => state.user);
    const menus = getVisibleNavigationItems(user);
    const location = useLocation();
    const [openMenus, setOpenMenus] = useState({});

    const toggleMenu = (path) => {
        setOpenMenus((current) => ({
            ...current,
            [path]: !current[path]
        }));
    };

    return (
        <aside className="w-64 border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
            <div className="border-b border-sidebar-border bg-sidebar p-6">
                <h2 className="text-xl font-bold text-primary">LMS</h2>
                <p className="text-xs text-muted-foreground">Quản lý học tập</p>
            </div>

            <nav className="flex flex-col gap-1 p-3">
                {menus.map((menu) => {
                    const Icon = menu.icon;
                    const hasChildren = menu.children?.length > 0;
                    const active = isMenuActive(location, menu);
                    const open = openMenus[menu.path] || active;

                    return (
                        <div key={menu.path} className="space-y-1">
                            {hasChildren ? (
                                <button
                                    type="button"
                                    onClick={() => toggleMenu(menu.path)}
                                    className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium transition-colors ${
                                        active
                                            ? 'bg-primary text-primary-foreground shadow-sm'
                                            : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                                    }`}
                                >
                                    <Icon className="size-4" />
                                    <span className="flex-1">{menu.title}</span>
                                    <ChevronDown className={`size-4 transition-transform ${open ? 'rotate-180' : ''}`} />
                                </button>
                            ) : (
                                <NavLink
                                    to={menu.path}
                                    className={({ isActive }) =>
                                        `flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                                            isActive
                                                ? 'bg-primary text-primary-foreground shadow-sm'
                                                : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                                        }`
                                    }
                                >
                                    <Icon className="size-4" />
                                    {menu.title}
                                </NavLink>
                            )}

                            {hasChildren && open ? (
                                <div className="ml-5 flex flex-col gap-1 border-l border-sidebar-border pl-2">
                                    {menu.children.map((child) => (
                                        <NavLink
                                            key={child.path}
                                            to={child.path}
                                            className={() =>
                                                `rounded-md px-3 py-1.5 text-sm transition-colors ${
                                                    `${location.pathname}${location.search}` === child.path
                                                        ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground'
                                                        : 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                                                }`
                                            }
                                        >
                                            {child.title}
                                        </NavLink>
                                    ))}
                                </div>
                            ) : null}
                        </div>
                    );
                })}
            </nav>
        </aside>
    );
}
