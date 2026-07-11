import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getTopPadding, getBottomPadding } from "@/constants/layout";
import { useColors } from "@/hooks/useColors";
import { useCalendar } from "@/contexts/CalendarContext";
import { useWardrobe, type ClothingCategory, type ClothingItem } from "@/contexts/WardrobeContext";
import { useWeather } from "@/contexts/WeatherContext";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function isoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function parsePassedItems(raw: string | undefined, wardrobe: ClothingItem[]): Partial<Record<ClothingCategory, ClothingItem>> {
  if (!raw) return {};
  try {
    const ids = JSON.parse(decodeURIComponent(raw)) as string[];
    const result: Partial<Record<ClothingCategory, ClothingItem>> = {};
    for (const id of ids) {
      const item = wardrobe.find((i) => i.id === id);
      if (item) result[item.category] = item;
    }
    return result;
  } catch { return {}; }
}

export default function CalendarScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { logs, logOutfit, removeLog, getLogForDate, getLogsForMonth } = useCalendar();
  const { items: wardrobe } = useWardrobe();
  const { temperature, condition } = useWeather();

  const params = useLocalSearchParams<{ itemIds?: string; previewImage?: string }>();

  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string>(isoDate(today));
  const [showLogModal, setShowLogModal] = useState(false);
  const [logNote, setLogNote] = useState("");

  const pendingItems = parsePassedItems(params.itemIds, wardrobe);
  const hasPending = Object.keys(pendingItems).length > 0;

  useEffect(() => {
    if (hasPending) {
      setSelectedDate(isoDate(today));
      setShowLogModal(true);
    }
  }, []);

  const topPad = getTopPadding(insets.top);

  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthLogs = getLogsForMonth(year, month);
  const logsByDate = new Map(monthLogs.map((l) => [l.date, l]));

  const todayStr = isoDate(today);
  const selectedLog = getLogForDate(selectedDate);

  const handlePrevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  };
  const handleNextMonth = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  };

  const handleDayPress = (day: number) => {
    const d = new Date(year, month, day);
    setSelectedDate(isoDate(d));
  };

  const handleLogSave = async () => {
    const itemsToLog = hasPending ? pendingItems : {};
    await logOutfit(selectedDate, itemsToLog, {
      note: logNote.trim() || undefined,
      previewImage: params.previewImage ? decodeURIComponent(params.previewImage) : undefined,
      temperature,
      weather: condition,
    });
    setShowLogModal(false);
    setLogNote("");
  };

  const handleRemoveLog = () => {
    if (!selectedLog) return;
    Alert.alert("Remove log?", "This will remove the outfit logged for this date.", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => removeLog(selectedLog.id) },
    ]);
  };

  const cells: (number | null)[] = [
    ...Array(firstDayOfMonth).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 16, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={[styles.headerLabel, { color: colors.mutedForeground }]}>OUTFIT CALENDAR</Text>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>What I Wore</Text>
        </View>
        {hasPending && (
          <TouchableOpacity
            onPress={() => setShowLogModal(true)}
            style={[styles.logBtn, { backgroundColor: colors.accent }]}
          >
            <Feather name="plus" size={14} color={colors.primaryForeground} />
            <Text style={[styles.logBtnText, { color: colors.primaryForeground }]}>Log today</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: getBottomPadding(insets.bottom, 80) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Month nav */}
        <View style={styles.monthNav}>
          <TouchableOpacity onPress={handlePrevMonth} style={styles.navArrow}>
            <Feather name="chevron-left" size={20} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[styles.monthLabel, { color: colors.foreground }]}>
            {MONTHS[month]} {year}
          </Text>
          <TouchableOpacity onPress={handleNextMonth} style={styles.navArrow}>
            <Feather name="chevron-right" size={20} color={colors.foreground} />
          </TouchableOpacity>
        </View>

        {/* Day names */}
        <View style={styles.dayNames}>
          {DAYS.map((d) => (
            <Text key={d} style={[styles.dayName, { color: colors.mutedForeground }]}>{d}</Text>
          ))}
        </View>

        {/* Grid */}
        <View style={styles.grid}>
          {cells.map((day, idx) => {
            if (!day) return <View key={`empty-${idx}`} style={styles.cell} />;
            const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const hasLog = logsByDate.has(dateStr);
            const log = logsByDate.get(dateStr);
            const isToday = dateStr === todayStr;
            const isSelected = dateStr === selectedDate;
            const isPast = new Date(year, month, day) <= today;

            return (
              <TouchableOpacity
                key={dateStr}
                onPress={() => handleDayPress(day)}
                style={[
                  styles.cell,
                  isSelected && { backgroundColor: colors.primary, borderRadius: 12 },
                  isToday && !isSelected && { borderWidth: 2, borderColor: colors.accent, borderRadius: 12 },
                ]}
              >
                <Text
                  style={[
                    styles.dayNum,
                    { color: isSelected ? colors.primaryForeground : isPast ? colors.foreground : colors.mutedForeground },
                    !isPast && !isSelected && { opacity: 0.4 },
                  ]}
                >
                  {day}
                </Text>
                {hasLog && log ? (
                  <View style={[styles.logDot, { backgroundColor: isSelected ? colors.primaryForeground : colors.accent }]} />
                ) : null}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Selected day detail */}
        <View style={[styles.dayDetail, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.dayDetailHeader}>
            <Text style={[styles.dayDetailTitle, { color: colors.foreground }]}>
              {new Date(selectedDate + "T00:00:00").toLocaleDateString("en-US", {
                weekday: "long", month: "long", day: "numeric",
              })}
            </Text>
            {selectedLog ? (
              <TouchableOpacity onPress={handleRemoveLog}>
                <Feather name="trash-2" size={16} color={colors.destructive} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={() => setShowLogModal(true)}
                style={[styles.addLogBtn, { backgroundColor: colors.secondary }]}
              >
                <Feather name="plus" size={14} color={colors.accent} />
                <Text style={[styles.addLogText, { color: colors.accent }]}>Log outfit</Text>
              </TouchableOpacity>
            )}
          </View>

          {selectedLog ? (
            <View style={styles.logContent}>
              {selectedLog.previewImage ? (
                <Image
                  source={{ uri: `data:image/png;base64,${selectedLog.previewImage}` }}
                  style={[styles.logPreview, { borderColor: colors.border }]}
                  contentFit="cover"
                />
              ) : null}
              <View style={styles.logItems}>
                {Object.values(selectedLog.items).filter(Boolean).map((item) => (
                  <View
                    key={(item as ClothingItem).id}
                    style={[styles.logItemRow, { backgroundColor: colors.secondary }]}
                  >
                    <View style={[styles.logItemSwatch, { backgroundColor: (item as ClothingItem).colorHex }]} />
                    <Text style={[styles.logItemName, { color: colors.foreground }]} numberOfLines={1}>
                      {(item as ClothingItem).name}
                    </Text>
                    <Text style={[styles.logItemCat, { color: colors.mutedForeground }]}>
                      {(item as ClothingItem).category}
                    </Text>
                  </View>
                ))}
              </View>
              {selectedLog.note ? (
                <Text style={[styles.logNote, { color: colors.mutedForeground }]}>{selectedLog.note}</Text>
              ) : null}
              {selectedLog.temperature != null && (
                <Text style={[styles.logMeta, { color: colors.mutedForeground }]}>
                  {selectedLog.temperature}°C · {selectedLog.weather}
                </Text>
              )}
            </View>
          ) : (
            <View style={styles.emptyDay}>
              <Feather name="calendar" size={28} color={colors.border} />
              <Text style={[styles.emptyDayText, { color: colors.mutedForeground }]}>
                No outfit logged for this day
              </Text>
            </View>
          )}
        </View>

        {/* Recent logs streak */}
        {logs.length > 0 && (
          <View style={styles.streakSection}>
            <Text style={[styles.streakLabel, { color: colors.mutedForeground }]}>RECENT LOGS</Text>
            {logs.slice(0, 5).map((log) => (
              <View key={log.id} style={[styles.streakRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[styles.streakDate, { backgroundColor: colors.secondary }]}>
                  <Text style={[styles.streakDateNum, { color: colors.foreground }]}>
                    {new Date(log.date + "T00:00:00").getDate()}
                  </Text>
                  <Text style={[styles.streakDateMon, { color: colors.mutedForeground }]}>
                    {MONTHS[new Date(log.date + "T00:00:00").getMonth()]!.slice(0, 3)}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.streakItems, { color: colors.foreground }]} numberOfLines={1}>
                    {Object.values(log.items).filter(Boolean).map((i) => (i as ClothingItem).name).join(" · ") || "No items"}
                  </Text>
                  {log.note ? (
                    <Text style={[styles.streakNote, { color: colors.mutedForeground }]} numberOfLines={1}>{log.note}</Text>
                  ) : log.temperature != null ? (
                    <Text style={[styles.streakNote, { color: colors.mutedForeground }]}>{log.temperature}°C · {log.weather}</Text>
                  ) : null}
                </View>
                {log.temperature != null && (
                  <View style={[styles.tempBadge, { backgroundColor: colors.secondary }]}>
                    <Text style={[styles.tempBadgeText, { color: colors.mutedForeground }]}>{log.temperature}°C</Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Log modal */}
      <Modal
        visible={showLogModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowLogModal(false)}
      >
        <View style={[styles.modalRoot, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => setShowLogModal(false)}>
              <Feather name="x" size={22} color={colors.foreground} />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Log Outfit</Text>
            <TouchableOpacity
              onPress={handleLogSave}
              style={[styles.saveBtn, { backgroundColor: colors.primary }]}
            >
              <Text style={[styles.saveBtnText, { color: colors.primaryForeground }]}>Save</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.modalContent}>
            <Text style={[styles.modalDateLabel, { color: colors.mutedForeground }]}>
              Logging outfit for{" "}
              <Text style={{ color: colors.foreground, fontWeight: "700" }}>
                {new Date(selectedDate + "T00:00:00").toLocaleDateString("en-US", {
                  weekday: "long", month: "long", day: "numeric",
                })}
              </Text>
            </Text>

            {Object.values(pendingItems).length > 0 ? (
              <View style={styles.pendingItems}>
                {Object.values(pendingItems).filter(Boolean).map((item) => (
                  <View
                    key={(item as ClothingItem).id}
                    style={[styles.logItemRow, { backgroundColor: colors.secondary }]}
                  >
                    <View style={[styles.logItemSwatch, { backgroundColor: (item as ClothingItem).colorHex }]} />
                    <Text style={[styles.logItemName, { color: colors.foreground }]} numberOfLines={1}>
                      {(item as ClothingItem).name}
                    </Text>
                    <Text style={[styles.logItemCat, { color: colors.mutedForeground }]}>
                      {(item as ClothingItem).category}
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <View style={[styles.noItemsHint, { backgroundColor: colors.secondary }]}>
                <Feather name="info" size={14} color={colors.mutedForeground} />
                <Text style={[styles.noItemsText, { color: colors.mutedForeground }]}>
                  No outfit items selected. Log a blank note or go back to the outfit builder.
                </Text>
              </View>
            )}

            <View style={styles.noteField}>
              <Text style={[styles.noteLabel, { color: colors.mutedForeground }]}>ADD A NOTE (OPTIONAL)</Text>
              <TextInput
                style={[styles.noteInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
                value={logNote}
                onChangeText={setLogNote}
                placeholder="e.g. wore this to a meeting at Afsona…"
                placeholderTextColor={colors.mutedForeground}
                multiline
                numberOfLines={3}
              />
            </View>

            <View style={[styles.weatherRow, { backgroundColor: colors.secondary }]}>
              <Feather name="cloud" size={14} color={colors.mutedForeground} />
              <Text style={[styles.weatherText, { color: colors.mutedForeground }]}>
                Current: {temperature}°C · {condition}
              </Text>
            </View>
          </ScrollView>
        </View>
      </Modal>
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
  logBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20,
  },
  logBtnText: { fontSize: 13, fontWeight: "700" },
  content: { paddingHorizontal: 18, paddingTop: 16, gap: 20 },
  monthNav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  monthLabel: { fontSize: 18, fontWeight: "700" },
  navArrow: { padding: 8 },
  dayNames: { flexDirection: "row" },
  dayName: { flex: 1, textAlign: "center", fontSize: 11, fontWeight: "600" },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: {
    width: `${100 / 7}%` as `${number}%`,
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  dayNum: { fontSize: 14, fontWeight: "600" },
  logDot: { width: 5, height: 5, borderRadius: 3 },
  dayDetail: { borderRadius: 18, borderWidth: 1, padding: 16, gap: 14 },
  dayDetailHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  dayDetailTitle: { fontSize: 15, fontWeight: "700", flex: 1 },
  addLogBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
  },
  addLogText: { fontSize: 12, fontWeight: "600" },
  logContent: { gap: 12 },
  logPreview: { width: "100%", height: 160, borderRadius: 14, borderWidth: 1 },
  logItems: { gap: 6 },
  logItemRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    padding: 10, borderRadius: 10,
  },
  logItemSwatch: { width: 16, height: 16, borderRadius: 4, flexShrink: 0 },
  logItemName: { flex: 1, fontSize: 13, fontWeight: "600" },
  logItemCat: { fontSize: 11 },
  logNote: { fontSize: 13, fontStyle: "italic" },
  logMeta: { fontSize: 12 },
  emptyDay: { alignItems: "center", gap: 8, paddingVertical: 20 },
  emptyDayText: { fontSize: 13, textAlign: "center" },
  streakSection: { gap: 10 },
  streakLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 1.2 },
  streakRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    borderRadius: 14, borderWidth: 1, padding: 12,
  },
  streakDate: { alignItems: "center", width: 44, paddingVertical: 6, borderRadius: 10 },
  streakDateNum: { fontSize: 18, fontWeight: "800" },
  streakDateMon: { fontSize: 10, fontWeight: "600" },
  streakItems: { fontSize: 13, fontWeight: "600" },
  streakNote: { fontSize: 11, marginTop: 2 },
  tempBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  tempBadgeText: { fontSize: 11, fontWeight: "600" },
  modalRoot: { flex: 1 },
  modalHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 18, paddingVertical: 16, borderBottomWidth: 1, paddingTop: 20,
  },
  modalTitle: { fontSize: 17, fontWeight: "700" },
  saveBtn: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 20 },
  saveBtnText: { fontSize: 14, fontWeight: "700" },
  modalContent: { padding: 18, gap: 16 },
  modalDateLabel: { fontSize: 14, lineHeight: 20 },
  pendingItems: { gap: 6 },
  noItemsHint: {
    flexDirection: "row", alignItems: "flex-start", gap: 8,
    padding: 12, borderRadius: 12,
  },
  noItemsText: { flex: 1, fontSize: 12, lineHeight: 18 },
  noteField: { gap: 7 },
  noteLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 0.8 },
  noteInput: {
    borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11,
    fontSize: 14, minHeight: 80, textAlignVertical: "top",
  },
  weatherRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    padding: 12, borderRadius: 10,
  },
  weatherText: { fontSize: 12 },
});
