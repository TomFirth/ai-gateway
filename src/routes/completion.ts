import { chat, type ChatMessage } from '../services/qwen.js';

export default async function completionRoutes(fastify: any) {
  fastify.post('/', async (request: any, reply: any) => {
    const { message, messages } = request.body as {
      message?: string;
      messages?: ChatMessage[];
    };

    let chatMessages: ChatMessage[];

    if (messages && Array.isArray(messages)) {
      chatMessages = messages;
    } else if (message && typeof message === 'string') {
      chatMessages = [
        {
          role: 'user',
          content: message,
        },
      ];
    } else {
      return reply.status(400).send({
        error: 'message or messages required',
      });
    }

    const response = await chat(chatMessages);

    return {
      content: response,
    };
  });
}