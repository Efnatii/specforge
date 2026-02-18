import { AgentRuntimeJsonTransportModule } from "./json.js";
import { AgentRuntimeStreamTransportModule } from "./stream.js";

export class AgentRuntimeTransportModule {
  constructor(ctx) {
    Object.assign(this, createAgentRuntimeTransportInternal(ctx));
  }
}

function createAgentRuntimeTransportInternal(ctx) {
  const { app, deps } = ctx || {};
  if (!app) throw new Error("AgentRuntimeTransportModule requires app");
  if (!deps) throw new Error("AgentRuntimeTransportModule requires deps");

  const {
    addExternalJournal,
    compactForTool,
    disconnectOpenAi,
    uid,
    num,
    fetchFn,
    parseSseEvent,
  } = deps;

  if (typeof addExternalJournal !== "function") throw new Error("AgentRuntimeTransportModule requires deps.addExternalJournal()");

  const jsonTransport = new AgentRuntimeJsonTransportModule({
    app,
    deps: {
      addExternalJournal,
      disconnectOpenAi,
      uid,
      fetchFn,
    },
  });

  const streamTransport = new AgentRuntimeStreamTransportModule({
    app,
    deps: {
      addExternalJournal,
      compactForTool,
      disconnectOpenAi,
      uid,
      num,
      fetchFn,
      parseSseEvent,
    },
  });
  const unsupportedToolsByModel = new Map();
  const summaryCompatByModel = new Map();
  const effortCompatByModel = new Map();
  const serviceTierCompatByModel = new Map();
  const textVerbosityCompatByModel = new Map();
  const textFormatCompatByModel = new Map();
  const includeCompatByModel = new Map();
  const promptCacheCompatByModel = new Map();
  const safetyIdentifierCompatByModel = new Map();
  const truncationCompatByModel = new Map();
  let compatApiKeySnapshot = "";
  const COMPAT_CACHE_MAX_MODELS = 64;
  const COMPAT_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
  let compatCachesUpdatedAt = 0;

  function modelKey(payload) {
    return String(payload?.model || app?.ai?.model || "").trim().toLowerCase();
  }

  function keepMapBounded(mapObj) {
    if (!(mapObj instanceof Map)) return;
    if (mapObj.size <= COMPAT_CACHE_MAX_MODELS) return;
    mapObj.clear();
    addExternalJournal("openai.compat.reset", "compatibility cache pruned (size limit)", {
      level: "info",
      status: "completed",
      turn_id: app.ai.turnId || "",
      meta: { max_models: COMPAT_CACHE_MAX_MODELS },
    });
  }

  function hasCompatibilityState() {
    return unsupportedToolsByModel.size > 0
      || summaryCompatByModel.size > 0
      || effortCompatByModel.size > 0
      || serviceTierCompatByModel.size > 0
      || textVerbosityCompatByModel.size > 0
      || textFormatCompatByModel.size > 0
      || includeCompatByModel.size > 0
      || promptCacheCompatByModel.size > 0
      || safetyIdentifierCompatByModel.size > 0
      || truncationCompatByModel.size > 0
      || compatCachesUpdatedAt > 0;
  }

  function resetCompatibilityCaches(reason = "manual", forceLog = false) {
    const hadState = hasCompatibilityState();
    unsupportedToolsByModel.clear();
    summaryCompatByModel.clear();
    effortCompatByModel.clear();
    serviceTierCompatByModel.clear();
    textVerbosityCompatByModel.clear();
    textFormatCompatByModel.clear();
    includeCompatByModel.clear();
    promptCacheCompatByModel.clear();
    safetyIdentifierCompatByModel.clear();
    truncationCompatByModel.clear();
    compatCachesUpdatedAt = 0;
    if (!forceLog && !hadState) return;
    addExternalJournal("openai.compat.reset", `compatibility caches reset (${reason})`, {
      level: "info",
      status: "completed",
      turn_id: app.ai.turnId || "",
      meta: { reason },
    });
  }

  function touchCompatibilityCaches() {
    compatCachesUpdatedAt = Date.now();
  }

  function maybeExpireCompatibilityCaches() {
    if (!compatCachesUpdatedAt) return false;
    const ageMs = Date.now() - compatCachesUpdatedAt;
    if (ageMs <= COMPAT_CACHE_TTL_MS) return false;
    resetCompatibilityCaches("ttl_expired");
    return true;
  }

  function maybeResetCompatibilityCaches() {
    maybeExpireCompatibilityCaches();
    const keyNow = String(app?.ai?.apiKey || "");
    if (compatApiKeySnapshot === keyNow) return false;
    compatApiKeySnapshot = keyNow;
    resetCompatibilityCaches("api_key_changed");
    return true;
  }

  function isCompatCacheEnabled() {
    return app?.ai?.options?.compatCache !== false;
  }

  function rememberUnsupportedTool(payload, toolTypeRaw) {
    const key = modelKey(payload);
    const toolType = String(toolTypeRaw || "").trim();
    if (!key || !toolType) return;
    const current = unsupportedToolsByModel.get(key);
    if (current) {
      current.add(toolType);
      return;
    }
    unsupportedToolsByModel.set(key, new Set([toolType]));
    touchCompatibilityCaches();
    keepMapBounded(unsupportedToolsByModel);
  }

  function rememberSummaryCompat(payload, summaryRaw) {
    const key = modelKey(payload);
    const summary = String(summaryRaw || "").trim().toLowerCase();
    if (!key) return;
    if (summary === "off" || !summary) {
      summaryCompatByModel.set(key, "off");
      touchCompatibilityCaches();
      keepMapBounded(summaryCompatByModel);
      return;
    }
    if (summary === "auto" || summary === "concise" || summary === "detailed") {
      const prev = summaryCompatByModel.get(key);
      if (prev === "off") return;
      if (summary === "auto" || !prev) summaryCompatByModel.set(key, summary);
      touchCompatibilityCaches();
      keepMapBounded(summaryCompatByModel);
    }
  }

  function effortRank(effortRaw) {
    const effort = String(effortRaw || "").trim().toLowerCase();
    if (effort === "none") return 0;
    if (effort === "minimal") return 1;
    if (effort === "low") return 2;
    if (effort === "medium") return 3;
    if (effort === "high") return 4;
    if (effort === "xhigh") return 5;
    return -1;
  }

  function rememberEffortCompat(payload, effortRaw) {
    const key = modelKey(payload);
    const effort = String(effortRaw || "").trim().toLowerCase();
    if (!key) return;
    if (effort === "off" || !effort) {
      effortCompatByModel.set(key, "off");
      touchCompatibilityCaches();
      keepMapBounded(effortCompatByModel);
      return;
    }
    if (effortRank(effort) < 0) return;
    const prev = String(effortCompatByModel.get(key) || "").trim().toLowerCase();
    if (prev === "off") return;
    if (!prev || effortRank(effort) < effortRank(prev)) {
      effortCompatByModel.set(key, effort);
      touchCompatibilityCaches();
      keepMapBounded(effortCompatByModel);
    }
  }

  function rememberServiceTierCompat(payload, modeRaw) {
    const key = modelKey(payload);
    const mode = String(modeRaw || "").trim().toLowerCase();
    if (!key) return;
    if (mode !== "default_only" && mode !== "off") return;
    const prev = String(serviceTierCompatByModel.get(key) || "").trim().toLowerCase();
    if (prev === "off") return;
    if (mode === "off" || !prev) {
      serviceTierCompatByModel.set(key, mode);
      touchCompatibilityCaches();
      keepMapBounded(serviceTierCompatByModel);
    }
  }

  function rememberTextVerbosityCompat(payload, modeRaw) {
    const key = modelKey(payload);
    const mode = String(modeRaw || "").trim().toLowerCase();
    if (!key) return;
    if (mode !== "off") return;
    textVerbosityCompatByModel.set(key, "off");
    touchCompatibilityCaches();
    keepMapBounded(textVerbosityCompatByModel);
  }

  function rememberTextFormatCompat(payload, modeRaw) {
    const key = modelKey(payload);
    const mode = String(modeRaw || "").trim().toLowerCase();
    if (!key) return;
    if (mode !== "off") return;
    textFormatCompatByModel.set(key, "off");
    touchCompatibilityCaches();
    keepMapBounded(textFormatCompatByModel);
  }

  function rememberIncludeCompat(payload, modeRaw) {
    const key = modelKey(payload);
    const mode = String(modeRaw || "").trim().toLowerCase();
    if (!key) return;
    if (mode !== "off") return;
    includeCompatByModel.set(key, "off");
    touchCompatibilityCaches();
    keepMapBounded(includeCompatByModel);
  }

  function rememberPromptCacheCompat(payload, modeRaw) {
    const key = modelKey(payload);
    const mode = String(modeRaw || "").trim().toLowerCase();
    if (!key) return;
    if (mode !== "off") return;
    promptCacheCompatByModel.set(key, "off");
    touchCompatibilityCaches();
    keepMapBounded(promptCacheCompatByModel);
  }

  function rememberSafetyIdentifierCompat(payload, modeRaw) {
    const key = modelKey(payload);
    const mode = String(modeRaw || "").trim().toLowerCase();
    if (!key) return;
    if (mode !== "off") return;
    safetyIdentifierCompatByModel.set(key, "off");
    touchCompatibilityCaches();
    keepMapBounded(safetyIdentifierCompatByModel);
  }

  function rememberTruncationCompat(payload, modeRaw) {
    const key = modelKey(payload);
    const mode = String(modeRaw || "").trim().toLowerCase();
    if (!key) return;
    if (mode !== "off") return;
    truncationCompatByModel.set(key, "off");
    touchCompatibilityCaches();
    keepMapBounded(truncationCompatByModel);
  }

  function withoutKnownUnsupportedTools(payload) {
    const key = modelKey(payload);
    const blocked = key ? unsupportedToolsByModel.get(key) : null;
    const tools = Array.isArray(payload?.tools) ? payload.tools : [];
    if (!blocked || !blocked.size || !tools.length) return payload;
    const nextTools = tools.filter((tool) => !blocked.has(String(tool?.type || "")));
    if (nextTools.length === tools.length) return payload;
    const next = { ...payload, tools: nextTools };
    if (!nextTools.length && String(next?.tool_choice || "") === "required") {
      next.tool_choice = "none";
      delete next.parallel_tool_calls;
    }
    return next;
  }

  function withReasoningSummary(payload, summaryRaw) {
    if (!payloadHasReasoning(payload)) return payload;
    const summary = String(summaryRaw || "").trim().toLowerCase();
    if (!summary) return withoutReasoningSummary(payload);
    const reasoning = { ...payload.reasoning, summary };
    return { ...payload, reasoning };
  }

  function withReasoningEffort(payload, effortRaw) {
    if (!payloadHasReasoning(payload)) return payload;
    const effort = String(effortRaw || "").trim().toLowerCase();
    if (!effort) return payload;
    const reasoning = { ...payload.reasoning, effort };
    return { ...payload, reasoning };
  }

  function withKnownSummaryCompatibility(payload) {
    if (!payloadHasReasoningSummary(payload)) return payload;
    const key = modelKey(payload);
    // Reuse learned summary compatibility per model to avoid repeat 400 fallback loops.
    const compat = key ? String(summaryCompatByModel.get(key) || "").trim().toLowerCase() : "";
    if (!compat) return payload;
    if (compat === "off") return withoutReasoningSummary(payload);
    const current = String(payload?.reasoning?.summary || "").trim().toLowerCase();
    if (!current || current === compat) return payload;
    if (compat === "auto") return withReasoningSummary(payload, "auto");
    return payload;
  }

  function withKnownEffortCompatibility(payload) {
    if (!payloadHasReasoning(payload)) return payload;
    const key = modelKey(payload);
    const compat = key ? String(effortCompatByModel.get(key) || "").trim().toLowerCase() : "";
    if (!compat) return payload;
    if (compat === "off") return withoutReasoning(payload);
    const targetRank = effortRank(compat);
    if (targetRank < 0) return payload;
    const current = String(payload?.reasoning?.effort || "").trim().toLowerCase();
    const currentRank = effortRank(current);
    if (currentRank < 0 || currentRank <= targetRank) return payload;
    return withReasoningEffort(payload, compat);
  }

  function withKnownServiceTierCompatibility(payload) {
    if (!payloadHasServiceTier(payload)) return payload;
    const key = modelKey(payload);
    const compat = key ? String(serviceTierCompatByModel.get(key) || "").trim().toLowerCase() : "";
    if (!compat) return payload;
    if (compat === "off") return withoutServiceTier(payload);
    if (compat === "default_only") return withDefaultServiceTier(payload);
    return payload;
  }

  function withKnownTextVerbosityCompatibility(payload) {
    if (!payloadHasTextVerbosity(payload)) return payload;
    const key = modelKey(payload);
    const compat = key ? String(textVerbosityCompatByModel.get(key) || "").trim().toLowerCase() : "";
    if (compat === "off") return withoutTextVerbosity(payload);
    return payload;
  }

  function withKnownTextFormatCompatibility(payload) {
    if (!payloadHasTextFormat(payload)) return payload;
    const key = modelKey(payload);
    const compat = key ? String(textFormatCompatByModel.get(key) || "").trim().toLowerCase() : "";
    if (compat === "off") return withoutTextFormat(payload);
    return payload;
  }

  function withKnownIncludeCompatibility(payload) {
    if (!payloadHasInclude(payload)) return payload;
    const key = modelKey(payload);
    const compat = key ? String(includeCompatByModel.get(key) || "").trim().toLowerCase() : "";
    if (compat === "off") return withoutInclude(payload);
    return payload;
  }

  function withKnownPromptCacheCompatibility(payload) {
    if (!payloadHasPromptCache(payload)) return payload;
    const key = modelKey(payload);
    const compat = key ? String(promptCacheCompatByModel.get(key) || "").trim().toLowerCase() : "";
    if (compat === "off") return withoutPromptCache(payload);
    return payload;
  }

  function withKnownSafetyIdentifierCompatibility(payload) {
    if (!payloadHasSafetyIdentifier(payload)) return payload;
    const key = modelKey(payload);
    const compat = key ? String(safetyIdentifierCompatByModel.get(key) || "").trim().toLowerCase() : "";
    if (compat === "off") return withoutSafetyIdentifier(payload);
    return payload;
  }

  function withKnownTruncationCompatibility(payload) {
    if (!payloadHasTruncation(payload)) return payload;
    const key = modelKey(payload);
    const compat = key ? String(truncationCompatByModel.get(key) || "").trim().toLowerCase() : "";
    if (compat === "off") return withoutTruncation(payload);
    return payload;
  }

  function payloadHasComputerUseTool(payload) {
    const tools = Array.isArray(payload?.tools) ? payload.tools : [];
    return tools.some((tool) => String(tool?.type || "") === "computer_use_preview");
  }

  function withoutComputerUseTool(payload) {
    const tools = Array.isArray(payload?.tools) ? payload.tools : [];
    return {
      ...payload,
      tools: tools.filter((tool) => String(tool?.type || "") !== "computer_use_preview"),
    };
  }

  function payloadHasReasoning(payload) {
    return Boolean(payload?.reasoning && typeof payload.reasoning === "object");
  }

  function payloadHasReasoningSummary(payload) {
    if (!payloadHasReasoning(payload)) return false;
    return Object.prototype.hasOwnProperty.call(payload.reasoning, "summary");
  }

  function payloadHasTextVerbosity(payload) {
    const verbosity = String(payload?.text?.verbosity || "").trim();
    return Boolean(verbosity);
  }

  function payloadHasTextFormat(payload) {
    return Boolean(payload?.text?.format && typeof payload.text.format === "object");
  }

  function payloadHasServiceTier(payload) {
    const tier = String(payload?.service_tier || "").trim().toLowerCase();
    return tier === "default" || tier === "flex" || tier === "priority";
  }

  function payloadHasInclude(payload) {
    return Array.isArray(payload?.include) && payload.include.length > 0;
  }

  function payloadHasPromptCache(payload) {
    return Boolean(String(payload?.prompt_cache_key || "").trim() || String(payload?.prompt_cache_retention || "").trim());
  }

  function payloadHasSafetyIdentifier(payload) {
    return Boolean(String(payload?.safety_identifier || "").trim());
  }

  function payloadHasTruncation(payload) {
    const mode = String(payload?.truncation || "").trim().toLowerCase();
    return mode === "auto" || mode === "disabled";
  }

  function withoutReasoning(payload) {
    if (!payloadHasReasoning(payload)) return payload;
    const next = { ...payload };
    delete next.reasoning;
    return next;
  }

  function withoutServiceTier(payload) {
    if (!payloadHasServiceTier(payload)) return payload;
    const next = { ...payload };
    delete next.service_tier;
    return next;
  }

  function withoutReasoningSummary(payload) {
    if (!payloadHasReasoningSummary(payload)) return payload;
    const reasoning = { ...payload.reasoning };
    delete reasoning.summary;
    const next = { ...payload };
    if (Object.keys(reasoning).length) next.reasoning = reasoning;
    else delete next.reasoning;
    return next;
  }

  function withLessSpecificReasoningSummary(payload) {
    if (!payloadHasReasoningSummary(payload)) return null;
    const current = String(payload?.reasoning?.summary || "").trim().toLowerCase();
    if (!current) return withoutReasoningSummary(payload);
    if (current === "auto") return withoutReasoningSummary(payload);
    if (current === "concise" || current === "detailed") {
      const reasoning = { ...payload.reasoning, summary: "auto" };
      return { ...payload, reasoning };
    }
    return withoutReasoningSummary(payload);
  }

  function withoutTextVerbosity(payload) {
    if (!payloadHasTextVerbosity(payload)) return payload;
    const text = payload?.text && typeof payload.text === "object" ? { ...payload.text } : null;
    if (text) delete text.verbosity;
    const next = { ...payload };
    if (text && Object.keys(text).length) next.text = text;
    else delete next.text;
    return next;
  }

  function withoutTextFormat(payload) {
    if (!payloadHasTextFormat(payload)) return payload;
    const text = payload?.text && typeof payload.text === "object" ? { ...payload.text } : null;
    if (text) delete text.format;
    const next = { ...payload };
    if (text && Object.keys(text).length) next.text = text;
    else delete next.text;
    return next;
  }

  function withoutInclude(payload) {
    if (!payloadHasInclude(payload)) return payload;
    const next = { ...payload };
    delete next.include;
    return next;
  }

  function withoutPromptCache(payload) {
    if (!payloadHasPromptCache(payload)) return payload;
    const next = { ...payload };
    delete next.prompt_cache_key;
    delete next.prompt_cache_retention;
    return next;
  }

  function withoutSafetyIdentifier(payload) {
    if (!payloadHasSafetyIdentifier(payload)) return payload;
    const next = { ...payload };
    delete next.safety_identifier;
    return next;
  }

  function withoutTruncation(payload) {
    if (!payloadHasTruncation(payload)) return payload;
    const next = { ...payload };
    delete next.truncation;
    return next;
  }

  function withDefaultServiceTier(payload) {
    if (!payloadHasServiceTier(payload)) return payload;
    const current = String(payload?.service_tier || "").trim().toLowerCase();
    if (current === "default") {
      const next = { ...payload };
      delete next.service_tier;
      return next;
    }
    return { ...payload, service_tier: "default" };
  }

  function withLowerReasoningEffort(payload) {
    if (!payloadHasReasoning(payload)) return null;
    const reasoning = payload.reasoning && typeof payload.reasoning === "object" ? { ...payload.reasoning } : null;
    if (!reasoning) return null;
    const effort = String(reasoning.effort || "").trim().toLowerCase();
    let lowered = "";
    if (effort === "xhigh") lowered = "high";
    else if (effort === "high") lowered = "medium";
    else if (effort === "medium") lowered = "low";
    else if (effort === "minimal" || effort === "none") lowered = "low";
    if (!lowered || lowered === effort) return null;
    reasoning.effort = lowered;
    return { ...payload, reasoning };
  }

  function isUnsupportedText(text) {
    if (!text) return false;
    return text.includes("unsupported")
      || text.includes("not supported")
      || text.includes("unknown")
      || text.includes("invalid")
      || text.includes("not allowed")
      || text.includes("not available");
  }

  function isReasoningSummaryUnsupportedError(err) {
    const text = String(err?.message || "").toLowerCase();
    if (!text || !isUnsupportedText(text)) return false;
    if (text.includes("reasoning.summary")) return true;
    return text.includes("reasoning") && text.includes("summary");
  }

  function isReasoningEffortUnsupportedError(err) {
    const text = String(err?.message || "").toLowerCase();
    if (!text || !isUnsupportedText(text)) return false;
    if (text.includes("reasoning.effort")) return true;
    return text.includes("reasoning") && text.includes("effort");
  }

  function isReasoningUnsupportedError(err) {
    const text = String(err?.message || "").toLowerCase();
    if (!text || !isUnsupportedText(text)) return false;
    if (!text.includes("reasoning")) return false;
    if (text.includes("reasoning.summary")) return false;
    if (text.includes("reasoning.effort")) return false;
    return true;
  }

  function isTextVerbosityUnsupportedError(err) {
    const text = String(err?.message || "").toLowerCase();
    if (!text || !isUnsupportedText(text)) return false;
    if (text.includes("text.verbosity")) return true;
    return text.includes("text") && text.includes("verbosity");
  }

  function isTextFormatUnsupportedError(err) {
    const text = String(err?.message || "").toLowerCase();
    if (!text || !isUnsupportedText(text)) return false;
    if (text.includes("text.format")) return true;
    if (text.includes("json_schema")) return true;
    if (text.includes("response_format")) return true;
    return text.includes("text") && text.includes("format");
  }

  function isIncludeUnsupportedError(err) {
    const text = String(err?.message || "").toLowerCase();
    if (!text || !isUnsupportedText(text)) return false;
    if (text.includes("include")) return true;
    return false;
  }

  function isPromptCacheUnsupportedError(err) {
    const text = String(err?.message || "").toLowerCase();
    if (!text || !isUnsupportedText(text)) return false;
    if (text.includes("prompt_cache_key")) return true;
    if (text.includes("prompt_cache_retention")) return true;
    return text.includes("prompt cache");
  }

  function isSafetyIdentifierUnsupportedError(err) {
    const text = String(err?.message || "").toLowerCase();
    if (!text || !isUnsupportedText(text)) return false;
    if (text.includes("safety_identifier")) return true;
    return text.includes("safety identifier");
  }

  function isTruncationUnsupportedError(err) {
    const text = String(err?.message || "").toLowerCase();
    if (!text || !isUnsupportedText(text)) return false;
    if (text.includes("truncation")) return true;
    return false;
  }

  function isServiceTierUnsupportedError(err) {
    const text = String(err?.message || "").toLowerCase();
    if (!text || !isUnsupportedText(text)) return false;
    if (text.includes("service_tier")) return true;
    return text.includes("service tier");
  }

  function payloadDigest(payload) {
    try {
      return JSON.stringify(payload);
    } catch {
      return "";
    }
  }

  function compatDeltaMeta(beforePayload, afterPayload) {
    const before = beforePayload && typeof beforePayload === "object" ? beforePayload : {};
    const after = afterPayload && typeof afterPayload === "object" ? afterPayload : {};
    const beforeEffort = String(before?.reasoning?.effort || "").trim().toLowerCase();
    const afterEffort = String(after?.reasoning?.effort || "").trim().toLowerCase();
    const beforeSummary = String(before?.reasoning?.summary || "").trim().toLowerCase();
    const afterSummary = String(after?.reasoning?.summary || "").trim().toLowerCase();
    const beforeTools = Array.isArray(before?.tools) ? before.tools.length : 0;
    const afterTools = Array.isArray(after?.tools) ? after.tools.length : 0;
    const beforeTier = String(before?.service_tier || "").trim().toLowerCase();
    const afterTier = String(after?.service_tier || "").trim().toLowerCase();
    const beforeVerbosity = String(before?.text?.verbosity || "").trim().toLowerCase();
    const afterVerbosity = String(after?.text?.verbosity || "").trim().toLowerCase();
    const beforeTextFormat = before?.text?.format ? "on" : "off";
    const afterTextFormat = after?.text?.format ? "on" : "off";
    const beforeInclude = Array.isArray(before?.include) ? before.include.length : 0;
    const afterInclude = Array.isArray(after?.include) ? after.include.length : 0;
    const beforePromptCache = (before?.prompt_cache_key || before?.prompt_cache_retention) ? "on" : "off";
    const afterPromptCache = (after?.prompt_cache_key || after?.prompt_cache_retention) ? "on" : "off";
    const beforeSafety = before?.safety_identifier ? "on" : "off";
    const afterSafety = after?.safety_identifier ? "on" : "off";
    const beforeTruncation = String(before?.truncation || "").trim().toLowerCase();
    const afterTruncation = String(after?.truncation || "").trim().toLowerCase();
    const meta = {};
    if (beforeEffort !== afterEffort) {
      meta.reasoning_effort_from = beforeEffort || null;
      meta.reasoning_effort_to = afterEffort || null;
    }
    if (beforeSummary !== afterSummary) {
      meta.reasoning_summary_from = beforeSummary || null;
      meta.reasoning_summary_to = afterSummary || null;
    }
    if (beforeTools !== afterTools) {
      meta.tools_from = beforeTools;
      meta.tools_to = afterTools;
    }
    if (beforeTier !== afterTier) {
      meta.service_tier_from = beforeTier || null;
      meta.service_tier_to = afterTier || null;
    }
    if (beforeVerbosity !== afterVerbosity) {
      meta.text_verbosity_from = beforeVerbosity || null;
      meta.text_verbosity_to = afterVerbosity || null;
    }
    if (beforeTextFormat !== afterTextFormat) {
      meta.text_format_from = beforeTextFormat;
      meta.text_format_to = afterTextFormat;
    }
    if (beforeInclude !== afterInclude) {
      meta.include_from = beforeInclude;
      meta.include_to = afterInclude;
    }
    if (beforePromptCache !== afterPromptCache) {
      meta.prompt_cache_from = beforePromptCache;
      meta.prompt_cache_to = afterPromptCache;
    }
    if (beforeSafety !== afterSafety) {
      meta.safety_identifier_from = beforeSafety;
      meta.safety_identifier_to = afterSafety;
    }
    if (beforeTruncation !== afterTruncation) {
      meta.truncation_from = beforeTruncation || null;
      meta.truncation_to = afterTruncation || null;
    }
    return meta;
  }

  function isComputerUseUnsupportedError(err) {
    const text = String(err?.message || "").toLowerCase();
    if (!text) return false;
    if (!text.includes("computer_use_preview") && !text.includes("computer_use")) return false;
    if (text.includes("unknown") || text.includes("unsupported") || text.includes("not supported")) return true;
    if (text.includes("invalid") || text.includes("not allowed")) return true;
    return false;
  }

  async function callWithPreferredTransport(payload, options = {}) {
    if (payload?.background === true) {
      return jsonTransport.callOpenAiResponsesJson(payload, options);
    }
    const preferStream = app.ai.streaming !== false;
    if (!preferStream) return jsonTransport.callOpenAiResponsesJson(payload, options);

    try {
      return await streamTransport.callOpenAiResponsesStream(payload, options);
    } catch (err) {
      // User cancellation (including AbortError from stream reader) should stop immediately.
      const abortLike = Boolean(
        app.ai.cancelRequested
        || app.ai.taskState === "cancel_requested"
        || err?.canceled
        || String(err?.name || "") === "AbortError"
        || /abort|cancel/i.test(String(err?.message || "")),
      );
      if (abortLike) {
        if (err?.canceled) throw err;
        const e = new Error("request canceled by user");
        e.canceled = true;
        throw e;
      }
      if (err?.no_fallback) throw err;
      addExternalJournal("openai.stream.fallback", String(err?.message || err), {
        level: "warning",
        status: "error",
        turn_id: options?.turnId || app.ai.turnId || "",
        meta: { reason: String(err?.message || err || "stream failed") },
      });
      return jsonTransport.callOpenAiResponsesJson(payload, options);
    }
  }

  async function callOpenAiResponses(payload, options = {}) {
    const compatEnabled = isCompatCacheEnabled();
    if (compatEnabled) maybeResetCompatibilityCaches();
    else resetCompatibilityCaches("disabled", false);
    const turnId = options?.turnId || app.ai.turnId || "";
    let currentPayload = payload;
    if (compatEnabled) {
      const payloadBeforeCompat = payloadDigest(payload);
      currentPayload = withKnownEffortCompatibility(
        withKnownSummaryCompatibility(
          withKnownTextVerbosityCompatibility(
            withKnownTextFormatCompatibility(
              withKnownIncludeCompatibility(
                withKnownPromptCacheCompatibility(
                  withKnownSafetyIdentifierCompatibility(
                    withKnownTruncationCompatibility(
                      withKnownServiceTierCompatibility(
                        withoutKnownUnsupportedTools(payload),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      );
      const payloadAfterCompat = payloadDigest(currentPayload);
      if (payloadAfterCompat !== payloadBeforeCompat) {
        const deltaMeta = compatDeltaMeta(payload, currentPayload);
        addExternalJournal("openai.compat.apply", "pre-applied learned compatibility rules", {
          level: "info",
          status: "completed",
          turn_id: turnId,
          meta: {
            model: String(currentPayload?.model || app?.ai?.model || ""),
            ...deltaMeta,
          },
        });
      }
    }
    for (let retry = 0; retry < 8; retry += 1) {
      try {
        return await callWithPreferredTransport(currentPayload, options);
      } catch (err) {
        if (!err?.no_fallback) throw err;

        let nextPayload = null;
        let fallbackEvent = "openai.param.fallback";
        let fallbackMessage = "";

        if (payloadHasServiceTier(currentPayload) && isServiceTierUnsupportedError(err)) {
          nextPayload = withDefaultServiceTier(currentPayload);
          const nextTier = String(nextPayload?.service_tier || "").trim().toLowerCase();
          if (compatEnabled && nextTier === "default") rememberServiceTierCompat(currentPayload, "default_only");
          else if (compatEnabled && !nextTier) rememberServiceTierCompat(currentPayload, "off");
          fallbackMessage = nextTier === "default"
            ? "service_tier reset to default"
            : "service_tier disabled for this model";
        } else if (payloadHasTextFormat(currentPayload) && isTextFormatUnsupportedError(err)) {
          nextPayload = withoutTextFormat(currentPayload);
          if (compatEnabled) rememberTextFormatCompat(currentPayload, "off");
          fallbackMessage = "text.format disabled for this model";
        } else if (payloadHasInclude(currentPayload) && isIncludeUnsupportedError(err)) {
          nextPayload = withoutInclude(currentPayload);
          if (compatEnabled) rememberIncludeCompat(currentPayload, "off");
          fallbackMessage = "include disabled for this model";
        } else if (payloadHasPromptCache(currentPayload) && isPromptCacheUnsupportedError(err)) {
          nextPayload = withoutPromptCache(currentPayload);
          if (compatEnabled) rememberPromptCacheCompat(currentPayload, "off");
          fallbackMessage = "prompt_cache disabled for this model";
        } else if (payloadHasSafetyIdentifier(currentPayload) && isSafetyIdentifierUnsupportedError(err)) {
          nextPayload = withoutSafetyIdentifier(currentPayload);
          if (compatEnabled) rememberSafetyIdentifierCompat(currentPayload, "off");
          fallbackMessage = "safety_identifier disabled for this model";
        } else if (payloadHasTruncation(currentPayload) && isTruncationUnsupportedError(err)) {
          nextPayload = withoutTruncation(currentPayload);
          if (compatEnabled) rememberTruncationCompat(currentPayload, "off");
          fallbackMessage = "truncation disabled for this model";
        } else if (payloadHasReasoningSummary(currentPayload) && isReasoningSummaryUnsupportedError(err)) {
          nextPayload = withLessSpecificReasoningSummary(currentPayload) || withoutReasoningSummary(currentPayload);
          if (compatEnabled) {
            rememberSummaryCompat(currentPayload, nextPayload?.reasoning?.summary ? String(nextPayload.reasoning.summary) : "off");
          }
          fallbackMessage = nextPayload?.reasoning?.summary
            ? `reasoning.summary lowered to ${String(nextPayload.reasoning.summary || "")}`
            : "reasoning.summary disabled for this model";
        } else if (payloadHasTextVerbosity(currentPayload) && isTextVerbosityUnsupportedError(err)) {
          nextPayload = withoutTextVerbosity(currentPayload);
          if (compatEnabled) rememberTextVerbosityCompat(currentPayload, "off");
          fallbackMessage = "text.verbosity disabled for this model";
        } else if (payloadHasReasoning(currentPayload) && isReasoningEffortUnsupportedError(err)) {
          nextPayload = withLowerReasoningEffort(currentPayload) || withoutReasoning(currentPayload);
          if (compatEnabled) {
            rememberEffortCompat(currentPayload, nextPayload?.reasoning?.effort ? String(nextPayload.reasoning.effort) : "off");
          }
          fallbackMessage = nextPayload?.reasoning
            ? `reasoning.effort lowered to ${String(nextPayload.reasoning.effort || "")}`
            : "reasoning disabled for this model";
        } else if (payloadHasReasoning(currentPayload) && isReasoningUnsupportedError(err)) {
          nextPayload = withoutReasoning(currentPayload);
          if (compatEnabled) rememberEffortCompat(currentPayload, "off");
          fallbackMessage = "reasoning disabled for this model";
        } else if (payloadHasComputerUseTool(currentPayload) && isComputerUseUnsupportedError(err)) {
          nextPayload = withoutComputerUseTool(currentPayload);
          if (compatEnabled) rememberUnsupportedTool(currentPayload, "computer_use_preview");
          fallbackEvent = "openai.tool.fallback";
          fallbackMessage = "computer_use_preview disabled for this model";
        } else {
          throw err;
        }

        if (!nextPayload || payloadDigest(nextPayload) === payloadDigest(currentPayload)) throw err;

        addExternalJournal(fallbackEvent, fallbackMessage, {
          level: "warning",
          status: "error",
          turn_id: turnId,
          meta: { reason: String(err?.message || err || "unsupported parameter") },
        });

        currentPayload = nextPayload;
      }
    }
    throw new Error("openai fallback retry limit reached");
  }

  return {
    callOpenAiResponses,
    callOpenAiResponsesJson: jsonTransport.callOpenAiResponsesJson,
    callOpenAiResponsesStream: streamTransport.callOpenAiResponsesStream,
    cancelOpenAiResponse: jsonTransport.cancelOpenAiResponse,
    compactOpenAiResponse: jsonTransport.compactOpenAiResponse,
  };
}
