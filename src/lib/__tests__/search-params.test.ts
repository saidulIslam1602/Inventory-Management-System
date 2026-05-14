import {
  searchParamFirst,
  searchParamPage,
  searchParamPageSize,
  toQueryString,
} from "@/lib/search-params";

describe("searchParamFirst", () => {
  test("undefined → undefined", () => {
    expect(searchParamFirst(undefined)).toBeUndefined();
  });

  test("empty / whitespace → undefined", () => {
    expect(searchParamFirst("")).toBeUndefined();
    expect(searchParamFirst("   ")).toBeUndefined();
  });

  test("trims single string", () => {
    expect(searchParamFirst("  foo  ")).toBe("foo");
  });

  test("array uses first element only (no scan)", () => {
    expect(searchParamFirst(["  bar  "])).toBe("bar");
    expect(searchParamFirst(["", "bar"])).toBeUndefined();
    expect(searchParamFirst(["   "])).toBeUndefined();
  });
});

describe("searchParamPage", () => {
  test("defaults and clamps invalid", () => {
    expect(searchParamPage(undefined)).toBe(1);
    expect(searchParamPage("not-a-number")).toBe(1);
    expect(searchParamPage("0")).toBe(1);
    expect(searchParamPage("-3")).toBe(1);
  });

  test("parses positive integers", () => {
    expect(searchParamPage("2")).toBe(2);
    expect(searchParamPage(["5"])).toBe(5);
  });

  test("custom fallback", () => {
    expect(searchParamPage(undefined, 3)).toBe(3);
    expect(searchParamPage("bad", 3)).toBe(3);
  });
});

describe("searchParamPageSize", () => {
  test("defaults", () => {
    expect(searchParamPageSize(undefined)).toBe(50);
  });

  test("clamps to min/max", () => {
    expect(searchParamPageSize("5", 50, 10, 100)).toBe(10);
    expect(searchParamPageSize("500", 50, 10, 100)).toBe(100);
    expect(searchParamPageSize("25", 50, 10, 100)).toBe(25);
  });

  test("NaN yields fallback", () => {
    expect(searchParamPageSize("x", 42)).toBe(42);
  });
});

describe("toQueryString", () => {
  test("omits undefined and empty string", () => {
    expect(toQueryString({ a: "1", b: undefined, c: "", d: "x" })).toBe("a=1&d=x");
  });

  test("empty record", () => {
    expect(toQueryString({})).toBe("");
  });
});
