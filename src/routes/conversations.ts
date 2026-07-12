import {
  appendMessage,
  createConversation,
  getAllConversations,
  getConversation,
  updateConversationProject,
} from '../services/conversations.js';

export default async function conversationsRoutes(fastify: any) {
  fastify.get('/', async () => {
    const conversations = await getAllConversations();
    return { conversations };
  });

  fastify.get('/:id', async (request: any, reply: any) => {
    const conversation = await getConversation(request.params.id);
    if (!conversation) {
      return reply.status(404).send({ error: 'Conversation not found' });
    }

    return { conversation };
  });

  fastify.post('/', async (request: any, reply: any) => {
    const { projectRoot, messages } = request.body as {
      projectRoot?: string;
      messages?: Array<{ role: string; content: string }>;
    };

    if (messages && !Array.isArray(messages)) {
      return reply.status(400).send({ error: 'messages must be an array' });
    }

    const normalizedMessages = messages?.map((message) => ({
      role: message.role as 'user' | 'assistant' | 'system',
      content: message.content,
    })) ?? [];

    const conversation = await createConversation(projectRoot, normalizedMessages);
    return reply.status(201).send({ conversation });
  });

  fastify.post('/:id/messages', async (request: any, reply: any) => {
    const { role, content } = request.body as { role?: string; content?: string };
    if (!role || !content) {
      return reply.status(400).send({ error: 'role and content are required' });
    }

    try {
      const conversation = await appendMessage(request.params.id, {
        role: role as 'user' | 'assistant' | 'system',
        content,
      });
      return { conversation };
    } catch (error) {
      return reply.status(404).send({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  fastify.patch('/:id/project', async (request: any, reply: any) => {
    const { projectRoot } = request.body as { projectRoot?: string };
    if (!projectRoot) {
      return reply.status(400).send({ error: 'projectRoot is required' });
    }

    try {
      const conversation = await updateConversationProject(request.params.id, projectRoot);
      return { conversation };
    } catch (error) {
      return reply.status(404).send({ error: error instanceof Error ? error.message : String(error) });
    }
  });
}
