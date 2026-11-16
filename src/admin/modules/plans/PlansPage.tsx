import { Link, useNavigate } from 'react-router-dom';
import { useAdminSession } from '../../auth/adminSessionContext';
import { StatusBadge } from '../../components/DataTable';
import { EmptyState, ErrorState, Skeleton } from '../../components/States';
import { adminApi } from '../../lib/adminApi';
import { formatInr, formatIst } from '../../lib/format';
import { useResource } from '../../lib/useResource';
import { PUBLISH_LABEL, PUBLISH_TONE, accessLabel } from './planDisplay';
import './Plans.css';

/** /admin/plans — every plan with the price the website shows right now and its next sale. */
export function PlansPage() {
  const { can } = useAdminSession();
  const navigate = useNavigate();
  const list = useResource('plans', adminApi.plans.list);
  const open = (id: string) => navigate(`/admin/plans/${id}`);

  return (
    <div>
      <div className="adm-plans-bar">
        <p className="adm-muted">Prices and sales update on the website within a minute of saving.</p>
        {can('plans.add') ? (
          <Link className="adm-btn adm-btn-primary" to="/admin/plans/new">
            + New plan
          </Link>
        ) : null}
      </div>

      {list.error && !list.data ? (
        <ErrorState message="Plans could not be loaded." requestId={list.error.requestId} onRetry={list.reload} />
      ) : !list.data ? (
        <Skeleton height={220} />
      ) : list.data.length === 0 ? (
        <EmptyState>
          <p>No plans yet.</p>
        </EmptyState>
      ) : (
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th scope="col">Plan</th>
                <th scope="col">Status</th>
                <th scope="col">Price now</th>
                <th scope="col">Sale</th>
                <th scope="col">Access</th>
                <th scope="col">Students</th>
              </tr>
            </thead>
            <tbody>
              {list.data.map((p) => (
                <tr
                  key={p.id}
                  tabIndex={0}
                  onClick={() => open(p.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') open(p.id);
                  }}
                >
                  <td data-label="Plan">
                    <strong>{p.name}</strong>
                    <span className="adm-sub">/{p.slug}</span>
                  </td>
                  <td data-label="Status">
                    <StatusBadge tone={PUBLISH_TONE[p.status]}>{PUBLISH_LABEL[p.status]}</StatusBadge>
                  </td>
                  <td data-label="Price now">
                    <strong>{formatInr(p.effectivePricePaise)}</strong>
                    {p.comparePricePaise ? (
                      <span className="adm-sub">
                        <s>{formatInr(p.comparePricePaise)}</s> · {p.discountPct}% off
                      </span>
                    ) : null}
                  </td>
                  <td data-label="Sale">
                    {p.promotion ? (
                      <>
                        <StatusBadge tone="success">{p.promotion.label}</StatusBadge>
                        <span className="adm-sub">ends {formatIst(p.promotion.endsAt)}</span>
                      </>
                    ) : p.nextPromotion ? (
                      <>
                        <StatusBadge tone="info">{p.nextPromotion.label}</StatusBadge>
                        <span className="adm-sub">starts {formatIst(p.nextPromotion.startsAt)}</span>
                      </>
                    ) : (
                      <span className="adm-muted">No sale</span>
                    )}
                  </td>
                  <td data-label="Access">
                    {accessLabel(p.accessDays)}
                    <span className="adm-sub">{p.grantsAllCourses ? 'All courses' : 'Selected courses'}</span>
                  </td>
                  <td data-label="Students">{p.activeEnrollments.toLocaleString('en-IN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
