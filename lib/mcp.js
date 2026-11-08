import { createInterface } from "node:readline";
import { SITE, TOOLS, UsageError, nearPath, searchPath, statePath, toolPath } from "./links.js";

const PROTOCOL_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, openWorldHint: true };

const objectSchema = (properties = {}, required = []) => ({
  type: "object",
  properties,
  required,
  additionalProperties: false,
});

const url = (path) => `${SITE}${path}`;

function requireText(args, key) {
  const value = args[key];
  if (typeof value !== "string" || value.trim() === "") throw new UsageError(`"${key}" is required.`);
  return value.trim();
}

async function findCenters(args) {
  if (typeof args.zip === "string" && args.zip.trim() !== "") {
    const zip = args.zip.trim();
    if (!/^\d{5}$/.test(zip)) throw new UsageError("\"zip\" must be a five-digit US ZIP code.");
    return `Recycling centers for ZIP ${zip}: ${url(await nearPath([zip]))}\nThe page lists addresses, hours, and accepted materials.`;
  }
  const city = requireText(args, "city");
  const state = requireText(args, "state");
  return `Recycling centers for ${city}, ${state.toUpperCase()}: ${url(await nearPath([city, state]))}\nThe page lists addresses, hours, and accepted materials.`;
}

const HANDLERS = {
  find_recycling_centers: {
    description: "Get the RecycleFind page for recycling centers and scrap yards in a US city or ZIP code. Provide zip, or city and state.",
    inputSchema: objectSchema({
      city: { type: "string", description: "City name, for example Miami" },
      state: { type: "string", description: "Two-letter US state code, for example FL" },
      zip: { type: "string", description: "Five-digit US ZIP code" },
    }),
    run: findCenters,
  },
  browse_state: {
    description: "Get the RecycleFind page listing recycling locations across a US state.",
    inputSchema: objectSchema({ state: { type: "string", description: "Two-letter US state code" } }, ["state"]),
    run: (args) => `RecycleFind locations in ${requireText(args, "state").toUpperCase()}: ${url(statePath(args.state.trim()))}`,
  },
  search_directory: {
    description: "Get a RecycleFind search link for a material, business, or place, such as car batteries.",
    inputSchema: objectSchema({ query: { type: "string", description: "What to search for" } }, ["query"]),
    run: (args) => `RecycleFind search results: ${url(searchPath(requireText(args, "query")))}`,
  },
  get_recycling_calculator: {
    description: "Get the link to a free RecycleFind recycling calculator or checker.",
    inputSchema: objectSchema(
      { name: { type: "string", enum: Object.keys(TOOLS), description: "Calculator to open" } },
      ["name"],
    ),
    run: (args) => {
      const name = requireText(args, "name");
      const path = toolPath(name);
      return `${TOOLS[name.toLowerCase()][1]}: ${url(path)}`;
    },
  },
  get_recycling_guides: {
    description: "Get links to RecycleFind material recycling guides, scrap price reports, and all calculators.",
    inputSchema: objectSchema(),
    run: () => `Material guides: ${url("/materials")}\nScrap price reports: ${url("/scrap-prices")}\nAll calculators: ${url("/tools")}`,
  },
};

const success = (id, result) => ({ jsonrpc: "2.0", id, result });
const failure = (id, code, message) => ({ jsonrpc: "2.0", id, error: { code, message } });

async function handle(message, version) {
  const { id, method, params } = message;
  switch (method) {
    case "initialize":
      return success(id, {
        protocolVersion: PROTOCOL_VERSIONS.includes(params?.protocolVersion) ? params.protocolVersion : PROTOCOL_VERSIONS[0],
        capabilities: { tools: {} },
        serverInfo: { name: "recyclefind", title: "RecycleFind", version },
        instructions: "Each tool returns a RecycleFind page link. Share the link so the user can see addresses, hours, accepted materials, and prices.",
      });
    case "ping":
      return success(id, {});
    case "tools/list":
      return success(id, {
        tools: Object.entries(HANDLERS).map(([name, { description, inputSchema }]) => ({
          name,
          description,
          inputSchema,
          annotations: READ_ONLY,
        })),
      });
    case "tools/call": {
      const tool = Object.hasOwn(HANDLERS, params?.name ?? "") ? HANDLERS[params.name] : null;
      if (!tool) return failure(id, -32602, `Unknown tool: ${params?.name}`);
      try {
        const text = await tool.run(params.arguments ?? {});
        return success(id, { content: [{ type: "text", text }], isError: false });
      } catch (error) {
        if (!(error instanceof UsageError)) throw error;
        return success(id, { content: [{ type: "text", text: error.message }], isError: true });
      }
    }
    default:
      return failure(id, -32601, `Method not found: ${method}`);
  }
}

export function serveMcp(version) {
  const send = (message) => process.stdout.write(`${JSON.stringify(message)}\n`);
  const lines = createInterface({ input: process.stdin, crlfDelay: Infinity });

  lines.on("line", async (line) => {
    if (line.trim() === "") return;
    let message;
    try {
      message = JSON.parse(line);
    } catch {
      send(failure(null, -32700, "Parse error"));
      return;
    }
    if (message === null || typeof message !== "object" || message.id === undefined) return;
    try {
      send(await handle(message, version));
    } catch (error) {
      console.error(error);
      send(failure(message.id, -32603, "Internal error"));
    }
  });
}
