import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthenticatedRequest } from './auth.types';
import { REQUIRED_PERMISSIONS } from './require-permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext) {
    const required = this.reflector.getAllAndOverride<string[]>(REQUIRED_PERMISSIONS, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required?.length) {
      throw new ForbiddenException('This route has no access policy');
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const granted = new Set(request.user.permissionCodes);
    if (!required.every((permission) => granted.has(permission))) {
      throw new ForbiddenException('You do not have permission to perform this action');
    }
    return true;
  }
}
