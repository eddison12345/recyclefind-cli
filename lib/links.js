export const SITE = "https://recyclefind.com";

const STATES = new Set(
  ("al ak az ar ca co ct de dc fl ga hi id il in ia ks ky la me md ma mi mn ms mo mt ne nv nh nj nm ny nc nd oh ok or pa ri sc sd tn tx ut vt va wa wv wi wy").split(" "),
);

export const TOOLS = {
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

export class UsageError extends Error {}

export function normalizeState(value) {
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

export function searchPath(text) {
  return `/search?q=${encodeURIComponent(text)}`;
}

export function statePath(state) {
  return `/listings/state/${normalizeState(state)}`;
}

export async function nearPath(args) {
  if (args.length === 1 && /^\d{5}$/.test(args[0])) return searchPath(args[0]);
  if (args.length < 2) throw new UsageError("Usage: recyclefind near <city> <state>, or recyclefind near <zip>");
  const state = normalizeState(args.at(-1));
  const cityWords = args.slice(0, -1);
  const cityPath = `${statePath(state)}/${encodeURIComponent(citySlug(cityWords))}`;
  if (await pageExists(cityPath)) return cityPath;
  return searchPath(`${cityWords.join(" ")} ${state.toUpperCase()}`);
}

export function toolPath(name) {
  const key = String(name).toLowerCase();
  if (!Object.hasOwn(TOOLS, key)) {
    throw new UsageError(`Unknown tool "${name}". Available tools: ${Object.keys(TOOLS).join(", ")}.`);
  }
  return TOOLS[key][0];
}
