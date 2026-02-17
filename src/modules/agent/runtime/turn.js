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

  const TOOL_IO_TEXT_LIMIT = 320;

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

  function extractReasoningItemsForInput(response) {
    const out = [];
    const src = Array.isArray(response?.output) ? response.output : [];
    for (const item of src) {
      if (String(item?.type || "") !== "reasoning") continue;
      const id = String(item?.id || "").trim();
      if (!id) continue;
      const row = { type: "reasoning", id };
      const encrypted = String(item?.encrypted_content || "").trim();
      if (encrypted) row.encrypted_content = encrypted;
      out.push(row);
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

  async function runOpenAiAgentTurn(userInput, rawUserText = "", options = {}) {
    const modelId = currentAiModelMeta().id;
    const input = [{ role: "user", content: [{ type: "input_text", text: userInput }] }];
    const userText = String(options?.rawUserText || rawUserText || "").trim();
    const turnId = String(options?.turnId || app.ai.turnId || "");
    const toolsModeRaw = String(app?.ai?.options?.toolsMode || "auto").trim().toLowerCase();
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
      try {
        await prepareToolResources({ turnId });
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

    let response = await callOpenAiResponses(buildAgentResponsesPayload({
      model: modelId,
      instructions: agentSystemPrompt(),
      input,
    }), {
      turnId,
      onDelta: options?.onStreamDelta,
      onEvent: options?.onStreamEvent,
    });
    app.ai.streamResponseId = String(response?.id || "");
    updateAgentTurnWebEvidence(turnCtx, response);

    for (let i = 0; i < AGENT_MAX_TOOL_ROUNDS; i += 1) {
      roundsUsed = i + 1;
      const calls = extractAgentFunctionCalls(response);
      if (!calls.length) {
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
          }), {
            turnId,
            onDelta: options?.onStreamDelta,
            onEvent: options?.onStreamEvent,
          });
          app.ai.streamResponseId = String(response?.id || app.ai.streamResponseId || "");
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

      response = await callOpenAiResponses(buildAgentResponsesPayload({
        model: modelId,
        previousResponseId: response.id,
        input: [...extractReasoningItemsForInput(response), ...outputs],
      }), {
        turnId,
        onDelta: options?.onStreamDelta,
        onEvent: options?.onStreamEvent,
      });
      app.ai.streamResponseId = String(response?.id || app.ai.streamResponseId || "");
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
