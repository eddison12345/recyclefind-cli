#!/usr/bin/env node
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";

const SITE = "https://recyclefind.com";

const STATES = new Set(
  ("al ak az ar ca co ct de dc fl ga hi id il in ia ks ky la me md ma mi mn ms mo mt ne nv nh nj nm ny nc nd oh ok or pa ri sc sd tn tx ut vt va wa wv wi wy").split(" "),
);

const TOOLS = {
  recyclable: ["/tools/is-it-recyclable", "Check whether an item is recyclable"],
  carbon: ["/tools/carbon-calculator", "Estimate carbon saved by recycling"],
  scrap: ["/tools/scrap-value-calculator", "Estimate scrap metal value"],
  copper: ["/tools/copper-wire-scrap-value", "Estimate copper wire scrap value"],
  "junk-car": ["/tools/junk-car-value", "Estimate what a junk car is worth"],
  catalytic: ["/tools/catalytic-converter-value", "Estimate catalytic converter value"],
  decomposition: ["/tools/decomposition-time", "See how long materials take to break down"],
  compost: ["/tools/compost-calculator", "Plan a compost pile"],
  dumpster: ["/tools/dumpster-size-calculator", "Pick a dumpster size"],
};

const HELP = `recyclefind - find recycling centers and tools at ${SITE}

Usage
  recyclefind near <city> <state>     City recycling centers (near miami fl)
  recyclefind near <zip>              Centers for a ZIP code (near 33101)
  recyclefind state <state>           All cities in a state (state tx)
  recyclefind search <text>           Search the directory (search car batteries)
  recyclefind materials               Material recycling guides
  recyclefind prices                  Scrap price reports
  recyclefind tools [name]            List tools, or link to one (tools copper)

Options
  -o, --open      Open the page in your browser
  -h, --help      Show this help
  -v, --version   Show the version
`;

class UsageError extends Error {}

function normalizeState(value) {
  const state = (value ?? "").toLowerCase();
  if (!STATES.has(state)) {
    throw new UsageError(`Use a two-letter US state code, for example FL. Got "${value ?? ""}".`);
  }
  return state;
}

function citySlug(words) {
  return words
    .join(" ")
    .trim()
    .toLowerCase()
    .replace(/^st\.?\s+/, "st. ")
    .replace(/\s+/g, "-");
}

async function pageExists(path) {
  try {
    const response = await fetch(`${SITE}${path}`, {
      method: "HEAD",
      redirect: "follow",
      signal: AbortSignal.timeout(5000),
    });
    return response.status !== 404;
  } catch {
    return true;
  }
}

function searchPath(text) {
  return `/search?q=${encodeURIComponent(text)}`;
}

async function near(args) {
  if (args.length === 1 && /^\d{5}$/.test(args[0])) return searchPath(args[0]);
  if (args.length < 2) throw new UsageError("Usage: recyclefind near <city> <state>, or recyclefind near <zip>");
  const state = normalizeState(args.at(-1));
  const cityWords = args.slice(0, -1);
  const cityPath = `/listings/state/${state}/${encodeURIComponent(citySlug(cityWords))}`;
  if (await pageExists(cityPath)) return cityPath;
  return searchPath(`${cityWords.join(" ")} ${state.toUpperCase()}`);
}

function toolsOutput(args) {
  if (args.length === 0) {
    const width = Math.max(...Object.keys(TOOLS).map((name) => name.length));
    const lines = Object.entries(TOOLS).map(
      ([name, [path, label]]) => `  ${name.padEnd(width)}  ${label}\n  ${" ".repeat(width)}  ${SITE}${path}`,
    );
    return { text: `RecycleFind tools\n\n${lines.join("\n")}\n\nAll tools: ${SITE}/tools`, url: `${SITE}/tools` };
  }
  const tool = TOOLS[args[0].toLowerCase()];
  if (!tool) throw new UsageError(`Unknown tool "${args[0]}". Run "recyclefind tools" for the list.`);
  return { text: `${SITE}${tool[0]}`, url: `${SITE}${tool[0]}` };
}

async function route(command, args) {
  const link = (path) => ({ text: `${SITE}${path}`, url: `${SITE}${path}` });
  switch (command) {
    case "near":
      return link(await near(args));
    case "state":
      return link(`/listings/state/${normalizeState(args[0])}`);
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
    const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
    console.log(pkg.version);
    return;
  }
  if (values.help || positionals.length === 0) {
    console.log(HELP);
    return;
  }

  const [command, ...args] = positionals;
  const result = await route(command.toLowerCase(), args);
  console.log(result.text);
  if (values.open) openInBrowser(result.url);
}

main().catch((error) => {
  if (!(error instanceof UsageError)) throw error;
  console.error(error.message);
  process.exitCode = 1;
});
