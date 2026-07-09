import { Search } from 'lucide-react';

import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';

export default function PageShell({ title, description, search, onSearchChange, actionLabel, onAction, extraActions, children }) {
    return (
        <div className="space-y-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                    <h1 className="text-2xl font-semibold tracking-normal">{title}</h1>
                    {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
                </div>

                <div className="flex w-full flex-col gap-2 sm:flex-row md:w-auto">
                    {onSearchChange ? (
                        <div className="relative sm:w-72">
                            <Search className="pointer-events-none absolute left-2.5 top-2 size-4 text-muted-foreground" />
                            <Input
                                value={search}
                                onChange={(event) => onSearchChange(event.target.value)}
                                placeholder="Tìm kiếm"
                                className="pl-8"
                            />
                        </div>
                    ) : null}

                    {extraActions}
                    {onAction ? <Button onClick={onAction}>{actionLabel || 'Thêm mới'}</Button> : null}
                </div>
            </div>

            {children}
        </div>
    );
}
