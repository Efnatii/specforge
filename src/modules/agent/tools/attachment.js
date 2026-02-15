export class AgentAttachmentModule {
  constructor({
    app,
    dom,
    addChangesJournal,
    saveAiOptions,
    renderAiUi,
    toast,
    createId,
    num,
  }) {
    if (!app) throw new Error("AgentAttachmentModule requires app");
    if (!dom) throw new Error("AgentAttachmentModule requires dom");
    if (typeof addChangesJournal !== "function") throw new Error("AgentAttachmentModule requires addChangesJournal()");
    if (typeof saveAiOptions !== "function") throw new Error("AgentAttachmentModule requires saveAiOptions()");
    if (typeof renderAiUi !== "function") throw new Error("AgentAttachmentModule requires renderAiUi()");
    if (typeof toast !== "function") throw new Error("AgentAttachmentModule requires toast()");
    if (typeof createId !== "function") throw new Error("AgentAttachmentModule requires createId()");
    if (typeof num !== "function") throw new Error("AgentAttachmentModule requires num()");

    this._app = app;
    this._dom = dom;
    this._addChangesJournal = addChangesJournal;
    this._saveAiOptions = saveAiOptions;
    this._renderAiUi = renderAiUi;
    this._toast = toast;
    this._createId = createId;
    this._num = num;
  }

  onAgentChipClick(e) {
    const remove = e.target.closest("button.remove");
    if (!remove) return;
    const chip = e.target.closest(".agent-chip");
    if (!chip) return;
    const type = chip.dataset.chipType;
    if (type !== "file") return;

    const id = chip.dataset.chipId;
    const removed = this._app.ai.attachments.find((f) => f.id === id);
    this._app.ai.attachments = this._app.ai.attachments.filter((f) => f.id !== id);
    if (removed) this._addChangesJournal("ai.file.detach", removed.name);
    this._renderAiUi();
  }

  onAgentContextIconsClick(e) {
    const btn = e.target.closest("[data-ai-option]");
    if (!btn) return;
    const option = String(btn.dataset.aiOption || "");

    if (option === "files") {
      this._dom.agentAttachmentInput.click();
      return;
    }

    if (!(option in this._app.ai.options)) return;
    this._app.ai.options[option] = !this._app.ai.options[option];
    if (option === "allowQuestions" && !this._app.ai.options[option]) {
      this._app.ai.pendingQuestion = null;
    }
    this._saveAiOptions();
    this._addChangesJournal("ai.option", `${option}=${this._app.ai.options[option] ? "on" : "off"}`);
    this._renderAiUi();
  }

  async onAgentAttachmentsPicked(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const incoming = [];
    for (const file of files) {
      const entry = await this._makeAgentAttachment(file);
      incoming.push(entry);
    }
    this._app.ai.attachments.push(...incoming);
    this._dom.agentAttachmentInput.value = "";
    this._addChangesJournal("ai.file.attach", `Добавлено файлов: ${incoming.length}`);
    this._renderAiUi();
    this._toast(`Файлы прикреплены: ${incoming.length}`);
  }

  async _makeAgentAttachment(file) {
    const textLike = /^text\//i.test(file.type) || /\.(txt|md|csv|json|xml|yml|yaml|js|ts|html|css)$/i.test(file.name);
    let text = "";
    let truncated = false;
    if (textLike) {
      try {
        const raw = await file.text();
        const maxChars = 40000;
        text = raw.slice(0, maxChars);
        truncated = raw.length > maxChars;
      } catch {}
    }
    return {
      id: this._createId(),
      name: String(file.name || "file"),
      size: this._num(file.size, 0),
      type: String(file.type || "application/octet-stream"),
      text,
      truncated,
    };
  }
}
