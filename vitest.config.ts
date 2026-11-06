import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Tests build their own mocks per file and share no module state, so reusing workers is safe and ~3x faster.
    isolate: false,
  },
});
