import "@testing-library/jest-dom";
import { TextDecoder, TextEncoder } from "node:util";

// Prisma client pulls in code that expects Web APIs; jsdom omits TextEncoder by default.
if (typeof globalThis.TextEncoder === "undefined") {
  globalThis.TextEncoder = TextEncoder as unknown as typeof globalThis.TextEncoder;
}
if (typeof globalThis.TextDecoder === "undefined") {
  globalThis.TextDecoder = TextDecoder as unknown as typeof globalThis.TextDecoder;
}
