import { Router } from 'express';
import { 
  getPayments, 
  triggerStkPush, 
  handleCallback, 
  getSummary, 
  getReports,
  handleC2BValidation,
  handleC2BConfirmation,
  registerC2B
} from '../controllers/payment.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

router.get('/', authenticate, getPayments);
router.get('/summary', authenticate, getSummary);
router.get('/reports', authenticate, getReports);
router.post('/stk-push', authenticate, triggerStkPush);
router.post('/callback', handleCallback); // Public callback endpoint

// C2B Endpoints
router.post('/c2b/validation', handleC2BValidation);
router.post('/c2b/confirmation', handleC2BConfirmation);
router.post('/c2b/register', authenticate, authorize(['SUPER_ADMIN']), registerC2B);

export default router;
