// File-based JSON mock store — zero-config demo fallback when DATABASE_URL is missing.
// Persists to data/mock-db.json so mock data survives restarts, but also works purely in-memory.
// Implements the subset of Prisma API actually used in the app (see grep results).

import { randomUUID } from "crypto";
import * as fs from "fs";
import * as path from "path";

type OptionTier = "economy" | "mid" | "premium";

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

type Material = {
  id: string;
  contractorId: string;
  category: string;
  itemName: string;
  grade: OptionTier;
  unit: string;
  unitPrice: number;
  visualHint: string | null;
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
  proofHash: string | null;
  lastRenderedAt: Date | null;
  createdAt: Date;
  lengthM: number | null;
  widthM: number | null;
  heightM: number | null;
  style: string | null;
  styleTags: string[];
  budgetTier: string | null;
  budgetDZD: number | null;
  contractorNotes: string | null;
  selectedOptionId: string | null;
};

type EstimateRender = {
  id: string;
  estimateId: string;
  basePhotoPath: string;
  renderPath: string | null;
  status: string; // pending | done | failed
  model: string | null;
  promptHash: string | null;
  promptSnapshot: string | null;
  error: string | null;
  createdAt: Date;
  renderedAt: Date | null;
  tier: string | null;
  optionId: string | null;
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

type EstimateOption = {
  id: string;
  estimateId: string;
  tier: OptionTier;
  title: string;
  total: number;
  proofHash: string | null;
};

type EstimateOptionItem = {
  id: string;
  optionId: string;
  materialId: string | null;
  itemName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  lineTotal: number;
  category: string;
};

type Store = {
  contractors: Contractor[];
  priceItems: PriceItem[];
  materials: Material[];
  estimates: Estimate[];
  estimateItems: EstimateItem[];
  estimateRenders: EstimateRender[];
  estimateOptions: EstimateOption[];
  estimateOptionItems: EstimateOptionItem[];
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
        estimates: (Omit<Estimate, "createdAt" | "lastRenderedAt"> & { createdAt: string; lastRenderedAt?: string | null })[];
        estimateRenders: (Omit<EstimateRender, "createdAt" | "renderedAt"> & { createdAt: string; renderedAt?: string | null })[];
      };
      return {
        contractors: (parsed.contractors ?? []).map((c) => ({ ...c, createdAt: new Date(c.createdAt) })),
        priceItems: parsed.priceItems ?? [],
        materials: (parsed.materials ?? []).map((m) => ({
          ...m,
          unitPrice: Number((m as unknown as { unitPrice: unknown }).unitPrice),
          visualHint: (m as unknown as Material).visualHint ?? null,
          isActive: (m as unknown as Material).isActive ?? true,
        })),
        estimates: (parsed.estimates ?? []).map((e) => ({
          ...e,
          proofHash: (e as unknown as Estimate).proofHash ?? null,
          lastRenderedAt: (e as unknown as Estimate).lastRenderedAt ? new Date((e as unknown as { lastRenderedAt: string }).lastRenderedAt as string) : null,
          createdAt: new Date((e as unknown as { createdAt: string }).createdAt),
          lengthM: (e as unknown as Estimate).lengthM != null ? Number((e as unknown as Estimate).lengthM) : null,
          widthM: (e as unknown as Estimate).widthM != null ? Number((e as unknown as Estimate).widthM) : null,
          heightM: (e as unknown as Estimate).heightM != null ? Number((e as unknown as Estimate).heightM) : null,
          style: (e as unknown as Estimate).style ?? null,
          styleTags: Array.isArray((e as unknown as Estimate).styleTags) ? (e as unknown as Estimate).styleTags : [],
          budgetTier: (e as unknown as Estimate).budgetTier ?? null,
          budgetDZD: (e as unknown as Estimate).budgetDZD != null ? Number((e as unknown as Estimate).budgetDZD) : null,
          contractorNotes: (e as unknown as Estimate).contractorNotes ?? null,
          selectedOptionId: (e as unknown as Estimate).selectedOptionId ?? null,
          areaM2: (e as unknown as Estimate).areaM2 != null ? Number((e as unknown as Estimate).areaM2) : null,
          aiNotes: (e as unknown as Estimate).aiNotes ?? null,
          photoPaths: (e as unknown as Estimate).photoPaths ?? [],
        })),
        estimateItems: parsed.estimateItems ?? [],
        estimateRenders: (parsed.estimateRenders ?? []).map((r) => ({
          ...r,
          tier: (r as unknown as EstimateRender).tier ?? null,
          optionId: (r as unknown as EstimateRender).optionId ?? null,
          model: (r as unknown as EstimateRender).model ?? null,
          promptHash: (r as unknown as EstimateRender).promptHash ?? null,
          promptSnapshot: (r as unknown as EstimateRender).promptSnapshot ?? null,
          error: (r as unknown as EstimateRender).error ?? null,
          renderPath: (r as unknown as EstimateRender).renderPath ?? null,
          createdAt: new Date((r as unknown as { createdAt: string }).createdAt),
          renderedAt: (r as unknown as { renderedAt?: string | null }).renderedAt ? new Date((r as unknown as { renderedAt: string }).renderedAt as string) : null,
        })),
        estimateOptions: (parsed.estimateOptions ?? []).map((o) => ({
          ...o,
          total: Number((o as unknown as { total: unknown }).total),
          proofHash: (o as unknown as EstimateOption).proofHash ?? null,
          tier: (o as unknown as EstimateOption).tier as OptionTier,
        })),
        estimateOptionItems: (parsed.estimateOptionItems ?? []).map((it) => ({
          ...it,
          quantity: Number((it as unknown as { quantity: unknown }).quantity),
          unitPrice: Number((it as unknown as { unitPrice: unknown }).unitPrice),
          lineTotal: Number((it as unknown as { lineTotal: unknown }).lineTotal),
          materialId: (it as unknown as EstimateOptionItem).materialId ?? null,
        })),
      };
    }
  } catch (e) {
    console.warn("[mock-db] failed to load store, using empty", e);
  }
  return { contractors: [], priceItems: [], materials: [], estimates: [], estimateItems: [], estimateRenders: [], estimateOptions: [], estimateOptionItems: [] };
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
    // Handle composite unique like estimateId_tier: { estimateId, tier }
    if (k === "estimateId_tier" && typeof v === "object" && v !== null) {
      const comp = v as Record<string, unknown>;
      for (const [ck, cv] of Object.entries(comp)) {
        if ((obj as Record<string, unknown>)[ck] !== cv) return false;
      }
      continue;
    }
    // Handle nested where values that are objects (e.g. { id: { equals: "..." } }) — treat as strict for mock simplicity
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      // if object is not composite, compare JSON? fallback to strict equality check on inner
      // For mock, if where value is object with single key, try to extract
      const inner = v as Record<string, unknown>;
      // Support Prisma-like { equals: val } ? not used in this app
      if ("equals" in inner) {
        if ((obj as Record<string, unknown>)[k] !== inner.equals) return false;
        continue;
      }
      // otherwise consider mismatch
      if ((obj as Record<string, unknown>)[k] !== v) return false;
      continue;
    }
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
  async create(args: { data: { name: string; phone?: string | null; priceItems?: { create: { category: string; itemName: string; unit: string; unitPrice: number }[] }; materials?: { create: Omit<Material, "id" | "contractorId">[] } } }) {
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
    if (args.data.materials?.create) {
      for (const m of args.data.materials.create) {
        const mat: Material = {
          id: randomUUID(),
          contractorId: id,
          category: (m as Material).category,
          itemName: (m as Material).itemName,
          grade: (m as Material).grade as OptionTier,
          unit: (m as Material).unit,
          unitPrice: Number((m as Material).unitPrice),
          visualHint: (m as Material).visualHint ?? null,
          isActive: (m as Material).isActive ?? true,
        };
        store.materials.push(mat);
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

// --- material ---
const material = {
  async findMany(args?: { where?: Record<string, unknown>; orderBy?: Record<string, "asc" | "desc"> | Record<string, "asc" | "desc">[] }) {
    let arr = store.materials.filter((m) => matchesWhere(m as unknown as Record<string, unknown>, args?.where));
    if (args?.orderBy) arr = sortBy(arr, args.orderBy as never);
    return arr.map((m) => ({ ...m }));
  },
  async findUnique(args: { where: { id: string } }) {
    return store.materials.find((m) => m.id === args.where.id) ?? null;
  },
  async findFirst(args?: { where?: Record<string, unknown>; orderBy?: Record<string, "asc" | "desc"> | Record<string, "asc" | "desc">[] }) {
    let arr = store.materials.filter((m) => matchesWhere(m as unknown as Record<string, unknown>, args?.where));
    if (args?.orderBy) arr = sortBy(arr, args.orderBy as never);
    return arr[0] ?? null;
  },
  async create(args: { data: { contractorId: string; category: string; itemName: string; grade: OptionTier | string; unit: string; unitPrice: number | string; visualHint?: string | null; isActive?: boolean } }) {
    const mat: Material = {
      id: randomUUID(),
      contractorId: args.data.contractorId,
      category: args.data.category,
      itemName: args.data.itemName,
      grade: args.data.grade as OptionTier,
      unit: args.data.unit,
      unitPrice: Number(args.data.unitPrice),
      visualHint: args.data.visualHint ?? null,
      isActive: args.data.isActive ?? true,
    };
    store.materials.push(mat);
    saveStore();
    return { ...mat };
  },
  async createMany(args: { data: { contractorId: string; category: string; itemName: string; grade: OptionTier | string; unit: string; unitPrice: number | string; visualHint?: string | null; isActive?: boolean }[] }) {
    let count = 0;
    for (const d of args.data) {
      const mat: Material = {
        id: randomUUID(),
        contractorId: d.contractorId,
        category: d.category,
        itemName: d.itemName,
        grade: d.grade as OptionTier,
        unit: d.unit,
        unitPrice: Number(d.unitPrice),
        visualHint: d.visualHint ?? null,
        isActive: d.isActive ?? true,
      };
      store.materials.push(mat);
      count++;
    }
    saveStore();
    return { count };
  },
  async update(args: { where: { id: string }; data: Partial<Pick<Material, "category" | "itemName" | "grade" | "unit" | "unitPrice" | "visualHint" | "isActive">> }) {
    const m = store.materials.find((x) => x.id === args.where.id);
    if (!m) throw new Error("Material not found");
    if (args.data.category !== undefined) m.category = args.data.category as string;
    if (args.data.itemName !== undefined) m.itemName = args.data.itemName as string;
    if (args.data.grade !== undefined) m.grade = args.data.grade as OptionTier;
    if (args.data.unit !== undefined) m.unit = args.data.unit as string;
    if (args.data.unitPrice !== undefined) m.unitPrice = Number(args.data.unitPrice);
    if (args.data.visualHint !== undefined) m.visualHint = (args.data.visualHint as string | null) ?? null;
    if (args.data.isActive !== undefined) m.isActive = Boolean(args.data.isActive);
    saveStore();
    return { ...m };
  },
  async delete(args: { where: { id: string } }) {
    const idx = store.materials.findIndex((x) => x.id === args.where.id);
    if (idx === -1) throw new Error("Material not found");
    const [removed] = store.materials.splice(idx, 1);
    // Set null on option items? keep referential but null
    for (const oi of store.estimateOptionItems) {
      if (oi.materialId === args.where.id) oi.materialId = null;
    }
    saveStore();
    return removed;
  },
  async deleteMany(args?: { where?: Record<string, unknown> }) {
    const before = store.materials.length;
    if (!args?.where) {
      store.materials = [];
    } else {
      const toDelete = store.materials.filter((m) => matchesWhere(m as unknown as Record<string, unknown>, args.where));
      const ids = new Set(toDelete.map((x) => x.id));
      store.materials = store.materials.filter((m) => !matchesWhere(m as unknown as Record<string, unknown>, args.where));
      for (const oi of store.estimateOptionItems) {
        if (oi.materialId && ids.has(oi.materialId)) oi.materialId = null;
      }
    }
    const count = before - store.materials.length;
    saveStore();
    return { count };
  },
  async count(args?: { where?: Record<string, unknown> }) {
    return store.materials.filter((m) => matchesWhere(m as unknown as Record<string, unknown>, args?.where)).length;
  },
};

// --- estimateRender ---
const estimateRender = {
  async findMany(args?: { where?: Record<string, unknown>; orderBy?: Record<string, "asc" | "desc"> | Record<string, "asc" | "desc">[] }) {
    let arr = store.estimateRenders.filter((r) => matchesWhere(r as unknown as Record<string, unknown>, args?.where));
    if (args?.orderBy) arr = sortBy(arr, args.orderBy as never);
    return arr.map((r) => ({ ...r }));
  },
  async findUnique(args: { where: { id: string } }) {
    return store.estimateRenders.find((r) => r.id === args.where.id) ?? null;
  },
  async create(args: { data: { estimateId: string; basePhotoPath: string; renderPath?: string | null; status?: string; model?: string | null; promptHash?: string | null; promptSnapshot?: string | null; error?: string | null; tier?: string | null; optionId?: string | null } }) {
    const r: EstimateRender = {
      id: randomUUID(),
      estimateId: args.data.estimateId,
      basePhotoPath: args.data.basePhotoPath,
      renderPath: args.data.renderPath ?? null,
      status: args.data.status ?? "pending",
      model: args.data.model ?? null,
      promptHash: args.data.promptHash ?? null,
      promptSnapshot: args.data.promptSnapshot ?? null,
      error: args.data.error ?? null,
      createdAt: new Date(),
      renderedAt: null,
      tier: args.data.tier ?? null,
      optionId: args.data.optionId ?? null,
    };
    store.estimateRenders.push(r);
    saveStore();
    return { ...r };
  },
  async update(args: { where: { id: string }; data: Partial<Pick<EstimateRender, "renderPath" | "status" | "model" | "promptHash" | "promptSnapshot" | "error" | "renderedAt" | "tier" | "optionId">> & { renderedAt?: Date | null } }) {
    const r = store.estimateRenders.find((x) => x.id === args.where.id);
    if (!r) throw new Error("EstimateRender not found");
    if ("renderPath" in args.data) r.renderPath = (args.data.renderPath as string | null) ?? null;
    if ("status" in args.data) r.status = args.data.status as string;
    if ("model" in args.data) r.model = (args.data.model as string | null) ?? null;
    if ("promptHash" in args.data) r.promptHash = (args.data.promptHash as string | null) ?? null;
    if ("promptSnapshot" in args.data) r.promptSnapshot = (args.data.promptSnapshot as string | null) ?? null;
    if ("error" in args.data) r.error = (args.data.error as string | null) ?? null;
    if ("renderedAt" in args.data) r.renderedAt = (args.data.renderedAt as Date | null) ?? null;
    if ("tier" in args.data) r.tier = (args.data.tier as string | null) ?? null;
    if ("optionId" in args.data) r.optionId = (args.data.optionId as string | null) ?? null;
    saveStore();
    return { ...r };
  },
  async delete(args: { where: { id: string } }) {
    const idx = store.estimateRenders.findIndex((x) => x.id === args.where.id);
    if (idx === -1) throw new Error("EstimateRender not found");
    const [removed] = store.estimateRenders.splice(idx, 1);
    saveStore();
    return removed;
  },
  async deleteMany(args?: { where?: Record<string, unknown> }) {
    const before = store.estimateRenders.length;
    if (!args?.where) {
      store.estimateRenders = [];
    } else {
      store.estimateRenders = store.estimateRenders.filter((r) => !matchesWhere(r as unknown as Record<string, unknown>, args.where));
    }
    const count = before - store.estimateRenders.length;
    saveStore();
    return { count };
  },
};

// --- estimate ---
const estimate = {
  async findMany(args?: {
    where?: Record<string, unknown>;
    include?: { items?: boolean; renders?: boolean; options?: boolean | { include?: { items?: boolean; renders?: boolean } } };
    orderBy?: Record<string, "asc" | "desc">;
    take?: number;
  }) {
    let arr = store.estimates.filter((e) => matchesWhere(e as unknown as Record<string, unknown>, args?.where));
    if (args?.orderBy) arr = sortBy(arr, args.orderBy);
    if (args?.take) arr = arr.slice(0, args.take);
    if (args?.include) {
      return arr.map((e) => ({
        ...e,
        ...(args.include?.items ? { items: store.estimateItems.filter((it) => it.estimateId === e.id) } : {}),
        ...(args.include?.renders ? { renders: store.estimateRenders.filter((r) => r.estimateId === e.id) } : {}),
        ...(args.include?.options
          ? {
              options: (() => {
                let opts = store.estimateOptions.filter((o) => o.estimateId === e.id);
                const inc = typeof args.include!.options === "object" ? (args.include!.options as { include?: { items?: boolean; renders?: boolean } }).include : undefined;
                if (inc?.items || inc?.renders) {
                  return opts.map((o) => ({
                    ...o,
                    ...(inc.items ? { items: store.estimateOptionItems.filter((it) => it.optionId === o.id) } : {}),
                    ...(inc.renders ? { renders: store.estimateRenders.filter((r) => r.optionId === o.id) } : {}),
                  }));
                }
                return opts.map((o) => ({ ...o }));
              })(),
            }
          : {}),
      }));
    }
    return arr.map((e) => ({ ...e }));
  },
  async findUnique(args: {
    where: { id: string };
    include?: { items?: boolean | { orderBy?: Record<string, "asc" | "desc"> }; renders?: boolean; options?: boolean | { include?: { items?: boolean; renders?: boolean } } };
  }) {
    const e = store.estimates.find((x) => x.id === args.where.id);
    if (!e) return null;
    if (args.include) {
      let items: EstimateItem[] | undefined;
      let renders: EstimateRender[] | undefined;
      let options: unknown;
      if (args.include.items) {
        let it = store.estimateItems.filter((it) => it.estimateId === e.id);
        const orderBy = typeof args.include.items === "object" && args.include.items.orderBy ? args.include.items.orderBy : undefined;
        if (orderBy) it = sortBy(it, orderBy);
        items = it;
      }
      if (args.include.renders) {
        renders = store.estimateRenders.filter((r) => r.estimateId === e.id);
      }
      if (args.include.options) {
        let opts = store.estimateOptions.filter((o) => o.estimateId === e.id);
        const inc = typeof args.include.options === "object" ? (args.include.options as { include?: { items?: boolean; renders?: boolean } }).include : undefined;
        if (inc?.items || inc?.renders) {
          options = opts.map((o) => ({
            ...o,
            ...(inc.items ? { items: store.estimateOptionItems.filter((it) => it.optionId === o.id) } : {}),
            ...(inc.renders ? { renders: store.estimateRenders.filter((r) => r.optionId === o.id) } : {}),
          }));
        } else {
          options = opts.map((o) => ({ ...o }));
        }
      }
      return { ...e, ...(items !== undefined ? { items } : {}), ...(renders !== undefined ? { renders } : {}), ...(options !== undefined ? { options } : {}) };
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
      proofHash?: string | null;
      lastRenderedAt?: Date | null;
      lengthM?: number | null;
      widthM?: number | null;
      heightM?: number | null;
      style?: string | null;
      styleTags?: string[];
      budgetTier?: string | null;
      budgetDZD?: number | null;
      contractorNotes?: string | null;
      selectedOptionId?: string | null;
      items?: { create: Omit<EstimateItem, "id" | "estimateId">[] };
      options?: { create: (Omit<EstimateOption, "id" | "estimateId"> & { items?: { create: Omit<EstimateOptionItem, "id" | "optionId">[] } })[] };
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
      proofHash: (args.data.proofHash as string | null) ?? null,
      lastRenderedAt: (args.data.lastRenderedAt as Date | null) ?? null,
      createdAt: new Date(),
      lengthM: args.data.lengthM != null ? Number(args.data.lengthM) : null,
      widthM: args.data.widthM != null ? Number(args.data.widthM) : null,
      heightM: args.data.heightM != null ? Number(args.data.heightM) : null,
      style: args.data.style ?? null,
      styleTags: Array.isArray(args.data.styleTags) ? [...args.data.styleTags] : [],
      budgetTier: args.data.budgetTier ?? null,
      budgetDZD: args.data.budgetDZD != null ? Number(args.data.budgetDZD) : null,
      contractorNotes: args.data.contractorNotes ?? null,
      selectedOptionId: args.data.selectedOptionId ?? null,
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
    if (args.data.options?.create) {
      for (const opt of args.data.options.create) {
        // enforce unique estimateId+tier
        const exists = store.estimateOptions.find((o) => o.estimateId === id && o.tier === (opt as EstimateOption).tier);
        if (exists) throw new Error(`Unique constraint failed on estimateId+tier: ${id} ${(opt as EstimateOption).tier}`);
        const optId = randomUUID();
        const eo: EstimateOption = {
          id: optId,
          estimateId: id,
          tier: (opt as EstimateOption).tier as OptionTier,
          title: (opt as EstimateOption).title,
          total: Number((opt as EstimateOption).total),
          proofHash: (opt as EstimateOption).proofHash ?? null,
        };
        store.estimateOptions.push(eo);
        const itemsCreate = (opt as unknown as { items?: { create: Omit<EstimateOptionItem, "id" | "optionId">[] } }).items?.create;
        if (itemsCreate) {
          for (const it of itemsCreate) {
            const eoi: EstimateOptionItem = {
              id: randomUUID(),
              optionId: optId,
              materialId: (it as EstimateOptionItem).materialId ?? null,
              itemName: it.itemName,
              quantity: Number(it.quantity),
              unit: it.unit,
              unitPrice: Number(it.unitPrice),
              lineTotal: Number(it.lineTotal),
              category: it.category,
            };
            store.estimateOptionItems.push(eoi);
          }
        }
      }
    }
    saveStore();
    // return with items/options
    return {
      ...e,
      items: store.estimateItems.filter((it) => it.estimateId === id),
      options: store.estimateOptions.filter((o) => o.estimateId === id).map((o) => ({
        ...o,
        items: store.estimateOptionItems.filter((it) => it.optionId === o.id),
      })),
    };
  },
  async update(args: { where: { id: string }; data: Partial<Pick<Estimate, "clientName" | "roomType" | "areaM2" | "status" | "proofHash" | "lastRenderedAt" | "lengthM" | "widthM" | "heightM" | "style" | "styleTags" | "budgetTier" | "budgetDZD" | "contractorNotes" | "selectedOptionId">> }) {
    const e = store.estimates.find((x) => x.id === args.where.id);
    if (!e) throw new Error("Estimate not found");
    if ("clientName" in args.data) e.clientName = (args.data.clientName as string | null) ?? null;
    if ("roomType" in args.data) e.roomType = (args.data.roomType as string | null) ?? null;
    if ("areaM2" in args.data) e.areaM2 = args.data.areaM2 != null ? Number(args.data.areaM2 as number) : null;
    if ("status" in args.data) e.status = args.data.status as "draft" | "final";
    if ("proofHash" in args.data) e.proofHash = (args.data.proofHash as string | null) ?? null;
    if ("lastRenderedAt" in args.data) e.lastRenderedAt = (args.data.lastRenderedAt as Date | null) ?? null;
    if ("lengthM" in args.data) e.lengthM = args.data.lengthM != null ? Number(args.data.lengthM as number) : null;
    if ("widthM" in args.data) e.widthM = args.data.widthM != null ? Number(args.data.widthM as number) : null;
    if ("heightM" in args.data) e.heightM = args.data.heightM != null ? Number(args.data.heightM as number) : null;
    if ("style" in args.data) e.style = (args.data.style as string | null) ?? null;
    if ("styleTags" in args.data) e.styleTags = Array.isArray(args.data.styleTags) ? [...(args.data.styleTags as string[])] : [];
    if ("budgetTier" in args.data) e.budgetTier = (args.data.budgetTier as string | null) ?? null;
    if ("budgetDZD" in args.data) e.budgetDZD = args.data.budgetDZD != null ? Number(args.data.budgetDZD as number) : null;
    if ("contractorNotes" in args.data) e.contractorNotes = (args.data.contractorNotes as string | null) ?? null;
    if ("selectedOptionId" in args.data) e.selectedOptionId = (args.data.selectedOptionId as string | null) ?? null;
    saveStore();
    return { ...e };
  },
  async delete(args: { where: { id: string } }) {
    const idx = store.estimates.findIndex((x) => x.id === args.where.id);
    if (idx === -1) throw new Error("Estimate not found");
    const [removed] = store.estimates.splice(idx, 1);
    // cascade delete items
    store.estimateItems = store.estimateItems.filter((it) => it.estimateId !== args.where.id);
    // cascade delete options and their items/renders
    const optionIds = store.estimateOptions.filter((o) => o.estimateId === args.where.id).map((o) => o.id);
    store.estimateOptions = store.estimateOptions.filter((o) => o.estimateId !== args.where.id);
    store.estimateOptionItems = store.estimateOptionItems.filter((it) => !optionIds.includes(it.optionId));
    store.estimateRenders = store.estimateRenders.filter((r) => r.estimateId !== args.where.id);
    saveStore();
    return removed;
  },
};

// --- estimateItem ---
const estimateItem = {
  async findUnique(args: { where: { id: string } }) {
    return store.estimateItems.find((it) => it.id === args.where.id) ?? null;
  },
  async findMany(args?: { where?: Record<string, unknown>; orderBy?: Record<string, "asc" | "desc"> | Record<string, "asc" | "desc">[] }) {
    let arr = store.estimateItems.filter((it) => matchesWhere(it as unknown as Record<string, unknown>, args?.where));
    if (args?.orderBy) arr = sortBy(arr, args.orderBy as never);
    return arr.map((it) => ({ ...it }));
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
  async deleteMany(args?: { where?: Record<string, unknown> }) {
    const before = store.estimateItems.length;
    if (!args?.where) store.estimateItems = [];
    else store.estimateItems = store.estimateItems.filter((it) => !matchesWhere(it as unknown as Record<string, unknown>, args.where));
    const count = before - store.estimateItems.length;
    saveStore();
    return { count };
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
  async createMany(args: { data: { estimateId: string; priceItemId?: string | null; itemName: string; quantity: number; unit: string; unitPrice: number; lineTotal: number; matched: boolean; source: "ai_extracted" | "manual" }[] }) {
    let count = 0;
    for (const d of args.data) {
      const ei: EstimateItem = {
        id: randomUUID(),
        estimateId: d.estimateId,
        priceItemId: d.priceItemId ?? null,
        itemName: d.itemName,
        quantity: Number(d.quantity),
        unit: d.unit,
        unitPrice: Number(d.unitPrice),
        lineTotal: Number(d.lineTotal),
        matched: Boolean(d.matched),
        source: d.source,
      };
      store.estimateItems.push(ei);
      count++;
    }
    saveStore();
    return { count };
  },
};

// --- estimateOption ---
const estimateOption = {
  async findMany(args?: { where?: Record<string, unknown>; include?: { items?: boolean; renders?: boolean }; orderBy?: Record<string, "asc" | "desc"> | Record<string, "asc" | "desc">[] }) {
    let arr = store.estimateOptions.filter((o) => matchesWhere(o as unknown as Record<string, unknown>, args?.where));
    if (args?.orderBy) arr = sortBy(arr, args.orderBy as never);
    if (args?.include?.items || args?.include?.renders) {
      return arr.map((o) => ({
        ...o,
        ...(args.include!.items ? { items: store.estimateOptionItems.filter((it) => it.optionId === o.id) } : {}),
        ...(args.include!.renders ? { renders: store.estimateRenders.filter((r) => r.optionId === o.id) } : {}),
      }));
    }
    return arr.map((o) => ({ ...o }));
  },
  async findUnique(args: { where: { id: string } | { estimateId_tier: { estimateId: string; tier: string } }; include?: { items?: boolean; renders?: boolean } }) {
    let found: EstimateOption | undefined;
    if ("id" in args.where) {
      found = store.estimateOptions.find((o) => o.id === (args.where as { id: string }).id);
    } else if ("estimateId_tier" in args.where) {
      const w = (args.where as { estimateId_tier: { estimateId: string; tier: string } }).estimateId_tier;
      found = store.estimateOptions.find((o) => o.estimateId === w.estimateId && o.tier === w.tier);
    } else {
      // generic fallback
      found = store.estimateOptions.find((o) => matchesWhere(o as unknown as Record<string, unknown>, args.where as Record<string, unknown>));
    }
    if (!found) return null;
    if (args.include?.items || args.include?.renders) {
      return {
        ...found,
        ...(args.include.items ? { items: store.estimateOptionItems.filter((it) => it.optionId === found!.id) } : {}),
        ...(args.include.renders ? { renders: store.estimateRenders.filter((r) => r.optionId === found!.id) } : {}),
      };
    }
    return { ...found };
  },
  async findFirst(args?: { where?: Record<string, unknown>; orderBy?: Record<string, "asc" | "desc"> | Record<string, "asc" | "desc">[]; include?: { items?: boolean; renders?: boolean } }) {
    let arr = store.estimateOptions.filter((o) => matchesWhere(o as unknown as Record<string, unknown>, args?.where));
    if (args?.orderBy) arr = sortBy(arr, args.orderBy as never);
    const found = arr[0] ?? null;
    if (!found) return null;
    if (args?.include?.items || args?.include?.renders) {
      return {
        ...found,
        ...(args.include.items ? { items: store.estimateOptionItems.filter((it) => it.optionId === found.id) } : {}),
        ...(args.include.renders ? { renders: store.estimateRenders.filter((r) => r.optionId === found.id) } : {}),
      };
    }
    return { ...found };
  },
  async create(args: { data: { estimateId: string; tier: OptionTier | string; title: string; total: number | string; proofHash?: string | null; items?: { create: Omit<EstimateOptionItem, "id" | "optionId">[] } } }) {
    // enforce unique
    const exists = store.estimateOptions.find((o) => o.estimateId === args.data.estimateId && o.tier === args.data.tier);
    if (exists) throw new Error(`Unique constraint failed on estimateId+tier: ${args.data.estimateId} ${args.data.tier}`);
    const o: EstimateOption = {
      id: randomUUID(),
      estimateId: args.data.estimateId,
      tier: args.data.tier as OptionTier,
      title: args.data.title,
      total: Number(args.data.total),
      proofHash: args.data.proofHash ?? null,
    };
    store.estimateOptions.push(o);
    if (args.data.items?.create) {
      for (const it of args.data.items.create) {
        const eoi: EstimateOptionItem = {
          id: randomUUID(),
          optionId: o.id,
          materialId: (it as EstimateOptionItem).materialId ?? null,
          itemName: it.itemName,
          quantity: Number(it.quantity),
          unit: it.unit,
          unitPrice: Number(it.unitPrice),
          lineTotal: Number(it.lineTotal),
          category: it.category,
        };
        store.estimateOptionItems.push(eoi);
      }
    }
    saveStore();
    const items = store.estimateOptionItems.filter((it) => it.optionId === o.id);
    return { ...o, items };
  },
  async update(args: { where: { id: string }; data: Partial<Pick<EstimateOption, "title" | "total" | "proofHash" | "tier">> }) {
    const o = store.estimateOptions.find((x) => x.id === args.where.id);
    if (!o) throw new Error("EstimateOption not found");
    if (args.data.title !== undefined) o.title = args.data.title as string;
    if (args.data.total !== undefined) o.total = Number(args.data.total);
    if (args.data.proofHash !== undefined) o.proofHash = (args.data.proofHash as string | null) ?? null;
    if (args.data.tier !== undefined) {
      // check unique
      const dup = store.estimateOptions.find((x) => x.estimateId === o.estimateId && x.tier === args.data.tier && x.id !== o.id);
      if (dup) throw new Error(`Unique constraint failed on estimateId+tier`);
      o.tier = args.data.tier as OptionTier;
    }
    saveStore();
    return { ...o };
  },
  async delete(args: { where: { id: string } }) {
    const idx = store.estimateOptions.findIndex((x) => x.id === args.where.id);
    if (idx === -1) throw new Error("EstimateOption not found");
    const [removed] = store.estimateOptions.splice(idx, 1);
    // cascade
    store.estimateOptionItems = store.estimateOptionItems.filter((it) => it.optionId !== args.where.id);
    store.estimateRenders = store.estimateRenders.filter((r) => r.optionId !== args.where.id);
    saveStore();
    return removed;
  },
  async deleteMany(args?: { where?: Record<string, unknown> }) {
    const before = store.estimateOptions.length;
    let toDelete: EstimateOption[];
    if (!args?.where) {
      toDelete = [...store.estimateOptions];
      store.estimateOptions = [];
    } else {
      toDelete = store.estimateOptions.filter((o) => matchesWhere(o as unknown as Record<string, unknown>, args.where));
      store.estimateOptions = store.estimateOptions.filter((o) => !matchesWhere(o as unknown as Record<string, unknown>, args.where));
    }
    const ids = new Set(toDelete.map((o) => o.id));
    store.estimateOptionItems = store.estimateOptionItems.filter((it) => !ids.has(it.optionId));
    store.estimateRenders = store.estimateRenders.filter((r) => !r.optionId || !ids.has(r.optionId));
    const count = before - store.estimateOptions.length;
    saveStore();
    return { count };
  },
  async count(args?: { where?: Record<string, unknown> }) {
    return store.estimateOptions.filter((o) => matchesWhere(o as unknown as Record<string, unknown>, args?.where)).length;
  },
};

// --- estimateOptionItem ---
const estimateOptionItem = {
  async findMany(args?: { where?: Record<string, unknown>; orderBy?: Record<string, "asc" | "desc"> | Record<string, "asc" | "desc">[] }) {
    let arr = store.estimateOptionItems.filter((it) => matchesWhere(it as unknown as Record<string, unknown>, args?.where));
    if (args?.orderBy) arr = sortBy(arr, args.orderBy as never);
    return arr.map((it) => ({ ...it }));
  },
  async findUnique(args: { where: { id: string } }) {
    return store.estimateOptionItems.find((it) => it.id === args.where.id) ?? null;
  },
  async create(args: { data: { optionId: string; materialId?: string | null; itemName: string; quantity: number | string; unit: string; unitPrice: number | string; lineTotal: number | string; category: string } }) {
    const it: EstimateOptionItem = {
      id: randomUUID(),
      optionId: args.data.optionId,
      materialId: args.data.materialId ?? null,
      itemName: args.data.itemName,
      quantity: Number(args.data.quantity),
      unit: args.data.unit,
      unitPrice: Number(args.data.unitPrice),
      lineTotal: Number(args.data.lineTotal),
      category: args.data.category,
    };
    store.estimateOptionItems.push(it);
    saveStore();
    return { ...it };
  },
  async createMany(args: { data: { optionId: string; materialId?: string | null; itemName: string; quantity: number | string; unit: string; unitPrice: number | string; lineTotal: number | string; category: string }[] }) {
    let count = 0;
    for (const d of args.data) {
      const it: EstimateOptionItem = {
        id: randomUUID(),
        optionId: d.optionId,
        materialId: d.materialId ?? null,
        itemName: d.itemName,
        quantity: Number(d.quantity),
        unit: d.unit,
        unitPrice: Number(d.unitPrice),
        lineTotal: Number(d.lineTotal),
        category: d.category,
      };
      store.estimateOptionItems.push(it);
      count++;
    }
    saveStore();
    return { count };
  },
  async update(args: { where: { id: string }; data: Partial<Pick<EstimateOptionItem, "itemName" | "quantity" | "unit" | "unitPrice" | "lineTotal" | "category" | "materialId">> }) {
    const it = store.estimateOptionItems.find((x) => x.id === args.where.id);
    if (!it) throw new Error("EstimateOptionItem not found");
    if (args.data.itemName !== undefined) it.itemName = args.data.itemName as string;
    if (args.data.quantity !== undefined) it.quantity = Number(args.data.quantity);
    if (args.data.unit !== undefined) it.unit = args.data.unit as string;
    if (args.data.unitPrice !== undefined) it.unitPrice = Number(args.data.unitPrice);
    if (args.data.lineTotal !== undefined) it.lineTotal = Number(args.data.lineTotal);
    if (args.data.category !== undefined) it.category = args.data.category as string;
    if (args.data.materialId !== undefined) it.materialId = (args.data.materialId as string | null) ?? null;
    saveStore();
    return { ...it };
  },
  async delete(args: { where: { id: string } }) {
    const idx = store.estimateOptionItems.findIndex((x) => x.id === args.where.id);
    if (idx === -1) throw new Error("EstimateOptionItem not found");
    const [removed] = store.estimateOptionItems.splice(idx, 1);
    saveStore();
    return removed;
  },
  async deleteMany(args?: { where?: Record<string, unknown> }) {
    const before = store.estimateOptionItems.length;
    if (!args?.where) store.estimateOptionItems = [];
    else store.estimateOptionItems = store.estimateOptionItems.filter((it) => !matchesWhere(it as unknown as Record<string, unknown>, args.where));
    const count = before - store.estimateOptionItems.length;
    saveStore();
    return { count };
  },
  async count(args?: { where?: Record<string, unknown> }) {
    return store.estimateOptionItems.filter((it) => matchesWhere(it as unknown as Record<string, unknown>, args?.where)).length;
  },
};

export const mockPrisma = {
  contractor,
  priceItem,
  material,
  estimate,
  estimateItem,
  estimateRender,
  estimateOption,
  estimateOptionItem,
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
  material: typeof material;
  estimate: typeof estimate;
  estimateItem: typeof estimateItem;
  estimateRender: typeof estimateRender;
  estimateOption: typeof estimateOption;
  estimateOptionItem: typeof estimateOptionItem;
  readonly _store: Store;
  _save: typeof saveStore;
  _reload: () => void;
};

// Reset helper for dev
export function resetMockStore() {
  store = { contractors: [], priceItems: [], estimates: [], estimateItems: [], estimateRenders: [], materials: [], estimateOptions: [], estimateOptionItems: [] };
  saveStore();
}
