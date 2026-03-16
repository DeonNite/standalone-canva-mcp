# MCP Demo Playground

This repository is a React + Node chatbot that uses OpenAI as the model layer and Canva MCP as the tool layer.

## Current Flow

1. The React client sends `GET /api/health` or `POST /api/chat` to the Express backend.
2. The backend creates an `McpBridge` in Canva mode by default.
3. The bridge starts Canva through `mcp-remote`:

   ```bash
   npx -y mcp-remote@latest https://mcp.canva.com/mcp
   ```

4. `mcp-remote` handles the Canva approval flow in the browser and exposes Canva MCP tools over stdio.
5. The backend lists the available MCP tools and advertises them to the OpenAI Responses API as callable functions.
6. If OpenAI returns a function call, the backend executes that tool through the MCP client, sends the tool result back to OpenAI, and waits for the final assistant answer.
7. The backend returns the assistant reply and tool activity to the React UI.

Important: the React app never talks to Canva directly. The path is:

`React UI -> Express backend -> MCP SDK client -> mcp-remote -> Canva MCP -> OpenAI tool loop -> React UI`

This follows Canva's documented MCP setup:

- https://www.canva.dev/docs/connect/canva-mcp-server-setup/

## Project Structure

- `apps/client`: Vite + React UI
- `apps/server`: Express API and OpenAI tool loop
- `apps/server/src/mcpBridge.js`: Canva/local MCP transport selection
- `packages/local-mcp-server`: optional fallback demo MCP server

## Setup

1. Create `.env` from `.env.example` if needed.
2. Set `OPENAI_API_KEY`.
3. Keep `MCP_SERVER_TARGET=canva` for Canva mode.
4. Install dependencies:

   ```bash
   npm install
   ```

5. Start the app:

   ```bash
   npm run dev
   ```

6. Open `http://localhost:5173`.
7. Click `Refresh` or send a chat message.
8. Approve the Canva browser flow opened by `mcp-remote` on first use.

The backend runs on `http://localhost:8787`.

## How To Test

### 1. Health Check

Use the UI `Refresh` button or call the backend directly.

PowerShell:

```powershell
Invoke-RestMethod -Uri 'http://localhost:8787/api/health' | ConvertTo-Json -Depth 6
```

Expected result:

- `openaiConfigured` should be `true`
- `mcpTarget` should be `Canva MCP`
- `toolCount` should be greater than `0` once Canva tools are discovered

### 2. Non-Mutating Chat Smoke Test

This checks the full UI/backend/OpenAI path without creating or editing Canva content.

PowerShell:

```powershell
$body = @{
  sessionId = 'manual-smoke'
  message = 'What Canva MCP actions can you help with in this app? Keep it short and do not create or modify anything.'
} | ConvertTo-Json

Invoke-RestMethod -Method Post -Uri 'http://localhost:8787/api/chat' -ContentType 'application/json' -Body $body | ConvertTo-Json -Depth 8
```

Expected result:

- a valid assistant reply
- no server crash
- optional `toolEvents` depending on the model's choice

### 3. Canva Read-Only Tool Test

Run one of these in the chat UI after approval:

- `Show me my most recently edited Canva designs`
- `Find my brand presentation and tell me what export formats are available`
- `List the Canva folders I can access`

Expected result:

- the assistant should use Canva MCP tools such as search, get-design, get-export-formats, or folder tools
- the right-side tool activity panel should show the tool calls

### 4. Canva Action Test

Run a real action only if you are comfortable creating or changing Canva content:

- `Create a new Canva presentation titled Q3 launch plan`
- `Create a square social post in Canva for a product teaser`
- `Export my design named Brand Presentation as a PDF`

Expected result:

- the assistant uses Canva MCP tools
- Canva content may be created, updated, or exported depending on the prompt

### 5. Optional Local Fallback Test

If you want to switch away from Canva and test the bundled demo MCP server:

```env
MCP_SERVER_TARGET=local
```

Then restart `npm run dev` and try:

- `Add 18 and 27 using the MCP tool`
- `Add a todo to review Canva MCP`
- `List my todos`

## Notes

- Canva approval and auth are handled by `mcp-remote`, not by custom OAuth code in this repository.
- Some Canva tools depend on the connected Canva plan and scopes.
- The backend connects to MCP lazily on refresh or chat, not at server boot.
- If the first Canva request fails, approve the browser flow and retry the same request.
