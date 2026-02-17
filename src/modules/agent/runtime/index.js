import { AgentRuntimePromptModule } from "./prompt.js";
import { AgentRuntimePolicyModule } from "./policy.js";
import { AgentRuntimeToolSpecModule } from "./schema/spec.js";
import { AgentRuntimeResponsesModule } from "./responses.js";
import { AgentRuntimeTurnModule } from "./turn.js";

const FILE_SEARCH_MAX_AGE_MS = 60 * 60 * 1000;

function normalizeModelId(value) {
  return String(value || "").trim().toLowerCase();
}

function isGpt5Family(modelId) {
  return /^gpt-5(?:[.-]|$)/.test(modelId);
}

function parseGpt5Minor(modelId) {
  const m = modelId.match(/^gpt-5(?:\.(\d+))?(?:[.-]|$)/);
  if (!m) return null;
  if (!m[1]) return 0;
  const n = Number.parseInt(m[1], 10);
  return Number.isFinite(n) ? n : 0;
}

function isOReasoningFamily(modelId) {
  return /^o(?:1|3|4)(?:[.-]|$)/.test(modelId);
}

function isComputerUsePreviewModel(modelId) {
  return /^computer-use-preview(?:[.-]|$)/.test(modelId);
}

function modelReasoningCapabilities(modelIdRaw) {
  const modelId = normalizeModelId(modelIdRaw);
  const gpt5 = isGpt5Family(modelId);
  const oFamily = isOReasoningFamily(modelId);
  const computerUse = isComputerUsePreviewModel(modelId);
  const supportsReasoning = gpt5 || oFamily || computerUse;
  if (!supportsReasoning) {
    return {
      supportsReasoning: false,
      effortValues: [],
      summaryValues: [],
    };
  }

  const gpt5Minor = parseGpt5Minor(modelId);
  const isGpt5Pro = /^gpt-5(?:\.\d+)?-pro(?:[.-]|$)/.test(modelId) || /^gpt-5-pro(?:[.-]|$)/.test(modelId);
  const supportsNoneEffort = gpt5 && gpt5Minor !== null && gpt5Minor >= 1;
  const supportsMinimalEffort = gpt5 && gpt5Minor !== null && gpt5Minor >= 2;
  const supportsXhighEffort = /^gpt-5\.2(?:[.-]|$)/.test(modelId) || /^gpt-5\.1-codex-max(?:[.-]|$)/.test(modelId);

  const effortValues = isGpt5Pro
    ? ["high"]
    : [
      ...(supportsNoneEffort ? ["none"] : []),
      ...(supportsMinimalEffort ? ["minimal"] : []),
      "low",
      "medium",
      "high",
      ...(supportsXhighEffort ? ["xhigh"] : []),
    ];

  const supportsConciseSummary = computerUse
    || (gpt5 && gpt5Minor !== null && gpt5Minor >= 2)
    || oFamily;

  const summaryValues = [
    "auto",
    ...(supportsConciseSummary ? ["concise"] : []),
    "detailed",
  ];

  return {
    supportsReasoning: true,
    effortValues,
    summaryValues,
  };
}

function normalizeReasoningEffortForModel(value, capabilities) {
  const effort = String(value || "").trim().toLowerCase();
  const allowed = Array.isArray(capabilities?.effortValues) ? capabilities.effortValues : [];
  if (!allowed.length) return "medium";
  if (allowed.includes(effort)) return effort;
  if ((effort === "none" || effort === "minimal") && allowed.includes("low")) return "low";
  if (effort === "xhigh" && allowed.includes("high")) return "high";
  if (allowed.includes("medium")) return "medium";
  return allowed[0];
}

function normalizeReasoningSummaryForModel(value, capabilities) {
  const mode = String(value || "").trim().toLowerCase();
  if (mode === "off") return "off";
  const allowed = Array.isArray(capabilities?.summaryValues) ? capabilities.summaryValues : [];
  if (!allowed.length) return "off";
  if (allowed.includes(mode)) return mode;
  if (mode === "concise" && allowed.includes("detailed")) return "detailed";
  if (allowed.includes("auto")) return "auto";
  return allowed[0];
}

function supportsTextVerbosity(modelIdRaw) {
  return isGpt5Family(normalizeModelId(modelIdRaw));
}

function normalizeTextVerbosity(value, modelIdRaw) {
  if (!supportsTextVerbosity(modelIdRaw)) return "";
  const brevity = String(value || "").trim().toLowerCase();
  if (brevity === "short") return "low";
  if (brevity === "detailed") return "high";
  return "medium";
}

function normalizeServiceTierOption(value, fallback = "standard") {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "flex" || raw === "standard" || raw === "priority") return raw;
  const fb = String(fallback || "").trim().toLowerCase();
  if (fb === "flex" || fb === "standard" || fb === "priority") return fb;
  return "standard";
}

function toResponsesServiceTier(value) {
  const tier = normalizeServiceTierOption(value, "standard");
  if (tier === "flex" || tier === "priority") return tier;
  return "default";
}

export class AgentRuntimeModule {
  constructor(ctx) {
    const {
      app,
      config,
      deps,
    } = ctx || {};

    if (!app) throw new Error("AgentRuntimeModule requires app");
    if (!config) throw new Error("AgentRuntimeModule requires config");
    if (!deps) throw new Error("AgentRuntimeModule requires deps");

    const {
      CHAT_CONTEXT_RECENT_MESSAGES,
      CHAT_CONTEXT_MAX_CHARS,
      CHAT_CONTEXT_MESSAGE_MAX_CHARS,
      CHAT_SUMMARY_CHUNK_SIZE,
      AI_CONTINUE_PROMPT_RE,
      AI_SHORT_ACK_PROMPT_RE,
      AI_MUTATION_INTENT_RE,
      AI_ACTIONABLE_VERB_RE,
      AI_TOOL_NAME_HINTS,
      AI_INCOMPLETE_RESPONSE_RE,
      AGENT_MAX_FORCED_RETRIES,
      AGENT_MAX_TOOL_ROUNDS,
    } = config;

    const {
      addChangesJournal,
      activeSheet,
      selectionText,
      toA1,
      colToName,
      agentCellValueText,
      currentAiModelMeta,
      executeAgentTool,
      addExternalJournal,
      addTableJournal,
      compactForTool,
      disconnectOpenAi,
      uid,
      num,
      summarizeChatChunk,
      mergeChatSummary,
      fetchFn,
    } = deps;

    this._app = app;
    this._fetch = fetchFn || ((...args) => globalThis.fetch(...args));
    this._addExternalJournal = addExternalJournal;
    this._disconnectOpenAi = disconnectOpenAi;
    this._toolSpecModule = new AgentRuntimeToolSpecModule({ app });
    this.buildAgentResponsesPayload = this.buildAgentResponsesPayload.bind(this);
    this.ensureFileSearchReady = this.ensureFileSearchReady.bind(this);
    this._fileSearchCleanupTimer = 0;

    const promptModule = new AgentRuntimePromptModule({
      app,
      config: {
        CHAT_CONTEXT_RECENT_MESSAGES,
        CHAT_CONTEXT_MAX_CHARS,
        CHAT_CONTEXT_MESSAGE_MAX_CHARS,
        CHAT_SUMMARY_CHUNK_SIZE,
        AI_CONTINUE_PROMPT_RE,
        AI_SHORT_ACK_PROMPT_RE,
        AI_MUTATION_INTENT_RE,
        AI_ACTIONABLE_VERB_RE,
        AI_TOOL_NAME_HINTS,
      },
      deps: {
        addChangesJournal,
        activeSheet,
        selectionText,
        toA1,
        colToName,
        agentCellValueText,
        summarizeChatChunk,
        mergeChatSummary,
      },
    });

    const policyModule = new AgentRuntimePolicyModule({
      app,
      config: {
        AI_INCOMPLETE_RESPONSE_RE,
      },
      deps: {
        num,
      },
    });

    const responsesModule = new AgentRuntimeResponsesModule({
      app,
      deps: {
        addExternalJournal,
        compactForTool,
        disconnectOpenAi,
        uid,
        num,
        fetchFn,
        parseJsonSafe: policyModule.parseJsonSafe,
      },
    });

    const turnModule = new AgentRuntimeTurnModule({
      app,
      config: {
        AGENT_MAX_FORCED_RETRIES,
        AGENT_MAX_TOOL_ROUNDS,
        AI_MUTATION_INTENT_RE,
      },
      deps: {
        currentAiModelMeta,
        executeAgentTool,
        addExternalJournal,
        addTableJournal,
        compactForTool,
        num,
        isActionableAgentPrompt: promptModule.isActionableAgentPrompt,
        estimateExpectedMutationCount: policyModule.estimateExpectedMutationCount,
        buildAgentResponsesPayload: this.buildAgentResponsesPayload,
        callOpenAiResponses: responsesModule.callOpenAiResponses,
        agentSystemPrompt: this._toolSpecModule.agentSystemPrompt,
        extractAgentFunctionCalls: responsesModule.extractAgentFunctionCalls,
        extractAgentText: responsesModule.extractAgentText,
        isAgentTextIncomplete: policyModule.isAgentTextIncomplete,
        shouldForceAgentContinuation: policyModule.shouldForceAgentContinuation,
        buildAgentRetryReason: policyModule.buildAgentRetryReason,
        buildAgentContinuationInstruction: policyModule.buildAgentContinuationInstruction,
        sanitizeAgentOutputText: policyModule.sanitizeAgentOutputText,
        parseJsonSafe: policyModule.parseJsonSafe,
        summarizeToolArgs: policyModule.summarizeToolArgs,
        normalizeToolResult: policyModule.normalizeToolResult,
        isMutationToolName: policyModule.isMutationToolName,
        updateAgentTurnWebEvidence: responsesModule.updateAgentTurnWebEvidence,
        prepareToolResources: this.ensureFileSearchReady,
      },
    });

    this.normalizeAgentPrompt = promptModule.normalizeAgentPrompt;
    this.isActionableAgentPrompt = promptModule.isActionableAgentPrompt;
    this.buildAgentInput = promptModule.buildAgentInput;
    this.buildChatHistoryContext = promptModule.buildChatHistoryContext;
    this.buildAgentContextText = promptModule.buildAgentContextText;
    this.serializeSheetPreview = promptModule.serializeSheetPreview;

    this.runOpenAiAgentTurn = turnModule.runOpenAiAgentTurn;

    this.estimateExpectedMutationCount = policyModule.estimateExpectedMutationCount;
    this.looksLikePseudoToolText = policyModule.looksLikePseudoToolText;
    this.isAgentTextIncomplete = policyModule.isAgentTextIncomplete;
    this.shouldForceAgentContinuation = policyModule.shouldForceAgentContinuation;
    this.buildAgentRetryReason = policyModule.buildAgentRetryReason;
    this.buildAgentContinuationInstruction = policyModule.buildAgentContinuationInstruction;
    this.sanitizeAgentOutputText = policyModule.sanitizeAgentOutputText;
    this.summarizeToolArgs = policyModule.summarizeToolArgs;
    this.normalizeToolResult = policyModule.normalizeToolResult;
    this.parseJsonSafe = policyModule.parseJsonSafe;
    this.parseJsonValue = policyModule.parseJsonValue;
    this.isMutationToolName = policyModule.isMutationToolName;

    this.agentSystemPrompt = this._toolSpecModule.agentSystemPrompt;
    this.agentToolsSpec = this._toolSpecModule.agentToolsSpec;

    this.callOpenAiResponses = responsesModule.callOpenAiResponses;
    this.callOpenAiResponsesJson = responsesModule.callOpenAiResponsesJson;
    this.callOpenAiResponsesStream = responsesModule.callOpenAiResponsesStream;
    this.parseSseEvent = responsesModule.parseSseEvent;
    this.extractAgentFunctionCalls = responsesModule.extractAgentFunctionCalls;
    this.extractAgentText = responsesModule.extractAgentText;
    this.updateAgentTurnWebEvidence = responsesModule.updateAgentTurnWebEvidence;
    this.extractWebSearchEvidence = responsesModule.extractWebSearchEvidence;
    this.normalizeHttpUrl = responsesModule.normalizeHttpUrl;
    this.pushUnique = responsesModule.pushUnique;
  }

  _ensureFileSearchState() {
    if (!this._app.ai.fileSearch || typeof this._app.ai.fileSearch !== "object") {
      this._app.ai.fileSearch = {
        vectorStoreId: "",
        attachmentsSignature: "",
        syncedAt: 0,
      };
    }
    return this._app.ai.fileSearch;
  }

  _resetFileSearchState(state = this._ensureFileSearchState()) {
    state.vectorStoreId = "";
    state.attachmentsSignature = "";
    state.syncedAt = 0;
    return state;
  }

  _isFileSearchExpired(state = this._ensureFileSearchState(), nowTs = Date.now()) {
    const syncedAt = Math.max(0, Number(state?.syncedAt || 0));
    if (!syncedAt) return false;
    return (nowTs - syncedAt) >= FILE_SEARCH_MAX_AGE_MS;
  }

  _clearFileSearchCleanupTimer() {
    if (!this._fileSearchCleanupTimer) return;
    if (typeof globalThis.clearTimeout === "function") {
      globalThis.clearTimeout(this._fileSearchCleanupTimer);
    }
    this._fileSearchCleanupTimer = 0;
  }

  _scheduleFileSearchCleanup(vectorStoreId, syncedAt = Date.now(), turnId = "") {
    this._clearFileSearchCleanupTimer();
    const id = String(vectorStoreId || "").trim();
    if (!id) return;
    if (typeof globalThis.setTimeout !== "function") return;

    const elapsed = Math.max(0, Date.now() - Math.max(0, Number(syncedAt || 0)));
    const delayMs = Math.max(1000, FILE_SEARCH_MAX_AGE_MS - elapsed);
    this._fileSearchCleanupTimer = globalThis.setTimeout(() => {
      this._fileSearchCleanupTimer = 0;
      void (async () => {
        try {
          await this._deleteVectorStore(id, {
            turnId: String(turnId || this._app.ai.turnId || ""),
            reason: "ttl_1h",
          });
          const state = this._ensureFileSearchState();
          if (String(state.vectorStoreId || "").trim() === id) this._resetFileSearchState(state);
        } catch (err) {
          if (err?.no_fallback) return;
        }
      })();
    }, delayMs);
  }

  _safeAttachmentFileName(rawName, idx = 0) {
    const base = String(rawName || `attachment-${idx + 1}`)
      .replace(/[\\/:*?"<>|]+/g, "_")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 80);
    if (!base) return `attachment-${idx + 1}.txt`;
    return /\.(txt|md|csv|json|xml|yaml|yml)$/i.test(base) ? base : `${base}.txt`;
  }

  _buildFileSearchDocs() {
    const attachments = Array.isArray(this._app?.ai?.attachments) ? this._app.ai.attachments : [];
    const docs = [];
    for (let i = 0; i < attachments.length; i += 1) {
      const file = attachments[i] || {};
      const name = String(file?.name || `attachment-${i + 1}`).trim() || `attachment-${i + 1}`;
      const parser = String(file?.parser || "").trim();
      const parseError = String(file?.parse_error || "").trim();
      const textRaw = String(file?.text || "");
      const text = textRaw.slice(0, 180000);
      const meta = [
        `name: ${name}`,
        `id: ${String(file?.id || "").trim()}`,
        `type: ${String(file?.type || "application/octet-stream").trim()}`,
        `size: ${Math.max(0, Number(file?.size || 0))}`,
        `parser: ${parser || "n/a"}`,
        `truncated: ${Boolean(file?.truncated) ? "yes" : "no"}`,
      ];
      if (parseError) meta.push(`parse_error: ${parseError.slice(0, 240)}`);
      const body = text.trim()
        ? `Extracted content:\n${text}`
        : "Extracted content: unavailable";
      docs.push({
        attachmentId: String(file?.id || "").trim() || `idx-${i}`,
        name,
        fileName: this._safeAttachmentFileName(name, i),
        content: `${meta.join("\n")}\n\n${body}`.slice(0, 200000),
      });
    }
    return docs;
  }

  _fileSearchSignature(docs) {
    return docs
      .map((doc) => {
        const prefix = String(doc?.content || "").slice(0, 160).replace(/\s+/g, " ").trim();
        return `${doc?.attachmentId || ""}:${doc?.fileName || ""}:${String(doc?.content || "").length}:${prefix}`;
      })
      .join("|")
      .slice(0, 16000);
  }

  async _openAiJson(url, options = {}) {
    const method = String(options?.method || "GET").toUpperCase();
    const headers = { Authorization: `Bearer ${this._app.ai.apiKey}` };
    const init = { method, headers };
    if (options?.contentType) headers["Content-Type"] = options.contentType;
    if (options?.body !== undefined) init.body = options.body;

    const res = await this._fetch(url, init);
    if (!res.ok) {
      const bodyText = String(await res.text()).replace(/\s+/g, " ").trim().slice(0, 800);
      if (res.status === 401 || res.status === 403) {
        this._disconnectOpenAi();
        const e = new Error("openai unauthorized");
        e.no_fallback = true;
        throw e;
      }
      throw new Error(`openai ${res.status}: ${bodyText || "unknown error"}`);
    }
    return res.json();
  }

  async _uploadOpenAiFile(fileName, content) {
    if (typeof FormData !== "function" || typeof Blob !== "function") {
      throw new Error("file upload is unavailable in this environment");
    }
    const form = new FormData();
    form.append("purpose", "assistants");
    form.append("file", new Blob([String(content || "")], { type: "text/plain" }), fileName);

    const res = await this._fetch("https://api.openai.com/v1/files", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this._app.ai.apiKey}`,
      },
      body: form,
    });
    if (!res.ok) {
      const bodyText = String(await res.text()).replace(/\s+/g, " ").trim().slice(0, 800);
      if (res.status === 401 || res.status === 403) {
        this._disconnectOpenAi();
        const e = new Error("openai unauthorized");
        e.no_fallback = true;
        throw e;
      }
      throw new Error(`openai ${res.status}: ${bodyText || "file upload failed"}`);
    }
    return res.json();
  }

  async _deleteVectorStore(vectorStoreId, options = {}) {
    const id = String(vectorStoreId || "").trim();
    if (!id) return false;
    const turnId = String(options?.turnId || this._app.ai.turnId || "");
    const reason = String(options?.reason || "cleanup").trim() || "cleanup";

    try {
      const res = await this._fetch(`https://api.openai.com/v1/vector_stores/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${this._app.ai.apiKey}`,
        },
      });
      if (res.status === 401 || res.status === 403) {
        this._disconnectOpenAi();
        const e = new Error("openai unauthorized");
        e.no_fallback = true;
        throw e;
      }
      if (!res.ok && res.status !== 404) {
        const bodyText = String(await res.text()).replace(/\s+/g, " ").trim().slice(0, 800);
        throw new Error(`vector_store delete failed ${res.status}: ${bodyText || "unknown error"}`);
      }
      this._addExternalJournal("file_search.cleanup", `deleted vector_store=${id}`, {
        turn_id: turnId,
        status: "completed",
        meta: {
          reason,
          vector_store_id: id,
          http_status: res.status,
        },
      });
      return true;
    } catch (err) {
      if (err?.no_fallback) throw err;
      this._addExternalJournal("file_search.cleanup.error", String(err?.message || err), {
        turn_id: turnId,
        level: "warning",
        status: "error",
        meta: {
          reason,
          vector_store_id: id,
        },
      });
      return false;
    }
  }

  async ensureFileSearchReady(options = {}) {
    const docs = this._buildFileSearchDocs();
    const turnId = String(options?.turnId || this._app.ai.turnId || "");
    const state = this._ensureFileSearchState();
    const currentVectorStoreId = String(state.vectorStoreId || "").trim();

    if (!docs.length) {
      this._clearFileSearchCleanupTimer();
      if (currentVectorStoreId) {
        await this._deleteVectorStore(currentVectorStoreId, {
          turnId,
          reason: "no_attachments",
        });
      }
      this._resetFileSearchState(state);
      return "";
    }

    const signature = this._fileSearchSignature(docs);
    const ttlExpired = this._isFileSearchExpired(state);

    if (currentVectorStoreId && state.attachmentsSignature === signature && !ttlExpired) {
      this._scheduleFileSearchCleanup(currentVectorStoreId, state.syncedAt, turnId);
      return currentVectorStoreId;
    }

    if (currentVectorStoreId) {
      this._clearFileSearchCleanupTimer();
      await this._deleteVectorStore(currentVectorStoreId, {
        turnId,
        reason: ttlExpired ? "ttl_1h" : "attachments_changed",
      });
      this._resetFileSearchState(state);
    }

    const startedAt = Date.now();
    this._addExternalJournal("file_search.sync", `start files=${docs.length}`, {
      turn_id: turnId,
      status: "running",
      meta: { files: docs.length },
    });

    const vectorStore = await this._openAiJson("https://api.openai.com/v1/vector_stores", {
      method: "POST",
      contentType: "application/json",
      body: JSON.stringify({
        name: `specforge-${Date.now()}`,
        expires_after: { anchor: "last_active_at", days: 1 },
      }),
    });
    const vectorStoreId = String(vectorStore?.id || "").trim();
    if (!vectorStoreId) throw new Error("vector_store_id is missing");

    for (let i = 0; i < docs.length; i += 1) {
      const doc = docs[i];
      const file = await this._uploadOpenAiFile(doc.fileName, doc.content);
      const fileId = String(file?.id || "").trim();
      if (!fileId) throw new Error(`file_id is missing for ${doc.fileName}`);
      await this._openAiJson(`https://api.openai.com/v1/vector_stores/${vectorStoreId}/files`, {
        method: "POST",
        contentType: "application/json",
        body: JSON.stringify({ file_id: fileId }),
      });
    }

    state.vectorStoreId = vectorStoreId;
    state.attachmentsSignature = signature;
    state.syncedAt = Date.now();
    this._scheduleFileSearchCleanup(vectorStoreId, state.syncedAt, turnId);

    this._addExternalJournal("file_search.sync", `completed files=${docs.length}`, {
      turn_id: turnId,
      status: "completed",
      duration_ms: Date.now() - startedAt,
      meta: { files: docs.length, vector_store_id: vectorStoreId },
    });

    return vectorStoreId;
  }

  buildAgentResponsesPayload(options = {}) {
    const normalizeToolsMode = (value) => {
      const mode = String(value || "").trim().toLowerCase();
      if (mode === "none" || mode === "auto" || mode === "prefer" || mode === "require") return mode;
      return "auto";
    };
    const normalizeReasoningMaxTokens = (value) => {
      const n = Number(value);
      if (!Number.isFinite(n) || n <= 0) return 0;
      return Math.max(1, Math.round(n));
    };
    const model = String(options?.model || this._app.ai.model || "");
    const reasoningCapabilities = modelReasoningCapabilities(model);
    const reasoningEnabled = this._app?.ai?.options?.reasoning !== false && reasoningCapabilities.supportsReasoning;
    const reasoningEffort = normalizeReasoningEffortForModel(this._app?.ai?.options?.reasoningEffort, reasoningCapabilities);
    const reasoningSummary = normalizeReasoningSummaryForModel(this._app?.ai?.options?.reasoningSummary, reasoningCapabilities);
    const textVerbosity = normalizeTextVerbosity(this._app?.ai?.options?.brevityMode, model);
    const serviceTier = toResponsesServiceTier(this._app?.ai?.options?.serviceTier);
    const toolsMode = normalizeToolsMode(this._app?.ai?.options?.toolsMode);
    const reasoningMaxTokens = normalizeReasoningMaxTokens(this._app?.ai?.options?.reasoningMaxTokens);
    const tools = toolsMode === "none" ? [] : this._toolSpecModule.agentToolsSpec();
    const toolChoice = toolsMode === "none"
      ? "none"
      : toolsMode === "require"
        ? "required"
        : "auto";
    const payload = {
      model,
      tools,
    };
    payload.tool_choice = toolChoice;
    if (toolsMode !== "none") payload.parallel_tool_calls = true;
    if (reasoningEnabled) {
      const reasoning = {
        effort: reasoningEffort,
      };
      if (reasoningSummary !== "off") reasoning.summary = reasoningSummary;
      payload.reasoning = reasoning;
    }
    if (textVerbosity) payload.text = { verbosity: textVerbosity };
    if (reasoningMaxTokens > 0) payload.max_output_tokens = reasoningMaxTokens;
    if (serviceTier === "flex" || serviceTier === "priority") payload.service_tier = serviceTier;
    const hasComputerUse = Array.isArray(tools) && tools.some((tool) => String(tool?.type || "") === "computer_use_preview");
    if (hasComputerUse) payload.truncation = "auto";
    const previousResponseId = String(options?.previousResponseId || "").trim();
    if (previousResponseId) payload.previous_response_id = previousResponseId;
    if (!previousResponseId) {
      const instructions = String(options?.instructions || "").trim();
      if (instructions) payload.instructions = instructions;
    }
    if (options?.input !== undefined) payload.input = options.input;
    return payload;
  }
}
