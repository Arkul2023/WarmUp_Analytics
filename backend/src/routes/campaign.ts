import {
  Router,
} from 'express';

import {
  getCampaigns,
  getCampaign,
  campaignStats,
  campaignEvents,
} from '../controllers/campaign.controller';

import {
  requireAuth,
} from '../middleware/auth';

const router =
  Router();

router.use(
  requireAuth
);

router.get(
  '/',
  getCampaigns
);

router.get(
  '/:campaignId',
  getCampaign
);

router.get(
  '/:campaignId/stats',
  campaignStats
);

router.get(
  '/:campaignId/events',
  campaignEvents
);

export default router;