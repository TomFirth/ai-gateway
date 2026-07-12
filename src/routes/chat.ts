import { chat, type ChatMessage } from '../services/qwen.js';

export default async function chatRoutes(fastify: any) {
  fastify.post('/', async (request: any, reply: any) => {
    const { message } = request.body as { message?: string };

    if (!message || typeof message !== 'string') {
      return reply.status(400).send({ error: 'message is required and must be a string' });
    }

    const messages: ChatMessage[] = [
      { role: 'user', content: message },
    ];

    const response = await chat(messages);
    return { response };
  });
}
