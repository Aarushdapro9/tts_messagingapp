import express from 'express';
import { Auth } from '../middleware/user.js';
import {
  acceptMatch,
  createMatch,
  declineMatch,
  forfeitMatch,
  getConversationMatches,
  getMatch,
  submitAction,
} from '../controllers/gameControllers.js';

const router = express.Router();

router.post('/matches', Auth, createMatch);
router.get('/matches/:matchId', Auth, getMatch);
router.post('/matches/:matchId/accept', Auth, acceptMatch);
router.post('/matches/:matchId/decline', Auth, declineMatch);
router.post('/matches/:matchId/actions', Auth, submitAction);
router.post('/matches/:matchId/forfeit', Auth, forfeitMatch);
router.get('/conversations/:conversationId/matches', Auth, getConversationMatches);

export default router;
