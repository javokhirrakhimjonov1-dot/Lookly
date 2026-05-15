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

export interface ClothingItem {
  id: string;
  name: string;
  category: ClothingCategory;
  color: string;
  colorHex: string;
  seasons: Season[];
  imageUri?: string;
  tags: string[];
  createdAt: string;
}

interface WardrobeContextValue {
  items: ClothingItem[];
  addItem: (item: Omit<ClothingItem, "id" | "createdAt">) => Promise<void>;
  removeItem: (id: string) => Promise<void>;
  updateItem: (id: string, updates: Partial<ClothingItem>) => Promise<void>;
  getItemsByCategory: (category: ClothingCategory) => ClothingItem[];
  getItemsBySeason: (season: Season) => ClothingItem[];
  isLoading: boolean;
}

const WardrobeContext = createContext<WardrobeContextValue | null>(null);

const STORAGE_KEY = "@lookly_wardrobe";

export function WardrobeProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ClothingItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) setItems(JSON.parse(stored));
      } catch {
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const persist = useCallback(async (next: ClothingItem[]) => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  const addItem = useCallback(
    async (item: Omit<ClothingItem, "id" | "createdAt">) => {
      const newItem: ClothingItem = {
        ...item,
        id: Date.now().toString() + Math.random().toString(36).slice(2, 7),
        createdAt: new Date().toISOString(),
      };
      const next = [newItem, ...items];
      setItems(next);
      await persist(next);
    },
    [items, persist]
  );

  const removeItem = useCallback(
    async (id: string) => {
      const next = items.filter((i) => i.id !== id);
      setItems(next);
      await persist(next);
    },
    [items, persist]
  );

  const updateItem = useCallback(
    async (id: string, updates: Partial<ClothingItem>) => {
      const next = items.map((i) => (i.id === id ? { ...i, ...updates } : i));
      setItems(next);
      await persist(next);
    },
    [items, persist]
  );

  const getItemsByCategory = useCallback(
    (category: ClothingCategory) => items.filter((i) => i.category === category),
    [items]
  );

  const getItemsBySeason = useCallback(
    (season: Season) => items.filter((i) => i.seasons.includes(season)),
    [items]
  );

  return (
    <WardrobeContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        updateItem,
        getItemsByCategory,
        getItemsBySeason,
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
