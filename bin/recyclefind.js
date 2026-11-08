#!/usr/bin/env node
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { SITE, TOOLS, UsageError, nearPath, searchPath, statePath, toolPath } from "../lib/links.js";
import { serveMcp } from "../lib/mcp.js";

const { version } = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

const HELP = `recyclefind - find recycling centers and tools at ${SITE}

Usage
  recyclefind near <city> <state>     City recycling centers (near miami fl)
  recyclefind near <zip>              Centers for a ZIP code (near 33101)
  recyclefind state <state>           All cities in a state (state tx)
  recyclefind search <text>           Search the directory (search car batteries)
  recyclefind materials               Material recycling guides
  recyclefind prices                  Scrap price reports
  recyclefind tools [name]            List tools, or link to one (tools copper)
  recyclefind mcp                     Start the MCP server for AI assistants

Options
  -o, --open      Open the page in your browser
  -h, --help      Show this help
  -v, --version   Show the version
`;

function toolsOutput(args) {
  if (args.length > 0) {
    const url = `${SITE}${toolPath(args[0])}`;
    return { text: url, url };
  }
  const width = Math.max(...Object.keys(TOOLS).map((name) => name.length));
  const lines = Object.entries(TOOLS).map(
    ([name, [path, label]]) => `  ${name.padEnd(width)}  ${label}\n  ${" ".repeat(width)}  ${SITE}${path}`,
  );
  return { text: `RecycleFind tools\n\n${lines.join("\n")}\n\nAll tools: ${SITE}/tools`, url: `${SITE}/tools` };
}

async function route(command, args) {
  const link = (path) => ({ text: `${SITE}${path}`, url: `${SITE}${path}` });
  switch (command) {
    case "near":
      return link(await nearPath(args));
    case "state":
      return link(statePath(args[0]));
    case "search":
      if (args.length === 0) throw new UsageError("Usage: recyclefind search <text>");
      return link(searchPath(args.join(" ")));
    case "materials":
      return link("/materials");
    case "prices":
      return link("/scrap-prices");
    case "tools":
      return toolsOutput(args);
    default:
      throw new UsageError(`Unknown command "${command}". Run "recyclefind --help".`);
  }
}

function openInBrowser(url) {
  const [file, args] =
    process.platform === "win32"
      ? ["rundll32", ["url.dll,FileProtocolHandler", url]]
      : [process.platform === "darwin" ? "open" : "xdg-open", [url]];
  const child = spawn(file, args, { stdio: "ignore", detached: true });
  child.on("error", () => console.error("Could not open a browser. Use the link above."));
  child.unref();
}

async function main() {
  let parsed;
  try {
    parsed = parseArgs({
      allowPositionals: true,
      options: {
        open: { type: "boolean", short: "o" },
        help: { type: "boolean", short: "h" },
        version: { type: "boolean", short: "v" },
      },
    });
  } catch (error) {
    throw new UsageError(error.message);
  }

  const { values, positionals } = parsed;
  if (values.version) {
    console.log(version);
    return;
  }
  if (values.help || positionals.length === 0) {
    console.log(HELP);
    return;
  }

  const [command, ...args] = positionals;
  if (command.toLowerCase() === "mcp") {
    serveMcp(version);
    return;
  }

  const result = await route(command.toLowerCase(), args);
  console.log(result.text);
  if (values.open) openInBrowser(result.url);
}

main().catch((error) => {
  if (!(error instanceof UsageError)) throw error;
  console.error(error.message);
  process.exitCode = 1;
});
