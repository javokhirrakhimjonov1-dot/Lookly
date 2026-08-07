import path from "node:path";
import fs from "node:fs";
import initSqlJs, { Database as SqlJsDatabase } from "sql.js";

const DB_DIR = process.env.DB_DIR || path.resolve(import.meta.dirname, "../../../data");
const DB_PATH = path.join(DB_DIR, "lookly.db");

let db: SqlJsDatabase | null = null;

export async function initDb(): Promise<void> {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  const SQL = await initSqlJs();
  if (fs.existsSync(DB_PATH)) {
    const buf = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buf);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS wardrobe_items (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '',
      colorHex TEXT NOT NULL DEFAULT '',
      seasons TEXT NOT NULL DEFAULT '[]',
      fabricWeight TEXT NOT NULL DEFAULT 'medium',
      isWorkwear INTEGER NOT NULL DEFAULT 0,
      purchasePrice REAL,
      timesWorn INTEGER NOT NULL DEFAULT 0,
      imageUri TEXT,
      imageProcessingVersion INTEGER NOT NULL DEFAULT 0,
      tags TEXT NOT NULL DEFAULT '[]',
      brandLogo TEXT,
      visualSignature TEXT,
      createdAt TEXT NOT NULL
    )
  `);

  const wardrobeColumns = new Set<string>();
  const wardrobeColumnStatement = db.prepare("PRAGMA table_info(wardrobe_items)");
  while (wardrobeColumnStatement.step()) {
    const row = wardrobeColumnStatement.getAsObject() as { name?: unknown };
    if (row.name) wardrobeColumns.add(String(row.name));
  }
  wardrobeColumnStatement.free();
  if (!wardrobeColumns.has("visualSignature")) {
    db.run("ALTER TABLE wardrobe_items ADD COLUMN visualSignature TEXT");
  }
  if (!wardrobeColumns.has("imageProcessingVersion")) {
    db.run("ALTER TABLE wardrobe_items ADD COLUMN imageProcessingVersion INTEGER NOT NULL DEFAULT 0");
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS saved_outfits (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      items TEXT NOT NULL DEFAULT '{}',
      previewImage TEXT,
      createdAt TEXT NOT NULL
    )
  `);

  save();
}

function save(): void {
  if (!db) return;
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

export function getDb(): SqlJsDatabase {
  if (!db) throw new Error("Database not initialized. Call initDb() first.");
  return db;
}

export function persist(): void {
  save();
}

export interface DbClothingItem {
  id: string;
  name: string;
  category: string;
  color: string;
  colorHex: string;
  seasons: string[];
  fabricWeight: string;
  isWorkwear: boolean;
  purchasePrice: number | null;
  timesWorn: number;
  imageUri: string | null;
  imageProcessingVersion: number;
  tags: string[];
  brandLogo: string | null;
  visualSignature: string | null;
  createdAt: string;
}

function rowToItem(row: Record<string, unknown>): DbClothingItem {
  return {
    id: row.id as string,
    name: row.name as string,
    category: row.category as string,
    color: row.color as string,
    colorHex: row.colorHex as string,
    seasons: JSON.parse(row.seasons as string),
    fabricWeight: row.fabricWeight as string,
    isWorkwear: (row.isWorkwear as number) === 1,
    purchasePrice: row.purchasePrice as number | null,
    timesWorn: row.timesWorn as number,
    imageUri: row.imageUri as string | null,
    imageProcessingVersion: Number(row.imageProcessingVersion ?? 0),
    tags: JSON.parse(row.tags as string),
    brandLogo: row.brandLogo as string | null,
    visualSignature: row.visualSignature as string | null,
    createdAt: row.createdAt as string,
  };
}

export function getAllItems(): DbClothingItem[] {
  const stmt = getDb().prepare("SELECT * FROM wardrobe_items ORDER BY createdAt DESC");
  const rows: DbClothingItem[] = [];
  while (stmt.step()) {
    rows.push(rowToItem(stmt.getAsObject() as Record<string, unknown>));
  }
  stmt.free();
  return rows;
}

export function getItemById(id: string): DbClothingItem | null {
  const stmt = getDb().prepare("SELECT * FROM wardrobe_items WHERE id = ?");
  stmt.bind([id]);
  if (stmt.step()) {
    const row = rowToItem(stmt.getAsObject() as Record<string, unknown>);
    stmt.free();
    return row;
  }
  stmt.free();
  return null;
}

export function upsertItem(item: DbClothingItem): void {
  const db = getDb();
  db.run(
    `INSERT OR REPLACE INTO wardrobe_items
     (id, name, category, color, colorHex, seasons, fabricWeight, isWorkwear,
      purchasePrice, timesWorn, imageUri, imageProcessingVersion, tags, brandLogo, visualSignature, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      item.id,
      item.name,
      item.category,
      item.color,
      item.colorHex,
      JSON.stringify(item.seasons),
      item.fabricWeight,
      item.isWorkwear ? 1 : 0,
      item.purchasePrice ?? null,
      item.timesWorn,
      item.imageUri ?? null,
      item.imageProcessingVersion ?? 0,
      JSON.stringify(item.tags),
      item.brandLogo ?? null,
      item.visualSignature ?? null,
      item.createdAt,
    ],
  );
  save();
}

export function deleteItem(id: string): void {
  getDb().run("DELETE FROM wardrobe_items WHERE id = ?", [id]);
  save();
}
