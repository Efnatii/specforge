export class PrintTemplates {
  static list() {
    return [
      { id: "TEMPLATE_ALL", title: "Все листы", description: "Печать всех листов в порядке книги" },
      { id: "TEMPLATE_COMMON_ONLY", title: "Только Общее", description: "Только лист 'Общее'" },
      { id: "TEMPLATE_ASSEMBLIES_ONLY", title: "Только сборки", description: "Только листы сборок" },
      { id: "TEMPLATE_CONSUMABLES_ONLY", title: "Только расходные", description: "Только листы расходных материалов" },
      { id: "TEMPLATE_PAIR_BY_ABBR", title: "Пара по АББР", description: "Расходные + сборка по выбранной аббревиатуре" }
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
