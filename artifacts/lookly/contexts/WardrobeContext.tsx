import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Alert } from "react-native";

export type ClothingCategory =
  | "tops"
  | "bottoms"
  | "dresses"
  | "outerwear"
  | "shoes"
  | "accessories";

export type Season = "spring" | "summer" | "fall" | "winter";
export type FabricWeight = "light" | "medium" | "heavy";

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

const ITEMS_KEY = "@lookly_wardrobe_v2";
const OUTFITS_KEY = "@lookly_saved_outfits";
const imageKey = (id: string) => `@lookly_img_${id}`;
const outfitImageKey = (id: string) => `@lookly_outfit_img_${id}`;

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
async function freeStorageSpace(outfitIds: string[]): Promise<boolean> {
  let freed = false;
  for (const id of outfitIds) {
    try {
      const key = outfitImageKey(id);
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
  const [items, setItems] = useState<ClothingItem[]>([]);
  const [savedOutfits, setSavedOutfits] = useState<SavedOutfit[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const itemsRef = useRef<ClothingItem[]>([]);
  useEffect(() => { itemsRef.current = items; }, [items]);

  const outfitsRef = useRef<SavedOutfit[]>([]);
  useEffect(() => { outfitsRef.current = savedOutfits; }, [savedOutfits]);

  useEffect(() => {
    (async () => {
      try {
        const [storedItems, storedOutfits] = await Promise.all([
          AsyncStorage.getItem(ITEMS_KEY),
          AsyncStorage.getItem(OUTFITS_KEY),
        ]);

        if (storedItems) {
          const parsed: ClothingItem[] = JSON.parse(storedItems);
          const withImages = await Promise.all(
            parsed.map(async (item) => {
              const uri = await AsyncStorage.getItem(imageKey(item.id));
              return uri ? { ...item, imageUri: uri } : item;
            })
          );
          setItems(withImages);
          itemsRef.current = withImages;
        }

        if (storedOutfits) {
          const parsed = JSON.parse(storedOutfits) as SavedOutfit[];
          const withPreviews = await Promise.all(
            parsed.map(async (outfit) => {
              const preview = await AsyncStorage.getItem(outfitImageKey(outfit.id));
              return preview ? { ...outfit, previewImage: preview } : outfit;
            })
          );
          setSavedOutfits(withPreviews);
          outfitsRef.current = withPreviews;
        }
      } catch {
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  /**
   * Saves items to AsyncStorage. If quota is exceeded, evicts outfit preview
   * images (which are large but regeneratable) and retries once. If it still
   * fails, alerts the user so data loss is never silent.
   */
  const persistItems = useCallback(async (next: ClothingItem[]) => {
    const payload = JSON.stringify(stripImages(next));
    try {
      await AsyncStorage.setItem(ITEMS_KEY, payload);
    } catch {
      // Storage full — try freeing space by evicting outfit preview images
      const currentOutfitIds = outfitsRef.current.map((o) => o.id);
      const freed = await freeStorageSpace(currentOutfitIds);
      if (freed) {
        try {
          await AsyncStorage.setItem(ITEMS_KEY, payload);
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
  }, []);

  const persistImage = useCallback(async (id: string, uri: string | undefined) => {
    try {
      if (uri) {
        await AsyncStorage.setItem(imageKey(id), uri);
      } else {
        await AsyncStorage.removeItem(imageKey(id));
      }
    } catch {
      // Image URI too large — item will show colour swatch instead
    }
  }, []);

  const persistOutfits = useCallback(async (next: SavedOutfit[]) => {
    try {
      await AsyncStorage.setItem(OUTFITS_KEY, JSON.stringify(next.map(stripOutfitForStorage)));
      await Promise.all(
        next.map(async (outfit) => {
          try {
            if (outfit.previewImage) {
              await AsyncStorage.setItem(outfitImageKey(outfit.id), outfit.previewImage);
            } else {
              await AsyncStorage.removeItem(outfitImageKey(outfit.id));
            }
          } catch {
            // Preview image too large — will regenerate on next open
          }
        })
      );
    } catch {
      // Outfit metadata save failed — non-fatal, outfits stay in memory
    }
  }, []);

  const addItem = useCallback(
    async (item: Omit<ClothingItem, "id" | "createdAt" | "timesWorn">) => {
      const newItem: ClothingItem = {
        ...item,
        id: Date.now().toString() + Math.random().toString(36).slice(2, 7),
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
    },
    [persistItems, persistImage]
  );

  const addBulkItems = useCallback(
    async (newItems: Omit<ClothingItem, "id" | "createdAt" | "timesWorn">[]) => {
      const now = Date.now();
      const built: ClothingItem[] = newItems.map((item, i) => ({
        ...item,
        id: (now + i).toString() + Math.random().toString(36).slice(2, 7),
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
      const newOutfit: SavedOutfit = {
        id: Date.now().toString() + Math.random().toString(36).slice(2, 7),
        name,
        items: outfitItems,
        previewImage,
        createdAt: new Date().toISOString(),
      };
      const next = [newOutfit, ...outfitsRef.current];
      outfitsRef.current = next;
      setSavedOutfits(next);
      await persistOutfits(next);
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
        await AsyncStorage.removeItem(outfitImageKey(id));
      } catch {}
    },
    [persistOutfits]
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
