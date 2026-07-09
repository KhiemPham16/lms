import { useState } from 'react';

import { Button } from '~/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '~/components/ui/dialog';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Textarea } from '~/components/ui/textarea';

const emptyValue = (field) => field.defaultValue || '';

const buildInitialValues = (fields, initialValues) =>
    fields.reduce((values, field) => {
        values[field.name] = initialValues?.[field.name] ?? emptyValue(field);
        return values;
    }, {});

const isFullWidthField = (field, forceSingleColumn) =>
    forceSingleColumn || field.fullWidth || ['textarea', 'json'].includes(field.type);

export default function SimpleFormDialog({ open, onOpenChange, title, fields, initialValues, onSubmit, submitting }) {
    const [formValues, setFormValues] = useState({});
    const formKey = `${title}-${initialValues?.publicId || JSON.stringify(initialValues || {})}`;
    const wideForm = fields.length > 4 || fields.some((field) => field.type === 'json');
    const forceSingleColumn = fields.some((field) => field.type === 'json') || fields.length <= 8;
    const visibleFields = fields.filter((field) => !field.visibleWhen || field.visibleWhen(formValues));

    const handleSubmit = (event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        const payload = {};

        fields.forEach((field) => {
            if (field.visibleWhen && !field.visibleWhen(formValues)) return;
            const value = field.type === 'checkbox' ? formData.get(field.name) === 'on' : formData.get(field.name);
            if ((value === '' || value === null) && field.optional) return;
            if (field.type === 'json') {
                payload[field.name] = value ? JSON.parse(value) : undefined;
                return;
            }
            payload[field.name] =
                (field.type === 'number' || field.valueType === 'number') && value !== '' ? Number(value) : value;
        });

        onSubmit(payload);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className={`max-h-[90vh] overflow-hidden p-0 ${wideForm ? 'sm:max-w-4xl' : 'sm:max-w-lg'}`}>
                <DialogHeader className="px-6 pt-5">
                    <DialogTitle>{title}</DialogTitle>
                </DialogHeader>

                <form
                    key={formKey}
                    className="flex min-h-0 flex-col"
                    onSubmit={handleSubmit}
                    ref={(node) => {
                        if (node && node.dataset.formKey !== formKey) {
                            node.dataset.formKey = formKey;
                            setFormValues(buildInitialValues(fields, initialValues));
                        }
                    }}
                >
                    <div
                        className={`grid max-h-[calc(90vh-8.5rem)] min-h-0 gap-4 overflow-y-auto px-6 pb-6 ${
                            forceSingleColumn ? '' : 'md:grid-cols-2'
                        }`}
                    >
                        {visibleFields.map((field) => {
                            const defaultValue = initialValues?.[field.name] ?? emptyValue(field);
                            const handleChange = (event) => {
                                const nextValue = field.type === 'checkbox' ? event.target.checked : event.target.value;
                                setFormValues((current) => ({ ...current, [field.name]: nextValue }));
                            };

                            return (
                                <div
                                    key={field.name}
                                    className={`space-y-1.5 ${
                                        isFullWidthField(field, forceSingleColumn) ? 'md:col-span-2' : ''
                                    }`}
                                >
                                    <Label htmlFor={field.name}>{field.label}</Label>
                                    {field.type === 'textarea' || field.type === 'json' ? (
                                        <Textarea
                                            id={field.name}
                                            name={field.name}
                                            defaultValue={
                                                field.type === 'json' && defaultValue && typeof defaultValue !== 'string'
                                                    ? JSON.stringify(defaultValue, null, 2)
                                                    : defaultValue
                                            }
                                            placeholder={field.placeholder}
                                            required={!field.optional}
                                            className={
                                                field.type === 'json'
                                                    ? 'max-h-72 min-h-48 overflow-auto font-mono text-xs'
                                                    : 'min-h-24'
                                            }
                                            onChange={handleChange}
                                        />
                                    ) : field.type === 'checkbox' ? (
                                        <div className="flex h-9 items-center">
                                            <Input
                                                id={field.name}
                                                name={field.name}
                                                type="checkbox"
                                                defaultChecked={Boolean(defaultValue)}
                                                className="size-4"
                                                onChange={handleChange}
                                            />
                                        </div>
                                    ) : field.type === 'select' ? (
                                        <select
                                            id={field.name}
                                            name={field.name}
                                            defaultValue={
                                                defaultValue === undefined || defaultValue === null
                                                    ? ''
                                                    : String(defaultValue)
                                            }
                                            required={!field.optional}
                                            disabled={field.disabled}
                                            className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
                                            onChange={handleChange}
                                        >
                                            <option value="" disabled={!field.optional}>
                                                {field.placeholder || `Chọn ${field.label.toLowerCase()}`}
                                            </option>
                                            {(field.options || []).map((option) => (
                                                <option key={option.value} value={option.value}>
                                                    {option.label}
                                                </option>
                                            ))}
                                        </select>
                                    ) : (
                                        <Input
                                            id={field.name}
                                            name={field.name}
                                            type={field.type || 'text'}
                                            defaultValue={defaultValue}
                                            required={!field.optional}
                                            onChange={handleChange}
                                        />
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    <div className="flex justify-end gap-3 border-t bg-muted/30 px-6 py-5">
                        <Button
                            type="button"
                            variant="outline"
                            className="h-10 min-w-28"
                            onClick={() => onOpenChange(false)}
                        >
                            Hủy
                        </Button>
                        <Button type="submit" className="h-10 min-w-28" disabled={submitting}>
                            Lưu
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
