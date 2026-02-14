export class AutoFillService {
  constructor({ tkpSyncService, auditLog, scheduler, ensureAssemblyPair }) {
    this.tkpSyncService = tkpSyncService;
    this.auditLog = auditLog;
    this.scheduler = scheduler;
    this.ensureAssemblyPair = ensureAssemblyPair;
  }

  async preview(actionId, payload) {
    if (actionId === "ACTION_SYNC_MODEL_TO_WORKBOOK") {
      return this.previewModelToWorkbook(payload);
    }

    if (actionId === "ACTION_SYNC_WORKBOOK_TO_MODEL") {
      return this.previewWorkbookToModel(payload);
    }

    throw new Error(`Unknown autofill action: ${actionId}`);
  }

  async previewModelToWorkbook({ tkpModel, workbookSnapshot, editsOverlay }) {
    const requiredAbbrs = tkpModel.assemblies.filter((item) => item.include !== false).map((item) => item.abbr);
    for (const abbr of requiredAbbrs) {
      await this.ensureAssemblyPair?.(abbr);
      await this.scheduler.yieldToUi();
    }

    return this.tkpSyncService.buildWorkbookPatchFromModel({
      tkpModel,
      workbookSnapshot,
      editsOverlay
    });
  }

  async previewWorkbookToModel({ workbookSnapshot, editsOverlay }) {
    const draft = this.tkpSyncService.readModelFromWorkbook({ workbookSnapshot, editsOverlay });
    return {
      title: "Синхронизация книги в модель",
      changes: [],
      stats: { cellsChanged: 0 },
      modelDraft: draft
    };
  }

  apply(patchPlan, context) {
    const nextEdits = this.tkpSyncService.applyPatchPlan(patchPlan, context.workbookSnapshot, context.currentEdits);

    this.auditLog.add({
      ts: Date.now(),
      userAction: "edit",
      sheetName: "*",
      addressA1: "*",
      before: null,
      after: `autofill:${context.actionId} changes=${patchPlan.stats.cellsChanged}`,
      details: {
        actionId: context.actionId,
        userConfirm: true,
        stats: patchPlan.stats
      }
    });

    return nextEdits;
  }
}

