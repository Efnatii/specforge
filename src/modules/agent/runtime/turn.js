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

  function analyzeTaskPreflight(userTextRaw, runtimeProfile, options = {}) {
    const text = String(userTextRaw || "").trim();
    const selectedProfile = String(runtimeProfile?.selected || "").trim().toLowerCase();
    const toolsMode = normalizeToolsMode(options?.toolsMode, "auto");
    const toolsDisabled = toolsMode === "none";
    const attachmentsCount = normalizeNonNegativeInt(options?.attachmentsCount, 0, 0, 2000000);
    const actionable = options?.actionable === true;
    const analysisIntent = AI_ANALYSIS_INTENT_RE.test(text);
    const workspaceScope = /(source code|repository|repo|codebase|module|file|files|project|attachment|attachments|репозитор|код|проект|модул|файл|вложен)/i.test(text)
      || attachmentsCount > 0;
    const explicitDeepCue = /(totally|total|fully|full|end[-\s]?to[-\s]?end|max(?:imum)?|unlimited|deep(?:\s+dive)?|до\s+конца|тоталь|максимум|полност|не\s+ограничивай|глубок\w+\s+разбор)/i.test(text);
    const deepProfiles = new Set(["source_audit", "research", "longrun", "spec_strict", "proposal", "bulk"]);
    const strictToolsProfiles = new Set(["source_audit", "research", "price_search", "spec_strict"]);
    const strictVerifyProfiles = new Set(["source_audit", "research", "spec_strict"]);

    const wantsDeepCompletion = deepProfiles.has(selectedProfile) || explicitDeepCue;
    const intentToMutate = !toolsDisabled && AI_MUTATION_INTENT_RE.test(text);
    const expectedMutationsHint = estimateExpectedMutationCount(text, intentToMutate);
    const intentToUseTools = !toolsDisabled && (actionable || analysisIntent || workspaceScope);

    let minToolCalls = 0;
    if (!toolsDisabled) {
      if (intentToMutate) minToolCalls = Math.max(minToolCalls, 1);
      if (intentToUseTools) {
        if (selectedProfile === "source_audit" || selectedProfile === "research" || selectedProfile === "longrun") {
          minToolCalls = Math.max(minToolCalls, 2);
        } else if (wantsDeepCompletion || analysisIntent || workspaceScope) {
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
    };

    if (!toolsDisabled && wantsDeepCompletion && strictToolsProfiles.has(selectedProfile) && (toolsMode === "auto" || toolsMode === "prefer")) {
      out.overrideToolsMode = "require";
    }
    const verifyMode = normalizeReasoningVerify(options?.reasoningVerify, "basic");
    if (wantsDeepCompletion && strictVerifyProfiles.has(selectedProfile) && verifyMode !== "strict") {
      out.overrideVerify = "strict";
    }
    return out;
  }

  function evaluateCompletionGuard(preflight, toolStats, progress, options = {}) {
    if (!preflight || typeof preflight !== "object") return { triggered: false, reason: "" };
    const guardEnabled = Boolean(preflight.wantsDeepCompletion || preflight.intentToUseTools || preflight.intentToMutate);
    if (!guardEnabled) return { triggered: false, reason: "" };

    const builtInToolUsed = options?.builtInToolUsed === true;
    const minToolCalls = Math.max(0, num(preflight.minToolCalls, 0));
    const effectiveToolCalls = Math.max(0, num(toolStats?.totalToolCalls, 0)) + (builtInToolUsed ? 1 : 0);
    if (minToolCalls > 0 && effectiveToolCalls < minToolCalls) {
      return {
        triggered: true,
        reason: "completion_guard:min_tools_not_met",
        details: {
          min_tool_calls: minToolCalls,
          effective_tool_calls: effectiveToolCalls,
          built_in_tool_used: builtInToolUsed,
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

  async function maybeAutoCompactResponse(response, options = {}) {
    const responseId = String(response?.id || "").trim();
    if (!responseId) return { compacted: false, responseId: "" };
    if (String(app.ai.lastCompactedResponseId || "") === responseId) return { compacted: false, responseId };
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
    const minIntervalMs = mode === "on" ? 5000 : 45000;
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
    const handoffDepth = normalizeNonNegativeInt(options?.handoffDepth, 0, 0, 8);
    const cleanHandoffEnabled = getRuntimeAwareOption("cleanContextHandoff", true) !== false;
    const maxCleanHandoffs = normalizeNonNegativeInt(getRuntimeAwareOption("cleanContextHandoffMax", 1), 1, 0, 8);
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
    const attachmentsCount = Array.isArray(app?.ai?.attachments) ? app.ai.attachments.length : 0;
    const actionablePrompt = isActionableAgentPrompt(userText);
    const preflightDraft = analyzeTaskPreflight(userText, app.ai.runtimeProfile, {
      toolsMode: baseToolsMode,
      attachmentsCount,
      actionable: actionablePrompt,
      reasoningVerify: baseVerifyMode,
    });
    let appliedToolsModeOverride = "";
    let appliedVerifyOverride = "";
    if (app?.ai?.runtimeProfile && typeof app.ai.runtimeProfile === "object") {
      if (!app.ai.runtimeProfile.overrides || typeof app.ai.runtimeProfile.overrides !== "object") {
        app.ai.runtimeProfile.overrides = {};
      }
      if (
        preflightDraft.overrideToolsMode
        && baseToolsMode !== "none"
        && (baseToolsMode === "auto" || baseToolsMode === "prefer")
      ) {
        app.ai.runtimeProfile.overrides.toolsMode = preflightDraft.overrideToolsMode;
        appliedToolsModeOverride = preflightDraft.overrideToolsMode;
      }
      if (preflightDraft.overrideVerify === "strict" && baseVerifyMode !== "strict") {
        app.ai.runtimeProfile.overrides.reasoningVerify = "strict";
        appliedVerifyOverride = "strict";
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
    });
    const toolsDisabled = toolsMode === "none";
    const intentToUseTools = preflight.intentToUseTools;
    const intentToMutate = preflight.intentToMutate;
    const expectedMutations = preflight.expectedMutationsHint;
    addExternalJournal("agent.preflight", "task preflight analyzed", {
      turn_id: turnId,
      status: "completed",
      meta: {
        selected_profile: preflight.selectedProfile || "",
        tools_mode: preflight.toolsMode,
        wants_deep_completion: preflight.wantsDeepCompletion,
        actionable_prompt: preflight.actionable,
        analysis_intent: preflight.analysisIntent,
        workspace_scope: preflight.workspaceScope,
        intent_to_use_tools: preflight.intentToUseTools,
        intent_to_mutate: preflight.intentToMutate,
        min_tool_calls: preflight.minToolCalls,
        expected_mutations_hint: preflight.expectedMutationsHint,
        attachments_count: attachmentsCount,
        overrides_applied: compactForTool({
          toolsMode: appliedToolsModeOverride || "",
          reasoningVerify: appliedVerifyOverride || "",
        }),
      },
    });
    const toolStats = {
      totalToolCalls: 0,
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

    const identifyToolTarget = (callName, args, result) => {
      const article = truncate(args?.article || "", 96);
      const name = truncate(args?.name || "", 120);
      const assembly = truncate(args?.assembly_name || args?.full_name || "", 120);
      const positionId = truncate(args?.position_id || "", 80);
      const assemblyId = truncate(args?.assembly_id || result?.entity?.id || "", 80);
      if (article) return article;
      if (name) return name;
      if (positionId) return `position:${positionId}`;
      if (assemblyId && assembly) return `${assembly} (${assemblyId})`;
      if (assembly) return assembly;
      return callName;
    };

    const recordToolProgress = (callName, args, result) => {
      const target = identifyToolTarget(callName, args, result);
      const applied = Math.max(0, Number(result?.applied || 0));
      const ok = Boolean(result?.ok);

      if (ok && applied > 0) {
        pushUniqueLimited(progress.completedChecklist, `${callName}: ${target}`, 240);
      } else if (!ok) {
        const err = truncate(result?.error || result?.message || "tool error", 180);
        pushUniqueLimited(progress.failedTools, `${callName}: ${target}${err ? ` (${err})` : ""}`, 120);
      }

      if (!ok || applied <= 0) return;

      if (
        callName === "add_position"
        || callName === "add_project_position"
        || callName === "duplicate_position"
      ) {
        pushUniqueLimited(progress.added, `${target} via ${callName}`, 200);
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
        pushUniqueLimited(progress.updated, `${target} via ${callName}`, 200);
        return;
      }
      if (
        callName === "delete_position"
        || callName === "delete_project_position"
        || callName === "clear_range"
        || callName === "clear_sheet_overrides"
      ) {
        pushUniqueLimited(progress.deleted, `${target} via ${callName}`, 200);
        return;
      }
      if (
        callName === "create_assembly"
        || callName === "update_assembly"
        || callName === "duplicate_assembly"
        || callName === "delete_assembly"
        || callName === "bulk_delete_assemblies"
      ) {
        pushUniqueLimited(progress.assemblyChanges, `${target} via ${callName}`, 120);
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
        max_rounds: AGENT_MAX_TOOL_ROUNDS,
        forced_retries: toolStats.forcedRetries,
        max_forced_retries: AGENT_MAX_FORCED_RETRIES,
        expected_mutations: expectedMutations,
        successful_mutations: toolStats.successfulMutations,
        total_tool_calls: toolStats.totalToolCalls,
        usage: {
          input_tokens: usage.inputTokens || 0,
          output_tokens: usage.outputTokens || 0,
          total_tokens: usage.totalTokens || 0,
        },
        web_evidence: {
          used: Boolean(turnCtx.webSearchUsed),
          queries: Array.isArray(turnCtx.webSearchQueries) ? turnCtx.webSearchQueries.slice(-20) : [],
          urls: Array.isArray(turnCtx.webSearchUrls) ? turnCtx.webSearchUrls.slice(-40) : [],
        },
        completed_checklist: progress.completedChecklist.slice(0, 120),
        added: progress.added.slice(0, 120),
        updated: progress.updated.slice(0, 120),
        deleted: progress.deleted.slice(0, 120),
        assembly_changes: progress.assemblyChanges.slice(0, 80),
        failed_tools: progress.failedTools.slice(-40),
        mutation_failures: toolStats.failedMutations.slice(-20),
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
      appendFlat("Failures", [...snapshot.failed_tools, ...snapshot.mutation_failures].slice(0, 80));

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
      if (raw.length <= 24000) return raw;
      const tail = forHandoff
        ? "\n\n[Checkpoint truncated to fit context window]\n"
        : "\n\n[Report truncated]\n";
      return `${raw.slice(0, Math.max(0, 24000 - tail.length))}${tail}`;
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
      response = await callOpenAiResponses(buildInitialPayload(initialPreviousResponseId), {
        turnId,
        onDelta: options?.onStreamDelta,
        onEvent: options?.onStreamEvent,
      });
    } catch (err) {
      if (!initialPreviousResponseId || !isPreviousResponseError(err)) throw err;
      addExternalJournal("conversation_state.fallback", "previous_response_id rejected, fallback to fresh turn", {
        turn_id: turnId,
        level: "warning",
        status: "error",
        meta: {
          previous_response_id: initialPreviousResponseId,
          reason: String(err?.message || err || "").slice(0, 220),
        },
      });
      response = await callOpenAiResponses(buildInitialPayload(""), {
        turnId,
        onDelta: options?.onStreamDelta,
        onEvent: options?.onStreamEvent,
      });
    }
    app.ai.streamResponseId = String(response?.id || "");
    rememberResponseUsage(response);
    updateAgentTurnWebEvidence(turnCtx, response);

    for (let i = 0; i < AGENT_MAX_TOOL_ROUNDS; i += 1) {
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
        const computerUseCalled = hasComputerUseCall(response);
        const responseIncomplete = isResponseIncomplete(response);
        const policyContinuationNeeded = shouldForceAgentContinuation(intentToUseTools, intentToMutate, expectedMutations, toolStats, text);
        const completionGuard = evaluateCompletionGuard(preflight, toolStats, progress, { builtInToolUsed });
        let continuationNeeded = responseIncomplete || policyContinuationNeeded || completionGuard.triggered;
        let continuationReason = "";
        if (responseIncomplete) continuationReason = "response status is incomplete";
        else if (completionGuard.triggered) continuationReason = completionGuard.reason;
        else if (policyContinuationNeeded) continuationReason = buildAgentRetryReason(expectedMutations, toolStats, text);

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
              built_in_tool_used: builtInToolUsed,
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
          return "computer_use_preview недоступен в этом клиенте без browser executor. Используйте web_search.";
        }

        if (continuationNeeded && toolStats.forcedRetries < AGENT_MAX_FORCED_RETRIES) {
          const reason = continuationReason || "task is not completed";
          toolStats.forcedRetries += 1;
          addTableJournal("agent.retry", `Автоповтор: ${reason}`, {
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
            }), {
              turnId,
              onDelta: options?.onStreamDelta,
              onEvent: options?.onStreamEvent,
            });
          } catch (err) {
            if (!isPreviousResponseError(err)) throw err;
            const fallbackReason = `previous_response_id rejected during forced continuation: ${String(err?.message || err || "").slice(0, 220)}`;
            addExternalJournal("conversation_state.fallback", "previous_response_id rejected during forced continuation", {
              turn_id: turnId,
              level: "warning",
              status: "error",
              meta: {
                previous_response_id: String(response?.id || ""),
                reason: fallbackReason,
              },
            });
            const handoffText = await maybeRunCleanContextHandoff("previous_response_rejected", response, fallbackReason);
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
        if (intentToUseTools && toolStats.totalToolCalls === 0 && !builtInToolUsed) {
          return buildUnfinishedReport("no_tool_calls", response, "model did not call tools");
        }
        if (intentToMutate && isAgentTextIncomplete(text)) {
          const handoffText = await maybeRunCleanContextHandoff("final_text_incomplete", response, "final answer is incomplete while mutation task is expected");
          if (handoffText) return sanitizeAgentOutputText(handoffText);
          if (toolStats.successfulMutations > 0) {
            return `Р“РѕС‚РѕРІРѕ. РР·РјРµРЅРµРЅРёСЏ РїСЂРёРјРµРЅРµРЅС‹ (${toolStats.successfulMutations}).`;
          }
          const reason = toolStats.failedMutations.slice(-2).join("; ") || "task is not completed";
          return buildUnfinishedReport("mutation_task_incomplete_text", response, reason);
        }

        const finalText = text || (toolStats.successfulMutations > 0 ? "Готово, изменения применены." : "Готово.");
        return sanitizeAgentOutputText(finalText);
      }

      const outputs = [];
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
            const errText = String(result?.error || "изменение не применено").replace(/\s+/g, " ").trim().slice(0, 160);
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
          addTableJournal("agent.pause", `Остановлено: ожидается ответ пользователя (пропущено вызовов: ${skippedAfterPause})`, {
            turn_id: turnId,
            status: "running",
            meta: { skipped_calls: skippedAfterPause },
          });
        }
        const waitMsg = String(pauseForUser?.message || "Нужно уточнение от пользователя. Ответьте в блоке вопроса.");
        return sanitizeAgentOutputText(waitMsg);
      }

      throwIfCanceled();
      const compactInfo = await maybeAutoCompactResponse(response, { turnId });
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
        }), {
          turnId,
          onDelta: options?.onStreamDelta,
          onEvent: options?.onStreamEvent,
        });
      } catch (err) {
        if (!isPreviousResponseError(err)) throw err;
        const fallbackReason = `previous_response_id rejected during tool continuation: ${String(err?.message || err || "").slice(0, 220)}`;
        addExternalJournal("conversation_state.fallback", "previous_response_id rejected during tool continuation", {
          turn_id: turnId,
          level: "warning",
          status: "error",
          meta: {
            previous_response_id: String(response?.id || ""),
            reason: fallbackReason,
          },
        });
        const handoffText = await maybeRunCleanContextHandoff("previous_response_rejected", response, fallbackReason);
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
        max_tool_rounds: AGENT_MAX_TOOL_ROUNDS,
        rounds_used: roundsUsed,
      },
    });
    const handoffText = await maybeRunCleanContextHandoff("tool_loop_limit", response, "tool loop limit reached");
    if (handoffText) return sanitizeAgentOutputText(handoffText);
    return buildUnfinishedReport("tool_loop_limit", response, "tool loop limit reached");
  }

  return { runOpenAiAgentTurn };
}
