import {
  chat,
  chatStream,
  type ChatMessage
} from '../services/qwen.js';

export default async function chatRoutes(fastify: any) {

  fastify.post('/v1/chat/completions', async (
    request: any,
    reply: any
  ) => {

    const body = request.body;

    const messages =
      body.messages as ChatMessage[];

    if (!messages || !Array.isArray(messages)) {
      return reply.status(400).send({
        error: 'messages array required'
      });
    }

    if (body.stream) {
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
        for await (
          const chunk of chatStream(messages)
        ) {
          reply.raw.write(
            `data: ${JSON.stringify({
              id: 'chatcmpl-local',
              object: 'chat.completion.chunk',
              choices: [
                {
                  delta: {
                    content: chunk
                  },
                  index: 0,
                  finish_reason: null
                }
              ]
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
      return;
    }

    const result =
      await chat(
        messages
      );

    return {
      id: 'chatcmpl-local',
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: body.model ?? 'qwen2.5-coder',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: result
          },
          finish_reason: 'stop'
        }
      ]
    };

  });

}