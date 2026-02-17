export class AppBindingsModule {
  constructor({
    app,
    dom,
    windowRef,
    documentRef,
    projectStateApi,
    projectWorkspaceApi,
    openAiAuthApi,
    agentAttachmentApi,
    agentPromptApi,
    projectUiActionApi,
    projectSheetSelectionApi,
    renderAiUi,
    renderJournalViewMode,
    renderOpenAiModelPrice,
    saveAiCollapsed,
    copyJournal,
    copyAllJournals,
    renderAgentJournals,
    activeSheet,
    currentZoom,
    renderTabs,
    renderSheet,
    renderAll,
    copyText,
    toast,
  }) {
    if (!app) throw new Error("AppBindingsModule requires app");
    if (!dom) throw new Error("AppBindingsModule requires dom");
    if (!windowRef) throw new Error("AppBindingsModule requires windowRef");
    if (!documentRef) throw new Error("AppBindingsModule requires documentRef");
    if (!projectStateApi) throw new Error("AppBindingsModule requires projectStateApi");
    if (!projectWorkspaceApi) throw new Error("AppBindingsModule requires projectWorkspaceApi");
    if (!openAiAuthApi) throw new Error("AppBindingsModule requires openAiAuthApi");
    if (!agentAttachmentApi) throw new Error("AppBindingsModule requires agentAttachmentApi");
    if (!agentPromptApi) throw new Error("AppBindingsModule requires agentPromptApi");
    if (!projectUiActionApi) throw new Error("AppBindingsModule requires projectUiActionApi");
    if (!projectSheetSelectionApi) throw new Error("AppBindingsModule requires projectSheetSelectionApi");
    if (typeof renderAiUi !== "function") throw new Error("AppBindingsModule requires renderAiUi()");
    if (typeof renderJournalViewMode !== "function") throw new Error("AppBindingsModule requires renderJournalViewMode()");
    if (typeof renderOpenAiModelPrice !== "function") throw new Error("AppBindingsModule requires renderOpenAiModelPrice()");
    if (typeof saveAiCollapsed !== "function") throw new Error("AppBindingsModule requires saveAiCollapsed()");
    if (typeof copyJournal !== "function") throw new Error("AppBindingsModule requires copyJournal()");
    if (typeof copyAllJournals !== "function") throw new Error("AppBindingsModule requires copyAllJournals()");
    if (typeof renderAgentJournals !== "function") throw new Error("AppBindingsModule requires renderAgentJournals()");
    if (typeof activeSheet !== "function") throw new Error("AppBindingsModule requires activeSheet()");
    if (typeof currentZoom !== "function") throw new Error("AppBindingsModule requires currentZoom()");
    if (typeof renderTabs !== "function") throw new Error("AppBindingsModule requires renderTabs()");
    if (typeof renderSheet !== "function") throw new Error("AppBindingsModule requires renderSheet()");
    if (typeof renderAll !== "function") throw new Error("AppBindingsModule requires renderAll()");
    if (typeof copyText !== "function") throw new Error("AppBindingsModule requires copyText()");
    if (typeof toast !== "function") throw new Error("AppBindingsModule requires toast()");

    this._app = app;
    this._dom = dom;
    this._window = windowRef;
    this._document = documentRef;
    this._projectStateApi = projectStateApi;
    this._projectWorkspaceApi = projectWorkspaceApi;
    this._openAiAuthApi = openAiAuthApi;
    this._agentAttachmentApi = agentAttachmentApi;
    this._agentPromptApi = agentPromptApi;
    this._projectUiActionApi = projectUiActionApi;
    this._projectSheetSelectionApi = projectSheetSelectionApi;
    this._renderAiUi = renderAiUi;
    this._renderJournalViewMode = renderJournalViewMode;
    this._renderOpenAiModelPrice = renderOpenAiModelPrice;
    this._saveAiCollapsed = saveAiCollapsed;
    this._copyJournal = copyJournal;
    this._copyAllJournals = copyAllJournals;
    this._renderAgentJournals = renderAgentJournals;
    this._activeSheet = activeSheet;
    this._currentZoom = currentZoom;
    this._renderTabs = renderTabs;
    this._renderSheet = renderSheet;
    this._renderAll = renderAll;
    this._copyText = copyText;
    this._toast = toast;
    this._floatingTooltipEl = null;
    this._floatingTooltipTarget = null;
  }

  bindEvents() {
    this._dom.btnToggleSidebar.onclick = () => {
      this._app.ui.sidebarCollapsed = !this._app.ui.sidebarCollapsed;
      this._dom.app.classList.toggle("sidebar-collapsed", this._app.ui.sidebarCollapsed);
    };

    if (this._dom.sidebarResizeHandle) {
      this._dom.sidebarResizeHandle.onpointerdown = (e) => this._projectWorkspaceApi.onSidebarResizePointerDown(e);
    }
    this._window.addEventListener("pointermove", (e) => this._projectWorkspaceApi.onSidebarResizePointerMove(e));
    this._window.addEventListener("pointerup", (e) => this._projectWorkspaceApi.onSidebarResizePointerUp(e));
    this._window.addEventListener("pointercancel", (e) => this._projectWorkspaceApi.onSidebarResizePointerUp(e));

    if (this._dom.btnSidebarTabTree) {
      this._dom.btnSidebarTabTree.onclick = () => {
        this._app.ui.sidebarTab = "tree";
        this._renderAiUi();
      };
    }
    if (this._dom.btnSidebarTabJournals) {
      this._dom.btnSidebarTabJournals.onclick = () => {
        this._app.ui.sidebarTab = "journals";
        this._renderAiUi();
      };
    }
    for (const btn of this._dom.journalTabs || []) {
      btn.onclick = () => {
        const k = String(btn.dataset.journalView || "table");
        this._app.ui.journalView = k;
        this._renderJournalViewMode();
      };
    }

    this._dom.btnOpenAiAuth.onclick = () => {
      void this._openAiAuthApi.onOpenAiAuthClick();
    };
    if (this._dom.openAiAuthForm) {
      this._dom.openAiAuthForm.onsubmit = (e) => {
        void this._openAiAuthApi.onOpenAiAuthSubmit(e);
      };
    }
    if (this._dom.btnOpenAiCancel) this._dom.btnOpenAiCancel.onclick = () => this._dom.openAiAuthDialog?.close();
    if (this._dom.btnOpenAiDisconnect) {
      this._dom.btnOpenAiDisconnect.onclick = () => {
        this._openAiAuthApi.disconnectOpenAi();
        if (this._dom.openAiAuthDialog?.open) this._dom.openAiAuthDialog.close();
      };
    }
    if (this._dom.openAiModelSelect) {
      this._dom.openAiModelSelect.onchange = () => this._renderOpenAiModelPrice();
    }
    this._dom.btnToggleAgentPanel.onclick = () => {
      this._app.ai.collapsed = !this._app.ai.collapsed;
      this._saveAiCollapsed();
      this._renderAiUi();
    };
    this._dom.agentChips.onclick = (e) => this._agentAttachmentApi.onAgentChipClick(e);
    this._dom.agentChips.onchange = (e) => this._agentAttachmentApi.onAgentContextIconsChange(e);
    if (this._dom.btnCopyChatJournal) {
      this._dom.btnCopyChatJournal.onclick = () => {
        void this._copyJournal("chat");
      };
    }
    if (this._dom.btnCopyAllJournals) {
      this._dom.btnCopyAllJournals.onclick = () => {
        void this._copyAllJournals();
      };
    }
    if (this._dom.btnCopyTableJournal) {
      this._dom.btnCopyTableJournal.onclick = () => {
        void this._copyJournal("table");
      };
    }
    if (this._dom.btnCopyExternalJournal) {
      this._dom.btnCopyExternalJournal.onclick = () => {
        void this._copyJournal("external");
      };
    }
    if (this._dom.btnCopyChangesJournal) {
      this._dom.btnCopyChangesJournal.onclick = () => {
        void this._copyJournal("changes");
      };
    }
    if (this._dom.btnClearChatJournal) {
      this._dom.btnClearChatJournal.onclick = () => {
        this._app.ai.chatJournal = [];
        this._app.ai.chatSummary = "";
        this._app.ai.chatSummaryCount = 0;
        this._app.ai.lastTaskPrompt = "";
        this._app.ai.lastActionablePrompt = "";
        this._app.ai.pendingTask = "";
        this._app.ai.pendingQuestion = null;
        this._app.ai.lastStreamBuffer = "";
        this._app.ai.streamReasoningBuffer = "";
        this._app.ai.streamEntryId = "";
        this._app.ai.streamDeltaHasPending = false;
        this._app.ai.streamDeltaCount = 0;
        this._app.ai.streamReasoningDeltaCount = 0;
        if (this._app.ai.streamDeltaFlushTimer) {
          this._window.clearTimeout(this._app.ai.streamDeltaFlushTimer);
          this._app.ai.streamDeltaFlushTimer = 0;
        }
        this._renderAgentJournals();
      };
    }
    if (this._dom.btnClearTableJournal) {
      this._dom.btnClearTableJournal.onclick = () => {
        this._app.ai.tableJournal = [];
        this._renderAgentJournals();
      };
    }
    if (this._dom.btnClearExternalJournal) {
      this._dom.btnClearExternalJournal.onclick = () => {
        this._app.ai.externalJournal = [];
        this._renderAgentJournals();
      };
    }
    if (this._dom.btnClearChangesJournal) {
      this._dom.btnClearChangesJournal.onclick = () => {
        this._app.ai.changesJournal = [];
        this._renderAgentJournals();
      };
    }
    if (this._dom.agentContextIcons) {
      this._dom.agentContextIcons.onclick = (e) => this._agentAttachmentApi.onAgentContextIconsClick(e);
      this._dom.agentContextIcons.onchange = (e) => this._agentAttachmentApi.onAgentContextIconsChange(e);
    }
    this._dom.btnAgentSend.onclick = () => {
      void this._agentPromptApi.sendAgentPrompt();
    };
    if (this._dom.agentQuestionFrame) {
      this._dom.agentQuestionFrame.onclick = (e) => {
        void this._agentPromptApi.onAgentQuestionFrameClick(e);
      };
    }
    this._dom.agentPrompt.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        void this._agentPromptApi.sendAgentPrompt();
      }
    });
    this._dom.agentAttachmentInput.onchange = (e) => {
      void this._agentAttachmentApi.onAgentAttachmentsPicked(e);
    };

    if (this._dom.btnSettings) {
      this._dom.btnSettings.onclick = () => this._projectWorkspaceApi.openSettingsDialog();
    }

    if (this._dom.btnAddAssembly) {
      this._dom.btnAddAssembly.onclick = () => this._projectUiActionApi.addAssembly();
    }

    if (this._dom.btnAddPosition) {
      this._dom.btnAddPosition.onclick = () => {
        if (!this._projectUiActionApi.addPositionBySelection()) this._toast("Выберите раздел позиций");
      };
    }

    if (this._dom.btnToggleProjCons) {
      this._dom.btnToggleProjCons.onclick = () => this._projectUiActionApi.toggleProjectConsumables();
    }

    this._dom.btnImportExcel.onclick = () => {
      this._dom.importFile.accept = ".xlsx,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel.sheet.macroEnabled.12";
      this._dom.importFile.click();
    };
    this._dom.btnExportJson.onclick = () => this._projectWorkspaceApi.exportJson();
    this._dom.btnImportJson.onclick = () => {
      this._dom.importFile.accept = "application/json,.json,.xlsx,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel.sheet.macroEnabled.12";
      this._dom.importFile.click();
    };
    this._dom.btnExportXlsx.onclick = () => {
      void this._projectWorkspaceApi.exportXlsx();
    };

    this._dom.importFile.onchange = (e) => {
      void this._projectWorkspaceApi.importJson(e);
    };

    this._dom.tabs.onclick = (e) => {
      const b = e.target.closest("button[data-sheet]");
      if (!b) return;
      this._app.ui.activeSheetId = b.dataset.sheet;
      this._app.ui.selection = null;
      this._renderTabs();
      this._renderSheet();
    };

    this._dom.tree.onclick = (e) => this._projectUiActionApi.onTreeClick(e);
    this._dom.tree.onpointerdown = (e) => this._projectUiActionApi.onTreePointerDown(e);
    this._dom.tree.onpointermove = (e) => this._projectUiActionApi.onTreePointerMove(e);
    this._dom.tree.onpointerup = (e) => this._projectUiActionApi.onTreePointerUp(e);
    this._dom.tree.onpointercancel = () => this._projectUiActionApi.onTreePointerCancel();
    this._dom.tree.oncontextmenu = (e) => this._projectUiActionApi.onTreeContextMenu(e);
    this._dom.inspector.onclick = (e) => this._projectUiActionApi.onInspectorClick(e);
    this._dom.inspector.onchange = (e) => this._projectUiActionApi.onInspectorChange(e);

    this._dom.settingsForm.onsubmit = (e) => {
      e.preventDefault();
      this._projectWorkspaceApi.applySettingsForm();
      this._dom.settingsDialog.close();
      this._renderAll();
    };

    this._dom.viewport.oncontextmenu = (e) => e.preventDefault();
    this._dom.viewport.onmousedown = (e) => this._projectSheetSelectionApi.onViewportMouseDown(e);
    this._window.onmousemove = (e) => this._projectSheetSelectionApi.onViewportMouseMove(e);
    this._window.onmouseup = (e) => this._projectSheetSelectionApi.onViewportMouseUp(e);
    this._document.addEventListener("mousedown", (e) => this._projectSheetSelectionApi.onDocumentMouseDown(e), true);
    this._document.addEventListener("click", (e) => this._agentAttachmentApi.onDocumentClick(e));

    this._dom.viewport.addEventListener("wheel", (e) => {
      e.preventDefault();
      const s = this._activeSheet();
      if (!s) return;
      const curr = this._currentZoom(s);
      const next = this._projectStateApi.clamp(curr * (e.deltaY < 0 ? 1.08 : 0.92), 0.45, 2.1);
      if (Math.abs(next - curr) < 0.0001) return;

      const rect = this._dom.viewport.getBoundingClientRect();
      const mouseViewportX = e.clientX - rect.left;
      const mouseViewportY = e.clientY - rect.top;
      const worldX = (this._dom.viewport.scrollLeft + mouseViewportX) / curr;
      const worldY = (this._dom.viewport.scrollTop + mouseViewportY) / curr;

      this._app.ui.zoomBySheet[s.id] = next;
      this._dom.canvas.style.setProperty("--sheet-zoom", String(next));
      this._dom.viewport.scrollLeft = worldX * next - mouseViewportX;
      this._dom.viewport.scrollTop = worldY * next - mouseViewportY;
      this._toast(`Масштаб: ${Math.round(next * 100)}%`);
    }, { passive: false });

    this._document.addEventListener("copy", (e) => {
      if (this._projectSheetSelectionApi.editableFocus()) return;
      const s = this._activeSheet();
      const sel = this._app.ui.selection;
      if (!s || !sel || sel.sheet !== s.id) return;
      const text = this._projectSheetSelectionApi.selectionText(s, sel);
      if (!text) return;
      if (e.clipboardData) {
        e.preventDefault();
        e.clipboardData.setData("text/plain", text);
        this._toast("Скопировано");
      }
    });

    this._document.addEventListener("keydown", async (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c") {
        if (this._projectSheetSelectionApi.editableFocus()) return;
        const s = this._activeSheet();
        const sel = this._app.ui.selection;
        if (!s || !sel || sel.sheet !== s.id) return;
        e.preventDefault();
        const text = this._projectSheetSelectionApi.selectionText(s, sel);
        await this._copyText(text);
        this._toast("Скопировано");
      }
    });

    this._document.addEventListener("pointerover", (e) => this._onTooltipPointerOver(e), true);
    this._document.addEventListener("pointermove", (e) => this._onTooltipPointerMove(e), true);
    this._document.addEventListener("pointerout", (e) => this._onTooltipPointerOut(e), true);
    this._document.addEventListener("scroll", () => this._hideFloatingTooltip(), true);
    this._window.addEventListener("resize", () => this._hideFloatingTooltip());
    this._window.addEventListener("blur", () => this._hideFloatingTooltip());
  }

  _resolveTooltipTarget(node) {
    if (!node || typeof node.closest !== "function") return null;
    const target = node.closest("[data-tooltip]");
    if (!target) return null;
    const text = String(target.dataset?.tooltip || "").trim();
    return text ? target : null;
  }

  _ensureFloatingTooltip() {
    if (this._floatingTooltipEl && this._floatingTooltipEl.isConnected) return this._floatingTooltipEl;
    const el = this._document.createElement("div");
    el.className = "agent-floating-tooltip";
    el.hidden = true;
    el.setAttribute("role", "tooltip");
    this._document.body.appendChild(el);
    this._floatingTooltipEl = el;
    return el;
  }

  _showFloatingTooltip(target, clientX, clientY) {
    if (!target) return;
    const text = String(target.dataset?.tooltip || "").trim();
    if (!text) {
      this._hideFloatingTooltip();
      return;
    }
    const el = this._ensureFloatingTooltip();
    this._floatingTooltipTarget = target;
    el.textContent = text;
    el.hidden = false;
    this._placeFloatingTooltip(el, target, clientX, clientY);
  }

  _hideFloatingTooltip() {
    this._floatingTooltipTarget = null;
    if (!this._floatingTooltipEl) return;
    this._floatingTooltipEl.hidden = true;
  }

  _placeFloatingTooltip(el, target, clientX, clientY) {
    if (!el || el.hidden) return;
    const margin = 8;
    const offset = 14;
    const viewportW = Math.max(0, this._window.innerWidth || 0);
    const viewportH = Math.max(0, this._window.innerHeight || 0);
    const anchorRect = target?.getBoundingClientRect ? target.getBoundingClientRect() : null;

    let x = Number.isFinite(clientX) ? clientX : (anchorRect ? anchorRect.left + anchorRect.width / 2 : margin);
    let y = Number.isFinite(clientY) ? clientY : (anchorRect ? anchorRect.bottom : margin);

    x += offset;
    y += offset;

    const rect = el.getBoundingClientRect();
    if (x + rect.width > viewportW - margin) x -= rect.width + offset * 2;
    if (y + rect.height > viewportH - margin) y -= rect.height + offset * 2;
    x = Math.max(margin, Math.min(x, Math.max(margin, viewportW - rect.width - margin)));
    y = Math.max(margin, Math.min(y, Math.max(margin, viewportH - rect.height - margin)));

    el.style.left = `${Math.round(x)}px`;
    el.style.top = `${Math.round(y)}px`;
  }

  _onTooltipPointerOver(e) {
    const target = this._resolveTooltipTarget(e?.target || null);
    if (!target) return;
    this._showFloatingTooltip(target, e?.clientX, e?.clientY);
  }

  _onTooltipPointerMove(e) {
    if (!this._floatingTooltipTarget || !this._floatingTooltipEl || this._floatingTooltipEl.hidden) return;
    const current = this._resolveTooltipTarget(e?.target || null);
    if (current && current !== this._floatingTooltipTarget) {
      this._showFloatingTooltip(current, e?.clientX, e?.clientY);
      return;
    }
    if (!current) {
      this._hideFloatingTooltip();
      return;
    }
    this._placeFloatingTooltip(this._floatingTooltipEl, this._floatingTooltipTarget, e?.clientX, e?.clientY);
  }

  _onTooltipPointerOut(e) {
    if (!this._floatingTooltipTarget) return;
    const from = this._resolveTooltipTarget(e?.target || null);
    if (from !== this._floatingTooltipTarget) return;
    const to = this._resolveTooltipTarget(e?.relatedTarget || null);
    if (to === this._floatingTooltipTarget) return;
    this._hideFloatingTooltip();
  }
}
