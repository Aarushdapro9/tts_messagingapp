import express from 'express';
import {
  createAppAlert,
  deleteUserAccount,
  dismissAppAlert,
  getAdminChatMessages,
  getAdminOverview,
  getPendingAlerts,
  updateUserApproval,
  updateUserRole,
  updateUserModeration,
  getAuditLogs,
  getReports,
  updateReport,
  createReport,
  getSystemSettings,
  updateSystemSettings,
  exportOwnerData,
  cancelGameAsAdmin,
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
router.delete('/users/:userId', Auth, Admin, deleteUserAccount);
router.patch('/users/:userId/moderation', Auth, Admin, updateUserModeration);
router.get('/reports', Auth, Admin, getReports);
router.patch('/reports/:reportId', Auth, Admin, updateReport);
router.get('/audit-logs', Auth, Admin, getAuditLogs);
router.post('/reports', Auth, createReport);
router.get('/settings', Auth, Admin, getSystemSettings);
router.patch('/settings', Auth, Owner, updateSystemSettings);
router.get('/export', Auth, Owner, exportOwnerData);
router.post('/games/:matchId/cancel', Auth, Admin, cancelGameAsAdmin);

export default router;
