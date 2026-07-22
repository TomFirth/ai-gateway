import { listDirectory } from '../tools/listDirectory.js';
import { readFile } from '../tools/readFile.js';
import { searchText } from '../tools/searchText.js';
import { gitStatus, gitDiff, gitLog } from '../tools/git.js';
import { runTests, runNpm, terminal } from '../tools/run.js';
import { openFile, replaceText, renameSymbol } from '../tools/fileOps.js';

type ToolCall = {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
};

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
};

const tools = {
  git_status: {
    description: 'Get current git repository status.',
    run: gitStatus,
    parameters: {
      type: 'object',
      properties: {}
    }
  },

  git_diff: {
    description: 'Show git diff.',
    run: gitDiff,
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string' }
      }
    }
  },

  git_log: {
    description: 'Show git log.',
    run: gitLog,
    parameters: {
      type: 'object',
      properties: {
        count: { type: 'number' }
      }
    }
  },

  list_directory: {
    description: 'List files.',
    run: listDirectory,
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string' }
      }
    }
  },

  open_file: {
    description: 'Open file.',
    run: openFile,
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string' }
      }
    }
  },

  read_file: {
    description: 'Read file.',
    run: readFile,
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string' }
      }
    }
  },

  search_text: {
    description: 'Search files.',
    run: searchText,
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string' }
      }
    }
  },

  replace_text: {
    description: 'Replace text.',
    run: replaceText,
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string' },
        searchText: { type: 'string' },
        replaceText: { type: 'string' }
      }
    }
  },

  rename_symbol: {
    description: 'Rename symbol.',
    run: renameSymbol,
    parameters: {
      type: 'object',
      properties: {
        oldName: { type: 'string' },
        newName: { type: 'string' },
        filePath: { type: 'string' }
      }
    }
  },

  run_tests: {
    description: 'Run tests.',
    run: runTests,
    parameters: {
      type: 'object',
      properties: {}
    }
  },

  run_npm: {
    description: 'Run npm command.',
    run: runNpm,
    parameters: {
      type: 'object',
      properties: {
        args: { type: 'string' }
      }
    }
  },

  terminal: {
    description: 'Run terminal command.',
    run: terminal,
    parameters: {
      type: 'object',
      properties: {
        command: { type: 'string' }
      }
    }
  }
} as const;


type ToolName = keyof typeof tools;


export const openAITools = Object.entries(tools).map(
  ([name, tool]) => ({
    type: 'function',
    function: {
      name,
      description: tool.description,
      parameters: tool.parameters
    }
  })
);


function trimMessages(
  messages: ChatMessage[],
  maxChars = 12000
) {
  let total = 0;
  const output: ChatMessage[] = [];

  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];

    if (!msg) {
      continue;
    }

    const size = msg.content?.length ?? 0;

    if (total + size > maxChars) {
      break;
    }

    output.unshift(msg);
    total += size;
  }

  return output;
}


function cleanMessages(
  messages: ChatMessage[]
) {
  return messages.filter(
    message =>
      message.role !== 'system'
  );
}


async function callQwenApi(
  messages: ChatMessage[],
  options?: {
    tools?: boolean;
    stream?: boolean;
  }
) {

  const url =
    process.env.QWEN_URL ??
    'http://192.168.1.81:8080';


  console.log(`[Qwen API] Calling ${url}/v1/chat/completions (stream=${options?.stream})`);
  const response = await fetch(
    `${url}/v1/chat/completions`,
    {
      method: 'POST',
      headers: {
        'content-type':'application/json'
      },

      body: JSON.stringify({

        model:'qwen2.5-coder',

        messages: trimMessages(
          cleanMessages(messages)
        ),

        temperature:0.1,

        top_p:0.9,

        max_tokens:4096,

        stream:
          options?.stream ?? false,

        ...(options?.tools
          ? {
              tools:openAITools,
              tool_choice:'auto'
            }
          : {})

      })
    }
  );


  if (!response.ok) {
    throw new Error(
      await response.text()
    );
  }


  return response;
}



export async function chat(
  messages: ChatMessage[]
) {
  let currentMessages = [...messages];

  while (true) {
    const response =
      await callQwenApi(
        currentMessages,
        {
          tools: false
        }
      );
      // tools: false after debugging

    const json =
      await response.json();

    const message =
      json.choices?.[0]
        ?.message;

    if (!message) {
      return '';
    }

    currentMessages.push(message);

    if (
      message.tool_calls &&
      message.tool_calls.length > 0
    ) {
      for (const toolCall of message.tool_calls) {
        const name =
          toolCall.function.name as ToolName;

        let args = {};
        try {
          args = JSON.parse(toolCall.function.arguments);
        } catch (e) {
          console.error('Failed to parse tool arguments', toolCall.function.arguments);
        }

        console.log(
          `[tool] ${name}`,
          args
        );

        let result;
        try {
          if (tools[name]) {
            result =
              await (tools[name] as any).run(
                args
              );
          } else {
            result =
              `Tool ${name} not found`;
          }
        } catch (e) {
          result =
            `Error: ${e instanceof Error ? e.message : String(e)}`;
        }

        currentMessages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content:
            typeof result === 'string'
              ? result
              : JSON.stringify(result)
        });
      }
      // Continue loop to get response after tool results
      continue;
    }

    return message.content ?? '';
  }
}



export async function* chatStream(
  messages: ChatMessage[]
): AsyncGenerator<{ content?: string; tool_calls?: any[]; comment?: string }> {
  let currentMessages = [...messages];

  while (true) {
    const response = await callQwenApi(
      currentMessages,
      {
        stream: true,
        tools: false
      }
    );
    // tools: true return after debugging

    if (!response.body) {
      throw new Error('No response body');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    let buffer = '';
    let fullContent = '';
    let toolCalls: any[] = [];

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      buffer += decoder.decode(value, {
        stream: true
      });
      console.log(JSON.stringify(buffer));

      buffer = buffer.replace(/\r\n/g, "\n");
      while (buffer.includes('\n\n')) {
        const index = buffer.indexOf('\n\n');
        const event = buffer.slice(0, index);
        buffer = buffer.slice(index + 2);

        if (!event.startsWith('data:')) {
          if (event.startsWith(':')) {
            yield {
              comment: event
                .slice(1)
                .trim()
            };
          }
          continue;
        }

        const data = event.replace(/^data:\s*/, '');

        if (data.trim() === '[DONE]') {
          break;
        }

        try {
          const json = JSON.parse(data);
          const delta = json.choices?.[0]?.delta;
          console.log("[LLAMA DELTA]", JSON.stringify(delta));

          if (!delta || typeof delta.content !== "string") {
            continue;
          }

          console.log(
            '[Qwen delta]',
            JSON.stringify(delta)
          );

          if (typeof delta.content === 'string') {
              fullContent += delta.content;

              console.log(
                  '[QWEN YIELD]',
                  JSON.stringify({
                      content: delta.content
                  })
              );

              yield {
                  content: delta.content
              };
          }

          if (delta.tool_calls) {
            toolCalls.push(
              ...delta.tool_calls
            );
            console.log("[QWEN YIELD]", JSON.stringify({
                content: delta.content,
                tool_calls: delta.tool_calls
            }));
            yield {
              tool_calls: delta.tool_calls
            };
          }
        } catch (err) {
          console.error(
            '[Qwen stream parse error]',
            err,
            event
          );
        }
      }
    }


    if (toolCalls.length > 0) {
      const validToolCalls =
        toolCalls.filter(
          tc => tc?.function?.name
        );
      if (validToolCalls.length === 0) {
        break;
      }

      currentMessages.push({
        role: 'assistant',
        content: fullContent || null,
        tool_calls: validToolCalls
      });

      for (const toolCall of validToolCalls) {
        const name = toolCall.function.name as ToolName;
        let args = {};

        try {
          args = JSON.parse(
            toolCall.function.arguments
          );
        } catch {
          console.error(
            'Failed parsing tool args',
            toolCall.function.arguments
          );
        }

        console.log(
          `[tool stream] ${name}`,
          args
        );

        yield {
          comment: `Executing ${name}...`
        };

        let result;

        try {
          if (tools[name]) {
            result = await (tools[name] as any).run(args);
          } else {
            result = `Tool ${name} not found`;
          }
        } catch (err) {
          result =
            `Error: ${
              err instanceof Error
                ? err.message
                : String(err)
            }`;
        }

        currentMessages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content:
            typeof result === 'string'
              ? result
              : JSON.stringify(result)
        });
      }
      continue;
    }
    break;
  }
}
