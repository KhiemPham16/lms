import { ChevronLeft, ChevronRight } from 'lucide-react';

import { Button } from '~/components/ui/button';

export default function Pagination({ page, totalPages, onPageChange }) {
    return (
        <div className="flex items-center justify-end gap-2">
            <Button variant="outline" size="icon" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
                <ChevronLeft className="size-4" />
            </Button>

            <span className="text-sm">
                Trang {page} / {totalPages}
            </span>

            <Button variant="outline" size="icon" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
                <ChevronRight className="size-4" />
            </Button>
        </div>
    );
}
