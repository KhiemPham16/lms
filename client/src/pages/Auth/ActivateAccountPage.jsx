import { useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';

import { Button } from '~/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import authService from '~/services/auth.service';

export default function ActivateAccountPage() {
    const [params] = useSearchParams();
    const token = params.get('token');

    const activate = useMutation({
        mutationFn: authService.activate
    });

    useEffect(() => {
        if (token && !activate.isPending && !activate.isSuccess && !activate.isError) {
            activate.mutate(token);
        }
    }, [activate, token]);

    return (
        <div className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
            <Card className="w-full max-w-md shadow-lg">
                <CardHeader>
                    <CardTitle>Kích hoạt tài khoản</CardTitle>
                    <CardDescription>Hoàn tất kích hoạt tài khoản LMS của bạn.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {!token ? <p className="text-sm text-destructive">Liên kết kích hoạt không hợp lệ.</p> : null}
                    {activate.isPending ? <p className="text-sm text-muted-foreground">Đang kích hoạt tài khoản...</p> : null}
                    {activate.isSuccess ? <p className="text-sm text-emerald-600">{activate.data?.message}</p> : null}
                    {activate.isError ? (
                        <p className="text-sm text-destructive">
                            {activate.error?.response?.data?.message ?? 'Kích hoạt tài khoản thất bại'}
                        </p>
                    ) : null}
                    <Button asChild className="w-full">
                        <Link to="/auth/login">Về trang đăng nhập</Link>
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
