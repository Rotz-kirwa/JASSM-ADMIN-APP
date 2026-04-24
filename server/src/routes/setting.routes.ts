import { Router } from 'express';
import { getSettings, updateSetting } from '../controllers/setting.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

router.get('/', authenticate, getSettings);
router.put('/', authenticate, authorize(['SUPER_ADMIN']), updateSetting);

export default router;
