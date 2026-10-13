import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

/**
 * The app is built once and committed to packages/clio/web; `clio build`
 * copies it into every site as `_app/`. File names are fixed so the static
 * pages can reference `_app/app.js` and `_app/app.css` without a manifest.
 */
export default defineConfig({
  plugins: [react()],
  base: "./",
  build: {
    outDir: fileURLToPath(new URL("../clio/web", import.meta.url)),
    emptyOutDir: true,
    target: "es2020",
    cssCodeSplit: false,
    assetsInlineLimit: 0,
    sourcemap: false,
    rollupOptions: {
      input: fileURLToPath(new URL("./src/main.tsx", import.meta.url)),
      output: {
        entryFileNames: "app.js",
        chunkFileNames: "chunks/[name]-[hash].js",
        assetFileNames: (info) => (info.names?.[0]?.endsWith(".css") || info.name?.endsWith(".css") ? "app.css" : "assets/[name]-[hash][extname]"),
      },
    },
  },
});
