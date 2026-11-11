# cord-mcp

Connects AI agents to [Cord](https://github.com/cord-note/cord), the local-first
note app. Agents can search and read your notes, and, if you allow it, create
notes, add text, tag and set fields.

It contains:

- **an MCP server** (`server/bridge.mjs`): a small bridge from the agent to the
  Cord app running on your computer. No dependencies, Node 18 or newer.
- **a skill** (`skills/cord/SKILL.md`): teaches the agent how Cord stores notes
  (vaults, blocks, wiki links, tags with fields) and how to write notes Cord
  renders well, so it can make notes for Cord even without the server.

Cord itself decides what agents may do. In Cord's **Agents** tab you allow
agents, pick the vaults they see, turn editing on or off, and make the token.
Agents only reach Cord while it is open and unlocked. Nothing leaves your
computer: the server listens on `127.0.0.1` only.

## Requirements

- Cord 3.0 or newer, which has the **Agents** tab (first beta: `v3.0.0-beta.1`)
- Node 18 or newer (Claude Desktop brings its own)

## Claude Code

```bash
/plugin marketplace add cord-note/cord-mcp
/plugin install cord@cord-note
```

Claude Code asks for the token when you enable the plugin and keeps it in your
system's secure storage. The plugin adds the Cord tools and the `cord` skill.

## Claude Desktop

Download `cord.mcpb` from the releases page and open it. Claude Desktop asks
for the token.

Or add Cord by hand to `claude_desktop_config.json`. The Agents tab in Cord
shows this block ready to copy, with the right path:

```json
{
  "mcpServers": {
    "cord": {
      "command": "<path to the Cord executable>",
      "args": ["--mcp"],
      "env": { "CORD_MCP_TOKEN": "your token" }
    }
  }
}
```

## Other clients

Any MCP client that starts a server process works. Either run the Cord app
itself in bridge mode:

```bash
cord --mcp
```

or this repo's bridge:

```bash
node server/bridge.mjs
```

Both read the token from `CORD_MCP_TOKEN`. Set `CORD_DATA_DIR` only if you
run Cord with a custom data folder.

## The skill on its own

The skill is plain Markdown. To use it without the plugin, copy
`skills/cord/` into `~/.claude/skills/` (Claude Code), or upload it as a skill
in Claude.

## Development

```bash
npm test
```

```bash
npm run pack:desktop
```

## License

AGPL-3.0, like Cord.
