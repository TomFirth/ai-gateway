import { listDirectory } from '../tools/listDirectory.js';
import { readFile } from '../tools/readFile.js';
import { searchText } from '../tools/searchText.js';
import { gitStatus, gitDiff, gitLog } from '../tools/git.js';
import { runTests, runNpm, terminal } from '../tools/run.js';
import { openFile, replaceText, renameSymbol } from '../tools/fileOps.js';


export type ChatMessage = {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string | null;
  tool_call_id?: string;
  tool_calls?: any[];
};


const SYSTEM_PROMPT = `
You are a coding assistant.

When you need to inspect or modify files, use the available tools.

Available tools:
git_status()
git_diff(path)
git_log(count)
list_directory(path)
open_file(path)
read_file(path)
search_text(query)
replace_text(path, searchText, replaceText)
rename_symbol(oldName, newName, filePath)
run_tests()
run_npm(args)
terminal(command)

If using tools, call them exactly like:
tool_name(argument)

Do not explain the tool call. Only output the tool call.
`;


const tools = {
  git_status: {
    description: 'Show git status for the active project.',
    run: gitStatus,
  },

  git_diff: {
    description: 'Show git diff for the active project or a specific file.',
    run: gitDiff,
  },

  git_log: {
    description: 'Show recent git history for the active project.',
    run: gitLog,
  },

  list_directory: {
    description: 'List files and directories under the active project root.',
    run: listDirectory,
  },

  open_file: {
    description: 'Open a file under the active project root.',
    run: openFile,
  },

  read_file: {
    description: 'Read the contents of a text file under the active project root.',
    run: readFile,
  },

  search_text: {
    description: 'Search text across files under the active project root.',
    run: searchText,
  },

  replace_text: {
    description: 'Replace matching text inside a file.',
    run: replaceText,
  },

  rename_symbol: {
    description: 'Rename a symbol across project files.',
    run: renameSymbol,
  },

  run_tests: {
    description: 'Run the project test suite.',
    run: runTests,
  },

  run_npm: {
    description: 'Run npm commands.',
    run: runNpm,
  },

  terminal: {
    description: 'Run a terminal command.',
    run: terminal,
  },
} as const;


type ToolName = keyof typeof tools;


/*
 Convert our tools into OpenAI function format.
 llama.cpp understands this format.
*/
export const openAITools = Object.entries(tools).map(
  ([name, tool]) => ({
    type: 'function',
    function: {
      name,
      description: tool.description,
      parameters: {
        type: 'object',
        properties: {}
      }
    }
  })
);



type ToolInvocation = {
  name: ToolName;
  args: string[];
};


function parseToolInvocation(
  text: string
): ToolInvocation | null {

  const toolNames = Object.keys(tools).join('|');

  const match = text.match(
    new RegExp(
      `\\b(${toolNames})\\s*\\(\\s*([\\s\\S]*?)\\s*\\)`,
      'i'
    )
  );


  if (!match) {
    return null;
  }


  const name = match[1].toLowerCase() as ToolName;

  const args: string[] = [];

  const argRegex = /(['"])(.*?)\1|([^,\s]+)/g;

  let argMatch;

  while ((argMatch = argRegex.exec(match[2])) !== null) {

    const value =
      argMatch[2] ??
      argMatch[3];

    if (value) {
      args.push(value.trim());
    }
  }


  return {
    name,
    args
  };
}



async function callQwenApi(
  messages: ChatMessage[],
  openaiTools?: any[]
) {

  const QWEN_URL =
    process.env.QWEN_URL ??
    'http://192.168.1.81:8080';


  const response = await fetch(
    `${QWEN_URL}/v1/chat/completions`,
    {
      method: 'POST',

      headers: {
        'content-type': 'application/json',
      },

      body: JSON.stringify({
        model: 'qwen2.5-coder',
        messages,

        ...(openaiTools?.length
          ? {
              tools: openaiTools,
              tool_choice: 'auto'
            }
          : {})
      }),
    }
  );


  if (!response.ok) {

    const bodyText =
      await response.text();

    throw new Error(
      `Qwen request failed: ${response.status} ${bodyText}`
    );
  }


  return await response.json();
}



export async function chat(
  messages: ChatMessage[],
  incomingTools?: any[]
): Promise<string> {


  const conversation: ChatMessage[] = [
    {
      role: 'system',
      content: SYSTEM_PROMPT
    },

    ...messages
  ];



  for (let loop = 0; loop < 3; loop++) {


    const payload =
      await callQwenApi(
        conversation,
        incomingTools ?? openAITools
      );



    const assistant =
      payload.choices?.[0]?.message;



    if (!assistant) {
      throw new Error(
        'Qwen returned no message'
      );
    }



    /*
      Native OpenAI tool calling
    */

    if (
      assistant.tool_calls &&
      assistant.tool_calls.length
    ) {

      for (const call of assistant.tool_calls) {

        const name =
          call.function.name as ToolName;


        const args =
          JSON.parse(
            call.function.arguments || '{}'
          );


        const tool =
          tools[name];


        if (!tool) {
          continue;
        }


        const result =
          await (
            tool.run as any
          )(
            ...Object.values(args)
          );


        conversation.push({
          role: 'assistant',
          content: null,
          tool_calls: assistant.tool_calls
        });


        conversation.push({
          role: 'tool',
          tool_call_id: call.id,
          content: result
        });
      }


      continue;
    }



    const text =
      assistant.content;


    if (!text) {
      throw new Error(
        'Qwen returned empty response'
      );
    }



    /*
      Fallback:
      qwen text based tool calls
    */

    const toolInvocation =
      parseToolInvocation(text);


    if (!toolInvocation) {
      return text;
    }


    const tool =
      tools[toolInvocation.name];


    const result =
      await (
        tool.run as any
      )(
        ...toolInvocation.args
      );


    conversation.push({
      role: 'assistant',
      content: text
    });


    conversation.push({
      role: 'system',
      content:
        `Tool ${toolInvocation.name} returned:\n${result}`
    });
  }


  return 'Unable to complete request.';
}