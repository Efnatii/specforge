import { AiJournalModule } from "../../journal/index.js";

export class AppJournalCompositionModule {
  constructor({ config, dom }) {
    if (!config) throw new Error("AppJournalCompositionModule requires config");
    if (!dom) throw new Error("AppJournalCompositionModule requires dom");
    this._config = config;
    this._dom = dom;
  }

  compose({
    app,
    projectMutationModule,
    appFormattingModule,
    appIdentityModule,
  }) {
    if (!app) throw new Error("AppJournalCompositionModule.compose requires app");
    if (!projectMutationModule) throw new Error("AppJournalCompositionModule.compose requires projectMutationModule");
    if (!appFormattingModule) throw new Error("AppJournalCompositionModule.compose requires appFormattingModule");
    if (!appIdentityModule) throw new Error("AppJournalCompositionModule.compose requires appIdentityModule");

    const {
      aiModels,
      defaultAiModel,
      webSearchPriceNote,
      storageKeys,
      maxChatJournal,
      maxTableJournal,
      maxExternalJournal,
      maxChangesJournal,
      maxChatJournalText,
      maxCommonJournalText,
      chatContextRecentMessages,
      chatSummaryChunkSize,
      maxChatSummaryChars,
      minSidebarWidth,
      maxSidebarWidth,
      journalRenderDebounceMs,
      streamDeltaFlushMs,
      streamTextPreviewLimit,
    } = this._config;

    return new AiJournalModule({
      app,
      dom: this._dom,
      config: {
        AI_MODELS: aiModels,
        DEFAULT_AI_MODEL: defaultAiModel,
        WEB_SEARCH_PRICE_NOTE: webSearchPriceNote,
        STORAGE_KEYS: storageKeys,
        MAX_CHAT_JOURNAL: maxChatJournal,
        MAX_TABLE_JOURNAL: maxTableJournal,
        MAX_EXTERNAL_JOURNAL: maxExternalJournal,
        MAX_CHANGES_JOURNAL: maxChangesJournal,
        MAX_CHAT_JOURNAL_TEXT: maxChatJournalText,
        MAX_COMMON_JOURNAL_TEXT: maxCommonJournalText,
        CHAT_CONTEXT_RECENT_MESSAGES: chatContextRecentMessages,
        CHAT_SUMMARY_CHUNK_SIZE: chatSummaryChunkSize,
        MAX_CHAT_SUMMARY_CHARS: maxChatSummaryChars,
        MIN_SIDEBAR_WIDTH: minSidebarWidth,
        MAX_SIDEBAR_WIDTH: maxSidebarWidth,
        JOURNAL_RENDER_DEBOUNCE_MS: journalRenderDebounceMs,
        STREAM_DELTA_FLUSH_MS: streamDeltaFlushMs,
        STREAM_TEXT_PREVIEW_LIMIT: streamTextPreviewLimit,
      },
      helpers: {
        num: (value, fallback = 0) => projectMutationModule.num(value, fallback),
        esc: (value) => appFormattingModule.escapeHtml(value),
        uid: () => appIdentityModule.createId(),
      },
    });
  }
}
