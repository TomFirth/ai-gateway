import { chatStream, type ChatMessage } from '../services/qwen.js';

export default async function chatRoutes(fastify: any) {

  fastify.post('/', async (request: any, reply: any) => {

    const { message } = request.body as {
      message?: string;
    };

    if (!message || typeof message !== 'string') {
      return reply.status(400).send({
        error: 'message is required and must be a string'
      });
    }

    const messages: ChatMessage[] = [
      {
        role: 'user',
        content: message
      }
    ];

    reply.raw.setHeader(
      'Content-Type',
      'text/event-stream'
    );

    reply.raw.setHeader(
      'Cache-Control',
      'no-cache'
    );

    reply.raw.setHeader(
      'Connection',
      'keep-alive'
    );

    try {

      for await (const chunk of chatStream(messages)) {

        reply.raw.write(
          `data: ${JSON.stringify({
            content: chunk
          })}\n\n`
        );

      }

      reply.raw.write(
        'data: [DONE]\n\n'
      );

    } catch (err) {

      reply.raw.write(
        `data: ${JSON.stringify({
          error:
            err instanceof Error
              ? err.message
              : 'Unknown error'
        })}\n\n`
      );

    }

    reply.raw.end();
  });
}