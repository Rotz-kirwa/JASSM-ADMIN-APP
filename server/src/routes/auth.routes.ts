import { Router } from 'express';
import { login, register, getMe } from '../controllers/auth.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

router.post('/login', login);
router.post('/register', authenticate, authorize(['SUPER_ADMIN']), register);
router.get('/me', authenticate, getMe);

export default router;
