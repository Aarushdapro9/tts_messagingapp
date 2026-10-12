import express from 'express';
import { getAdminChatMessages, getAdminOverview } from '../controllers/admin.js';
import { Admin, Auth } from '../middleware/user.js';

const router = express.Router();

router.get('/', Auth, Admin, getAdminOverview);
router.get('/chats/:chatId/messages', Auth, Admin, getAdminChatMessages);

export default router;
