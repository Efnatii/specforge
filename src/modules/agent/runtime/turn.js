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

    app.ai.lastCompactedResponseId = compactedResponseId;
    app.ai.lastCompactionTs = nowTs;
    if (compactedResponseId) app.ai.lastCompletedResponseId = compactedResponseId;
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
      responseId: compactedResponseId,
    };
  }

  async function runOpenAiAgentTurn(userInput, rawUserText = "", options = {}) {
    throwIfCanceled();
    const modelId = currentAiModelMeta().id;
    const userMessageInput = [{ role: "user", content: [{ type: "input_text", text: userInput }] }];
    const userText = String(options?.rawUserText || rawUserText || "").trim();
    const turnId = String(options?.turnId || app.ai.turnId || "");
    app.ai.runtimeProfile = resolveTaskProfile(userText, app?.ai?.options?.taskProfile);
    const runtimeToolsMode = app?.ai?.runtimeProfile?.overrides?.toolsMode;
    const toolsModeRaw = String(runtimeToolsMode ?? app?.ai?.options?.toolsMode ?? "auto").trim().toLowerCase();
    const toolsMode = toolsModeRaw === "none" || toolsModeRaw === "auto" || toolsModeRaw === "prefer" || toolsModeRaw === "require"
      ? toolsModeRaw
      : "auto";
    const toolsDisabled = toolsMode === "none";
    const intentToUseTools = !toolsDisabled && isActionableAgentPrompt(userText);
    const intentToMutate = !toolsDisabled && AI_MUTATION_INTENT_RE.test(userText);
    const expectedMutations = estimateExpectedMutationCount(userText, intentToMutate);
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
    const startedAt = Date.now();
    let roundsUsed = 0;

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

        if (!toolsDisabled && shouldForceAgentContinuation(intentToUseTools, intentToMutate, expectedMutations, toolStats, text) && toolStats.forcedRetries < AGENT_MAX_FORCED_RETRIES) {
          const reason = buildAgentRetryReason(expectedMutations, toolStats, text);
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
            },
          });
          const compactInfo = await maybeAutoCompactResponse(response, { turnId });
          if (compactInfo?.responseId && compactInfo.responseId !== String(response?.id || "")) {
            response = { ...(response || {}), id: compactInfo.responseId };
          }
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
          throwIfCanceled();
          app.ai.streamResponseId = String(response?.id || app.ai.streamResponseId || "");
          rememberResponseUsage(response);
          updateAgentTurnWebEvidence(turnCtx, response);
          continue;
        }

        if (toolStats.mutationCalls > 0 && toolStats.successfulMutations === 0) {
          const reason = toolStats.failedMutations.slice(-2).join("; ") || "инструмент изменения не внес правок";
          return `Изменения не применены: ${reason}.`;
        }
        if (intentToMutate && toolStats.mutationCalls === 0) {
          return "Изменения не применены: модель не вызвала инструменты изменения.";
        }
        if (intentToUseTools && toolStats.totalToolCalls === 0 && !builtInToolUsed) {
          return "Действия не применены: модель не вызвала инструменты.";
        }
        if (intentToMutate && isAgentTextIncomplete(text)) {
          if (toolStats.successfulMutations > 0) {
            return `Готово. Изменения применены (${toolStats.successfulMutations}).`;
          }
          const reason = toolStats.failedMutations.slice(-2).join("; ") || "задача не завершена";
          return `Изменения не применены: ${reason}.`;
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
        const result = normalizeToolResult(call.name, await executeAgentTool(call.name, args, turnCtx));
        throwIfCanceled();
        const resultSummary = summarizeToolOutput(result);
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
    throw new Error("agent tool loop limit");
  }

  return { runOpenAiAgentTurn };
}
