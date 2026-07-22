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


      // Only send the latest message to avoid redundant history and filter out system messages.
      const activeMessages = messages
        .filter(m => m.role !== 'system')
        .slice(-1);


      console.log(
        `[chat] ${messages.length} incoming -> sending ${activeMessages.length} | stream=${stream}`
      );


      if (stream) {
        reply.hijack();
        const raw = reply.raw;

        raw.setHeader('Content-Type', 'text/event-stream');
        raw.setHeader('Cache-Control', 'no-cache, no-transform');
        raw.setHeader('Connection', 'keep-alive');
        raw.setHeader('X-Accel-Buffering', 'no');
        raw.flushHeaders?.();

        const id = `chatcmpl-${Date.now()}`;
        const created = Math.floor(Date.now() / 1000);
        let closed = false;
        let roleSent = false;

        request.raw.on('close', () => {
          closed = true;
        });

        const sendChunk = (delta: any, finishReason: string | null = null) => {
          if (closed) return;
          const chunk = {
            id,
            object: 'chat.completion.chunk',
            created,
            model: modelName,
            choices: [{
              index: 0,
              delta,
              finish_reason: finishReason
            }]
          };
          const data = `data: ${JSON.stringify(chunk)}\n\n`;
          // console.log(`[stream] chunk: ${data.trim()}`);
          raw.write(data);
        };

        const heartbeat = setInterval(() => {
          if (!closed) {
            raw.write(': heartbeat\n\n');
          } else {
            clearInterval(heartbeat);
          }
        }, 15000);

        try {
          console.log('[stream] starting chatStream');
          for await (const chunk of chatStream(activeMessages)) {
            if (closed) {
              console.log('[stream] connection closed by client');
              break;
            }

            if (chunk.comment) {
              console.log(`[stream] comment: ${chunk.comment}`);
              raw.write(`: ${chunk.comment}\n\n`);
              continue;
            }

            if (chunk.content !== undefined) {
              const delta: any = { content: chunk.content };
              if (!roleSent) {
                delta.role = 'assistant';
                roleSent = true;
              }
              sendChunk(delta);
            }
          }

          if (!closed) {
            if (!roleSent) sendChunk({ role: 'assistant', content: '' });
            sendChunk({}, 'stop');
            raw.write('data: [DONE]\n\n');
          }
        } catch (error) {
          console.error('[stream error]', error);
          if (!closed) {
            raw.write(`data: ${JSON.stringify({
              error: { message: error instanceof Error ? error.message : 'Unknown error' }
            })}\n\n`);
          }
        } finally {
          clearInterval(heartbeat);
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