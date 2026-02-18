export class AgentRuntimeJsonTransportModule {
  constructor(ctx) {
    Object.assign(this, createAgentRuntimeJsonTransportInternal(ctx));
  }
}

function createAgentRuntimeJsonTransportInternal(ctx) {
  const { app, deps } = ctx || {};
  if (!app) throw new Error("AgentRuntimeJsonTransportModule requires app");
  if (!deps) throw new Error("AgentRuntimeJsonTransportModule requires deps");

  const {
    addExternalJournal,
    disconnectOpenAi,
    uid,
    fetchFn,
  } = deps;

  if (typeof addExternalJournal !== "function") throw new Error("AgentRuntimeJsonTransportModule requires deps.addExternalJournal()");
  if (typeof disconnectOpenAi !== "function") throw new Error("AgentRuntimeJsonTransportModule requires deps.disconnectOpenAi()");
  if (typeof uid !== "function") throw new Error("AgentRuntimeJsonTransportModule requires deps.uid()");

  const fetch = fetchFn || ((...args) => globalThis.fetch(...args));
  const DEFAULT_BG_POLL_MS = 1300;
  const DEFAULT_BG_TIMEOUT_MS = 20 * 60 * 1000;

  function compactText(text, maxLen = 800) {
    return String(text || "").replace(/\s+/g, " ").trim().slice(0, maxLen);
  }

  function buildIncludeQuery(includeRaw) {
    const include = Array.isArray(includeRaw)
      ? includeRaw.map((x) => String(x || "").trim()).filter(Boolean)
      : [];
    if (!include.length) return "";
    const qs = include.map((item) => `include=${encodeURIComponent(item)}`).join("&");
    return qs ? `?${qs}` : "";
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

  async function sleepAbortable(ms, signal) {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        cleanup();
        resolve();
      }, Math.max(10, Number(ms) || 10));
      const onAbort = () => {
        cleanup();
        const e = new Error("request aborted");
        e.name = "AbortError";
        reject(e);
      };
      const cleanup = () => {
        clearTimeout(timer);
        signal?.removeEventListener?.("abort", onAbort);
      };
      if (signal?.aborted) return onAbort();
      signal?.addEventListener?.("abort", onAbort, { once: true });
    });
  }

  async function cancelOpenAiResponse(responseIdRaw, options = {}) {
    const responseId = String(responseIdRaw || "").trim();
    if (!responseId) {
      return {
        ok: false,
        skipped: true,
        status: 0,
        reason: "missing_response_id",
      };
    }
    const turnId = String(options?.turnId || app.ai.turnId || "");
    const requestId = String(options?.requestId || app.ai.currentRequestId || "");
    const startedAt = Date.now();

    try {
      const res = await fetch(`https://api.openai.com/v1/responses/${encodeURIComponent(responseId)}/cancel`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${app.ai.apiKey}`,
        },
        keepalive: options?.keepalive === true,
      });
      const ms = Date.now() - startedAt;
      if (res.status === 401 || res.status === 403) {
        disconnectOpenAi();
        const e = new Error("openai unauthorized");
        e.no_fallback = true;
        throw e;
      }
      if (res.status === 404) {
        addExternalJournal("background.cancel.miss", `cancel unavailable ${responseId}`, {
          level: "info",
          status: "completed",
          turn_id: turnId,
          request_id: requestId,
          response_id: responseId,
          duration_ms: ms,
          meta: {
            status: res.status,
            reason: "response_not_cancelable_or_already_finished",
            expected: true,
          },
        });
        return {
          ok: false,
          status: res.status,
          expectedMiss: true,
          reason: "response_not_cancelable_or_already_finished",
        };
      }
      if (!res.ok) {
        const body = compactText(await res.text());
        addExternalJournal("background.cancel.error", `cancel failed ${res.status}`, {
          level: "warning",
          status: "error",
          turn_id: turnId,
          request_id: requestId,
          response_id: responseId,
          duration_ms: ms,
          meta: { status: res.status, body },
        });
        return {
          ok: false,
          status: res.status,
          reason: "http_error",
        };
      }

      addExternalJournal("background.cancel", `cancel requested ${responseId}`, {
        status: "completed",
        turn_id: turnId,
        request_id: requestId,
        response_id: responseId,
        duration_ms: ms,
        meta: { status: res.status },
      });
      return {
        ok: true,
        status: res.status,
      };
    } catch (err) {
      if (err?.no_fallback) throw err;
      addExternalJournal("background.cancel.error", compactText(err?.message || err), {
        level: "warning",
        status: "error",
        turn_id: turnId,
        request_id: requestId,
        response_id: responseId,
      });
      return {
        ok: false,
        status: 0,
        reason: "transport_error",
      };
    }
  }

  async function compactOpenAiResponse(responseIdRaw, options = {}) {
    const responseId = String(responseIdRaw || "").trim();
    if (!responseId) return null;
    const turnId = String(options?.turnId || app.ai.turnId || "");
    const requestId = String(options?.requestId || app.ai.currentRequestId || "");
    const model = String(options?.model || app?.ai?.model || "").trim();
    const startedAt = Date.now();
    const callCompact = async (mode = "new") => {
      if (mode === "new") {
        const body = {
          previous_response_id: responseId,
        };
        if (model) body.model = model;
        return fetch("https://api.openai.com/v1/responses/compact", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${app.ai.apiKey}`,
          },
          body: JSON.stringify(body),
        });
      }
      return fetch(`https://api.openai.com/v1/responses/${encodeURIComponent(responseId)}/compact`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${app.ai.apiKey}`,
        },
        body: "{}",
      });
    };
    try {
      let endpointMode = "new";
      let res = await callCompact(endpointMode);
      if (!res.ok && (res.status === 400 || res.status === 404 || res.status === 405 || res.status === 422)) {
        endpointMode = "legacy";
        res = await callCompact(endpointMode);
      }
      const ms = Date.now() - startedAt;
      if (res.status === 401 || res.status === 403) {
        disconnectOpenAi();
        const e = new Error("openai unauthorized");
        e.no_fallback = true;
        throw e;
      }
      if (!res.ok) {
        const body = compactText(await res.text());
        addExternalJournal("responses.compact.error", `HTTP ${res.status} /compact`, {
          level: "warning",
          status: "error",
          turn_id: turnId,
          request_id: requestId,
          response_id: responseId,
          duration_ms: ms,
          meta: { status: res.status, body, endpoint: endpointMode, model: model || null },
        });
        return null;
      }
      const parsed = await res.json();
      addExternalJournal("responses.compact", "context compacted", {
        status: "completed",
        turn_id: turnId,
        request_id: requestId,
        response_id: String(parsed?.id || responseId),
        duration_ms: ms,
        meta: { endpoint: endpointMode, model: model || null },
      });
      return parsed;
    } catch (err) {
      if (err?.no_fallback) throw err;
      addExternalJournal("responses.compact.error", compactText(err?.message || err), {
        level: "warning",
        status: "error",
        turn_id: turnId,
        request_id: requestId,
        response_id: responseId,
      });
      return null;
    }
  }

  async function waitForBackgroundCompletion(responseId, payload, options, requestId, abortController) {
    const turnId = String(options?.turnId || app.ai.turnId || "");
    const pollMs = Math.max(250, Number(options?.backgroundPollMs || DEFAULT_BG_POLL_MS));
    const timeoutMs = Math.max(15000, Number(options?.backgroundTimeoutMs || DEFAULT_BG_TIMEOUT_MS));
    const startedAt = Date.now();
    let pollCount = 0;
    const includeQuery = buildIncludeQuery(payload?.include);

    while (true) {
      if (app.ai.cancelRequested || app.ai.taskState === "cancel_requested" || app.ai.taskState === "cancelled") {
        await cancelOpenAiResponse(responseId, { turnId, requestId });
        if (typeof options?.onEvent === "function") {
          options.onEvent("background.response.cancelled", { response_id: responseId, __request_id: requestId });
        }
        const e = new Error("request canceled by user");
        e.canceled = true;
        throw e;
      }

      if ((Date.now() - startedAt) > timeoutMs) {
        const e = new Error("background response timeout");
        e.no_fallback = true;
        throw e;
      }

      await sleepAbortable(pollMs, abortController.signal);
      pollCount += 1;

      let res;
      try {
        res = await fetch(`https://api.openai.com/v1/responses/${encodeURIComponent(responseId)}${includeQuery}`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${app.ai.apiKey}`,
          },
          signal: abortController.signal,
        });
      } catch (err) {
        if (isAbortError(err)) {
          const e = new Error("request canceled by user");
          e.canceled = true;
          throw e;
        }
        throw err;
      }

      if (res.status === 401 || res.status === 403) {
        disconnectOpenAi();
        const e = new Error("openai unauthorized");
        e.no_fallback = true;
        throw e;
      }
      if (!res.ok) {
        const body = compactText(await res.text());
        const e = new Error(`openai ${res.status}: ${body || "background poll failed"}`);
        e.no_fallback = true;
        throw e;
      }

      const parsed = await res.json();
      const status = String(parsed?.status || "").trim().toLowerCase();
      if (typeof options?.onEvent === "function") {
        options.onEvent("background.response.polled", {
          response_id: responseId,
          poll_count: pollCount,
          status,
          __request_id: requestId,
        });
      }

      if (status === "completed") {
        if (typeof options?.onEvent === "function") {
          options.onEvent("background.response.completed", { response_id: responseId, poll_count: pollCount, __request_id: requestId });
        }
        return parsed;
      }
      if (status === "failed") {
        if (typeof options?.onEvent === "function") {
          options.onEvent("background.response.failed", { response_id: responseId, poll_count: pollCount, __request_id: requestId });
        }
        const errText = compactText(parsed?.error?.message || parsed?.error || "background response failed");
        const e = new Error(errText || "background response failed");
        e.no_fallback = true;
        throw e;
      }
      if (status === "cancelled" || status === "canceled") {
        if (typeof options?.onEvent === "function") {
          options.onEvent("background.response.cancelled", { response_id: responseId, poll_count: pollCount, __request_id: requestId });
        }
        const e = new Error("request canceled by user");
        e.canceled = true;
        throw e;
      }
    }
  }

  async function callOpenAiResponsesJson(payload, options = {}) {
    const startedAt = Date.now();
    const isContinuation = Boolean(payload?.previous_response_id);
    const model = String(payload?.model || app.ai.model || "");
    const toolsCount = Array.isArray(payload?.tools) ? payload.tools.length : 0;
    const reasoningEffort = String(payload?.reasoning?.effort || "medium");
    const reasoningSummary = String(payload?.reasoning?.summary || "");
    const continuationHasTools = isContinuation ? toolsCount > 0 : false;
    const requestId = uid();
    const turnId = String(options?.turnId || app.ai.turnId || "");
    const requestedServiceTier = String(payload?.service_tier || "default");
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
    app.ai.currentRequestId = requestId;

    const abortController = new AbortController();
    const abortFn = (reason = "user_cancel") => {
      try {
        abortController.abort(reason);
      } catch {}
    };
    setActiveAbort(abortFn);

    addExternalJournal("request.start", `${isContinuation ? "continue" : "start"} model=${model} tools=${toolsCount} reasoning=${reasoningEffort}`, {
      turn_id: turnId,
      request_id: requestId,
      status: "start",
      meta: {
        stream: false,
        model,
        continuation: isContinuation,
        tools_count: toolsCount,
        continuation_has_tools: continuationHasTools,
        reasoning_effort: reasoningEffort,
        reasoning_summary: reasoningSummary || null,
        background: Boolean(payload?.background),
        service_tier_requested: requestedServiceTier,
        truncation: truncationMode || null,
        include_count: includeItems.length,
        include: includeItems.slice(0, 4),
        metadata_keys: metadataKeys.slice(0, 16),
        metadata_count: metadataKeys.length,
        prompt_cache: hasPromptCache,
        safety_identifier: hasSafetyIdentifier,
        text_format: textFormatType || null,
      },
    });

    let parsed = null;
    try {
      let res;
      try {
        res = await fetch("https://api.openai.com/v1/responses", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${app.ai.apiKey}`,
          },
          body: JSON.stringify(payload),
          signal: abortController.signal,
        });
      } catch (err) {
        if (isAbortError(err)) {
          const e = new Error("request canceled by user");
          e.canceled = true;
          throw e;
        }
        throw err;
      }

      if (!res.ok) {
        const body = await res.text();
        const ms = Date.now() - startedAt;
        const shortBody = compactText(body);
        addExternalJournal("request.error", `HTTP ${res.status} /v1/responses`, {
          level: "error",
          status: "error",
          turn_id: turnId,
          request_id: requestId,
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

      parsed = await res.json();
      let responseId = String(parsed?.id || "");
      app.ai.streamResponseId = responseId;

      if (payload?.background === true && responseId) {
        app.ai.backgroundResponseId = responseId;
        app.ai.backgroundActive = true;
        app.ai.backgroundPollCount = 0;
        if (typeof options?.onEvent === "function") {
          options.onEvent("background.response.started", {
            response_id: responseId,
            status: String(parsed?.status || ""),
            __request_id: requestId,
          });
        }
        parsed = await waitForBackgroundCompletion(responseId, payload, options, requestId, abortController);
        responseId = String(parsed?.id || responseId);
        app.ai.backgroundActive = false;
      }

      const ms = Date.now() - startedAt;
      const outCount = Array.isArray(parsed?.output) ? parsed.output.length : 0;
      const responseIdFinal = String(parsed?.id || responseId || "");
      const actualServiceTier = String(parsed?.service_tier || "");
      app.ai.serviceTierActual = actualServiceTier;
      if (responseIdFinal) app.ai.lastCompletedResponseId = responseIdFinal;
      if (parsed?.conversation) {
        const convId = typeof parsed.conversation === "string"
          ? parsed.conversation
          : String(parsed?.conversation?.id || "");
        if (convId) app.ai.conversationId = convId;
      }

      addExternalJournal("request.complete", `HTTP 200 /v1/responses (json), output=${outCount}`, {
        turn_id: turnId,
        request_id: requestId,
        response_id: responseIdFinal,
        duration_ms: ms,
        status: "completed",
        meta: {
          output_count: outCount,
          model,
          background: Boolean(payload?.background),
          service_tier_requested: requestedServiceTier,
          service_tier_actual: actualServiceTier || null,
          include_count: includeItems.length,
          metadata_count: metadataKeys.length,
          prompt_cache: hasPromptCache,
          safety_identifier: hasSafetyIdentifier,
          truncation: truncationMode || null,
          text_format: textFormatType || null,
        },
      });

      const hasWebSearch = Array.isArray(parsed?.output) && parsed.output.some((item) => String(item?.type || "").includes("web_search"));
      if (hasWebSearch) {
        addExternalJournal("web.search", "OpenAI выполнил web_search tool", {
          turn_id: turnId,
          request_id: requestId,
          response_id: responseIdFinal,
          status: "completed",
        });
      }

      if (typeof options?.onEvent === "function") {
        options.onEvent("response.completed", { response: parsed, __request_id: requestId });
      }
      parsed.__request_id = requestId;
      app.ai.currentRequestId = requestId;
      return parsed;
    } catch (err) {
      if (err?.canceled) {
        addExternalJournal("request.cancelled", "request canceled by user", {
          level: "warning",
          status: "error",
          turn_id: turnId,
          request_id: requestId,
          response_id: String(app.ai.backgroundResponseId || app.ai.streamResponseId || ""),
        });
      }
      throw err;
    } finally {
      app.ai.backgroundActive = false;
      clearActiveAbort(abortFn);
    }
  }

  return {
    callOpenAiResponsesJson,
    cancelOpenAiResponse,
    compactOpenAiResponse,
  };
}
