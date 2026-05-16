import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import {
  type ClothingCategory,
  type FabricWeight,
  type Season,
  useWardrobe,
} from "@/contexts/WardrobeContext";

const CATEGORIES: {
  key: ClothingCategory;
  label: string;
  icon: React.ComponentProps<typeof Feather>["name"];
}[] = [
  { key: "tops", label: "Tops", icon: "wind" },
  { key: "bottoms", label: "Bottoms", icon: "minus" },
  { key: "dresses", label: "Dresses", icon: "star" },
  { key: "outerwear", label: "Outerwear", icon: "layers" },
  { key: "shoes", label: "Shoes", icon: "chevrons-up" },
  { key: "accessories", label: "Accessories", icon: "circle" },
];

const SEASONS: Season[] = ["spring", "summer", "fall", "winter"];

const FABRIC_WEIGHTS: { key: FabricWeight; label: string; hint: string }[] = [
  { key: "light", label: "Light", hint: "linen, cotton" },
  { key: "medium", label: "Medium", hint: "denim, wool" },
  { key: "heavy", label: "Heavy", hint: "leather, puffer" },
];

const COLOR_SWATCHES: { name: string; hex: string }[] = [
  { name: "Black", hex: "#1C1512" },
  { name: "White", hex: "#FAF8F5" },
  { name: "Beige", hex: "#E8D5B7" },
  { name: "Navy", hex: "#1E3A5F" },
  { name: "Camel", hex: "#C19A6B" },
  { name: "Burgundy", hex: "#800020" },
  { name: "Olive", hex: "#6B7C4D" },
  { name: "Gray", hex: "#8A8A8A" },
  { name: "Blush", hex: "#E8A0A0" },
  { name: "Denim", hex: "#5B7FA6" },
  { name: "Terracotta", hex: "#C8906A" },
  { name: "Cream", hex: "#FAF0E6" },
];

function isLight(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 128;
}

const API_BASE = `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`;

interface ScanResult {
  name: string;
  category: ClothingCategory;
  colorName: string;
  colorHex: string;
  material: string;
  seasons: Season[];
  tags: string[];
}

async function identifyClothing(base64: string, mimeType: string): Promise<ScanResult> {
  const res = await fetch(`${API_BASE}/identify-clothing`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image: base64, mimeType }),
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json() as Promise<ScanResult>;
}

export default function AddItemScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { addItem } = useWardrobe();

  const [name, setName] = useState("");
  const [category, setCategory] = useState<ClothingCategory | null>(null);
  const [selectedColor, setSelectedColor] = useState<(typeof COLOR_SWATCHES)[number] | null>(null);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [fabricWeight, setFabricWeight] = useState<FabricWeight>("medium");
  const [isWorkwear, setIsWorkwear] = useState(false);
  const [purchasePrice, setPurchasePrice] = useState("");
  const [material, setMaterial] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const [scannedImage, setScannedImage] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanDone, setScanDone] = useState(false);

  const scanScale = useSharedValue(1);
  const scanCardOpacity = useSharedValue(0);

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const scanAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scanScale.value }],
  }));
  const scanCardStyle = useAnimatedStyle(() => ({
    opacity: scanCardOpacity.value,
  }));

  const toggleSeason = (s: Season) => {
    setSeasons((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  };

  const runScan = async (base64: string, mimeType: string, uri: string) => {
    setScannedImage(uri);
    setIsScanning(true);
    setScanDone(false);
    scanScale.value = withSpring(0.97, { damping: 12 }, () => {
      scanScale.value = withSpring(1);
    });
    try {
      const scan = await identifyClothing(base64, mimeType);
      setName(scan.name);
      setCategory(scan.category);
      const colorMatch = COLOR_SWATCHES.find(
        (c) =>
          c.name.toLowerCase() === scan.colorName.toLowerCase() ||
          c.hex.toLowerCase() === scan.colorHex.toLowerCase()
      );
      setSelectedColor(colorMatch ?? { name: scan.colorName, hex: scan.colorHex });
      setSeasons(
        scan.seasons.filter((s): s is Season =>
          ["spring", "summer", "fall", "winter"].includes(s)
        )
      );
      setMaterial(scan.material);
      setTags(scan.tags);
      setScanDone(true);
      scanCardOpacity.value = withTiming(1, { duration: 400 });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert("Scan failed", "Could not identify the item. Please fill in the details manually.");
      setScannedImage(null);
    } finally {
      setIsScanning(false);
    }
  };

  const handleScanPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Please allow access to your photo library.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      quality: 0.6,
      base64: true,
      allowsEditing: true,
      aspect: [3, 4],
    });
    if (result.canceled || !result.assets[0] || !result.assets[0].base64) return;
    const asset = result.assets[0];
    await runScan(asset.base64!, asset.mimeType ?? "image/jpeg", asset.uri);
  };

  const handleCameraCapture = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Please allow camera access.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.6,
      base64: true,
      allowsEditing: true,
      aspect: [3, 4],
    });
    if (result.canceled || !result.assets[0] || !result.assets[0].base64) return;
    const asset = result.assets[0];
    await runScan(asset.base64!, asset.mimeType ?? "image/jpeg", asset.uri);
  };

  const canSave = !!name.trim() && !!category && !!selectedColor && seasons.length > 0;

  const handleSave = async () => {
    if (!canSave || !category || !selectedColor) return;
    setIsSaving(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const price = parseFloat(purchasePrice);
    await addItem({
      name: name.trim(),
      category,
      color: selectedColor.name,
      colorHex: selectedColor.hex,
      seasons,
      fabricWeight,
      isWorkwear,
      purchasePrice: !isNaN(price) && price > 0 ? price : undefined,
      tags: tags.length > 0 ? tags : [category],
      imageUri: scannedImage ?? undefined,
    });
    router.back();
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          {
            paddingTop: topPad + 16,
            backgroundColor: colors.background,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <TouchableOpacity onPress={() => router.back()}>
          <Feather name="arrow-left" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Add Item</Text>
        <TouchableOpacity
          onPress={handleSave}
          disabled={!canSave || isSaving}
          style={[
            styles.saveBtn,
            { backgroundColor: canSave ? colors.primary : colors.secondary },
          ]}
        >
          <Text
            style={[
              styles.saveBtnText,
              { color: canSave ? colors.primaryForeground : colors.mutedForeground },
            ]}
          >
            {isSaving ? "Saving..." : "Save"}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Platform.OS === "web" ? 60 : insets.bottom + 40 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.scanSection, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <Text style={[styles.scanTitle, { color: colors.foreground }]}>Identify with AI</Text>
          <Text style={[styles.scanSubtitle, { color: colors.mutedForeground }]}>
            Take or upload a photo — we'll detect color, type, and fabric automatically
          </Text>

          {scannedImage && (
            <View style={styles.scannedImageWrap}>
              <Image source={{ uri: scannedImage }} style={styles.scannedImage} contentFit="cover" />
              {isScanning && (
                <View style={[styles.scanOverlay, { backgroundColor: "rgba(28,21,18,0.55)" }]}>
                  <ActivityIndicator size="large" color="#FAF8F5" />
                  <Text style={styles.scanOverlayText}>Analyzing...</Text>
                </View>
              )}
              {scanDone && !isScanning && (
                <View style={[styles.scanDoneBadge, { backgroundColor: colors.accent }]}>
                  <Feather name="check" size={12} color="#FFFFFF" />
                  <Text style={styles.scanDoneText}>Fields filled</Text>
                </View>
              )}
            </View>
          )}

          <Animated.View style={[styles.scanButtons, scanAnimStyle]}>
            <TouchableOpacity
              onPress={handleCameraCapture}
              disabled={isScanning}
              style={[styles.scanBtn, { backgroundColor: colors.primary, opacity: isScanning ? 0.6 : 1 }]}
            >
              <Feather name="camera" size={16} color={colors.primaryForeground} />
              <Text style={[styles.scanBtnText, { color: colors.primaryForeground }]}>Take photo</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleScanPhoto}
              disabled={isScanning}
              style={[styles.scanBtn, { backgroundColor: colors.secondary, borderColor: colors.border, borderWidth: 1, opacity: isScanning ? 0.6 : 1 }]}
            >
              {isScanning ? <ActivityIndicator size="small" color={colors.accent} /> : <Feather name="upload" size={16} color={colors.accent} />}
              <Text style={[styles.scanBtnText, { color: colors.accent }]}>
                {isScanning ? "Analyzing..." : "Upload photo"}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </View>

        {material ? (
          <Animated.View
            style={[
              scanCardStyle,
              styles.materialCard,
              { backgroundColor: colors.secondary, borderColor: colors.border },
            ]}
          >
            <View style={styles.materialRow}>
              <View style={[styles.materialIcon, { backgroundColor: colors.accent + "22" }]}>
                <Feather name="feather" size={14} color={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.materialLabel, { color: colors.mutedForeground }]}>FABRIC / MATERIAL</Text>
                <Text style={[styles.materialValue, { color: colors.foreground }]}>{material}</Text>
              </View>
            </View>
            {tags.length > 0 && (
              <View style={styles.tagRow}>
                {tags.map((t) => (
                  <View key={t} style={[styles.tag, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Text style={[styles.tagText, { color: colors.mutedForeground }]}>{t}</Text>
                  </View>
                ))}
              </View>
            )}
          </Animated.View>
        ) : null}

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Item name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="e.g. White linen shirt"
            placeholderTextColor={colors.mutedForeground}
            style={[styles.input, { borderColor: name ? colors.accent : colors.border, backgroundColor: colors.card, color: colors.foreground }]}
          />
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Category</Text>
          <View style={styles.categoryGrid}>
            {CATEGORIES.map((c) => (
              <Pressable
                key={c.key}
                onPress={() => setCategory(c.key)}
                style={({ pressed }) => [
                  styles.categoryBtn,
                  {
                    backgroundColor: category === c.key ? colors.primary : colors.card,
                    borderColor: category === c.key ? colors.primary : colors.border,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
              >
                <Feather name={c.icon} size={18} color={category === c.key ? colors.primaryForeground : colors.mutedForeground} />
                <Text style={[styles.categoryLabel, { color: category === c.key ? colors.primaryForeground : colors.foreground }]}>
                  {c.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Color</Text>
          <View style={styles.colorGrid}>
            {COLOR_SWATCHES.map((c) => (
              <TouchableOpacity key={c.hex} onPress={() => setSelectedColor(c)} style={styles.colorItem}>
                <View
                  style={[
                    styles.colorSwatch,
                    {
                      backgroundColor: c.hex,
                      borderColor: selectedColor?.hex === c.hex ? colors.accent : colors.border,
                      borderWidth: selectedColor?.hex === c.hex ? 2.5 : 1,
                    },
                  ]}
                >
                  {selectedColor?.hex === c.hex && (
                    <Feather name="check" size={14} color={isLight(c.hex) ? "#1C1512" : "#FFFFFF"} />
                  )}
                </View>
                <Text style={[styles.colorLabel, { color: selectedColor?.hex === c.hex ? colors.foreground : colors.mutedForeground }]}>
                  {c.name}
                </Text>
              </TouchableOpacity>
            ))}
            {selectedColor && !COLOR_SWATCHES.find((c) => c.hex === selectedColor.hex) && (
              <View style={styles.colorItem}>
                <View style={[styles.colorSwatch, { backgroundColor: selectedColor.hex, borderColor: colors.accent, borderWidth: 2.5 }]}>
                  <Feather name="check" size={14} color={isLight(selectedColor.hex) ? "#1C1512" : "#FFFFFF"} />
                </View>
                <Text style={[styles.colorLabel, { color: colors.foreground }]} numberOfLines={1}>
                  {selectedColor.name}
                </Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Seasons</Text>
          <View style={styles.seasonsRow}>
            {SEASONS.map((s) => (
              <Pressable
                key={s}
                onPress={() => toggleSeason(s)}
                style={({ pressed }) => [
                  styles.seasonBtn,
                  {
                    backgroundColor: seasons.includes(s) ? colors.primary : colors.card,
                    borderColor: seasons.includes(s) ? colors.primary : colors.border,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
              >
                <Text style={[styles.seasonLabel, { color: seasons.includes(s) ? colors.primaryForeground : colors.foreground }]}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Fabric weight</Text>
          <Text style={[styles.sectionHint, { color: colors.mutedForeground }]}>
            Used to match items to weather temperature
          </Text>
          <View style={styles.fabricRow}>
            {FABRIC_WEIGHTS.map((fw) => (
              <Pressable
                key={fw.key}
                onPress={() => setFabricWeight(fw.key)}
                style={({ pressed }) => [
                  styles.fabricBtn,
                  {
                    backgroundColor: fabricWeight === fw.key ? colors.primary : colors.card,
                    borderColor: fabricWeight === fw.key ? colors.primary : colors.border,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
              >
                <Text style={[styles.fabricLabel, { color: fabricWeight === fw.key ? colors.primaryForeground : colors.foreground }]}>
                  {fw.label}
                </Text>
                <Text style={[styles.fabricHint, { color: fabricWeight === fw.key ? "rgba(250,248,245,0.7)" : colors.mutedForeground }]}>
                  {fw.hint}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={[styles.section, styles.toggleSection]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Workwear / Uniform</Text>
            <Text style={[styles.sectionHint, { color: colors.mutedForeground }]}>
              Excluded from casual shuffle mode
            </Text>
          </View>
          <Switch
            value={isWorkwear}
            onValueChange={setIsWorkwear}
            thumbColor={isWorkwear ? colors.accent : colors.border}
            trackColor={{ false: colors.secondary, true: colors.secondary }}
          />
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Purchase price <Text style={{ fontWeight: "400" }}>(optional)</Text></Text>
          <Text style={[styles.sectionHint, { color: colors.mutedForeground }]}>
            Used to calculate cost per wear in Stats
          </Text>
          <View style={[styles.priceInputRow, { borderColor: purchasePrice ? colors.accent : colors.border, backgroundColor: colors.card }]}>
            <Text style={[styles.priceCurrency, { color: colors.mutedForeground }]}>$</Text>
            <TextInput
              value={purchasePrice}
              onChangeText={setPurchasePrice}
              placeholder="0.00"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="decimal-pad"
              style={[styles.priceInput, { color: colors.foreground }]}
            />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 17, fontWeight: "700" },
  saveBtn: { paddingHorizontal: 20, paddingVertical: 9, borderRadius: 100 },
  saveBtnText: { fontSize: 14, fontWeight: "600" },
  content: { paddingHorizontal: 18, paddingTop: 20, gap: 24 },
  scanSection: { borderRadius: 20, borderWidth: 1, padding: 18, gap: 14 },
  scanTitle: { fontSize: 16, fontWeight: "700" },
  scanSubtitle: { fontSize: 13, lineHeight: 18 },
  scannedImageWrap: { borderRadius: 14, overflow: "hidden", width: "100%", aspectRatio: 3 / 4, maxHeight: 220, position: "relative" },
  scannedImage: { width: "100%", height: "100%" },
  scanOverlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", gap: 10 },
  scanOverlayText: { color: "#FAF8F5", fontSize: 14, fontWeight: "600" },
  scanDoneBadge: { position: "absolute", bottom: 10, right: 10, flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 100 },
  scanDoneText: { color: "#FFFFFF", fontSize: 11, fontWeight: "700" },
  scanButtons: { flexDirection: "row", gap: 10 },
  scanBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingVertical: 12, borderRadius: 12 },
  scanBtnText: { fontSize: 14, fontWeight: "600" },
  materialCard: { borderRadius: 16, borderWidth: 1, padding: 14, gap: 12 },
  materialRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  materialIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  materialLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 0.8 },
  materialValue: { fontSize: 14, fontWeight: "600", marginTop: 2 },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  tag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100, borderWidth: 1 },
  tagText: { fontSize: 11, fontWeight: "500" },
  divider: { height: 1 },
  section: { gap: 12 },
  toggleSection: { flexDirection: "row", alignItems: "center" },
  sectionTitle: { fontSize: 16, fontWeight: "600" },
  sectionHint: { fontSize: 12, lineHeight: 17, marginTop: -6 },
  input: { borderWidth: 1, borderRadius: 14, padding: 14, fontSize: 15 },
  categoryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  categoryBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 11, borderRadius: 12, borderWidth: 1, width: "47%" },
  categoryLabel: { fontSize: 14, fontWeight: "500" },
  colorGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  colorItem: { alignItems: "center", gap: 4, width: 52 },
  colorSwatch: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  colorLabel: { fontSize: 10, fontWeight: "500", textAlign: "center" },
  seasonsRow: { flexDirection: "row", gap: 10 },
  seasonBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1, alignItems: "center" },
  seasonLabel: { fontSize: 13, fontWeight: "600" },
  fabricRow: { flexDirection: "row", gap: 10 },
  fabricBtn: { flex: 1, paddingVertical: 12, paddingHorizontal: 10, borderRadius: 12, borderWidth: 1, alignItems: "center", gap: 3 },
  fabricLabel: { fontSize: 14, fontWeight: "600" },
  fabricHint: { fontSize: 10, textAlign: "center" },
  priceInputRow: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, gap: 4 },
  priceCurrency: { fontSize: 16, fontWeight: "600" },
  priceInput: { flex: 1, paddingVertical: 14, fontSize: 15 },
});
