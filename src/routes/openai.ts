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


  fastify.post('/chat/completions', async (request: any, reply: any) => {

    const {
      messages,
      model,
      stream = false,
      tools
    } = request.body as {
      messages?: ChatMessage[];
      model?: string;
      stream?: boolean;
      tools?: any[];
    };


    if (!messages || !Array.isArray(messages)) {
      return reply.status(400).send({
        error: 'messages array required'
      });
    }


    console.log('===== INCOMING VS CODE REQUEST =====');
    console.log(JSON.stringify(request.body, null, 2));
    console.log('====================================');


    const modelName = model ?? 'qwen2.5-coder';


    /*
      TRUE STREAMING MODE

      VS Code expects OpenAI SSE chunks:
      
      data: {
        choices:[
          {
            delta:{
              content:"token"
            }
          }
        ]
      }
    */

    if (stream) {

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


      const id = `chatcmpl-${Date.now()}`;
      const created = Math.floor(Date.now() / 1000);


      try {

        for await (const token of chatStream(messages)) {

          reply.raw.write(
            `data: ${JSON.stringify({
              id,
              object: 'chat.completion.chunk',
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


        reply.raw.write(
          `data: ${JSON.stringify({
            id,
            object: 'chat.completion.chunk',
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


        reply.raw.write(
          'data: [DONE]\n\n'
        );

      } catch (error) {

        console.error(
          'Streaming error:',
          error
        );

      } finally {

        reply.raw.end();

      }


      return;
    }


    /*
      NORMAL JSON MODE

      Used by clients that do not request streaming.
    */


    const response = await chat(
      messages,
      tools
    );


    return {
      id: `chatcmpl-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: modelName,

      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: response
          },
          finish_reason: 'stop'
        }
      ]
    };
  });
}