import { Hono } from 'hono';
import { requireStaffAny } from '../../auth/middleware';
import type { AppEnv } from '../../types';
import { adminActivityRoutes } from './activity';
import { adminBlogRoutes } from './blog';
import { adminCertificateRoutes } from './certificates';
import { adminCourseRoutes } from './courses';
import { adminDashboardRoutes } from './dashboard';
import { adminDemoVideoRoutes } from './demoVideos';
import { adminEnrollmentRoutes } from './enrollments';
import { adminLeadRoutes } from './leads';
import { adminMeRoutes } from './me';
import { adminNotificationRoutes } from './notifications';
import { adminPlanRoutes } from './plans';
import { adminReportRoutes } from './reports';
import { adminSettingsRoutes } from './settings';
import { adminStudentRoutes } from './students';
import { adminTeamRoutes } from './team';

/**
 * /api/v1/admin/* — every route here requires a signed-in, active staff account (baseline), and each
 * route adds its own requireStaff('<module>.<action>') check (docs/admin/AUTH_AND_RBAC.md §4).
 * Routes open to any staff role (me, dashboard) filter their own data by permission.
 */
export const adminRoutes = new Hono<AppEnv>()
  .use('*', requireStaffAny())
  .route('/', adminMeRoutes)
  .route('/', adminDashboardRoutes)
  .route('/', adminLeadRoutes)
  .route('/', adminStudentRoutes)
  .route('/', adminEnrollmentRoutes)
  .route('/', adminPlanRoutes)
  .route('/', adminDemoVideoRoutes)
  .route('/', adminBlogRoutes)
  .route('/', adminCourseRoutes)
  .route('/', adminCertificateRoutes)
  .route('/', adminSettingsRoutes)
  .route('/', adminNotificationRoutes)
  .route('/', adminReportRoutes)
  .route('/', adminTeamRoutes)
  .route('/', adminActivityRoutes);
