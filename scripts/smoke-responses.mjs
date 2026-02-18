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
  };
}

function createRuntime({ options = {}, runtimeProfile = null, fetchFn, logsSink } = {}) {
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
    executeAgentTool: async () => ({ ok: true, applied: 0, warnings: [] }),
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
    const { runtime } = createRuntime({ options: { reasoningMaxTokens: 13000 } });
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
    const { runtime } = createRuntime({ options: { reasoningMaxTokens: 13000 } });
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

  console.log("SMOKE_OK");
}

main().catch((err) => {
  console.error("SMOKE_FAIL", err?.stack || err?.message || err);
  process.exit(1);
});
