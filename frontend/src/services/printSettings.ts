export interface PrintTemplateSettings {
  defaultTemplate: string;
  showCompanyLogo: boolean;
  showCompanyAddress: boolean;
  showTaxId: boolean;
  showNotes: boolean;
  showUrduName: boolean;
  footerText: string;
}

export const DEFAULT_PRINT_TEMPLATE_SETTINGS: PrintTemplateSettings = {
  defaultTemplate: "invoice",
  showCompanyLogo: true,
  showCompanyAddress: true,
  showTaxId: true,
  showNotes: true,
  showUrduName: false,
  footerText: "",
};

export const getPrintTemplateSettings = (): PrintTemplateSettings => {
  const raw = localStorage.getItem("printTemplateSettings");
  if (!raw) return { ...DEFAULT_PRINT_TEMPLATE_SETTINGS };
  try {
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_PRINT_TEMPLATE_SETTINGS,
      ...(parsed || {}),
      showUrduName: Boolean((parsed || {}).showUrduName),
    };
  } catch {
    return { ...DEFAULT_PRINT_TEMPLATE_SETTINGS };
  }
};

