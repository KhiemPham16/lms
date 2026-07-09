import { z } from 'zod';

const optionalTrimmedString = z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    z.string().trim().optional()
);

const createUserSchema = z.object({
    code: optionalTrimmedString,

    fullName: z.string().trim().min(1, 'Vui lòng nhập họ tên'),

    email: z.email('Email không hợp lệ'),

    phone: optionalTrimmedString,

    password: z.preprocess(
        (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
        z
            .string()
            .min(6, 'Mật khẩu tối thiểu 6 ký tự')
            .regex(/[A-Z]/, 'Mật khẩu phải có ít nhất 1 chữ hoa')
            .regex(/[^A-Za-z0-9]/, 'Mật khẩu phải có ít nhất 1 ký tự đặc biệt')
            .optional()
    ),

    roleId: z.string().min(1, 'Vui lòng chọn vai trò'),

    status: z.enum(['ACTIVE', 'PENDING', 'INACTIVE', 'LOCKED']).optional(),

    gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),

    avatarUrl: optionalTrimmedString,

    dateOfBirth: optionalTrimmedString,

    address: optionalTrimmedString,

    departmentId: z.string().optional(),

    cohortYear: z.preprocess(
        (value) => (typeof value === 'string' && value.trim() === '' ? undefined : Number(value)),
        z
            .number()
            .int('Năm khóa phải là số nguyên')
            .min(2000, 'Năm khóa từ 2000')
            .max(2099, 'Năm khóa đến 2099')
            .optional()
    )
});

export default createUserSchema;
