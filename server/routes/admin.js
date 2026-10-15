import express from 'express';
import { getAdminChatMessages, getAdminOverview, updateUserRole } from '../controllers/admin.js';
import { Admin, Auth, Owner } from '../middleware/user.js';

const router = express.Router();

router.get('/', Auth, Admin, getAdminOverview);
router.get('/chats/:chatId/messages', Auth, Admin, getAdminChatMessages);
router.patch('/users/:userId/role', Auth, Owner, updateUserRole);

export default router;
