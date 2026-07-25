import { Router } from "express";
import {
  getAllItems,
  getItemById,
  upsertItem,
  deleteItem,
  persist,
  type DbClothingItem,
} from "../lib/db";

const router = Router();

type ClientItem = Omit<Partial<DbClothingItem>, "brandLogo"> & {
  colorName?: string;
  material?: string;
  brandLogo?: unknown;
};

function serializeBrandLogo(value: unknown, fallback: string | null): string | null {
  if (value === undefined) return fallback;
  if (value === null) return null;
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return fallback;
  }
}

function parseBrandLogo(value: string | null): unknown {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function toClientItem(item: DbClothingItem) {
  return { ...item, brandLogo: parseBrandLogo(item.brandLogo) };
}

function toDbItem(input: ClientItem, existing?: DbClothingItem | null): DbClothingItem {
  const now = new Date().toISOString();
  return {
    id: input.id ?? existing?.id ?? "",
    name: input.name ?? existing?.name ?? "",
    category: input.category ?? existing?.category ?? "",
    // Older AI responses use colorName. The mobile app uses color.
    color: input.color ?? input.colorName ?? existing?.color ?? "",
    colorHex: input.colorHex ?? existing?.colorHex ?? "",
    seasons: Array.isArray(input.seasons) ? input.seasons : (existing?.seasons ?? []),
    fabricWeight: input.fabricWeight ?? existing?.fabricWeight ?? "medium",
    isWorkwear: input.isWorkwear ?? existing?.isWorkwear ?? false,
    purchasePrice: input.purchasePrice ?? existing?.purchasePrice ?? null,
    timesWorn: input.timesWorn ?? existing?.timesWorn ?? 0,
    imageUri: input.imageUri ?? existing?.imageUri ?? null,
    tags: Array.isArray(input.tags) ? input.tags : (existing?.tags ?? []),
    brandLogo: serializeBrandLogo(input.brandLogo, existing?.brandLogo ?? null),
    createdAt: input.createdAt ?? existing?.createdAt ?? now,
  };
}

function hasRequiredFields(item: DbClothingItem): boolean {
  return Boolean(item.id && item.name && item.category);
}

router.get("/items", (req, res) => {
  try {
    const items = getAllItems().map(toClientItem);
    res.json({ items });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[items] GET /items error:", msg);
    res.status(500).json({ error: "Failed to fetch items" });
  }
});

router.get("/items/:id", (req, res) => {
  try {
    const item = getItemById(req.params.id);
    if (!item) {
      res.status(404).json({ error: "Item not found" });
      return;
    }
    res.json(toClientItem(item));
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[items] GET /items/:id error:", msg);
    res.status(500).json({ error: "Failed to fetch item" });
  }
});

router.post("/items", (req, res) => {
  try {
    const body = req.body as ClientItem;
    const item = toDbItem(body);
    if (!hasRequiredFields(item)) {
      res.status(400).json({ error: "id, name, and category are required" });
      return;
    }
    upsertItem(item);
    res.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[items] POST /items error:", msg);
    res.status(500).json({ error: "Failed to create item" });
  }
});

router.put("/items/:id", (req, res) => {
  try {
    const existing = getItemById(req.params.id);
    if (!existing) {
      res.status(404).json({ error: "Item not found" });
      return;
    }
    const updated = toDbItem({ ...(req.body as ClientItem), id: req.params.id }, existing);
    upsertItem(updated);
    res.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[items] PUT /items/:id error:", msg);
    res.status(500).json({ error: "Failed to update item" });
  }
});

router.put("/items", (req, res) => {
  try {
    const { items } = req.body as { items: ClientItem[] };
    if (!Array.isArray(items)) {
      res.status(400).json({ error: "items array is required" });
      return;
    }
    for (const item of items) {
      const existing = item.id ? getItemById(item.id) : null;
      const normalized = toDbItem(item, existing);
      if (hasRequiredFields(normalized)) {
        upsertItem(normalized);
      }
    }
    persist();
    res.json({ ok: true, count: items.length });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[items] PUT /items error:", msg);
    res.status(500).json({ error: "Failed to bulk update items" });
  }
});

router.delete("/items/:id", (req, res) => {
  try {
    deleteItem(req.params.id);
    res.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[items] DELETE /items/:id error:", msg);
    res.status(500).json({ error: "Failed to delete item" });
  }
});

export default router;
