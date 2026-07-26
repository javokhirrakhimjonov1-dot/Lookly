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
} from "./serverSync";
import { useAuth } from "./AuthContext";

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

export interface ClothingItem {
  id: string;
  name: string;
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
  tags: string[];
  brandLogo?: BrandLogo;
  createdAt: string;
}

export interface SavedOutfit {
  id: string;
  name: string;
  items: Partial<Record<ClothingCategory, ClothingItem>>;
  previewImage?: string;
  createdAt: string;
}

interface WardrobeContextValue {
  items: ClothingItem[];
  addItem: (item: Omit<ClothingItem, "id" | "createdAt" | "timesWorn">) => Promise<void>;
  addBulkItems: (items: Omit<ClothingItem, "id" | "createdAt" | "timesWorn">[]) => Promise<void>;
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
    items: Partial<Record<ClothingCategory, ClothingItem>>,
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
// Pilot safeguards. These are high enough for real testing while keeping the
// first ten accounts within Supabase Storage and device-storage limits.
const MAX_WARDROBE_ITEMS = 150;
const MAX_SAVED_OUTFITS = 50;

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

function stripImages(items: ClothingItem[]): Omit<ClothingItem, "imageUri">[] {
  return items.map(({ imageUri: _img, ...rest }) => rest);
}

function stripOutfitForStorage(outfit: SavedOutfit) {
  const { previewImage: _preview, items, ...rest } = outfit;
  const strippedItems = Object.fromEntries(
    Object.entries(items).map(([cat, item]) => {
      if (!item) return [cat, item];
      const { imageUri: _img, ...itemRest } = item;
      return [cat, itemRest];
    })
  ) as Partial<Record<ClothingCategory, ClothingItem>>;
  return { ...rest, items: strippedItems };
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

  const itemsRef = useRef<ClothingItem[]>([]);
  useEffect(() => { itemsRef.current = items; }, [items]);

  const outfitsRef = useRef<SavedOutfit[]>([]);
  useEffect(() => { outfitsRef.current = savedOutfits; }, [savedOutfits]);

  useEffect(() => {
    (async () => {
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
        const [storedItems, storedOutfits, serverItems, serverOutfits] = await Promise.all([
          getStoredValue(itemsKey(user.id)),
          getStoredValue(outfitsKey(user.id)),
          fetchServerItems(),
          fetchServerOutfits(),
        ]);

        let merged: ClothingItem[] = [];

        if (storedItems) {
          const parsed: ClothingItem[] = JSON.parse(storedItems);
          const withImages = await Promise.all(
            parsed.map(async (item) => {
              const uri = await getStoredValue(imageKey(user.id, item.id));
              return uri ? { ...item, imageUri: uri } : item;
            })
          );
          merged = withImages;
        }

        // Merge server items. A fresh signed Storage URL from Supabase must
        // replace the cached one, because private URLs expire by design.
        if (serverItems.length > 0) {
          for (const serverItem of serverItems) {
            const existingIndex = merged.findIndex((localItem) => localItem.id === serverItem.id);
            if (existingIndex === -1) {
              merged.push(serverItem);
            } else if (serverItem.imageUri) {
              merged[existingIndex] = { ...merged[existingIndex]!, imageUri: serverItem.imageUri };
            }
          }
        }

        if (merged.length > 0) {
          setItems(merged);
          itemsRef.current = merged;
        }

        if (storedOutfits) {
          const parsed = JSON.parse(storedOutfits) as SavedOutfit[];
          const withPreviews = await Promise.all(
            parsed.map(async (outfit) => {
              const preview = await AsyncStorage.getItem(outfitImageKey(user.id, outfit.id));
              return preview ? { ...outfit, previewImage: preview } : outfit;
            })
          );
          setSavedOutfits(withPreviews);
          outfitsRef.current = withPreviews;
        }

        if (serverOutfits.length > 0) {
          const mergedOutfits = [...outfitsRef.current];
          for (const serverOutfit of serverOutfits) {
            if (!mergedOutfits.some((localOutfit) => localOutfit.id === serverOutfit.id)) {
              mergedOutfits.push(serverOutfit);
            }
          }
          setSavedOutfits(mergedOutfits);
          outfitsRef.current = mergedOutfits;
        }
      } catch {
      } finally {
        setIsLoading(false);
      }
    })();
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
        return;
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
      syncItemToServer(newItem);
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
        return;
      }
      if (newItems.length > available) {
        Alert.alert(
          "Too many items selected",
          `You can add ${available} more item${available === 1 ? "" : "s"} to this wardrobe.`,
        );
        return;
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
      built.forEach((item) => syncItemToServer(item));
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
      outfitItems: Partial<Record<ClothingCategory, ClothingItem>>,
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
