import { randomUUID } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { McpBridge } from "./mcpBridge.js";
import { runAssistantTurn } from "./openaiAgent.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

dotenv.config({
  path: resolve(__dirname, "../../../.env")
});

const app = express();
const port = Number(process.env.SERVER_PORT || 8787);
const clientOrigin = process.env.CLIENT_ORIGIN || "http://localhost:5173";
const sessions = new Map();
const mcpBridge = new McpBridge({
  target: process.env.MCP_SERVER_TARGET || "canva",
  canvaUrl: process.env.CANVA_MCP_URL || "https://mcp.canva.com/mcp"
});

app.use(
  cors({
    origin: clientOrigin
  })
);
app.use(express.json());

app.get("/api/health", async (_request, response) => {
  const connection = mcpBridge.getConnectionDetails();

  try {
    const tools = await mcpBridge.describeTools();
    response.json({
      ok: true,
      model: process.env.OPENAI_MODEL || "gpt-5-mini",
      openaiConfigured: Boolean(process.env.OPENAI_API_KEY),
      mcpTarget: connection.label,
      mcpTargetKey: connection.target,
      remoteUrl: connection.remoteUrl,
      toolCount: tools.length,
      tools
    });
  } catch (error) {
    response.status(500).json({
      ok: false,
      model: process.env.OPENAI_MODEL || "gpt-5-mini",
      openaiConfigured: Boolean(process.env.OPENAI_API_KEY),
      mcpTarget: connection.label,
      mcpTargetKey: connection.target,
      remoteUrl: connection.remoteUrl,
      toolCount: 0,
      tools: [],
      error: error.message
    });
  }
});

app.post("/api/chat", async (request, response) => {
  const message = request.body?.message?.trim();
  const incomingSessionId = request.body?.sessionId;

  if (!message) {
    response.status(400).json({
      error: "Message is required."
    });
    return;
  }

  if (!process.env.OPENAI_API_KEY) {
    response.status(400).json({
      error: "OPENAI_API_KEY is not configured."
    });
    return;
  }

  const sessionId = incomingSessionId || randomUUID();
  const session = getSession(sessionId);

  try {
    const result = await runAssistantTurn({
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_MODEL || "gpt-5-mini",
      previousResponseId: session.previousResponseId,
      message,
      mcpBridge,
      systemPrompt: process.env.SYSTEM_PROMPT
    });

    session.previousResponseId = result.responseId;

    response.json({
      sessionId,
      ...result
    });
  } catch (error) {
    response.status(500).json({
      error: error.message || "Unable to complete the request."
    });
  }
});

app.post("/api/reset", (request, response) => {
  const sessionId = request.body?.sessionId;

  if (sessionId) {
    sessions.delete(sessionId);
  }

  response.json({
    ok: true,
    sessionId: randomUUID()
  });
});

app.listen(port, () => {
  const connection = mcpBridge.getConnectionDetails();
  console.log(`[server] listening on http://localhost:${port}`);
  console.log(`[server] MCP target: ${connection.label}`);
  if (connection.remoteUrl) {
    console.log(`[server] Remote MCP URL: ${connection.remoteUrl}`);
  }
});

function getSession(sessionId) {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, {
      previousResponseId: undefined
    });
  }

  return sessions.get(sessionId);
}

async function shutdown(signal) {
  console.error(`[server] received ${signal}, closing MCP bridge.`);
  await mcpBridge.close();
  process.exit(0);
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});
