import { Router } from 'express';
import { getPayments, triggerStkPush, handleCallback, getSummary, getReports } from '../controllers/payment.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.get('/', authenticate, getPayments);
router.get('/summary', authenticate, getSummary);
router.get('/reports', authenticate, getReports);
router.post('/stk-push', authenticate, triggerStkPush);
router.post('/callback', handleCallback); // Public callback endpoint

export default router;
