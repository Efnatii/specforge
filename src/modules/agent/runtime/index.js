import { AgentRuntimePromptModule } from "./prompt.js";
import { AgentRuntimePolicyModule } from "./policy.js";
import { AgentRuntimeToolSpecModule } from "./schema/spec.js";
import { AgentRuntimeResponsesModule } from "./responses.js";
import { AgentRuntimeTurnModule } from "./turn.js";

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
    this._toolSpecModule = new AgentRuntimeToolSpecModule({ app });
    this.buildAgentResponsesPayload = this.buildAgentResponsesPayload.bind(this);

    const promptModule = new AgentRuntimePromptModule({
      app,
      config: {
        CHAT_CONTEXT_RECENT_MESSAGES,
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

  buildAgentResponsesPayload(options = {}) {
    const payload = {
      model: String(options?.model || this._app.ai.model || ""),
      tools: this._toolSpecModule.agentToolsSpec(),
      tool_choice: "auto",
    };
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
