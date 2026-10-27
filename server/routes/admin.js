import express from 'express';
import {
  createAppAlert,
  dismissAppAlert,
  getAdminChatMessages,
  getAdminOverview,
  getPendingAlerts,
  updateUserApproval,
  updateUserRole,
} from '../controllers/admin.js';
import { Admin, Auth, Owner } from '../middleware/user.js';

const router = express.Router();

router.get('/', Auth, Admin, getAdminOverview);
router.get('/chats/:chatId/messages', Auth, Admin, getAdminChatMessages);
router.post('/alerts', Auth, Admin, createAppAlert);
router.get('/alerts/pending', Auth, getPendingAlerts);
router.post('/alerts/:alertId/dismiss', Auth, dismissAppAlert);
router.patch('/users/:userId/role', Auth, Owner, updateUserRole);
router.patch('/users/:userId/approval', Auth, Owner, updateUserApproval);

export default router;
