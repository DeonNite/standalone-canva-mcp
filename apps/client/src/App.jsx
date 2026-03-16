import { useEffect, useState } from "react";

const welcomeMessage = {
  id: "welcome",
  role: "assistant",
  text:
    "This chat is wired to Canva MCP through OpenAI. Ask me to find designs, create a design, or export one. On first use, refresh or send a prompt and approve Canva access in the browser flow opened by mcp-remote."
};

function App() {
  const [sessionId, setSessionId] = useState(() => crypto.randomUUID());
  const [messages, setMessages] = useState([welcomeMessage]);
  const [composer, setComposer] = useState("");
  const [toolEvents, setToolEvents] = useState([]);
  const [status, setStatus] = useState({
    ok: false,
    loading: true,
    openaiConfigured: false,
    toolCount: 0,
    tools: [],
    model: "unknown",
    mcpTarget: "Canva MCP",
    mcpTargetKey: "canva",
    remoteUrl: null
  });
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    void refreshStatus();
  }, []);

  async function refreshStatus() {
    try {
      const response = await fetch("/api/health");
      const data = await response.json();
      setStatus({
        loading: false,
        ...data
      });
    } catch (error) {
      setStatus({
        ok: false,
        loading: false,
        openaiConfigured: false,
        toolCount: 0,
        tools: [],
        model: "unknown",
        mcpTarget: "Canva MCP",
        mcpTargetKey: "canva",
        remoteUrl: null,
        error: error.message
      });
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const message = composer.trim();
    if (!message || isBusy) {
      return;
    }

    setMessages((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        role: "user",
        text: message
      }
    ]);
    setComposer("");
    setIsBusy(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          sessionId,
          message
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Request failed.");
      }

      setSessionId(data.sessionId);
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          text: data.reply || "No assistant message returned."
        }
      ]);
      setToolEvents(data.toolEvents || []);
      await refreshStatus();
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          text: `Request failed: ${error.message}`
        }
      ]);
    } finally {
      setIsBusy(false);
    }
  }

  async function handleReset() {
    try {
      const response = await fetch("/api/reset", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          sessionId
        })
      });

      const data = await response.json();
      setSessionId(data.sessionId || crypto.randomUUID());
      setMessages([welcomeMessage]);
      setToolEvents([]);
      setComposer("");
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          text: `Unable to reset the session: ${error.message}`
        }
      ]);
    }
  }

  const toolHeading = status.mcpTarget || "MCP";
  const setupMessage =
    status.mcpTargetKey === "canva"
      ? "First use will open Canva approval through mcp-remote. Approve that browser flow, then refresh or send your prompt again."
      : "This mode uses the bundled local demo MCP server.";

  return (
    <div className="page-shell">
      <div className="background-orb orb-left" />
      <div className="background-orb orb-right" />

      <main className="layout">
        <section className="hero-card">
          <p className="eyebrow">React + Node + OpenAI + Canva MCP</p>
          <h1>Chat with Canva through MCP.</h1>
          <p className="hero-copy">
            The backend connects to Canva&apos;s MCP server through mcp-remote,
            exposes the discovered tools to OpenAI, and returns the result here.
          </p>
          <p className="setup-note">{setupMessage}</p>

          <div className="status-grid">
            <article className="status-tile">
              <span className="status-label">Model</span>
              <strong>{status.model}</strong>
            </article>
            <article className="status-tile">
              <span className="status-label">OpenAI key</span>
              <strong>{status.openaiConfigured ? "configured" : "missing"}</strong>
            </article>
            <article className="status-tile">
              <span className="status-label">MCP target</span>
              <strong>{toolHeading}</strong>
            </article>
            <article className="status-tile">
              <span className="status-label">MCP tools</span>
              <strong>{status.loading ? "..." : status.toolCount}</strong>
            </article>
          </div>

          {status.remoteUrl ? <p className="status-meta">Remote MCP URL: {status.remoteUrl}</p> : null}
        </section>

        <section className="panel-grid">
          <section className="panel panel-chat">
            <div className="panel-header">
              <div>
                <h2>Chat</h2>
                <p>Ask me to search Canva, create a design, or export one through MCP.</p>
              </div>
              <button className="ghost-button" type="button" onClick={handleReset}>
                Reset session
              </button>
            </div>

            <div className="chat-log">
              {messages.map((message) => (
                <article
                  key={message.id}
                  className={`message-bubble ${message.role === "user" ? "user" : "assistant"}`}
                >
                  <span className="message-role">{message.role}</span>
                  <p>{message.text}</p>
                </article>
              ))}

              {isBusy ? (
                <article className="message-bubble assistant">
                  <span className="message-role">assistant</span>
                  <p>Connecting to MCP tools and waiting for the model...</p>
                </article>
              ) : null}
            </div>

            <form className="composer" onSubmit={handleSubmit}>
              <textarea
                value={composer}
                onChange={(event) => setComposer(event.target.value)}
                placeholder="Try: create a new presentation in Canva titled Q3 launch plan"
                rows={3}
              />
              <button className="primary-button" type="submit" disabled={isBusy}>
                Send
              </button>
            </form>
          </section>

          <aside className="panel panel-side">
            <div className="panel-header">
              <div>
                <h2>{toolHeading} tools</h2>
                <p>These are discovered from the active MCP target at runtime.</p>
              </div>
              <button className="ghost-button" type="button" onClick={refreshStatus}>
                Refresh
              </button>
            </div>

            <div className="tool-list">
              {status.tools?.length ? (
                status.tools.map((tool) => (
                  <article key={tool.name} className="tool-card">
                    <strong>{tool.name}</strong>
                    <p>{tool.description || "Description not provided by the MCP server."}</p>
                  </article>
                ))
              ) : (
                <article className="empty-card">
                  <strong>No tools discovered yet.</strong>
                  <p>{status.error || setupMessage}</p>
                </article>
              )}
            </div>

            <div className="panel-header secondary">
              <div>
                <h2>Last tool activity</h2>
                <p>Each MCP tool call made for the latest assistant turn appears here.</p>
              </div>
            </div>

            <div className="tool-events">
              {toolEvents.length ? (
                toolEvents.map((event, index) => (
                  <article key={`${event.name}-${index}`} className="event-card">
                    <strong>{event.name}</strong>
                    <p>Arguments: {JSON.stringify(event.arguments)}</p>
                    <p>Result: {event.result?.text || "No text output returned."}</p>
                  </article>
                ))
              ) : (
                <article className="empty-card">
                  <strong>No tool activity yet.</strong>
                  <p>Send a Canva-related request after the MCP connection is approved.</p>
                </article>
              )}
            </div>
          </aside>
        </section>
      </main>
    </div>
  );
}

export default App;
