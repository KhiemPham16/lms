import { z } from 'zod';

const loginSchema = z.object({
    email: z.string().trim().email('Email không hợp lệ'),

    password: z.string().min(1, 'Mật khẩu không được để trống')
});

export default loginSchema;
