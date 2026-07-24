import { chat, chatStream, type ChatMessage } from '../services/qwen.js';

export default async function openaiRoutes(fastify: any) {

  fastify.get('/models', async () => {
    return {
      object: 'list',
      data: [
        {
          id: 'qwen2.5-coder',
          object: 'model',
          owned_by: 'local'
        }
      ]
    };
  });


  fastify.post(
    '/chat/completions',
    async (request: any, reply: any) => {

      console.log(
        JSON.stringify(request.body, null, 2)
      );

      const {
        messages,
        model,
        stream = false
      } = request.body as {
        messages?: ChatMessage[];
        model?: string;
        stream?: boolean;
      };

      if (!Array.isArray(messages)) {
        return reply.status(400).send({
          error: {
            message: 'messages array required'
          }
        });
      }

      const modelName =
        model ?? 'qwen2.5-coder';

      const activeMessages = messages.filter(m => m.role !== 'system');

      console.log(
        `[chat] ${messages.length} incoming -> sending ${activeMessages.length} | stream=${stream}`
      );

      if (stream) {
        reply.hijack();

        const raw = reply.raw;

        raw.setHeader(
          'Content-Type',
          'text/event-stream'
        );

        raw.setHeader(
          'Cache-Control',
          'no-cache'
        );

        raw.setHeader(
          'Connection',
          'keep-alive'
        );

        raw.setHeader(
          'X-Accel-Buffering',
          'no'
        );

        raw.flushHeaders();
        raw.socket?.setNoDelay(true);

        const id = `chatcmpl-${Date.now()}`;
        let closed = false;

        request.raw.on('close', () => {
          closed = true;
          console.log('[stream] connection closed by client');
        });

        // 10-second heartbeat to prevent 30s timeouts on the Pi
        const heartbeatInterval = setInterval(() => {
          if (!closed) {
            raw.write(': heartbeat\n\n');
          } else {
            clearInterval(heartbeatInterval);
          }
        }, 10000);

        const send = (
          content: string | null,
          deltaOverrides: any = null,
          finish_reason: string | null = null
        ) => {
          if (closed) return;

          const chunk = {
            id,
            object: "chat.completion.chunk",
            created: Math.floor(Date.now() / 1000),
            model: modelName,
            choices: [
              {
                index: 0,
                delta: deltaOverrides || { content },
                finish_reason
              }
            ]
          };

          raw.write(`data: ${JSON.stringify(chunk)}\n\n`);
        };

        try {
          // Immediately send role to trigger UI
          send(null, { role: 'assistant' });

          for await (const chunk of chatStream(activeMessages)) {
            if (closed) break;

            if (chunk.comment) {
              raw.write(`: ${chunk.comment}\n\n`);
              continue;
            }

            if (typeof chunk.content === "string") {
              send(chunk.content);
            }
          }

          if (!closed) {
            send(null, {}, "stop");
            raw.write("data: [DONE]\n\n");
          }
        } catch (err) {
          console.error('[Stream Error]', err);
          if (!closed) {
            raw.write(`data: ${JSON.stringify({ error: String(err) })}\n\n`);
          }
        } finally {
          clearInterval(heartbeatInterval);
          raw.end();
        }
        return;
      }


      const response =
        await chat(
          activeMessages
        );

      return {
        id:
          `chatcmpl-${Date.now()}`,

        object:
          'chat.completion',

        created:
          Math.floor(
            Date.now() / 1000
          ),

        model: modelName,

        choices: [
          {
            index: 0,

            message: {
              role: 'assistant',
              content: response
            },

            finish_reason:
              'stop'
          }
        ],

        usage: {
          prompt_tokens: 0,
          completion_tokens: 0,
          total_tokens: 0
        }
      };

    }
  );
}