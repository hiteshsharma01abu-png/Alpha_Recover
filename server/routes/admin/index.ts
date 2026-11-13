import { Hono } from 'hono';
import { requireStaffAny } from '../../auth/middleware';
import type { AppEnv } from '../../types';
import { adminDashboardRoutes } from './dashboard';
import { adminLeadRoutes } from './leads';
import { adminMeRoutes } from './me';

/**
 * /api/v1/admin/* — every route here requires a signed-in, active staff account (baseline), and each
 * route adds its own requireStaff('<module>.<action>') check (docs/admin/AUTH_AND_RBAC.md §4).
 * Routes open to any staff role (me, dashboard) filter their own data by permission.
 */
export const adminRoutes = new Hono<AppEnv>()
  .use('*', requireStaffAny())
  .route('/', adminMeRoutes)
  .route('/', adminDashboardRoutes)
  .route('/', adminLeadRoutes);
