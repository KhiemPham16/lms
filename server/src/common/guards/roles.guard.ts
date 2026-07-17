import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { ROLES_KEY } from '../decorators/roles.decorator';
import { ADMIN_ONLY_KEY } from '../decorators/admin-only.decorator';
import type { AuthenticatedRequest } from './jwt-auth.guard';
import { UserRole } from '@prisma/client';

@Injectable()
export class RolesGuard implements CanActivate {
    constructor(private readonly reflector: Reflector) {}

    canActivate(context: ExecutionContext) {
        const allowedRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
            context.getHandler(),
            context.getClass()
        ]);
        const { user } = context.switchToHttp().getRequest<AuthenticatedRequest>();
        const adminOnly = this.reflector.getAllAndOverride<boolean>(ADMIN_ONLY_KEY, [
            context.getHandler(),
            context.getClass()
        ]);
        if (adminOnly) {
            if (user?.role === UserRole.ADMIN) return true;
            throw new ForbiddenException('Chỉ quản trị viên được thực hiện thao tác này');
        }

        if (!allowedRoles?.length) return true;
        if (user?.role === UserRole.ADMIN || user?.role === UserRole.PRINCIPAL) return true;
        if (!user || !allowedRoles.includes(user.role)) {
            throw new ForbiddenException('Bạn không có quyền thực hiện thao tác này');
        }
        return true;
    }
}
