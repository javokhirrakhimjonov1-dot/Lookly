import { getApiBase } from "../constants/api";
import type { ClothingItem } from "./WardrobeContext";

const API_BASE = getApiBase();

export async function fetchServerItems(): Promise<ClothingItem[]> {
  try {
    const res = await fetch(`${API_BASE}/items`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return [];
    const data = await res.json() as { items: ClothingItem[] };
    return data.items ?? [];
  } catch {
    return [];
  }
}

export async function syncItemToServer(item: ClothingItem): Promise<void> {
  try {
    await fetch(`${API_BASE}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(item),
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    // Server sync is best-effort
  }
}

export async function deleteItemOnServer(id: string): Promise<void> {
  try {
    await fetch(`${API_BASE}/items/${encodeURIComponent(id)}`, {
      method: "DELETE",
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    // Server sync is best-effort
  }
}
