import express from 'express';
import * as authController from '../controllers/auth.controller';
import { ensureAuthenticated } from '../middleware/auth';
import { rateLimiter } from '../middleware/rateLimiter';

const router = express.Router();

router.post('/signup', rateLimiter, authController.signup);
router.post('/verify-email', rateLimiter, authController.verifyEmail);
router.post('/login', rateLimiter, authController.login);
router.post('/logout', ensureAuthenticated, authController.logout);
router.post('/logout-all', ensureAuthenticated, authController.logoutAll);
router.get('/me', ensureAuthenticated, authController.me);
router.post('/forgot-password', rateLimiter, authController.forgotPassword);
router.post('/reset-password', rateLimiter, authController.resetPassword);
router.post('/change-password', ensureAuthenticated, authController.changePassword);

export default router;
