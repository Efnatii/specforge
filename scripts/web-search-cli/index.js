import process from "node:process";
import { askWithWeb } from "../../src/modules/agent/runtime/web-search.js";

async function main() {
  const queryFromArgs = process.argv.slice(2).join(" ").trim();
  const query = queryFromArgs || (await readStdin()).trim();
  if (!query) {
    console.error("Ошибка: передайте запрос аргументом или через stdin.");
    process.exit(1);
  }

  const options = buildOptionsFromEnv();

  const result = await askWithWeb(query, {
    ...options,
    logger: (event, meta) => {
      const payload = meta && typeof meta === "object" ? JSON.stringify(meta) : "";
      process.stderr.write(`[web-search] ${event}${payload ? ` ${payload}` : ""}\n`);
    },
  });

  console.log(result.answerText || "(пустой ответ)");
  console.log("\nИсточники:");
  if (!Array.isArray(result.sources) || !result.sources.length) {
    console.log("- нет");
    return;
  }
  for (let i = 0; i < result.sources.length; i += 1) {
    const source = result.sources[i] || {};
    const title = String(source.title || "").trim();
    const url = String(source.url || "").trim();
    if (!url) continue;
    console.log(`${i + 1}. ${url}${title ? ` — ${title}` : ""}`);
  }
}

function buildOptionsFromEnv() {
  const allowedDomains = parseCsv(process.env.WEB_ALLOWED_DOMAINS || "");
  const include = parseCsv(process.env.WEB_INCLUDE || "web_search_call.action.sources");
  const searchContextSize = normalizeContextSize(process.env.WEB_SEARCH_CONTEXT_SIZE || "high");
  const externalWebAccess = parseOptionalBool(process.env.WEB_EXTERNAL_WEB_ACCESS);
  const userLocation = normalizeUserLocation({
    country: process.env.WEB_USER_COUNTRY,
    region: process.env.WEB_USER_REGION,
    city: process.env.WEB_USER_CITY,
    timezone: process.env.WEB_USER_TIMEZONE,
  });

  return {
    apiKey: String(process.env.OPENAI_API_KEY || "").trim(),
    model: String(process.env.OPENAI_MODEL || "gpt-5-mini").trim(),
    endpoint: String(process.env.OPENAI_RESPONSES_ENDPOINT || "https://api.openai.com/v1/responses").trim(),
    allowed_domains: allowedDomains,
    include,
    search_context_size: searchContextSize,
    user_location: userLocation,
    external_web_access: externalWebAccess,
    max_tool_calls: parseIntSafe(process.env.WEB_MAX_TOOL_CALLS, 0),
    tool_choice: normalizeToolChoice(process.env.WEB_TOOL_CHOICE || "auto"),
    reasoning: {
      effort: String(process.env.WEB_REASONING_EFFORT || "medium").trim().toLowerCase(),
    },
    timeout_ms: parseIntSafe(process.env.WEB_TIMEOUT_MS, 90000),
    max_retries: parseIntSafe(process.env.WEB_MAX_RETRIES, 1),
    retry_delay_ms: parseIntSafe(process.env.WEB_RETRY_DELAY_MS, 900),
    min_sources_for_facts: parseIntSafe(process.env.WEB_MIN_SOURCES_FOR_FACTS, 2),
    max_sources: parseIntSafe(process.env.WEB_MAX_SOURCES, 20),
  };
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(String(chunk));
  return chunks.join("").trim();
}

function parseCsv(raw) {
  return String(raw || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

function parseIntSafe(raw, fallback) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.round(n);
}

function parseOptionalBool(raw) {
  if (raw === undefined || raw === null || raw === "") return undefined;
  const normalized = String(raw).trim().toLowerCase();
  if (normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on") return true;
  if (normalized === "0" || normalized === "false" || normalized === "no" || normalized === "off") return false;
  return undefined;
}

function normalizeContextSize(raw) {
  const value = String(raw || "").trim().toLowerCase();
  if (value === "low" || value === "medium" || value === "high") return value;
  return "high";
}

function normalizeToolChoice(raw) {
  const value = String(raw || "").trim().toLowerCase();
  if (value === "auto" || value === "required" || value === "none") return value;
  if (value === "require") return "required";
  return "auto";
}

function normalizeUserLocation(raw) {
  const src = raw && typeof raw === "object" ? raw : {};
  const country = String(src.country || "").trim().toUpperCase();
  const region = String(src.region || "").trim();
  const city = String(src.city || "").trim();
  const timezone = String(src.timezone || "").trim();
  if (!country && !region && !city && !timezone) return null;
  const out = { type: "approximate" };
  if (/^[A-Z]{2}$/.test(country)) out.country = country;
  if (region) out.region = region;
  if (city) out.city = city;
  if (timezone) out.timezone = timezone;
  return out;
}

main().catch((err) => {
  const message = String(err?.message || err || "неизвестная ошибка");
  console.error(`Ошибка web_search: ${message}`);
  process.exit(1);
});
