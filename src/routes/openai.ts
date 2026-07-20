import { chat, type ChatMessage } from '../services/qwen.js';

export default async function openaiRoutes(fastify: any) {

  // VS Code uses this to discover available models
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


  // OpenAI-compatible chat endpoint
  fastify.post('/chat/completions', async (request: any, reply: any) => {

    const {
      messages,
      model,
      stream = false
    } = request.body as {
      messages?: ChatMessage[];
      model?: string;
      stream?: boolean;
    };


    if (!messages || !Array.isArray(messages)) {
      return reply.status(400).send({
        error: 'messages array required'
      });
    }


    const response = await chat(messages);


    const modelName = model ?? 'qwen2.5-coder';


    // Streaming response (SSE)
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


      const chunk = {
        id: `chatcmpl-${Date.now()}`,
        object: 'chat.completion.chunk',
        created: Math.floor(Date.now() / 1000),
        model: modelName,

        choices: [
          {
            index: 0,
            delta: {
              role: 'assistant',
              content: response
            },
            finish_reason: null
          }
        ]
      };


      reply.raw.write(
        `data: ${JSON.stringify(chunk)}\n\n`
      );


      // Finish event
      reply.raw.write(
        `data: ${JSON.stringify({
          id: chunk.id,
          object: 'chat.completion.chunk',
          created: chunk.created,
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


      return reply.raw.end();
    }


    // Normal JSON response
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