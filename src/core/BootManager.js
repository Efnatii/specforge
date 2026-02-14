import { RecoveryPolicy } from "./RecoveryPolicy.js";

export class BootManager {
  constructor({ idbStore, templateBufferStore, stateStore, onLoadWorkbookFromBuffer }) {
    this.idbStore = idbStore;
    this.templateBufferStore = templateBufferStore;
    this.stateStore = stateStore;
    this.recoveryPolicy = new RecoveryPolicy({});
    this.onLoadWorkbookFromBuffer = onLoadWorkbookFromBuffer;
  }

  async boot() {
    this.stateStore.update({ boot: { phase: "BOOT" } });

    const snapshot = await this.idbStore.get("lastSnapshot").catch(() => null);
    const jobsSnapshot = await this.idbStore.get("jobsSnapshot").catch(() => ({}));
    const workbook = await this.idbStore.get("lastWorkbook").catch(() => null);
    const baseline = await this.templateBufferStore.restore().catch(() => null);

    this.stateStore.update({ boot: { phase: "LOAD_SNAPSHOT" } });

    if (snapshot) {
      this.stateStore.update(snapshot);
    }
    if (jobsSnapshot && typeof jobsSnapshot === "object") {
      this.stateStore.update({ jobs: jobsSnapshot });
    }

    if (workbook?.sheets?.length) {
      this.onLoadWorkbookFromBuffer?.(workbook, baseline?.buffer || null, baseline?.meta || null);
    }

    const recovered = this.recoveryPolicy.apply(this.stateStore.getState().jobs || {});
    this.stateStore.update({ jobs: recovered.jobs, boot: { phase: "RESUME" } });

    this.stateStore.update({ boot: { phase: "READY" }, recovery: recovered.summary });
    return { snapshot, workbook, baseline, recovery: recovered.summary };
  }
}
