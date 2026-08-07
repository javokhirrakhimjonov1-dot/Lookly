import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Alert, Platform } from "react-native";
import {
  fetchServerItems,
  fetchServerOutfits,
  syncItemToServer,
  syncSavedOutfit,
  deleteItemOnServer,
  deleteSavedOutfitOnServer,
  replaceItemImageOnServer,
} from "./serverSync";
import { useAuth } from "./AuthContext";
import { getApiBase } from "@/constants/api";
import { apiAuthHeaders } from "@/lib/apiAuth";
import { migrateWardrobeIds } from "./wardrobeMigration";

export type ClothingCategory =
  | "tops"
  | "bottoms"
  | "dresses"
  | "outerwear"
  | "shoes"
  | "socks"
  | "accessories";

export type Season = "spring" | "summer" | "fall" | "winter";
export type FabricWeight = "light" | "medium" | "heavy";
export type Currency = "USD" | "UZS" | "RUB";

export interface BrandLogo {
  brand: string;
  description: string;
  position: string;
  size: "small" | "medium" | "large";
}

export interface ClothingVisualSignature {
  itemType: string;
  garmentFamily?: string;
  shape: string;
  silhouette?: string;
  length?: string;
  pattern: string;
  materialFamily: string;
  closures: string[];
  sleeve: string;
  collar: string;
  neckline?: string;
  rise?: string;
  coverage?: string;
  opacity?: string;
  layerRole?: string;
  toeStyle?: string;
  heelType?: string;
  heelHeight?: string;
  bootShaft?: string;
  features: string[];
}

export interface ClothingItem {
  id: string;
  /** Optional nickname chosen by the owner. The AI name stays in `name` for recommendations. */
  customName?: string;
  name: string;
  /** AI-generated names in every supported UI language. */
  localizedNames?: Partial<Record<"en" | "ru" | "uz", string>>;
  category: ClothingCategory;
  color: string;
  colorHex: string;
  seasons: Season[];
  fabricWeight: FabricWeight;
  isWorkwear: boolean;
  purchasePrice?: number;
  purchaseCurrency?: Currency;
  timesWorn: number;
  imageUri?: string;
  /** Version 1 is square-normalized; later versions add category-specific catalog layouts. */
  imageProcessingVersion?: number;
  tags: string[];
  brandLogo?: BrandLogo;
  visualSignature?: ClothingVisualSignature;
  createdAt: string;
}

/** The name people see in the app, without losing the AI's descriptive name. */
export function getItemDisplayName(
  item: Pick<ClothingItem, "name" | "customName" | "localizedNames">,
  lang: "en" | "ru" | "uz" = "en",
): string {
  return item.customName?.trim() || item.localizedNames?.[lang]?.trim() || item.name;
}

export interface SavedOutfit {
  id: string;
  name: string;
  items: OutfitItems;
  previewImage?: string;
  createdAt: string;
}

/**
 * Outfit entries are keyed by their visual slot. Most categories use the
 * category name; repeatable categories (currently accessories) use a stable
 * key such as `accessories:<item id>` so more than one piece can be kept.
 */
export type OutfitItemKey = ClothingCategory | `accessories:${string}`;
export type OutfitItems = Partial<Record<OutfitItemKey, ClothingItem>>;

interface WardrobeContextValue {
  items: ClothingItem[];
  addItem: (item: Omit<ClothingItem, "id" | "createdAt" | "timesWorn">) => Promise<ClothingItem | undefined>;
  addBulkItems: (items: Omit<ClothingItem, "id" | "createdAt" | "timesWorn">[]) => Promise<ClothingItem[]>;
  removeItem: (id: string) => Promise<void>;
  updateItem: (id: string, updates: Partial<ClothingItem>) => Promise<void>;
  markWorn: (ids: string[]) => Promise<void>;
  getItemsByCategory: (category: ClothingCategory) => ClothingItem[];
  getItemsBySeason: (season: Season) => ClothingItem[];
  getCasualItems: () => ClothingItem[];
  getWorkItems: () => ClothingItem[];
  savedOutfits: SavedOutfit[];
  saveOutfit: (
    name: string,
    items: OutfitItems,
    previewImage?: string
  ) => Promise<void>;
  deleteSavedOutfit: (id: string) => Promise<void>;
  isLoading: boolean;
}

const WardrobeContext = createContext<WardrobeContextValue | null>(null);

const itemsKey = (userId: string) => `@lookly_wardrobe_v3_${userId}`;
const outfitsKey = (userId: string) => `@lookly_saved_outfits_v2_${userId}`;
const imageKey = (userId: string, id: string) => `@lookly_img_${userId}_${id}`;
const outfitImageKey = (userId: string, id: string) => `@lookly_outfit_img_${userId}_${id}`;
const LEGACY_ITEMS_KEY = "@lookly_wardrobe_v2";
const LEGACY_OUTFITS_KEY = "@lookly_saved_outfits";
const LEGACY_OWNER_KEY = "@lookly_legacy_wardrobe_owner";
const legacyImageKey = (id: string) => `@lookly_img_${id}`;
const legacyOutfitImageKey = (id: string) => `@lookly_outfit_img_${id}`;
// Pilot safeguards. These are high enough for real testing while keeping the
// first ten accounts within Supabase Storage and device-storage limits.
const MAX_WARDROBE_ITEMS = 150;
const MAX_SAVED_OUTFITS = 50;
const PRODUCT_IMAGE_PROCESSING_VERSION = 1;
const SCARF_CATALOG_PROCESSING_VERSION = 2;
const FOOTWEAR_CATALOG_PROCESSING_VERSION = 3;
const HEADBAND_CATALOG_PROCESSING_VERSION = 4;
const WATCH_CATALOG_PROCESSING_VERSION = 5;
const EYEWEAR_CATALOG_PROCESSING_VERSION = 6;
const HOODIE_CATALOG_PROCESSING_VERSION = 7;
const API_BASE = getApiBase();

function desiredProductImageVersion(item: Pick<ClothingItem, "name" | "category" | "tags" | "visualSignature">): number {
  if (item.category === "shoes") return FOOTWEAR_CATALOG_PROCESSING_VERSION;
  const description = [
    item.name,
    ...(item.tags ?? []),
    item.visualSignature?.itemType,
    item.visualSignature?.garmentFamily,
  ].filter(Boolean).join(" ").toLocaleLowerCase();
  const isHeadband = /(?:\bhead[ -]?band\b|\bhair[ -]?band\b|\bsweat[ -]?band\b|\bsports?[ -]?band\b|\bathletic[ -]?band\b)/i.test(description);
  const isScarf = /(?:\bscarf\b|\bhead[ -]?scarf\b|\bhijab\b|\bkhimar\b|\bmuffler\b|\bpashmina\b|\bstole\b|\bneck wrap\b|\u0448\u0430\u0440\u0444|\u043f\u0430\u043b\u0430\u043d\u0442\u0438\u043d|\u043f\u043b\u0430\u0442\u043e\u043a|\bsharf\b|\bro['\u2019]?mol\b)/i.test(description);
  if (isHeadband) return HEADBAND_CATALOG_PROCESSING_VERSION;
  const isWatch = item.category === "accessories" && /(?:\bsmart[ -]?watch\b|\bwrist[ -]?watch\b|\bwatch\b|\bfitness (?:band|tracker)\b|\bactivity tracker\b|\bsmart band\b)/i.test(description);
  if (isWatch) return WATCH_CATALOG_PROCESSING_VERSION;
  const isEyewear = item.category === "accessories" && /(?:\bsun[ -]?glasses\b|\beye[ -]?glasses\b|\bglasses\b|\bspectacles?\b|\beyewear\b|\bshades\b)/i.test(description);
  if (isEyewear) return EYEWEAR_CATALOG_PROCESSING_VERSION;
  const isHoodie = /(?:\bhoodies?\b|\bhooded (?:sweatshirt|jacket|top)\b|\bzip[ -]?up hood(?:ie|ed sweatshirt)\b)/i.test(description);
  if (isHoodie) return HOODIE_CATALOG_PROCESSING_VERSION;
  return isScarf ? SCARF_CATALOG_PROCESSING_VERSION : PRODUCT_IMAGE_PROCESSING_VERSION;
}

type SourceImage = { base64: string; mimeType: string };

async function imageUriToBase64(uri: string): Promise<SourceImage | null> {
  if (uri.startsWith("data:")) {
    const match = uri.match(/^data:([^;,]+);base64,(.+)$/s);
    return match?.[2] ? { base64: match[2], mimeType: match[1] || "image/jpeg" } : null;
  }
  try {
    const response = await fetch(uri, { signal: AbortSignal.timeout(15_000) });
    if (!response.ok) return null;
    const bytes = new Uint8Array(await response.arrayBuffer());
    let binary = "";
    for (let index = 0; index < bytes.length; index += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
    }
    return {
      base64: globalThis.btoa(binary),
      mimeType: response.headers.get("content-type")?.split(";", 1)[0] || "image/jpeg",
    };
  } catch {
    return null;
  }
}

type NormalizedExistingImage = {
  uri: string;
  imageProcessingVersion: number;
  catalogGenerated: boolean;
  rateLimited: boolean;
};

async function normalizeExistingProductImage(item: ClothingItem): Promise<NormalizedExistingImage | null> {
  if (!item.imageUri) return null;
  const source = await imageUriToBase64(item.imageUri);
  if (!source) return null;
  try {
    const response = await fetch(`${API_BASE}/remove-bg`, {
      method: "POST",
      headers: await apiAuthHeaders(),
      body: JSON.stringify({
        photoBase64: source.base64,
        mimeType: source.mimeType,
        itemName: item.name,
        category: item.category,
        colorName: item.color,
        colorHex: item.colorHex,
        material: item.visualSignature?.materialFamily,
        tags: item.tags,
        brandLogo: item.brandLogo,
      }),
      signal: AbortSignal.timeout(180_000),
    });
    if (response.status === 429) {
      return { uri: item.imageUri, imageProcessingVersion: 0, catalogGenerated: false, rateLimited: true };
    }
    const data = await response.json().catch(() => ({})) as {
      image?: string;
      url?: string;
      imageProcessingVersion?: number;
      studioGenerated?: boolean;
    };
    if (!response.ok || data.studioGenerated !== true) return null;
    const normalizedUri = data.url
      ? `${API_BASE.replace(/\/api$/, "")}${data.url}`
      : data.image ? `data:image/png;base64,${data.image}` : null;
    return normalizedUri ? {
      uri: normalizedUri,
      imageProcessingVersion: Math.max(data.imageProcessingVersion ?? 0, desiredProductImageVersion(item)),
      catalogGenerated: true,
      rateLimited: false,
    } : null;
  } catch {
    return null;
  }
}

async function getStoredValue(key: string): Promise<string | null> {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    try {
      const value = window.localStorage.getItem(key);
      if (value !== null) return value;
    } catch {}
  }
  return AsyncStorage.getItem(key);
}

async function setStoredValue(key: string, value: string): Promise<void> {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    // Browser localStorage is immediate and avoids a stalled IndexedDB-backed
    // AsyncStorage call keeping the Add Item screen on "Saving" forever.
    window.localStorage.setItem(key, value);
    return;
  }
  await AsyncStorage.setItem(key, value);
}

async function removeStoredValue(key: string): Promise<void> {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    try { window.localStorage.removeItem(key); } catch {}
  }
  try { await AsyncStorage.removeItem(key); } catch {}
}

function createUuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    const value = character === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

function legacyCloudId(userId: string, legacyId: string, kind: "item" | "outfit"): string {
  const value = `${userId}:${kind}:${legacyId}`;
  const words = [0x811c9dc5, 0x9e3779b9, 0x85ebca6b, 0xc2b2ae35].map((seed) => {
    let hash = seed;
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 0x01000193);
    }
    hash ^= hash >>> 16;
    hash = Math.imul(hash, 0x85ebca6b);
    hash ^= hash >>> 13;
    return (hash ^ (hash >>> 16)) >>> 0;
  });
  const hex = words.map((word) => word.toString(16).padStart(8, "0")).join("").split("");
  hex[12] = "4";
  hex[16] = ((Number.parseInt(hex[16]!, 16) & 0x3) | 0x8).toString(16);
  const joined = hex.join("");
  return `${joined.slice(0, 8)}-${joined.slice(8, 12)}-${joined.slice(12, 16)}-${joined.slice(16, 20)}-${joined.slice(20)}`;
}

function stripImages(items: ClothingItem[]): Omit<ClothingItem, "imageUri">[] {
  return items.map(({ imageUri: _img, ...rest }) => rest);
}

function isSockLike(item: Pick<ClothingItem, "name" | "category" | "tags">): boolean {
  const text = `${item.category} ${item.name} ${(item.tags ?? []).join(" ")}`.toLowerCase();
  return /\b(sock|socks|hosiery|tights|stocking|stockings)\b/.test(text);
}

// Older AI scans classified socks as accessories. Keep their original details,
// but show and use them in the dedicated Socks category going forward.
function normalizeItemCategory(item: ClothingItem): ClothingItem {
  return item.category === "accessories" && isSockLike(item) ? { ...item, category: "socks" } : item;
}

function stripOutfitForStorage(outfit: SavedOutfit) {
  const { previewImage: _preview, items, ...rest } = outfit;
  const strippedItems = Object.fromEntries(
    Object.entries(items).map(([cat, item]) => {
      if (!item) return [cat, item];
      const { imageUri: _img, ...itemRest } = item;
      return [cat, itemRest];
    })
  ) as OutfitItems;
  return { ...rest, items: strippedItems };
}

function parseStoredArray<T>(value: string | null): T[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed as T[] : [];
  } catch {
    return [];
  }
}

type LocalWardrobe = {
  items: ClothingItem[];
  outfits: SavedOutfit[];
};

/** Claim pre-account storage once, repair legacy IDs, and keep all photos in
 * the current account-scoped keys before cloud reconciliation begins. */
async function readAndMigrateLocalWardrobe(userId: string): Promise<LocalWardrobe> {
  const [scopedItemsValue, scopedOutfitsValue, legacyItemsValue, legacyOutfitsValue, legacyOwner] = await Promise.all([
    getStoredValue(itemsKey(userId)),
    getStoredValue(outfitsKey(userId)),
    getStoredValue(LEGACY_ITEMS_KEY),
    getStoredValue(LEGACY_OUTFITS_KEY),
    getStoredValue(LEGACY_OWNER_KEY),
  ]);

  const scopedItems = parseStoredArray<ClothingItem>(scopedItemsValue);
  const scopedOutfits = parseStoredArray<SavedOutfit>(scopedOutfitsValue);
  const mayClaimLegacyStorage = !legacyOwner || legacyOwner === userId;
  const importedLegacyItems = scopedItems.length === 0
    && mayClaimLegacyStorage
    && parseStoredArray<ClothingItem>(legacyItemsValue).length > 0;
  const importedLegacyOutfits = scopedOutfits.length === 0
    && mayClaimLegacyStorage
    && parseStoredArray<SavedOutfit>(legacyOutfitsValue).length > 0;
  const rawItems = importedLegacyItems
    ? parseStoredArray<ClothingItem>(legacyItemsValue)
    : scopedItems;
  const rawOutfits = importedLegacyOutfits
    ? parseStoredArray<SavedOutfit>(legacyOutfitsValue)
    : scopedOutfits;

  const itemsWithImages = await Promise.all(rawItems.map(async (item) => {
    const primaryKey = importedLegacyItems ? legacyImageKey(item.id) : imageKey(userId, item.id);
    const fallbackKey = importedLegacyItems ? imageKey(userId, item.id) : legacyImageKey(item.id);
    const uri = await getStoredValue(primaryKey) ?? await getStoredValue(fallbackKey);
    return uri ? { ...item, imageUri: uri } : item;
  }));
  const outfitsWithPreviews = await Promise.all(rawOutfits.map(async (outfit) => {
    const primaryKey = importedLegacyOutfits ? legacyOutfitImageKey(outfit.id) : outfitImageKey(userId, outfit.id);
    const fallbackKey = importedLegacyOutfits ? outfitImageKey(userId, outfit.id) : legacyOutfitImageKey(outfit.id);
    const previewImage = await getStoredValue(primaryKey) ?? await getStoredValue(fallbackKey);
    return previewImage ? { ...outfit, previewImage } : outfit;
  }));

  const migrated = migrateWardrobeIds(
    itemsWithImages,
    outfitsWithPreviews,
    (legacyId, kind) => legacyCloudId(userId, legacyId, kind),
  );
  const needsLocalWrite = importedLegacyItems || importedLegacyOutfits || migrated.changed;
  if (!needsLocalWrite) return { items: migrated.items, outfits: migrated.outfits };

  // Write replacement image keys before publishing metadata that points at the
  // replacement IDs. Old keys are retained until every new local record exists.
  await Promise.all([
    ...migrated.items.map((item) => item.imageUri
      ? setStoredValue(imageKey(userId, item.id), item.imageUri)
      : Promise.resolve()),
    ...migrated.outfits.map((outfit) => outfit.previewImage
      ? setStoredValue(outfitImageKey(userId, outfit.id), outfit.previewImage)
      : Promise.resolve()),
  ]);
  await setStoredValue(itemsKey(userId), JSON.stringify(stripImages(migrated.items)));
  await setStoredValue(outfitsKey(userId), JSON.stringify(migrated.outfits.map(stripOutfitForStorage)));
  if (importedLegacyItems || importedLegacyOutfits) {
    await setStoredValue(LEGACY_OWNER_KEY, userId);
  }

  return { items: migrated.items, outfits: migrated.outfits };
}

/**
 * Evicts regeneratable large blobs (outfit preview images) to reclaim quota.
 * Returns true if any space was freed.
 */
async function freeStorageSpace(userId: string, outfitIds: string[]): Promise<boolean> {
  let freed = false;
  for (const id of outfitIds) {
    try {
      const key = outfitImageKey(userId, id);
      const val = await AsyncStorage.getItem(key);
      if (val) {
        await AsyncStorage.removeItem(key);
        freed = true;
      }
    } catch {}
  }
  // Also clear any stale old profile key
  try {
    await AsyncStorage.removeItem("@lookly_user_profile");
    freed = true;
  } catch {}
  return freed;
}

export function WardrobeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [items, setItems] = useState<ClothingItem[]>([]);
  const [savedOutfits, setSavedOutfits] = useState<SavedOutfit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const normalizationRunUserRef = useRef<string | null>(null);

  const itemsRef = useRef<ClothingItem[]>([]);
  useEffect(() => { itemsRef.current = items; }, [items]);

  const outfitsRef = useRef<SavedOutfit[]>([]);
  useEffect(() => { outfitsRef.current = savedOutfits; }, [savedOutfits]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setItems([]);
      itemsRef.current = [];
      setSavedOutfits([]);
      outfitsRef.current = [];
      if (!user) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const [localWardrobe, serverItems, serverOutfits] = await Promise.all([
          readAndMigrateLocalWardrobe(user.id),
          fetchServerItems(),
          fetchServerOutfits(),
        ]);
        if (cancelled) return;

        const localItems = localWardrobe.items.map(normalizeItemCategory);
        let merged: ClothingItem[] = [...localItems];

        // Merge server items. A fresh signed Storage URL from Supabase must
        // replace the cached one, because private URLs expire by design.
        if (serverItems.length > 0) {
          for (const serverItem of serverItems) {
            const existingIndex = merged.findIndex((localItem) => localItem.id === serverItem.id);
            if (existingIndex === -1) {
              merged.push(normalizeItemCategory(serverItem));
            } else if (serverItem.imageUri) {
              const localItem = normalizeItemCategory(merged[existingIndex]!);
              merged[existingIndex] = {
                ...localItem,
                imageUri: serverItem.imageUri,
                imageProcessingVersion: Math.max(
                  localItem.imageProcessingVersion ?? 0,
                  serverItem.imageProcessingVersion ?? 0,
                ),
              };
            }
          }
        }

        setItems(merged);
        itemsRef.current = merged;

        const mergedOutfits = [...localWardrobe.outfits];
        if (serverOutfits.length > 0) {
          for (const serverOutfit of serverOutfits) {
            if (!mergedOutfits.some((localOutfit) => localOutfit.id === serverOutfit.id)) {
              mergedOutfits.push(serverOutfit);
            }
          }
        }
        setSavedOutfits(mergedOutfits);
        outfitsRef.current = mergedOutfits;

        // A failed first upload used to remain local forever. Retry only local
        // records absent from the account, plus records whose photo/preview is
        // still missing. Waiting for each image keeps the recovery reliable
        // without delaying the wardrobe screen itself.
        const serverItemsById = new Map(serverItems.map((item) => [item.id, item]));
        const itemsNeedingCloudRecovery = localItems.filter((item) => {
          const serverItem = serverItemsById.get(item.id);
          return !serverItem || (!!item.imageUri && !serverItem.imageUri);
        });
        const serverOutfitsById = new Map(serverOutfits.map((outfit) => [outfit.id, outfit]));
        const outfitsNeedingCloudRecovery = localWardrobe.outfits.filter((outfit) => {
          const serverOutfit = serverOutfitsById.get(outfit.id);
          return !serverOutfit || (!!outfit.previewImage && !serverOutfit.previewImage);
        });
        void (async () => {
          for (const item of itemsNeedingCloudRecovery) {
            if (cancelled) return;
            await syncItemToServer(item, { waitForImage: true });
          }
          for (const outfit of outfitsNeedingCloudRecovery) {
            if (cancelled) return;
            await syncSavedOutfit(outfit);
          }
        })();
      } catch (error) {
        console.warn("Could not restore the local wardrobe", error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  /**
   * Saves items to AsyncStorage. If quota is exceeded, evicts outfit preview
   * images (which are large but regeneratable) and retries once. If it still
   * fails, alerts the user so data loss is never silent.
   */
  const persistItems = useCallback(async (next: ClothingItem[]) => {
    if (!user) return;
    const payload = JSON.stringify(stripImages(next));
    try {
      await setStoredValue(itemsKey(user.id), payload);
    } catch {
      // Storage full — try freeing space by evicting outfit preview images
      const currentOutfitIds = outfitsRef.current.map((o) => o.id);
      const freed = await freeStorageSpace(user.id, currentOutfitIds);
      if (freed) {
        try {
          await setStoredValue(itemsKey(user.id), payload);
          return; // Succeeded after freeing space
        } catch {}
      }
      // Truly out of space — warn the user so they know
      Alert.alert(
        "Storage full",
        "Your wardrobe couldn't be saved to disk — your device storage is full. Please free up some space and re-add your items.",
        [{ text: "OK" }]
      );
    }
  }, [user]);

  const persistImage = useCallback(async (id: string, uri: string | undefined) => {
    if (!user) return;
    try {
      if (uri) {
        await setStoredValue(imageKey(user.id, id), uri);
      } else {
        await removeStoredValue(imageKey(user.id, id));
      }
    } catch {
      // Image URI too large — item will show colour swatch instead
    }
  }, [user]);

  const persistOutfits = useCallback(async (next: SavedOutfit[]) => {
    if (!user) return;
    try {
      await AsyncStorage.setItem(outfitsKey(user.id), JSON.stringify(next.map(stripOutfitForStorage)));
      await Promise.all(
        next.map(async (outfit) => {
          try {
            if (outfit.previewImage) {
              await AsyncStorage.setItem(outfitImageKey(user.id, outfit.id), outfit.previewImage);
            } else {
              await AsyncStorage.removeItem(outfitImageKey(user.id, outfit.id));
            }
          } catch {
            // Preview image too large — will regenerate on next open
          }
        })
      );
    } catch {
      // Outfit metadata save failed — non-fatal, outfits stay in memory
    }
  }, [user]);

  const addItem = useCallback(
    async (item: Omit<ClothingItem, "id" | "createdAt" | "timesWorn">) => {
      if (itemsRef.current.length >= MAX_WARDROBE_ITEMS) {
        Alert.alert(
          "Wardrobe limit reached",
          `Your pilot wardrobe can contain up to ${MAX_WARDROBE_ITEMS} items. Delete an item before adding another one.`,
        );
        return undefined;
      }
      const newItem: ClothingItem = {
        ...item,
        id: createUuid(),
        timesWorn: 0,
        createdAt: new Date().toISOString(),
      };
      const next = [newItem, ...itemsRef.current];
      itemsRef.current = next;
      setItems(next);
      await persistItems(next);
      if (newItem.imageUri) {
        await persistImage(newItem.id, newItem.imageUri);
      }
      // The cloud record is lightweight and must finish before we report a
      // successful save. Its image upload continues in the background.
      await syncItemToServer(newItem);
      return newItem;
    },
    [persistItems, persistImage]
  );

  const addBulkItems = useCallback(
    async (newItems: Omit<ClothingItem, "id" | "createdAt" | "timesWorn">[]) => {
      const available = MAX_WARDROBE_ITEMS - itemsRef.current.length;
      if (available <= 0) {
        Alert.alert(
          "Wardrobe limit reached",
          `Your pilot wardrobe can contain up to ${MAX_WARDROBE_ITEMS} items. Delete an item before adding another one.`,
        );
        return [];
      }
      if (newItems.length > available) {
        Alert.alert(
          "Too many items selected",
          `You can add ${available} more item${available === 1 ? "" : "s"} to this wardrobe.`,
        );
        return [];
      }
      const built: ClothingItem[] = newItems.map((item) => ({
        ...item,
        id: createUuid(),
        timesWorn: 0,
        createdAt: new Date().toISOString(),
      }));
      const next = [...built, ...itemsRef.current];
      itemsRef.current = next;
      setItems(next);
      await persistItems(next);
      await Promise.all(
        built.map((item) =>
          item.imageUri ? persistImage(item.id, item.imageUri) : Promise.resolve()
        )
      );
      // Persist each lightweight record first; image uploads continue in the
      // background so adding several items stays responsive and durable.
      await Promise.all(built.map((item) => syncItemToServer(item)));
      return built;
    },
    [persistItems, persistImage]
  );

  const removeItem = useCallback(
    async (id: string) => {
      const next = itemsRef.current.filter((i) => i.id !== id);
      itemsRef.current = next;
      setItems(next);
      await persistItems(next);
      await persistImage(id, undefined);
      deleteItemOnServer(id);
    },
    [persistItems, persistImage]
  );

  const updateItem = useCallback(
    async (id: string, updates: Partial<ClothingItem>) => {
      const next = itemsRef.current.map((i) => (i.id === id ? { ...i, ...updates } : i));
      itemsRef.current = next;
      setItems(next);
      await persistItems(next);
      if (updates.imageUri !== undefined) {
        await persistImage(id, updates.imageUri);
      }
      const updated = next.find((i) => i.id === id);
      if (updated) syncItemToServer(updated);
    },
    [persistItems, persistImage]
  );

  // Upgrade source-photo fallbacks with the same garment-specific studio
  // extraction used for newly scanned items. Failed images retain their
  // current art and are retried next time this account starts a fresh session.
  useEffect(() => {
    if (!user || isLoading || normalizationRunUserRef.current === user.id) return;
    normalizationRunUserRef.current = user.id;
    let cancelled = false;

    void (async () => {
      const candidates = itemsRef.current.filter(
        (item) => item.imageUri && (item.imageProcessingVersion ?? 0) < desiredProductImageVersion(item),
      );
      for (const candidate of candidates) {
        if (cancelled || !candidate.imageUri) break;
        const normalized = await normalizeExistingProductImage(candidate);
        if (cancelled) break;
        if (normalized?.rateLimited) break;
        if (!normalized?.catalogGenerated) continue;

        const locallyNormalized: ClothingItem = {
          ...candidate,
          imageUri: normalized.uri,
          // Keep this retryable until private cloud storage confirms the new file.
          imageProcessingVersion: 0,
        };
        let next = itemsRef.current.map((item) => item.id === candidate.id ? locallyNormalized : item);
        itemsRef.current = next;
        setItems(next);
        await persistImage(candidate.id, normalized.uri);
        await persistItems(next);

        const published = await replaceItemImageOnServer({
          ...locallyNormalized,
          imageProcessingVersion: normalized.imageProcessingVersion,
        });
        if (!published || cancelled) continue;
        next = itemsRef.current.map((item) => item.id === candidate.id
          ? { ...item, imageProcessingVersion: normalized.imageProcessingVersion }
          : item);
        itemsRef.current = next;
        setItems(next);
        await persistItems(next);
      }
    })();

    return () => { cancelled = true; };
  }, [isLoading, persistImage, persistItems, user?.id]);

  const markWorn = useCallback(
    async (ids: string[]) => {
      const idSet = new Set(ids);
      const next = itemsRef.current.map((i) =>
        idSet.has(i.id) ? { ...i, timesWorn: (i.timesWorn ?? 0) + 1 } : i
      );
      itemsRef.current = next;
      setItems(next);
      await persistItems(next);
      next.filter((i) => idSet.has(i.id)).forEach((i) => syncItemToServer(i));
    },
    [persistItems]
  );

  const getItemsByCategory = useCallback(
    (category: ClothingCategory) => itemsRef.current.filter((i) => i.category === category),
    []
  );

  const getItemsBySeason = useCallback(
    (season: Season) => itemsRef.current.filter((i) => i.seasons.includes(season)),
    []
  );

  const getCasualItems = useCallback(
    () => itemsRef.current.filter((i) => !i.isWorkwear),
    []
  );

  const getWorkItems = useCallback(
    () => itemsRef.current.filter((i) => i.isWorkwear),
    []
  );

  const saveOutfit = useCallback(
    async (
      name: string,
      outfitItems: OutfitItems,
      previewImage?: string
    ) => {
      if (outfitsRef.current.length >= MAX_SAVED_OUTFITS) {
        Alert.alert(
          "Saved looks limit reached",
          `Your pilot account can save up to ${MAX_SAVED_OUTFITS} looks. Delete a saved look before creating another one.`,
        );
        return;
      }
      const newOutfit: SavedOutfit = {
        id: createUuid(),
        name,
        items: outfitItems,
        previewImage,
        createdAt: new Date().toISOString(),
      };
      const next = [newOutfit, ...outfitsRef.current];
      outfitsRef.current = next;
      setSavedOutfits(next);
      await persistOutfits(next);
      void syncSavedOutfit(newOutfit);
    },
    [persistOutfits]
  );

  const deleteSavedOutfit = useCallback(
    async (id: string) => {
      const next = outfitsRef.current.filter((o) => o.id !== id);
      outfitsRef.current = next;
      setSavedOutfits(next);
      await persistOutfits(next);
      try {
        if (user) await AsyncStorage.removeItem(outfitImageKey(user.id, id));
      } catch {}
      void deleteSavedOutfitOnServer(id);
    },
    [persistOutfits, user]
  );

  return (
    <WardrobeContext.Provider
      value={{
        items,
        addItem,
        addBulkItems,
        removeItem,
        updateItem,
        markWorn,
        getItemsByCategory,
        getItemsBySeason,
        getCasualItems,
        getWorkItems,
        savedOutfits,
        saveOutfit,
        deleteSavedOutfit,
        isLoading,
      }}
    >
      {children}
    </WardrobeContext.Provider>
  );
}

export function useWardrobe() {
  const ctx = useContext(WardrobeContext);
  if (!ctx) throw new Error("useWardrobe must be used inside WardrobeProvider");
  return ctx;
}
