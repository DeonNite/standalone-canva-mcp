import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const localServerEntry = resolve(
  __dirname,
  "../../../packages/local-mcp-server/src/index.js"
);
const defaultCanvaUrl = "https://mcp.canva.com/mcp";
const defaultCanvaWrapperCommand = process.platform === "win32" ? "npx.cmd" : "npx";

const fallbackDescriptions = {
  add_numbers: "Add two numbers and return the sum.",
  list_todos: "Return the list of todos stored by the local MCP server.",
  add_todo: "Create a todo item in the local MCP server.",
  complete_todo: "Mark a todo item as completed by id.",
  clear_completed: "Remove completed todo items."
};

export class McpBridge {
  constructor(config = {}) {
    this.config = {
      target: (config.target || "canva").toLowerCase(),
      canvaUrl: config.canvaUrl || defaultCanvaUrl,
      localServerEntry: config.localServerEntry || localServerEntry,
      canvaWrapperCommand: config.canvaWrapperCommand || defaultCanvaWrapperCommand,
      canvaWrapperArgs:
        config.canvaWrapperArgs || ["-y", "mcp-remote@latest", config.canvaUrl || defaultCanvaUrl]
    };
    this.client = null;
    this.transport = null;
  }

  async connect() {
    if (this.client) {
      return;
    }

    const transportOptions = this.getTransportOptions();
    const transport = new StdioClientTransport(transportOptions);
    const client = new Client(
      {
        name: "mcp-demo-host",
        version: "0.1.0"
      },
      {
        capabilities: {
          tools: {}
        }
      }
    );

    try {
      await client.connect(transport);
      this.transport = transport;
      this.client = client;
    } catch (error) {
      if (transport?.close) {
        await transport.close().catch(() => undefined);
      }

      throw this.wrapConnectionError(error);
    }
  }

  async listTools() {
    await this.connect();
    const result = await this.client.listTools();
    return result.tools || [];
  }

  async getOpenAITools() {
    const tools = await this.listTools();

    return tools.map((tool) => ({
      type: "function",
      name: tool.name,
      description: this.resolveDescription(tool),
      parameters: tool.inputSchema || {
        type: "object",
        properties: {},
        additionalProperties: false
      }
    }));
  }

  async describeTools() {
    const tools = await this.listTools();

    return tools.map((tool) => ({
      name: tool.name,
      description: this.resolveDescription(tool)
    }));
  }

  async callTool(name, args = {}) {
    await this.connect();
    const result = await this.client.callTool({
      name,
      arguments: args
    });

    return normalizeToolResult(result);
  }

  async close() {
    const transport = this.transport;
    this.client = null;
    this.transport = null;

    if (transport?.close) {
      await transport.close();
    }
  }

  getTargetLabel() {
    return this.config.target === "canva" ? "Canva MCP" : "Local MCP";
  }

  getConnectionDetails() {
    if (this.config.target === "canva") {
      return {
        target: this.config.target,
        label: this.getTargetLabel(),
        command: this.config.canvaWrapperCommand,
        args: this.config.canvaWrapperArgs,
        remoteUrl: this.config.canvaUrl
      };
    }

    return {
      target: this.config.target,
      label: this.getTargetLabel(),
      command: process.execPath,
      args: [this.config.localServerEntry],
      remoteUrl: null
    };
  }

  getTransportOptions() {
    if (this.config.target === "local") {
      return {
        command: process.execPath,
        args: [this.config.localServerEntry]
      };
    }

    return {
      command: this.config.canvaWrapperCommand,
      args: this.config.canvaWrapperArgs
    };
  }

  resolveDescription(tool) {
    return (
      tool.description ||
      fallbackDescriptions[tool.name] ||
      "Tool exposed by the current MCP server."
    );
  }

  wrapConnectionError(error) {
    if (this.config.target === "canva") {
      return new Error(
        `Unable to connect to Canva MCP. Start the app, let mcp-remote open the Canva approval flow in your browser, and approve access. Original error: ${error.message}`
      );
    }

    return error;
  }
}

function normalizeToolResult(result) {
  const text = (result.content || [])
    .filter((item) => item.type === "text")
    .map((item) => item.text)
    .join("\n")
    .trim();

  return {
    isError: Boolean(result.isError),
    content: result.content || [],
    structuredContent: result.structuredContent || null,
    text:
      text ||
      (result.structuredContent
        ? JSON.stringify(result.structuredContent, null, 2)
        : "Tool completed without text output.")
  };
}
