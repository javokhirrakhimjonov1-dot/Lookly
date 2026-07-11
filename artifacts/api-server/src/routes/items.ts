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

router.get("/items", (req, res) => {
  try {
    const items = getAllItems();
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
    res.json(item);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[items] GET /items/:id error:", msg);
    res.status(500).json({ error: "Failed to fetch item" });
  }
});

router.post("/items", (req, res) => {
  try {
    const body = req.body as Partial<DbClothingItem>;
    if (!body.id || !body.name || !body.category) {
      res.status(400).json({ error: "id, name, and category are required" });
      return;
    }
    const safe: Partial<DbClothingItem> = {
      id: body.id,
      name: body.name,
      category: body.category,
      colorName: body.colorName,
      colorHex: body.colorHex,
      material: body.material,
      fabricWeight: body.fabricWeight,
      seasons: body.seasons,
      tags: body.tags,
      imageUri: body.imageUri,
    };
    upsertItem(safe as DbClothingItem);
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
    const allowedFields = [
      "name", "category", "colorName", "colorHex", "material",
      "fabricWeight", "seasons", "tags", "imageUri",
    ];
    const sanitized: Partial<DbClothingItem> = { id: req.params.id };
    for (const key of allowedFields) {
      if (req.body[key] !== undefined) {
        (sanitized as Record<string, unknown>)[key] = req.body[key];
      }
    }
    const updated = { ...existing, ...sanitized };
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
    const { items } = req.body as { items: Partial<DbClothingItem>[] };
    if (!Array.isArray(items)) {
      res.status(400).json({ error: "items array is required" });
      return;
    }
    const allowedFields = [
      "id", "name", "category", "colorName", "colorHex", "material",
      "fabricWeight", "seasons", "tags", "imageUri",
    ];
    for (const item of items) {
      if (item.id && item.name && item.category) {
        const safe: Partial<DbClothingItem> = {};
        for (const key of allowedFields) {
          if (item[key as keyof typeof item] !== undefined) {
            (safe as Record<string, unknown>)[key] = item[key as keyof typeof item];
          }
        }
        upsertItem(safe as DbClothingItem);
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
