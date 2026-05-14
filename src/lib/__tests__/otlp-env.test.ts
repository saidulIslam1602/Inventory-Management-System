import { parseOtlpHeaders } from "@/lib/otlp-env";

describe("parseOtlpHeaders", () => {
  test("returns undefined for empty / whitespace", () => {
    expect(parseOtlpHeaders(undefined)).toBeUndefined();
    expect(parseOtlpHeaders("")).toBeUndefined();
    expect(parseOtlpHeaders("   ")).toBeUndefined();
  });

  test("parses comma-separated key=value pairs", () => {
    expect(parseOtlpHeaders("a=b,c=d")).toEqual({ a: "b", c: "d" });
    expect(parseOtlpHeaders(" Authorization=Bearer%20x , api-key = abc123 ")).toEqual({
      Authorization: "Bearer%20x",
      "api-key": "abc123",
    });
  });

  test("ignores malformed fragments", () => {
    expect(parseOtlpHeaders("naked,,=bad,a=ok")).toEqual({ a: "ok" });
  });
});
