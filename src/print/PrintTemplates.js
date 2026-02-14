export class PrintTemplates {
  static list() {
    return [
      { id: "TEMPLATE_ALL", title: "All sheets", description: "Print all sheets in workbook order" },
      { id: "TEMPLATE_COMMON_ONLY", title: "Common only", description: "Only sheet 'Общее'" },
      { id: "TEMPLATE_ASSEMBLIES_ONLY", title: "Assemblies only", description: "Only assembly sheets" },
      { id: "TEMPLATE_CONSUMABLES_ONLY", title: "Consumables only", description: "Only consumables sheets" },
      { id: "TEMPLATE_PAIR_BY_ABBR", title: "Pair by abbr", description: "Consumables + assembly by abbreviation" }
    ];
  }

  static resolve({ templateId, workbookSnapshot, selectedAbbr }) {
    const names = (workbookSnapshot?.sheets || []).map((sheet) => sheet.name);

    if (templateId === "TEMPLATE_COMMON_ONLY") {
      return { sheetNames: names.filter((name) => name === "Общее") };
    }

    if (templateId === "TEMPLATE_ASSEMBLIES_ONLY") {
      return {
        sheetNames: names.filter((name) => name !== "Общее" && !name.startsWith("Расход. мат. "))
      };
    }

    if (templateId === "TEMPLATE_CONSUMABLES_ONLY") {
      return {
        sheetNames: names.filter((name) => name.startsWith("Расход. мат. "))
      };
    }

    if (templateId === "TEMPLATE_PAIR_BY_ABBR") {
      const abbr = String(selectedAbbr || "").trim();
      return {
        sheetNames: names.filter((name) => name === abbr || name === `Расход. мат. ${abbr}`)
      };
    }

    return { sheetNames: names };
  }
}
