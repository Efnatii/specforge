import assert from "node:assert/strict";
import { AgentRuntimeModule } from "../src/modules/agent/runtime/index.js";
import { AgentAttachmentModule } from "../src/modules/agent/tools/attachment.js";
import { AgentRuntimePolicyModule } from "../src/modules/agent/runtime/policy.js";
// Run: node --experimental-default-type=module scripts/smoke-responses.mjs

function buildConfig() {
  return {
    CHAT_CONTEXT_RECENT_MESSAGES: 8,
    CHAT_CONTEXT_MAX_CHARS: 8000,
    CHAT_CONTEXT_MESSAGE_MAX_CHARS: 1200,
    CHAT_SUMMARY_CHUNK_SIZE: 10,
    AI_CONTINUE_PROMPT_RE: /continue|продолж/i,
    AI_SHORT_ACK_PROMPT_RE: /ok|thanks|спасибо/i,
    AI_MUTATION_INTENT_RE: /edit|change|update|измени|обнов/i,
    AI_ACTIONABLE_VERB_RE: /create|set|find|удали|создай|измени/i,
    AI_ANALYSIS_INTENT_RE: /research|audit|review|analy|debug|root cause|исслед|разбор|проанализ|анализ|аудит|ревью|расслед/i,
    AI_TOOL_NAME_HINTS: [],
    AI_INCOMPLETE_RESPONSE_RE: /to be continued|продолжение/i,
    AGENT_MAX_FORCED_RETRIES: 1,
    AGENT_MAX_TOOL_ROUNDS: 3,
  };
}

function defaultOptions() {
  return {
    webSearch: true,
    webSearchCountry: "US",
    webSearchContextSize: "high",
    reasoning: true,
    taskProfile: "auto",
    noReasoningProfile: "standard",
    reasoningEffort: "medium",
    reasoningDepth: "balanced",
    reasoningVerify: "basic",
    reasoningSummary: "auto",
    reasoningClarify: "never",
    riskyActionsMode: "confirm",
    brevityMode: "normal",
    styleMode: "clean",
    toolsMode: "auto",
    citationsMode: "off",
    serviceTier: "standard",
    reasoningMaxTokens: 0,
    compatCache: true,
    promptCacheKeyMode: "auto",
    promptCacheKey: "",
    promptCacheRetentionMode: "auto",
    promptCacheRetention: "default",
    safetyIdentifierMode: "auto",
    safetyIdentifier: "",
    safeTruncationAuto: false,
    backgroundMode: "auto",
    backgroundTokenThreshold: 12000,
    compactMode: "off",
    compactThresholdTokens: 90000,
    compactTurnThreshold: 45,
    useConversationState: false,
    structuredSpecOutput: false,
    metadataEnabled: true,
    metadataPromptVersionMode: "auto",
    metadataPromptVersion: "v1",
    metadataFrontendBuildMode: "auto",
    metadataFrontendBuild: "",
    includeSourcesMode: "off",
    lowBandwidthMode: false,
    executionLimitsMode: "off",
  };
}

function createRuntime({ options = {}, runtimeProfile = null, fetchFn, logsSink, executeAgentTool } = {}) {
  const logs = logsSink || [];
  let uidCounter = 0;
  const app = {
    ai: {
      model: "gpt-5.2-codex",
      connected: true,
      apiKey: "sk-test",
      sending: false,
      cancelRequested: false,
      taskState: "idle",
      streaming: false,
      turnId: "turn-1",
      turnCounter: 1,
      chatJournal: [],
      chatSummary: "",
      runtimeProfile,
      options: { ...defaultOptions(), ...options },
      attachments: [],
      fileSearch: { vectorStoreId: "", attachmentsSignature: "", syncedAt: 0 },
      streamResponseId: "",
      backgroundResponseId: "",
      backgroundActive: false,
      backgroundPollCount: 0,
      pendingCancelResponseIds: [],
      cancelApiRequestedFor: "",
      activeRequestAbort: null,
      currentRequestId: "",
      conversationId: "",
      serviceTierActual: "",
      lastCompletedResponseId: "",
      lastCompactedResponseId: "",
      lastCompactionTs: 0,
      lastInputTokens: 0,
      lastOutputTokens: 0,
      lastTotalTokens: 0,
      pendingQuestion: null,
      lastAssemblyId: "",
    },
    state: {
      assemblies: [],
      settings: {
        orderNumber: "",
        requestNumber: "",
        changeDate: "",
        version: "",
        vatRate: 0.2,
        totalMode: "withDiscount",
      },
    },
    ui: {},
  };

  const deps = {
    addChangesJournal: () => {},
    activeSheet: () => ({ id: "sheet-1", name: "Sheet1", rows: [] }),
    selectionText: () => "",
    toA1: () => "A1",
    colToName: () => "A",
    agentCellValueText: () => "",
    currentAiModelMeta: () => ({ id: app.ai.model }),
    executeAgentTool: executeAgentTool || (async () => ({ ok: true, applied: 0, warnings: [] })),
    addExternalJournal: (event, message, meta = {}) => {
      logs.push({ event, message, meta });
    },
    addTableJournal: () => {},
    compactForTool: (v) => {
      try {
        return JSON.stringify(v).slice(0, 120);
      } catch {
        return String(v ?? "");
      }
    },
    disconnectOpenAi: () => {
      app.ai.connected = false;
    },
    uid: () => `req-${++uidCounter}`,
    num: (v, fallback = 0) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : fallback;
    },
    summarizeChatChunk: () => "",
    mergeChatSummary: (a, b) => `${a || ""}${b || ""}`,
    fetchFn:
      fetchFn
      || (async () =>
        new Response(
          JSON.stringify({ id: "noop", status: "completed", output: [], output_text: "ok" }),
          { status: 200, headers: { "content-type": "application/json" } },
        )),
    parseJsonSafe: (text, fallback = null) => {
      try {
        return JSON.parse(text);
      } catch {
        return fallback;
      }
    },
  };

  const runtime = new AgentRuntimeModule({ app, config: buildConfig(), deps });
  runtime._toolSpecModule.agentToolsSpec = () => [{ type: "web_search" }, { type: "file_search" }];
  return { runtime, app, logs };
}

function hasFunctionCallOutput(input) {
  const arr = Array.isArray(input) ? input : [];
  return arr.some((item) => item && item.type === "function_call_output");
}

async function main() {
  {
    const { runtime } = createRuntime();
    const payload = runtime.buildAgentResponsesPayload({
      model: "gpt-5.2-codex",
      instructions: "sys",
      input: [{ role: "user", content: [{ type: "input_text", text: "hi" }] }],
      turnId: "t1",
      taskText: "hello",
      allowBackground: true,
    });
    assert.equal(payload.background, undefined);
  }

  {
    const { runtime } = createRuntime();
    const task = "исследуй репозиторий во вложении и сделай разбор";
    const normalized = runtime.normalizeAgentPrompt(task);
    assert.equal(runtime.isActionableAgentPrompt(task), true);
    assert.equal(Boolean(normalized?.actionable), true);
  }

  {
    const { runtime, app } = createRuntime({
      options: {
        reasoning: false,
        noReasoningProfile: "sources",
      },
    });
    const payload = runtime.buildAgentResponsesPayload({
      model: app.ai.model,
      instructions: "sys",
      input: [],
      turnId: "t-no-reasoning",
      taskText: "find sources",
      allowBackground: true,
    });
    assert.equal(payload.reasoning, undefined);
    assert.equal(String(payload.metadata?.profile_mode || ""), "no_reasoning");
    assert.equal(String(payload.metadata?.profile_selected || ""), "sources");
    const sys = runtime.agentSystemPrompt();
    assert.ok(String(sys).includes("MODE=no_reasoning; SELECTED=sources"));
  }

  {
    const { runtime, app } = createRuntime({
      options: {
        reasoning: false,
        noReasoningProfile: "concise",
        compatCache: true,
      },
      runtimeProfile: {
        mode: "balanced",
        selected: "price_search",
        overrides: { compatCache: false },
      },
    });
    const payload = runtime.buildAgentResponsesPayload({
      model: app.ai.model,
      instructions: "sys",
      input: [],
      turnId: "t-no-reasoning-stale-runtime",
      taskText: "short answer",
      allowBackground: true,
    });
    assert.equal(String(payload.metadata?.profile_mode || ""), "no_reasoning");
    assert.equal(String(payload.metadata?.profile_selected || ""), "concise");
    assert.equal(String(payload.metadata?.compat_cache || ""), "off");
    const sys = runtime.agentSystemPrompt();
    assert.ok(String(sys).includes("MODE=no_reasoning; SELECTED=concise"));
  }

  {
    const { runtime, app } = createRuntime({
      runtimeProfile: { selected: "price_search", overrides: {} },
      options: { promptCacheKeyMode: "off", promptCacheRetentionMode: "off", safetyIdentifierMode: "off" },
    });
    const payload = runtime.buildAgentResponsesPayload({
      model: app.ai.model,
      instructions: "sys",
      input: [],
      turnId: "t-profile-price",
      taskText: "поиск цен",
      allowBackground: true,
    });
    assert.equal(payload.background, true);
    assert.equal(payload.prompt_cache_key, undefined);
    assert.equal(payload.prompt_cache_retention, undefined);
    assert.equal(payload.safety_identifier, undefined);
  }

  {
    const { runtime } = createRuntime({
      options: {
        promptCacheKeyMode: "auto",
        promptCacheRetentionMode: "auto",
        safetyIdentifierMode: "auto",
        metadataPromptVersionMode: "off",
        metadataFrontendBuildMode: "off",
      },
    });
    const payload = runtime.buildAgentResponsesPayload({
      model: "gpt-5.2-codex",
      instructions: "sys",
      input: [],
      turnId: "t-auto-modes",
      taskText: "normal",
      allowBackground: true,
    });
    assert.ok(String(payload.prompt_cache_key || "").startsWith("sf:"));
    assert.equal(String(payload.prompt_cache_retention || ""), "in-memory");
    assert.ok(String(payload.safety_identifier || "").startsWith("sf."));
    assert.equal(payload.metadata?.prompt_version, undefined);
    assert.equal(payload.metadata?.frontend_build, undefined);
  }

  {
    const { runtime, app } = createRuntime({
      runtimeProfile: { selected: "fast", overrides: {} },
      options: {
        promptCacheKeyMode: "auto",
        promptCacheRetentionMode: "auto",
        metadataPromptVersionMode: "auto",
        metadataEnabled: true,
      },
    });
    const payload = runtime.buildAgentResponsesPayload({
      model: app.ai.model,
      instructions: "sys",
      input: [],
      turnId: "t-auto-light",
      taskText: "quick draft",
      allowBackground: true,
    });
    assert.equal(payload.prompt_cache_retention, "in-memory");
    assert.equal(String(payload.metadata?.prompt_version || ""), "v1-fast");
  }

  {
    const { runtime, app } = createRuntime({
      runtimeProfile: { selected: "spec_strict", overrides: {} },
      options: {
        promptCacheKeyMode: "auto",
        promptCacheRetentionMode: "auto",
        metadataPromptVersionMode: "auto",
        metadataEnabled: true,
      },
    });
    const payload = runtime.buildAgentResponsesPayload({
      model: app.ai.model,
      instructions: "sys",
      input: [],
      turnId: "t-auto-heavy",
      taskText: "electrical spec",
      allowBackground: true,
    });
    assert.equal(payload.prompt_cache_retention, "24h");
    assert.equal(String(payload.metadata?.prompt_version || ""), "v1-spec_strict");
  }

  {
    const app = { ai: { options: { taskProfile: "auto" }, runtimeProfile: null } };
    const policy = new AgentRuntimePolicyModule({
      app,
      config: { AI_INCOMPLETE_RESPONSE_RE: /incomplete/i },
      deps: { num: (v, fallback = 0) => (Number.isFinite(Number(v)) ? Number(v) : fallback) },
    });
    const autoPrice = policy.resolveTaskProfile("нужен поиск цен по всем позициям", "auto");
    assert.equal(String(autoPrice?.selected || ""), "price_search");
    const autoSpec = policy.resolveTaskProfile("собери спецификацию щита ВРУ", "auto");
    assert.equal(String(autoSpec?.selected || ""), "spec_strict");
    const autoAudit = policy.inferAutoTaskProfile("требуется тотальное исследование репозитория и разбор причин");
    assert.equal(String(autoAudit?.selected || ""), "source_audit");
  }

  {
    const app = {
      ai: {
        options: {
          taskProfile: "auto",
          reasoning: false,
          noReasoningProfile: "quick",
        },
        runtimeProfile: null,
      },
    };
    const policy = new AgentRuntimePolicyModule({
      app,
      config: { AI_INCOMPLETE_RESPONSE_RE: /incomplete/i },
      deps: { num: (v, fallback = 0) => (Number.isFinite(Number(v)) ? Number(v) : fallback) },
    });
    const noReasoning = policy.resolveTaskProfile("quick answer", "auto");
    assert.equal(String(noReasoning?.mode || ""), "no_reasoning");
    assert.equal(String(noReasoning?.selected || ""), "quick");
    app.ai.options.noReasoningProfile = "custom";
    const noReasoningCustom = policy.resolveTaskProfile("manual profile", "auto");
    assert.equal(String(noReasoningCustom?.mode || ""), "no_reasoning_custom");
    assert.equal(String(noReasoningCustom?.selected || ""), "custom");
  }

  {
    const app = {
      ai: {
        options: {
          ...defaultOptions(),
          brevityMode: "normal",
          styleMode: "clean",
          outputMode: "bullets",
        },
        runtimeProfile: null,
      },
    };
    const policy = new AgentRuntimePolicyModule({
      app,
      config: { AI_INCOMPLETE_RESPONSE_RE: /incomplete|продолж/i },
      deps: { num: (v, fallback = 0) => (Number.isFinite(Number(v)) ? Number(v) : fallback) },
    });
    const shouldContinue = policy.shouldForceAgentContinuation(
      false,
      false,
      0,
      { totalToolCalls: 0, mutationCalls: 0, successfulMutations: 0, failedMutations: [] },
      "выполняю задачу",
    );
    assert.equal(shouldContinue, true);
    const longNormal = policy.sanitizeAgentOutputText("x".repeat(5000));
    assert.ok(longNormal.length >= 4900);
    app.ai.options.brevityMode = "short";
    const longShort = policy.sanitizeAgentOutputText("x".repeat(7000));
    assert.ok(longShort.length <= 4000);
  }

  {
    const { runtime, app } = createRuntime({ runtimeProfile: { selected: "bulk", overrides: {} } });
    const payload = runtime.buildAgentResponsesPayload({
      model: app.ai.model,
      instructions: "sys",
      input: [],
      turnId: "t1",
      taskText: "bulk pricing",
      allowBackground: true,
    });
    assert.equal(payload.background, true);
  }

  {
    const { runtime } = createRuntime({ options: { reasoningMaxTokens: 13000, executionLimitsMode: "on" } });
    const payload = runtime.buildAgentResponsesPayload({
      model: "gpt-5.2-codex",
      instructions: "sys",
      input: [],
      turnId: "t1",
      taskText: "normal",
      allowBackground: true,
    });
    assert.equal(payload.background, true);
  }

  {
    const { runtime } = createRuntime({ options: { reasoningMaxTokens: 13000, executionLimitsMode: "on" } });
    const payload = runtime.buildAgentResponsesPayload({
      model: "gpt-5.2-codex",
      instructions: "sys",
      input: [],
      turnId: "t1",
      taskText: "normal",
      allowBackground: false,
    });
    assert.equal(payload.background, undefined);
  }

  {
    const { runtime } = createRuntime({
      runtimeProfile: { selected: "research", overrides: {} },
      options: {
        promptCacheKeyMode: "custom",
        safeTruncationAuto: true,
        promptCacheKey: "specforge-cache-key",
        promptCacheRetentionMode: "custom",
        promptCacheRetention: "in_memory",
        safetyIdentifierMode: "custom",
        safetyIdentifier: "safety-123",
        structuredSpecOutput: true,
        includeSourcesMode: "auto",
        metadataEnabled: true,
        metadataFrontendBuildMode: "custom",
        metadataFrontendBuild: "build-42",
      },
    });
    const payload = runtime.buildAgentResponsesPayload({
      model: "gpt-5.2-codex",
      instructions: "sys",
      input: [],
      turnId: "t1",
      taskText: "research",
      allowBackground: true,
    });
    assert.equal(payload.truncation, "auto");
    assert.equal(payload.prompt_cache_key, "specforge-cache-key");
    assert.equal(payload.prompt_cache_retention, "in-memory");
    assert.equal(payload.safety_identifier, "safety-123");
    assert.equal(payload.text?.format?.type, "json_schema");
    assert.ok(
      Array.isArray(payload.include)
        && payload.include.includes("web_search_call.action.sources")
        && payload.include.includes("file_search_call.results"),
    );
    assert.ok(payload.metadata && typeof payload.metadata === "object");
    assert.ok(Object.keys(payload.metadata).length > 0 && Object.keys(payload.metadata).length <= 16);
  }

  {
    const calls = [];
    let pollCount = 0;
    const fetchFn = async (url, init = {}) => {
      calls.push({ url: String(url), method: String(init?.method || "GET") });
      const u = String(url);
      if (u === "https://api.openai.com/v1/responses" && String(init?.method || "GET") === "POST") {
        return new Response(JSON.stringify({ id: "resp-bg-1", status: "queued" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      if (u.startsWith("https://api.openai.com/v1/responses/resp-bg-1") && String(init?.method || "GET") === "GET") {
        pollCount += 1;
        const status = pollCount >= 2 ? "completed" : "in_progress";
        return new Response(
          JSON.stringify({
            id: "resp-bg-1",
            status,
            output: [],
            output_text: status === "completed" ? "done" : "",
            service_tier: "priority",
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      if (u === "https://api.openai.com/v1/responses/resp-bg-1/cancel" && String(init?.method || "GET") === "POST") {
        return new Response("", { status: 200 });
      }
      return new Response("not found", { status: 404 });
    };

    const events = [];
    const { runtime, app } = createRuntime({ fetchFn, runtimeProfile: { selected: "bulk", overrides: {} } });
    const payload = runtime.buildAgentResponsesPayload({
      model: app.ai.model,
      instructions: "sys",
      input: [],
      turnId: "t-bg",
      taskText: "bulk price",
      allowBackground: true,
    });
    assert.equal(payload.background, true);
    const res = await runtime.callOpenAiResponses(payload, {
      turnId: "t-bg",
      onEvent: (name, data) => events.push({ name, data }),
      backgroundPollMs: 5,
    });
    assert.equal(String(res?.status || ""), "completed");
    assert.ok(events.some((e) => e.name === "background.response.started"));
    assert.ok(events.some((e) => e.name === "background.response.polled"));
    assert.ok(events.some((e) => e.name === "background.response.completed"));
    assert.equal(app.ai.backgroundActive, false);
    const cancel = await runtime.cancelOpenAiResponse("resp-bg-1", { turnId: "t-bg" });
    assert.equal(Boolean(cancel?.ok), true);
    assert.ok(calls.some((c) => c.url.endsWith("/cancel")));
  }

  {
    const logs = [];
    const fetchFn = async (url, init = {}) => {
      const u = String(url || "");
      if (u !== "https://api.openai.com/v1/responses") {
        return new Response("not found", { status: 404 });
      }
      const body = JSON.parse(String(init?.body || "{}"));
      if (body?.stream === true) {
        const e = new Error("timeout while streaming");
        e.name = "AbortError";
        throw e;
      }
      return new Response(
        JSON.stringify({
          id: "resp-json-fallback",
          status: "completed",
          output: [],
          output_text: "fallback-ok",
          usage: { input_tokens: 20, output_tokens: 5, total_tokens: 25 },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    };
    const { runtime, app } = createRuntime({ fetchFn, logsSink: logs });
    app.ai.streaming = true;
    const payload = runtime.buildAgentResponsesPayload({
      model: app.ai.model,
      instructions: "sys",
      input: [],
      turnId: "t-timeout-fallback",
      taskText: "long reasoning task",
      allowBackground: false,
    });
    const out = await runtime.callOpenAiResponses(payload, { turnId: "t-timeout-fallback" });
    assert.equal(String(out?.output_text || ""), "fallback-ok");
    assert.ok(logs.some((x) => x.event === "request.timeout"));
    assert.ok(logs.some((x) => x.event === "openai.stream.fallback"));
  }

  {
    const postedBodies = [];
    const fetchFn = async (url, init = {}) => {
      const u = String(url);
      const m = String(init?.method || "GET");
      if (u === "https://api.openai.com/v1/responses" && m === "POST") {
        postedBodies.push(JSON.parse(String(init?.body || "{}")));
        return new Response(
          JSON.stringify({
            id: "resp-stream-lowbw",
            status: "completed",
            output: [],
            output_text: "ok",
            usage: { input_tokens: 12, output_tokens: 4, total_tokens: 16 },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      return new Response("not found", { status: 404 });
    };

    const { runtime, app } = createRuntime({
      fetchFn,
      options: { lowBandwidthMode: false },
      runtimeProfile: { selected: "price_search", overrides: { lowBandwidthMode: true } },
    });
    app.ai.streaming = true;
    const payload = runtime.buildAgentResponsesPayload({
      model: app.ai.model,
      instructions: "sys",
      input: [],
      turnId: "t-stream-lowbw",
      taskText: "price lookup",
      allowBackground: false,
    });
    const out = await runtime.callOpenAiResponses(payload, { turnId: "t-stream-lowbw" });
    assert.equal(String(out?.id || ""), "resp-stream-lowbw");
    assert.equal(postedBodies.length, 1);
    assert.equal(Boolean(postedBodies[0]?.stream), true);
    assert.equal(Boolean(postedBodies[0]?.stream_options?.include_obfuscation === false), true);
  }

  {
    const postedBodies = [];
    let postCounter = 0;
    const logs = [];
    const fetchFn = async (url, init = {}) => {
      const u = String(url);
      const m = String(init?.method || "GET");
      if (u === "https://api.openai.com/v1/responses" && m === "POST") {
        postCounter += 1;
        const body = JSON.parse(String(init?.body || "{}"));
        postedBodies.push(body);
        if (postCounter === 1) {
          return new Response("previous_response_id not found", {
            status: 400,
            headers: { "content-type": "text/plain" },
          });
        }
        return new Response(
          JSON.stringify({
            id: "resp-ok-2",
            status: "completed",
            output: [],
            output_text: "done",
            usage: { input_tokens: 42, output_tokens: 8, total_tokens: 50 },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      return new Response("not found", { status: 404 });
    };

    const { runtime } = createRuntime({ fetchFn, logsSink: logs });
    const out = await runtime.runOpenAiAgentTurn("Current user request:\ncheck", "check", {
      turnId: "t-fallback",
      previousResponseId: "resp-old-1",
      previousToolOutputs: [{ type: "function_call_output", call_id: "call-1", output: "ok" }],
    });

    assert.equal(String(out || ""), "done");
    assert.equal(postedBodies.length, 2);
    assert.equal(String(postedBodies[0]?.previous_response_id || ""), "resp-old-1");
    assert.ok(hasFunctionCallOutput(postedBodies[0]?.input));
    assert.equal(String(postedBodies[1]?.previous_response_id || ""), "");
    assert.equal(hasFunctionCallOutput(postedBodies[1]?.input), false);
    assert.ok(logs.some((x) => x.event === "conversation_state.fallback"));
  }

  {
    const postedBodies = [];
    let postCounter = 0;
    const logs = [];
    const fetchFn = async (url, init = {}) => {
      const u = String(url || "");
      const m = String(init?.method || "GET");
      if (u === "https://api.openai.com/v1/responses" && m === "POST") {
        postCounter += 1;
        const body = JSON.parse(String(init?.body || "{}"));
        postedBodies.push(body);
        if (postCounter === 1) {
          return new Response(
            JSON.stringify({
              id: "resp-guard-1",
              status: "completed",
              output: [],
              output_text: "ok",
              usage: { input_tokens: 14, output_tokens: 3, total_tokens: 17 },
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        }
        if (postCounter === 2) {
          return new Response(
            JSON.stringify({
              id: "resp-guard-2",
              status: "completed",
              output: [
                { type: "function_call", name: "list_attachments", call_id: "call-guard-1", arguments: "{}" },
                { type: "function_call", name: "read_attachment", call_id: "call-guard-2", arguments: "{\"id\":\"att-1\"}" },
              ],
              output_text: "",
              usage: { input_tokens: 12, output_tokens: 5, total_tokens: 17 },
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        }
        return new Response(
          JSON.stringify({
            id: `resp-guard-${postCounter}`,
            status: "completed",
            output: [
              {
                type: "message",
                content: [{ type: "output_text", text: "audit complete" }],
              },
            ],
            output_text: "audit complete",
            usage: { input_tokens: 11, output_tokens: 4, total_tokens: 15 },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      return new Response("not found", { status: 404 });
    };
    const { runtime, app } = createRuntime({
      fetchFn,
      logsSink: logs,
      options: {
        reasoningMaxTokens: 12000,
        serviceTier: "standard",
        backgroundMode: "auto",
        toolsMode: "auto",
      },
    });
    app.ai.attachments = [{ id: "att-1", name: "repo.txt", text: "module content", size: 10, type: "text/plain" }];
    const auditTask = "\u0438\u0441\u0441\u043b\u0435\u0434\u0443\u0439 \u0440\u0435\u043f\u043e\u0437\u0438\u0442\u043e\u0440\u0438\u0439 \u0434\u043e \u043a\u043e\u043d\u0446\u0430, \u043d\u0435 \u043e\u0433\u0440\u0430\u043d\u0438\u0447\u0438\u0432\u0430\u0439 \u0430\u0433\u0435\u043d\u0442\u0430 \u043f\u043e \u0440\u0435\u0441\u0443\u0440\u0441\u0430\u043c \u0438 \u0441\u0434\u0435\u043b\u0430\u0439 \u0440\u0430\u0437\u0431\u043e\u0440";
    const out = await runtime.runOpenAiAgentTurn(`Current user request:\n${auditTask}`, auditTask, {
      turnId: "t-completion-guard",
    });
    assert.equal(String(out || ""), "audit complete");
    assert.ok(postedBodies.length >= 3);
    const preflight = logs.find((x) => x.event === "agent.preflight");
    assert.ok(Number(preflight?.meta?.meta?.min_tool_calls || 0) >= 1);
    assert.equal(Boolean(preflight?.meta?.meta?.force_no_limits), true);
    const overridesApplied = String(preflight?.meta?.meta?.overrides_applied || "");
    assert.ok(overridesApplied.includes("\"toolsMode\":\"require\""));
    assert.ok(overridesApplied.includes("\"reasoningMaxTokens\":0"));
    assert.ok(logs.some((x) => x.event === "agent.completion_guard.triggered"));
  }

  {
    const app = {
      ai: {
        options: { ...defaultOptions(), taskProfile: "custom" },
        runtimeProfile: null,
        pendingQuestion: null,
        webSearchPopoverOpen: false,
        reasoningPopoverOpen: false,
      },
    };
    const attachment = new AgentAttachmentModule({
      app,
      dom: {},
      addChangesJournal: () => {},
      saveAiOptions: () => {},
      renderAiUi: () => {},
      toast: () => {},
      createId: () => "id-1",
      num: (v, fallback = 0) => {
        const n = Number(v);
        return Number.isFinite(n) ? n : fallback;
      },
    });
    const fire = (field, value) => {
      attachment.onAgentContextIconsChange({
        target: {
          dataset: { reasoningConfig: field },
          value,
        },
      });
    };

    fire("effort", "high");
    assert.equal(app.ai.options.reasoningDepth, "deep");
    assert.equal(app.ai.options.reasoningVerify, "basic");
    fire("verify", "strict");
    assert.equal(app.ai.options.reasoningEffort, "xhigh");

    fire("outputMode", "json");
    assert.equal(app.ai.options.structuredSpecOutput, true);
    fire("structuredSpecOutput", "off");
    assert.equal(app.ai.options.outputMode, "bullets");

    fire("compactMode", "on");
    assert.equal(app.ai.options.useConversationState, true);
    fire("useConversationState", "off");
    assert.equal(app.ai.options.compactMode, "auto");

    fire("citationsMode", "on");
    assert.equal(app.ai.options.includeSourcesMode, "auto");
    fire("includeSourcesMode", "on");
    assert.equal(app.ai.options.citationsMode, "on");
  }

  {
    const postedBodies = [];
    let postCounter = 0;
    const logs = [];
    const fetchFn = async (url, init = {}) => {
      const u = String(url || "");
      const m = String(init?.method || "GET");
      if (u === "https://api.openai.com/v1/responses" && m === "POST") {
        postCounter += 1;
        const body = JSON.parse(String(init?.body || "{}"));
        postedBodies.push(body);
        if (postCounter === 1) {
          return new Response(
            JSON.stringify({
              id: "resp-q-1",
              status: "completed",
              output: [
                {
                  type: "function_call",
                  name: "ask_user_question",
                  call_id: "call-q-1",
                  arguments: JSON.stringify({
                    question: "Need clarification?",
                    options: ["A", "B"],
                    allow_custom: true,
                  }),
                },
              ],
              output_text: "",
              usage: { input_tokens: 10, output_tokens: 2, total_tokens: 12 },
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        }
        return new Response(
          JSON.stringify({
            id: "resp-q-2",
            status: "completed",
            output: [
              {
                type: "message",
                content: [{ type: "output_text", text: "done" }],
              },
            ],
            output_text: "done",
            usage: { input_tokens: 15, output_tokens: 5, total_tokens: 20 },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      return new Response("not found", { status: 404 });
    };
    const executeAgentTool = async (name) => {
      if (String(name) === "ask_user_question") {
        return {
          ok: true,
          applied: 0,
          awaiting_user_input: true,
          message: "need user input",
        };
      }
      return { ok: true, applied: 1 };
    };
    const { runtime } = createRuntime({
      fetchFn,
      logsSink: logs,
      executeAgentTool,
      options: { taskProfile: "bulk" },
    });
    const out = await runtime.runOpenAiAgentTurn("Current user request:\nbulk change", "bulk change", {
      turnId: "t-skip-question",
    });
    assert.equal(String(out || ""), "done");
    assert.equal(postedBodies.length, 2);
    assert.equal(hasFunctionCallOutput(postedBodies[1]?.input), true);
    assert.ok(logs.some((x) => x.event === "tool.awaiting_user_input.ignored"));
  }

  {
    const postedBodies = [];
    let postCounter = 0;
    const logs = [];
    const sseEvent = (name, data) => `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`;
    const fetchFn = async (url, init = {}) => {
      const u = String(url || "");
      const m = String(init?.method || "GET");
      if (u === "https://api.openai.com/v1/responses" && m === "POST") {
        postCounter += 1;
        const body = JSON.parse(String(init?.body || "{}"));
        postedBodies.push(body);
        if (postCounter === 1) {
          const streamText = sseEvent("response.incomplete", {
            response: {
              id: "resp-inc-1",
              status: "incomplete",
              output: [
                {
                  type: "message",
                  content: [{ type: "output_text", text: "partial result" }],
                },
              ],
              output_text: "partial result",
              incomplete_details: { reason: "max_output_tokens" },
              usage: { input_tokens: 21, output_tokens: 6, total_tokens: 27 },
            },
          });
          return new Response(streamText, {
            status: 200,
            headers: { "content-type": "text/event-stream" },
          });
        }
        const streamText = sseEvent("response.completed", {
          response: {
            id: "resp-inc-2",
            status: "completed",
            output: [
              {
                type: "message",
                content: [{ type: "output_text", text: "done" }],
              },
            ],
            output_text: "done",
            usage: { input_tokens: 18, output_tokens: 4, total_tokens: 22 },
          },
        });
        return new Response(streamText, {
          status: 200,
          headers: { "content-type": "text/event-stream" },
        });
      }
      return new Response("not found", { status: 404 });
    };

    const { runtime, app } = createRuntime({ fetchFn, logsSink: logs });
    app.ai.streaming = true;
    const out = await runtime.runOpenAiAgentTurn("Current user request:\nfinish", "finish", {
      turnId: "t-stream-incomplete",
    });
    assert.equal(String(out || ""), "done");
    assert.equal(postedBodies.length, 2);
    assert.equal(String(postedBodies[1]?.previous_response_id || ""), "resp-inc-1");
    assert.ok(logs.some((x) => x.event === "request.incomplete"));
  }

  console.log("SMOKE_OK");
}

main().catch((err) => {
  console.error("SMOKE_FAIL", err?.stack || err?.message || err);
  process.exit(1);
});
