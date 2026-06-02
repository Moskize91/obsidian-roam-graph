import { describe, expect, it, vi } from "vitest";
import { resolveDailyContext } from "./daily-context";

vi.mock("obsidian", () => ({
  normalizePath: (path: string) => path.replace(/\\/g, "/").replace(/\/+/g, "/"),
  moment: (input: string, format: string, strict: boolean) => {
    const dateInput = input.split(" ")[0] ?? input;
    const valid = strict && format === "YYYY-MM-DD" && /^\d{4}-\d{2}-\d{2}$/.test(dateInput);
    return {
      isValid: () => valid,
      valueOf: () => (valid ? Date.parse(`${dateInput}T00:00:00.000Z`) : Number.NaN),
    };
  },
}));

type FakeFile = {
  path: string;
  extension: string;
  stat: {
    size: number;
    mtime: number;
  };
};

function file(path: string, size: number, mtime: number): FakeFile {
  return {
    path,
    extension: "md",
    stat: { size, mtime },
  };
}

function app(files: FakeFile[], dailyNotesSettings: unknown, options: { readError?: Error } = {}) {
  return {
    vault: {
      configDir: ".obsidian",
      getMarkdownFiles: () => files,
      adapter: {
        read: async () => {
          if (options.readError) throw options.readError;
          return JSON.stringify(dailyNotesSettings);
        },
      },
    },
  };
}

describe("resolveDailyContext", () => {
  it("returns nearby daily notes around the active daily note", async () => {
    const files = [
      file("Daily/2026-05-30.md", 10, 100),
      file("Daily/2026-05-31.md", 20, 200),
      file("Daily/2026-06-01.md", 30, 300),
      file("Daily/2026-06-02.md", 40, 400),
      file("Projects/2026-06-03.md", 50, 500),
    ];

    await expect(
      resolveDailyContext(app(files, { folder: "Daily", format: "YYYY-MM-DD" }) as never, files[2] as never, 1),
    ).resolves.toEqual({
      previous: [{ path: "Daily/2026-05-31.md", size: 20, mtime: 200 }],
      next: [{ path: "Daily/2026-06-02.md", size: 40, mtime: 400 }],
    });
  });

  it("returns empty context when disabled or settings are unavailable", async () => {
    const center = file("Daily/2026-06-01.md", 30, 300);

    await expect(resolveDailyContext(app([center], { folder: "Daily", format: "YYYY-MM-DD" }) as never, center as never, 0)).resolves.toEqual({
      previous: [],
      next: [],
    });

    await expect(resolveDailyContext(app([center], { folder: "Daily" }) as never, center as never, 2)).resolves.toEqual({
      previous: [],
      next: [],
    });
  });

  it("returns empty context when daily notes settings cannot be read", async () => {
    const center = file("Daily/2026-06-01.md", 30, 300);

    await expect(resolveDailyContext(app([center], null, { readError: new Error("missing") }) as never, center as never, 2)).resolves.toEqual({
      previous: [],
      next: [],
    });
  });

  it("uses path ordering when parsed daily note dates are equal", async () => {
    const files = [
      file("Daily/2026-06-01 a.md", 10, 100),
      file("Daily/2026-06-01 b.md", 20, 200),
      file("Daily/2026-06-02.md", 30, 300),
    ];

    await expect(
      resolveDailyContext(app(files, { folder: "Daily", format: "YYYY-MM-DD" }) as never, files[1] as never, 1),
    ).resolves.toEqual({
      previous: [{ path: "Daily/2026-06-01 a.md", size: 10, mtime: 100 }],
      next: [{ path: "Daily/2026-06-02.md", size: 30, mtime: 300 }],
    });
  });
});
