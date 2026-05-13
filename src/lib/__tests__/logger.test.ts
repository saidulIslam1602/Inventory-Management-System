import { parseLogLevel } from "@/lib/logger";

describe("parseLogLevel", () => {
  test("accepts known levels case-insensitively", () => {
    expect(parseLogLevel("WARN")).toBe("warn");
    expect(parseLogLevel(" error ")).toBe("error");
  });

  test("invalid strings fall back using current NODE_ENV", () => {
    const out = parseLogLevel("verbose");
    expect(["info", "debug"]).toContain(out);
  });
});
