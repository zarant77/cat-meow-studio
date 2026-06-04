import { defineConfig } from "vite";

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        app: "index.html",
        help: "help.html",
      },
    },
  },
  server: {
    host: true,
  },
});
