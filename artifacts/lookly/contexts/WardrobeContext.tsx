import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

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

// Strip both previewImage and any imageUri from embedded items before persisting
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

export function WardrobeProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ClothingItem[]>([]);
  const [savedOutfits, setSavedOutfits] = useState<SavedOutfit[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const itemsRef = useRef<ClothingItem[]>([]);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const outfitsRef = useRef<SavedOutfit[]>([]);
  useEffect(() => {
    outfitsRef.current = savedOutfits;
  }, [savedOutfits]);

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
          // Re-hydrate preview images stored separately
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

  const persistItems = useCallback(async (next: ClothingItem[]) => {
    try {
      await AsyncStorage.setItem(ITEMS_KEY, JSON.stringify(stripImages(next)));
    } catch {
      // Storage full — items remain in memory for this session
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
      // Image too large to cache — non-fatal, will show placeholder
    }
  }, []);

  const persistOutfits = useCallback(async (next: SavedOutfit[]) => {
    try {
      // Store outfit metadata without images (keeps the JSON small)
      await AsyncStorage.setItem(OUTFITS_KEY, JSON.stringify(next.map(stripOutfitForStorage)));
      // Save each outfit's preview image under its own key
      await Promise.all(
        next.map(async (outfit) => {
          try {
            if (outfit.previewImage) {
              await AsyncStorage.setItem(outfitImageKey(outfit.id), outfit.previewImage);
            } else {
              await AsyncStorage.removeItem(outfitImageKey(outfit.id));
            }
          } catch {
            // Preview image too large — will be missing after reload but non-fatal
          }
        })
      );
    } catch {
      // Storage full — outfits remain in memory for this session
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
      // Clean up the separately-stored preview image
      try {
        await AsyncStorage.removeItem(outfitImageKey(id));
      } catch {
        // Non-fatal
      }
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
