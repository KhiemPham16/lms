import { Plus, Search } from 'lucide-react';

import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';

export default function UserToolbar({ search, onSearchChange, onCreate }) {
    return (
        <div className="flex items-center justify-between">
            <div className="relative w-80">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

                <Input
                    value={search}
                    onChange={(event) => onSearchChange(event.target.value)}
                    className="pl-9"
                    placeholder="Tìm theo tên hoặc email..."
                />
            </div>

            <Button onClick={onCreate}>
                <Plus className="mr-2 h-4 w-4" />
                Thêm người dùng
            </Button>
        </div>
    );
}
