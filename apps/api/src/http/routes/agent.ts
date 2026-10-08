import {
  createAgentSession,
  getAgentSession,
  listAgentSessions,
  sendAgentMessage,
} from '../../services/agent.ts';
import { Router } from 'express';
import type { ApiRequest } from '../types.ts';

export const agentRouter = Router();

agentRouter.get('/api/agent/sessions', async (req: ApiRequest, res) =>
  res.json({ sessions: await listAgentSessions(req.query.projectId, req.query.mode) }),
);

agentRouter.post('/api/agent/sessions', async (req: ApiRequest, res) =>
  res.status(201).json(await createAgentSession(req.body)),
);

agentRouter.get('/api/agent/sessions/:id', async (req: ApiRequest, res) =>
  res.json(await getAgentSession(req.params.id)),
);

agentRouter.post('/api/agent/sessions/:id/messages', async (req: ApiRequest, res) => {
  const result = await sendAgentMessage(req.params.id, req.body);
  res.status(result.status).json(result.body);
});
