import { AgentToolsModule } from "../../agent/tools/index.js";
import { AgentRuntimeModule } from "../../agent/runtime/index.js";
import { AgentPromptModule } from "../../agent/prompt.js";

export class AppAgentRuntimeCompositionModule {
  constructor({
    config,
    dom,
    windowRef,
  }) {
    if (!config) throw new Error("AppAgentRuntimeCompositionModule requires config");
    if (!dom) throw new Error("AppAgentRuntimeCompositionModule requires dom");
    if (!windowRef) throw new Error("AppAgentRuntimeCompositionModule requires windowRef");
    this._config = config;
    this._dom = dom;
    this._window = windowRef;
  }

  compose({ core, journal, uiBase, foundation }) {
    if (!core) throw new Error("AppAgentRuntimeCompositionModule.compose requires core");
    if (!journal) throw new Error("AppAgentRuntimeCompositionModule.compose requires journal");
    if (!uiBase) throw new Error("AppAgentRuntimeCompositionModule.compose requires uiBase");
    if (!foundation) throw new Error("AppAgentRuntimeCompositionModule.compose requires foundation");

    const {
      app,
      appIdentityModule,
      projectMutationModule,
      toastModule,
      workbookViewModule,
      renderBridge,
    } = core;

    const {
      projectUiActionModule,
      projectSheetSelectionModule,
      openAiAuthModule,
    } = uiBase;

    const {
      marketVerificationModule,
      agentGridModule,
      agentStateAccessModule,
      colToName,
      toA1,
      agentCellValueText,
      compactForTool,
    } = foundation;

    const {
      addChangesJournal,
      addTableJournal,
      addExternalJournal,
      currentAiModelMeta,
      summarizeChatChunk,
      mergeChatSummary,
      addAgentLog,
      beginAgentStreamingEntry,
      appendAgentStreamingDelta,
      finalizeAgentStreamingEntry,
      nextAgentTurnId,
      renderAiUi,
    } = journal;

    const {
      aiContinuePromptRe,
      aiShortAckPromptRe,
      aiMutationIntentRe,
      aiActionableVerbRe,
      aiToolNameHints,
      aiIncompleteResponseRe,
      agentMaxForcedRetries,
      agentMaxToolRounds,
      chatContextRecentMessages,
      chatContextMaxChars,
      chatContextMessageMaxChars,
      chatSummaryChunkSize,
    } = this._config;

    const agentToolsModule = new AgentToolsModule({
      app,
      deps: {
        marketVerificationModule,
        gridApi: agentGridModule,
        stateAccessApi: agentStateAccessModule,
        addTableJournal,
        addChangesJournal,
        renderAll: () => renderBridge.renderAll(),
        renderTabs: () => workbookViewModule.renderTabs(),
        renderSheet: () => renderBridge.renderSheet(),
        activeSheet: () => workbookViewModule.activeSheet(),
        selectionText: (sheet, sel) => projectSheetSelectionModule.selectionText(sheet, sel),
        assemblyById: (id) => projectUiActionModule.assemblyById(id),
        deletePosition: (assemblyId, list, posId) => projectUiActionModule.deletePosition(assemblyId, list, posId),
        makePosition: () => projectMutationModule.createPosition(),
        makeAssembly: (index = 1) => projectMutationModule.createAssembly(index),
        deriveAbbr: (name) => projectMutationModule.deriveAbbr(name),
        keepAbbr: (value) => projectMutationModule.keepAbbr(value),
        normalizePercentDecimal: (value, fallback = 0) => projectMutationModule.normalizePercentDecimal(value, fallback),
        nextCopyAssemblyName: (base) => projectUiActionModule.nextCopyAssemblyName(base),
        uid: () => appIdentityModule.createId(),
        num: (value, fallback = 0) => projectMutationModule.num(value, fallback),
      },
    });

    const { executeAgentTool } = agentToolsModule;

    const agentRuntimeModule = new AgentRuntimeModule({
      app,
      config: {
        CHAT_CONTEXT_RECENT_MESSAGES: chatContextRecentMessages,
        CHAT_CONTEXT_MAX_CHARS: chatContextMaxChars,
        CHAT_CONTEXT_MESSAGE_MAX_CHARS: chatContextMessageMaxChars,
        CHAT_SUMMARY_CHUNK_SIZE: chatSummaryChunkSize,
        AI_CONTINUE_PROMPT_RE: aiContinuePromptRe,
        AI_SHORT_ACK_PROMPT_RE: aiShortAckPromptRe,
        AI_MUTATION_INTENT_RE: aiMutationIntentRe,
        AI_ACTIONABLE_VERB_RE: aiActionableVerbRe,
        AI_TOOL_NAME_HINTS: aiToolNameHints,
        AI_INCOMPLETE_RESPONSE_RE: aiIncompleteResponseRe,
        AGENT_MAX_FORCED_RETRIES: agentMaxForcedRetries,
        AGENT_MAX_TOOL_ROUNDS: agentMaxToolRounds,
      },
      deps: {
        addChangesJournal,
        activeSheet: () => workbookViewModule.activeSheet(),
        selectionText: (sheet, sel) => projectSheetSelectionModule.selectionText(sheet, sel),
        toA1,
        colToName,
        agentCellValueText,
        currentAiModelMeta,
        executeAgentTool,
        addExternalJournal,
        addTableJournal,
        compactForTool,
        disconnectOpenAi: (...args) => openAiAuthModule.disconnectOpenAi(...args),
        uid: () => appIdentityModule.createId(),
        num: (value, fallback = 0) => projectMutationModule.num(value, fallback),
        summarizeChatChunk,
        mergeChatSummary,
      },
    });

    const {
      normalizeAgentPrompt,
      buildAgentInput,
      runOpenAiAgentTurn,
      sanitizeAgentOutputText,
    } = agentRuntimeModule;

    const agentPromptModule = new AgentPromptModule({
      app,
      dom: this._dom,
      windowRef: this._window,
      continuePromptRe: aiContinuePromptRe,
      shortAckPromptRe: aiShortAckPromptRe,
      incompleteResponseRe: aiIncompleteResponseRe,
      toast: (text) => toastModule.show(text),
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
    });

    return { agentPromptModule };
  }
}
