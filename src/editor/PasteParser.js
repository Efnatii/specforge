export class PasteParser {
  constructor({ maxCellsPerPaste = 50000 } = {}) {
    this.maxCellsPerPaste = maxCellsPerPaste;
  }

  parseText(text) {
    const normalized = String(text ?? "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    const lines = normalized.split("\n");

    if (lines.length > 1 && lines[lines.length - 1] === "") {
      lines.pop();
    }

    const matrix = lines.map((line) => line.split("\t"));
    const rows = matrix.length;
    const cols = matrix.reduce((max, row) => Math.max(max, row.length), 0);

    if (rows * cols > this.maxCellsPerPaste) {
      throw new Error(`Вставка слишком большая (${rows * cols} ячеек), лимит ${this.maxCellsPerPaste}`);
    }

    for (const row of matrix) {
      while (row.length < cols) {
        row.push("");
      }
    }

    return { matrix, rows, cols };
  }
}

