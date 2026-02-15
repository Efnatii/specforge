export class AgentPromptModule {
  constructor({
    app,
    dom,
    windowRef,
    continuePromptRe,
    shortAckPromptRe,
    incompleteResponseRe,
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
    if (!(incompleteResponseRe instanceof RegExp)) throw new Error("AgentPromptModule requires incompleteResponseRe");
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
    this._incompleteResponseRe = incompleteResponseRe;
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

  _setPendingQuestion(payload) {
    if (!payload || typeof payload !== "object") {
      this._app.ai.pendingQuestion = null;
      return;
    }
    const options = Array.isArray(payload.options)
      ? payload.options.map((x) => this._normalizeOptionText(x)).filter(Boolean).slice(0, 6)
      : [];
    this._app.ai.pendingQuestion = {
      turn_id: String(payload.turn_id || this._app.ai.turnId || ""),
      text: String(payload.text || "").trim(),
      options,
      allow_custom: Boolean(payload.allow_custom),
    };
  }

  _normalizeOptionText(textRaw) {
    let text = String(textRaw || "").replace(/\s+/g, " ").trim();
    if (!text) return "";
    text = text.replace(/^[:\-–—.,;)\]]+\s*/, "").trim();
    text = text.replace(/^[(\[]+/, "").trim();
    text = text.replace(/^["'«»]+/, "").trim();
    text = text.replace(/["'«»]+$/, "").trim();
    text = text.replace(/[;,.]+$/, "").trim();
    if (!text) return "";
    if (text.length < 2) return "";
    if (text.length > 140) return "";
    if (/^предложить\s+свой$/i.test(text)) return "";
    if (/^(вариант|варианты|option|options)$/i.test(text)) return "";
    return text;
  }

  _collectMarkedOptions(textRaw, markerRegex) {
    const text = String(textRaw || "");
    const matches = Array.from(text.matchAll(markerRegex));
    if (matches.length < 2) return { options: [], firstIndex: -1 };

    const options = [];
    const seen = new Set();
    for (let i = 0; i < matches.length; i += 1) {
      const start = Number(matches[i].index || 0) + String(matches[i][0] || "").length;
      const end = i + 1 < matches.length ? Number(matches[i + 1].index || text.length) : text.length;
      const raw = text.slice(start, end);
      const option = this._normalizeOptionText(raw);
      if (!option) continue;
      const key = option.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      options.push(option);
      if (options.length >= 6) break;
    }
    if (options.length < 2) return { options: [], firstIndex: -1 };
    return { options, firstIndex: Number(matches[0].index || 0) };
  }

  _extractQuestionOptions(textRaw) {
    const text = String(textRaw || "");
    const numeric = this._collectMarkedOptions(text, /(?:^|\s)\d{1,2}[.)]\s*/g);
    if (numeric.options.length >= 2) return numeric;

    const letter = this._collectMarkedOptions(text, /(?:^|\s)[A-Za-zА-Яа-я][.)]\s*/g);
    if (letter.options.length >= 2) return letter;

    const keyword = text.match(/(?:варианты?|options?|choose|выберите)\s*:\s*(.+)$/i);
    if (keyword) {
      const tail = String(keyword[1] || "");
      const parts = tail
        .split(/\s*(?:;|\|)\s*/)
        .map((x) => this._normalizeOptionText(x))
        .filter(Boolean);
      const uniq = [];
      const seen = new Set();
      for (const part of parts) {
        const key = part.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        uniq.push(part);
        if (uniq.length >= 6) break;
      }
      if (uniq.length >= 2) {
        return {
          options: uniq,
          firstIndex: Math.max(0, Number(text.indexOf(keyword[0]))),
        };
      }
    }

    return { options: [], firstIndex: -1 };
  }

  _extractQuestionPayload(textRaw) {
    const text = String(textRaw || "").replace(/\s+/g, " ").trim();
    if (!text) return null;

    const optionsInfo = this._extractQuestionOptions(text);
    const options = Array.isArray(optionsInfo.options) ? optionsInfo.options : [];

    const questionMatches = text.match(/[^?]*\?/g);
    let question = "";
    if (Array.isArray(questionMatches) && questionMatches.length) {
      question = String(questionMatches[questionMatches.length - 1] || "").trim();
    }

    if (!question && Number(optionsInfo.firstIndex) > 0) {
      question = text.slice(0, Number(optionsInfo.firstIndex)).trim();
    }

    if (!question && this._incompleteResponseRe.test(text)) {
      question = text;
    }

    question = String(question || "").replace(/\s+/g, " ").trim();
    question = question.replace(/(?:варианты?|options?|choose|выберите)\s*:?\s*$/i, "").trim();
    if (!question && options.length) {
      question = "Выберите вариант ответа.";
    }

    if (!question) return null;
    return {
      question: question.slice(0, 320),
      options,
    };
  }

  async onAgentQuestionFrameClick(e) {
    const btn = e?.target?.closest ? e.target.closest("[data-agent-question-choice],[data-agent-question-custom]") : null;
    if (!btn) return;
    if (this._app.ai.sending) return;

    const pending = this._app.ai.pendingQuestion;
    if (!pending || typeof pending !== "object") return;

    if (btn.dataset.agentQuestionCustom === "1") {
      this._setPendingQuestion({
        ...pending,
        allow_custom: true,
      });
      this._addChangesJournal("ai.task.question.custom", `turn=${this._app.ai.turnId || pending.turn_id || ""}`, {
        turn_id: this._app.ai.turnId || pending.turn_id || "",
        status: "done",
      });
      this._renderAiUi();
      if (this._dom.agentPrompt && !this._dom.agentPrompt.disabled) {
        this._dom.agentPrompt.focus();
      }
      return;
    }

    const idx = Number(btn.dataset.agentQuestionChoice);
    if (!Number.isFinite(idx)) return;
    const options = Array.isArray(pending.options) ? pending.options : [];
    const answer = String(options[idx] || "").trim();
    if (!answer) return;
    await this.sendAgentPrompt({ overrideText: answer });
  }

  async sendAgentPrompt(options = {}) {
    if (!this._app.ai.connected || !this._app.ai.apiKey) {
      this._toast("Сначала подключите OpenAI");
      return;
    }
    if (this._app.ai.sending) return;

    const overrideText = typeof options === "string" ? options : String(options?.overrideText || "");
    const forcedText = String(overrideText || "").trim();
    const pending = this._app.ai.pendingQuestion;
    const pendingOptions = Array.isArray(pending?.options)
      ? pending.options.map((x) => String(x || "").trim()).filter(Boolean)
      : [];
    const pendingLocked = Boolean(pending && pendingOptions.length > 0 && !pending.allow_custom);
    const hadPendingQuestion = Boolean(pending);
    if (!forcedText && pendingLocked) {
      this._toast("Выберите вариант ответа или нажмите «Предложить свой»");
      return;
    }

    const rawText = forcedText || String(this._dom.agentPrompt.value || "").trim();
    if (!rawText) {
      this._toast("Введите запрос для ИИ");
      return;
    }
    this._setPendingQuestion(null);

    const normalized = (forcedText || hadPendingQuestion)
      ? {
          text: rawText,
          basePrompt: rawText,
          actionable: false,
          mode: "question-answer",
          usedPendingTask: false,
        }
      : this._normalizeAgentPrompt(rawText);
    const text = String(normalized?.text || "").trim();
    if (!text) {
      this._toast("Нет задачи для выполнения");
      return;
    }
    if (!hadPendingQuestion && !this._continuePromptRe.test(rawText) && !this._shortAckPromptRe.test(rawText)) {
      this._app.ai.lastTaskPrompt = rawText;
    }
    if (!hadPendingQuestion && normalized.actionable) {
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
    let focusPromptForReply = false;

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
      const allowQuestions = this._app.ai.options?.allowQuestions !== false;
      const pending = this._app.ai.pendingQuestion;
      const hasStructuredQuestion = Boolean(
        pending
        && typeof pending === "object"
        && String(pending.text || "").trim(),
      );

      if (hasStructuredQuestion && allowQuestions) {
        this._setPendingQuestion({
          turn_id: pending.turn_id || this._app.ai.turnId,
          text: pending.text,
          options: pending.options,
          allow_custom: pending.allow_custom,
        });
        if (this._dom.agentPrompt) this._dom.agentPrompt.value = "";
        const options = Array.isArray(this._app.ai.pendingQuestion?.options) ? this._app.ai.pendingQuestion.options : [];
        focusPromptForReply = options.length === 0;
      } else {
        if (hasStructuredQuestion && !allowQuestions) {
          this._addChangesJournal("ai.task.question.blocked", `turn=${this._app.ai.turnId}`, {
            turn_id: this._app.ai.turnId,
            status: "done",
            meta: { reason: "allowQuestions=off" },
          });
        }
        this._setPendingQuestion(null);
        if (this._dom.agentPrompt) this._dom.agentPrompt.value = "";
      }
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
      if (focusPromptForReply && this._dom.agentPrompt && !this._dom.agentPrompt.disabled) {
        this._dom.agentPrompt.focus();
        const len = this._dom.agentPrompt.value.length;
        this._dom.agentPrompt.setSelectionRange(len, len);
      }
    }
  }
}
