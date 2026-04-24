import { Router } from 'express';
import { getTemplates, createTemplate, updateTemplate, getLogs, retrySms } from '../controllers/sms.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.get('/templates', authenticate, getTemplates);
router.post('/templates', authenticate, createTemplate);
router.put('/templates/:id', authenticate, updateTemplate);
router.get('/logs', authenticate, getLogs);
router.post('/retry/:id', authenticate, retrySms);

export default router;
