import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { type ClothingCategory, type ClothingItem } from "./WardrobeContext";
import { useAuth } from "./AuthContext";
import { supabase } from "@/lib/supabase";

const calendarKey = (userId: string) => `@lookly_calendar_v2_${userId}`;

export interface OutfitLog {
  id: string;
  date: string;
  items: Partial<Record<ClothingCategory, ClothingItem>>;
  note?: string;
  previewImage?: string;
  temperature?: number;
  weather?: string;
}

interface CalendarContextValue {
  logs: OutfitLog[];
  logOutfit: (
    date: string,
    items: Partial<Record<ClothingCategory, ClothingItem>>,
    opts?: { note?: string; previewImage?: string; temperature?: number; weather?: string }
  ) => Promise<void>;
  removeLog: (id: string) => Promise<void>;
  getLogForDate: (date: string) => OutfitLog | undefined;
  getLogsForMonth: (year: number, month: number) => OutfitLog[];
  isLoading: boolean;
}

const CalendarContext = createContext<CalendarContextValue | null>(null);

function createUuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const value = Math.floor(Math.random() * 16);
    return (char === "x" ? value : (value & 0x3) | 0x8).toString(16);
  });
}

function stripItemImages(items: OutfitLog["items"]): OutfitLog["items"] {
  return Object.fromEntries(Object.entries(items).map(([category, item]) => {
    if (!item) return [category, item];
    const { imageUri: _image, ...rest } = item;
    return [category, rest];
  })) as OutfitLog["items"];
}

export function CalendarProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [logs, setLogs] = useState<OutfitLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLogs([]);
      if (!user) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      try {
        const raw = await AsyncStorage.getItem(calendarKey(user.id));
        const local = raw ? JSON.parse(raw) as OutfitLog[] : [];
        const { data } = await supabase
          ?.from("outfit_calendar_logs")
          .select("id, log_date, items, note, temperature, weather")
          .order("log_date", { ascending: false }) ?? { data: null };
        const cloud: OutfitLog[] = (data ?? []).map((entry: {
          id: string; log_date: string; items: OutfitLog["items"]; note: string | null;
          temperature: number | null; weather: string | null;
        }) => ({
          id: entry.id,
          date: entry.log_date,
          items: entry.items ?? {},
          note: entry.note ?? undefined,
          temperature: entry.temperature ?? undefined,
          weather: entry.weather ?? undefined,
        }));
        const merged = [...local];
        for (const entry of cloud) {
          const existingIndex = merged.findIndex((localEntry) => localEntry.date === entry.date);
          if (existingIndex === -1) merged.push(entry);
          else merged[existingIndex] = { ...entry, previewImage: merged[existingIndex]!.previewImage };
        }
        setLogs(merged);
      } catch {}
      finally { setIsLoading(false); }
    })();
  }, [user?.id]);

  const persist = useCallback(async (next: OutfitLog[]) => {
    if (!user) return;
    try {
      await AsyncStorage.setItem(calendarKey(user.id), JSON.stringify(next));
    } catch {}
  }, [user]);

  const logOutfit = useCallback(async (
    date: string,
    items: Partial<Record<ClothingCategory, ClothingItem>>,
    opts?: { note?: string; previewImage?: string; temperature?: number; weather?: string }
  ) => {
    const entry: OutfitLog = {
      id: createUuid(),
      date,
      items,
      note: opts?.note,
      previewImage: opts?.previewImage,
      temperature: opts?.temperature,
      weather: opts?.weather,
    };
    setLogs((prev) => {
      const filtered = prev.filter((l) => l.date !== date);
      const next = [entry, ...filtered];
      void persist(next);
      return next;
    });
    if (supabase && user) {
      await supabase.from("outfit_calendar_logs").upsert({
        id: entry.id,
        user_id: user.id,
        log_date: entry.date,
        items: stripItemImages(entry.items),
        note: entry.note ?? null,
        temperature: entry.temperature ?? null,
        weather: entry.weather ?? null,
      }, { onConflict: "user_id,log_date" });
    }
  }, [persist, user]);

  const removeLog = useCallback(async (id: string) => {
    const deleted = logs.find((entry) => entry.id === id);
    setLogs((prev) => {
      const next = prev.filter((l) => l.id !== id);
      void persist(next);
      return next;
    });
    if (supabase && user && deleted) {
      await supabase.from("outfit_calendar_logs").delete()
        .eq("user_id", user.id)
        .eq("log_date", deleted.date);
    }
  }, [logs, persist, user]);

  const getLogForDate = useCallback((date: string) => {
    return logs.find((l) => l.date === date);
  }, [logs]);

  const getLogsForMonth = useCallback((year: number, month: number) => {
    const prefix = `${year}-${String(month + 1).padStart(2, "0")}`;
    return logs.filter((l) => l.date.startsWith(prefix));
  }, [logs]);

  return (
    <CalendarContext.Provider value={{ logs, logOutfit, removeLog, getLogForDate, getLogsForMonth, isLoading }}>
      {children}
    </CalendarContext.Provider>
  );
}

export function useCalendar() {
  const ctx = useContext(CalendarContext);
  if (!ctx) throw new Error("useCalendar must be inside CalendarProvider");
  return ctx;
}
