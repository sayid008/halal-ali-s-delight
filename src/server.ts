import "./lib/error-capture";
import fs from "node:fs";
import path from "node:path";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

const DB_DIR = path.resolve(process.cwd(), "data");
const DB_FILE = path.resolve(DB_DIR, "menu-db.json");
const OFFER_FILE = path.resolve(DB_DIR, "special-offer-db.json");

function ensureDbFile() {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
}

function readDb() {
  try {
    ensureDbFile();
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, "utf-8");
      return JSON.parse(data);
    }
  } catch (e) {
    console.error("Failed to read menu-db.json:", e);
  }
  return { categories: [], items: [] };
}

function writeDb(categories: unknown, items: unknown) {
  try {
    ensureDbFile();
    fs.writeFileSync(DB_FILE, JSON.stringify({ categories, items }, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to write menu-db.json:", err);
  }
}

function readOfferDb() {
  try {
    ensureDbFile();
    if (fs.existsSync(OFFER_FILE)) {
      const data = fs.readFileSync(OFFER_FILE, "utf-8");
      return JSON.parse(data);
    }
  } catch (e) {
    console.error("Failed to read special-offer-db.json:", e);
  }
  return null;
}

function writeOfferDb(offer: unknown) {
  try {
    ensureDbFile();
    fs.writeFileSync(OFFER_FILE, JSON.stringify(offer, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to write special-offer-db.json:", err);
  }
}

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!body.includes('"unhandled":true') || !body.includes('"message":"HTTPError"')) {
    return response;
  }

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const url = new URL(request.url);

      if (url.pathname === "/api/menu") {
        if (request.method === "OPTIONS") {
          return new Response(null, {
            status: 204,
            headers: {
              "access-control-allow-origin": "*",
              "access-control-allow-methods": "GET, POST, OPTIONS",
              "access-control-allow-headers": "content-type",
            },
          });
        }

        if (request.method === "GET") {
          const dbData = readDb();
          return new Response(JSON.stringify(dbData), {
            status: 200,
            headers: {
              "content-type": "application/json",
              "access-control-allow-origin": "*",
              "cache-control": "no-cache, no-store, must-revalidate",
            },
          });
        }

        if (request.method === "POST" || request.method === "PUT") {
          try {
            const body = (await request.json()) as { categories?: unknown[]; items?: unknown[] };
            const categories = body.categories || [];
            const items = body.items || [];
            writeDb(categories, items);
            return new Response(JSON.stringify({ success: true, categories, items }), {
              status: 200,
              headers: {
                "content-type": "application/json",
                "access-control-allow-origin": "*",
              },
            });
          } catch (err: unknown) {
            const errMsg = err instanceof Error ? err.message : "Invalid payload";
            return new Response(JSON.stringify({ error: errMsg }), {
              status: 400,
              headers: { "content-type": "application/json" },
            });
          }
        }
      }

      if (url.pathname === "/api/special-offer") {
        if (request.method === "OPTIONS") {
          return new Response(null, {
            status: 204,
            headers: {
              "access-control-allow-origin": "*",
              "access-control-allow-methods": "GET, POST, OPTIONS",
              "access-control-allow-headers": "content-type",
            },
          });
        }

        if (request.method === "GET") {
          const offer = readOfferDb();
          return new Response(JSON.stringify({ offer }), {
            status: 200,
            headers: {
              "content-type": "application/json",
              "access-control-allow-origin": "*",
              "cache-control": "no-cache, no-store, must-revalidate",
            },
          });
        }

        if (request.method === "POST" || request.method === "PUT") {
          try {
            const offer = await request.json();
            writeOfferDb(offer);
            return new Response(JSON.stringify({ success: true, offer }), {
              status: 200,
              headers: {
                "content-type": "application/json",
                "access-control-allow-origin": "*",
              },
            });
          } catch (err: unknown) {
            const errMsg = err instanceof Error ? err.message : "Invalid payload";
            return new Response(JSON.stringify({ error: errMsg }), {
              status: 400,
              headers: { "content-type": "application/json" },
            });
          }
        }
      }

      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
