import "./lib/error-capture";
import fs from "node:fs";
import path from "node:path";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

const DB_DIR = path.resolve(process.cwd(), "data");
const DB_FILE = path.resolve(DB_DIR, "menu-db.json");
const OFFER_FILE = path.resolve(DB_DIR, "special-offer-db.json");

const SEED_CATEGORIES = [
  {
    id: "cat-starters",
    name: "Starters",
    slug: "starters",
    sort_order: 1,
    available: true,
    created_at: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "cat-grill",
    name: "Main Grill",
    slug: "grill",
    sort_order: 2,
    available: true,
    created_at: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "cat-curries",
    name: "Curries",
    slug: "curries",
    sort_order: 3,
    available: true,
    created_at: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "cat-biryani",
    name: "Biryani & Rice",
    slug: "biryani",
    sort_order: 4,
    available: true,
    created_at: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "cat-breads",
    name: "Breads & Sides",
    slug: "breads",
    sort_order: 5,
    available: true,
    created_at: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "cat-desserts",
    name: "Desserts & Drinks",
    slug: "desserts",
    sort_order: 6,
    available: true,
    created_at: "2026-01-01T00:00:00.000Z",
  },
];

const SEED_ITEMS = [
  {
    id: "dish-starters-1",
    name: "Vegetable Samosas",
    description: "Hand-folded pastry with spiced peas and potato, tamarind chutney.",
    price: 120,
    category_id: "cat-starters",
    image_url: "/dishes/dish-samosa.jpg",
    available: true,
    sort_order: 10,
    created_at: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "dish-starters-2",
    name: "Chicken Pakora",
    description: "Gram flour batter, crisp fried, served with mint raita.",
    price: 180,
    category_id: "cat-starters",
    image_url: "/dishes/dish-chicken-pakora.jpg",
    available: true,
    sort_order: 20,
    created_at: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "dish-starters-3",
    name: "Onion Bhaji",
    description: "Sweet onion, cumin and coriander, fried golden.",
    price: 140,
    category_id: "cat-starters",
    image_url: "/dishes/dish-onion-bhaji.jpg",
    available: true,
    sort_order: 30,
    created_at: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "dish-grill-1",
    name: "Lamb Seekh Kebab",
    description: "Minced lamb infused with Ali's signature spice blend, flame-grilled.",
    price: 280,
    category_id: "cat-grill",
    image_url: "/dishes/dish-seekh-kebab.jpg",
    available: true,
    sort_order: 10,
    created_at: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "dish-grill-2",
    name: "Chicken Tikka Skewers",
    description: "Yoghurt and paprika marinade, charred over charcoal.",
    price: 320,
    category_id: "cat-grill",
    image_url: "/dishes/dish-chicken-tikka-skewers.jpg",
    available: true,
    sort_order: 20,
    created_at: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "dish-grill-3",
    name: "Mixed Grill Platter",
    description: "Seekh kebab, chicken tikka, lamb chop and grilled wings for two.",
    price: 650,
    category_id: "cat-grill",
    image_url: "/dishes/dish-mixed-grill.jpg",
    available: true,
    sort_order: 30,
    created_at: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "dish-curries-1",
    name: "Classic Butter Chicken",
    description: "Tender tandoori chicken simmered in a rich tomato and fenugreek gravy.",
    price: 380,
    category_id: "cat-curries",
    image_url: "/dishes/dish-butter-chicken.jpg",
    available: true,
    sort_order: 10,
    created_at: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "dish-curries-2",
    name: "Chicken Tikka Masala",
    description: "Mild, creamy masala sauce with charred chicken tikka.",
    price: 360,
    category_id: "cat-curries",
    image_url: "/dishes/dish-tikka-masala.jpg",
    available: true,
    sort_order: 20,
    created_at: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "dish-curries-3",
    name: "Lamb Karahi",
    description: "Slow-cooked lamb with tomato, ginger and green chilli.",
    price: 420,
    category_id: "cat-curries",
    image_url: "/dishes/dish-lamb-karahi.jpg",
    available: true,
    sort_order: 30,
    created_at: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "dish-curries-4",
    name: "Daal Tarka",
    description: "Yellow lentils finished with cumin-tempered ghee.",
    price: 220,
    category_id: "cat-curries",
    image_url: "/dishes/dish-daal-tarka.jpg",
    available: true,
    sort_order: 40,
    created_at: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "dish-biryani-1",
    name: "Royal Lamb Biryani",
    description: "Slow-cooked lamb, long-grain basmati, saffron and fried onion.",
    price: 450,
    category_id: "cat-biryani",
    image_url: "/dishes/hero-biryani.jpg",
    available: true,
    sort_order: 10,
    created_at: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "dish-biryani-2",
    name: "Chicken Biryani",
    description: "Layered basmati with spiced chicken and boiled egg.",
    price: 380,
    category_id: "cat-biryani",
    image_url: "/dishes/dish-chicken-biryani.jpg",
    available: true,
    sort_order: 20,
    created_at: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "dish-biryani-3",
    name: "Pilau Rice",
    description: "Basmati steamed with whole spices.",
    price: 150,
    category_id: "cat-biryani",
    image_url: "/dishes/dish-pilau-rice.jpg",
    available: true,
    sort_order: 30,
    created_at: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "dish-breads-1",
    name: "Peshwari Naan",
    description: "Leavened bread stuffed with sweet sultanas, almonds, and coconut.",
    price: 120,
    category_id: "cat-breads",
    image_url: "/dishes/dish-naan.jpg",
    available: true,
    sort_order: 10,
    created_at: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "dish-breads-2",
    name: "Garlic Naan",
    description: "Fresh from the tandoor with garlic butter and coriander.",
    price: 90,
    category_id: "cat-breads",
    image_url: "/dishes/dish-garlic-naan.jpg",
    available: true,
    sort_order: 20,
    created_at: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "dish-breads-3",
    name: "Mint Raita",
    description: "Cool yoghurt, cucumber and fresh mint.",
    price: 60,
    category_id: "cat-breads",
    image_url: "/dishes/dish-mint-raita.jpg",
    available: true,
    sort_order: 30,
    created_at: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "dish-desserts-1",
    name: "Gulab Jamun",
    description: "Warm milk dumplings soaked in cardamom syrup.",
    price: 120,
    category_id: "cat-desserts",
    image_url: "/dishes/dish-gulab-jamun.jpg",
    available: true,
    sort_order: 10,
    created_at: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "dish-desserts-2",
    name: "Kheer",
    description: "Slow-cooked rice pudding with pistachio.",
    price: 140,
    category_id: "cat-desserts",
    image_url: "/dishes/dish-kheer.jpg",
    available: true,
    sort_order: 20,
    created_at: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "dish-desserts-3",
    name: "Mango Lassi",
    description: "Yoghurt blended with sweet Alphonso mango.",
    price: 110,
    category_id: "cat-desserts",
    image_url: "/dishes/dish-mango-lassi.jpg",
    available: true,
    sort_order: 30,
    created_at: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "dish-desserts-4",
    name: "Masala Chai",
    description: "Spiced black tea brewed with milk.",
    price: 50,
    category_id: "cat-desserts",
    image_url: "/dishes/dish-masala-chai.jpg",
    available: true,
    sort_order: 40,
    created_at: "2026-01-01T00:00:00.000Z",
  },
];

type DbCategory = {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
  available?: boolean;
  created_at?: string;
  deleted_at?: string | null;
};

type DbMenuItem = {
  id: string;
  name: string;
  description?: string;
  price: number;
  category_id?: string;
  image_url?: string | null;
  available?: boolean;
  sort_order?: number;
  created_at?: string;
  deleted_at?: string | null;
};

interface MenuDbData {
  categories: DbCategory[];
  items: DbMenuItem[];
  last_updated?: string;
  version?: number;
}

function ensureDbFile() {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
}

function readDb(): MenuDbData {
  try {
    ensureDbFile();
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      if (
        parsed &&
        Array.isArray(parsed.categories) &&
        parsed.categories.length > 0 &&
        Array.isArray(parsed.items) &&
        parsed.items.length > 0
      ) {
        return parsed as MenuDbData;
      }
    }
  } catch (e) {
    console.error("Failed to read menu-db.json:", e);
  }

  // Auto-seed with default full menu details if missing or empty
  const initialData: MenuDbData = {
    categories: SEED_CATEGORIES,
    items: SEED_ITEMS,
    last_updated: new Date().toISOString(),
    version: 1,
  };
  writeDb(initialData.categories, initialData.items);
  return initialData;
}

function writeDb(categories: unknown, items: unknown) {
  try {
    ensureDbFile();
    const payload = {
      categories: Array.isArray(categories) ? categories : [],
      items: Array.isArray(items) ? items : [],
      last_updated: new Date().toISOString(),
      version: 1,
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(payload, null, 2), "utf-8");
    return payload;
  } catch (err) {
    console.error("Failed to write menu-db.json:", err);
    return null;
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

const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, PUT, DELETE, OPTIONS",
  "access-control-allow-headers": "content-type, authorization",
};

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const url = new URL(request.url);

      if (url.pathname.startsWith("/api/menu")) {
        if (request.method === "OPTIONS") {
          return new Response(null, { status: 204, headers: CORS_HEADERS });
        }

        // GET /api/menu/stats
        if (url.pathname === "/api/menu/stats" && request.method === "GET") {
          const dbData = readDb();
          const activeItems = (dbData.items || []).filter(
            (i: DbMenuItem) => !i.deleted_at && i.available !== false,
          );
          return new Response(
            JSON.stringify({
              totalItems: (dbData.items || []).length,
              totalCategories: (dbData.categories || []).length,
              availableItems: activeItems.length,
              lastUpdated: dbData.last_updated || new Date().toISOString(),
              isHealthy: true,
              version: dbData.version || 1,
            }),
            {
              status: 200,
              headers: { "content-type": "application/json", ...CORS_HEADERS },
            },
          );
        }

        // POST /api/menu/store-all or POST /api/menu/seed
        if (
          (url.pathname === "/api/menu/store-all" || url.pathname === "/api/menu/seed") &&
          request.method === "POST"
        ) {
          try {
            let body: { categories?: DbCategory[]; items?: DbMenuItem[] } = {};
            try {
              body = (await request.json()) as { categories?: DbCategory[]; items?: DbMenuItem[] };
            } catch {
              body = {};
            }

            const categories =
              Array.isArray(body.categories) && body.categories.length > 0
                ? body.categories
                : SEED_CATEGORIES;
            const items =
              Array.isArray(body.items) && body.items.length > 0 ? body.items : SEED_ITEMS;

            const written = writeDb(categories, items);
            return new Response(
              JSON.stringify({
                success: true,
                message: `All ${items.length} menu items and ${categories.length} categories successfully stored to the database!`,
                count: items.length,
                categories,
                items,
                last_updated: written?.last_updated,
              }),
              {
                status: 200,
                headers: { "content-type": "application/json", ...CORS_HEADERS },
              },
            );
          } catch (err: unknown) {
            const errMsg = err instanceof Error ? err.message : "Failed to store all menu details";
            return new Response(JSON.stringify({ error: errMsg }), {
              status: 400,
              headers: { "content-type": "application/json", ...CORS_HEADERS },
            });
          }
        }

        // POST /api/menu/reset
        if (url.pathname === "/api/menu/reset" && request.method === "POST") {
          const written = writeDb(SEED_CATEGORIES, SEED_ITEMS);
          return new Response(
            JSON.stringify({
              success: true,
              message: "Database menu successfully reset to default items and categories.",
              categories: SEED_CATEGORIES,
              items: SEED_ITEMS,
              last_updated: written?.last_updated,
            }),
            {
              status: 200,
              headers: { "content-type": "application/json", ...CORS_HEADERS },
            },
          );
        }

        // Standard /api/menu endpoints
        if (url.pathname === "/api/menu") {
          if (request.method === "GET") {
            const dbData = readDb();
            return new Response(
              JSON.stringify({
                success: true,
                count: (dbData.items || []).length,
                categories: dbData.categories || [],
                items: dbData.items || [],
                last_updated: dbData.last_updated,
                version: dbData.version || 1,
              }),
              {
                status: 200,
                headers: {
                  "content-type": "application/json",
                  "cache-control": "no-cache, no-store, must-revalidate",
                  ...CORS_HEADERS,
                },
              },
            );
          }

          if (request.method === "POST" || request.method === "PUT") {
            try {
              const body = (await request.json()) as { categories?: unknown[]; items?: unknown[] };
              const categories = body.categories || [];
              const items = body.items || [];
              const written = writeDb(categories, items);
              return new Response(
                JSON.stringify({
                  success: true,
                  message: "Menu details successfully updated in database",
                  categories,
                  items,
                  last_updated: written?.last_updated,
                }),
                {
                  status: 200,
                  headers: { "content-type": "application/json", ...CORS_HEADERS },
                },
              );
            } catch (err: unknown) {
              const errMsg = err instanceof Error ? err.message : "Invalid payload";
              return new Response(JSON.stringify({ error: errMsg }), {
                status: 400,
                headers: { "content-type": "application/json", ...CORS_HEADERS },
              });
            }
          }
        }
      }

      if (url.pathname === "/api/special-offer") {
        if (request.method === "OPTIONS") {
          return new Response(null, { status: 204, headers: CORS_HEADERS });
        }

        if (request.method === "GET") {
          const offer = readOfferDb();
          return new Response(JSON.stringify({ offer }), {
            status: 200,
            headers: {
              "content-type": "application/json",
              "cache-control": "no-cache, no-store, must-revalidate",
              ...CORS_HEADERS,
            },
          });
        }

        if (request.method === "POST" || request.method === "PUT") {
          try {
            const offer = await request.json();
            writeOfferDb(offer);
            return new Response(JSON.stringify({ success: true, offer }), {
              status: 200,
              headers: { "content-type": "application/json", ...CORS_HEADERS },
            });
          } catch (err: unknown) {
            const errMsg = err instanceof Error ? err.message : "Invalid payload";
            return new Response(JSON.stringify({ error: errMsg }), {
              status: 400,
              headers: { "content-type": "application/json", ...CORS_HEADERS },
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
