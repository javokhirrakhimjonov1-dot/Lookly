import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { type ClothingCategory, type ClothingItem } from "./WardrobeContext";

const CALENDAR_KEY = "@lookly_calendar_v1";

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

export function CalendarProvider({ children }: { children: React.ReactNode }) {
  const [logs, setLogs] = useState<OutfitLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(CALENDAR_KEY);
        if (raw) setLogs(JSON.parse(raw) as OutfitLog[]);
      } catch {}
      finally { setIsLoading(false); }
    })();
  }, []);

  const persist = useCallback(async (next: OutfitLog[]) => {
    try {
      await AsyncStorage.setItem(CALENDAR_KEY, JSON.stringify(next));
    } catch {}
  }, []);

  const logOutfit = useCallback(async (
    date: string,
    items: Partial<Record<ClothingCategory, ClothingItem>>,
    opts?: { note?: string; previewImage?: string; temperature?: number; weather?: string }
  ) => {
    const entry: OutfitLog = {
      id: `${date}_${Date.now()}`,
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
  }, [persist]);

  const removeLog = useCallback(async (id: string) => {
    setLogs((prev) => {
      const next = prev.filter((l) => l.id !== id);
      void persist(next);
      return next;
    });
  }, [persist]);

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
