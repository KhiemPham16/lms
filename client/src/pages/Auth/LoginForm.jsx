import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { Button } from '~/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';

import useLogin from '~/hooks/useLogin';
import loginSchema from '~/validators/login.validator';

export default function LoginForm() {
    const login = useLogin();

    const {
        register,
        handleSubmit,
        formState: { errors }
    } = useForm({
        resolver: zodResolver(loginSchema),
        defaultValues: {
            email: '',
            password: ''
        }
    });

    const onSubmit = (values) => {
        login.mutate(values);
    };

    return (
        <Card className="w-full max-w-md shadow-lg">
            <CardHeader className="space-y-2">
                <CardTitle className="text-2xl">Đăng nhập</CardTitle>
                <CardDescription>Đăng nhập vào hệ thống LMS</CardDescription>
            </CardHeader>

            <CardContent>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                    <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input id="email" type="email" placeholder="example@lms.com" {...register('email')} />
                        {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="password">Mật khẩu</Label>
                        <Input id="password" type="password" placeholder="********" {...register('password')} />
                        {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
                    </div>

                    <Button type="submit" className="w-full" disabled={login.isPending}>
                        {login.isPending ? 'Đang đăng nhập...' : 'Đăng nhập'}
                    </Button>
                </form>
            </CardContent>
        </Card>
    );
}
