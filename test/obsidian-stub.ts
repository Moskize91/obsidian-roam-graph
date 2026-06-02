export class TFile {
  path = "";
  extension = "";
}

export class TFolder {
  path = "";
}

export class MarkdownView {
  constructor(readonly file: TFile) {}
}

export class Notice {
  constructor(readonly message: string) {}
}

export function normalizePath(path: string): string {
  return path.replace(/\\/g, "/").replace(/\/+/g, "/");
}

export function moment(input: string, format: string, strict: boolean): { isValid: () => boolean; valueOf: () => number } {
  const dateInput = input.split(" ")[0] ?? input;
  const valid = strict && format === "YYYY-MM-DD" && /^\d{4}-\d{2}-\d{2}$/.test(dateInput);
  return {
    isValid: () => valid,
    valueOf: () => (valid ? Date.parse(`${dateInput}T00:00:00.000Z`) : Number.NaN),
  };
}
