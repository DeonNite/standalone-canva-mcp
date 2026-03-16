import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  addTodo,
  clearCompletedTodos,
  completeTodo,
  listTodos
} from "./todoStore.js";

const server = new McpServer({
  name: "local-playground-mcp",
  version: "0.1.0"
});

server.tool(
  "add_numbers",
  {
    a: z.number().describe("The first number to add."),
    b: z.number().describe("The second number to add.")
  },
  async ({ a, b }) => ({
    content: [
      {
        type: "text",
        text: `${a} + ${b} = ${a + b}`
      }
    ],
    structuredContent: {
      a,
      b,
      sum: a + b
    }
  })
);

server.tool("list_todos", {}, async () => {
  const todos = await listTodos();

  return {
    content: [
      {
        type: "text",
        text: renderTodos(todos)
      }
    ],
    structuredContent: {
      todos
    }
  };
});

server.tool(
  "add_todo",
  {
    text: z.string().min(1).describe("The todo text to add.")
  },
  async ({ text }) => {
    const todo = await addTodo(text);

    return {
      content: [
        {
          type: "text",
          text: `Added todo #${todo.id}: ${todo.text}`
        }
      ],
      structuredContent: {
        todo
      }
    };
  }
);

server.tool(
  "complete_todo",
  {
    id: z.number().int().positive().describe("The id of the todo to mark as completed.")
  },
  async ({ id }) => {
    const todo = await completeTodo(id);

    if (!todo) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Todo #${id} was not found.`
          }
        ],
        structuredContent: {
          found: false,
          id
        }
      };
    }

    return {
      content: [
        {
          type: "text",
          text: `Marked todo #${id} as completed.`
        }
      ],
      structuredContent: {
        todo
      }
    };
  }
);

server.tool("clear_completed", {}, async () => {
  const removed = await clearCompletedTodos();

  return {
    content: [
      {
        type: "text",
        text:
          removed === 0
            ? "There were no completed todos to clear."
            : `Removed ${removed} completed todo${removed === 1 ? "" : "s"}.`
      }
    ],
    structuredContent: {
      removed
    }
  };
});

const transport = new StdioServerTransport();
await server.connect(transport);

process.on("uncaughtException", (error) => {
  console.error("[local-mcp-server] uncaughtException", error);
});

process.on("unhandledRejection", (reason) => {
  console.error("[local-mcp-server] unhandledRejection", reason);
});

function renderTodos(todos) {
  if (!todos.length) {
    return "No todos yet.";
  }

  return todos
    .map((todo) => `${todo.completed ? "[x]" : "[ ]"} #${todo.id} ${todo.text}`)
    .join("\n");
}

