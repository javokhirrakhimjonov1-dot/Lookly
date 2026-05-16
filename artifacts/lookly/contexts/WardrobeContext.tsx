import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
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

const ITEMS_KEY = "@lookly_wardrobe";
const OUTFITS_KEY = "@lookly_saved_outfits";

export function WardrobeProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ClothingItem[]>([]);
  const [savedOutfits, setSavedOutfits] = useState<SavedOutfit[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [storedItems, storedOutfits] = await Promise.all([
          AsyncStorage.getItem(ITEMS_KEY),
          AsyncStorage.getItem(OUTFITS_KEY),
        ]);
        if (storedItems) setItems(JSON.parse(storedItems));
        if (storedOutfits) setSavedOutfits(JSON.parse(storedOutfits));
      } catch {
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const persistItems = useCallback(async (next: ClothingItem[]) => {
    await AsyncStorage.setItem(ITEMS_KEY, JSON.stringify(next));
  }, []);

  const persistOutfits = useCallback(async (next: SavedOutfit[]) => {
    await AsyncStorage.setItem(OUTFITS_KEY, JSON.stringify(next));
  }, []);

  const addItem = useCallback(
    async (item: Omit<ClothingItem, "id" | "createdAt" | "timesWorn">) => {
      const newItem: ClothingItem = {
        ...item,
        id: Date.now().toString() + Math.random().toString(36).slice(2, 7),
        timesWorn: 0,
        createdAt: new Date().toISOString(),
      };
      setItems((prev) => {
        const next = [newItem, ...prev];
        persistItems(next);
        return next;
      });
    },
    [persistItems]
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
      setItems((prev) => {
        const next = [...built, ...prev];
        persistItems(next);
        return next;
      });
    },
    [persistItems]
  );

  const removeItem = useCallback(
    async (id: string) => {
      const next = items.filter((i) => i.id !== id);
      setItems(next);
      await persistItems(next);
    },
    [items, persistItems]
  );

  const updateItem = useCallback(
    async (id: string, updates: Partial<ClothingItem>) => {
      const next = items.map((i) => (i.id === id ? { ...i, ...updates } : i));
      setItems(next);
      await persistItems(next);
    },
    [items, persistItems]
  );

  const markWorn = useCallback(
    async (ids: string[]) => {
      const idSet = new Set(ids);
      const next = items.map((i) =>
        idSet.has(i.id) ? { ...i, timesWorn: (i.timesWorn ?? 0) + 1 } : i
      );
      setItems(next);
      await persistItems(next);
    },
    [items, persistItems]
  );

  const getItemsByCategory = useCallback(
    (category: ClothingCategory) => items.filter((i) => i.category === category),
    [items]
  );

  const getItemsBySeason = useCallback(
    (season: Season) => items.filter((i) => i.seasons.includes(season)),
    [items]
  );

  const getCasualItems = useCallback(
    () => items.filter((i) => !i.isWorkwear),
    [items]
  );

  const getWorkItems = useCallback(
    () => items.filter((i) => i.isWorkwear),
    [items]
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
      const next = [newOutfit, ...savedOutfits];
      setSavedOutfits(next);
      await persistOutfits(next);
    },
    [savedOutfits, persistOutfits]
  );

  const deleteSavedOutfit = useCallback(
    async (id: string) => {
      const next = savedOutfits.filter((o) => o.id !== id);
      setSavedOutfits(next);
      await persistOutfits(next);
    },
    [savedOutfits, persistOutfits]
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
