import { Request } from 'express';

export interface AuthenticatedUser {
  id: string;
  personId: string | null;
  email: string;
  fullName: string;
  roleCodes: string[];
  permissionCodes: string[];
  globalPermissionCodes: string[];
  organizationPermissions: Record<string, string[]>;
  organizationIds: string[];
  sessionId: string;
  tokenHash: string;
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}
