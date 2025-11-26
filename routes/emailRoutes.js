import express from 'express';
import { sendEmail, sendTestEmail } from '../controllers/emailController.js';

const router = express.Router();

router.post('/', sendEmail);
router.get('/test', sendTestEmail);

export default router;