export class WorkbookPipeline {
  constructor({ jobQueue, templateLoader, workbookAdapter, onBeforeLoad, onAfterLoad, onError, assertNotAborted }) {
    this.jobQueue = jobQueue;
    this.templateLoader = templateLoader;
    this.workbookAdapter = workbookAdapter;
    this.onBeforeLoad = onBeforeLoad;
    this.onAfterLoad = onAfterLoad;
    this.onError = onError;
    this.assertNotAborted = assertNotAborted;
  }

  async loadFromAsset(baseUrl) {
    const assetUrl = `${baseUrl}assets/template.xlsx`;
    return this.runLoadPipeline({ source: "asset", assetUrl });
  }

  async loadFromFile(file) {
    return this.runLoadPipeline({ source: "file", file });
  }

  async runLoadPipeline({ source, assetUrl, file }) {
    this.onBeforeLoad();

    try {
      const loadResult = await this.runLoadJob(source, assetUrl, file);
      const workbook = await this.runParseJob(loadResult.buffer);
      await this.onAfterLoad(workbook, loadResult.meta, loadResult.buffer);
      return workbook;
    } catch (error) {
      this.onError(error);
      throw error;
    }
  }

  async runLoadJob(source, assetUrl, file) {
    const jobType = source === "asset" ? "LOAD_TEMPLATE_ASSET" : "LOAD_TEMPLATE_FILE";
    const jobTitle = source === "asset" ? "Загрузка шаблона из assets" : "Загрузка шаблона из файла";

    const { promise } = this.jobQueue.enqueue({
      type: jobType,
      title: jobTitle,
      run: async (_, signal, reportProgress) => {
        this.assertNotAborted(signal);
        reportProgress({ completed: 0, total: 1, message: "Чтение источника" });

        const result = source === "asset"
          ? await this.templateLoader.loadFromAsset(assetUrl)
          : await this.templateLoader.loadFromFile(file);

        this.assertNotAborted(signal);
        reportProgress({ completed: 1, total: 1, message: "Буфер готов" });
        return result;
      }
    });

    return promise;
  }

  async runParseJob(buffer) {
    const parseBuffer = buffer.slice(0);
    const { promise } = this.jobQueue.enqueue({
      type: "PARSE_WORKBOOK",
      title: "Парсинг книги",
      workerOp: "PARSE_WORKBOOK",
      workerPayload: { xlsxBuffer: parseBuffer },
      transfer: [parseBuffer]
    });

    const result = await promise;
    return result.normalizedWorkbook || result;
  }
}


