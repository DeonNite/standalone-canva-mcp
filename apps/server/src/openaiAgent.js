import OpenAI from "openai";

const defaultInstructions =
  "You are a helpful assistant inside an MCP playground. Prefer using available tools when they are relevant, explain briefly what you did, and do not invent tool results.";

// Runs one assistant turn and keeps resolving tool calls until the model returns a final answer.
export async function runAssistantTurn({
  apiKey,
  model,
  previousResponseId,
  message,
  mcpBridge,
  systemPrompt
}) {
  const client = new OpenAI({
    apiKey
  });
  const tools = await mcpBridge.getOpenAITools();
  const instructions = systemPrompt || defaultInstructions;

  let response = await client.responses.create({
    model,
    instructions,
    previous_response_id: previousResponseId,
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: message
          }
        ]
      }
    ],
    tools
  });

  const toolEvents = [];

  while (true) {
    const functionCalls = (response.output || []).filter(
      (item) => item.type === "function_call"
    );

    if (!functionCalls.length) {
      return {
        reply: extractOutputText(response),
        responseId: response.id,
        toolEvents
      };
    }

    const toolOutputs = [];

    for (const call of functionCalls) {
      const parsedArguments = parseArguments(call.arguments);
      const toolResult = await mcpBridge.callTool(call.name, parsedArguments);

      toolEvents.push({
        name: call.name,
        arguments: parsedArguments,
        result: toolResult
      });

      toolOutputs.push({
        type: "function_call_output",
        call_id: call.call_id,
        output: JSON.stringify(
          toolResult.structuredContent || {
            text: toolResult.text,
            isError: toolResult.isError,
            content: toolResult.content
          }
        )
      });
    }

    response = await client.responses.create({
      model,
      instructions,
      previous_response_id: response.id,
      input: toolOutputs,
      tools
    });
  }
}

// Extracts plain assistant text from the Responses API payload.
function extractOutputText(response) {
  if (response.output_text?.trim()) {
    return response.output_text.trim();
  }

  const text = [];

  for (const item of response.output || []) {
    if (item.type !== "message") {
      continue;
    }

    for (const chunk of item.content || []) {
      if (chunk.type === "output_text" && chunk.text) {
        text.push(chunk.text);
      }
    }
  }

  return text.join("\n").trim() || "The assistant returned no text.";
}

// Safely parses tool arguments from the model and falls back to an empty object on invalid JSON.
function parseArguments(rawArguments) {
  if (!rawArguments) {
    return {};
  }

  try {
    return JSON.parse(rawArguments);
  } catch {
    return {};
  }
}



