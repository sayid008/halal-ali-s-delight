import fs from "node:fs";
import path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";

const DB_DIR = path.resolve(process.cwd(), "data");
const MENU_FILE = path.resolve(DB_DIR, "menu-db.json");
const OFFER_FILE = path.resolve(DB_DIR, "special-offer-db.json");
const HOURS_FILE = path.resolve(DB_DIR, "opening-hours-db.json");

function ensureDbFile() {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
}

export function readMenuDb() {
  try {
    ensureDbFile();
    if (fs.existsSync(MENU_FILE)) {
      const raw = fs.readFileSync(MENU_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.categories) && Array.isArray(parsed.items)) {
        return parsed;
      }
    }
  } catch (err) {
    console.error("Failed to read menu-db.json:", err);
  }
  return { categories: [], items: [], last_updated: new Date().toISOString(), version: 1 };
}

export function writeMenuDb(categories: unknown[], items: unknown[]) {
  try {
    ensureDbFile();
    const payload = {
      categories: Array.isArray(categories) ? categories : [],
      items: Array.isArray(items) ? items : [],
      last_updated: new Date().toISOString(),
      version: 1,
    };
    fs.writeFileSync(MENU_FILE, JSON.stringify(payload, null, 2), "utf-8");
    return payload;
  } catch (err) {
    console.error("Failed to write menu-db.json:", err);
    return null;
  }
}

export function readSpecialOfferDb() {
  try {
    ensureDbFile();
    if (fs.existsSync(OFFER_FILE)) {
      const raw = fs.readFileSync(OFFER_FILE, "utf-8");
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error("Failed to read special-offer-db.json:", err);
  }
  return null;
}

export function writeSpecialOfferDb(offer: unknown) {
  try {
    ensureDbFile();
    fs.writeFileSync(OFFER_FILE, JSON.stringify(offer, null, 2), "utf-8");
    return offer;
  } catch (err) {
    console.error("Failed to write special-offer-db.json:", err);
    return null;
  }
}

export function readHoursDb() {
  try {
    ensureDbFile();
    if (fs.existsSync(HOURS_FILE)) {
      const raw = fs.readFileSync(HOURS_FILE, "utf-8");
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error("Failed to read opening-hours-db.json:", err);
  }
  return null;
}

export function writeHoursDb(hours: unknown) {
  try {
    ensureDbFile();
    fs.writeFileSync(HOURS_FILE, JSON.stringify(hours, null, 2), "utf-8");
    return hours;
  } catch (err) {
    console.error("Failed to write opening-hours-db.json:", err);
    return null;
  }
}

function parseJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve({});
      }
    });
  });
}

function sendJson(res: ServerResponse, data: unknown, status: number = 200) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.end(JSON.stringify(data));
}

export async function handleDatabaseApiRequest(
  req: IncomingMessage,
  res: ServerResponse,
  next: () => void,
) {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  const pathname = url.pathname;

  if (!pathname.startsWith("/api/")) {
    return next();
  }

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    return res.end();
  }

  // --- MENU API ---
  if (pathname === "/api/menu" || pathname === "/api/menu/") {
    if (req.method === "GET") {
      const data = readMenuDb();
      return sendJson(res, {
        success: true,
        count: (data.items || []).length,
        categories: data.categories || [],
        items: data.items || [],
        last_updated: data.last_updated,
        version: data.version || 1,
      });
    }

    if (req.method === "POST" || req.method === "PUT") {
      const body = await parseJsonBody(req);
      const current = readMenuDb();
      const categories = Array.isArray(body.categories) ? body.categories : current.categories;
      const items = Array.isArray(body.items) ? body.items : current.items;
      const written = writeMenuDb(categories, items);
      return sendJson(res, {
        success: true,
        message: "Menu saved to database",
        categories: written?.categories,
        items: written?.items,
        count: written?.items.length,
        last_updated: written?.last_updated,
      });
    }
  }

  if (pathname === "/api/menu/store-all" || pathname === "/api/menu/batch") {
    if (req.method === "POST") {
      const body = await parseJsonBody(req);
      const current = readMenuDb();
      const categories = Array.isArray(body.categories) ? body.categories : current.categories;
      const items = Array.isArray(body.items) ? body.items : current.items;
      const written = writeMenuDb(categories, items);
      return sendJson(res, {
        success: true,
        message: `All ${written?.items.length} items and ${written?.categories.length} categories saved to database`,
        categories: written?.categories,
        items: written?.items,
        count: written?.items.length,
        last_updated: written?.last_updated,
      });
    }
  }

  if (pathname === "/api/menu/stats") {
    if (req.method === "GET") {
      const data = readMenuDb();
      const activeItems = (data.items || []).filter(
        (i: { available?: boolean; deleted_at?: string | null }) =>
          !i.deleted_at && i.available !== false,
      );
      return sendJson(res, {
        totalItems: (data.items || []).length,
        totalCategories: (data.categories || []).length,
        availableItems: activeItems.length,
        lastUpdated: data.last_updated || new Date().toISOString(),
        isHealthy: true,
        version: data.version || 1,
      });
    }
  }

  // --- SPECIAL OFFER API ---
  if (pathname === "/api/special-offer" || pathname === "/api/special-offers") {
    if (req.method === "GET") {
      const offer = readSpecialOfferDb();
      return sendJson(res, { success: true, offer, ...offer });
    }

    if (req.method === "POST" || req.method === "PUT") {
      const body = await parseJsonBody(req);
      const written = writeSpecialOfferDb(body);
      return sendJson(res, { success: true, message: "Special offer saved", offer: written });
    }
  }

  // --- OPENING HOURS API ---
  if (pathname === "/api/opening-hours") {
    if (req.method === "GET") {
      const hours = readHoursDb();
      return sendJson(res, hours || {});
    }

    if (req.method === "POST" || req.method === "PUT") {
      const body = await parseJsonBody(req);
      const written = writeHoursDb(body);
      return sendJson(res, { success: true, ...written });
    }
  }

  return next();
}
