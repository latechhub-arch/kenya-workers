import { ForbiddenException } from '@nestjs/common';
import { AuthenticatedUser } from './auth.types';

export function organizationIdsForPermission(
  user: AuthenticatedUser,
  permission: string,
): string[] | null {
  if (user.globalPermissionCodes.includes(permission)) return null;
  return Object.entries(user.organizationPermissions)
    .filter(([, permissions]) => permissions.includes(permission))
    .map(([organizationId]) => organizationId);
}

export function assertOrganizationPermission(
  user: AuthenticatedUser,
  organizationId: string,
  permission: string,
) {
  if (
    user.globalPermissionCodes.includes(permission) ||
    user.organizationPermissions[organizationId]?.includes(permission)
  ) {
    return;
  }
  throw new ForbiddenException('You do not have access to this organization');
}

export function assertSomeOrganizationPermission(
  user: AuthenticatedUser,
  permission: string,
) {
  if (
    user.globalPermissionCodes.includes(permission) ||
    Object.values(user.organizationPermissions).some((permissions) =>
      permissions.includes(permission),
    )
  ) {
    return;
  }
  throw new ForbiddenException('You do not have permission to perform this action');
}
