import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { PrismaService } from '~/prisma/prisma.service';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { AuthenticatedRequest } from './jwt-auth.guard';

@Injectable()
export class PermissionsGuard implements CanActivate {
    constructor(
        private readonly reflector: Reflector,
        private readonly prisma: PrismaService
    ) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
            context.getHandler(),
            context.getClass()
        ]);

        if (!requiredPermissions || requiredPermissions.length === 0) {
            return true;
        }

        const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

        const user = await this.prisma.user.findFirst({
            where: {
                publicId: request.user?.sub,
                deletedAt: null
            },
            select: {
                roleId: true,
                role: {
                    select: {
                        code: true,
                        permissions: {
                            select: {
                                permission: {
                                    select: {
                                        code: true
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });

        if (!user) {
            throw new ForbiddenException('Không có quyền truy cập');
        }

        const grantedPermissions = user.role.permissions.map((item) => item.permission.code);
        const hasPermission = requiredPermissions.every((permission) => grantedPermissions.includes(permission));

        if (!hasPermission) {
            throw new ForbiddenException('Bạn không có quyền thực hiện thao tác này');
        }

        request.user = {
            ...request.user,
            roleId: user.roleId,
            role: user.role.code,
            permissions: grantedPermissions
        };

        return true;
    }
}
