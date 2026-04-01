# ClickUp Plugin

Connect your ClickUp workspace to your favorite AI coding tools. Manage tasks, track time, search your workspace, and more — without switching context.

## Install

### Cursor

Install from the [Cursor Marketplace](https://cursor.com/marketplace) — search for **ClickUp**.

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
