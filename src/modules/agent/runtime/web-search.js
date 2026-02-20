const DEFAULT_ENDPOINT = "https://api.openai.com/v1/responses";
const DEFAULT_MODEL = "gpt-5-mini";
const DEFAULT_TIMEOUT_MS = 90000;
const DEFAULT_RETRIES = 1;
const DEFAULT_RETRY_DELAY_MS = 900;
const DEFAULT_INCLUDE = ["web_search_call.action.sources"];
const DEFAULT_MIN_SOURCES = 2;
const DEFAULT_MAX_SOURCES = 20;

export function createResponsesWebSearchClient(baseOptions = {}) {
  return {
    askWithWeb: (query, options = {}) => askWithWeb(query, { ...baseOptions, ...options }),
  };
}

export async function askWithWeb(query, options = {}) {
  const cfg = normalizeOptions(options);
  const log = createLogger(cfg.logger);
  const prompt = normalizeQuery(query);

  if (!prompt) throw new Error("Запрос пустой: передайте непустой текст в askWithWeb(query, opts).");
  if (!cfg.apiKey) throw new Error("Отсутствует OpenAI API key: передайте opts.apiKey или переменную окружения OPENAI_API_KEY.");
  if (cfg.externalWebAccess === false) {
    throw new Error("Внешний веб-доступ отключен (external_web_access=false), web_search не может быть выполнен.");
  }

  const requestMeta = {
    model: cfg.model,
    search_context_size: cfg.searchContextSize,
    allowed_domains: cfg.allowedDomains,
    user_location: cfg.userLocation,
    max_tool_calls: cfg.maxToolCalls,
    tool_choice: cfg.toolChoice,
    include: cfg.include,
    reasoning: cfg.reasoning,
    min_sources_for_facts: cfg.minSourcesForFacts,
  };

  log("web_search.start", { query_preview: trimForLog(prompt, 200), request: requestMeta });

  const payload = buildPayload(prompt, cfg);
  const response = await callResponsesWithRetry(payload, cfg, log);
  const answerText = extractAnswerText(response);
  const sources = extractToolSources(response, {
    allowedDomains: cfg.allowedDomains,
    maxSources: cfg.maxSources,
  });

  log("web_search.sources.collected", {
    count: sources.length,
    min_required: cfg.minSourcesForFacts,
  });

  if (sources.length < cfg.minSourcesForFacts) {
    log("web_search.sources.insufficient", {
      count: sources.length,
      min_required: cfg.minSourcesForFacts,
    });
  }

  return {
    answerText,
    sources,
  };
}

function normalizeOptions(raw) {
  const opts = raw && typeof raw === "object" ? raw : {};
  const env = typeof process !== "undefined" && process?.env ? process.env : {};

  const apiKey = String(opts.apiKey || env.OPENAI_API_KEY || "").trim();
  const model = String(opts.model || env.OPENAI_MODEL || DEFAULT_MODEL).trim();
  const endpoint = String(opts.endpoint || env.OPENAI_RESPONSES_ENDPOINT || DEFAULT_ENDPOINT).trim();
  const timeoutMs = normalizeInt(opts.timeout_ms ?? opts.timeoutMs, DEFAULT_TIMEOUT_MS, 1000, 600000);
  const maxRetries = normalizeInt(opts.max_retries ?? opts.maxRetries, DEFAULT_RETRIES, 0, 2);
  const retryDelayMs = normalizeInt(opts.retry_delay_ms ?? opts.retryDelayMs, DEFAULT_RETRY_DELAY_MS, 100, 15000);
  const maxToolCalls = normalizeInt(opts.max_tool_calls ?? opts.maxToolCalls, 0, 0, 100000);
  const toolChoice = normalizeToolChoice(opts.tool_choice ?? opts.toolChoice, "auto");
  const searchContextSize = normalizeSearchContextSize(opts.search_context_size ?? opts.searchContextSize, "high");
  const include = normalizeInclude(opts.include, DEFAULT_INCLUDE);
  const allowedDomains = normalizeAllowedDomains(opts.allowed_domains ?? opts.allowedDomains);
  const userLocation = normalizeUserLocation(opts.user_location ?? opts.userLocation);
  const externalWebAccess = normalizeOptionalBoolean(opts.external_web_access ?? opts.externalWebAccess);
  const reasoningEffort = normalizeReasoningEffort(
    opts?.reasoning?.effort ?? opts.reasoning_effort ?? opts.reasoningEffort,
    "medium",
  );
  const minSourcesForFacts = normalizeInt(
    opts.min_sources_for_facts ?? opts.minSourcesForFacts,
    DEFAULT_MIN_SOURCES,
    1,
    20,
  );
  const maxSources = normalizeInt(opts.max_sources ?? opts.maxSources, DEFAULT_MAX_SOURCES, minSourcesForFacts, 200);
  const fetchFn = typeof opts.fetchFn === "function" ? opts.fetchFn : null;
  const logger = typeof opts.logger === "function" ? opts.logger : null;

  return {
    apiKey,
    model,
    endpoint,
    timeoutMs,
    maxRetries,
    retryDelayMs,
    maxToolCalls,
    toolChoice,
    searchContextSize,
    include,
    allowedDomains,
    userLocation,
    externalWebAccess,
    reasoning: { effort: reasoningEffort },
    minSourcesForFacts,
    maxSources,
    fetchFn,
    logger,
  };
}

function normalizeQuery(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeInt(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return clampInt(fallback, min, max);
  return clampInt(n, min, max);
}

function clampInt(value, min, max) {
  const n = Math.round(Number(value) || 0);
  return Math.max(min, Math.min(max, n));
}

function normalizeToolChoice(value, fallback = "auto") {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "auto" || raw === "required" || raw === "none") return raw;
  const fb = String(fallback || "").trim().toLowerCase();
  if (fb === "auto" || fb === "required" || fb === "none") return fb;
  return "auto";
}

function normalizeSearchContextSize(value, fallback = "high") {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "low" || raw === "medium" || raw === "high") return raw;
  const fb = String(fallback || "").trim().toLowerCase();
  if (fb === "low" || fb === "medium" || fb === "high") return fb;
  return "high";
}

function normalizeReasoningEffort(value, fallback = "medium") {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "minimal" || raw === "low" || raw === "medium" || raw === "high" || raw === "xhigh" || raw === "none") return raw;
  const fb = String(fallback || "").trim().toLowerCase();
  if (fb === "minimal" || fb === "low" || fb === "medium" || fb === "high" || fb === "xhigh" || fb === "none") return fb;
  return "medium";
}

function normalizeInclude(value, fallback) {
  const list = Array.isArray(value) ? value : fallback;
  const out = [];
  const seen = new Set();
  for (const item of list || []) {
    const key = String(item || "").trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  if (!out.length) out.push("web_search_call.action.sources");
  return out;
}

function normalizeAllowedDomains(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  const seen = new Set();
  for (const item of value) {
    const raw = String(item || "").trim();
    if (!raw) continue;
    const domain = normalizeDomain(raw);
    if (!domain || seen.has(domain)) continue;
    seen.add(domain);
    out.push(domain);
  }
  return out;
}

function normalizeDomain(raw) {
  const txt = String(raw || "").trim().toLowerCase();
  if (!txt) return "";
  try {
    const url = txt.includes("://") ? new URL(txt) : new URL(`https://${txt}`);
    const host = String(url.hostname || "").replace(/^www\./, "").trim().toLowerCase();
    return /^[a-z0-9.-]+$/.test(host) ? host : "";
  } catch {
    return "";
  }
}

function normalizeUserLocation(value) {
  if (!value) return null;
  if (typeof value === "string") {
    const country = value.trim().toUpperCase();
    if (/^[A-Z]{2}$/.test(country)) {
      return { type: "approximate", country };
    }
    return null;
  }
  if (typeof value !== "object") return null;
  const type = String(value.type || "approximate").trim().toLowerCase();
  const out = {
    type: type === "approximate" ? "approximate" : "approximate",
  };
  const country = String(value.country || "").trim().toUpperCase();
  if (/^[A-Z]{2}$/.test(country)) out.country = country;
  const region = String(value.region || "").trim();
  if (region) out.region = region.slice(0, 80);
  const city = String(value.city || "").trim();
  if (city) out.city = city.slice(0, 80);
  const timezone = String(value.timezone || "").trim();
  if (timezone) out.timezone = timezone.slice(0, 80);
  return out;
}

function normalizeOptionalBoolean(value) {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "boolean") return value;
  const raw = String(value).trim().toLowerCase();
  if (raw === "1" || raw === "true" || raw === "on" || raw === "yes") return true;
  if (raw === "0" || raw === "false" || raw === "off" || raw === "no") return false;
  return undefined;
}

function buildPayload(query, cfg) {
  const instructions = buildWebSearchInstructions(cfg.allowedDomains);
  const payload = {
    model: cfg.model,
    input: [{ role: "user", content: [{ type: "input_text", text: query }] }],
    tools: [buildWebSearchTool(cfg)],
    tool_choice: cfg.toolChoice,
    include: cfg.include,
    reasoning: cfg.reasoning,
    instructions,
  };

  if (cfg.maxToolCalls > 0) payload.max_tool_calls = cfg.maxToolCalls;
  if (!cfg.reasoning?.effort) delete payload.reasoning;
  if (!instructions) delete payload.instructions;
  return payload;
}

function buildWebSearchTool(cfg) {
  const tool = {
    type: "web_search",
    search_context_size: cfg.searchContextSize,
  };
  if (cfg.userLocation) tool.user_location = cfg.userLocation;
  if (cfg.allowedDomains.length) tool.allowed_domains = cfg.allowedDomains;
  if (typeof cfg.externalWebAccess === "boolean") tool.external_web_access = cfg.externalWebAccess;
  return tool;
}

function buildWebSearchInstructions(allowedDomains) {
  if (!Array.isArray(allowedDomains) || !allowedDomains.length) return "";
  return `Ограничение источников: используй web_search только по доменам: ${allowedDomains.join(", ")}.`;
}

function createLogger(loggerFn) {
  return (event, meta = {}) => {
    if (typeof loggerFn !== "function") return;
    try {
      loggerFn(event, meta);
    } catch {}
  };
}

async function callResponsesWithRetry(payload, cfg, log) {
  let attempt = 0;
  let compatibilityFallbackUsed = false;
  while (attempt <= cfg.maxRetries) {
    const startedAt = Date.now();
    log("web_search.request.attempt", { attempt: attempt + 1, max_attempts: cfg.maxRetries + 1 });
    try {
      const response = await callResponsesOnce(payload, cfg, log);
      log("web_search.request.success", {
        attempt: attempt + 1,
        duration_ms: Date.now() - startedAt,
      });
      return response;
    } catch (err) {
      if (!compatibilityFallbackUsed && shouldUseWebToolCompatibilityFallback(err, payload)) {
        compatibilityFallbackUsed = true;
        stripExtendedWebToolFields(payload);
        log("web_search.request.compat_fallback", {
          reason: String(err?.api_message || err?.message || "unsupported web_search fields"),
        });
        continue;
      }
      const retryable = isRetryableError(err);
      const canRetry = retryable && attempt < cfg.maxRetries;
      log("web_search.request.error", {
        attempt: attempt + 1,
        retryable,
        can_retry: canRetry,
        message: String(err?.message || err),
      });
      if (!canRetry) throw decorateError(err, attempt + 1);
      attempt += 1;
      const delay = cfg.retryDelayMs * attempt;
      log("web_search.request.retry_wait", { delay_ms: delay });
      await sleep(delay);
    }
  }
  throw new Error("Не удалось выполнить web_search: исчерпаны попытки запроса.");
}

function shouldUseWebToolCompatibilityFallback(err, payload) {
  const status = Number(err?.status || 0);
  if (status !== 400) return false;
  const msg = String(err?.api_message || err?.message || "").toLowerCase();
  if (!msg) return false;
  const hasExtendedFields = Array.isArray(payload?.tools)
    && payload.tools.some((tool) => tool && typeof tool === "object" && (tool.allowed_domains !== undefined || tool.external_web_access !== undefined));
  if (!hasExtendedFields) return false;
  return msg.includes("allowed_domains")
    || msg.includes("external_web_access")
    || msg.includes("unknown parameter")
    || msg.includes("invalid parameter")
    || msg.includes("unexpected parameter");
}

function stripExtendedWebToolFields(payload) {
  if (!payload || typeof payload !== "object") return;
  if (!Array.isArray(payload.tools)) return;
  for (const tool of payload.tools) {
    if (!tool || typeof tool !== "object") continue;
    if (String(tool.type || "") !== "web_search") continue;
    delete tool.allowed_domains;
    delete tool.external_web_access;
  }
}

async function callResponsesOnce(payload, cfg, log) {
  const fetchFn = cfg.fetchFn || ((...args) => globalThis.fetch(...args));
  if (typeof fetchFn !== "function") throw new Error("fetch недоступен в текущей среде.");

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), cfg.timeoutMs);
  try {
    const response = await fetchFn(cfg.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const responseText = await response.text();
    const responseJson = parseJsonSafe(responseText, null);

    if (!response.ok) {
      const apiMessage = extractApiErrorMessage(responseJson, responseText);
      const err = new Error(`OpenAI Responses API вернул ${response.status}: ${apiMessage}`);
      err.code = `HTTP_${response.status}`;
      err.status = response.status;
      err.retryable = response.status === 408 || response.status === 409 || response.status === 429 || response.status >= 500;
      err.api_message = apiMessage;
      throw err;
    }

    if (!responseJson || typeof responseJson !== "object") {
      throw new Error("OpenAI Responses API вернул некорректный JSON.");
    }
    log("web_search.response.meta", {
      id: String(responseJson?.id || ""),
      status: String(responseJson?.status || ""),
    });
    return responseJson;
  } catch (err) {
    if (isAbortError(err)) {
      const e = new Error(`Таймаут запроса к OpenAI (${cfg.timeoutMs} мс).`);
      e.code = "TIMEOUT";
      e.retryable = true;
      throw e;
    }
    if (isNetworkError(err)) {
      const e = new Error(`Сетевая ошибка при вызове OpenAI: ${String(err?.message || err)}`);
      e.code = "NETWORK";
      e.retryable = true;
      throw e;
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

function extractApiErrorMessage(json, text) {
  const msg = String(json?.error?.message || json?.message || "").trim();
  if (msg) return msg.slice(0, 500);
  const raw = String(text || "").replace(/\s+/g, " ").trim();
  return raw ? raw.slice(0, 500) : "неизвестная ошибка";
}

function extractAnswerText(response) {
  if (typeof response?.output_text === "string" && response.output_text.trim()) return response.output_text.trim();
  const parts = [];
  for (const item of response?.output || []) {
    if (item?.type !== "message") continue;
    for (const c of item?.content || []) {
      if ((c?.type === "output_text" || c?.type === "text") && typeof c?.text === "string" && c.text.trim()) {
        parts.push(c.text.trim());
      }
    }
  }
  return parts.join("\n").trim();
}

function extractToolSources(response, { allowedDomains = [], maxSources = DEFAULT_MAX_SOURCES } = {}) {
  const out = [];
  const seen = new Set();

  const pushSource = (candidate) => {
    if (!candidate || typeof candidate !== "object") return;
    const url = normalizeHttpUrl(candidate.url || candidate.link || candidate.uri || candidate.source_url);
    if (!url || seen.has(url)) return;
    const host = hostnameOfUrl(url);
    if (allowedDomains.length && !isAllowedDomain(host, allowedDomains)) return;
    seen.add(url);
    out.push({
      title: String(candidate.title || candidate.name || "").replace(/\s+/g, " ").trim().slice(0, 240),
      url,
      domain: host,
    });
  };

  const scanWebNode = (node) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node?.action?.sources)) {
      for (const source of node.action.sources) pushSource(source);
    }
    if (Array.isArray(node?.sources)) {
      for (const source of node.sources) pushSource(source);
    }
    if (Array.isArray(node?.results)) {
      for (const result of node.results) {
        pushSource(result);
        if (Array.isArray(result?.sources)) {
          for (const source of result.sources) pushSource(source);
        }
      }
    }
  };

  for (const item of response?.output || []) {
    const type = String(item?.type || "").toLowerCase();
    if (!type.includes("web_search")) continue;
    scanWebNode(item);
    if (out.length >= maxSources) break;
  }

  if (out.length < maxSources) {
    const queue = [{ node: response?.include, webCtx: false }];
    const seenNodes = new Set();
    let visited = 0;
    const LIMIT = 5000;
    while (queue.length && visited < LIMIT && out.length < maxSources) {
      const entry = queue.shift();
      const node = entry?.node;
      const webCtx = Boolean(entry?.webCtx);
      visited += 1;
      if (!node || typeof node !== "object") continue;
      if (seenNodes.has(node)) continue;
      seenNodes.add(node);
      if (Array.isArray(node)) {
        for (const child of node) queue.push({ node: child, webCtx });
        continue;
      }

      const type = String(node?.type || node?.tool || node?.name || "").toLowerCase();
      const localWebCtx = webCtx || type.includes("web_search");
      if (localWebCtx) scanWebNode(node);

      for (const [key, value] of Object.entries(node)) {
        const childCtx = localWebCtx || String(key || "").toLowerCase().includes("web_search");
        if (value && typeof value === "object") queue.push({ node: value, webCtx: childCtx });
      }
    }
  }

  return out.slice(0, maxSources);
}

function normalizeHttpUrl(raw) {
  const txt = String(raw || "").trim();
  if (!txt) return "";
  try {
    const url = new URL(txt);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    return url.toString();
  } catch {
    return "";
  }
}

function hostnameOfUrl(raw) {
  try {
    return String(new URL(raw).hostname || "").replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function isAllowedDomain(hostname, allowlist) {
  const host = String(hostname || "").toLowerCase();
  if (!host) return false;
  for (const rawDomain of allowlist || []) {
    const domain = String(rawDomain || "").toLowerCase();
    if (!domain) continue;
    if (host === domain) return true;
    if (host.endsWith(`.${domain}`)) return true;
  }
  return false;
}

function parseJsonSafe(text, fallback = null) {
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

function isAbortError(err) {
  const name = String(err?.name || "").toLowerCase();
  const msg = String(err?.message || "").toLowerCase();
  return name === "aborterror" || msg.includes("abort");
}

function isNetworkError(err) {
  const name = String(err?.name || "").toLowerCase();
  const code = String(err?.code || "").toUpperCase();
  const msg = String(err?.message || "").toLowerCase();
  if (name === "typeerror") return true;
  if (code === "ECONNRESET" || code === "ENOTFOUND" || code === "ETIMEDOUT" || code === "EAI_AGAIN") return true;
  return msg.includes("network") || msg.includes("fetch failed") || msg.includes("socket") || msg.includes("dns");
}

function isRetryableError(err) {
  if (!err) return false;
  if (err.retryable === true) return true;
  if (isAbortError(err) || isNetworkError(err)) return true;
  const code = String(err.code || "");
  return code === "TIMEOUT" || code === "NETWORK";
}

function decorateError(err, attempts) {
  const base = String(err?.message || err || "неизвестная ошибка");
  const message = `web_search завершился ошибкой после ${attempts} попыток: ${base}`;
  const wrapped = new Error(message);
  wrapped.cause = err;
  return wrapped;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, Number(ms) || 0)));
}

function trimForLog(value, maxLen) {
  const txt = String(value || "").replace(/\s+/g, " ").trim();
  if (txt.length <= maxLen) return txt;
  return `${txt.slice(0, maxLen)}…`;
}
