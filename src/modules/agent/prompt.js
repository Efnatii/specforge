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
    cancelOpenAiResponse,
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
    if (typeof cancelOpenAiResponse !== "function") throw new Error("AgentPromptModule requires cancelOpenAiResponse()");
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
    this._cancelOpenAiResponse = cancelOpenAiResponse;
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
    const toolOutputs = Array.isArray(payload.tool_outputs)
      ? payload.tool_outputs
        .filter((item) => item && typeof item === "object")
        .map((item) => ({
          type: String(item.type || ""),
          call_id: String(item.call_id || ""),
          output: String(item.output || ""),
        }))
        .filter((item) => item.type === "function_call_output" && item.call_id && item.output)
      : [];
    this._app.ai.pendingQuestion = {
      turn_id: String(payload.turn_id || this._app.ai.turnId || ""),
      response_id: String(payload.response_id || ""),
      request_id: String(payload.request_id || ""),
      text: String(payload.text || "").trim(),
      options,
      allow_custom: Boolean(payload.allow_custom),
      tool_outputs: toolOutputs,
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
      lastSyntheticRequestId: "",
    };
  }

  _ensureReasoningRequest(tracker, requestIdRaw = "", responseIdRaw = "") {
    const responseId = String(responseIdRaw || "").trim();
    const requestIdInput = String(requestIdRaw || "").trim();
    let requestId = requestIdInput;
    if (!requestId) {
      if (responseId) {
        requestId = `response_${responseId}`;
      } else if (String(tracker?.lastSyntheticRequestId || "").trim()) {
        requestId = String(tracker.lastSyntheticRequestId).trim();
      } else {
        requestId = `request_${tracker.nextSeq}`;
      }
    }

    tracker.lastSyntheticRequestId = requestId;
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

  _mergeReasoningLiveText(prevRaw, incomingRaw, appendOnly = false) {
    const prev = this._normalizeReasoningText(prevRaw, 12000);
    const incoming = this._normalizeReasoningText(incomingRaw, 2400);
    if (!incoming) return prev;
    if (!prev) return incoming;

    if (appendOnly) {
      return this._normalizeReasoningText(`${prev}${incoming}`, 12000);
    }

    if (incoming.startsWith(prev)) return this._normalizeReasoningText(incoming, 12000);
    if (prev.startsWith(incoming)) return prev;
    if (incoming.includes(prev)) return this._normalizeReasoningText(incoming, 12000);
    if (prev.includes(incoming)) return prev;

    // Some events carry full snapshot, others carry short replacement text.
    // Keep both instead of destructive replacement when they differ.
    return this._normalizeReasoningText(`${prev}\n${incoming}`, 12000);
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
        row.summary_live = this._mergeReasoningLiveText(
          row.summary_live || "",
          text,
          name.endsWith(".delta"),
        );
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

  _buildReasoningLivePreview(tracker, maxItems = 0) {
    const order = Array.isArray(tracker?.order) ? tracker.order : [];
    const ids = maxItems > 0 ? order.slice(-maxItems) : order.slice();
    if (!ids.length) return "";
    const parts = [];
    for (const id of ids) {
      const row = tracker.byRequest.get(id);
      if (!row) continue;
      const summary = this._normalizeReasoningText(row.summary || row.summary_live, 1200);
      if (!summary) continue;
      parts.push(`Запрос #${row.seq}\n${summary}`);
    }
    return this._normalizeReasoningText(parts.join("\n\n-----\n\n"), 12000);
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

  _isNetworkOnline() {
    const nav = this._window?.navigator;
    if (!nav || typeof nav.onLine !== "boolean") return true;
    return nav.onLine !== false;
  }

  _getPendingCancelResponseIds() {
    const src = Array.isArray(this._app.ai.pendingCancelResponseIds)
      ? this._app.ai.pendingCancelResponseIds
      : [];
    const out = [];
    const seen = new Set();
    for (const raw of src) {
      const id = String(raw || "").trim();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      out.push(id);
      if (out.length >= 64) break;
    }
    this._app.ai.pendingCancelResponseIds = out;
    return out;
  }

  _enqueuePendingCancelResponseId(responseIdRaw) {
    const responseId = String(responseIdRaw || "").trim();
    if (!responseId) return false;
    const queue = this._getPendingCancelResponseIds();
    if (queue.includes(responseId)) return false;
    queue.push(responseId);
    this._app.ai.pendingCancelResponseIds = queue.slice(-64);
    return true;
  }

  _dequeuePendingCancelResponseId(responseIdRaw) {
    const responseId = String(responseIdRaw || "").trim();
    if (!responseId) return false;
    const queue = this._getPendingCancelResponseIds();
    const next = queue.filter((id) => id !== responseId);
    const changed = next.length !== queue.length;
    if (changed) this._app.ai.pendingCancelResponseIds = next;
    return changed;
  }

  async _requestApiCancelForResponse(responseIdRaw, turnIdRaw, options = {}) {
    const responseId = String(responseIdRaw || "").trim();
    const turnId = String(turnIdRaw || this._app.ai.turnId || "");
    const source = String(options?.source || "user_cancel");
    const keepalive = options?.keepalive === true;
    const deferWhenOffline = options?.deferWhenOffline === true;
    if (!responseId) {
      return { attempted: false, ok: false, responseId: "" };
    }
    if (!this._app.ai.connected || !this._app.ai.apiKey) {
      return { attempted: false, ok: false, responseId, disconnected: true };
    }

    if (!this._isNetworkOnline()) {
      const queued = deferWhenOffline ? this._enqueuePendingCancelResponseId(responseId) : false;
      if (deferWhenOffline && queued) {
        this._addExternalJournal("cancel.api.deferred", "cancel queued: offline", {
          turn_id: turnId,
          response_id: responseId,
          status: "running",
          level: "info",
          meta: { source, reason: "offline" },
        });
      }
      return {
        attempted: false,
        ok: false,
        responseId,
        deferred: queued,
        offline: true,
      };
    }

    if (String(this._app.ai.cancelApiRequestedFor || "") === responseId) {
      return { attempted: false, ok: true, responseId };
    }

    this._app.ai.cancelApiRequestedFor = responseId;
    let ok = false;
    let expectedMiss = false;
    let statusCode = 0;
    try {
      const cancelResult = await this._cancelOpenAiResponse(responseId, { turnId, keepalive });
      ok = Boolean(cancelResult?.ok);
      expectedMiss = Boolean(cancelResult?.expectedMiss);
      statusCode = Math.max(0, Number(cancelResult?.status || 0));
    } catch {
      ok = false;
    }

    this._addExternalJournal("cancel.api", `cancel requested (${source})`, {
      turn_id: turnId,
      response_id: responseId,
      status: ok || expectedMiss ? "completed" : "error",
      level: ok || expectedMiss ? "info" : "warning",
      meta: {
        source,
        ok,
        expected_miss: expectedMiss,
        status: statusCode || null,
      },
    });
    if (!ok && !expectedMiss && String(this._app.ai.cancelApiRequestedFor || "") === responseId) {
      this._app.ai.cancelApiRequestedFor = "";
    }
    if (ok || expectedMiss) this._dequeuePendingCancelResponseId(responseId);
    return {
      attempted: true,
      ok,
      expectedMiss,
      statusCode,
      responseId,
    };
  }

  async cancelAgentPrompt(options = {}) {
    if (!this._app.ai.sending) return;
    const source = String(options?.source || "cancel_button");
    const keepalive = options?.keepalive === true;
    const silent = options?.silent === true;
    const deferWhenOffline = options?.deferWhenOffline !== false;
    this._app.ai.cancelRequested = true;
    this._app.ai.taskState = "cancel_requested";
    const turnId = String(this._app.ai.turnId || "");
    const backgroundResponseId = String(this._app.ai.backgroundResponseId || "").trim();
    const streamResponseId = String(this._app.ai.streamResponseId || "").trim();
    const abortFn = typeof this._app.ai.activeRequestAbort === "function" ? this._app.ai.activeRequestAbort : null;
    const responseIdForApiCancel = backgroundResponseId || streamResponseId;

    if (abortFn) {
      try {
        abortFn("user_cancel");
      } catch {}
    }

    const apiCancel = await this._requestApiCancelForResponse(responseIdForApiCancel, turnId, {
      source,
      keepalive,
      deferWhenOffline,
    });
    if (!apiCancel?.attempted && !apiCancel?.deferred) {
      this._addExternalJournal("cancel.api.skipped", "response_id is not available yet", {
        turn_id: turnId,
        status: "running",
        level: "info",
      });
      // Best-effort late retry: response_id may appear shortly after cancel click in race conditions.
      const retryStartedAt = Date.now();
      const scheduleLateApiCancelRetry = () => {
        if (!this._app.ai.cancelRequested) return;
        if ((Date.now() - retryStartedAt) > 1200) return;
        const lateResponseId = String(this._app.ai.backgroundResponseId || this._app.ai.streamResponseId || "").trim();
        if (lateResponseId) {
          void this._requestApiCancelForResponse(lateResponseId, turnId, {
            source: "late_retry",
            keepalive,
            deferWhenOffline,
          });
          return;
        }
        this._window.setTimeout(scheduleLateApiCancelRetry, 80);
      };
      this._window.setTimeout(scheduleLateApiCancelRetry, 80);
    }

    if (!silent) {
      this._addChangesJournal("ai.task.cancel", `turn=${turnId || "unknown"}`, {
        turn_id: turnId,
        status: "done",
        meta: {
          source,
          response_id: responseIdForApiCancel || "",
          background_cancel: Boolean(backgroundResponseId),
          api_cancel_attempted: Boolean(apiCancel?.attempted),
          api_cancel_deferred: Boolean(apiCancel?.deferred),
          api_cancel_offline: Boolean(apiCancel?.offline),
          api_cancel_disconnected: Boolean(apiCancel?.disconnected),
          api_cancel_ok: Boolean(apiCancel?.ok),
          api_cancel_expected_miss: Boolean(apiCancel?.expectedMiss),
          api_cancel_status: Math.max(0, Number(apiCancel?.statusCode || 0)) || 0,
          api_cancel_response_id: String(apiCancel?.responseId || ""),
          via_abort: Boolean(abortFn),
        },
      });
    }
    this._renderAiUi();
  }

  async flushPendingCancelRequests(source = "online") {
    const queue = this._getPendingCancelResponseIds();
    if (!queue.length) {
      return {
        queued: 0,
        attempted: 0,
        ok: 0,
        expectedMiss: 0,
        failed: 0,
      };
    }
    if (!this._isNetworkOnline()) {
      return {
        queued: queue.length,
        attempted: 0,
        ok: 0,
        expectedMiss: 0,
        failed: queue.length,
        offline: true,
      };
    }
    if (!this._app.ai.connected || !this._app.ai.apiKey) {
      return {
        queued: queue.length,
        attempted: 0,
        ok: 0,
        expectedMiss: 0,
        failed: queue.length,
        disconnected: true,
      };
    }
    let attempted = 0;
    let ok = 0;
    let expectedMiss = 0;
    const failed = [];
    const turnId = String(this._app.ai.turnId || "");
    for (const responseId of queue) {
      const result = await this._requestApiCancelForResponse(responseId, turnId, {
        source: `${source}_flush`,
        keepalive: false,
        deferWhenOffline: true,
      });
      if (result?.attempted) attempted += 1;
      if (result?.ok) {
        ok += 1;
        continue;
      }
      if (result?.expectedMiss) {
        expectedMiss += 1;
        continue;
      }
      if (result?.attempted === false && result?.ok === true) {
        ok += 1;
        continue;
      }
      failed.push(responseId);
    }
    this._app.ai.pendingCancelResponseIds = failed;
    this._addExternalJournal("cancel.pending.flush", `flush queued cancels (${source})`, {
      turn_id: turnId,
      status: failed.length ? "running" : "completed",
      level: failed.length ? "warning" : "info",
      meta: {
        source,
        queued: queue.length,
        attempted,
        ok,
        expected_miss: expectedMiss,
        failed: failed.length,
      },
    });
    return {
      queued: queue.length,
      attempted,
      ok,
      expectedMiss,
      failed: failed.length,
    };
  }

  _getRuntimeAwareOption(key, fallback = undefined) {
    const runtimeOverrides = this._app?.ai?.runtimeProfile?.overrides;
    if (runtimeOverrides && Object.prototype.hasOwnProperty.call(runtimeOverrides, key)) {
      return runtimeOverrides[key];
    }
    const value = this._app?.ai?.options?.[key];
    return value === undefined ? fallback : value;
  }

  _normalizeMode(value, allowed, fallback) {
    const raw = String(value || "").trim().toLowerCase();
    if (allowed.includes(raw)) return raw;
    const fb = String(fallback || "").trim().toLowerCase();
    return allowed.includes(fb) ? fb : allowed[0];
  }

  _normalizePositiveInt(value, fallback = 0, min = 1, max = 4000000) {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) {
      const fb = Number(fallback);
      if (!Number.isFinite(fb) || fb <= 0) return 0;
      return Math.max(min, Math.min(max, Math.round(fb)));
    }
    return Math.max(min, Math.min(max, Math.round(n)));
  }

  _resolveConversationPreviousResponseId() {
    const enabled = Boolean(this._getRuntimeAwareOption("useConversationState", false));
    if (!enabled) return "";
    const lastResponseId = String(this._app.ai.lastCompletedResponseId || "").trim();
    if (!lastResponseId) return "";

    const compactMode = this._normalizeMode(this._getRuntimeAwareOption("compactMode", "off"), ["off", "auto", "on"], "off");
    const compactThresholdTokens = this._normalizePositiveInt(this._getRuntimeAwareOption("compactThresholdTokens", 90000), 90000, 1000, 4000000);
    const compactTurnThreshold = this._normalizePositiveInt(this._getRuntimeAwareOption("compactTurnThreshold", 45), 45, 1, 10000);
    const lastInputTokens = Math.max(0, Number(this._app.ai.lastInputTokens || this._app.ai.lastTotalTokens || 0));
    const contextOverThreshold = compactThresholdTokens > 0 && lastInputTokens > 0 && lastInputTokens >= compactThresholdTokens;
    const turnCounter = Math.max(0, Number(this._app.ai.turnCounter || 0));
    const longByTurns = compactTurnThreshold > 0 && turnCounter >= compactTurnThreshold;
    const historyLen = Array.isArray(this._app.ai.chatJournal) ? this._app.ai.chatJournal.length : 0;
    const longByHistory = historyLen >= Math.max(12, Math.round(compactTurnThreshold / 2) || 12);
    const longSession = longByTurns || longByHistory;
    const shouldReuse = compactMode === "on" || contextOverThreshold || longSession;
    return shouldReuse ? lastResponseId : "";
  }

  async sendAgentPrompt(options = {}) {
    if (!this._app.ai.connected || !this._app.ai.apiKey) {
      this._toast("\u0421\u043d\u0430\u0447\u0430\u043b\u0430 \u043f\u043e\u0434\u043a\u043b\u044e\u0447\u0438\u0442\u0435 OpenAI");
      return;
    }
    if (this._app.ai.sending) return;
    if (this._isNetworkOnline() && this._getPendingCancelResponseIds().length > 0) {
      void this.flushPendingCancelRequests("preflight");
    }

    const overrideText = typeof options === "string" ? options : String(options?.overrideText || "");
    const forcedText = String(overrideText || "").trim();
    const pending = this._app.ai.pendingQuestion;
    const pendingOptions = Array.isArray(pending?.options)
      ? pending.options.map((x) => String(x || "").trim()).filter(Boolean)
      : [];
    const pendingLocked = Boolean(pending && pendingOptions.length > 0 && !pending.allow_custom);
    const hadPendingQuestion = Boolean(pending);
    const pendingToolOutputs = Array.isArray(pending?.tool_outputs) ? pending.tool_outputs : [];
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
    const pendingTurnId = String(pending?.turn_id || "").trim();
    this._app.ai.turnId = hadPendingQuestion
      ? (pendingTurnId || this._nextAgentTurnId())
      : this._nextAgentTurnId();
    this._app.ai.taskState = "running";
    this._app.ai.lastStreamBuffer = "";
    this._app.ai.streamReasoningBuffer = "";
    this._app.ai.streamDeltaCount = 0;
    this._app.ai.streamReasoningDeltaCount = 0;
    this._app.ai.streamResponseId = "";
    this._app.ai.streamEntryId = "";
    this._app.ai.streamDeltaHasPending = false;
    this._app.ai.cancelRequested = false;
    this._app.ai.cancelApiRequestedFor = "";
    this._app.ai.backgroundActive = false;
    this._app.ai.backgroundResponseId = "";
    this._app.ai.backgroundPollCount = 0;
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
      meta: {
        normalized: text.slice(0, 300),
        use_conversation_state: this._getRuntimeAwareOption("useConversationState", false) === true,
      },
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
      const conversationPreviousResponseId = hadPendingQuestion
        ? ""
        : this._resolveConversationPreviousResponseId();
      const previousResponseId = hadPendingQuestion
        ? String(pending?.response_id || "").trim()
        : conversationPreviousResponseId;
      const reuseConversationState = !hadPendingQuestion && Boolean(previousResponseId);
      if (reuseConversationState) {
        this._addExternalJournal("conversation_state.use", "reuse previous_response_id for long-running context", {
          turn_id: this._app.ai.turnId,
          status: "running",
          meta: {
            previous_response_id: previousResponseId,
            last_input_tokens: Math.max(0, Number(this._app.ai.lastInputTokens || 0)),
            turn_counter: Math.max(0, Number(this._app.ai.turnCounter || 0)),
          },
        });
      }
      const input = this._buildAgentInput(text, {
        skipConversationHistory: reuseConversationState,
      });
      const out = await this._runOpenAiAgentTurn(input, text, {
        rawUserText: rawText,
        turnId: this._app.ai.turnId,
        previousResponseId,
        previousToolOutputs: hadPendingQuestion ? pendingToolOutputs : [],
        streamEntryId,
        onStreamDelta: (delta) => {
          if (!this._app.ai.sending) return;
          if (this._app.ai.cancelRequested || this._app.ai.taskState === "cancel_requested" || this._app.ai.taskState === "cancelled") return;
          this._appendAgentStreamingDelta(streamEntryId, delta);
        },
        onStreamEvent: (eventName, eventData) => {
          if (!this._app.ai.sending) return;
          const responseIdFromEvent = String(eventData?.response?.id || eventData?.id || "").trim();
          if (responseIdFromEvent) {
            this._app.ai.streamResponseId = responseIdFromEvent;
            if (this._app.ai.cancelRequested) {
              void this._requestApiCancelForResponse(responseIdFromEvent, this._app.ai.turnId, {
                source: "late_response_id",
                keepalive: false,
                deferWhenOffline: true,
              });
            }
          }
          if (this._app.ai.cancelRequested || this._app.ai.taskState === "cancel_requested" || this._app.ai.taskState === "cancelled") return;
          const eventNameText = String(eventName || "");
          if (eventNameText === "background.response.started") {
            const bgId = String(eventData?.response_id || "").trim();
            if (bgId) {
              this._app.ai.backgroundResponseId = bgId;
              this._app.ai.streamResponseId = bgId;
            }
            this._app.ai.backgroundActive = true;
            this._app.ai.backgroundPollCount = 0;
            this._renderAiUi();
          } else if (eventNameText === "background.response.polled") {
            this._app.ai.backgroundActive = true;
            this._app.ai.backgroundPollCount = Math.max(0, Number(eventData?.poll_count || 0));
          } else if (
            eventNameText === "background.response.completed"
            || eventNameText === "background.response.failed"
            || eventNameText === "background.response.cancelled"
          ) {
            this._app.ai.backgroundActive = false;
            if (eventNameText === "background.response.cancelled") this._app.ai.backgroundResponseId = "";
            this._renderAiUi();
          }

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
      const runtimeOverrides = this._app?.ai?.runtimeProfile?.overrides;
      const getRuntimeAwareOption = (key, fallback) => {
        if (runtimeOverrides && Object.prototype.hasOwnProperty.call(runtimeOverrides, key)) {
          return runtimeOverrides[key];
        }
        const value = this._app?.ai?.options?.[key];
        return value === undefined ? fallback : value;
      };
      const clarifyModeRaw = String(getRuntimeAwareOption("reasoningClarify", "never")).trim().toLowerCase();
      const clarifyMode = clarifyModeRaw === "never" || clarifyModeRaw === "minimal" || clarifyModeRaw === "normal"
        ? clarifyModeRaw
        : "never";
      const riskyModeRaw = String(getRuntimeAwareOption("riskyActionsMode", "allow_if_asked")).trim().toLowerCase();
      const riskyMode = riskyModeRaw === "confirm" || riskyModeRaw === "allow_if_asked" || riskyModeRaw === "never"
        ? riskyModeRaw
        : "allow_if_asked";
      const allowQuestions = clarifyMode !== "never" && riskyMode !== "never";
      const pendingQuestion = this._app.ai.pendingQuestion;
      const hasStructuredQuestion = Boolean(
        pendingQuestion
        && typeof pendingQuestion === "object"
        && String(pendingQuestion.text || "").trim(),
      );

      if (hasStructuredQuestion && allowQuestions) {
        this._setPendingQuestion({
          turn_id: pendingQuestion.turn_id || this._app.ai.turnId,
          response_id: pendingQuestion.response_id || "",
          request_id: pendingQuestion.request_id || "",
          text: pendingQuestion.text,
          options: pendingQuestion.options,
          allow_custom: pendingQuestion.allow_custom,
          tool_outputs: pendingQuestion.tool_outputs || [],
        });
        if (this._dom.agentPrompt) this._dom.agentPrompt.value = "";
        const options = Array.isArray(this._app.ai.pendingQuestion?.options) ? this._app.ai.pendingQuestion.options : [];
        focusPromptForReply = options.length === 0;
      } else {
        if (hasStructuredQuestion && !allowQuestions) {
          this._addChangesJournal("ai.task.question.blocked", `turn=${this._app.ai.turnId}`, {
            turn_id: this._app.ai.turnId,
            status: "done",
            meta: { reason: `questions_disabled(clarify=${clarifyMode},risky=${riskyMode})` },
          });
        }
        this._setPendingQuestion(null);
        if (this._dom.agentPrompt) this._dom.agentPrompt.value = "";
      }
   
    } catch (err) {
      const details = String(err?.message || "\u041d\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043d\u0430\u044f \u043e\u0448\u0438\u0431\u043a\u0430").slice(0, 400);
      const canceled = this._app.ai.cancelRequested || /cancel|aborted|terminated/i.test(details);
      if (!canceled) console.error(err);
      const reasoningHistory = this._buildReasoningHistory(reasoningTracker);
      if (canceled) {
        this._finalizeAgentStreamingEntry(streamEntryId, "\u0412\u044b\u043f\u043e\u043b\u043d\u0435\u043d\u0438\u0435 \u043e\u0441\u0442\u0430\u043d\u043e\u0432\u043b\u0435\u043d\u043e \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u0435\u043c.", "completed", "warning", {
          duration_ms: Date.now() - turnStartedAt,
          reasoning_chunks: reasoningDeltaEvents,
          reasoning_chars: reasoningDeltaChars,
          reasoning_requests: reasoningHistory.length,
          reasoning_history: reasoningHistory,
        });
        this._app.ai.taskState = "cancelled";
        this._addChangesJournal("ai.task.cancelled", `turn=${this._app.ai.turnId}`, {
          turn_id: this._app.ai.turnId,
          status: "done",
          meta: { reason: details },
        });
        this._addExternalJournal("cancel.total.success", "hard cancel completed", {
          turn_id: this._app.ai.turnId,
          status: "completed",
          level: "info",
          meta: {
            reason: details,
            no_more_processing: true,
          },
        });
      } else {
        this._finalizeAgentStreamingEntry(streamEntryId, `\u041e\u0448\u0438\u0431\u043a\u0430 \u0432\u044b\u043f\u043e\u043b\u043d\u0435\u043d\u0438\u044f: ${details}`, "error", "error", {
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
        this._toast("\u041e\u0448\u0438\u0431\u043a\u0430 \u0432\u044b\u043f\u043e\u043b\u043d\u0435\u043d\u0438\u044f \u0437\u0430\u043f\u0440\u043e\u0441\u0430 \u0418\u0418");
      }
    } finally {
      this._app.ai.sending = false;
      this._app.ai.cancelRequested = false;
      this._app.ai.cancelApiRequestedFor = "";
      this._app.ai.activeRequestAbort = null;
      this._app.ai.backgroundActive = false;
      this._app.ai.backgroundPollCount = 0;
      this._app.ai.backgroundResponseId = "";
      this._renderAiUi();
      if (focusPromptForReply && this._dom.agentPrompt && !this._dom.agentPrompt.disabled) {
        this._dom.agentPrompt.focus();
        const len = this._dom.agentPrompt.value.length;
        this._dom.agentPrompt.setSelectionRange(len, len);
      }
    }
  }
}

