// File-based JSON mock store — zero-config demo fallback when DATABASE_URL is missing.
// Persists to data/mock-db.json so mock data survives restarts, but also works purely in-memory.
// Implements the subset of Prisma API actually used in the app (see grep results).

import { randomUUID } from "crypto";
import * as fs from "fs";
import * as path from "path";

type Contractor = {
  id: string;
  name: string;
  phone: string | null;
  createdAt: Date;
};

type PriceItem = {
  id: string;
  contractorId: string;
  category: string;
  itemName: string;
  unit: string;
  unitPrice: number;
  isActive: boolean;
};

type Estimate = {
  id: string;
  contractorId: string;
  clientName: string | null;
  roomType: string | null;
  areaM2: number | null;
  rawDescription: string;
  photoPaths: string[];
  aiNotes: string | null;
  status: "draft" | "final";
  createdAt: Date;
};

type EstimateItem = {
  id: string;
  estimateId: string;
  priceItemId: string | null;
  itemName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  lineTotal: number;
  matched: boolean;
  source: "ai_extracted" | "manual";
};

type Store = {
  contractors: Contractor[];
  priceItems: PriceItem[];
  estimates: Estimate[];
  estimateItems: EstimateItem[];
};

const STORE_PATH = path.join(process.cwd(), "data", "mock-db.json");

function ensureDir() {
  try {
    fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
  } catch {}
}

function reviver(_k: string, v: unknown) {
  // Dates are stored as ISO strings via JSON.stringify(Date)
  return v;
}

function loadStore(): Store {
  ensureDir();
  try {
    if (fs.existsSync(STORE_PATH)) {
      const raw = fs.readFileSync(STORE_PATH, "utf-8");
      const parsed = JSON.parse(raw) as Store & {
        contractors: (Omit<Contractor, "createdAt"> & { createdAt: string })[];
        estimates: (Omit<Estimate, "createdAt"> & { createdAt: string })[];
      };
      return {
        contractors: parsed.contractors.map((c) => ({ ...c, createdAt: new Date(c.createdAt) })),
        priceItems: parsed.priceItems ?? [],
        estimates: parsed.estimates.map((e) => ({ ...e, createdAt: new Date(e.createdAt) })),
        estimateItems: parsed.estimateItems ?? [],
      };
    }
  } catch (e) {
    console.warn("[mock-db] failed to load store, using empty", e);
  }
  return { contractors: [], priceItems: [], estimates: [], estimateItems: [] };
}

let store: Store = loadStore();

function saveStore() {
  ensureDir();
  try {
    fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), "utf-8");
  } catch (e) {
    console.warn("[mock-db] save failed", e);
  }
}

// Helpers
function matchesWhere<T extends Record<string, unknown>>(obj: T, where: Record<string, unknown> | undefined): boolean {
  if (!where) return true;
  for (const [k, v] of Object.entries(where)) {
    if ((obj as Record<string, unknown>)[k] !== v) return false;
  }
  return true;
}

function sortBy<T>(arr: T[], orderBy: Record<string, "asc" | "desc"> | Record<string, "asc" | "desc">[] | undefined): T[] {
  if (!orderBy) return arr;
  const orders = Array.isArray(orderBy) ? orderBy : [orderBy];
  // Apply in reverse order for stable sort
  let copy = [...arr];
  for (let i = orders.length - 1; i >= 0; i--) {
    const ob = orders[i];
    const [key, dir] = Object.entries(ob)[0] as [string, "asc" | "desc"];
    copy.sort((a, b) => {
      const av = (a as Record<string, unknown>)[key];
      const bv = (b as Record<string, unknown>)[key];
      let cmp = 0;
      if (av instanceof Date && bv instanceof Date) cmp = av.getTime() - bv.getTime();
      else if (typeof av === "string" && typeof bv === "string") cmp = av.localeCompare(bv, "ar");
      else if (typeof av === "number" && typeof bv === "number") cmp = av - bv;
      else cmp = String(av).localeCompare(String(bv));
      return dir === "asc" ? cmp : -cmp;
    });
  }
  return copy;
}

// --- contractor ---
const contractor = {
  async findFirst(args?: { orderBy?: Record<string, "asc" | "desc"> }) {
    let arr = [...store.contractors];
    if (args?.orderBy) arr = sortBy(arr, args.orderBy);
    return arr[0] ?? null;
  },
  async create(args: { data: { name: string; phone?: string | null; priceItems?: { create: { category: string; itemName: string; unit: string; unitPrice: number }[] } } }) {
    const id = randomUUID();
    const c: Contractor = {
      id,
      name: args.data.name,
      phone: args.data.phone ?? null,
      createdAt: new Date(),
    };
    store.contractors.push(c);
    if (args.data.priceItems?.create) {
      for (const pi of args.data.priceItems.create) {
        const pit: PriceItem = {
          id: randomUUID(),
          contractorId: id,
          category: pi.category,
          itemName: pi.itemName,
          unit: pi.unit,
          unitPrice: Number(pi.unitPrice),
          isActive: true,
        };
        store.priceItems.push(pit);
      }
    }
    saveStore();
    return c;
  },
  async update(args: { where: { id: string }; data: Partial<Pick<Contractor, "name" | "phone">> }) {
    const c = store.contractors.find((x) => x.id === args.where.id);
    if (!c) throw new Error("Contractor not found");
    if (args.data.name !== undefined) c.name = args.data.name as string;
    if (args.data.phone !== undefined) c.phone = (args.data.phone as string | null) ?? null;
    saveStore();
    return c;
  },
};

// --- priceItem ---
const priceItem = {
  async findMany(args?: { where?: Record<string, unknown>; orderBy?: Record<string, "asc" | "desc"> | Record<string, "asc" | "desc">[] }) {
    let arr = store.priceItems.filter((p) => matchesWhere(p as unknown as Record<string, unknown>, args?.where));
    if (args?.orderBy) arr = sortBy(arr, args.orderBy as never);
    // Return copies with unitPrice as number (prisma returns Decimal but app does Number())
    return arr.map((p) => ({ ...p }));
  },
  async findUnique(args: { where: { id: string } }) {
    return store.priceItems.find((p) => p.id === args.where.id) ?? null;
  },
  async create(args: { data: { contractorId: string; category: string; itemName: string; unit: string; unitPrice: number | string; isActive?: boolean } }) {
    const pi: PriceItem = {
      id: randomUUID(),
      contractorId: args.data.contractorId,
      category: args.data.category,
      itemName: args.data.itemName,
      unit: args.data.unit,
      unitPrice: Number(args.data.unitPrice),
      isActive: args.data.isActive ?? true,
    };
    store.priceItems.push(pi);
    saveStore();
    return { ...pi };
  },
  async update(args: { where: { id: string }; data: Partial<Pick<PriceItem, "category" | "itemName" | "unit" | "unitPrice" | "isActive">> }) {
    const pi = store.priceItems.find((p) => p.id === args.where.id);
    if (!pi) throw new Error("PriceItem not found");
    if (args.data.category !== undefined) pi.category = args.data.category as string;
    if (args.data.itemName !== undefined) pi.itemName = args.data.itemName as string;
    if (args.data.unit !== undefined) pi.unit = args.data.unit as string;
    if (args.data.unitPrice !== undefined) pi.unitPrice = Number(args.data.unitPrice);
    if (args.data.isActive !== undefined) pi.isActive = Boolean(args.data.isActive);
    saveStore();
    return { ...pi };
  },
  async delete(args: { where: { id: string } }) {
    const idx = store.priceItems.findIndex((p) => p.id === args.where.id);
    if (idx === -1) throw new Error("PriceItem not found");
    const [removed] = store.priceItems.splice(idx, 1);
    // On delete cascade? In real DB, priceItem deletion SET NULL on estimateItems. We emulate: set priceItemId null
    for (const ei of store.estimateItems) {
      if (ei.priceItemId === args.where.id) ei.priceItemId = null;
    }
    saveStore();
    return removed;
  },
  async count(args?: { where?: Record<string, unknown> }) {
    return store.priceItems.filter((p) => matchesWhere(p as unknown as Record<string, unknown>, args?.where)).length;
  },
};

// --- estimate ---
const estimate = {
  async findMany(args?: {
    where?: Record<string, unknown>;
    include?: { items?: boolean };
    orderBy?: Record<string, "asc" | "desc">;
    take?: number;
  }) {
    let arr = store.estimates.filter((e) => matchesWhere(e as unknown as Record<string, unknown>, args?.where));
    if (args?.orderBy) arr = sortBy(arr, args.orderBy);
    if (args?.take) arr = arr.slice(0, args.take);
    if (args?.include?.items) {
      return arr.map((e) => ({
        ...e,
        items: store.estimateItems.filter((it) => it.estimateId === e.id),
      }));
    }
    return arr.map((e) => ({ ...e }));
  },
  async findUnique(args: {
    where: { id: string };
    include?: { items?: boolean | { orderBy?: Record<string, "asc" | "desc"> } };
  }) {
    const e = store.estimates.find((x) => x.id === args.where.id);
    if (!e) return null;
    if (args.include?.items) {
      let items = store.estimateItems.filter((it) => it.estimateId === e.id);
      const orderBy =
        typeof args.include.items === "object" && args.include.items.orderBy ? args.include.items.orderBy : undefined;
      if (orderBy) items = sortBy(items, orderBy);
      return { ...e, items };
    }
    return { ...e };
  },
  async create(args: {
    data: {
      id?: string;
      contractorId: string;
      clientName?: string | null;
      roomType?: string | null;
      areaM2?: number | null;
      rawDescription: string;
      photoPaths: string[];
      aiNotes?: string | null;
      status?: "draft" | "final";
      items?: { create: Omit<EstimateItem, "id" | "estimateId">[] };
    };
  }) {
    const id = args.data.id ?? randomUUID();
    const e: Estimate = {
      id,
      contractorId: args.data.contractorId,
      clientName: args.data.clientName ?? null,
      roomType: args.data.roomType ?? null,
      areaM2: args.data.areaM2 != null ? Number(args.data.areaM2) : null,
      rawDescription: args.data.rawDescription,
      photoPaths: args.data.photoPaths ?? [],
      aiNotes: args.data.aiNotes ?? null,
      status: (args.data.status as "draft" | "final") ?? "draft",
      createdAt: new Date(),
    };
    store.estimates.push(e);
    if (args.data.items?.create) {
      for (const it of args.data.items.create) {
        const ei: EstimateItem = {
          id: randomUUID(),
          estimateId: id,
          priceItemId: (it as EstimateItem).priceItemId ?? null,
          itemName: it.itemName,
          quantity: Number(it.quantity),
          unit: it.unit,
          unitPrice: Number(it.unitPrice),
          lineTotal: Number(it.lineTotal),
          matched: Boolean(it.matched),
          source: (it.source as "ai_extracted" | "manual") ?? "ai_extracted",
        };
        store.estimateItems.push(ei);
      }
    }
    saveStore();
    // return with items
    return {
      ...e,
      items: store.estimateItems.filter((it) => it.estimateId === id),
    };
  },
  async update(args: { where: { id: string }; data: Partial<Pick<Estimate, "clientName" | "roomType" | "areaM2" | "status">> }) {
    const e = store.estimates.find((x) => x.id === args.where.id);
    if (!e) throw new Error("Estimate not found");
    if ("clientName" in args.data) e.clientName = (args.data.clientName as string | null) ?? null;
    if ("roomType" in args.data) e.roomType = (args.data.roomType as string | null) ?? null;
    if ("areaM2" in args.data) e.areaM2 = args.data.areaM2 != null ? Number(args.data.areaM2 as number) : null;
    if ("status" in args.data) e.status = args.data.status as "draft" | "final";
    saveStore();
    return { ...e };
  },
  async delete(args: { where: { id: string } }) {
    const idx = store.estimates.findIndex((x) => x.id === args.where.id);
    if (idx === -1) throw new Error("Estimate not found");
    const [removed] = store.estimates.splice(idx, 1);
    // cascade delete items
    store.estimateItems = store.estimateItems.filter((it) => it.estimateId !== args.where.id);
    saveStore();
    return removed;
  },
};

// --- estimateItem ---
const estimateItem = {
  async findUnique(args: { where: { id: string } }) {
    return store.estimateItems.find((it) => it.id === args.where.id) ?? null;
  },
  async update(args: { where: { id: string }; data: Partial<Pick<EstimateItem, "quantity" | "unitPrice" | "lineTotal" | "itemName" | "unit" | "matched">> }) {
    const it = store.estimateItems.find((x) => x.id === args.where.id);
    if (!it) throw new Error("EstimateItem not found");
    if (args.data.quantity !== undefined) it.quantity = Number(args.data.quantity);
    if (args.data.unitPrice !== undefined) it.unitPrice = Number(args.data.unitPrice);
    if (args.data.lineTotal !== undefined) it.lineTotal = Number(args.data.lineTotal);
    if (args.data.itemName !== undefined) it.itemName = args.data.itemName as string;
    if (args.data.unit !== undefined) it.unit = args.data.unit as string;
    if (args.data.matched !== undefined) it.matched = Boolean(args.data.matched);
    saveStore();
    return { ...it };
  },
  async delete(args: { where: { id: string } }) {
    const idx = store.estimateItems.findIndex((x) => x.id === args.where.id);
    if (idx === -1) throw new Error("EstimateItem not found");
    const [removed] = store.estimateItems.splice(idx, 1);
    saveStore();
    return removed;
  },
  async create(args: {
    data: {
      estimateId: string;
      priceItemId?: string | null;
      itemName: string;
      quantity: number;
      unit: string;
      unitPrice: number;
      lineTotal: number;
      matched: boolean;
      source: "ai_extracted" | "manual";
    };
  }) {
    const ei: EstimateItem = {
      id: randomUUID(),
      estimateId: args.data.estimateId,
      priceItemId: args.data.priceItemId ?? null,
      itemName: args.data.itemName,
      quantity: Number(args.data.quantity),
      unit: args.data.unit,
      unitPrice: Number(args.data.unitPrice),
      lineTotal: Number(args.data.lineTotal),
      matched: Boolean(args.data.matched),
      source: args.data.source,
    };
    store.estimateItems.push(ei);
    saveStore();
    return { ...ei };
  },
};

export const mockPrisma = {
  contractor,
  priceItem,
  estimate,
  estimateItem,
  // helpers for seed/demo — use getters so they stay in sync after reload/reset
  get _store() {
    return store;
  },
  _save: saveStore,
  _reload: () => {
    store = loadStore();
  },
} as typeof contractor extends never ? never : {
  contractor: typeof contractor;
  priceItem: typeof priceItem;
  estimate: typeof estimate;
  estimateItem: typeof estimateItem;
  readonly _store: Store;
  _save: typeof saveStore;
  _reload: () => void;
};

// Reset helper for dev
export function resetMockStore() {
  store = { contractors: [], priceItems: [], estimates: [], estimateItems: [] };
  saveStore();
}
