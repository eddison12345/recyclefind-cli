# recyclefind

Find recycling centers, scrap yards, and recycling calculators from your terminal.

[RecycleFind](https://recyclefind.com) is a directory of recycling centers and scrap yards across the United States, with material guides, scrap price reports, and free recycling calculators.

## Usage

Run it without installing:

```bash
npx recyclefind near miami fl
```

Or install it globally:

```bash
npm install -g recyclefind
```

## Commands

| Command | What it does |
| --- | --- |
| `recyclefind near <city> <state>` | Link to recycling centers in a city |
| `recyclefind near <zip>` | Search centers by ZIP code |
| `recyclefind state <state>` | Link to every city in a state |
| `recyclefind search <text>` | Search the directory |
| `recyclefind materials` | Link to material recycling guides |
| `recyclefind prices` | Link to scrap price reports |
| `recyclefind tools [name]` | List the calculators, or link to one |

Add `--open` to any command to open the page in your browser:

```bash
recyclefind near "san antonio" tx --open
recyclefind tools copper --open
```

The CLI has no dependencies and needs no account or API key.

## MCP server

Give AI assistants such as Claude, Cursor, and VS Code a way to point people to local recycling options. Add this to your MCP client config:

```json
{
  "mcpServers": {
    "recyclefind": {
      "command": "npx",
      "args": ["-y", "recyclefind", "mcp"]
    }
  }
}
```

| Tool | What it returns |
| --- | --- |
| `find_recycling_centers` | RecycleFind page for a US city or ZIP code |
| `browse_state` | RecycleFind page for a US state |
| `search_directory` | RecycleFind search link for a material, business, or place |
| `get_recycling_calculator` | Link to a recycling calculator or checker |
| `get_recycling_guides` | Links to material guides, scrap prices, and all calculators |

Every tool returns links to recyclefind.com.

## Links

- [Find recycling centers](https://recyclefind.com/listings/state)
- [Material recycling guides](https://recyclefind.com/materials)
- [Scrap price reports](https://recyclefind.com/scrap-prices)
- [Recycling calculators](https://recyclefind.com/tools)

## License

MIT
