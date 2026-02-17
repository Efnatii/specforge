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
    appendAgentStreamingReasoningDelta,
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
    if (typeof appendAgentStreamingReasoningDelta !== "function") throw new Error("AgentPromptModule requires appendAgentStreamingReasoningDelta()");
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
    this._appendAgentStreamingReasoningDelta = appendAgentStreamingReasoningDelta;
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

  _createReasoningTracker() {
    return {
      order: [],
      byRequest: new Map(),
      nextSeq: 1,
      liveUpdates: 0,
    };
  }

  _ensureReasoningRequest(tracker, requestIdRaw = "", responseIdRaw = "") {
    const requestId = String(requestIdRaw || "").trim() || `request_${tracker.nextSeq}`;
    const responseId = String(responseIdRaw || "").trim();
    let row = tracker.byRequest.get(requestId);
    if (!row) {
      row = {
        seq: tracker.nextSeq,
        request_id: requestId,
        response_id: responseId,
        summary_live: "",
        summary: "",
        assistant_text: "",
      };
      tracker.nextSeq += 1;
      tracker.byRequest.set(requestId, row);
      tracker.order.push(requestId);
    } else if (!row.response_id && responseId) {
      row.response_id = responseId;
    }
    return row;
  }

  _normalizeReasoningText(textRaw, maxLen = 4800) {
    const text = String(textRaw || "")
      .replace(/\r/g, "")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    if (!text) return "";
    if (text.length <= maxLen) return text;
    return `${text.slice(0, Math.max(0, maxLen - 3))}...`;
  }

  _readReasoningTextFromEvent(eventName, eventData) {
    const name = String(eventName || "").toLowerCase();
    if (!name.includes("reasoning_summary")) return "";
    const candidates = [
      eventData?.delta,
      eventData?.text,
      eventData?.summary?.text,
      eventData?.part?.text,
      eventData?.item?.text,
      eventData?.reasoning_summary_text,
    ];
    for (const candidate of candidates) {
      const text = this._normalizeReasoningText(candidate, 1800);
      if (text) return text;
    }
    return "";
  }

  _extractReasoningSummaryFromResponse(response) {
    const parts = [];
    for (const item of response?.output || []) {
      if (String(item?.type || "") !== "reasoning") continue;
      const summaryItems = Array.isArray(item?.summary) ? item.summary : [];
      for (const summaryPart of summaryItems) {
        const text = this._normalizeReasoningText(summaryPart?.text, 2400);
        if (!text) continue;
        parts.push(text);
      }
    }
    return this._normalizeReasoningText(parts.join("\n\n"), 4800);
  }

  _extractAssistantTextFromResponse(response) {
    const parts = [];
    for (const item of response?.output || []) {
      if (item?.type !== "message") continue;
      for (const content of item?.content || []) {
        if ((content?.type === "output_text" || content?.type === "text") && typeof content?.text === "string") {
          parts.push(content.text);
        }
      }
    }
    return this._normalizeReasoningText(parts.join("\n"), 1800);
  }

  _captureReasoningEvent(tracker, eventName, eventData) {
    const name = String(eventName || "").toLowerCase();
    const requestId = String(eventData?.__request_id || this._app.ai.currentRequestId || "").trim();
    const responseId = String(eventData?.response?.id || eventData?.id || "").trim();
    let changed = false;

    if (name.includes("reasoning_summary")) {
      const row = this._ensureReasoningRequest(tracker, requestId, responseId);
      const text = this._readReasoningTextFromEvent(eventName, eventData);
      if (text) {
        if (name.endsWith(".delta")) {
          row.summary_live = `${row.summary_live || ""}${text}`;
        } else {
          row.summary_live = text;
        }
        changed = true;
      }
    }

    if (name === "response.completed") {
      const response = eventData?.response || eventData;
      const row = this._ensureReasoningRequest(tracker, requestId, String(response?.id || responseId || ""));
      const summary = this._extractReasoningSummaryFromResponse(response);
      if (summary) {
        row.summary = summary;
        changed = true;
      } else if (row.summary_live) {
        row.summary = this._normalizeReasoningText(row.summary_live, 4800);
        changed = true;
      }
      const assistant = this._extractAssistantTextFromResponse(response);
      if (assistant) {
        row.assistant_text = assistant;
        changed = true;
      }
    }

    if (changed) tracker.liveUpdates += 1;
    return changed;
  }

  _buildReasoningLivePreview(tracker, maxItems = 3) {
    const ids = Array.isArray(tracker?.order) ? tracker.order.slice(-maxItems) : [];
    if (!ids.length) return "";
    const parts = [];
    for (const id of ids) {
      const row = tracker.byRequest.get(id);
      if (!row) continue;
      const summary = this._normalizeReasoningText(row.summary || row.summary_live, 1200);
      if (!summary) continue;
      parts.push(`Запрос #${row.seq}\n${summary}`);
    }
    return this._normalizeReasoningText(parts.join("\n\n-----\n\n"), 5000);
  }

  _buildReasoningHistory(tracker) {
    const out = [];
    for (const id of tracker?.order || []) {
      const row = tracker.byRequest.get(id);
      if (!row) continue;
      const summary = this._normalizeReasoningText(row.summary || row.summary_live, 4200);
      const assistant = this._normalizeReasoningText(row.assistant_text, 1600);
      if (!summary && !assistant) continue;
      out.push({
        seq: row.seq,
        request_id: row.request_id || "",
        response_id: row.response_id || "",
        summary,
        assistant_text: assistant,
      });
    }
    return out;
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
    this._app.ai.streamReasoningBuffer = "";
    this._app.ai.streamDeltaCount = 0;
    this._app.ai.streamReasoningDeltaCount = 0;
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
    let reasoningDeltaEvents = 0;
    let reasoningDeltaChars = 0;
    const reasoningTracker = this._createReasoningTracker();
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
          const eventNameText = String(eventName || "");
          const isOutputDelta = eventNameText === "response.output_text.delta";
          const isReasoningSummaryEvent = /reasoning_summary/i.test(eventNameText);

          if (isOutputDelta) {
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

          if (isReasoningSummaryEvent) {
            const changed = this._captureReasoningEvent(reasoningTracker, eventNameText, eventData || {});
            const deltaText = this._readReasoningTextFromEvent(eventNameText, eventData || {});
            if (deltaText && /delta$/i.test(eventNameText)) {
              reasoningDeltaEvents += 1;
              reasoningDeltaChars += deltaText.length;
            }
            if (changed && (
              reasoningTracker.liveUpdates <= 2
              || reasoningTracker.liveUpdates % 4 === 0
              || /done$/i.test(eventNameText)
            )) {
              const livePreview = this._buildReasoningLivePreview(reasoningTracker);
              if (livePreview) {
                this._appendAgentStreamingReasoningDelta(streamEntryId, livePreview, { replace: true });
              }
            }
            if (reasoningDeltaEvents > 0 && reasoningDeltaEvents % 30 === 0) {
              this._addExternalJournal("stream.reasoning", `chunks=${reasoningDeltaEvents}, chars=${reasoningDeltaChars}`, {
                turn_id: this._app.ai.turnId,
                request_id: String(eventData?.__request_id || ""),
                response_id: String(eventData?.response?.id || eventData?.id || ""),
                status: "streaming",
                meta: { chunks: reasoningDeltaEvents, chars: reasoningDeltaChars },
              });
            }
            return;
          }

          if (eventNameText === "response.completed") {
            const changed = this._captureReasoningEvent(reasoningTracker, eventNameText, eventData || {});
            if (changed) {
              const livePreview = this._buildReasoningLivePreview(reasoningTracker);
              if (livePreview) {
                this._appendAgentStreamingReasoningDelta(streamEntryId, livePreview, { replace: true });
              }
            }
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
      const outText = typeof out === "string" ? out : String(out?.text || "");
      const finalText = this._sanitizeAgentOutputText(outText || "Готово.");
      const reasoningHistory = this._buildReasoningHistory(reasoningTracker);
      this._finalizeAgentStreamingEntry(streamEntryId, finalText, "completed", "info", {
        response_id: this._app.ai.streamResponseId || "",
        duration_ms: Date.now() - turnStartedAt,
        reasoning_history: reasoningHistory,
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
          reasoning_chunks: reasoningDeltaEvents,
          reasoning_chars: reasoningDeltaChars,
          reasoning_requests: reasoningHistory.length,
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
      const reasoningHistory = this._buildReasoningHistory(reasoningTracker);
      this._finalizeAgentStreamingEntry(streamEntryId, `Ошибка выполнения: ${details}`, "error", "error", {
        duration_ms: Date.now() - turnStartedAt,
        reasoning_history: reasoningHistory,
      });
      this._app.ai.taskState = "failed";
      this._addChangesJournal("ai.task.error", `turn=${this._app.ai.turnId}`, {
        turn_id: this._app.ai.turnId,
        level: "error",
        status: "error",
        meta: {
          error: details,
          duration_ms: Date.now() - turnStartedAt,
          reasoning_chunks: reasoningDeltaEvents,
          reasoning_chars: reasoningDeltaChars,
          reasoning_requests: reasoningHistory.length,
        },
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
