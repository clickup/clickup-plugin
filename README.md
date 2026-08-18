# ClickUp Plugin

Connect your ClickUp workspace to your favorite AI coding tools. Manage tasks, track time, search your workspace, and more — without switching context.

## Install

### Claude Code

From the terminal:
```bash
claude plugin marketplace add clickup/clickup-plugin
claude plugin install clickup@clickup-plugin-marketplace
```

Or from inside Claude Code:
```
/plugin marketplace add clickup/clickup-plugin
/plugin install clickup@clickup-plugin-marketplace
```

### Cursor

Install from the [Cursor Marketplace](https://cursor.com/marketplace) — search for **ClickUp**.

### Microsoft 365 Copilot ([Cowork](https://learn.microsoft.com/en-us/microsoft-365/copilot/cowork/cowork-manage-plugins))

In Cowork, open **Sources & Skills** → **Plugins** and find **ClickUp** under Discover, or ask your admin to deploy it from the Microsoft 365 admin center. The app package source lives in [`m365/`](./m365/).

### Other clients (Agent Plugins standard)

This repo also ships a portable [Agent Plugins](https://agent-plugins.org/) package (root `plugin.json` + `mcp.json`), so it works in any client that supports the open standard — including OpenAI Codex, GitHub Copilot / VS Code, Kiro, and Cursor. Follow your client's plugin install flow and point it at this repository.

## What's Included

### MCP Server

The plugin connects to ClickUp's hosted MCP server, giving your AI assistant access to your workspace.

[See the list of supported tools](https://developer.clickup.com/docs/mcp-tools).

#### Authentication

On first use, you'll be prompted to authorize with your ClickUp account via OAuth.

#### Troubleshooting

**OAuth not triggering?** Make sure your editor supports remote MCP servers with OAuth (Cursor 0.42+).

**MCP not loading?** Try installing manually:
```json
{
  "mcpServers": {
    "clickup": {
      "type": "http",
      "url": "https://mcp.clickup.com/mcp"
    }
  }
}
```
Or the stdio fallback:

```json
{
  "mcpServers": {
    "clickup": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://mcp.clickup.com/mcp"]
    }
  }
}
```

## Links

- [ClickUp MCP Docs](https://developer.clickup.com/docs/connect-an-ai-assistant-to-clickups-mcp-server)
