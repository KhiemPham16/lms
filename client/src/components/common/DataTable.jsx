import { MoreHorizontal } from 'lucide-react';

import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Card, CardContent } from '~/components/ui/card';
import { Checkbox } from '~/components/ui/checkbox';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from '~/components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '~/components/ui/table';

const statusVariant = (value) => {
    const normalized = String(value || '').toLowerCase();
    if (['active', 'approved', 'published', 'open', 'completed', 'read'].includes(normalized)) return 'default';
    if (['locked', 'rejected', 'cancelled', 'closed', 'failed'].includes(normalized)) return 'destructive';
    return 'secondary';
};

const defaultGetRowId = (row) => row.publicId || row.id || row.code || row.title;

function renderCell(row, column) {
    const value = column.render ? column.render(row) : row[column.key];
    if (value === undefined || value === null || value === '') return <span className="text-muted-foreground">-</span>;
    if (column.badge) return <Badge variant={statusVariant(value)}>{String(value)}</Badge>;
    return value;
}

function renderActionLabel(action, row) {
    return typeof action.label === 'function' ? action.label(row) : action.label;
}

function ActionMenu({ row, actions }) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label="Mở thao tác">
                    <MoreHorizontal className="size-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
                {actions.map((action) => {
                    const label = renderActionLabel(action, row);
                    const variant = typeof action.variant === 'function' ? action.variant(row) : action.variant;

                    return (
                        <DropdownMenuItem
                            key={label}
                            variant={variant === 'destructive' ? 'destructive' : 'default'}
                            disabled={action.disabled?.(row)}
                            onClick={() => action.onClick(row)}
                        >
                            {label}
                        </DropdownMenuItem>
                    );
                })}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

export default function DataTable({
    columns,
    rows,
    loading,
    actions = [],
    renderActions,
    selectable = false,
    selectedIds = [],
    onToggleRow,
    onTogglePage,
    getRowId = defaultGetRowId,
    canSelectRow = () => true
}) {
    const hasActions = Boolean(renderActions) || actions.length > 0;
    const selectableRows = selectable ? rows.filter((row) => canSelectRow(row)) : [];
    const selectableIds = selectableRows.map((row) => getRowId(row));
    const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selectedIds.includes(id));
    const someSelected = selectableIds.some((id) => selectedIds.includes(id));
    const extraColumns = (selectable ? 1 : 0) + (hasActions ? 1 : 0);

    return (
        <Card className="rounded-lg py-0">
            <CardContent className="p-0">
                <Table>
                    <TableHeader>
                        <TableRow>
                            {selectable ? (
                                <TableHead className="w-10">
                                    <Checkbox
                                        checked={allSelected || (someSelected ? 'indeterminate' : false)}
                                        disabled={selectableIds.length === 0}
                                        onCheckedChange={() => onTogglePage?.(selectableIds)}
                                        aria-label="Chọn tất cả"
                                    />
                                </TableHead>
                            ) : null}
                            {columns.map((column) => (
                                <TableHead key={column.key}>{column.label}</TableHead>
                            ))}
                            {hasActions ? <TableHead className="w-20 text-right">Thao tac</TableHead> : null}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={columns.length + extraColumns} className="h-24 text-center">
                                    Đang tải dữ liệu...
                                </TableCell>
                            </TableRow>
                        ) : null}

                        {!loading && rows.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={columns.length + extraColumns} className="h-24 text-center">
                                    Chưa có dữ liệu
                                </TableCell>
                            </TableRow>
                        ) : null}

                        {!loading
                            ? rows.map((row) => {
                                  const rowId = getRowId(row);
                                  const rowActions = actions.filter((action) => !action.hidden?.(row));
                                  return (
                                      <TableRow key={rowId}>
                                          {selectable ? (
                                              <TableCell>
                                                  <Checkbox
                                                      checked={selectedIds.includes(rowId)}
                                                      disabled={!canSelectRow(row)}
                                                      onCheckedChange={() => onToggleRow?.(rowId)}
                                                      aria-label={`Chọn ${rowId}`}
                                                  />
                                              </TableCell>
                                          ) : null}
                                          {columns.map((column) => (
                                              <TableCell key={column.key}>{renderCell(row, column)}</TableCell>
                                          ))}
                                          {hasActions ? (
                                              <TableCell className="text-right">
                                                  {renderActions ? (
                                                      renderActions(row)
                                                  ) : (
                                                      <div className="flex justify-end">
                                                          <ActionMenu row={row} actions={rowActions} />
                                                      </div>
                                                  )}
                                              </TableCell>
                                          ) : null}
                                      </TableRow>
                                  );
                              })
                            : null}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
