import type { Config } from "jest";
import nextJest from "next/jest.js";

const createJestConfig = nextJest({ dir: "./" });

const config: Config = {
  coverageProvider: "v8",
  testEnvironment: "node",
  setupFilesAfterEnv: ["<rootDir>/tests/integration/jest.integration.setup.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  testMatch: ["<rootDir>/tests/integration/**/*.integration.test.ts"],
  testTimeout: 120_000,
  modulePathIgnorePatterns: ["<rootDir>/.next/", "<rootDir>/docker/"],
};

export default createJestConfig(config);
