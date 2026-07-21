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
      stream = false,
      tools,
      tool_choice
    } = request.body as {
      messages?: ChatMessage[];
      model?: string;
      stream?: boolean;
      tools?: any[];
      tool_choice?: any;
    };


    if (!messages || !Array.isArray(messages)) {
      return reply.status(400).send({
        error: 'messages array required'
      });
    }


    console.log(
      'TOOLS:',
      tools?.length ?? 0
    );


    const response = await chat(
      messages,
      tools
    );


    const modelName = model ?? 'qwen2.5-coder';


    /*
      If Qwen has returned a tool request in our
      existing format, convert it into OpenAI format.

      Example:
      read_file("src/App.tsx")

      becomes:

      tool_calls: [...]
    */

    const toolMatch = response.match(
      /^([a-zA-Z_]+)\((.*)\)$/
    );


    let assistantMessage: any = {
      role: 'assistant',
      content: response
    };


    if (toolMatch) {

      const toolName = toolMatch[1];
      const rawArgs = toolMatch[2];

      assistantMessage = {
        role: 'assistant',
        content: null,
        tool_calls: [
          {
            id: `call_${Date.now()}`,
            type: 'function',
            function: {
              name: toolName,
              arguments: JSON.stringify({
                args: rawArgs
              })
            }
          }
        ]
      };
    }


    // Streaming response
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
            delta: assistantMessage,
            finish_reason: null
          }
        ]
      };


      reply.raw.write(
        `data: ${JSON.stringify(chunk)}\n\n`
      );


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


    return {
      id: `chatcmpl-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: modelName,

      choices: [
        {
          index: 0,
          message: assistantMessage,
          finish_reason: assistantMessage.tool_calls
            ? 'tool_calls'
            : 'stop'
        }
      ]
    };
  });
}