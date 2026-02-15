export class AgentPromptModule {
  constructor({
    app,
    dom,
    windowRef,
    continuePromptRe,
    shortAckPromptRe,
    toast,
    renderAiUi,
    addAgentLog,
    addChangesJournal,
    beginAgentStreamingEntry,
    appendAgentStreamingDelta,
    addExternalJournal,
    compactForTool,
    finalizeAgentStreamingEntry,
    normalizeAgentPrompt,
    nextAgentTurnId,
    buildAgentInput,
    runOpenAiAgentTurn,
    sanitizeAgentOutputText,
  }) {
    if (!app) throw new Error("AgentPromptModule requires app");
    if (!dom) throw new Error("AgentPromptModule requires dom");
    if (!windowRef) throw new Error("AgentPromptModule requires windowRef");
    if (!(continuePromptRe instanceof RegExp)) throw new Error("AgentPromptModule requires continuePromptRe");
    if (!(shortAckPromptRe instanceof RegExp)) throw new Error("AgentPromptModule requires shortAckPromptRe");
    if (typeof toast !== "function") throw new Error("AgentPromptModule requires toast()");
    if (typeof renderAiUi !== "function") throw new Error("AgentPromptModule requires renderAiUi()");
    if (typeof addAgentLog !== "function") throw new Error("AgentPromptModule requires addAgentLog()");
    if (typeof addChangesJournal !== "function") throw new Error("AgentPromptModule requires addChangesJournal()");
    if (typeof beginAgentStreamingEntry !== "function") throw new Error("AgentPromptModule requires beginAgentStreamingEntry()");
    if (typeof appendAgentStreamingDelta !== "function") throw new Error("AgentPromptModule requires appendAgentStreamingDelta()");
    if (typeof addExternalJournal !== "function") throw new Error("AgentPromptModule requires addExternalJournal()");
    if (typeof compactForTool !== "function") throw new Error("AgentPromptModule requires compactForTool()");
    if (typeof finalizeAgentStreamingEntry !== "function") throw new Error("AgentPromptModule requires finalizeAgentStreamingEntry()");
    if (typeof normalizeAgentPrompt !== "function") throw new Error("AgentPromptModule requires normalizeAgentPrompt()");
    if (typeof nextAgentTurnId !== "function") throw new Error("AgentPromptModule requires nextAgentTurnId()");
    if (typeof buildAgentInput !== "function") throw new Error("AgentPromptModule requires buildAgentInput()");
    if (typeof runOpenAiAgentTurn !== "function") throw new Error("AgentPromptModule requires runOpenAiAgentTurn()");
    if (typeof sanitizeAgentOutputText !== "function") throw new Error("AgentPromptModule requires sanitizeAgentOutputText()");

    this._app = app;
    this._dom = dom;
    this._window = windowRef;
    this._continuePromptRe = continuePromptRe;
    this._shortAckPromptRe = shortAckPromptRe;
    this._toast = toast;
    this._renderAiUi = renderAiUi;
    this._addAgentLog = addAgentLog;
    this._addChangesJournal = addChangesJournal;
    this._beginAgentStreamingEntry = beginAgentStreamingEntry;
    this._appendAgentStreamingDelta = appendAgentStreamingDelta;
    this._addExternalJournal = addExternalJournal;
    this._compactForTool = compactForTool;
    this._finalizeAgentStreamingEntry = finalizeAgentStreamingEntry;
    this._normalizeAgentPrompt = normalizeAgentPrompt;
    this._nextAgentTurnId = nextAgentTurnId;
    this._buildAgentInput = buildAgentInput;
    this._runOpenAiAgentTurn = runOpenAiAgentTurn;
    this._sanitizeAgentOutputText = sanitizeAgentOutputText;
  }

  async sendAgentPrompt() {
    if (!this._app.ai.connected || !this._app.ai.apiKey) {
      this._toast("Сначала подключите OpenAI");
      return;
    }
    if (this._app.ai.sending) return;

    const rawText = String(this._dom.agentPrompt.value || "").trim();
    if (!rawText) {
      this._toast("Введите запрос для ИИ");
      return;
    }
    const normalized = this._normalizeAgentPrompt(rawText);
    const text = String(normalized?.text || "").trim();
    if (!text) {
      this._toast("Нет задачи для выполнения");
      return;
    }
    if (!this._continuePromptRe.test(rawText) && !this._shortAckPromptRe.test(rawText)) {
      this._app.ai.lastTaskPrompt = rawText;
    }
    if (normalized.actionable) {
      this._app.ai.lastActionablePrompt = normalized.basePrompt || rawText;
      this._app.ai.pendingTask = normalized.basePrompt || rawText;
    }
    this._app.ai.turnId = this._nextAgentTurnId();
    this._app.ai.taskState = "running";
    this._app.ai.lastStreamBuffer = "";
    this._app.ai.streamDeltaCount = 0;
    this._app.ai.streamResponseId = "";
    this._app.ai.streamEntryId = "";
    this._app.ai.streamDeltaHasPending = false;
    if (this._app.ai.streamDeltaFlushTimer) {
      this._window.clearTimeout(this._app.ai.streamDeltaFlushTimer);
      this._app.ai.streamDeltaFlushTimer = 0;
    }

    this._app.ai.sending = true;
    this._renderAiUi();
    this._addAgentLog("user", rawText, {
      turn_id: this._app.ai.turnId,
      status: "done",
      meta: {
        normalized_prompt: text,
        mode: normalized.mode,
        pending_task_used: Boolean(normalized.usedPendingTask),
      },
    });
    this._addChangesJournal("ai.prompt", `Отправлен запрос (${rawText.length} символов)`, {
      turn_id: this._app.ai.turnId,
      meta: { normalized: text.slice(0, 300) },
    });
    const streamEntryId = this._beginAgentStreamingEntry(this._app.ai.turnId);
    let streamDeltaEvents = 0;
    let streamDeltaChars = 0;
    const turnStartedAt = Date.now();

    try {
      const input = this._buildAgentInput(text);
      const out = await this._runOpenAiAgentTurn(input, text, {
        rawUserText: rawText,
        turnId: this._app.ai.turnId,
        streamEntryId,
        onStreamDelta: (delta) => this._appendAgentStreamingDelta(streamEntryId, delta),
        onStreamEvent: (eventName, eventData) => {
          const isDelta = eventName === "response.output_text.delta";
          if (isDelta) {
            streamDeltaEvents += 1;
            streamDeltaChars += String(eventData?.delta || "").length;
            if (streamDeltaEvents % 40 !== 0) return;
            this._addExternalJournal("stream.delta", `chunks=${streamDeltaEvents}, chars=${streamDeltaChars}`, {
              turn_id: this._app.ai.turnId,
              request_id: String(eventData?.__request_id || ""),
              response_id: String(eventData?.response?.id || eventData?.id || ""),
              status: "streaming",
              meta: { chunks: streamDeltaEvents, chars: streamDeltaChars },
            });
            return;
          }
          this._addExternalJournal("stream.event", String(eventName || "event"), {
            turn_id: this._app.ai.turnId,
            request_id: String(eventData?.__request_id || ""),
            response_id: String(eventData?.response?.id || eventData?.id || ""),
            status: "streaming",
            meta: this._compactForTool(eventData),
          });
        },
      });
      const finalText = this._sanitizeAgentOutputText(out || "Готово.");
      this._finalizeAgentStreamingEntry(streamEntryId, finalText, "completed", "info", {
        response_id: this._app.ai.streamResponseId || "",
        duration_ms: Date.now() - turnStartedAt,
      });
      this._app.ai.taskState = "completed";
      if (normalized.actionable) this._app.ai.pendingTask = "";
      this._addChangesJournal("ai.task.complete", `turn=${this._app.ai.turnId}`, {
        turn_id: this._app.ai.turnId,
        status: "completed",
        meta: {
          duration_ms: Date.now() - turnStartedAt,
          delta_chunks: streamDeltaEvents,
          delta_chars: streamDeltaChars,
        },
      });
      this._dom.agentPrompt.value = "";
    } catch (err) {
      console.error(err);
      const details = String(err?.message || "Неизвестная ошибка").slice(0, 400);
      this._finalizeAgentStreamingEntry(streamEntryId, `Ошибка выполнения: ${details}`, "error", "error", {
        duration_ms: Date.now() - turnStartedAt,
      });
      this._app.ai.taskState = "failed";
      this._addChangesJournal("ai.task.error", `turn=${this._app.ai.turnId}`, {
        turn_id: this._app.ai.turnId,
        level: "error",
        status: "error",
        meta: { error: details, duration_ms: Date.now() - turnStartedAt },
      });
      this._toast("Ошибка выполнения запроса ИИ");
    } finally {
      this._app.ai.sending = false;
      this._renderAiUi();
    }
  }
}
