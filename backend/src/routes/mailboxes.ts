import { Router } from 'express';

import {
  getMailboxes,
  getMailboxSummary,
  getMailbox,
  patchMailbox,
} from '../controllers/mailbox.controller';

import { requireAuth } from '../middleware/auth';

const router = Router();

router.use(requireAuth);

/*
 * IMPORTANT:
 * /summary MUST come before /:mailboxId
 */

router.get(
  '/',
  getMailboxes
);

router.get(
  '/summary',
  getMailboxSummary
);

router.get(
  '/:mailboxId',
  getMailbox
);

router.patch(
  '/:mailboxId',
  patchMailbox
);

export default router;