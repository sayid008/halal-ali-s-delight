// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import type { Plugin, ViteDevServer } from "vite";
import { handleDatabaseApiRequest } from "./src/lib/server-db-handlers";

function databaseApiPlugin(): Plugin {
  return {
    name: "database-api-middleware",
    configureServer(server: ViteDevServer) {
      server.middlewares.use((req, res, next) => {
        handleDatabaseApiRequest(req, res, next);
      });
    },
  };
}

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    envPrefix: ["VITE_", "SUPABASE_"],
    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(
        process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "",
      ),
      "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify(
        process.env.VITE_SUPABASE_ANON_KEY ||
          process.env.SUPABASE_ANON_KEY ||
          process.env.SUPABASE_KEY ||
          "",
      ),
      "import.meta.env.SUPABASE_URL": JSON.stringify(
        process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "",
      ),
      "import.meta.env.SUPABASE_ANON_KEY": JSON.stringify(
        process.env.SUPABASE_ANON_KEY ||
          process.env.VITE_SUPABASE_ANON_KEY ||
          process.env.SUPABASE_KEY ||
          "",
      ),
    },
    plugins: [databaseApiPlugin()],
    server: {
      host: "0.0.0.0",
      port: 3000,
      allowedHosts: true,
    },
    build: {
      rollupOptions: {
        onLog(
          level: string,
          log: { code?: string; message?: string },
          defaultHandler: (level: string, log: unknown) => void,
        ) {
          if (
            log.code === "MODULE_LEVEL_DIRECTIVE" &&
            typeof log.message === "string" &&
            log.message.includes('"use client"')
          ) {
            return;
          }
          defaultHandler(level, log);
        },
        onwarn(warning: { code?: string; message?: string }, warn: (warning: unknown) => void) {
          if (
            warning.code === "MODULE_LEVEL_DIRECTIVE" &&
            typeof warning.message === "string" &&
            warning.message.includes('"use client"')
          ) {
            return;
          }
          warn(warning);
        },
      },
    },
  },
});
