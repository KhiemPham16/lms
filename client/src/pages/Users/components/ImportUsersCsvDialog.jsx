import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { Button } from '~/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '~/components/ui/dialog';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import usersService from '~/services/users.service';

const numberFields = new Set(['roleId', 'departmentId', 'cohortYear']);
const requiredFields = ['fullName', 'email', 'role'];

function detectDelimiter(headerLine) {
    return headerLine.includes('\t') ? '\t' : ',';
}

function parseCsvLine(line, delimiter) {
    const values = [];
    let current = '';
    let quoted = false;

    for (let index = 0; index < line.length; index += 1) {
        const char = line[index];
        const next = line[index + 1];

        if (char === '"' && quoted && next === '"') {
            current += '"';
            index += 1;
        } else if (char === '"') {
            quoted = !quoted;
        } else if (char === delimiter && !quoted) {
            values.push(current);
            current = '';
        } else {
            current += char;
        }
    }

    values.push(current);
    return values.map((value) => value.trim());
}

function normalizeDate(value) {
    if (!value) return value;
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

    const match = value.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (!match) return value;

    const first = Number(match[1]);
    const second = Number(match[2]);
    const year = Number(match[3]);
    const month = first > 12 ? second : first;
    const day = first > 12 ? first : second;
    const date = new Date(Date.UTC(year, month - 1, day));

    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
        return value;
    }

    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function normalizeValue(header, value) {
    if (numberFields.has(header)) return Number(value);
    if (header === 'dateOfBirth') return normalizeDate(value);
    return value;
}

function parseCsv(text) {
    const lines = text
        .replace(/^\uFEFF/, '')
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

    if (lines.length < 2) {
        return [];
    }

    const delimiter = detectDelimiter(lines[0]);
    const headers = parseCsvLine(lines[0], delimiter);

    return lines.slice(1).map((line) => {
        const values = parseCsvLine(line, delimiter);
        return headers.reduce((row, header, index) => {
            const value = values[index] ?? '';
            if (!header || value === '') return row;
            row[header] = normalizeValue(header, value);
            return row;
        }, {});
    });
}

function validateRows(rows) {
    return rows
        .map((row, index) => {
            const missing = requiredFields.filter((field) => !row[field]);
            return missing.length ? `Dòng ${index + 2}: thiếu ${missing.join(', ')}` : null;
        })
        .filter(Boolean);
}

export default function ImportUsersCsvDialog({ open, onOpenChange }) {
    const [file, setFile] = useState(null);
    const [importing, setImporting] = useState(false);
    const [errors, setErrors] = useState([]);
    const queryClient = useQueryClient();

    const fileName = useMemo(() => file?.name || 'Chưa chọn file', [file]);

    const handleOpenChange = (nextOpen) => {
        if (!nextOpen) {
            setFile(null);
            setErrors([]);
        }
        onOpenChange(nextOpen);
    };

    const handleImport = async () => {
        if (!file) {
            toast.error('Vui lòng chọn file CSV');
            return;
        }

        setImporting(true);
        setErrors([]);

        try {
            const text = await file.text();
            const rows = parseCsv(text);
            const validationErrors = validateRows(rows);

            if (!rows.length || validationErrors.length) {
                setErrors(validationErrors.length ? validationErrors : ['File CSV chưa có dữ liệu người dùng']);
                return;
            }

            const results = await Promise.allSettled(rows.map((row) => usersService.create(row)));
            const failed = results
                .map((result, index) => {
                    if (result.status === 'fulfilled') return null;
                    const message = result.reason?.response?.data?.message;
                    return `Dòng ${index + 2}: ${Array.isArray(message) ? message.join(', ') : message || 'Không thể tạo user'}`;
                })
                .filter(Boolean);
            const successCount = results.length - failed.length;

            if (successCount > 0) {
                await queryClient.invalidateQueries({ queryKey: ['users'] });
            }

            if (failed.length) {
                setErrors(failed.slice(0, 10));
                toast.warning(`Đã tạo ${successCount}/${rows.length} user`);
                return;
            }

            toast.success(`Đã tạo ${successCount} user từ CSV`);
            handleOpenChange(false);
        } finally {
            setImporting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle>Nhập người dùng từ CSV</DialogTitle>
                    <DialogDescription>
                        CSV cần có tối thiểu các cột fullName, email, role. Ngày sinh có thể nhập dạng YYYY-MM-DD hoặc dạng Excel như 1/15/2008.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="usersCsv">File CSV</Label>
                        <Input
                            id="usersCsv"
                            type="file"
                            accept=".csv,.tsv,text/csv,text/tab-separated-values"
                            onChange={(event) => {
                                setFile(event.target.files?.[0] ?? null);
                                setErrors([]);
                            }}
                        />
                        <p className="text-sm text-muted-foreground">{fileName}</p>
                    </div>

                    {errors.length ? (
                        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                            {errors.map((error) => (
                                <p key={error}>{error}</p>
                            ))}
                        </div>
                    ) : null}
                </div>

                <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                        Hủy
                    </Button>
                    <Button type="button" onClick={handleImport} disabled={importing}>
                        {importing ? 'Đang nhập...' : 'Nhập CSV'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
