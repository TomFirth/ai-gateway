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
      model
    } = request.body as {
      messages?: ChatMessage[];
      model?: string;
    };


    if (!messages || !Array.isArray(messages)) {
      return reply.status(400).send({
        error: 'messages array required'
      });
    }


    const response = await chat(messages);


    return {
      id: `chatcmpl-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: model ?? 'qwen2.5-coder',

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