export class DisplayValueService {
  getDisplay({ sheetName, addressA1, baselineCell, overlayEdit, calcResult }) {
    if (baselineCell?.formula) {
      if (calcResult?.error) {
        return {
          text: calcResult.error,
          raw: null,
          kind: "error",
          error: calcResult.error,
          sheetName,
          addressA1
        };
      }

      return {
        text: calcResult?.value ?? "",
        raw: calcResult?.value ?? null,
        kind: "formula",
        error: null,
        sheetName,
        addressA1
      };
    }

    if (overlayEdit) {
      return {
        text: overlayEdit.value ?? "",
        raw: overlayEdit.value ?? null,
        kind: overlayEdit.value === null ? "empty" : "value",
        error: null,
        sheetName,
        addressA1
      };
    }

    if (baselineCell && baselineCell.value !== null && baselineCell.value !== undefined) {
      return {
        text: baselineCell.value,
        raw: baselineCell.value,
        kind: "value",
        error: null,
        sheetName,
        addressA1
      };
    }

    return {
      text: "",
      raw: null,
      kind: "empty",
      error: null,
      sheetName,
      addressA1
    };
  }
}
