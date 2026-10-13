import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const reviewerRoot = fileURLToPath(new URL(".", import.meta.url));
const reviewerDist = fileURLToPath(new URL("./dist", import.meta.url));

export default defineConfig({
  root: reviewerRoot,
  envDir: reviewerRoot,
  build: {
    outDir: reviewerDist,
    emptyOutDir: true,
    sourcemap: false,
  },
  server: {
    host: "127.0.0.1",
    port: 5178,
    strictPort: true,
  },
});
