import type { ActivityEntry } from '../../lib/adminApi';

/** Plain-English names for the actions the API logs; unknown ones fall back to the raw code. */
const LABELS: Record<string, string> = {
  'auth.register': 'Created an account',
  'auth.login': 'Signed in',
  'auth.login_failed': 'Failed sign-in',
  'auth.logout_all': 'Signed out everywhere',
  'auth.password_change': 'Changed password',
  'auth.password_reset': 'Reset password',
  'auth.session_revoke': 'Signed out a device',
  'user.update_profile': 'Updated their own profile',
  'leads.update': 'Updated a lead',
  'leads.note': 'Added a lead note',
  'leads.export': 'Exported leads',
  'students.update': "Edited a student's profile",
  'students.suspend': 'Suspended a student',
  'students.unsuspend': 'Reactivated a student',
  'students.sessions_revoke': 'Signed a student out everywhere',
  'students.password_reset': 'Sent a student a reset link',
  'team.invite': 'Invited a team member',
  'team.invite_resend': 'Resent an invite',
  'team.create': 'Created a staff account (command line)',
  'team.role_change': "Changed someone's role",
  'team.remove': 'Removed admin access',
  'team.deactivate': 'Deactivated a team member',
  'team.reactivate': 'Reactivated a team member',
  'audit.export': 'Exported the activity log',
};

export const actionLabel = (action: string) => LABELS[action] ?? action;

/** Where an entry's subject lives in the admin, if it has a page. */
export function entityLink(e: ActivityEntry): string | null {
  if (!e.entityId) return null;
  if (e.entityType === 'lead') return `/admin/leads?lead=${e.entityId}`;
  if (e.entityType === 'user') return e.action.startsWith('team.') ? '/admin/team' : `/admin/students/${e.entityId}`;
  return null;
}
