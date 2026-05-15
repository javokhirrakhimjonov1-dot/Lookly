import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

export interface Look {
  id: string;
  userId: string;
  userName: string;
  userHandle: string;
  caption: string;
  imageUri?: string;
  likes: number;
  isLiked: boolean;
  comments: number;
  timestamp: string;
  weather?: string;
  temperature?: number;
  tags: string[];
  isOwn?: boolean;
}

const SEED_LOOKS: Look[] = [
  {
    id: "seed_1",
    userId: "u1",
    userName: "Dilnoza M.",
    userHandle: "dilnoza.style",
    caption: "Perfect spring vibes today in Tashkent ✨",
    likes: 48,
    isLiked: false,
    comments: 7,
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    weather: "Sunny",
    temperature: 24,
    tags: ["spring", "casual", "ootd"],
  },
  {
    id: "seed_2",
    userId: "u2",
    userName: "Kamola B.",
    userHandle: "kamola.looks",
    caption: "Business meeting ready 💼",
    likes: 32,
    isLiked: false,
    comments: 4,
    timestamp: new Date(Date.now() - 7200000).toISOString(),
    weather: "Cloudy",
    temperature: 19,
    tags: ["business", "chic", "formal"],
  },
  {
    id: "seed_3",
    userId: "u3",
    userName: "Malika T.",
    userHandle: "malikafashion",
    caption: "Weekend market run 🌿",
    likes: 61,
    isLiked: true,
    comments: 11,
    timestamp: new Date(Date.now() - 14400000).toISOString(),
    weather: "Sunny",
    temperature: 28,
    tags: ["weekend", "casual", "market"],
  },
  {
    id: "seed_4",
    userId: "u4",
    userName: "Zulfiya R.",
    userHandle: "zulfiya_ootd",
    caption: "Rainy day cozy fit 🌧️",
    likes: 27,
    isLiked: false,
    comments: 3,
    timestamp: new Date(Date.now() - 28800000).toISOString(),
    weather: "Rainy",
    temperature: 15,
    tags: ["rainy", "cozy", "layers"],
  },
];

interface SocialContextValue {
  looks: Look[];
  addLook: (look: Omit<Look, "id" | "timestamp" | "likes" | "comments" | "isLiked">) => Promise<void>;
  toggleLike: (id: string) => Promise<void>;
  removeLook: (id: string) => Promise<void>;
  isLoading: boolean;
}

const SocialContext = createContext<SocialContextValue | null>(null);
const STORAGE_KEY = "@lookly_looks";

export function SocialProvider({ children }: { children: React.ReactNode }) {
  const [looks, setLooks] = useState<Look[]>(SEED_LOOKS);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed: Look[] = JSON.parse(stored);
          setLooks([...parsed, ...SEED_LOOKS.filter(s => !parsed.find(p => p.id === s.id))]);
        }
      } catch {
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const persist = useCallback(async (next: Look[]) => {
    const ownLooks = next.filter(l => l.isOwn);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(ownLooks));
  }, []);

  const addLook = useCallback(
    async (look: Omit<Look, "id" | "timestamp" | "likes" | "comments" | "isLiked">) => {
      const newLook: Look = {
        ...look,
        id: Date.now().toString() + Math.random().toString(36).slice(2, 7),
        timestamp: new Date().toISOString(),
        likes: 0,
        isLiked: false,
        comments: 0,
        isOwn: true,
      };
      const next = [newLook, ...looks];
      setLooks(next);
      await persist(next);
    },
    [looks, persist]
  );

  const toggleLike = useCallback(
    async (id: string) => {
      const next = looks.map((l) =>
        l.id === id
          ? { ...l, isLiked: !l.isLiked, likes: l.isLiked ? l.likes - 1 : l.likes + 1 }
          : l
      );
      setLooks(next);
      await persist(next);
    },
    [looks, persist]
  );

  const removeLook = useCallback(
    async (id: string) => {
      const next = looks.filter((l) => l.id !== id);
      setLooks(next);
      await persist(next);
    },
    [looks, persist]
  );

  return (
    <SocialContext.Provider value={{ looks, addLook, toggleLike, removeLook, isLoading }}>
      {children}
    </SocialContext.Provider>
  );
}

export function useSocial() {
  const ctx = useContext(SocialContext);
  if (!ctx) throw new Error("useSocial must be inside SocialProvider");
  return ctx;
}
