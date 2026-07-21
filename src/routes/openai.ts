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


      /*
        Continue sends its own agent system prompt.
        Remove it before sending to Qwen.
      */
      const cleanMessages =
        messages.filter(
          message =>
            message.role !== 'system'
        );


      console.log(
        `[chat] ${cleanMessages.length} messages | stream=${stream}`
      );


      if (stream) {

        reply.hijack();


        const raw =
          reply.raw;


        raw.setHeader(
          'Content-Type',
          'text/event-stream'
        );

        raw.setHeader(
          'Cache-Control',
          'no-cache, no-transform'
        );

        raw.setHeader(
          'Connection',
          'keep-alive'
        );

        raw.setHeader(
          'X-Accel-Buffering',
          'no'
        );


        raw.flushHeaders?.();


        const id =
          `chatcmpl-${Date.now()}`;


        const created =
          Math.floor(
            Date.now() / 1000
          );


        let closed = false;


        request.raw.on(
          'close',
          () => {
            closed = true;
          }
        );


        try {

          for await (
            const token of chatStream(
              cleanMessages
            )
          ) {

            if (closed) {
              break;
            }


            raw.write(
              `data: ${JSON.stringify({
                id,
                object:
                  'chat.completion.chunk',
                created,
                model: modelName,

                choices: [
                  {
                    index: 0,

                    delta: {
                      content: token
                    },

                    finish_reason: null
                  }
                ]
              })}\n\n`
            );
          }


          if (!closed) {

            raw.write(
              `data: ${JSON.stringify({
                id,
                object:
                  'chat.completion.chunk',
                created,
                model: modelName,

                choices: [
                  {
                    index: 0,
                    delta: {},
                    finish_reason: 'stop'
                  }
                ]
              })}\n\n`
            );


            raw.write(
              'data: [DONE]\n\n'
            );
          }


        } catch (error) {

          console.error(
            '[stream error]',
            error
          );


          if (!closed) {

            raw.write(
              `data: ${JSON.stringify({
                error: {
                  message:
                    error instanceof Error
                      ? error.message
                      : 'Unknown error'
                }
              })}\n\n`
            );

          }

        } finally {

          raw.end();

        }


        return;
      }


      const response =
        await chat(
          cleanMessages
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