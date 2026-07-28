import { getApiBase } from "../constants/api";
import type { ClothingItem, Currency, SavedOutfit } from "./WardrobeContext";
import { supabase } from "@/lib/supabase";

const API_BASE = getApiBase();
const PRIVATE_IMAGE_BUCKET = "lookly-private";

type SupabaseWardrobeItem = {
  id: string;
  name: string;
  category: ClothingItem["category"];
  color: string;
  color_hex: string;
  seasons: ClothingItem["seasons"];
  fabric_weight: ClothingItem["fabricWeight"];
  is_workwear: boolean;
  purchase_price: number | null;
  purchase_currency?: Currency | null;
  times_worn: number;
  photo_path: string | null;
  tags: string[];
  brand_logo: ClothingItem["brandLogo"] | null;
  created_at: string;
};

type SupabaseSavedOutfit = {
  id: string;
  name: string;
  items: SavedOutfit["items"];
  preview_path: string | null;
  created_at: string;
};

async function resolvePrivateImage(photoPath: string | null): Promise<string | undefined> {
  if (!photoPath) return undefined;
  // Existing local URLs remain usable during the migration. New records store
  // only a private Storage path, never a device-specific localhost URL.
  if (/^(https?:|data:|file:|blob:)/i.test(photoPath)) return photoPath;
  if (!supabase) return undefined;
  const { data, error } = await supabase.storage
    .from(PRIVATE_IMAGE_BUCKET)
    .createSignedUrl(photoPath, 60 * 60 * 24 * 7);
  return error ? undefined : data.signedUrl;
}

async function toClientItem(item: SupabaseWardrobeItem): Promise<ClothingItem> {
  return {
    id: item.id,
    name: item.name,
    category: item.category,
    color: item.color,
    colorHex: item.color_hex,
    seasons: item.seasons,
    fabricWeight: item.fabric_weight,
    isWorkwear: item.is_workwear,
    purchasePrice: item.purchase_price ?? undefined,
    purchaseCurrency: item.purchase_currency ?? "USD",
    timesWorn: item.times_worn,
    imageUri: await resolvePrivateImage(item.photo_path),
    tags: item.tags,
    brandLogo: item.brand_logo ?? undefined,
    createdAt: item.created_at,
  };
}

function extensionForContentType(contentType: string): string {
  if (contentType.includes("webp")) return "webp";
  if (contentType.includes("png")) return "png";
  if (contentType.includes("gif")) return "gif";
  return "jpg";
}

function storagePathFor(userId: string, itemId: string, contentType: string): string {
  return `${userId}/wardrobe/${itemId}.${extensionForContentType(contentType)}`;
}

function outfitPreviewPathFor(userId: string, outfitId: string, preview?: string): string {
  const isSvg = preview?.startsWith("data:image/svg+xml") || preview?.trimStart().startsWith("PHN2Zy");
  return `${userId}/outfits/${outfitId}.${isSvg ? "svg" : "png"}`;
}

async function imageUriToUpload(uri: string): Promise<{ bytes: ArrayBuffer; contentType: string }> {
  if (uri.startsWith("data:")) {
    const contentType = uri.match(/^data:([^;,]+)/i)?.[1] ?? "image/png";
    const base64 = uri.split(",")[1] ?? "";
    const binary = globalThis.atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return { bytes: bytes.buffer, contentType };
  }
  const response = await fetch(uri);
  if (!response.ok) throw new Error("Could not read the item image for cloud storage");
  return {
    bytes: await response.arrayBuffer(),
    contentType: response.headers.get("content-type")?.split(";")[0] ?? "image/jpeg",
  };
}

function rawBase64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = globalThis.atob(base64.includes(",") ? base64.split(",")[1]! : base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes.buffer;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return globalThis.btoa(binary);
}

async function uploadPrivateImage(userId: string, itemId: string, imageUri?: string): Promise<string | null> {
  if (!supabase || !imageUri) return null;
  try {
    const file = await imageUriToUpload(imageUri);
    const path = storagePathFor(userId, itemId, file.contentType);
    // A reprocessed item may change from JPEG to PNG. Remove any former
    // extension first so a single wardrobe item never leaves orphaned files.
    const oldPaths = ["jpg", "png", "webp", "gif"]
      .map((extension) => `${userId}/wardrobe/${itemId}.${extension}`)
      .filter((candidate) => candidate !== path);
    await supabase.storage.from(PRIVATE_IMAGE_BUCKET).remove(oldPaths);
    const { error } = await supabase.storage.from(PRIVATE_IMAGE_BUCKET).upload(path, file.bytes, {
      contentType: file.contentType,
      upsert: true,
    });
    return error ? null : path;
  } catch {
    return null;
  }
}

async function uploadOutfitPreview(userId: string, outfitId: string, preview?: string): Promise<string | null> {
  if (!supabase || !preview) return null;
  try {
    const isSvg = preview.startsWith("data:image/svg+xml") || preview.trimStart().startsWith("PHN2Zy");
    const path = outfitPreviewPathFor(userId, outfitId, preview);
    const { error } = await supabase.storage.from(PRIVATE_IMAGE_BUCKET).upload(
      path,
      rawBase64ToArrayBuffer(preview),
      { contentType: isSvg ? "image/svg+xml" : "image/png", upsert: true },
    );
    return error ? null : path;
  } catch {
    return null;
  }
}

async function downloadOutfitPreview(path: string | null): Promise<string | undefined> {
  if (!supabase || !path) return undefined;
  try {
    const { data, error } = await supabase.storage.from(PRIVATE_IMAGE_BUCKET).createSignedUrl(path, 60 * 60 * 24 * 7);
    if (error) return undefined;
    const response = await fetch(data.signedUrl);
    if (!response.ok) return undefined;
    const contentType = response.headers.get("content-type")?.split(";")[0]
      || (path.endsWith(".svg") ? "image/svg+xml" : "image/png");
    return `data:${contentType};base64,${arrayBufferToBase64(await response.arrayBuffer())}`;
  } catch {
    return undefined;
  }
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function fetchServerItems(): Promise<ClothingItem[]> {
  if (supabase) {
    const { data, error } = await supabase
      .from("wardrobe_items")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) return [];
    return Promise.all((data as SupabaseWardrobeItem[]).map(toClientItem));
  }

  try {
    const res = await fetch(`${API_BASE}/items`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return [];
    const data = await res.json() as { items: ClothingItem[] };
    return data.items ?? [];
  } catch {
    return [];
  }
}

export async function fetchServerOutfits(): Promise<SavedOutfit[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("saved_outfits")
    .select("id, name, items, preview_path, created_at")
    .order("created_at", { ascending: false });
  if (error) return [];
  return Promise.all((data as SupabaseSavedOutfit[]).map(async (outfit) => ({
    id: outfit.id,
    name: outfit.name,
    items: outfit.items ?? {},
    previewImage: await downloadOutfitPreview(outfit.preview_path),
    createdAt: outfit.created_at,
  })));
}

export async function syncItemToServer(item: ClothingItem): Promise<void> {
  if (supabase) {
    // Items created before Supabase used timestamp IDs; leave those on-device
    // rather than accidentally creating duplicate cloud records.
    if (!isUuid(item.id)) return;
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) return;
    // Save the lightweight wardrobe record before any slow image work. This
    // means an item survives navigation, refreshes and slow connections even
    // if studio processing or Storage uploads are still running.
    const { data: existing } = await supabase
      .from("wardrobe_items")
      .select("photo_path")
      .eq("id", item.id)
      .maybeSingle();
    const { error } = await supabase.from("wardrobe_items").upsert({
      id: item.id,
      user_id: authData.user.id,
      name: item.name,
      category: item.category,
      color: item.color,
      color_hex: item.colorHex,
      seasons: item.seasons,
      fabric_weight: item.fabricWeight,
      is_workwear: item.isWorkwear,
      purchase_price: item.purchasePrice ?? null,
      purchase_currency: item.purchaseCurrency ?? "USD",
      times_worn: item.timesWorn,
      // Keep an existing cloud image while a replacement is being prepared.
      photo_path: existing?.photo_path ?? null,
      tags: item.tags,
      brand_logo: item.brandLogo ?? null,
      created_at: item.createdAt,
    });
    if (error || !item.imageUri) return;

    // Image upload is deliberately non-blocking. Product art can take longer
    // than the metadata save, but it must never make the user wait to save an
    // item or cause that item to disappear after a refresh.
    void (async () => {
      const photoPath = await uploadPrivateImage(authData.user!.id, item.id, item.imageUri);
      if (!photoPath) return;
      await supabase
        .from("wardrobe_items")
        .update({ photo_path: photoPath })
        .eq("id", item.id)
        .eq("user_id", authData.user!.id);
    })();
    return;
  }

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
  if (supabase) {
    if (isUuid(id)) {
      const { data } = await supabase
        .from("wardrobe_items")
        .select("photo_path")
        .eq("id", id)
        .maybeSingle();
      if (data?.photo_path && !/^(https?:|data:|file:|blob:)/i.test(data.photo_path)) {
        await supabase.storage.from(PRIVATE_IMAGE_BUCKET).remove([data.photo_path]);
      }
      await supabase.from("wardrobe_items").delete().eq("id", id);
    }
    return;
  }

  try {
    await fetch(`${API_BASE}/items/${encodeURIComponent(id)}`, {
      method: "DELETE",
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    // Server sync is best-effort
  }
}

export async function syncSavedOutfit(outfit: SavedOutfit): Promise<void> {
  if (!supabase || !isUuid(outfit.id)) return;
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return;
  const previewPath = await uploadOutfitPreview(authData.user.id, outfit.id, outfit.previewImage);
  await supabase.from("saved_outfits").upsert({
    id: outfit.id,
    user_id: authData.user.id,
    name: outfit.name,
    items: outfit.items,
    preview_path: previewPath,
    created_at: outfit.createdAt,
  });
}

export async function deleteSavedOutfitOnServer(id: string): Promise<void> {
  if (supabase && isUuid(id)) {
    const { data } = await supabase.from("saved_outfits").select("preview_path").eq("id", id).maybeSingle();
    if (data?.preview_path) await supabase.storage.from(PRIVATE_IMAGE_BUCKET).remove([data.preview_path]);
    await supabase.from("saved_outfits").delete().eq("id", id);
  }
}
