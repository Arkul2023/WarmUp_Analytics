import {
  Router,
} from 'express';

import {
  dashboardSummary,
  dashboardCampaigns,
} from '../controllers/dashboard.controller';

import {
  requireAuth,
} from '../middleware/auth';

import { proxyToWorker } from './worker';

const router =
  Router();

router.post(
  '/reset',
  (req, res) => proxyToWorker(req, res, '/api/dashboard/reset')
);

router.get(
  '/summary',
  dashboardSummary
);

router.get(
  '/campaigns',
  dashboardCampaigns
);

router.use(
  requireAuth
);

export default router;