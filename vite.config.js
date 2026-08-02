import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Relative base works for GitHub Pages project sites
// (e.g. surferyogi.github.io/inkpath) without hardcoding the repo name.
export default defineConfig({
  base: "./",
  plugins: [react()],
});
