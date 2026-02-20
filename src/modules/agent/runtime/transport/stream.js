export class AgentRuntimeStreamTransportModule {
  constructor(ctx) {
    Object.assign(this, createAgentRuntimeStreamTransportInternal(ctx));
  }
}

function createAgentRuntimeStreamTransportInternal(ctx) {
  const { app, deps } = ctx || {};
  if (!app) throw new Error("AgentRuntimeStreamTransportModule requires app");
  if (!deps) throw new Error("AgentRuntimeStreamTransportModule requires deps");

  const {
    addExternalJournal,
    compactForTool,
    disconnectOpenAi,
    uid,
    num,
    fetchFn,
    parseSseEvent,
  } = deps;

  if (typeof addExternalJournal !== "function") throw new Error("AgentRuntimeStreamTransportModule requires deps.addExternalJournal()");
  if (typeof compactForTool !== "function") throw new Error("AgentRuntimeStreamTransportModule requires deps.compactForTool()");
  if (typeof disconnectOpenAi !== "function") throw new Error("AgentRuntimeStreamTransportModule requires deps.disconnectOpenAi()");
  if (typeof uid !== "function") throw new Error("AgentRuntimeStreamTransportModule requires deps.uid()");
  if (typeof num !== "function") throw new Error("AgentRuntimeStreamTransportModule requires deps.num()");
  if (typeof parseSseEvent !== "function") throw new Error("AgentRuntimeStreamTransportModule requires deps.parseSseEvent()");

  const fetch = fetchFn || ((...args) => globalThis.fetch(...args));

  function compactText(text, maxLen = 800) {
    return String(text || "").replace(/\s+/g, " ").trim().slice(0, maxLen);
  }

  function setActiveAbort(abortFn) {
    app.ai.activeRequestAbort = typeof abortFn === "function" ? abortFn : null;
  }

  function clearActiveAbort(currentAbortFn) {
    if (!currentAbortFn) {
      app.ai.activeRequestAbort = null;
      return;
    }
    if (app.ai.activeRequestAbort === currentAbortFn) app.ai.activeRequestAbort = null;
  }

  function isAbortError(err) {
    const name = String(err?.name || "").toLowerCase();
    const msg = String(err?.message || "").toLowerCase();
    const reason = String(err?.reason || err?.cause || "").toLowerCase();
    return name === "aborterror"
      || msg.includes("abort")
      || msg.includes("cancel")
      || reason.includes("abort")
      || reason.includes("cancel");
  }

  function isTimeoutAbort(controller, err) {
    const signalReason = String(controller?.signal?.reason || "").toLowerCase();
    if (signalReason.includes("timeout")) return true;
    const errReason = String(err?.reason || err?.cause || "").toLowerCase();
    if (errReason.includes("timeout")) return true;
    const msg = String(err?.message || "").toLowerCase();
    return msg.includes("timeout");
  }

  function throwIfCanceled() {
    if (app.ai.cancelRequested || app.ai.taskState === "cancel_requested" || app.ai.taskState === "cancelled") {
      const e = new Error("request canceled by user");
      e.canceled = true;
      throw e;
    }
  }

  function getRuntimeAwareOption(key, fallback = undefined) {
    const runtimeOverrides = app?.ai?.runtimeProfile?.overrides;
    if (runtimeOverrides && Object.prototype.hasOwnProperty.call(runtimeOverrides, key)) {
      return runtimeOverrides[key];
    }
    const value = app?.ai?.options?.[key];
    return value === undefined ? fallback : value;
  }

  async function callOpenAiResponsesStream(payload, options = {}) {
    const startedAt = Date.now();
    const model = String(payload?.model || app.ai.model || "");
    const isContinuation = Boolean(payload?.previous_response_id);
    const toolsCount = Array.isArray(payload?.tools) ? payload.tools.length : 0;
    const reasoningEffort = String(payload?.reasoning?.effort || "medium");
    const reasoningSummary = String(payload?.reasoning?.summary || "");
    const continuationHasTools = isContinuation ? toolsCount > 0 : false;
    const requestId = uid();
    const turnId = options?.turnId || app.ai.turnId || "";
    app.ai.currentRequestId = requestId;
    const timeoutRaw = Number(options?.timeout_ms);
    const timeoutEnabled = Number.isFinite(timeoutRaw) ? timeoutRaw > 0 : true;
    const timeoutMs = timeoutEnabled ? Math.max(30000, num(timeoutRaw, 600000)) : 0;
    const requestedServiceTier = String(payload?.service_tier || "default");
    const lowBandwidthMode = getRuntimeAwareOption("lowBandwidthMode", false) === true;
    const includeItems = Array.isArray(payload?.include)
      ? payload.include.map((x) => String(x || "").trim()).filter(Boolean)
      : [];
    const metadataKeys = payload?.metadata && typeof payload.metadata === "object"
      ? Object.keys(payload.metadata).map((k) => String(k || "").trim()).filter(Boolean)
      : [];
    const hasPromptCache = Boolean(String(payload?.prompt_cache_key || "").trim() || String(payload?.prompt_cache_retention || "").trim());
    const hasSafetyIdentifier = Boolean(String(payload?.safety_identifier || "").trim());
    const truncationMode = String(payload?.truncation || "").trim().toLowerCase();
    const textFormatType = String(payload?.text?.format?.type || "").trim().toLowerCase();

    addExternalJournal("request.start", `${isContinuation ? "continue" : "start"} model=${model} tools=${toolsCount} reasoning=${reasoningEffort}`, {
      turn_id: turnId,
      request_id: requestId,
      status: "start",
      meta: {
        stream: true,
        model,
        continuation: isContinuation,
        tools_count: toolsCount,
        continuation_has_tools: continuationHasTools,
        reasoning_effort: reasoningEffort,
        reasoning_summary: reasoningSummary || null,
        service_tier_requested: requestedServiceTier,
        low_bandwidth_mode: lowBandwidthMode,
        truncation: truncationMode || null,
        include_count: includeItems.length,
        include: includeItems.slice(0, 4),
        metadata_keys: metadataKeys.slice(0, 16),
        metadata_count: metadataKeys.length,
        prompt_cache: hasPromptCache,
        safety_identifier: hasSafetyIdentifier,
        text_format: textFormatType || null,
        timeout_ms: timeoutEnabled ? timeoutMs : "unbounded",
      },
    });

    const controller = new AbortController();
    const abortFn = (reason = "user_cancel") => {
      try {
        controller.abort(reason);
      } catch {}
    };
    setActiveAbort(abortFn);
    const timer = timeoutEnabled
      ? setTimeout(() => controller.abort("timeout"), timeoutMs)
      : null;
    let res = null;
    try {
    try {
      const requestPayload = { ...payload, stream: true };
      if (lowBandwidthMode) {
        requestPayload.stream_options = { include_obfuscation: false };
      }
      res = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
          Authorization: `Bearer ${app.ai.apiKey}`,
        },
        body: JSON.stringify(requestPayload),
        signal: controller.signal,
      });
    } catch (err) {
      if (timer) clearTimeout(timer);
      if (isAbortError(err)) {
        if (timeoutEnabled && isTimeoutAbort(controller, err)) {
          const e = new Error(`stream timeout after ${timeoutMs}ms`);
          e.timeout = true;
          throw e;
        }
        const e = new Error("request canceled by user");
        e.canceled = true;
        throw e;
      }
      throw new Error(`stream transport failed: ${String(err?.message || err)}`);
    }

    const headerRequestId = String(res.headers.get("x-request-id") || "");
    const reqId = headerRequestId || requestId;
    const ct = String(res.headers.get("content-type") || "").toLowerCase();

    if (!res.ok) {
      if (timer) clearTimeout(timer);
      const body = await res.text();
      const ms = Date.now() - startedAt;
      const shortBody = compactText(body);
      addExternalJournal("request.error", `HTTP ${res.status} /v1/responses (stream)`, {
        level: "error",
        status: "error",
        turn_id: turnId,
        request_id: reqId,
        duration_ms: ms,
        meta: { status: res.status, body: shortBody },
      });
      if (res.status === 401 || res.status === 403) {
        disconnectOpenAi();
        const e = new Error("openai unauthorized");
        e.no_fallback = true;
        throw e;
      }
      const e = new Error(`openai ${res.status}: ${shortBody || "unknown error"}`);
      e.no_fallback = true;
      throw e;
    }

    if (!ct.includes("text/event-stream") || !res.body) {
      if (timer) clearTimeout(timer);
      let parsed = null;
      try {
        parsed = await res.json();
      } catch {
        const body = await res.text();
        throw new Error(`stream expected event-stream, got: ${ct || "unknown"} (${String(body).slice(0, 240)})`);
      }
      const ms = Date.now() - startedAt;
      const outCount = Array.isArray(parsed?.output) ? parsed.output.length : 0;
      addExternalJournal("request.complete", `HTTP 200 /v1/responses (stream->json), output=${outCount}`, {
        turn_id: turnId,
        request_id: reqId,
        response_id: String(parsed?.id || ""),
        duration_ms: ms,
        status: "completed",
        meta: {
          output_count: outCount,
          model,
          stream_fallback: "content_type",
          service_tier_requested: requestedServiceTier,
          service_tier_actual: String(parsed?.service_tier || "") || null,
          low_bandwidth_mode: lowBandwidthMode,
          include_count: includeItems.length,
          metadata_count: metadataKeys.length,
          prompt_cache: hasPromptCache,
          safety_identifier: hasSafetyIdentifier,
          truncation: truncationMode || null,
          text_format: textFormatType || null,
          timeout_ms: timeoutEnabled ? timeoutMs : "unbounded",
        },
      });
      app.ai.serviceTierActual = String(parsed?.service_tier || "");
      if (parsed?.conversation) {
        const convId = typeof parsed.conversation === "string"
          ? parsed.conversation
          : String(parsed?.conversation?.id || "");
        if (convId) app.ai.conversationId = convId;
      }
      if (parsed?.id) app.ai.lastCompletedResponseId = String(parsed.id);
      parsed.__request_id = reqId;
      app.ai.currentRequestId = reqId;
      return parsed;
    }

    const decoder = new TextDecoder("utf-8");
    const reader = res.body.getReader();
    let buf = "";
    let completed = null;
    let failed = null;
    let incomplete = null;
    let responseId = "";
    let deltaCounter = 0;
    let deltaChars = 0;

    try {
      while (true) {
        throwIfCanceled();
        const step = await reader.read();
        if (step.done) break;
        throwIfCanceled();
        buf += decoder.decode(step.value, { stream: true });
        buf = buf.replace(/\r\n/g, "\n");

        let sepIdx = buf.indexOf("\n\n");
        while (sepIdx >= 0) {
          throwIfCanceled();
          const rawEvent = buf.slice(0, sepIdx);
          buf = buf.slice(sepIdx + 2);
          sepIdx = buf.indexOf("\n\n");
          const parsedEvent = parseSseEvent(rawEvent);
          if (!parsedEvent) continue;
          const eventName = parsedEvent.event || String(parsedEvent.data?.type || "");
          const eventData = parsedEvent.data || {};
          if (eventData?.response?.id) responseId = String(eventData.response.id);
          if (eventData?.id) responseId = String(eventData.id);

          if (typeof options?.onEvent === "function") {
            options.onEvent(eventName, { ...eventData, __request_id: reqId });
          }

          if (eventName === "response.output_text.delta") {
            const delta = String(eventData?.delta || "");
            if (delta) {
              deltaCounter += 1;
              deltaChars += delta.length;
              if (typeof options?.onDelta === "function") options.onDelta(delta);
            }
          } else if (eventName === "response.output_item.added") {
            addExternalJournal("stream.event", "response.output_item.added", {
              turn_id: turnId,
              request_id: reqId,
              response_id: responseId,
              status: "streaming",
              meta: compactForTool(eventData?.item || eventData),
            });
          } else if (eventName === "response.completed") {
            completed = eventData?.response || eventData;
            if (!responseId && completed?.id) responseId = String(completed.id);
          } else if (eventName === "response.incomplete") {
            incomplete = eventData?.response || eventData;
            if (!responseId && incomplete?.id) responseId = String(incomplete.id);
          } else if (eventName === "response.failed") {
            failed = eventData?.error || eventData;
          }
        }
      }
      if (buf.trim()) {
        const parsedEvent = parseSseEvent(buf);
        if (parsedEvent) {
          const eventName = parsedEvent.event || String(parsedEvent.data?.type || "");
          const eventData = parsedEvent.data || {};
          if (eventName === "response.completed") {
            completed = eventData?.response || eventData;
            if (!responseId && completed?.id) responseId = String(completed.id);
          } else if (eventName === "response.incomplete") {
            incomplete = eventData?.response || eventData;
            if (!responseId && incomplete?.id) responseId = String(incomplete.id);
          } else if (eventName === "response.failed") {
            failed = eventData?.error || eventData;
          }
        }
      }
    } finally {
      if (timer) clearTimeout(timer);
    }

    if (failed) {
      const ms = Date.now() - startedAt;
      addExternalJournal("request.error", "response.failed", {
        level: "error",
        status: "error",
        turn_id: turnId,
        request_id: reqId,
        response_id: responseId,
        duration_ms: ms,
        meta: compactForTool(failed),
      });
      throw new Error(`openai stream failed: ${String(failed?.message || failed || "unknown")}`);
    }
    if (!completed && incomplete) completed = incomplete;
    if (!completed) throw new Error("openai stream ended without response.completed");

    const ms = Date.now() - startedAt;
    const outCount = Array.isArray(completed?.output) ? completed.output.length : 0;
    const responseStatus = String(completed?.status || "completed").trim().toLowerCase() || "completed";
    const actualServiceTier = String(completed?.service_tier || "");
    app.ai.serviceTierActual = actualServiceTier;
    if (completed?.conversation) {
      const convId = typeof completed.conversation === "string"
        ? completed.conversation
        : String(completed?.conversation?.id || "");
      if (convId) app.ai.conversationId = convId;
    }
    if (completed?.id) app.ai.lastCompletedResponseId = String(completed.id);
    addExternalJournal("request.complete", `HTTP 200 /v1/responses (stream), output=${outCount}`, {
      turn_id: turnId,
      request_id: reqId,
      response_id: responseId || String(completed?.id || ""),
      duration_ms: ms,
      status: "completed",
      meta: {
        output_count: outCount,
        model,
        stream: true,
        response_status: responseStatus,
        delta_count: deltaCounter,
        delta_chars: deltaChars,
        service_tier_requested: requestedServiceTier,
        service_tier_actual: actualServiceTier || null,
        low_bandwidth_mode: lowBandwidthMode,
        include_count: includeItems.length,
        metadata_count: metadataKeys.length,
        prompt_cache: hasPromptCache,
        safety_identifier: hasSafetyIdentifier,
        truncation: truncationMode || null,
        text_format: textFormatType || null,
        timeout_ms: timeoutEnabled ? timeoutMs : "unbounded",
      },
    });
    if (responseStatus === "incomplete") {
      addExternalJournal("request.incomplete", "response finished with status=incomplete (continuation may be required)", {
        level: "warning",
        status: "error",
        turn_id: turnId,
        request_id: reqId,
        response_id: responseId || String(completed?.id || ""),
      });
    }

    const hasWebSearch = Array.isArray(completed?.output) && completed.output.some((item) => String(item?.type || "").includes("web_search"));
    if (hasWebSearch) {
      addExternalJournal("web.search", "OpenAI executed web_search tool", {
        turn_id: turnId,
        request_id: reqId,
        response_id: responseId || String(completed?.id || ""),
        status: "completed",
      });
    }

    completed.__request_id = reqId;
    app.ai.currentRequestId = reqId;
    return completed;
  } catch (err) {
    if (timeoutEnabled && isTimeoutAbort(controller, err)) {
      addExternalJournal("request.timeout", `stream timeout after ${timeoutMs}ms`, {
        level: "warning",
        status: "error",
        turn_id: turnId,
        request_id: requestId,
        response_id: String(app.ai.streamResponseId || ""),
        meta: { timeout_ms: timeoutMs, model },
      });
      const timeoutErr = err?.timeout
        ? err
        : Object.assign(new Error(`stream timeout after ${timeoutMs}ms`), { timeout: true });
      throw timeoutErr;
    }
    const canceled = Boolean(err?.canceled || isAbortError(err));
    if (canceled) {
      const cancelErr = err?.canceled
        ? err
        : Object.assign(new Error("request canceled by user"), { canceled: true });
      addExternalJournal("request.cancelled", "request canceled by user", {
        level: "warning",
        status: "error",
        turn_id: turnId,
        request_id: requestId,
        response_id: String(app.ai.streamResponseId || ""),
      });
      throw cancelErr;
    }
    throw err;
  } finally {
    clearActiveAbort(abortFn);
  }
  }

  return { callOpenAiResponsesStream };
}
