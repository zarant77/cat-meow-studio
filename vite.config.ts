import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        app: fileURLToPath(new URL("./index.html", import.meta.url)),
        help: fileURLToPath(new URL("./help.html", import.meta.url)),
      },
    },
  },
  server: {
    host: true,
  },
});
