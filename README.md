# MCP Demo Playground

This scaffold is now focused on letting your own chatbot use OpenAI to perform Canva MCP actions.

## What is included

- `apps/client`: a Vite + React chat UI
- `apps/server`: an Express backend that calls the OpenAI Responses API
- `apps/server/src/mcpBridge.js`: a configurable MCP bridge that defaults to Canva via `mcp-remote`
- `packages/local-mcp-server`: the earlier local demo MCP server, kept as an optional fallback

## Default architecture

1. The React app sends a chat message to the Node backend.
2. The backend connects to Canva's MCP server through `mcp-remote`.
3. The backend advertises the discovered MCP tools to OpenAI as callable functions.
4. If the model chooses a tool, the backend executes it through the MCP client.
5. The assistant reply and tool activity are returned to the UI.

This matches Canva's documented MCP setup, which uses:

```bash
npx -y mcp-remote@latest https://mcp.canva.com/mcp
```

Source: https://www.canva.dev/docs/connect/canva-mcp-server-setup/

## Run it

1. Copy `.env.example` to `.env` if you have not already
2. Add your `OPENAI_API_KEY`
3. Keep `MCP_SERVER_TARGET=canva` for Canva mode
4. Install dependencies with `npm install`
5. Start both apps with `npm run dev`
6. Open `http://localhost:5173`
7. Click `Refresh` or send a prompt
8. Approve the Canva browser flow opened by `mcp-remote`

The backend runs on `http://localhost:8787`.

## Example Canva prompts

- `Show me my most recently edited Canva designs`
- `Create a new Canva presentation titled Q3 launch plan`
- `Find my brand presentation and export it as a PDF`
- `Create a square social post in Canva for a product teaser`

Actual tool availability depends on the Canva account and plan connected during the MCP approval flow.

## Optional local fallback

If you want to switch back to the bundled local demo tools instead of Canva, set:

```env
MCP_SERVER_TARGET=local
```

That mode uses the server in `packages/local-mcp-server` and exposes these sample tools:

- `add_numbers`
- `list_todos`
- `add_todo`
- `complete_todo`
- `clear_completed`

## Notes

- Canva's setup docs say `mcp-remote` will open a browser tab so you can approve access.
- Canva's docs also note some features depend on your Canva plan.
- The server no longer tries to connect to MCP at boot; it connects lazily when the UI refreshes or sends a chat message.
