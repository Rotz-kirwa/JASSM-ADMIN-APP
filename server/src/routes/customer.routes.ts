import { Router } from 'express';
import { getCustomers, getCustomerById } from '../controllers/customer.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.get('/', authenticate, getCustomers);
router.get('/:id', authenticate, getCustomerById);

export default router;
