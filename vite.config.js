import { defineConfig } from "vite";

export default defineConfig({
  root: "./src",
  publicDir: "../assets",
  server: {
    port: 3000,
    open: true,
  },
  build: {
    outDir: "../dist",
    emptyOutDir: true,
  },
});
