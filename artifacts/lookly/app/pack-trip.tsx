import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useWardrobe, type ClothingItem } from "@/contexts/WardrobeContext";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
interface DailyForecast {
  date: string;
  tempMax: number;
  tempMin: number;
  precipitation: number;
}

interface GeoSuggestion {
  name: string;
  country: string;
  admin1?: string;
  latitude: number;
  longitude: number;
}

type TempTier = "freezing" | "cold" | "cool" | "mild" | "warm" | "hot";

function getTier(temp: number): TempTier {
  if (temp <= 0) return "freezing";
  if (temp <= 10) return "cold";
  if (temp <= 17) return "cool";
  if (temp <= 24) return "mild";
  if (temp <= 30) return "warm";
  return "hot";
}

const TIER_LABEL: Record<TempTier, string> = {
  freezing: "Below 0°C — heavy winter gear",
  cold: "0–10°C — warm outerwear needed",
  cool: "10–17°C — light jacket days",
  mild: "17–24°C — comfortable layering",
  warm: "24–30°C — light fabrics",
  hot: "Above 30°C — summer essentials only",
};

interface PackingCategory {
  category: string;
  icon: React.ComponentProps<typeof Feather>["name"];
  needed: number;
  reason: string;
  fromWardrobe: ClothingItem[];
  needToBuy: string[];
}

// ─────────────────────────────────────────────
// Buy-item image mapping
// ─────────────────────────────────────────────
function getBuyImageUri(label: string): string {
  const l = label.toLowerCase();
  if (l.includes("sandal"))                      return "https://images.unsplash.com/photo-1603487742131-4160ec999306?w=300&h=380&fit=crop&auto=format&q=75";
  if (l.includes("sneaker") || l.includes("shoe")) return "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=300&h=380&fit=crop&auto=format&q=75";
  if (l.includes("heavy") && l.includes("coat")) return "https://images.unsplash.com/photo-1547949003-9792a18a2601?w=300&h=380&fit=crop&auto=format&q=75";
  if (l.includes("jacket") || l.includes("cardigan")) return "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=300&h=380&fit=crop&auto=format&q=75";
  if (l.includes("linen") || (l.includes("light") && l.includes("top"))) return "https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=300&h=380&fit=crop&auto=format&q=75";
  if (l.includes("knit") || l.includes("warm") || l.includes("wool")) return "https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=300&h=380&fit=crop&auto=format&q=75";
  if (l.includes("top") || l.includes("shirt") || l.includes("tee")) return "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=300&h=380&fit=crop&auto=format&q=75";
  if (l.includes("trouser") || l.includes("skirt"))  return "https://images.unsplash.com/photo-1594938298603-c8148c4b4816?w=300&h=380&fit=crop&auto=format&q=75";
  if (l.includes("jean") || l.includes("bottom"))    return "https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=300&h=380&fit=crop&auto=format&q=75";
  if (l.includes("scarf") || l.includes("belt") || l.includes("accessor")) return "https://images.unsplash.com/photo-1551803091-e20673f15770?w=300&h=380&fit=crop&auto=format&q=75";
  if (l.includes("rain"))  return "https://images.unsplash.com/photo-1530521954074-e0a103ceff5c?w=300&h=380&fit=crop&auto=format&q=75";
  return   "https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?w=300&h=380&fit=crop&auto=format&q=75";
}

// ─────────────────────────────────────────────
// Packing logic
// ─────────────────────────────────────────────
function generatePackingList(
  days: number,
  forecasts: DailyForecast[],
  wardrobe: ClothingItem[],
  hasRain: boolean
): PackingCategory[] {
  const avgHigh = forecasts.reduce((s, d) => s + d.tempMax, 0) / forecasts.length;
  const avgLow = forecasts.reduce((s, d) => s + d.tempMin, 0) / forecasts.length;
  const needsOuterwear = avgLow <= 17;
  const needsHeavy = avgLow <= 10;
  const isHot = avgHigh > 28;

  const weightOk = (item: ClothingItem) => {
    if (isHot && item.fabricWeight === "heavy") return false;
    if (needsHeavy && item.fabricWeight === "light") return false;
    return true;
  };

  const topsNeeded = Math.ceil(days * 1.2);
  const bottomsNeeded = Math.max(2, Math.ceil(days * 0.6));
  const shoesNeeded = Math.min(3, Math.max(1, Math.ceil(days / 3)));
  const outerNeeded = needsOuterwear ? Math.min(2, Math.ceil(days / 4)) : 0;

  const tops = wardrobe.filter((i) => i.category === "tops" && weightOk(i));
  const bottoms = wardrobe.filter((i) => i.category === "bottoms" && weightOk(i));
  const dresses = wardrobe.filter((i) => i.category === "dresses" && weightOk(i));
  const outer = wardrobe.filter((i) => i.category === "outerwear");
  const shoes = wardrobe.filter((i) => i.category === "shoes");
  const access = wardrobe.filter((i) => i.category === "accessories");

  const result: PackingCategory[] = [];

  result.push({
    category: "Tops",
    icon: "wind",
    needed: topsNeeded,
    reason: `${topsNeeded} tops for ${days} days at ${Math.round(avgHigh)}°C avg`,
    fromWardrobe: tops.slice(0, topsNeeded),
    needToBuy: tops.length < topsNeeded
      ? Array(topsNeeded - tops.length).fill(
          isHot ? "Lightweight breathable top" : needsHeavy ? "Warm knit top" : "Casual layering top"
        )
      : [],
  });

  result.push({
    category: "Bottoms",
    icon: "minus",
    needed: bottomsNeeded,
    reason: `${bottomsNeeded} bottoms for the trip`,
    fromWardrobe: [...bottoms, ...dresses].slice(0, bottomsNeeded),
    needToBuy: (bottoms.length + dresses.length) < bottomsNeeded
      ? Array(bottomsNeeded - bottoms.length - dresses.length).fill(
          isHot ? "Light trousers / skirt" : "Comfortable jeans"
        )
      : [],
  });

  if (needsOuterwear && outerNeeded > 0) {
    result.push({
      category: "Outerwear",
      icon: "layers",
      needed: outerNeeded,
      reason: needsHeavy ? "Heavy coat required — lows below 10°C" : "Light jacket for cool evenings",
      fromWardrobe: outer.slice(0, outerNeeded),
      needToBuy: outer.length < outerNeeded
        ? [needsHeavy ? "Heavy winter coat" : "Light jacket or cardigan"]
        : [],
    });
  }

  result.push({
    category: "Shoes",
    icon: "chevrons-up",
    needed: shoesNeeded,
    reason: `${shoesNeeded} pairs — ${isHot ? "sandals / sneakers for heat" : "closed-toe for cooler temps"}`,
    fromWardrobe: shoes.slice(0, shoesNeeded),
    needToBuy: shoes.length < shoesNeeded
      ? Array(shoesNeeded - shoes.length).fill(isHot ? "Comfortable sandals" : "Versatile sneakers")
      : [],
  });

  if (hasRain) {
    result.push({
      category: "Rain Gear",
      icon: "cloud-rain",
      needed: 1,
      reason: "Precipitation forecast — pack a rain layer",
      fromWardrobe: outer.filter((i) =>
        i.tags?.includes("waterproof") || i.name.toLowerCase().includes("rain")
      ).slice(0, 1),
      needToBuy: [],
    });
  }

  result.push({
    category: "Accessories",
    icon: "circle",
    needed: Math.min(access.length, 3),
    reason: "Scarves, belts, bags for variety",
    fromWardrobe: access.slice(0, 3),
    needToBuy: access.length === 0 ? ["Versatile belt or scarf"] : [],
  });

  return result;
}

// ─────────────────────────────────────────────
// Calendar helpers
// ─────────────────────────────────────────────
const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function buildCalendarWeeks(year: number, month: number): (Date | null)[][] {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const padStart = (first.getDay() + 6) % 7; // Monday-first
  const days: (Date | null)[] = Array(padStart).fill(null);
  for (let d = 1; d <= last.getDate(); d++) days.push(new Date(year, month, d));
  while (days.length % 7 !== 0) days.push(null);
  const weeks: (Date | null)[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
  return weeks;
}

function formatDate(d: Date | null): string {
  if (!d) return "";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function dayDiff(a: Date, b: Date): number {
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / 86400000);
}

// ─────────────────────────────────────────────
// DateRangePicker component
// ─────────────────────────────────────────────
interface DateRangePickerProps {
  start: Date | null;
  end: Date | null;
  onChange: (start: Date | null, end: Date | null) => void;
  colors: ReturnType<typeof useColors>;
}

function DateRangePicker({ start, end, onChange, colors }: DateRangePickerProps) {
  const today = startOfDay(new Date());
  const [open, setOpen] = useState(false);
  const [calMonth, setCalMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));

  const weeks = buildCalendarWeeks(calMonth.getFullYear(), calMonth.getMonth());

  const handleDayPress = (day: Date) => {
    const d = startOfDay(day);
    if (d < today) return; // no past dates
    if (!start || (start && end)) {
      // reset or start fresh
      onChange(d, null);
    } else {
      // second tap
      if (d < start) {
        onChange(d, start);
      } else if (sameDay(d, start)) {
        onChange(null, null);
      } else {
        onChange(start, d);
      }
    }
  };

  const prevMonth = () => setCalMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1));
  const nextMonth = () => setCalMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1));

  const dayStyle = (day: Date | null) => {
    if (!day) return {};
    const d = startOfDay(day);
    const isStart = start && sameDay(d, start);
    const isEnd = end && sameDay(d, end);
    const inRange = start && end && d > start && d < end;
    const isPast = d < today;
    return { isStart, isEnd, inRange, isPast, isToday: sameDay(d, today) };
  };

  const monthLabel = calMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return (
    <View>
      {/* Two tap targets: departure / return */}
      <View style={drStyles.row}>
        <TouchableOpacity
          onPress={() => setOpen((v) => !v)}
          style={[drStyles.dateBtn, { backgroundColor: colors.secondary, borderColor: start ? colors.accent : colors.border }]}
        >
          <Feather name="calendar" size={14} color={start ? colors.accent : colors.mutedForeground} />
          <View style={{ flex: 1 }}>
            <Text style={[drStyles.dateBtnLabel, { color: colors.mutedForeground }]}>DEPARTURE</Text>
            <Text style={[drStyles.dateBtnValue, { color: start ? colors.foreground : colors.mutedForeground }]}>
              {start ? formatDate(start) : "Select date"}
            </Text>
          </View>
        </TouchableOpacity>

        <View style={[drStyles.arrow, { backgroundColor: colors.border }]}>
          <Feather name="arrow-right" size={12} color={colors.mutedForeground} />
        </View>

        <TouchableOpacity
          onPress={() => setOpen((v) => !v)}
          style={[drStyles.dateBtn, { backgroundColor: colors.secondary, borderColor: end ? colors.accent : colors.border }]}
        >
          <Feather name="calendar" size={14} color={end ? colors.accent : colors.mutedForeground} />
          <View style={{ flex: 1 }}>
            <Text style={[drStyles.dateBtnLabel, { color: colors.mutedForeground }]}>RETURN</Text>
            <Text style={[drStyles.dateBtnValue, { color: end ? colors.foreground : colors.mutedForeground }]}>
              {end ? formatDate(end) : "Select date"}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {start && !end && (
        <Text style={[drStyles.hint, { color: colors.accent }]}>Now tap your return date</Text>
      )}
      {start && end && (
        <Text style={[drStyles.hint, { color: colors.mutedForeground }]}>
          {dayDiff(start, end)} nights · tap a date to change
        </Text>
      )}

      {open && (
        <View style={[drStyles.calendar, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {/* Month navigation */}
          <View style={drStyles.calHeader}>
            <TouchableOpacity onPress={prevMonth} style={drStyles.navBtn}>
              <Feather name="chevron-left" size={18} color={colors.foreground} />
            </TouchableOpacity>
            <Text style={[drStyles.monthLabel, { color: colors.foreground }]}>{monthLabel}</Text>
            <TouchableOpacity onPress={nextMonth} style={drStyles.navBtn}>
              <Feather name="chevron-right" size={18} color={colors.foreground} />
            </TouchableOpacity>
          </View>

          {/* Weekday headers */}
          <View style={drStyles.weekRow}>
            {WEEKDAYS.map((w) => (
              <Text key={w} style={[drStyles.weekday, { color: colors.mutedForeground }]}>{w}</Text>
            ))}
          </View>

          {/* Day grid */}
          {weeks.map((week, wi) => (
            <View key={wi} style={drStyles.weekRow}>
              {week.map((day, di) => {
                if (!day) return <View key={di} style={drStyles.dayCell} />;
                const { isStart, isEnd, inRange, isPast, isToday } = dayStyle(day);
                const filled = isStart || isEnd;
                return (
                  <TouchableOpacity
                    key={di}
                    onPress={() => handleDayPress(day)}
                    disabled={isPast}
                    style={[
                      drStyles.dayCell,
                      inRange && { backgroundColor: "#C8906A22" },
                      filled && { backgroundColor: "#C8906A", borderRadius: 20 },
                      isToday && !filled && { borderWidth: 1.5, borderColor: "#C8906A", borderRadius: 20 },
                    ]}
                  >
                    <Text style={[
                      drStyles.dayText,
                      { color: isPast ? colors.border : colors.foreground },
                      filled && { color: "#fff", fontWeight: "700" },
                    ]}>
                      {day.getDate()}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}

          {start && end && (
            <TouchableOpacity onPress={() => { setOpen(false); }} style={[drStyles.doneBtn, { backgroundColor: colors.primary }]}>
              <Text style={[drStyles.doneBtnText, { color: colors.primaryForeground }]}>Done</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

const drStyles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  dateBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  dateBtnLabel: { fontSize: 9, fontWeight: "700", letterSpacing: 0.8 },
  dateBtnValue: { fontSize: 13, fontWeight: "600", marginTop: 1 },
  arrow: {
    width: 26, height: 26, borderRadius: 13,
    alignItems: "center", justifyContent: "center",
  },
  hint: { fontSize: 12, textAlign: "center", marginTop: 6 },
  calendar: {
    marginTop: 12,
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    gap: 4,
  },
  calHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  navBtn: { padding: 6 },
  monthLabel: { fontSize: 15, fontWeight: "700" },
  weekRow: { flexDirection: "row" },
  weekday: { flex: 1, textAlign: "center", fontSize: 11, fontWeight: "600", paddingVertical: 4 },
  dayCell: {
    flex: 1,
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 1,
  },
  dayText: { fontSize: 13 },
  doneBtn: { marginTop: 8, paddingVertical: 10, borderRadius: 12, alignItems: "center" },
  doneBtnText: { fontSize: 14, fontWeight: "700" },
});

// ─────────────────────────────────────────────
// Main screen
// ─────────────────────────────────────────────
export default function PackTripScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { items: wardrobe } = useWardrobe();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  // Destination input + suggestions
  const [city, setCity] = useState("");
  const [suggestions, setSuggestions] = useState<GeoSuggestion[]>([]);
  const [selectedGeo, setSelectedGeo] = useState<GeoSuggestion | null>(null);
  const suggestTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Date range
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);

  const tripDays = startDate && endDate ? Math.max(1, dayDiff(startDate, endDate)) : null;

  // Results
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forecasts, setForecasts] = useState<DailyForecast[] | null>(null);
  const [packingList, setPackingList] = useState<PackingCategory[] | null>(null);
  const [resolvedCity, setResolvedCity] = useState("");

  // ── Autocomplete ──
  useEffect(() => {
    if (suggestTimer.current) clearTimeout(suggestTimer.current);
    if (city.length < 2 || selectedGeo) { setSuggestions([]); return; }
    suggestTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=6&language=en&format=json`
        );
        const data = await res.json() as { results?: GeoSuggestion[] };
        setSuggestions(data.results ?? []);
      } catch { setSuggestions([]); }
    }, 380);
    return () => { if (suggestTimer.current) clearTimeout(suggestTimer.current); };
  }, [city, selectedGeo]);

  const selectSuggestion = (s: GeoSuggestion) => {
    setSelectedGeo(s);
    setCity(`${s.name}, ${s.admin1 ? s.admin1 + ", " : ""}${s.country}`);
    setSuggestions([]);
  };

  const handleCityChange = (v: string) => {
    setCity(v);
    setSelectedGeo(null);
    setError(null);
  };

  // ── Generate ──
  const handleGenerate = async () => {
    if (!city.trim()) { setError("Enter a destination city"); return; }
    if (!startDate || !endDate) { setError("Select your travel dates"); return; }
    if (tripDays === null || tripDays < 1) { setError("Return date must be after departure"); return; }

    setError(null);
    setIsLoading(true);
    setForecasts(null);
    setPackingList(null);

    try {
      let geo = selectedGeo;
      if (!geo) {
        const geoRes = await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city.trim())}&count=1&language=en&format=json`
        );
        const geoData = await geoRes.json() as { results?: GeoSuggestion[] };
        if (!geoData.results?.length) { setError(`Could not find "${city.trim()}". Try a different spelling.`); return; }
        geo = geoData.results[0]!;
      }

      setResolvedCity(`${geo.name}${geo.admin1 ? ", " + geo.admin1 : ""}, ${geo.country}`);

      // Format dates for API
      const fmt = (d: Date) => d.toISOString().split("T")[0];
      const today = startOfDay(new Date());
      const apiStart = startDate < today ? today : startDate;
      const apiEnd = new Date(apiStart.getTime() + Math.min(tripDays, 16) * 86400000);
      const isFutureForecast = dayDiff(today, startDate) > 16;

      let parsed: DailyForecast[] = [];

      if (!isFutureForecast) {
        const forecastRes = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${geo.latitude}&longitude=${geo.longitude}` +
          `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto` +
          `&start_date=${fmt(apiStart)}&end_date=${fmt(apiEnd)}`
        );
        const forecastData = await forecastRes.json() as {
          daily: { time: string[]; temperature_2m_max: number[]; temperature_2m_min: number[]; precipitation_sum: number[] };
        };
        const d = forecastData.daily;
        parsed = d.time.map((date, i) => ({
          date,
          tempMax: d.temperature_2m_max[i]!,
          tempMin: d.temperature_2m_min[i]!,
          precipitation: d.precipitation_sum[i]!,
        }));
      } else {
        // Trip is beyond 16-day window — use climate data
        const clRes = await fetch(
          `https://climate-api.open-meteo.com/v1/climate?latitude=${geo.latitude}&longitude=${geo.longitude}` +
          `&start_date=${fmt(startDate).slice(0, 4)}-${fmt(startDate).slice(5, 7)}-01` +
          `&end_date=${fmt(startDate).slice(0, 4)}-${fmt(startDate).slice(5, 7)}-28` +
          `&models=EC_Earth3P_HR&daily=temperature_2m_max,temperature_2m_min`
        ).catch(() => null);
        if (clRes && clRes.ok) {
          const clData = await clRes.json() as {
            daily?: { time: string[]; temperature_2m_max: number[]; temperature_2m_min: number[] };
          };
          if (clData.daily) {
            const cl = clData.daily;
            const avgMax = cl.temperature_2m_max.reduce((a, b) => a + b, 0) / cl.temperature_2m_max.length;
            const avgMin = cl.temperature_2m_min.reduce((a, b) => a + b, 0) / cl.temperature_2m_min.length;
            for (let i = 0; i < Math.min(tripDays, 16); i++) {
              const d = new Date(startDate.getTime() + i * 86400000);
              parsed.push({ date: fmt(d), tempMax: avgMax, tempMin: avgMin, precipitation: 0 });
            }
          }
        }
        // If climate API failed, use generic seasonal mock
        if (parsed.length === 0) {
          const month = startDate.getMonth();
          const [mockMax, mockMin] = month < 2 || month > 10 ? [5, -2] : month < 5 ? [18, 8] : month < 9 ? [30, 18] : [14, 6];
          for (let i = 0; i < Math.min(tripDays, 16); i++) {
            const d = new Date(startDate.getTime() + i * 86400000);
            parsed.push({ date: fmt(d), tempMax: mockMax, tempMin: mockMin, precipitation: 0 });
          }
        }
      }

      const hasRain = parsed.some((d) => d.precipitation > 1);
      setForecasts(parsed);
      setPackingList(generatePackingList(tripDays, parsed, wardrobe, hasRain));
    } catch {
      setError("Could not fetch weather. Check your connection.");
    } finally {
      setIsLoading(false);
    }
  };

  const avgHigh = forecasts ? Math.round(forecasts.reduce((s, d) => s + d.tempMax, 0) / forecasts.length) : null;
  const avgLow = forecasts ? Math.round(forecasts.reduce((s, d) => s + d.tempMin, 0) / forecasts.length) : null;
  const dominantTier = avgHigh != null && avgLow != null ? getTier((avgHigh + avgLow) / 2) : null;
  const totalPacked = packingList?.reduce((s, c) => s + c.fromWardrobe.length, 0) ?? 0;
  const totalToBuy = packingList?.reduce((s, c) => s + c.needToBuy.length, 0) ?? 0;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 16, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={[styles.headerLabel, { color: colors.mutedForeground }]}>PACKING UTILITY</Text>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Pack for Trip</Text>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, { paddingBottom: Platform.OS === "web" ? 80 : insets.bottom + 80 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Input card ── */}
        <View style={[styles.inputCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.inputTitle, { color: colors.foreground }]}>Where are you going?</Text>
          <Text style={[styles.inputSub, { color: colors.mutedForeground }]}>
            Pick your destination and travel dates — we'll match your wardrobe to the real forecast.
          </Text>

          {/* Destination with autocomplete */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>DESTINATION</Text>
            <View style={[styles.inputRow, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
              <Feather name="map-pin" size={16} color={colors.mutedForeground} />
              <TextInput
                style={[styles.textInput, { color: colors.foreground }]}
                value={city}
                onChangeText={handleCityChange}
                placeholder="e.g. Dubai, Istanbul, Paris…"
                placeholderTextColor={colors.mutedForeground}
                returnKeyType="search"
                autoCorrect={false}
                autoCapitalize="words"
              />
              {city.length > 0 && (
                <TouchableOpacity onPress={() => { setCity(""); setSelectedGeo(null); setSuggestions([]); }}>
                  <Feather name="x" size={15} color={colors.mutedForeground} />
                </TouchableOpacity>
              )}
            </View>

            {suggestions.length > 0 && (
              <View style={[styles.suggestionBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
                {suggestions.map((s, i) => (
                  <TouchableOpacity
                    key={i}
                    onPress={() => selectSuggestion(s)}
                    style={[
                      styles.suggestionRow,
                      i < suggestions.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
                    ]}
                  >
                    <Feather name="map-pin" size={13} color={colors.accent} style={{ marginTop: 1 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.suggCityText, { color: colors.foreground }]}>{s.name}</Text>
                      <Text style={[styles.suggSubText, { color: colors.mutedForeground }]}>
                        {[s.admin1, s.country].filter(Boolean).join(", ")}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Date range picker */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>TRAVEL DATES</Text>
            <DateRangePicker
              start={startDate}
              end={endDate}
              onChange={(s, e) => { setStartDate(s); setEndDate(e); }}
              colors={colors}
            />
          </View>

          {error && (
            <View style={styles.errorRow}>
              <Feather name="alert-circle" size={14} color="#DC2626" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <TouchableOpacity
            onPress={handleGenerate}
            disabled={isLoading || !city.trim() || !startDate || !endDate}
            style={[styles.generateBtn, {
              backgroundColor: colors.primary,
              opacity: (isLoading || !city.trim() || !startDate || !endDate) ? 0.5 : 1,
            }]}
          >
            {isLoading
              ? <ActivityIndicator size="small" color={colors.primaryForeground} />
              : <Feather name="zap" size={16} color={colors.primaryForeground} />
            }
            <Text style={[styles.generateBtnText, { color: colors.primaryForeground }]}>
              {isLoading
                ? "Checking forecast…"
                : tripDays
                  ? `Pack for ${tripDays} night${tripDays !== 1 ? "s" : ""}`
                  : "Generate packing list"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Forecast summary ── */}
        {forecasts && dominantTier && (
          <View style={[styles.forecastCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.forecastHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.forecastCity, { color: colors.foreground }]}>{resolvedCity}</Text>
                <Text style={[styles.forecastRange, { color: colors.mutedForeground }]}>
                  {avgLow}° – {avgHigh}°C avg · {forecasts.length} day forecast
                  {tripDays ? ` · ${tripDays} nights` : ""}
                </Text>
              </View>
              <View style={[styles.tierBadge, { backgroundColor: colors.accent + "22" }]}>
                <Text style={[styles.tierText, { color: colors.accent }]}>
                  {dominantTier.charAt(0).toUpperCase() + dominantTier.slice(1)}
                </Text>
              </View>
            </View>
            <Text style={[styles.tierDesc, { color: colors.mutedForeground }]}>{TIER_LABEL[dominantTier]}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.forecastStrip}>
              {forecasts.slice(0, 7).map((d) => (
                <View key={d.date} style={[styles.forecastDay, { backgroundColor: colors.secondary }]}>
                  <Text style={[styles.forecastDayName, { color: colors.mutedForeground }]}>
                    {new Date(d.date + "T00:00:00").toLocaleDateString("en-US", { weekday: "short" })}
                  </Text>
                  <Text style={[styles.forecastHigh, { color: colors.foreground }]}>{Math.round(d.tempMax)}°</Text>
                  <Text style={[styles.forecastLow, { color: colors.mutedForeground }]}>{Math.round(d.tempMin)}°</Text>
                  {d.precipitation > 1 && <Feather name="cloud-rain" size={10} color="#3B82F6" />}
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* ── Packing list ── */}
        {packingList && (
          <>
            <View style={styles.packSummaryRow}>
              <View style={[styles.packStat, { backgroundColor: "#F0FDF4", borderColor: "#BBF7D0" }]}>
                <Text style={[styles.packStatNum, { color: "#059669" }]}>{totalPacked}</Text>
                <Text style={[styles.packStatLabel, { color: "#059669" }]}>from wardrobe</Text>
              </View>
              {totalToBuy > 0 && (
                <View style={[styles.packStat, { backgroundColor: "#FEF9EC", borderColor: "#FDE68A" }]}>
                  <Text style={[styles.packStatNum, { color: "#D97706" }]}>{totalToBuy}</Text>
                  <Text style={[styles.packStatLabel, { color: "#D97706" }]}>consider buying</Text>
                </View>
              )}
            </View>

            {packingList.map((cat) => (
              <View key={cat.category} style={[styles.packCat, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.packCatHeader}>
                  <View style={[styles.packIconWrap, { backgroundColor: colors.accent + "22" }]}>
                    <Feather name={cat.icon} size={15} color={colors.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.packCatTitle, { color: colors.foreground }]}>{cat.category}</Text>
                    <Text style={[styles.packCatReason, { color: colors.mutedForeground }]}>{cat.reason}</Text>
                  </View>
                  <View style={[styles.neededBadge, { backgroundColor: colors.secondary }]}>
                    <Text style={[styles.neededNum, { color: colors.foreground }]}>{cat.needed}</Text>
                  </View>
                </View>

                {cat.fromWardrobe.length > 0 && (
                  <View style={styles.wardrobeMatches}>
                    <Text style={[styles.matchesLabel, { color: colors.mutedForeground }]}>FROM YOUR WARDROBE</Text>
                    {cat.fromWardrobe.map((item) => (
                      <View key={item.id} style={[styles.itemRow, { backgroundColor: colors.secondary }]}>
                        <View style={[styles.itemSwatch, { backgroundColor: item.colorHex }]} />
                        <Text style={[styles.itemName, { color: colors.foreground }]} numberOfLines={1}>{item.name}</Text>
                        <View style={[styles.checkBadge, { backgroundColor: "#F0FDF4" }]}>
                          <Feather name="check" size={10} color="#059669" />
                        </View>
                      </View>
                    ))}
                  </View>
                )}

                {/* ── Consider packing — image cards ── */}
                {cat.needToBuy.length > 0 && (
                  <View style={styles.toBuySection}>
                    <Text style={[styles.matchesLabel, { color: "#D97706" }]}>CONSIDER PACKING</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.buyCardRow}>
                      {cat.needToBuy.map((item, i) => (
                        <View key={i} style={[styles.buyCard, { backgroundColor: colors.secondary, borderColor: "#FDE68A" }]}>
                          <Image
                            source={{ uri: getBuyImageUri(item) }}
                            style={styles.buyCardImg}
                            contentFit="cover"
                            transition={200}
                          />
                          <View style={styles.buyCardLabel}>
                            <Feather name="shopping-bag" size={10} color="#D97706" />
                            <Text style={styles.buyCardText} numberOfLines={2}>{item}</Text>
                          </View>
                        </View>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row", alignItems: "center", paddingHorizontal: 18,
    paddingBottom: 16, borderBottomWidth: 1,
  },
  headerLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 1.2 },
  headerTitle: { fontSize: 22, fontWeight: "700" },
  content: { paddingHorizontal: 18, paddingTop: 16, gap: 16 },
  inputCard: { borderRadius: 18, borderWidth: 1, padding: 16, gap: 16 },
  inputTitle: { fontSize: 18, fontWeight: "700" },
  inputSub: { fontSize: 13, lineHeight: 18, marginTop: -8 },
  fieldGroup: { gap: 8 },
  fieldLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 0.8 },
  inputRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11,
  },
  textInput: { flex: 1, fontSize: 15, fontWeight: "500" },
  suggestionBox: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
    marginTop: -4,
  },
  suggestionRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  suggCityText: { fontSize: 14, fontWeight: "600" },
  suggSubText: { fontSize: 12, marginTop: 1 },
  errorRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  errorText: { color: "#DC2626", fontSize: 13 },
  generateBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, paddingVertical: 14, borderRadius: 14,
  },
  generateBtnText: { fontSize: 15, fontWeight: "700" },
  forecastCard: { borderRadius: 18, borderWidth: 1, padding: 16, gap: 12 },
  forecastHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  forecastCity: { fontSize: 18, fontWeight: "700" },
  forecastRange: { fontSize: 13, marginTop: 2 },
  tierBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, flexShrink: 0 },
  tierText: { fontSize: 12, fontWeight: "700" },
  tierDesc: { fontSize: 12, lineHeight: 17 },
  forecastStrip: { gap: 8 },
  forecastDay: {
    alignItems: "center", gap: 3,
    paddingHorizontal: 10, paddingVertical: 10, borderRadius: 12, minWidth: 52,
  },
  forecastDayName: { fontSize: 10, fontWeight: "600" },
  forecastHigh: { fontSize: 16, fontWeight: "800" },
  forecastLow: { fontSize: 12 },
  packSummaryRow: { flexDirection: "row", gap: 10 },
  packStat: { flex: 1, alignItems: "center", padding: 14, borderRadius: 14, borderWidth: 1, gap: 2 },
  packStatNum: { fontSize: 26, fontWeight: "800" },
  packStatLabel: { fontSize: 11, fontWeight: "600" },
  packCat: { borderRadius: 18, borderWidth: 1, padding: 14, gap: 12 },
  packCatHeader: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  packIconWrap: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  packCatTitle: { fontSize: 15, fontWeight: "700" },
  packCatReason: { fontSize: 12, lineHeight: 17, marginTop: 2 },
  neededBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  neededNum: { fontSize: 14, fontWeight: "800" },
  wardrobeMatches: { gap: 7 },
  matchesLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 0.8 },
  itemRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 10, borderRadius: 10 },
  itemSwatch: { width: 14, height: 14, borderRadius: 3, flexShrink: 0 },
  itemName: { flex: 1, fontSize: 13, fontWeight: "500" },
  checkBadge: { width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  toBuySection: { gap: 8 },
  buyCardRow: { gap: 10, paddingBottom: 4 },
  buyCard: {
    width: 130,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1.5,
  },
  buyCardImg: { width: 130, height: 160 },
  buyCardLabel: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 5,
    padding: 10,
  },
  buyCardText: { flex: 1, fontSize: 11, fontWeight: "600", color: "#92400E", lineHeight: 15 },
});
