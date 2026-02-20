export class AgentRuntimeTurnModule {
  constructor(ctx) {
    Object.assign(this, createAgentRuntimeTurnInternal(ctx));
  }
}

function createAgentRuntimeTurnInternal(ctx) {
  const { app, config, deps } = ctx || {};
  if (!app) throw new Error("AgentRuntimeTurnModule requires app");
  if (!config) throw new Error("AgentRuntimeTurnModule requires config");
  if (!deps) throw new Error("AgentRuntimeTurnModule requires deps");

  const {
    AGENT_MAX_FORCED_RETRIES,
    AGENT_MAX_TOOL_ROUNDS,
    AI_MUTATION_INTENT_RE,
    AI_ANALYSIS_INTENT_RE,
  } = config;

  const {
    currentAiModelMeta,
    executeAgentTool,
    addExternalJournal,
    addTableJournal,
    compactForTool,
    num,
    isActionableAgentPrompt,
    estimateExpectedMutationCount,
    analyzeTaskComplexity,
    resolveTaskProfile,
    buildAgentResponsesPayload,
    callOpenAiResponses,
    agentSystemPrompt,
    extractAgentFunctionCalls,
    extractAgentText,
    isAgentTextIncomplete,
    shouldForceAgentContinuation,
    buildAgentRetryReason,
    buildAgentContinuationInstruction,
    sanitizeAgentOutputText,
    parseJsonSafe,
    summarizeToolArgs,
    normalizeToolResult,
    isMutationToolName,
    updateAgentTurnWebEvidence,
    prepareToolResources,
    compactOpenAiResponse,
  } = deps;

  if (!Number.isFinite(AGENT_MAX_FORCED_RETRIES) || AGENT_MAX_FORCED_RETRIES < 0) {
    throw new Error("AgentRuntimeTurnModule requires config.AGENT_MAX_FORCED_RETRIES");
  }
  if (!Number.isFinite(AGENT_MAX_TOOL_ROUNDS) || AGENT_MAX_TOOL_ROUNDS < 1) {
    throw new Error("AgentRuntimeTurnModule requires config.AGENT_MAX_TOOL_ROUNDS");
  }
  if (!(AI_MUTATION_INTENT_RE instanceof RegExp)) throw new Error("AgentRuntimeTurnModule requires config.AI_MUTATION_INTENT_RE");
  if (!(AI_ANALYSIS_INTENT_RE instanceof RegExp)) throw new Error("AgentRuntimeTurnModule requires config.AI_ANALYSIS_INTENT_RE");

  if (typeof currentAiModelMeta !== "function") throw new Error("AgentRuntimeTurnModule requires deps.currentAiModelMeta()");
  if (typeof executeAgentTool !== "function") throw new Error("AgentRuntimeTurnModule requires deps.executeAgentTool()");
  if (typeof addExternalJournal !== "function") throw new Error("AgentRuntimeTurnModule requires deps.addExternalJournal()");
  if (typeof addTableJournal !== "function") throw new Error("AgentRuntimeTurnModule requires deps.addTableJournal()");
  if (typeof compactForTool !== "function") throw new Error("AgentRuntimeTurnModule requires deps.compactForTool()");
  if (typeof num !== "function") throw new Error("AgentRuntimeTurnModule requires deps.num()");
  if (typeof isActionableAgentPrompt !== "function") throw new Error("AgentRuntimeTurnModule requires deps.isActionableAgentPrompt()");
  if (typeof estimateExpectedMutationCount !== "function") throw new Error("AgentRuntimeTurnModule requires deps.estimateExpectedMutationCount()");
  if (analyzeTaskComplexity !== undefined && typeof analyzeTaskComplexity !== "function") {
    throw new Error("AgentRuntimeTurnModule requires deps.analyzeTaskComplexity() when provided");
  }
  if (typeof resolveTaskProfile !== "function") throw new Error("AgentRuntimeTurnModule requires deps.resolveTaskProfile()");
  if (typeof buildAgentResponsesPayload !== "function") throw new Error("AgentRuntimeTurnModule requires deps.buildAgentResponsesPayload()");
  if (typeof callOpenAiResponses !== "function") throw new Error("AgentRuntimeTurnModule requires deps.callOpenAiResponses()");
  if (typeof agentSystemPrompt !== "function") throw new Error("AgentRuntimeTurnModule requires deps.agentSystemPrompt()");
  if (typeof extractAgentFunctionCalls !== "function") throw new Error("AgentRuntimeTurnModule requires deps.extractAgentFunctionCalls()");
  if (typeof extractAgentText !== "function") throw new Error("AgentRuntimeTurnModule requires deps.extractAgentText()");
  if (typeof isAgentTextIncomplete !== "function") throw new Error("AgentRuntimeTurnModule requires deps.isAgentTextIncomplete()");
  if (typeof shouldForceAgentContinuation !== "function") throw new Error("AgentRuntimeTurnModule requires deps.shouldForceAgentContinuation()");
  if (typeof buildAgentRetryReason !== "function") throw new Error("AgentRuntimeTurnModule requires deps.buildAgentRetryReason()");
  if (typeof buildAgentContinuationInstruction !== "function") throw new Error("AgentRuntimeTurnModule requires deps.buildAgentContinuationInstruction()");
  if (typeof sanitizeAgentOutputText !== "function") throw new Error("AgentRuntimeTurnModule requires deps.sanitizeAgentOutputText()");
  if (typeof parseJsonSafe !== "function") throw new Error("AgentRuntimeTurnModule requires deps.parseJsonSafe()");
  if (typeof summarizeToolArgs !== "function") throw new Error("AgentRuntimeTurnModule requires deps.summarizeToolArgs()");
  if (typeof normalizeToolResult !== "function") throw new Error("AgentRuntimeTurnModule requires deps.normalizeToolResult()");
  if (typeof isMutationToolName !== "function") throw new Error("AgentRuntimeTurnModule requires deps.isMutationToolName()");
  if (typeof updateAgentTurnWebEvidence !== "function") throw new Error("AgentRuntimeTurnModule requires deps.updateAgentTurnWebEvidence()");
  if (typeof prepareToolResources !== "function") throw new Error("AgentRuntimeTurnModule requires deps.prepareToolResources()");
  if (typeof compactOpenAiResponse !== "function") throw new Error("AgentRuntimeTurnModule requires deps.compactOpenAiResponse()");

  const TOOL_IO_TEXT_LIMIT = 320;

  function makeCanceledError() {
    const e = new Error("request canceled by user");
    e.canceled = true;
    return e;
  }

  function throwIfCanceled() {
    if (app.ai.cancelRequested || app.ai.taskState === "cancel_requested" || app.ai.taskState === "cancelled") {
      throw makeCanceledError();
    }
  }

  function compactToolIoText(value, maxLen = TOOL_IO_TEXT_LIMIT) {
    let raw = "";
    try {
      raw = JSON.stringify(value);
    } catch {
      raw = String(value ?? "");
    }
    const text = String(raw || "").replace(/\s+/g, " ").trim();
    if (!text) return "{}";
    if (text.length <= maxLen) return text;
    return `${text.slice(0, Math.max(0, maxLen - 3))}...`;
  }

  function summarizeToolOutput(result) {
    const src = result && typeof result === "object" ? result : {};
    const out = {
      ok: Boolean(src.ok),
      applied: Math.max(0, num(src.applied, 0)),
    };

    if (src.entity && typeof src.entity === "object") {
      out.entity = {
        type: String(src.entity.type || ""),
        id: String(src.entity.id || ""),
      };
    }
    if (Array.isArray(src.warnings) && src.warnings.length) out.warnings = src.warnings.slice(0, 3);
    if (src.awaiting_user_input) out.awaiting_user_input = true;
    if (src.error) {
      out.error = String(src.error).replace(/\s+/g, " ").trim().slice(0, 180);
    } else if (src.message && !src.ok) {
      out.message = String(src.message).replace(/\s+/g, " ").trim().slice(0, 180);
    }
    if (src.selection && typeof src.selection === "object" && src.selection.range) {
      out.selection = { range: String(src.selection.range || "") };
    }
    if (src.sheet && typeof src.sheet === "object" && src.sheet.id) {
      out.sheet = { id: String(src.sheet.id || "") };
    }
    return out;
  }

  function hasBuiltInToolUsage(response) {
    const src = Array.isArray(response?.output) ? response.output : [];
    for (const item of src) {
      const type = String(item?.type || "").toLowerCase();
      if (!type) continue;
      if (type.includes("web_search")) return true;
      if (type.includes("file_search")) return true;
      if (type === "computer_call" || type.includes("computer_use")) return true;
    }
    return false;
  }

  function hasComputerUseCall(response) {
    const src = Array.isArray(response?.output) ? response.output : [];
    return src.some((item) => {
      const type = String(item?.type || "").toLowerCase();
      return type === "computer_call" || type.includes("computer_use");
    });
  }

  function hasPendingFunctionCalls(response) {
    const src = Array.isArray(response?.output) ? response.output : [];
    return src.some((item) => String(item?.type || "").toLowerCase() === "function_call");
  }

  function isResponseIncomplete(response) {
    const status = String(response?.status || "").trim().toLowerCase();
    if (status === "incomplete") return true;
    return Boolean(response?.incomplete_details && typeof response.incomplete_details === "object");
  }

  function getRuntimeAwareOption(key, fallback = undefined) {
    const runtimeOverrides = app?.ai?.runtimeProfile?.overrides;
    if (runtimeOverrides && Object.prototype.hasOwnProperty.call(runtimeOverrides, key)) {
      return runtimeOverrides[key];
    }
    const value = app?.ai?.options?.[key];
    return value === undefined ? fallback : value;
  }

  function normalizeCompactMode(value, fallback = "off") {
    const raw = String(value || "").trim().toLowerCase();
    if (raw === "off" || raw === "auto" || raw === "on") return raw;
    const fb = String(fallback || "").trim().toLowerCase();
    if (fb === "off" || fb === "auto" || fb === "on") return fb;
    return "off";
  }

  function normalizePositiveInt(value, fallback = 0, min = 1, max = 4000000) {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) {
      const fb = Number(fallback);
      if (!Number.isFinite(fb) || fb <= 0) return 0;
      return Math.max(min, Math.min(max, Math.round(fb)));
    }
    return Math.max(min, Math.min(max, Math.round(n)));
  }

  function normalizeNonNegativeInt(value, fallback = 0, min = 0, max = 4000000) {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) {
      const fb = Number(fallback);
      if (!Number.isFinite(fb) || fb < 0) return 0;
      return Math.max(min, Math.min(max, Math.round(fb)));
    }
    return Math.max(min, Math.min(max, Math.round(n)));
  }

  function normalizeBooleanOption(value, fallback = false) {
    if (typeof value === "boolean") return value;
    if (value === undefined || value === null) return Boolean(fallback);
    const raw = String(value).trim().toLowerCase();
    if (raw === "1" || raw === "true" || raw === "on" || raw === "yes") return true;
    if (raw === "0" || raw === "false" || raw === "off" || raw === "no") return false;
    return Boolean(fallback);
  }

  function normalizeClarifyMode(value, fallback = "never") {
    const raw = String(value || "").trim().toLowerCase();
    if (raw === "never" || raw === "minimal" || raw === "normal") return raw;
    const fb = String(fallback || "").trim().toLowerCase();
    if (fb === "never" || fb === "minimal" || fb === "normal") return fb;
    return "never";
  }

  function normalizeRiskyActionsMode(value, fallback = "allow_if_asked") {
    const raw = String(value || "").trim().toLowerCase();
    if (raw === "confirm" || raw === "allow_if_asked" || raw === "never") return raw;
    const fb = String(fallback || "").trim().toLowerCase();
    if (fb === "confirm" || fb === "allow_if_asked" || fb === "never") return fb;
    return "allow_if_asked";
  }

  function normalizeToolsMode(value, fallback = "auto") {
    const raw = String(value || "").trim().toLowerCase();
    if (raw === "none" || raw === "auto" || raw === "prefer" || raw === "require") return raw;
    const fb = String(fallback || "").trim().toLowerCase();
    if (fb === "none" || fb === "auto" || fb === "prefer" || fb === "require") return fb;
    return "auto";
  }

  function normalizeReasoningVerify(value, fallback = "basic") {
    const raw = String(value || "").trim().toLowerCase();
    if (raw === "off" || raw === "basic" || raw === "strict") return raw;
    const fb = String(fallback || "").trim().toLowerCase();
    if (fb === "off" || fb === "basic" || fb === "strict") return fb;
    return "basic";
  }

  function normalizeReasoningDepth(value, fallback = "balanced") {
    const raw = String(value || "").trim().toLowerCase();
    if (raw === "fast" || raw === "balanced" || raw === "deep") return raw;
    const fb = String(fallback || "").trim().toLowerCase();
    if (fb === "fast" || fb === "balanced" || fb === "deep") return fb;
    return "balanced";
  }

  function normalizeReasoningEffort(value, fallback = "medium") {
    const raw = String(value || "").trim().toLowerCase();
    if (raw === "none" || raw === "minimal" || raw === "low" || raw === "medium" || raw === "high" || raw === "xhigh") return raw;
    const fb = String(fallback || "").trim().toLowerCase();
    if (fb === "none" || fb === "minimal" || fb === "low" || fb === "medium" || fb === "high" || fb === "xhigh") return fb;
    return "medium";
  }

  function normalizeServiceTier(value, fallback = "standard") {
    const raw = String(value || "").trim().toLowerCase();
    if (raw === "flex" || raw === "standard" || raw === "priority") return raw;
    const fb = String(fallback || "").trim().toLowerCase();
    if (fb === "flex" || fb === "standard" || fb === "priority") return fb;
    return "standard";
  }

  function normalizeBackgroundMode(value, fallback = "auto") {
    const raw = String(value || "").trim().toLowerCase();
    if (raw === "off" || raw === "auto" || raw === "on") return raw;
    const fb = String(fallback || "").trim().toLowerCase();
    if (fb === "off" || fb === "auto" || fb === "on") return fb;
    return "auto";
  }

  function normalizeLimitMode(value, fallback = "off") {
    const raw = String(value || "").trim().toLowerCase();
    if (raw === "off" || raw === "auto" || raw === "on") return raw;
    const fb = String(fallback || "").trim().toLowerCase();
    if (fb === "off" || fb === "auto" || fb === "on") return fb;
    return "off";
  }

  function normalizeAutoRuntimeOverridesMode(value, fallback = "auto") {
    const raw = String(value || "").trim().toLowerCase();
    if (raw === "auto" || raw === "off" || raw === "force") return raw;
    const fb = String(fallback || "").trim().toLowerCase();
    if (fb === "auto" || fb === "off" || fb === "force") return fb;
    return "auto";
  }

  function analyzeTaskPreflight(userTextRaw, runtimeProfile, options = {}) {
    const text = String(userTextRaw || "").trim();
    const selectedProfile = String(runtimeProfile?.selected || "").trim().toLowerCase();
    const toolsMode = normalizeToolsMode(options?.toolsMode, "auto");
    const toolsDisabled = toolsMode === "none";
    const attachmentsCount = normalizeNonNegativeInt(options?.attachmentsCount, 0, 0, 2000000);
    const actionable = options?.actionable === true;
    const complexity = typeof analyzeTaskComplexity === "function"
      ? analyzeTaskComplexity(text, { attachmentsCount })
      : null;
    const analysisIntent = Boolean(complexity?.analysisIntent) || AI_ANALYSIS_INTENT_RE.test(text);
    const workspaceScope = Boolean(complexity?.sourceScope)
      || /(source code|repository|repo|codebase|module|file|files|project|attachment|attachments|репозитор|проект|модул|файл|вложен)/i.test(text)
      || attachmentsCount > 0;
    const explicitDeepCue = Boolean(complexity?.deepCue)
      || /(totally|total|fully|full|end[-\s]?to[-\s]?end|max(?:imum)?|unlimited|deep(?:\s+dive)?|до\s+конца|тоталь|максимум|полност|не\s+ограничивай|глубок\w+\s+разбор)/i.test(text);
    const explicitNoLimitsCue = Boolean(complexity?.noLimitsCue)
      || /(без\s+огранич|не\s*хочу[\s\S]{0,24}огранич|ни\s*хочу[\s\S]{0,24}огранич|нихочу[\s\S]{0,24}огранич|no\s+limit|without\s+limits|as\s+much\s+as\s+needed|unbounded|full\s+resources?|unlimited\s+resources?|no\s+token\s+limit|no\s+tool\s+limit|сколько\s+нужно|любыми\s+ресурс)/i.test(text);
    const severity = String(complexity?.severity || "").trim().toLowerCase();
    const heavyComplexity = severity === "heavy" || severity === "extreme";
    const moderateComplexity = severity === "moderate";
    const analysisScope = analysisIntent && workspaceScope;
    const deepProfiles = new Set(["source_audit", "research", "longrun", "spec_strict", "proposal", "bulk"]);
    const uncappedDeepProfiles = new Set(["source_audit", "research", "longrun", "spec_strict"]);
    const strictToolsProfiles = new Set(["source_audit", "research", "price_search", "spec_strict"]);
    const strictVerifyProfiles = new Set(["source_audit", "research", "spec_strict"]);
    const strongDepthProfiles = new Set(["source_audit", "research", "spec_strict", "longrun"]);

    const wantsDeepCompletion = deepProfiles.has(selectedProfile)
      || explicitDeepCue
      || explicitNoLimitsCue
      || Boolean(complexity?.wantsDeepProfile);
    const intentToMutate = !toolsDisabled && AI_MUTATION_INTENT_RE.test(text);
    const expectedMutationsHint = estimateExpectedMutationCount(text, intentToMutate);
    const intentToUseTools = !toolsDisabled
      && (actionable || analysisIntent || workspaceScope || Boolean(complexity?.prefersResearch));
    const verifyMode = normalizeReasoningVerify(options?.reasoningVerify, "basic");
    const depthMode = normalizeReasoningDepth(options?.reasoningDepth, "balanced");
    const effortMode = normalizeReasoningEffort(options?.reasoningEffort, "medium");
    const serviceTier = normalizeServiceTier(options?.serviceTier, "standard");
    const backgroundMode = normalizeBackgroundMode(options?.backgroundMode, "auto");
    const compactMode = normalizeCompactMode(options?.compactMode, "off");
    const compactThresholdTokens = normalizePositiveInt(options?.compactThresholdTokens, 90000, 1000, 4000000);
    const compactTurnThreshold = normalizePositiveInt(options?.compactTurnThreshold, 45, 1, 10000);
    const useConversationState = normalizeBooleanOption(options?.useConversationState, false);
    const cleanContextHandoffMax = normalizeNonNegativeInt(options?.cleanContextHandoffMax, 1, 0, 2000000);
    const maxTokens = normalizePositiveInt(options?.reasoningMaxTokens, 0, 1, 2000000);

    let minToolCalls = 0;
    if (!toolsDisabled) {
      if (intentToMutate) minToolCalls = Math.max(minToolCalls, 1);
      if (intentToUseTools) {
        if (
          selectedProfile === "source_audit"
          || selectedProfile === "research"
          || selectedProfile === "longrun"
          || (analysisScope && (heavyComplexity || explicitNoLimitsCue))
        ) {
          minToolCalls = Math.max(minToolCalls, 2);
        } else if (
          wantsDeepCompletion
          || analysisIntent
          || workspaceScope
          || heavyComplexity
          || moderateComplexity
        ) {
          minToolCalls = Math.max(minToolCalls, 1);
        }
      }
    }

    const out = {
      wantsDeepCompletion,
      intentToUseTools,
      intentToMutate,
      minToolCalls,
      expectedMutationsHint,
      actionable,
      analysisIntent,
      workspaceScope,
      toolsMode,
      selectedProfile,
      forceNoLimits: explicitNoLimitsCue,
      complexitySeverity: severity,
      complexityScore: Math.max(0, num(complexity?.score, 0)),
    };

    if (!toolsDisabled && (toolsMode === "auto" || toolsMode === "prefer")) {
      if (wantsDeepCompletion && strictToolsProfiles.has(selectedProfile)) {
        out.overrideToolsMode = "require";
      } else if (analysisScope && (heavyComplexity || explicitDeepCue || explicitNoLimitsCue)) {
        out.overrideToolsMode = "require";
      }
    }
    if (
      verifyMode !== "strict"
      && (
        (wantsDeepCompletion && strictVerifyProfiles.has(selectedProfile))
        || (analysisScope && heavyComplexity)
        || explicitNoLimitsCue
      )
    ) {
      out.overrideVerify = "strict";
    }
    if (wantsDeepCompletion && (uncappedDeepProfiles.has(selectedProfile) || heavyComplexity || explicitNoLimitsCue)) {
      if (maxTokens > 0) out.overrideReasoningMaxTokens = 0;
    }
    if (wantsDeepCompletion && (analysisScope || heavyComplexity || strongDepthProfiles.has(selectedProfile))) {
      if (depthMode === "fast") out.overrideReasoningDepth = "deep";
      if (effortMode === "none" || effortMode === "minimal" || effortMode === "low" || effortMode === "medium") {
        out.overrideReasoningEffort = (explicitNoLimitsCue || severity === "extreme") ? "xhigh" : "high";
      }
      if (!useConversationState) out.overrideUseConversationState = true;
      if (compactMode === "off") out.overrideCompactMode = explicitNoLimitsCue ? "on" : "auto";
      const desiredCompactTokenThreshold = explicitNoLimitsCue
        ? 50000
        : heavyComplexity
          ? 60000
          : 75000;
      const desiredCompactTurnThreshold = explicitNoLimitsCue
        ? 14
        : heavyComplexity
          ? 20
          : 28;
      if (compactThresholdTokens > desiredCompactTokenThreshold) {
        out.overrideCompactThresholdTokens = desiredCompactTokenThreshold;
      }
      if (compactTurnThreshold > desiredCompactTurnThreshold) {
        out.overrideCompactTurnThreshold = desiredCompactTurnThreshold;
      }
      if (cleanContextHandoffMax > 0) {
        const desiredHandoffs = explicitNoLimitsCue
          ? 8
          : heavyComplexity
            ? 4
            : 2;
        if (cleanContextHandoffMax < desiredHandoffs) out.overrideCleanContextHandoffMax = desiredHandoffs;
      }
    }
    if (explicitNoLimitsCue) {
      out.overrideExecutionLimitsMode = "off";
      if (!toolsDisabled && (toolsMode === "auto" || toolsMode === "prefer")) {
        out.overrideToolsMode = "require";
      }
      if (verifyMode !== "strict") out.overrideVerify = "strict";
      if (depthMode !== "deep") out.overrideReasoningDepth = "deep";
      if (effortMode !== "high" && effortMode !== "xhigh") out.overrideReasoningEffort = "xhigh";
      if (serviceTier !== "priority") out.overrideServiceTier = "priority";
      if (backgroundMode !== "on") out.overrideBackgroundMode = "on";
      if (!useConversationState) out.overrideUseConversationState = true;
      if (compactMode !== "on") out.overrideCompactMode = "on";
      if (compactThresholdTokens > 45000) out.overrideCompactThresholdTokens = 45000;
      if (compactTurnThreshold > 12) out.overrideCompactTurnThreshold = 12;
      if (cleanContextHandoffMax > 0 && cleanContextHandoffMax < 8) {
        out.overrideCleanContextHandoffMax = 8;
      }
      if (maxTokens > 0) out.overrideReasoningMaxTokens = 0;
    }
    return out;
  }
  function evaluateCompletionGuard(preflight, toolStats, progress, options = {}) {
    if (!preflight || typeof preflight !== "object") return { triggered: false, reason: "" };
    const guardEnabled = Boolean(preflight.wantsDeepCompletion || preflight.intentToUseTools || preflight.intentToMutate);
    if (!guardEnabled) return { triggered: false, reason: "" };

    const builtInToolCalls = Math.max(0, num(options?.builtInToolCalls, 0));
    const minToolCalls = Math.max(0, num(preflight.minToolCalls, 0));
    const effectiveToolCalls = Math.max(0, num(toolStats?.totalToolCalls, 0)) + builtInToolCalls;
    if (minToolCalls > 0 && effectiveToolCalls < minToolCalls) {
      return {
        triggered: true,
        reason: "completion_guard:min_tools_not_met",
        details: {
          min_tool_calls: minToolCalls,
          effective_tool_calls: effectiveToolCalls,
          built_in_tool_calls: builtInToolCalls,
        },
      };
    }

    const failedTools = Array.isArray(progress?.failedTools) ? progress.failedTools : [];
    const successfulMutations = Math.max(0, num(toolStats?.successfulMutations, 0));
    if (preflight.intentToMutate && failedTools.length > 0 && successfulMutations === 0) {
      return {
        triggered: true,
        reason: "completion_guard:failed_tools",
        details: {
          failed_tools: failedTools.slice(-3),
          successful_mutations: successfulMutations,
        },
      };
    }

    return { triggered: false, reason: "" };
  }

  function canAskUserQuestions() {
    const clarify = normalizeClarifyMode(getRuntimeAwareOption("reasoningClarify", "never"), "never");
    const risky = normalizeRiskyActionsMode(getRuntimeAwareOption("riskyActionsMode", "allow_if_asked"), "allow_if_asked");
    const toolsMode = normalizeToolsMode(getRuntimeAwareOption("toolsMode", "auto"), "auto");
    return clarify !== "never" && risky !== "never" && toolsMode !== "none";
  }

  function extractResponseUsage(response) {
    const usage = response?.usage && typeof response.usage === "object" ? response.usage : {};
    const pick = (...keys) => {
      for (const key of keys) {
        const n = Number(usage?.[key]);
        if (Number.isFinite(n) && n >= 0) return Math.round(n);
      }
      return 0;
    };
    const inputTokens = pick("input_tokens", "prompt_tokens", "total_input_tokens");
    const outputTokens = pick("output_tokens", "completion_tokens", "total_output_tokens");
    const totalTokens = pick("total_tokens");
    return {
      inputTokens,
      outputTokens,
      totalTokens: totalTokens > 0 ? totalTokens : inputTokens + outputTokens,
    };
  }

  function rememberResponseUsage(response) {
    const usage = extractResponseUsage(response);
    if (usage.inputTokens > 0) app.ai.lastInputTokens = usage.inputTokens;
    if (usage.outputTokens > 0) app.ai.lastOutputTokens = usage.outputTokens;
    if (usage.totalTokens > 0) app.ai.lastTotalTokens = usage.totalTokens;
  }

  function isPreviousResponseError(err) {
    const text = String(err?.message || "").toLowerCase();
    if (!text.includes("previous_response_id")) return false;
    return text.includes("not found")
      || text.includes("invalid")
      || text.includes("unknown")
      || text.includes("expired")
      || text.includes("does not exist");
  }

  function isContextOverflowError(err) {
    const text = String(err?.message || err || "").toLowerCase();
    if (!text) return false;
    return text.includes("context_length_exceeded")
      || text.includes("maximum context length")
      || text.includes("context window")
      || text.includes("prompt is too long")
      || text.includes("input is too long")
      || text.includes("too many tokens")
      || text.includes("too many input tokens")
      || text.includes("token limit exceeded");
  }

  async function maybeAutoCompactResponse(response, options = {}) {
    const responseId = String(response?.id || "").trim();
    if (!responseId) return { compacted: false, responseId: "" };
    if (String(app.ai.lastCompactedResponseId || "") === responseId) return { compacted: false, responseId };
    const pendingToolOutputsCount = normalizeNonNegativeInt(options?.pendingToolOutputsCount, 0, 0, 1000000);
    if (pendingToolOutputsCount > 0) return { compacted: false, responseId };
    if (hasPendingFunctionCalls(response)) return { compacted: false, responseId };
    if (isResponseIncomplete(response)) return { compacted: false, responseId };
    const mode = normalizeCompactMode(getRuntimeAwareOption("compactMode", "off"), "off");
    if (mode === "off") return { compacted: false, responseId };

    const thresholdTokens = normalizePositiveInt(getRuntimeAwareOption("compactThresholdTokens", 90000), 90000, 1000, 4000000);
    const turnThreshold = normalizePositiveInt(getRuntimeAwareOption("compactTurnThreshold", 45), 45, 1, 10000);
    const usage = extractResponseUsage(response);
    const turns = Math.max(0, Number(app.ai.turnCounter || 0));
    const contextHeavy = usage.inputTokens > 0 && thresholdTokens > 0 && usage.inputTokens >= thresholdTokens;
    const longSession = turnThreshold > 0 && turns >= turnThreshold;
    const shouldCompact = mode === "on" || contextHeavy || longSession;
    if (!shouldCompact) return { compacted: false, responseId };

    const nowTs = Date.now();
    const lastCompactionTs = Math.max(0, Number(app.ai.lastCompactionTs || 0));
    const limitMode = normalizeLimitMode(getRuntimeAwareOption("executionLimitsMode", "off"), "off");
    const unboundedCompactionWindow = limitMode === "off";
    const minIntervalMs = mode === "on"
      ? (unboundedCompactionWindow ? 1500 : 5000)
      : (unboundedCompactionWindow ? 10000 : 45000);
    if (lastCompactionTs > 0 && (nowTs - lastCompactionTs) < minIntervalMs) {
      return { compacted: false, responseId };
    }

    const turnId = String(options?.turnId || app.ai.turnId || "");
    const requestId = String(response?.__request_id || app.ai.currentRequestId || "");
    const reason = mode === "on"
      ? "mode_on"
      : contextHeavy
        ? "input_tokens_threshold"
        : "long_running_session";
    const compacted = await compactOpenAiResponse(responseId, { turnId, requestId, reason });
    if (!compacted) return { compacted: false, responseId };
    const compactedResponseId = String(compacted?.id || responseId).trim() || responseId;

    // Keep the original response id for continuation calls.
    // Some compact endpoints may return ids that are not stable for previous_response_id chaining.
    app.ai.lastCompactedResponseId = responseId;
    app.ai.lastCompactionTs = nowTs;
    addExternalJournal("responses.compact.auto", `auto compact (${reason})`, {
      turn_id: turnId,
      request_id: requestId,
      response_id: responseId,
      status: "completed",
      meta: {
        reason,
        mode,
        input_tokens: usage.inputTokens || 0,
        threshold_tokens: thresholdTokens || 0,
        turn_counter: turns,
        turn_threshold: turnThreshold || 0,
        compacted_response_id: compactedResponseId,
      },
    });
    return {
      compacted: true,
      responseId,
      compactedResponseId,
    };
  }

  async function runOpenAiAgentTurn(userInput, rawUserText = "", options = {}) {
    throwIfCanceled();
    const modelId = currentAiModelMeta().id;
    const userMessageInput = [{ role: "user", content: [{ type: "input_text", text: userInput }] }];
    const userText = String(options?.rawUserText || rawUserText || "").trim();
    const turnId = String(options?.turnId || app.ai.turnId || "");
    const handoffDepth = normalizeNonNegativeInt(options?.handoffDepth, 0, 0, 2000000);
    app.ai.runtimeProfile = resolveTaskProfile(userText, app?.ai?.options?.taskProfile);
    addExternalJournal("agent.runtime_profile", "runtime profile resolved", {
      turn_id: turnId,
      status: "completed",
      meta: {
        mode: String(app?.ai?.runtimeProfile?.mode || ""),
        selected: String(app?.ai?.runtimeProfile?.selected || ""),
        reason: String(app?.ai?.runtimeProfile?.reason || ""),
        overrides: compactForTool(app?.ai?.runtimeProfile?.overrides || {}),
      },
    });
    const runtimeToolsMode = app?.ai?.runtimeProfile?.overrides?.toolsMode;
    const baseToolsMode = normalizeToolsMode(runtimeToolsMode ?? app?.ai?.options?.toolsMode ?? "auto", "auto");
    const baseVerifyMode = normalizeReasoningVerify(
      app?.ai?.runtimeProfile?.overrides?.reasoningVerify ?? app?.ai?.options?.reasoningVerify ?? "basic",
      "basic",
    );
    const baseReasoningDepth = normalizeReasoningDepth(
      app?.ai?.runtimeProfile?.overrides?.reasoningDepth ?? app?.ai?.options?.reasoningDepth ?? "balanced",
      "balanced",
    );
    const baseReasoningEffort = normalizeReasoningEffort(
      app?.ai?.runtimeProfile?.overrides?.reasoningEffort ?? app?.ai?.options?.reasoningEffort ?? "medium",
      "medium",
    );
    const baseServiceTier = normalizeServiceTier(
      app?.ai?.runtimeProfile?.overrides?.serviceTier ?? app?.ai?.options?.serviceTier ?? "standard",
      "standard",
    );
    const baseBackgroundMode = normalizeBackgroundMode(
      app?.ai?.runtimeProfile?.overrides?.backgroundMode ?? app?.ai?.options?.backgroundMode ?? "auto",
      "auto",
    );
    const baseReasoningMaxTokens = normalizePositiveInt(
      app?.ai?.runtimeProfile?.overrides?.reasoningMaxTokens ?? app?.ai?.options?.reasoningMaxTokens ?? 0,
      0,
      1,
      2000000,
    );
    const baseLimitMode = normalizeLimitMode(
      app?.ai?.runtimeProfile?.overrides?.executionLimitsMode ?? app?.ai?.options?.executionLimitsMode ?? "off",
      "off",
    );
    const baseCompactMode = normalizeCompactMode(
      app?.ai?.runtimeProfile?.overrides?.compactMode ?? app?.ai?.options?.compactMode ?? "off",
      "off",
    );
    const baseCompactThresholdTokens = normalizePositiveInt(
      app?.ai?.runtimeProfile?.overrides?.compactThresholdTokens ?? app?.ai?.options?.compactThresholdTokens ?? 90000,
      90000,
      1000,
      4000000,
    );
    const baseCompactTurnThreshold = normalizePositiveInt(
      app?.ai?.runtimeProfile?.overrides?.compactTurnThreshold ?? app?.ai?.options?.compactTurnThreshold ?? 45,
      45,
      1,
      10000,
    );
    const baseUseConversationState = normalizeBooleanOption(
      app?.ai?.runtimeProfile?.overrides?.useConversationState ?? app?.ai?.options?.useConversationState ?? false,
      false,
    );
    const baseCleanContextHandoffMax = normalizeNonNegativeInt(
      app?.ai?.runtimeProfile?.overrides?.cleanContextHandoffMax ?? app?.ai?.options?.cleanContextHandoffMax ?? 1,
      1,
      0,
      2000000,
    );
    const autoRuntimeOverridesMode = normalizeAutoRuntimeOverridesMode(
      getRuntimeAwareOption("autoRuntimeOverridesMode", "auto"),
      "auto",
    );
    const runtimeProfileMode = String(app?.ai?.runtimeProfile?.mode || "").trim().toLowerCase();
    const manualRuntimeProfileLocked = runtimeProfileMode === "custom" || runtimeProfileMode === "no_reasoning_custom";
    const autoOverridesEnabled = autoRuntimeOverridesMode !== "off" && !manualRuntimeProfileLocked;
    const autoOverridesForced = autoRuntimeOverridesMode === "force" && !manualRuntimeProfileLocked;
    const attachmentsCount = Array.isArray(app?.ai?.attachments) ? app.ai.attachments.length : 0;
    const actionablePrompt = isActionableAgentPrompt(userText);
    const preflightDraft = analyzeTaskPreflight(userText, app.ai.runtimeProfile, {
      toolsMode: baseToolsMode,
      attachmentsCount,
      actionable: actionablePrompt,
      reasoningVerify: baseVerifyMode,
      reasoningDepth: baseReasoningDepth,
      reasoningEffort: baseReasoningEffort,
      serviceTier: baseServiceTier,
      backgroundMode: baseBackgroundMode,
      reasoningMaxTokens: baseReasoningMaxTokens,
      compactMode: baseCompactMode,
      compactThresholdTokens: baseCompactThresholdTokens,
      compactTurnThreshold: baseCompactTurnThreshold,
      useConversationState: baseUseConversationState,
      cleanContextHandoffMax: baseCleanContextHandoffMax,
    });
    let appliedToolsModeOverride = "";
    let appliedVerifyOverride = "";
    let appliedDepthOverride = "";
    let appliedEffortOverride = "";
    let appliedServiceTierOverride = "";
    let appliedBackgroundModeOverride = "";
    let appliedReasoningMaxTokensOverride = null;
    let appliedExecutionLimitsOverride = "";
    let appliedUseConversationStateOverride = null;
    let appliedCompactModeOverride = "";
    let appliedCompactThresholdTokensOverride = null;
    let appliedCompactTurnThresholdOverride = null;
    let appliedCleanContextHandoffMaxOverride = null;
    const allowPromptForcedOverrides = preflightDraft.forceNoLimits && autoRuntimeOverridesMode !== "off";
    const overridesEnabledForThisTurn = autoOverridesEnabled || allowPromptForcedOverrides;
    if (overridesEnabledForThisTurn && app?.ai?.runtimeProfile && typeof app.ai.runtimeProfile === "object") {
      if (!app.ai.runtimeProfile.overrides || typeof app.ai.runtimeProfile.overrides !== "object") {
        app.ai.runtimeProfile.overrides = {};
      }
      if (preflightDraft.overrideExecutionLimitsMode === "off" && baseLimitMode !== "off") {
        app.ai.runtimeProfile.overrides.executionLimitsMode = "off";
        appliedExecutionLimitsOverride = "off";
      }
      if (
        preflightDraft.overrideToolsMode
        && baseToolsMode !== "none"
        && (autoOverridesForced || baseToolsMode === "auto" || baseToolsMode === "prefer")
      ) {
        app.ai.runtimeProfile.overrides.toolsMode = preflightDraft.overrideToolsMode;
        appliedToolsModeOverride = preflightDraft.overrideToolsMode;
      }
      if (preflightDraft.overrideVerify === "strict" && baseVerifyMode !== "strict") {
        app.ai.runtimeProfile.overrides.reasoningVerify = "strict";
        appliedVerifyOverride = "strict";
      }
      if (preflightDraft.overrideReasoningDepth && baseReasoningDepth !== preflightDraft.overrideReasoningDepth) {
        app.ai.runtimeProfile.overrides.reasoningDepth = preflightDraft.overrideReasoningDepth;
        appliedDepthOverride = preflightDraft.overrideReasoningDepth;
      }
      if (preflightDraft.overrideReasoningEffort && baseReasoningEffort !== preflightDraft.overrideReasoningEffort) {
        app.ai.runtimeProfile.overrides.reasoningEffort = preflightDraft.overrideReasoningEffort;
        appliedEffortOverride = preflightDraft.overrideReasoningEffort;
      }
      if (preflightDraft.overrideServiceTier && baseServiceTier !== preflightDraft.overrideServiceTier) {
        app.ai.runtimeProfile.overrides.serviceTier = preflightDraft.overrideServiceTier;
        appliedServiceTierOverride = preflightDraft.overrideServiceTier;
      }
      if (preflightDraft.overrideBackgroundMode && baseBackgroundMode !== preflightDraft.overrideBackgroundMode) {
        app.ai.runtimeProfile.overrides.backgroundMode = preflightDraft.overrideBackgroundMode;
        appliedBackgroundModeOverride = preflightDraft.overrideBackgroundMode;
      }
      if (Object.prototype.hasOwnProperty.call(preflightDraft, "overrideReasoningMaxTokens")) {
        app.ai.runtimeProfile.overrides.reasoningMaxTokens = preflightDraft.overrideReasoningMaxTokens;
        appliedReasoningMaxTokensOverride = preflightDraft.overrideReasoningMaxTokens;
      }
      if (preflightDraft.overrideUseConversationState === true && !baseUseConversationState) {
        app.ai.runtimeProfile.overrides.useConversationState = true;
        appliedUseConversationStateOverride = true;
      }
      if (preflightDraft.overrideCompactMode && baseCompactMode !== preflightDraft.overrideCompactMode) {
        app.ai.runtimeProfile.overrides.compactMode = preflightDraft.overrideCompactMode;
        appliedCompactModeOverride = preflightDraft.overrideCompactMode;
      }
      if (Object.prototype.hasOwnProperty.call(preflightDraft, "overrideCompactThresholdTokens")) {
        const compactTokens = normalizePositiveInt(
          preflightDraft.overrideCompactThresholdTokens,
          baseCompactThresholdTokens,
          1000,
          4000000,
        );
        if (compactTokens > 0 && compactTokens !== baseCompactThresholdTokens) {
          app.ai.runtimeProfile.overrides.compactThresholdTokens = compactTokens;
          appliedCompactThresholdTokensOverride = compactTokens;
        }
      }
      if (Object.prototype.hasOwnProperty.call(preflightDraft, "overrideCompactTurnThreshold")) {
        const compactTurns = normalizePositiveInt(
          preflightDraft.overrideCompactTurnThreshold,
          baseCompactTurnThreshold,
          1,
          10000,
        );
        if (compactTurns > 0 && compactTurns !== baseCompactTurnThreshold) {
          app.ai.runtimeProfile.overrides.compactTurnThreshold = compactTurns;
          appliedCompactTurnThresholdOverride = compactTurns;
        }
      }
      if (Object.prototype.hasOwnProperty.call(preflightDraft, "overrideCleanContextHandoffMax")) {
        const cleanMax = normalizeNonNegativeInt(
          preflightDraft.overrideCleanContextHandoffMax,
          baseCleanContextHandoffMax,
          0,
          2000000,
        );
        if (cleanMax !== baseCleanContextHandoffMax) {
          app.ai.runtimeProfile.overrides.cleanContextHandoffMax = cleanMax;
          appliedCleanContextHandoffMaxOverride = cleanMax;
        }
      }
    }
    const toolsMode = normalizeToolsMode(
      app?.ai?.runtimeProfile?.overrides?.toolsMode ?? app?.ai?.options?.toolsMode ?? "auto",
      "auto",
    );
    const verifyMode = normalizeReasoningVerify(
      app?.ai?.runtimeProfile?.overrides?.reasoningVerify ?? app?.ai?.options?.reasoningVerify ?? "basic",
      "basic",
    );
    const preflight = analyzeTaskPreflight(userText, app.ai.runtimeProfile, {
      toolsMode,
      attachmentsCount,
      actionable: actionablePrompt,
      reasoningVerify: verifyMode,
      reasoningDepth: normalizeReasoningDepth(
        app?.ai?.runtimeProfile?.overrides?.reasoningDepth ?? app?.ai?.options?.reasoningDepth ?? "balanced",
        "balanced",
      ),
      reasoningEffort: normalizeReasoningEffort(
        app?.ai?.runtimeProfile?.overrides?.reasoningEffort ?? app?.ai?.options?.reasoningEffort ?? "medium",
        "medium",
      ),
      serviceTier: normalizeServiceTier(
        app?.ai?.runtimeProfile?.overrides?.serviceTier ?? app?.ai?.options?.serviceTier ?? "standard",
        "standard",
      ),
      backgroundMode: normalizeBackgroundMode(
        app?.ai?.runtimeProfile?.overrides?.backgroundMode ?? app?.ai?.options?.backgroundMode ?? "auto",
        "auto",
      ),
      reasoningMaxTokens: normalizePositiveInt(
        app?.ai?.runtimeProfile?.overrides?.reasoningMaxTokens ?? app?.ai?.options?.reasoningMaxTokens ?? 0,
        0,
        1,
        2000000,
      ),
      compactMode: normalizeCompactMode(
        app?.ai?.runtimeProfile?.overrides?.compactMode ?? app?.ai?.options?.compactMode ?? "off",
        "off",
      ),
      compactThresholdTokens: normalizePositiveInt(
        app?.ai?.runtimeProfile?.overrides?.compactThresholdTokens ?? app?.ai?.options?.compactThresholdTokens ?? 90000,
        90000,
        1000,
        4000000,
      ),
      compactTurnThreshold: normalizePositiveInt(
        app?.ai?.runtimeProfile?.overrides?.compactTurnThreshold ?? app?.ai?.options?.compactTurnThreshold ?? 45,
        45,
        1,
        10000,
      ),
      useConversationState: normalizeBooleanOption(
        app?.ai?.runtimeProfile?.overrides?.useConversationState ?? app?.ai?.options?.useConversationState ?? false,
        false,
      ),
      cleanContextHandoffMax: normalizeNonNegativeInt(
        app?.ai?.runtimeProfile?.overrides?.cleanContextHandoffMax ?? app?.ai?.options?.cleanContextHandoffMax ?? 1,
        1,
        0,
        2000000,
      ),
    });
    const limitMode = normalizeLimitMode(getRuntimeAwareOption("executionLimitsMode", "off"), "off");
    const forceNoLimitsActive = preflight.forceNoLimits && overridesEnabledForThisTurn;
    const unboundedExecution = forceNoLimitsActive
      || limitMode === "off"
      || (limitMode === "auto" && preflight.wantsDeepCompletion);
    const configuredStreamTimeoutMs = normalizeNonNegativeInt(
      getRuntimeAwareOption("streamTimeoutMs", 0),
      0,
      0,
      604800000,
    );
    const configuredBackgroundTimeoutMs = normalizeNonNegativeInt(
      getRuntimeAwareOption("backgroundTimeoutMs", 0),
      0,
      0,
      604800000,
    );
    const effectiveStreamTimeoutMs = unboundedExecution ? 0 : configuredStreamTimeoutMs;
    const effectiveBackgroundTimeoutMs = unboundedExecution ? 0 : configuredBackgroundTimeoutMs;
    const streamTimeoutLabel = effectiveStreamTimeoutMs > 0 ? effectiveStreamTimeoutMs : (unboundedExecution ? "unbounded" : "default");
    const backgroundTimeoutLabel = effectiveBackgroundTimeoutMs > 0 ? effectiveBackgroundTimeoutMs : (unboundedExecution ? "unbounded" : "default");
    const requestCallOptions = {
      turnId,
      onDelta: options?.onStreamDelta,
      onEvent: options?.onStreamEvent,
    };
    if (unboundedExecution || effectiveStreamTimeoutMs > 0) requestCallOptions.timeout_ms = effectiveStreamTimeoutMs;
    if (unboundedExecution || effectiveBackgroundTimeoutMs > 0) requestCallOptions.backgroundTimeoutMs = effectiveBackgroundTimeoutMs;
    const maxForcedRetries = unboundedExecution
      ? Number.POSITIVE_INFINITY
      : AGENT_MAX_FORCED_RETRIES;
    const maxToolRounds = unboundedExecution
      ? Number.POSITIVE_INFINITY
      : AGENT_MAX_TOOL_ROUNDS;
    const maxForcedRetriesLabel = Number.isFinite(maxForcedRetries) ? maxForcedRetries : "unbounded";
    const maxToolRoundsLabel = Number.isFinite(maxToolRounds) ? maxToolRounds : "unbounded";
    const toolsDisabled = toolsMode === "none";
    const intentToUseTools = preflight.intentToUseTools;
    const intentToMutate = preflight.intentToMutate;
    const expectedMutations = preflight.expectedMutationsHint;
    const cleanHandoffEnabled = getRuntimeAwareOption("cleanContextHandoff", true) !== false;
    const configuredMaxCleanHandoffs = normalizeNonNegativeInt(
      getRuntimeAwareOption("cleanContextHandoffMax", 1),
      1,
      0,
      2000000,
    );
    const maxCleanHandoffs = cleanHandoffEnabled
      ? (
          forceNoLimitsActive
            ? (configuredMaxCleanHandoffs > 0 ? Math.max(configuredMaxCleanHandoffs, 12) : 0)
            : configuredMaxCleanHandoffs
        )
      : 0;
    const maxCleanHandoffsLabel = Number.isFinite(maxCleanHandoffs) ? maxCleanHandoffs : "unbounded";
    // Always keep loop protection enabled when tools are available.
    // This prevents long read-only loops even if intent heuristics miss a mutation/research cue.
    const stallGuardEnabled = !toolsDisabled;
    const stallNoCallContinuationLimit = intentToMutate
      ? (forceNoLimitsActive ? 10 : 4)
      : forceNoLimitsActive
        ? 48
        : preflight.wantsDeepCompletion
          ? 10
          : 6;
    const stallNoProgressRoundLimit = intentToMutate
      ? (forceNoLimitsActive ? 24 : 8)
      : forceNoLimitsActive
        ? 96
        : preflight.wantsDeepCompletion
          ? 18
          : 12;
    const stallRepeatedSignatureRoundLimit = intentToMutate
      ? (forceNoLimitsActive ? 8 : 4)
      : forceNoLimitsActive
        ? 32
        : preflight.wantsDeepCompletion
          ? 8
          : 6;
    const stallAbsoluteNoProgressRoundLimit = forceNoLimitsActive
      ? 1200
      : preflight.wantsDeepCompletion
        ? 220
        : 120;
    const stallNoProgressSignatureWindow = Math.max(8, stallRepeatedSignatureRoundLimit + 2);
    const checkpointSnapshotLimit = forceNoLimitsActive
      ? 720
      : preflight.wantsDeepCompletion
        ? 180
        : 120;
    const checkpointMutationChangeLimit = forceNoLimitsActive
      ? 2000
      : preflight.wantsDeepCompletion
        ? 320
        : 200;
    const checkpointAssemblyChangeLimit = forceNoLimitsActive
      ? 1200
      : preflight.wantsDeepCompletion
        ? 220
        : 120;
    const checkpointFailureLimit = forceNoLimitsActive
      ? 720
      : preflight.wantsDeepCompletion
        ? 180
        : 120;
    const checkpointWebQueryLimit = forceNoLimitsActive
      ? 160
      : preflight.wantsDeepCompletion
        ? 40
        : 20;
    const checkpointWebUrlLimit = forceNoLimitsActive
      ? 320
      : preflight.wantsDeepCompletion
        ? 80
        : 40;
    const checkpointFailureTailLimit = forceNoLimitsActive
      ? 240
      : preflight.wantsDeepCompletion
        ? 60
        : 40;
    const checkpointMutationFailureTailLimit = forceNoLimitsActive
      ? 160
      : preflight.wantsDeepCompletion
        ? 40
        : 20;
    const checkpointTextCharLimit = forceNoLimitsActive
      ? 220000
      : preflight.wantsDeepCompletion
        ? 52000
        : 24000;
    addExternalJournal("agent.preflight", "task preflight analyzed", {
      turn_id: turnId,
      status: "completed",
      meta: {
        selected_profile: preflight.selectedProfile || "",
        tools_mode: preflight.toolsMode,
        wants_deep_completion: preflight.wantsDeepCompletion,
        actionable_prompt: preflight.actionable,
        analysis_intent: preflight.analysisIntent,
        complexity_severity: preflight.complexitySeverity || "",
        complexity_score: preflight.complexityScore || 0,
        workspace_scope: preflight.workspaceScope,
        intent_to_use_tools: preflight.intentToUseTools,
        intent_to_mutate: preflight.intentToMutate,
        min_tool_calls: preflight.minToolCalls,
        expected_mutations_hint: preflight.expectedMutationsHint,
        force_no_limits: preflight.forceNoLimits,
        force_no_limits_applied: forceNoLimitsActive,
        auto_runtime_overrides_mode: autoRuntimeOverridesMode,
        auto_runtime_overrides_enabled: autoOverridesEnabled,
        prompt_forced_overrides_enabled: allowPromptForcedOverrides,
        overrides_enabled_for_turn: overridesEnabledForThisTurn,
        runtime_profile_manual_lock: manualRuntimeProfileLocked,
        execution_limits_mode: limitMode,
        stream_timeout_ms: streamTimeoutLabel,
        background_timeout_ms: backgroundTimeoutLabel,
        max_forced_retries: maxForcedRetriesLabel,
        max_tool_rounds: maxToolRoundsLabel,
        clean_handoff_enabled: cleanHandoffEnabled,
        max_clean_handoffs: maxCleanHandoffsLabel,
        stall_guard_enabled: stallGuardEnabled,
        stall_no_call_continuation_limit: stallNoCallContinuationLimit,
        stall_no_progress_round_limit: stallNoProgressRoundLimit,
        stall_repeated_signature_round_limit: stallRepeatedSignatureRoundLimit,
        stall_absolute_no_progress_round_limit: stallAbsoluteNoProgressRoundLimit,
        checkpoint_snapshot_limit: checkpointSnapshotLimit,
        checkpoint_text_char_limit: checkpointTextCharLimit,
        attachments_count: attachmentsCount,
        overrides_applied: compactForTool({
          toolsMode: appliedToolsModeOverride || "",
          reasoningVerify: appliedVerifyOverride || "",
          reasoningDepth: appliedDepthOverride || "",
          reasoningEffort: appliedEffortOverride || "",
          serviceTier: appliedServiceTierOverride || "",
          backgroundMode: appliedBackgroundModeOverride || "",
          reasoningMaxTokens: appliedReasoningMaxTokensOverride,
          executionLimitsMode: appliedExecutionLimitsOverride || "",
          useConversationState: appliedUseConversationStateOverride,
          compactMode: appliedCompactModeOverride || "",
          compactThresholdTokens: appliedCompactThresholdTokensOverride,
          compactTurnThreshold: appliedCompactTurnThresholdOverride,
          cleanContextHandoffMax: appliedCleanContextHandoffMaxOverride,
        }),
      },
    });
    const toolStats = {
      totalToolCalls: 0,
      builtInToolCalls: 0,
      mutationCalls: 0,
      successfulMutations: 0,
      failedMutations: [],
      forcedRetries: 0,
    };
    const turnCtx = {
      webSearchUsed: false,
      webSearchQueries: [],
      webSearchUrls: [],
    };
    const progress = {
      completedChecklist: [],
      added: [],
      updated: [],
      deleted: [],
      assemblyChanges: [],
      failedTools: [],
    };
    const stallState = {
      noCallContinuationStreak: 0,
      noProgressRounds: 0,
      repeatedSignatureRounds: 0,
      lastRoundSignature: "",
      recentNoProgressSignatures: [],
    };
    const startedAt = Date.now();
    let roundsUsed = 0;

    const truncate = (value, maxLen = 180) => String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLen);
    const pushUniqueLimited = (list, value, limit = 80) => {
      const text = truncate(value, 240);
      if (!text) return;
      if (list.includes(text)) return;
      if (list.length >= limit) return;
      list.push(text);
    };
    const captureProgressMarker = () => ({
      successfulMutations: Math.max(0, Number(toolStats.successfulMutations || 0)),
      checklist: progress.completedChecklist.length,
      added: progress.added.length,
      updated: progress.updated.length,
      deleted: progress.deleted.length,
      assembly: progress.assemblyChanges.length,
    });
    const hasProgressDelta = (before, after) => (
      after.successfulMutations > before.successfulMutations
      || after.checklist > before.checklist
      || after.added > before.added
      || after.updated > before.updated
      || after.deleted > before.deleted
      || after.assembly > before.assembly
    );
    const buildToolCallSignature = (callName, summarizedArgs) => {
      const name = String(callName || "").trim();
      return `${name}:${compactToolIoText(summarizedArgs || {}, 180)}`;
    };
    const pushNoProgressSignature = (signature) => {
      const text = truncate(signature, 800) || "<empty>";
      stallState.recentNoProgressSignatures.push(text);
      if (stallState.recentNoProgressSignatures.length > stallNoProgressSignatureWindow) {
        stallState.recentNoProgressSignatures.shift();
      }
    };
    const noProgressSignatureDiversity = () => {
      const src = Array.isArray(stallState.recentNoProgressSignatures)
        ? stallState.recentNoProgressSignatures
        : [];
      return new Set(src).size;
    };
    const resetNoProgressStreak = () => {
      stallState.noProgressRounds = 0;
      stallState.repeatedSignatureRounds = 0;
      stallState.recentNoProgressSignatures = [];
    };

    const identifyToolTarget = (callName, args, result) => {
      const article = truncate(args?.article || "", 96);
      const name = truncate(args?.name || "", 120);
      const assembly = truncate(args?.assembly_name || args?.full_name || "", 120);
      const positionId = truncate(args?.position_id || "", 80);
      const assemblyId = truncate(args?.assembly_id || result?.entity?.id || "", 80);
      const attachmentId = truncate(args?.attachment_id || args?.file_id || args?.id || "", 80);
      const sheetId = truncate(args?.sheet_id || "", 80);
      const range = truncate(args?.range || args?.target_range || "", 120);
      const query = truncate(args?.query || args?.text || "", 120);
      const path = truncate(args?.path || args?.file || "", 120);
      if (article) return article;
      if (name) return name;
      if (positionId) return `position:${positionId}`;
      if (assemblyId && assembly) return `${assembly} (${assemblyId})`;
      if (assembly) return assembly;
      if (attachmentId) return `attachment:${attachmentId}`;
      if (sheetId && range) return `${sheetId}:${range}`;
      if (sheetId) return `sheet:${sheetId}`;
      if (range) return `range:${range}`;
      if (query) return `query:${query}`;
      if (path) return `path:${path}`;
      return callName;
    };

    const recordToolProgress = (callName, args, result) => {
      const target = identifyToolTarget(callName, args, result);
      const applied = Math.max(0, Number(result?.applied || 0));
      const ok = Boolean(result?.ok);

      if (ok && applied > 0) {
        pushUniqueLimited(progress.completedChecklist, `${callName}: ${target}`, checkpointSnapshotLimit);
      } else if (!ok) {
        const err = truncate(result?.error || result?.message || "tool error", 180);
        pushUniqueLimited(progress.failedTools, `${callName}: ${target}${err ? ` (${err})` : ""}`, checkpointFailureLimit);
      }

      if (!ok) return;
      if (applied <= 0) {
        // For research/audit tasks, successful read/list calls are useful progress.
        // For mutation intents keep stricter accounting to detect pointless loops.
        if (!intentToMutate && !isMutationToolName(callName)) {
          pushUniqueLimited(progress.completedChecklist, `inspect ${target} via ${callName}`, checkpointSnapshotLimit);
        }
        return;
      }

      if (
        callName === "add_position"
        || callName === "add_project_position"
        || callName === "duplicate_position"
      ) {
        pushUniqueLimited(progress.added, `${target} via ${callName}`, checkpointMutationChangeLimit);
        return;
      }
      if (
        callName === "update_position"
        || callName === "update_project_position"
        || callName === "set_state_value"
        || callName === "write_cells"
        || callName === "write_matrix"
        || callName === "fill_range"
        || callName === "replace_in_range"
        || callName === "copy_range"
      ) {
        pushUniqueLimited(progress.updated, `${target} via ${callName}`, checkpointMutationChangeLimit);
        return;
      }
      if (
        callName === "delete_position"
        || callName === "delete_project_position"
        || callName === "clear_range"
        || callName === "clear_sheet_overrides"
      ) {
        pushUniqueLimited(progress.deleted, `${target} via ${callName}`, checkpointMutationChangeLimit);
        return;
      }
      if (
        callName === "create_assembly"
        || callName === "update_assembly"
        || callName === "duplicate_assembly"
        || callName === "delete_assembly"
        || callName === "bulk_delete_assemblies"
      ) {
        pushUniqueLimited(progress.assemblyChanges, `${target} via ${callName}`, checkpointAssemblyChangeLimit);
      }
    };

    const buildCheckpointSnapshot = (trigger, response = null, reason = "") => {
      const usage = extractResponseUsage(response);
      const snapshot = {
        version: "v1",
        trigger: truncate(trigger, 64),
        reason: truncate(reason, 220),
        turn_id: turnId,
        handoff_depth: handoffDepth,
        user_request: truncate(userText, 1200),
        model: truncate(modelId, 64),
        elapsed_ms: Math.max(0, Date.now() - startedAt),
        response_id: truncate(response?.id || app.ai.streamResponseId || "", 100),
        response_status: truncate(response?.status || "", 32),
        incomplete_details: compactForTool(response?.incomplete_details || null),
        rounds_used: roundsUsed,
        max_rounds: maxToolRoundsLabel,
        forced_retries: toolStats.forcedRetries,
        max_forced_retries: maxForcedRetriesLabel,
        expected_mutations: expectedMutations,
        successful_mutations: toolStats.successfulMutations,
        total_tool_calls: toolStats.totalToolCalls,
        built_in_tool_calls: toolStats.builtInToolCalls,
        usage: {
          input_tokens: usage.inputTokens || 0,
          output_tokens: usage.outputTokens || 0,
          total_tokens: usage.totalTokens || 0,
        },
        web_evidence: {
          used: Boolean(turnCtx.webSearchUsed),
          queries: Array.isArray(turnCtx.webSearchQueries) ? turnCtx.webSearchQueries.slice(-checkpointWebQueryLimit) : [],
          urls: Array.isArray(turnCtx.webSearchUrls) ? turnCtx.webSearchUrls.slice(-checkpointWebUrlLimit) : [],
        },
        completed_checklist: progress.completedChecklist.slice(0, checkpointSnapshotLimit),
        added: progress.added.slice(0, checkpointSnapshotLimit),
        updated: progress.updated.slice(0, checkpointSnapshotLimit),
        deleted: progress.deleted.slice(0, checkpointSnapshotLimit),
        assembly_changes: progress.assemblyChanges.slice(0, Math.min(checkpointSnapshotLimit, checkpointAssemblyChangeLimit)),
        failed_tools: progress.failedTools.slice(-checkpointFailureTailLimit),
        mutation_failures: toolStats.failedMutations.slice(-checkpointMutationFailureTailLimit),
        stall_guard: {
          enabled: stallGuardEnabled,
          no_call_streak: stallState.noCallContinuationStreak,
          no_progress_rounds: stallState.noProgressRounds,
          repeated_signature_rounds: stallState.repeatedSignatureRounds,
        },
      };
      return snapshot;
    };

    const buildCheckpointText = (snapshot, forHandoff = false) => {
      const lines = [];
      lines.push(`Checkpoint v1 | trigger=${snapshot.trigger} | turn=${snapshot.turn_id}`);
      if (snapshot.reason) lines.push(`Reason: ${snapshot.reason}`);
      lines.push(`Request: ${snapshot.user_request}`);
      lines.push(`Model: ${snapshot.model} | elapsed_ms=${snapshot.elapsed_ms}`);
      lines.push(`Response: id=${snapshot.response_id || "-"} status=${snapshot.response_status || "-"}`);
      lines.push(`Progress: tool_calls=${snapshot.total_tool_calls}, mutations=${snapshot.successful_mutations}/${snapshot.expected_mutations}, retries=${snapshot.forced_retries}/${snapshot.max_forced_retries}, rounds=${snapshot.rounds_used}/${snapshot.max_rounds}`);
      lines.push(`Tokens: in=${snapshot.usage.input_tokens}, out=${snapshot.usage.output_tokens}, total=${snapshot.usage.total_tokens}`);
      lines.push("");
      lines.push("Completed checklist:");
      if (snapshot.completed_checklist.length) {
        for (let i = 0; i < snapshot.completed_checklist.length; i += 1) {
          lines.push(`${i + 1}. ${snapshot.completed_checklist[i]}`);
        }
      } else {
        lines.push("1. none");
      }

      const appendFlat = (title, items) => {
        lines.push("");
        lines.push(`${title}:`);
        if (!items.length) {
          lines.push("1. none");
          return;
        }
        for (let i = 0; i < items.length; i += 1) {
          lines.push(`${i + 1}. ${items[i]}`);
        }
      };
      appendFlat("Added", snapshot.added);
      appendFlat("Updated", snapshot.updated);
      appendFlat("Deleted", snapshot.deleted);
      appendFlat("Assembly changes", snapshot.assembly_changes);
      appendFlat(
        "Failures",
        [...snapshot.failed_tools, ...snapshot.mutation_failures]
          .slice(0, Math.max(80, checkpointFailureTailLimit + checkpointMutationFailureTailLimit)),
      );

      lines.push("");
      lines.push("Continue from:");
      lines.push("1. Audit actual state first (list_assemblies + list_positions on target assemblies).");
      lines.push("2. Audit journals next (list_journal_entries for journal=changes and journal=table).");
      lines.push("3. Apply only missing operations; do not duplicate already-added items.");
      lines.push("4. Keep IDs and existing rows stable unless explicitly required by the task.");
      lines.push("5. Report done/not-done with reasons and no ambiguity.");

      lines.push("");
      lines.push("Do not touch:");
      lines.push("1. Already added positions identified in the Added list.");
      lines.push("2. Existing assemblies and rows unrelated to the user's task.");
      lines.push("3. Previously successful operations unless verification proves mismatch.");

      const raw = lines.join("\n");
      if (raw.length <= checkpointTextCharLimit) return raw;
      const tail = forHandoff
        ? "\n\n[Checkpoint truncated to fit context window]\n"
        : "\n\n[Report truncated]\n";
      return `${raw.slice(0, Math.max(0, checkpointTextCharLimit - tail.length))}${tail}`;
    };

    const buildHandoffPrompt = (snapshot) => {
      const checkpointText = buildCheckpointText(snapshot, true);
      return [
        "CLEAN_CONTEXT_HANDOFF v1",
        "You are continuing a long-running task after context reset.",
        "Critical rule: NO REGRESSION. Preserve already-applied successful changes.",
        "Audit first, then continue.",
        "Required first actions:",
        "1. list_assemblies",
        "2. list_positions for relevant assemblies",
        "3. list_journal_entries (journal=changes, then journal=table)",
        "4. if needed: read_settings / get_state",
        "",
        "After audit, perform ONLY missing steps.",
        "Never re-add rows that already exist.",
        "Never delete unrelated rows.",
        "",
        "Original user task:",
        userText || "(empty)",
        "",
        "Checkpoint report from previous executor:",
        checkpointText,
        "",
        "Finish with a precise completion report: checklist, added/updated/deleted, remaining steps if any.",
      ].join("\n");
    };

    const maybeRunCleanContextHandoff = async (trigger, response = null, reason = "") => {
      if (!cleanHandoffEnabled) return "";
      if (maxCleanHandoffs <= 0) return "";
      if (handoffDepth >= maxCleanHandoffs) return "";
      throwIfCanceled();

      const snapshot = buildCheckpointSnapshot(trigger, response, reason);
      const prompt = buildHandoffPrompt(snapshot);
      const nextDepth = handoffDepth + 1;
      addExternalJournal("agent.handoff.start", `clean context handoff (${trigger})`, {
        turn_id: turnId,
        request_id: String(response?.__request_id || app.ai.currentRequestId || ""),
        response_id: String(response?.id || app.ai.streamResponseId || ""),
        level: "warning",
        status: "running",
        meta: {
          trigger,
          reason: snapshot.reason || "",
          handoff_depth: handoffDepth,
          next_handoff_depth: nextDepth,
          max_handoffs: maxCleanHandoffs,
          completed: snapshot.completed_checklist.length,
          added: snapshot.added.length,
          updated: snapshot.updated.length,
          deleted: snapshot.deleted.length,
        },
      });

      try {
        const handoffText = await runOpenAiAgentTurn(prompt, userText, {
          ...options,
          previousResponseId: "",
          previousToolOutputs: [],
          handoffDepth: nextDepth,
        });
        addExternalJournal("agent.handoff.complete", `handoff completed (${trigger})`, {
          turn_id: turnId,
          level: "info",
          status: "completed",
          meta: {
            trigger,
            handoff_depth: nextDepth,
          },
        });
        return handoffText;
      } catch (err) {
        addExternalJournal("agent.handoff.error", String(err?.message || err), {
          turn_id: turnId,
          level: "warning",
          status: "error",
          meta: {
            trigger,
            handoff_depth: nextDepth,
          },
        });
        return "";
      }
    };

    const buildUnfinishedReport = (trigger, response = null, reason = "") => {
      const snapshot = buildCheckpointSnapshot(trigger, response, reason);
      const report = [
        "Task is not fully completed yet.",
        buildCheckpointText(snapshot, false),
      ].join("\n\n");
      return sanitizeAgentOutputText(report);
    };
    const handleStallGuard = async (trigger, response = null, reason = "", extraMeta = {}) => {
      const signatureDiversity = noProgressSignatureDiversity();
      addExternalJournal("agent.stall_guard.triggered", "stall guard forced loop break", {
        turn_id: turnId,
        request_id: String(response?.__request_id || app.ai.currentRequestId || ""),
        response_id: String(response?.id || ""),
        status: "running",
        level: "warning",
        meta: {
          trigger,
          reason: truncate(reason, 240),
          no_call_continuation_streak: stallState.noCallContinuationStreak,
          no_progress_rounds: stallState.noProgressRounds,
          repeated_signature_rounds: stallState.repeatedSignatureRounds,
          signature_diversity: signatureDiversity,
          recent_signatures: stallState.recentNoProgressSignatures.slice(-6),
          execution_limits_mode: limitMode,
          max_forced_retries: maxForcedRetriesLabel,
          max_tool_rounds: maxToolRoundsLabel,
          ...extraMeta,
        },
      });
      const handoffText = await maybeRunCleanContextHandoff(trigger, response, reason);
      if (handoffText) return sanitizeAgentOutputText(handoffText);
      return buildUnfinishedReport(trigger, response, reason);
    };

    if (!toolsDisabled) {
      throwIfCanceled();
      try {
        await prepareToolResources({ turnId });
        throwIfCanceled();
      } catch (err) {
        if (err?.no_fallback) throw err;
        const hasAttachments = Array.isArray(app?.ai?.attachments) && app.ai.attachments.length > 0;
        addExternalJournal("file_search.sync.error", String(err?.message || err), {
          turn_id: turnId,
          level: "warning",
          status: "error",
          meta: { attachments: hasAttachments ? app.ai.attachments.length : 0 },
        });
        if (hasAttachments) throw err;
      }
    }

    const initialPreviousResponseId = String(options?.previousResponseId || "").trim();
    const previousToolOutputsRaw = Array.isArray(options?.previousToolOutputs)
      ? options.previousToolOutputs
      : [];
    const previousToolOutputs = previousToolOutputsRaw
      .filter((item) => item && typeof item === "object")
      .map((item) => ({
        type: String(item.type || ""),
        call_id: String(item.call_id || ""),
        output: String(item.output || ""),
      }))
      .filter((item) => item.type === "function_call_output" && item.call_id && item.output);
    throwIfCanceled();
    const buildInitialPayload = (previousResponseId = "") => {
      const initialInput = previousResponseId && previousToolOutputs.length
        ? [...previousToolOutputs, ...userMessageInput]
        : userMessageInput;
      return buildAgentResponsesPayload({
        model: modelId,
        instructions: agentSystemPrompt(),
        previousResponseId,
        input: initialInput,
        turnId,
        taskText: userText,
        allowBackground: true,
      });
    };
    let response = null;
    try {
      response = await callOpenAiResponses(buildInitialPayload(initialPreviousResponseId), { ...requestCallOptions });
    } catch (err) {
      const previousResponseRejected = Boolean(initialPreviousResponseId) && isPreviousResponseError(err);
      const contextOverflow = isContextOverflowError(err);
      if (previousResponseRejected || (Boolean(initialPreviousResponseId) && contextOverflow)) {
        const reasonText = String(err?.message || err || "").slice(0, 220);
        addExternalJournal("conversation_state.fallback", "previous_response_id rejected, fallback to fresh turn", {
          turn_id: turnId,
          level: "warning",
          status: "error",
          meta: {
            previous_response_id: initialPreviousResponseId,
            reason: reasonText,
            context_overflow: contextOverflow,
          },
        });
        try {
          response = await callOpenAiResponses(buildInitialPayload(""), { ...requestCallOptions });
        } catch (err2) {
          if (!isContextOverflowError(err2)) throw err2;
          const overflowReason = `context window overflow during initial fallback: ${String(err2?.message || err2 || "").slice(0, 220)}`;
          addExternalJournal("agent.context_overflow", overflowReason, {
            turn_id: turnId,
            level: "warning",
            status: "error",
            meta: {
              phase: "initial_fallback",
            },
          });
          const handoffText = await maybeRunCleanContextHandoff("context_overflow_initial", null, overflowReason);
          if (handoffText) return sanitizeAgentOutputText(handoffText);
          throw err2;
        }
      } else if (contextOverflow) {
        const overflowReason = `context window overflow on initial request: ${String(err?.message || err || "").slice(0, 220)}`;
        addExternalJournal("agent.context_overflow", overflowReason, {
          turn_id: turnId,
          level: "warning",
          status: "error",
          meta: {
            phase: "initial",
          },
        });
        const handoffText = await maybeRunCleanContextHandoff("context_overflow_initial", null, overflowReason);
        if (handoffText) return sanitizeAgentOutputText(handoffText);
        throw err;
      } else {
        throw err;
      }
    }
    app.ai.streamResponseId = String(response?.id || "");
    rememberResponseUsage(response);
    updateAgentTurnWebEvidence(turnCtx, response);

    for (let i = 0; i < maxToolRounds; i += 1) {
      throwIfCanceled();
      roundsUsed = i + 1;
      const calls = extractAgentFunctionCalls(response);
      if (!calls.length) {
        const compactInfo = await maybeAutoCompactResponse(response, { turnId });
        if (compactInfo?.responseId && compactInfo.responseId !== String(response?.id || "")) {
          response = { ...(response || {}), id: compactInfo.responseId };
        }
        const text = extractAgentText(response);
        const builtInToolUsed = hasBuiltInToolUsage(response);
        if (builtInToolUsed) toolStats.builtInToolCalls += 1;
        const computerUseCalled = hasComputerUseCall(response);
        const responseIncomplete = isResponseIncomplete(response);
        const policyContinuationNeeded = shouldForceAgentContinuation(intentToUseTools, intentToMutate, expectedMutations, toolStats, text);
        const completionGuard = evaluateCompletionGuard(preflight, toolStats, progress, {
          builtInToolCalls: toolStats.builtInToolCalls,
        });
        let continuationNeeded = responseIncomplete || policyContinuationNeeded || completionGuard.triggered;
        let continuationReason = "";
        if (responseIncomplete) continuationReason = "response status is incomplete";
        else if (completionGuard.triggered) continuationReason = completionGuard.reason;
        else if (policyContinuationNeeded) continuationReason = buildAgentRetryReason(expectedMutations, toolStats, text);

        if (continuationNeeded && stallGuardEnabled) {
          stallState.noCallContinuationStreak += 1;
          if (stallState.noCallContinuationStreak > stallNoCallContinuationLimit) {
            const reason = continuationReason
              ? `no tool calls after ${stallState.noCallContinuationStreak} continuation attempts (${continuationReason})`
              : `no tool calls after ${stallState.noCallContinuationStreak} continuation attempts`;
            return handleStallGuard("stall_guard_no_call_loop", response, reason, {
              continuation_reason: continuationReason || "",
              response_incomplete: responseIncomplete,
            });
          }
        } else {
          stallState.noCallContinuationStreak = 0;
        }

        if (completionGuard.triggered) {
          addExternalJournal("agent.completion_guard.triggered", "completion guard forced continuation", {
            turn_id: turnId,
            request_id: String(response?.__request_id || app.ai.currentRequestId || ""),
            response_id: String(response?.id || ""),
            status: "running",
            level: "warning",
            meta: {
              reason: completionGuard.reason,
              details: compactForTool(completionGuard.details || {}),
              min_tool_calls: preflight.minToolCalls,
              total_tool_calls: toolStats.totalToolCalls,
              built_in_tool_calls: toolStats.builtInToolCalls,
              retries: toolStats.forcedRetries,
            },
          });
        }

        if (!text && computerUseCalled) {
          addExternalJournal("agent.computer_use.unsupported", "computer_use_preview requires browser executor", {
            turn_id: turnId,
            request_id: String(response?.__request_id || app.ai.currentRequestId || ""),
            response_id: String(response?.id || ""),
            level: "warning",
            status: "error",
          });
          return "computer_use_preview is unavailable in this client without browser executor. Use web_search.";
        }

        if (continuationNeeded && toolStats.forcedRetries < maxForcedRetries) {
          const reason = continuationReason || "task is not completed";
          toolStats.forcedRetries += 1;
          addTableJournal("agent.retry", `Auto retry: ${reason}`, {
            turn_id: turnId,
            status: "running",
            meta: {
              reason,
              phase: "forced_tool_followup",
              retries: toolStats.forcedRetries,
              expected_mutations: expectedMutations,
              successful_mutations: toolStats.successfulMutations,
              response_incomplete: responseIncomplete,
            },
          });
          const compactInfo = await maybeAutoCompactResponse(response, { turnId });
          if (compactInfo?.responseId && compactInfo.responseId !== String(response?.id || "")) {
            response = { ...(response || {}), id: compactInfo.responseId };
          }
          try {
            response = await callOpenAiResponses(buildAgentResponsesPayload({
              model: modelId,
              previousResponseId: response.id,
              input: [{
                role: "user",
                content: [{
                  type: "input_text",
                  text: buildAgentContinuationInstruction(reason, true),
                }],
              }],
              turnId,
              taskText: userText,
              allowBackground: false,
            }), { ...requestCallOptions });
          } catch (err) {
            const previousResponseRejected = isPreviousResponseError(err);
            const contextOverflow = isContextOverflowError(err);
            if (!previousResponseRejected && !contextOverflow) throw err;
            const fallbackReason = previousResponseRejected
              ? `previous_response_id rejected during forced continuation: ${String(err?.message || err || "").slice(0, 220)}`
              : `context window overflow during forced continuation: ${String(err?.message || err || "").slice(0, 220)}`;
            const eventName = previousResponseRejected ? "conversation_state.fallback" : "agent.context_overflow";
            const eventMessage = previousResponseRejected
              ? "previous_response_id rejected during forced continuation"
              : "context overflow during forced continuation";
            addExternalJournal(eventName, eventMessage, {
              turn_id: turnId,
              level: "warning",
              status: "error",
              meta: {
                previous_response_id: String(response?.id || ""),
                reason: fallbackReason,
                phase: "forced_continuation",
              },
            });
            const handoffTrigger = previousResponseRejected ? "previous_response_rejected" : "context_overflow_forced_continuation";
            const handoffText = await maybeRunCleanContextHandoff(handoffTrigger, response, fallbackReason);
            if (handoffText) return sanitizeAgentOutputText(handoffText);
            throw err;
          }
          throwIfCanceled();
          app.ai.streamResponseId = String(response?.id || app.ai.streamResponseId || "");
          rememberResponseUsage(response);
          updateAgentTurnWebEvidence(turnCtx, response);
          continue;
        }

        if (continuationNeeded) {
          const reason = responseIncomplete
            ? "response remained incomplete after forced retries"
            : continuationReason
              ? `continuation criteria still not satisfied after forced retries (${continuationReason})`
              : "continuation criteria still not satisfied after forced retries";
          const handoffText = await maybeRunCleanContextHandoff("continuation_exhausted", response, reason);
          if (handoffText) return sanitizeAgentOutputText(handoffText);
        }

        if (toolStats.mutationCalls > 0 && toolStats.successfulMutations === 0) {
          const reason = toolStats.failedMutations.slice(-2).join("; ") || "mutation tool did not apply changes";
          return buildUnfinishedReport("no_successful_mutations", response, reason);
        }
        if (intentToMutate && toolStats.mutationCalls === 0) {
          return buildUnfinishedReport("no_mutation_calls", response, "model did not call mutation tools");
        }
        if (intentToUseTools && toolStats.totalToolCalls === 0 && toolStats.builtInToolCalls === 0) {
          return buildUnfinishedReport("no_tool_calls", response, "model did not call tools");
        }
        if (intentToMutate && isAgentTextIncomplete(text)) {
          const handoffText = await maybeRunCleanContextHandoff("final_text_incomplete", response, "final answer is incomplete while mutation task is expected");
          if (handoffText) return sanitizeAgentOutputText(handoffText);
          if (toolStats.successfulMutations > 0) {
            return `Done. Applied mutations: ${toolStats.successfulMutations}.`;
          }
          const reason = toolStats.failedMutations.slice(-2).join("; ") || "task is not completed";
          return buildUnfinishedReport("mutation_task_incomplete_text", response, reason);
        }

        const finalText = text || (toolStats.successfulMutations > 0 ? "Done, changes were applied." : "Done.");
        return sanitizeAgentOutputText(finalText);
      }

      const outputs = [];
      stallState.noCallContinuationStreak = 0;
      const roundProgressBefore = captureProgressMarker();
      const roundSignatures = [];
      let pauseForUser = null;
      let skippedAfterPause = 0;
      for (const call of calls) {
        throwIfCanceled();
        if (pauseForUser) {
          skippedAfterPause += 1;
          continue;
        }
        toolStats.totalToolCalls += 1;
        const args = parseJsonSafe(call.arguments, {});
        const summarizedArgs = summarizeToolArgs(args);
        roundSignatures.push(buildToolCallSignature(call.name, summarizedArgs));
        const callText = `${call.name} <= ${compactToolIoText(summarizedArgs)}`;
        addExternalJournal("tool.call", callText, {
          turn_id: turnId,
          request_id: String(response?.__request_id || app.ai.currentRequestId || ""),
          response_id: String(response?.id || ""),
          status: "running",
          meta: {
            tool: call.name,
            call_id: call.call_id || "",
            input: compactForTool(args),
          },
        });
        addTableJournal("tool.call", callText, {
          turn_id: turnId,
          request_id: String(response?.__request_id || app.ai.currentRequestId || ""),
          response_id: String(response?.id || ""),
          status: "running",
          meta: {
            tool: call.name,
            call_id: call.call_id || "",
            input: summarizedArgs,
          },
        });
        let result = normalizeToolResult(call.name, await executeAgentTool(call.name, args, turnCtx));
        throwIfCanceled();
        if (result?.awaiting_user_input && String(call?.name || "") === "ask_user_question" && !canAskUserQuestions()) {
          const reason = "ask_user_question skipped by runtime policy (clarifications disabled)";
          addExternalJournal("tool.awaiting_user_input.ignored", reason, {
            turn_id: turnId,
            request_id: String(response?.__request_id || app.ai.currentRequestId || ""),
            response_id: String(response?.id || ""),
            status: "running",
            level: "warning",
            meta: {
              tool: call.name,
              call_id: call.call_id || "",
            },
          });
          result = {
            ...result,
            ok: false,
            applied: 0,
            awaiting_user_input: false,
            error: reason,
          };
        }
        const resultSummary = summarizeToolOutput(result);
        recordToolProgress(call.name, args, result);
        const resultText = `${call.name}: ${result.ok ? "ok" : "error"} => ${compactToolIoText(resultSummary)}`;
        addExternalJournal("tool.result", resultText, {
          turn_id: turnId,
          request_id: String(response?.__request_id || app.ai.currentRequestId || ""),
          response_id: String(response?.id || ""),
          status: result.ok ? "completed" : "error",
          level: result.ok ? "info" : "error",
          meta: {
            tool: call.name,
            call_id: call.call_id || "",
            output: compactForTool(result),
          },
        });
        addTableJournal("tool.result", resultText, {
          turn_id: turnId,
          request_id: String(response?.__request_id || app.ai.currentRequestId || ""),
          response_id: String(response?.id || ""),
          status: result.ok ? "completed" : "error",
          level: result.ok ? "info" : "error",
          meta: {
            tool: call.name,
            call_id: call.call_id || "",
            output: resultSummary,
          },
        });
        if (isMutationToolName(call.name)) {
          toolStats.mutationCalls += 1;
          const isOk = Boolean(result?.ok);
          const applied = Math.max(0, Number(result?.applied || (isOk ? 1 : 0)));
          if (applied > 0) {
            toolStats.successfulMutations += applied;
            app.ai.lastSuccessfulMutationTs = Date.now();
          } else {
            const errText = String(result?.error || "mutation not applied").replace(/\s+/g, " ").trim().slice(0, 160);
            toolStats.failedMutations.push(`${call.name}: ${errText}`);
          }
        }
        outputs.push({
          type: "function_call_output",
          call_id: call.call_id,
          output: JSON.stringify(result),
        });

        if (result?.awaiting_user_input) {
          pauseForUser = result;
        }
      }

      if (pauseForUser) {
        const pending = app?.ai?.pendingQuestion;
        if (pending && typeof pending === "object") {
          pending.response_id = String(response?.id || pending.response_id || "");
          pending.request_id = String(response?.__request_id || app.ai.currentRequestId || pending.request_id || "");
          pending.tool_outputs = outputs.slice();
        }
        if (skippedAfterPause > 0) {
          addTableJournal("agent.pause", `Paused: waiting for user input (skipped calls: ${skippedAfterPause})`, {
            turn_id: turnId,
            status: "running",
            meta: { skipped_calls: skippedAfterPause },
          });
        }
        const waitMsg = String(pauseForUser?.message || "Need clarification from the user. Reply in the question block.");
        return sanitizeAgentOutputText(waitMsg);
      }

      if (stallGuardEnabled) {
        const roundProgressAfter = captureProgressMarker();
        const roundHasProgress = hasProgressDelta(roundProgressBefore, roundProgressAfter);
        const roundSignature = truncate(roundSignatures.join(" || "), 1200);
        if (roundHasProgress) {
          resetNoProgressStreak();
          stallState.lastRoundSignature = roundSignature;
        } else {
          stallState.noProgressRounds += 1;
          if (roundSignature && roundSignature === stallState.lastRoundSignature) {
            stallState.repeatedSignatureRounds += 1;
          } else {
            stallState.repeatedSignatureRounds = 1;
          }
          if (roundSignature) stallState.lastRoundSignature = roundSignature;
          pushNoProgressSignature(roundSignature || "<empty>");
          const signatureDiversity = noProgressSignatureDiversity();
          const repeatedLoop = stallState.repeatedSignatureRounds >= stallRepeatedSignatureRoundLimit;
          const stagnationLoop = stallState.noProgressRounds >= stallNoProgressRoundLimit && signatureDiversity <= 2;
          const broadStagnationLimit = Math.min(
            stallAbsoluteNoProgressRoundLimit,
            Math.max(
              stallNoProgressRoundLimit + 2,
              stallNoProgressRoundLimit * (intentToMutate ? 2 : (forceNoLimitsActive ? 3 : 2)),
            ),
          );
          const broadStagnationLoop = stallState.noProgressRounds >= broadStagnationLimit;
          const absoluteStall = stallState.noProgressRounds >= stallAbsoluteNoProgressRoundLimit;
          if (repeatedLoop || stagnationLoop || broadStagnationLoop || absoluteStall) {
            const reason = repeatedLoop
              ? `repeated no-progress tool pattern for ${stallState.repeatedSignatureRounds} rounds`
              : broadStagnationLoop
                ? `no progress for ${stallState.noProgressRounds} rounds (adaptive stall limit ${broadStagnationLimit})`
              : absoluteStall
                ? `no progress for ${stallState.noProgressRounds} rounds`
                : `no progress for ${stallState.noProgressRounds} rounds with low tool-pattern diversity (${signatureDiversity})`;
            return handleStallGuard("stall_guard_no_progress_tool_loop", response, reason, {
              repeated_loop: repeatedLoop,
              stagnation_loop: stagnationLoop,
              broad_stagnation_loop: broadStagnationLoop,
              broad_stagnation_limit: broadStagnationLimit,
              absolute_stall: absoluteStall,
              round_signature: roundSignature,
              signature_diversity: signatureDiversity,
            });
          }
        }
      }

      throwIfCanceled();
      const compactInfo = await maybeAutoCompactResponse(response, {
        turnId,
        pendingToolOutputsCount: outputs.length,
      });
      if (compactInfo?.responseId && compactInfo.responseId !== String(response?.id || "")) {
        response = { ...(response || {}), id: compactInfo.responseId };
      }
      try {
        response = await callOpenAiResponses(buildAgentResponsesPayload({
          model: modelId,
          previousResponseId: response.id,
          // Per OpenAI docs, reasoning context should be preserved either by:
          // 1) previous_response_id, or 2) manual replay of prior output items in input.
          // This path uses previous_response_id, so we only send fresh function_call_output.
          // Re-sending prior reasoning items here can trigger duplicate item-id errors.
          input: outputs,
          turnId,
          taskText: userText,
          allowBackground: false,
        }), { ...requestCallOptions });
      } catch (err) {
        const previousResponseRejected = isPreviousResponseError(err);
        const contextOverflow = isContextOverflowError(err);
        if (!previousResponseRejected && !contextOverflow) throw err;
        const fallbackReason = previousResponseRejected
          ? `previous_response_id rejected during tool continuation: ${String(err?.message || err || "").slice(0, 220)}`
          : `context window overflow during tool continuation: ${String(err?.message || err || "").slice(0, 220)}`;
        const eventName = previousResponseRejected ? "conversation_state.fallback" : "agent.context_overflow";
        const eventMessage = previousResponseRejected
          ? "previous_response_id rejected during tool continuation"
          : "context overflow during tool continuation";
        addExternalJournal(eventName, eventMessage, {
          turn_id: turnId,
          level: "warning",
          status: "error",
          meta: {
            previous_response_id: String(response?.id || ""),
            reason: fallbackReason,
            phase: "tool_continuation",
          },
        });
        const handoffTrigger = previousResponseRejected ? "previous_response_rejected" : "context_overflow_tool_continuation";
        const handoffText = await maybeRunCleanContextHandoff(handoffTrigger, response, fallbackReason);
        if (handoffText) return sanitizeAgentOutputText(handoffText);
        throw err;
      }
      throwIfCanceled();
      app.ai.streamResponseId = String(response?.id || app.ai.streamResponseId || "");
      rememberResponseUsage(response);
      updateAgentTurnWebEvidence(turnCtx, response);
    }

    addExternalJournal("agent.error", "tool loop limit reached", {
      turn_id: turnId,
      level: "error",
      status: "error",
      duration_ms: Date.now() - startedAt,
      meta: {
        expected_mutations: expectedMutations,
        successful_mutations: toolStats.successfulMutations,
        retries: toolStats.forcedRetries,
        execution_limits_mode: limitMode,
        max_forced_retries: maxForcedRetriesLabel,
        max_tool_rounds: maxToolRoundsLabel,
        rounds_used: roundsUsed,
        built_in_tool_calls: toolStats.builtInToolCalls,
        force_no_limits: preflight.forceNoLimits,
        force_no_limits_applied: forceNoLimitsActive,
      },
    });
    const handoffText = await maybeRunCleanContextHandoff("tool_loop_limit", response, "tool loop limit reached");
    if (handoffText) return sanitizeAgentOutputText(handoffText);
    return buildUnfinishedReport("tool_loop_limit", response, "tool loop limit reached");
  }

  return { runOpenAiAgentTurn };
}
