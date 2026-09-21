import express from 'express';
import { addConnection, testConnection, syncNow, listMailboxes } from '../controllers/mailwizzController';
import { requireAuth } from '../middleware/auth';

const router = express.Router();

router.post('/', requireAuth, addConnection);
router.post('/test', requireAuth, testConnection);
router.post('/:connectionId/sync', requireAuth, syncNow);
router.get('/mailboxes', requireAuth, listMailboxes);

export default router;
