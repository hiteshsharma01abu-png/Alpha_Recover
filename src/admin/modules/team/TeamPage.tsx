import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { ROLE_LABELS, USER_ROLES, isStaff } from '../../../../shared/permissions';
import type { UserRole } from '../../../../shared/permissions';
import { ApiError } from '../../../lib/api';
import { useAdminSession } from '../../auth/adminSessionContext';
import { StatusBadge } from '../../components/DataTable';
import { Dialog } from '../../components/Dialog';
import { EmptyState, ErrorState, Skeleton } from '../../components/States';
import { adminApi } from '../../lib/adminApi';
import type { TeamMember } from '../../lib/adminApi';
import { ago, formatIst } from '../../lib/format';
import { useResource } from '../../lib/useResource';
import './Team.css';

const STAFF_ROLES = USER_ROLES.filter(isStaff);
const ROLE_HINT: Record<string, string> = {
  super_admin: 'Everything, including the team and roles',
  admin: 'All modules; views the team; refunds up to ₹5,000',
  finance_manager: 'Orders, refunds, plans and revenue reports',
  content_manager: 'Courses, demo videos and the blog',
  support_manager: 'Leads, student accounts, orders (view)',
};

export function TeamTabs() {
  return (
    <nav className="adm-tabs" aria-label="Team sections">
      <NavLink to="/admin/team" end>
        Members
      </NavLink>
      <NavLink to="/admin/team/roles">Roles &amp; permissions</NavLink>
    </nav>
  );
}

const errText = (err: unknown) => (err instanceof ApiError ? err.message : 'That didn’t work. Please try again.');

/** /admin/team — staff accounts: invite, change role, deactivate. Only Super Admins can change anything. */
export function TeamPage() {
  const { me, can } = useAdminSession();
  const team = useResource('team', adminApi.team.list);
  const [inviting, setInviting] = useState(false);
  const [managing, setManaging] = useState<TeamMember | null>(null);
  const [notice, setNotice] = useState('');
  const canManage = can('team.add') || can('team.edit') || can('team.manage_roles');

  return (
    <div>
      <TeamTabs />
      <div className="adm-team-bar">
        <p className="adm-muted">
          {canManage ? 'Invite people, change roles, or remove access. Changes sign the person out so new permissions apply.' : 'You can see the team. Only a Super Admin can make changes.'}
        </p>
        {can('team.add') ? (
          <button type="button" className="adm-btn adm-btn-primary" onClick={() => setInviting(true)}>
            + Invite team member
          </button>
        ) : null}
      </div>
      {notice ? (
        <p className="adm-notice" role="status">
          {notice}
        </p>
      ) : null}

      {team.error && !team.data ? (
        <ErrorState message="The team could not be loaded." requestId={team.error.requestId} onRetry={team.reload} />
      ) : !team.data ? (
        <Skeleton height={260} />
      ) : team.data.length === 0 ? (
        <EmptyState>
          <p>No team members yet.</p>
        </EmptyState>
      ) : (
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th scope="col">Member</th>
                <th scope="col">Role</th>
                <th scope="col">Status</th>
                <th scope="col">Last sign-in</th>
                <th scope="col">Devices</th>
                {canManage ? <th scope="col">{''}</th> : null}
              </tr>
            </thead>
            <tbody className="adm-static-rows">
              {team.data.map((m) => (
                <tr key={m.id}>
                  <td data-label="Member">
                    <span className="adm-member">
                      <span className="adm-avatar adm-avatar-sm" aria-hidden>
                        {m.firstName.charAt(0).toUpperCase()}
                      </span>
                      <span>
                        <strong>
                          {[m.firstName, m.lastName].filter(Boolean).join(' ')}
                          {m.id === me?.user.id ? <span className="adm-muted"> (you)</span> : null}
                        </strong>
                        <span className="adm-sub">{m.email}</span>
                      </span>
                    </span>
                  </td>
                  <td data-label="Role">
                    <span className={`adm-role adm-role--${m.role}`}>{m.roleLabel}</span>
                  </td>
                  <td data-label="Status">
                    {m.status === 'suspended' ? (
                      <StatusBadge tone="danger">Deactivated</StatusBadge>
                    ) : m.invitePending ? (
                      <StatusBadge tone="warning">Invite pending</StatusBadge>
                    ) : (
                      <StatusBadge tone="success">Active</StatusBadge>
                    )}
                  </td>
                  <td data-label="Last sign-in">
                    {m.lastLoginAt ? <time title={formatIst(m.lastLoginAt)}>{ago(m.lastLoginAt)}</time> : <span className="adm-muted">Never</span>}
                  </td>
                  <td data-label="Devices">{m.sessions}</td>
                  {canManage ? (
                    <td data-label="" className="adm-td-actions">
                      {m.id !== me?.user.id ? (
                        <button type="button" className="adm-btn" onClick={() => setManaging(m)}>
                          Manage
                        </button>
                      ) : null}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <InviteDialog
        open={inviting}
        onClose={() => setInviting(false)}
        onDone={(text) => {
          setInviting(false);
          setNotice(text);
          team.reload();
        }}
      />
      {managing ? (
        <ManageDialog
          key={managing.id}
          member={managing}
          onClose={() => setManaging(null)}
          onDone={(text) => {
            setManaging(null);
            setNotice(text);
            team.reload();
          }}
        />
      ) : null}
    </div>
  );
}

function InviteDialog({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: (notice: string) => void }) {
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [role, setRole] = useState<UserRole>('support_manager');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = () => {
    setBusy(true);
    setError('');
    adminApi.team
      .invite({ email, firstName, role })
      .then(
        (r) => {
          setEmail('');
          setFirstName('');
          onDone(
            r.action === 'promoted'
              ? `${email} already had a student account. It's now ${ROLE_LABELS[role]}; they sign in with their existing password.`
              : `Invite sent to ${email}. The link to set a password is valid for 3 days.`,
          );
        },
        (err: unknown) => setError(errText(err)),
      )
      .finally(() => setBusy(false));
  };

  return (
    <Dialog open={open} title="Invite a team member" confirmLabel="Send invite" busy={busy} error={error} onConfirm={submit} onCancel={onClose}>
      <label>
        Email
        <input type="email" required autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <label>
        First name
        <input required maxLength={80} value={firstName} onChange={(e) => setFirstName(e.target.value)} />
      </label>
      <label>
        Role
        <select value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
          {STAFF_ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
      </label>
      <p className="adm-small">{ROLE_HINT[role]}</p>
    </Dialog>
  );
}

function ManageDialog({ member, onClose, onDone }: { member: TeamMember; onClose: () => void; onDone: (notice: string) => void }) {
  const { can } = useAdminSession();
  const [role, setRole] = useState<UserRole>(member.role);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const run = (task: () => Promise<unknown>, notice: string) => {
    setBusy(true);
    setError('');
    task()
      .then(() => onDone(notice), (err: unknown) => setError(errText(err)))
      .finally(() => setBusy(false));
  };

  const saveRole = () => {
    if (role === member.role) return onClose();
    run(
      () => adminApi.team.setRole(member.id, role),
      role === 'student' ? `${member.firstName} no longer has admin access.` : `${member.firstName} is now ${ROLE_LABELS[role]}. They'll need to sign in again.`,
    );
  };

  return (
    <Dialog
      open
      title={`Manage ${member.firstName}`}
      confirmLabel={role === 'student' ? 'Remove admin access' : 'Save role'}
      tone={role === 'student' ? 'danger' : 'primary'}
      busy={busy}
      error={error}
      onConfirm={saveRole}
      onCancel={onClose}
    >
      <p>{member.email}</p>
      {can('team.manage_roles') ? (
        <label>
          Role
          <select value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
            {STAFF_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
            <option value="student">No admin access (back to a student account)</option>
          </select>
        </label>
      ) : null}
      <p className="adm-small">{role === 'student' ? 'They keep their website account but lose the admin panel.' : ROLE_HINT[role]}</p>
      <div className="adm-manage-actions">
        {member.invitePending && member.status === 'active' && can('team.add') ? (
          <button type="button" className="adm-btn" disabled={busy} onClick={() => run(() => adminApi.team.resendInvite(member.id), `New invite sent to ${member.email}.`)}>
            Resend invite
          </button>
        ) : null}
        {can('team.edit') ? (
          member.status === 'active' ? (
            <button
              type="button"
              className="adm-btn adm-btn-danger-outline"
              disabled={busy}
              onClick={() => run(() => adminApi.team.deactivate(member.id), `${member.firstName} is deactivated and signed out.`)}
            >
              Deactivate account
            </button>
          ) : (
            <button type="button" className="adm-btn" disabled={busy} onClick={() => run(() => adminApi.team.reactivate(member.id), `${member.firstName} can sign in again.`)}>
              Reactivate account
            </button>
          )
        ) : null}
      </div>
    </Dialog>
  );
}
