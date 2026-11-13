/** Re-export: the matrix lives in shared/permissions.ts so the admin UI uses the exact same rules. */
export {
  can,
  canManageRoles,
  isStaff,
  PERMISSIONS,
  permissionsFor,
  REFUND_LIMITS,
  ROLE_LABELS,
  type Permission,
} from '../../shared/permissions';
