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
      tags TEXT NOT NULL DEFAULT '[]',
      brandLogo TEXT,
      createdAt TEXT NOT NULL
    )
  `);

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
  tags: string[];
  brandLogo: string | null;
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
    tags: JSON.parse(row.tags as string),
    brandLogo: row.brandLogo as string | null,
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
      purchasePrice, timesWorn, imageUri, tags, brandLogo, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      JSON.stringify(item.tags),
      item.brandLogo ?? null,
      item.createdAt,
    ],
  );
  save();
}

export function deleteItem(id: string): void {
  getDb().run("DELETE FROM wardrobe_items WHERE id = ?", [id]);
  save();
}
