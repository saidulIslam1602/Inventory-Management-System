import type { UserConfig } from "@commitlint/types";

const config: UserConfig = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    // Enforce conventional commit types relevant to this project
    "type-enum": [
      2,
      "always",
      ["feat", "fix", "chore", "docs", "style", "refactor", "test", "ci", "perf", "revert"],
    ],
    "subject-case": [2, "always", "sentence-case"],
  },
};

export default config;
