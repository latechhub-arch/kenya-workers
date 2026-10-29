export const AUTH_SESSION_HOURS = 8;

export const PERMISSIONS = [
  'organizations.read',
  'organizations.create',
  'organizations.status.update',
  'departments.read',
  'departments.create',
  'stations.read',
  'stations.create',
  'persons.read',
  'persons.create',
  'persons.status.update',
  'employments.read',
  'employments.create',
  'employments.status.update',
  'postings.read',
  'postings.create',
  'jobFrameworks.read',
  'jobFrameworks.create',
  'jobLevels.read',
  'jobLevels.create',
  'positions.read',
  'positions.create',
  'employmentPositions.read',
  'employmentPositions.assign',
  'users.read',
  'users.create',
  'users.manage',
  'employeeAccounts.invite',
  'audit.read',
  'compensation.read',
  'compensation.create',
  'compensation.update',
  'employmentCompensation.read',
  'employmentCompensation.assign',
  'payroll.read',
  'payroll.manage',
  'payroll.self.read',
  'pensions.read',
  'pensions.create',
  'pensions.manage',
  'pensions.review',
  'pensions.approve',
  'pensions.death.review',
] as const;

export type PermissionCode = (typeof PERMISSIONS)[number];

export const ROLE_DEFINITIONS: Record<
  string,
  { name: string; description: string; permissions: PermissionCode[] }
> = {
  SYSTEM_ADMIN: {
    name: 'System Administrator',
    description: 'Full access to configure and administer the system.',
    permissions: [...PERMISSIONS],
  },
  HR_ADMIN: {
    name: 'HR Administrator',
    description: 'Manage workforce records within assigned organizations.',
    permissions: PERMISSIONS.filter(
      (permission) =>
        !permission.startsWith('users.') && permission !== 'audit.read',
    ),
  },
  HR_OFFICER: {
    name: 'HR Officer',
    description:
      'Create and read workforce records within assigned organizations.',
    permissions: [
      'organizations.read',
      'departments.read',
      'stations.read',
      'persons.read',
      'persons.create',
      'employments.read',
      'employments.create',
      'postings.read',
      'postings.create',
      'jobFrameworks.read',
      'jobLevels.read',
      'positions.read',
      'employmentPositions.read',
      'employmentPositions.assign',
      'employmentCompensation.read',
      'employeeAccounts.invite',
      'pensions.read',
      'pensions.create',
      'pensions.review',
    ],
  },
  AUDITOR: {
    name: 'Auditor',
    description: 'Read-only access to workforce and organizational records.',
    permissions: PERMISSIONS.filter(
      (permission) =>
        permission.endsWith('.read') && permission !== 'users.read',
    ),
  },
};
