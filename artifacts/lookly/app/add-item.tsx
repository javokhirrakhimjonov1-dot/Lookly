import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
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
import { getTopPadding, getBottomPadding } from "@/constants/layout";
import { getApiBase } from "@/constants/api";
import { apiAuthHeaders } from "@/lib/apiAuth";
import { useColors } from "@/hooks/useColors";
import {
  type BrandLogo,
  type ClothingCategory,
  type ClothingItem,
  type Currency,
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

const CURRENCIES: { key: Currency; label: string; symbol: string }[] = [
  { key: "USD", label: "USD", symbol: "$" },
  { key: "UZS", label: "UZS", symbol: "soʻm" },
  { key: "RUB", label: "RUB", symbol: "₽" },
];

const COLOR_SWATCHES: { name: string; hex: string }[] = [
  { name: "Black", hex: "#1C1512" },
  { name: "White", hex: "#F9F8F6" },
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

const CATEGORY_ICONS: Record<ClothingCategory, React.ComponentProps<typeof Feather>["name"]> = {
  tops: "wind",
  bottoms: "minus",
  dresses: "star",
  outerwear: "layers",
  shoes: "chevrons-up",
  accessories: "circle",
};

function isLight(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 128;
}

const API_BASE = getApiBase();
// A practical wardrobe batch. Each photo is analysed separately and every
// detected item remains selectable; processing is sequential so later photos
// are never silently skipped.
const MAX_SCAN_PHOTOS = 15;

interface DetectedItem {
  name: string;
  category: ClothingCategory;
  colorName: string;
  colorHex: string;
  material: string;
  fabricWeight: FabricWeight;
  seasons: Season[];
  tags: string[];
  locationHint: string;
  brandLogo?: BrandLogo | null;
  _photoUri?: string;
  _photoBase64?: string;
  _photoMime?: string;
  _extractedUri?: string;
  _isDuplicate?: boolean;
  _duplicateOf?: { name: string; color: string; category: string; fabricWeight: string };
}

type ManualPhoto = {
  uri: string;
  base64: string;
  mimeType: string;
};

function nameWords(n: string): Set<string> {
  return new Set(n.toLowerCase().split(/\s+/).filter((w) => w.length > 2));
}

function isSimilarToWardrobe(
  detected: DetectedItem,
  existing: ClothingItem
): boolean {
  if (detected.category !== existing.category) return false;
  if (detected.colorName.toLowerCase() !== existing.color.toLowerCase()) return false;
  const da = nameWords(detected.name);
  const db = nameWords(existing.name);
  const shared = [...da].filter((w) => db.has(w));
  return shared.length >= Math.max(1, Math.min(2, Math.floor(Math.min(da.size, db.size) * 0.5)));
}

async function scanClothingItems(base64: string, mimeType: string): Promise<DetectedItem[]> {
  const res = await fetch(`${API_BASE}/identify-clothing`, {
    method: "POST",
    headers: await apiAuthHeaders(),
    body: JSON.stringify({ image: base64, mimeType }),
  });
  if (!res.ok) {
    let msg = `API error ${res.status}`;
    try { const body = await res.json(); if (body.error) msg = body.error; } catch {}
    throw new Error(msg);
  }
  const data = await res.json() as { items: DetectedItem[] };
  return data.items ?? [];
}

async function removeBg(
  itemName: string,
  category: string,
  colorName?: string,
  colorHex?: string,
  material?: string,
  brandLogo?: BrandLogo | null,
  photoBase64?: string,
  photoMimeType?: string,
): Promise<string | null> {
  try {
    const res = await fetch(`${API_BASE}/remove-bg`, {
      method: "POST",
      headers: await apiAuthHeaders(),
      body: JSON.stringify({
        itemName,
        category,
        colorName,
        colorHex,
        material,
        brandLogo: brandLogo ?? undefined,
        photoBase64,
        mimeType: photoMimeType,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json() as { image?: string; url?: string };
    if (data.url) {
      // Uploaded images are served from /uploads, outside the /api router.
      return `${API_BASE.replace(/\/api$/, "")}${data.url}`;
    }
    if (data.image) return `data:image/png;base64,${data.image}`;
    return null;
  } catch {
    return null;
  }
}

async function compressForUpload(uri: string): Promise<{ uri: string; base64: string; mimeType: string }> {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 800 } }],
    { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true },
  );
  return { uri: result.uri, base64: result.base64 ?? "", mimeType: "image/jpeg" };
}

/**
 * Safari only opens the photo library when input.click() happens directly from
 * the user's tap. Expo's web picker dispatches a synthetic click event, which
 * iOS can ignore entirely. This small web-only picker keeps the real click.
 */
async function pickImagesOnWeb(): Promise<ImagePicker.ImagePickerAsset[]> {
  if (typeof document === "undefined") return [];

  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.multiple = true;
    input.style.position = "fixed";
    input.style.left = "-9999px";
    document.body.appendChild(input);

    const cleanUp = () => input.remove();
    input.addEventListener("change", async () => {
      const files = Array.from(input.files ?? []);
      if (!files.length) {
        cleanUp();
        resolve([]);
        return;
      }

      const assets = await webFilesToAssets(files);
      cleanUp();
      resolve(assets);
    }, { once: true });

    // Do not await anything before this call: it must remain part of the tap.
    input.click();
  });
}

async function webFilesToAssets(files: File[]): Promise<ImagePicker.ImagePickerAsset[]> {
  return Promise.all(files.slice(0, MAX_SCAN_PHOTOS).map(async (file) => {
        const base64 = await new Promise<string>((done) => {
          const reader = new FileReader();
          reader.onload = () => done(typeof reader.result === "string" ? (reader.result.split(",")[1] ?? "") : "");
          reader.onerror = () => done("");
          reader.onabort = () => done("");
          reader.readAsDataURL(file);
        });
        return {
          uri: URL.createObjectURL(file),
          width: 0,
          height: 0,
          type: "image" as const,
          mimeType: file.type || "image/jpeg",
          fileName: file.name,
          fileSize: file.size,
          base64,
          file,
        } as ImagePicker.ImagePickerAsset;
      }));
}

async function compressAssetForUpload(asset: ImagePicker.ImagePickerAsset): Promise<{ uri: string; base64: string; mimeType: string }> {
  // Mobile browsers already provide the selected file as base64. Running the
  // Expo canvas compressor first can hang after Safari/Chrome returns from the
  // gallery, leaving the user on an apparently abandoned picker screen.
  if (Platform.OS === "web" && asset.base64) {
    return { uri: asset.uri, base64: asset.base64, mimeType: asset.mimeType || "image/jpeg" };
  }
  try {
    const compressed = await compressForUpload(asset.uri);
    if (compressed.base64) return compressed;
  } catch {
    // Safari can occasionally decline canvas conversion for a large HEIC file.
  }
  if (asset.base64) {
    return { uri: asset.uri, base64: asset.base64, mimeType: asset.mimeType || "image/jpeg" };
  }
  throw new Error("This photo could not be read. Please try a JPEG or PNG image.");
}

function resolveColor(colorName: string, colorHex: string): { name: string; hex: string } {
  const match = COLOR_SWATCHES.find(
    (c) =>
      c.name.toLowerCase() === colorName.toLowerCase() ||
      c.hex.toLowerCase() === colorHex.toLowerCase()
  );
  return match ?? { name: colorName, hex: colorHex };
}

interface ItemPickerProps {
  visible: boolean;
  items: DetectedItem[];
  imageUri: string;
  onSelectOne: (item: DetectedItem) => void;
  onAddAll: (items: DetectedItem[]) => void;
  onDismiss: () => void;
}

function ItemPicker({ visible, items, imageUri, onSelectOne, onAddAll, onDismiss }: ItemPickerProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<Set<number>>(
    new Set(items.map((_, i) => i).filter((i) => !items[i]?._isDuplicate))
  );

  const toggleSelect = (idx: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const selectedItems = items.filter((_, i) => selected.has(i));

  return (
    <Modal visible={visible} animationType="slide" transparent presentationStyle="overFullScreen">
      <View style={styles.pickerOverlay}>
        <View
          style={[
            styles.pickerSheet,
            {
              backgroundColor: colors.background,
              paddingBottom: getBottomPadding(insets.bottom, 16),
            },
          ]}
        >
          <View style={[styles.pickerHandle, { backgroundColor: colors.border }]} />

          <View style={styles.pickerHeader}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.pickerTitle, { color: colors.foreground }]}>
                {items.length} items detected
              </Text>
              <Text style={[styles.pickerSubtitle, { color: colors.mutedForeground }]}>
                {items.filter((i) => i._isDuplicate).length > 0
                  ? `${items.filter((i) => i._isDuplicate).length} already in wardrobe · deselected`
                  : "Select which ones to add to your wardrobe"}
              </Text>
            </View>
            <TouchableOpacity onPress={onDismiss}>
              <Feather name="x" size={20} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>

          <View style={styles.pickerImageRow}>
            <Image
              source={{ uri: imageUri }}
              style={[styles.pickerThumb, { borderColor: colors.border }]}
              contentFit="cover"
            />
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={[styles.pickerImageNote, { color: colors.mutedForeground }]}>
                AI found these clothing items in your photo. Tap to select or deselect.
              </Text>
              <TouchableOpacity
                onPress={() =>
                  setSelected(
                    selected.size === items.length
                      ? new Set()
                      : new Set(items.map((_, i) => i))
                  )
                }
              >
                <Text style={[styles.pickerToggleAll, { color: colors.accent }]}>
                  {selected.size === items.length ? "Deselect all" : "Select all"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView style={styles.pickerList} showsVerticalScrollIndicator={false}>
            {items.map((item, idx) => {
              const isSelected = selected.has(idx);
              const color = resolveColor(item.colorName, item.colorHex);
              return (
                <TouchableOpacity
                  key={idx}
                  onPress={() => toggleSelect(idx)}
                  style={[
                    styles.pickerItem,
                    {
                      backgroundColor: isSelected ? colors.card : colors.background,
                      borderColor: isSelected ? colors.accent : colors.border,
                    },
                  ]}
                >
                  <View style={[styles.pickerItemColor, { backgroundColor: colors.secondary }]}>
                    <Image
                      source={{ uri: item._extractedUri ?? item._photoUri ?? imageUri }}
                      style={styles.pickerItemImage}
                      contentFit="contain"
                      transition={180}
                    />
                  </View>

                  <View style={{ flex: 1, gap: 3 }}>
                    <Text style={[styles.pickerItemCat, { color: colors.accent }]}>
                      {item.category.toUpperCase()}
                    </Text>
                    <Text style={[styles.pickerItemName, { color: colors.foreground }]} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <View style={styles.pickerLegacyMeta}>
                      <Text style={[styles.pickerItemCat, { color: colors.accent }]}>
                        {item.category.charAt(0).toUpperCase() + item.category.slice(1)}
                      </Text>
                      <Text style={[styles.pickerItemDot, { color: colors.border }]}>·</Text>
                      <Text style={[styles.pickerItemMatl, { color: colors.mutedForeground }]} numberOfLines={1}>
                        {item.material}
                      </Text>
                    </View>
                    <View style={styles.pickerCatalogMeta}>
                      <View style={styles.pickerCatalogMetaGroup}>
                        <View style={[styles.pickerColorDot, { backgroundColor: color.hex }]} />
                        <Text style={[styles.pickerCatalogMetaText, { color: colors.mutedForeground }]}>{color.name}</Text>
                      </View>
                      <Text style={[styles.pickerCatalogMetaText, { color: colors.mutedForeground }]}>Size One size</Text>
                      <Text style={[styles.pickerCatalogMetaText, { color: colors.mutedForeground }]}>0x worn</Text>
                    </View>
                    {item._isDuplicate && item._duplicateOf ? (
                      <View style={[styles.dupeBadge, { backgroundColor: "#FEF9EC", borderColor: "#FDE68A" }]}>
                        <Feather name="alert-circle" size={11} color="#D97706" />
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.dupeBadgeTitle, { color: "#92400E" }]}>
                            Already in your wardrobe
                          </Text>
                          <Text style={[styles.dupeBadgeDesc, { color: "#78350F" }]} numberOfLines={2}>
                            {item._duplicateOf.name} · {item._duplicateOf.color} {item._duplicateOf.category} · {item._duplicateOf.fabricWeight} fabric
                          </Text>
                        </View>
                      </View>
                    ) : null}
                    {!item._isDuplicate && item.locationHint ? (
                      <Text style={[styles.pickerItemHint, { color: colors.mutedForeground }]}>
                        {item.locationHint}
                      </Text>
                    ) : null}
                    <View style={styles.pickerItemTags}>
                      {item.tags.slice(0, 3).map((t) => (
                        <View key={t} style={[styles.pickerTag, { backgroundColor: colors.secondary }]}>
                          <Text style={[styles.pickerTagText, { color: colors.mutedForeground }]}>{t}</Text>
                        </View>
                      ))}
                    </View>
                  </View>

                  <View
                    style={[
                      styles.pickerCheckbox,
                      {
                        backgroundColor: isSelected ? colors.accent : "transparent",
                        borderColor: isSelected ? colors.accent : colors.border,
                      },
                    ]}
                  >
                    {isSelected && <Text style={[styles.pickerCheckmark, { color: colors.card }]}>✓</Text>}
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={styles.pickerFooter}>
            {selectedItems.length === 1 && (
              <TouchableOpacity
                onPress={() => onSelectOne(selectedItems[0]!)}
                style={[styles.pickerFillBtn, { backgroundColor: colors.secondary, borderColor: colors.border }]}
              >
                <Feather name="edit-2" size={15} color={colors.foreground} />
                <Text style={[styles.pickerFillBtnText, { color: colors.foreground }]}>
                  Review & edit
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={() => onAddAll(selectedItems)}
              disabled={selectedItems.length === 0}
              style={[
                styles.pickerAddBtn,
                {
                  backgroundColor: selectedItems.length > 0 ? colors.primary : colors.secondary,
                },
              ]}
            >
              <Feather
                name="plus-circle"
                size={15}
                color={selectedItems.length > 0 ? colors.primaryForeground : colors.border}
              />
              <Text
                style={[
                  styles.pickerAddBtnText,
                  { color: selectedItems.length > 0 ? colors.primaryForeground : colors.border },
                ]}
              >
                {selectedItems.length === 0
                  ? "Select items"
                  : `Add ${selectedItems.length} item${selectedItems.length > 1 ? "s" : ""} to wardrobe`}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function AddItemScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { addItem, addBulkItems, items: wardrobeItems } = useWardrobe();

  const [name, setName] = useState("");
  const [category, setCategory] = useState<ClothingCategory | null>(null);
  const [selectedColor, setSelectedColor] = useState<{ name: string; hex: string } | null>(null);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [fabricWeight, setFabricWeight] = useState<FabricWeight>("medium");
  const [isWorkwear, setIsWorkwear] = useState(false);
  const [purchasePrice, setPurchasePrice] = useState("");
  const [purchaseCurrency, setPurchaseCurrency] = useState<Currency>("USD");
  const [material, setMaterial] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const [brandLogo, setBrandLogo] = useState<BrandLogo | null>(null);
  const [scannedImage, setScannedImage] = useState<string | null>(null);
  const [extractedItemUri, setExtractedItemUri] = useState<string | null>(null);
  const [compressedPhotoUri, setCompressedPhotoUri] = useState<string | null>(null);
  const [scanPhotoBase64, setScanPhotoBase64] = useState<string | null>(null);
  const [scanPhotoMime, setScanPhotoMime] = useState<string>("image/jpeg");
  const [manualPhotoQueue, setManualPhotoQueue] = useState<ManualPhoto[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isRemovingBg, setIsRemovingBg] = useState(false);
  const [scanDone, setScanDone] = useState(false);
  const [scanPhotoIndex, setScanPhotoIndex] = useState(0);
  const [scanPhotoTotal, setScanPhotoTotal] = useState(0);

  const [detectedItems, setDetectedItems] = useState<DetectedItem[]>([]);
  const [showPicker, setShowPicker] = useState(false);

  const scanScale = useSharedValue(1);
  const scanCardOpacity = useSharedValue(0);

  const topPad = getTopPadding(insets.top);

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

  const applyDetectedItem = (item: DetectedItem) => {
    const color = resolveColor(item.colorName, item.colorHex);
    setName(item.name);
    setCategory(item.category);
    setSelectedColor(color);
    setSeasons(item.seasons.filter((s): s is Season => ["spring", "summer", "fall", "winter"].includes(s)));
    setMaterial(item.material);
    setFabricWeight(item.fabricWeight ?? "medium");
    setTags(item.tags);
    setBrandLogo(item.brandLogo ?? null);
    setScanDone(true);
    scanCardOpacity.value = withTiming(1, { duration: 400 });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const prepareManualPhoto = (photo: ManualPhoto) => {
    setScannedImage(photo.uri);
    setExtractedItemUri(null);
    setCompressedPhotoUri(photo.uri);
    setScanPhotoBase64(photo.base64);
    setScanPhotoMime(photo.mimeType);
    setDetectedItems([]);
    setName("");
    setCategory(null);
    setSelectedColor(null);
    setSeasons([]);
    setMaterial("");
    setPurchasePrice("");
    setTags([]);
    setBrandLogo(null);
    setScanDone(true);
    setIsScanning(false);
  };

  const handlePickerSelectOne = (item: DetectedItem) => {
    setShowPicker(false);
    applyDetectedItem(item);
  };

  const handlePickerAddAll = async (items: DetectedItem[]) => {
    if (items.length === 0) return;
    setShowPicker(false);
    setIsSaving(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const itemsWithExtractedImages = await Promise.all(
      items.map(async (item) => ({
        item,
        extractedUri: item._extractedUri ?? await removeBg(
          item.name,
          item.category,
          item.colorName,
          item.colorHex,
          item.material,
          item.brandLogo,
          item._photoBase64,
          item._photoMime,
        ),
      }))
    );
    await addBulkItems(
      itemsWithExtractedImages.map(({ item, extractedUri }) => {
        const color = resolveColor(item.colorName, item.colorHex);
        return {
          name: item.name,
          category: item.category,
          color: color.name,
          colorHex: color.hex,
          seasons: item.seasons.filter((s): s is Season =>
            ["spring", "summer", "fall", "winter"].includes(s)
          ),
          fabricWeight: item.fabricWeight ?? "medium",
          isWorkwear: false,
          tags: item.tags.length > 0 ? item.tags : [item.category],
          // Prefer a clean cut-out, but keep the original if AI processing is unavailable.
          imageUri: extractedUri ?? (item._photoBase64
            ? `data:${item._photoMime ?? "image/jpeg"};base64,${item._photoBase64}`
            : item._photoUri) ?? undefined,
          brandLogo: item.brandLogo ?? undefined,
        };
      })
    );
    setIsSaving(false);
    leaveAddItem();
  };

  const handlePickerDismiss = () => {
    setShowPicker(false);
    if (detectedItems.length === 1 && detectedItems[0]) {
      applyDetectedItem(detectedItems[0]);
    }
  };

  const leaveAddItem = () => {
    router.replace("/(tabs)/wardrobe");
  };

  const runScan = async (base64: string, mimeType: string, localUri?: string) => {
    const photoRef = localUri ?? `data:${mimeType};base64,${base64}`;
    setScannedImage(photoRef);
    setExtractedItemUri(null);
    setCompressedPhotoUri(localUri ?? null);
    setScanPhotoBase64(base64);
    setScanPhotoMime(mimeType);
    setIsScanning(true);
    setIsRemovingBg(false);
    setScanDone(false);
    scanScale.value = withSpring(0.97, { damping: 12 }, () => {
      scanScale.value = withSpring(1);
    });

    try {
      // ── Phase 1 (BLOCKING): identify items ──
      const items = await scanClothingItems(base64, mimeType);

      if (items.length === 0) {
        // AI unavailable — keep photo, let user fill in manually
        setScanDone(true);
        return;
      }

      const taggedItems = items.map((item) => {
        const existingMatch = wardrobeItems.find((w) => isSimilarToWardrobe(item, w));
        return {
          ...item,
          _photoUri: photoRef,
          _isDuplicate: !!existingMatch,
          _duplicateOf: existingMatch
            ? { name: existingMatch.name, color: existingMatch.color, category: existingMatch.category, fabricWeight: existingMatch.fabricWeight }
            : undefined,
        };
      });
      setDetectedItems(taggedItems);
      setIsScanning(false);
      setScanDone(true);

      // ── Phase 2 (NON-BLOCKING): show form/picker immediately, BG removal in background ──
      if (taggedItems.length === 1) {
        applyDetectedItem(taggedItems[0]!);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setShowPicker(true);
      }

      // Fire BG removal — UI is already unblocked, image swaps silently when ready
      setIsRemovingBg(true);
      Promise.allSettled(
        taggedItems.map((item, idx) => {
          const color = resolveColor(item.colorName, item.colorHex);
          return removeBg(
            item.name, item.category, color.name, color.hex, item.material, item.brandLogo,
            base64, mimeType,
          ).then((cleanUri) => {
            if (!cleanUri) return;
            setDetectedItems((prev) => {
              const next = [...prev];
              if (next[idx]) next[idx] = { ...next[idx]!, _extractedUri: cleanUri };
              return next;
            });
            if (idx === 0) {
              setScannedImage(cleanUri);
              setExtractedItemUri(cleanUri);
            }
          });
        })
      ).then(() => setIsRemovingBg(false));

    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "The photo could not be analyzed.";
      Alert.alert("Could not scan photo", message);
      // AI unavailable — keep the photo, let user fill in details manually
      setScanDone(true);
    } finally {
      setIsScanning(false);
    }
  };

  const handleScanPhoto = async (providedAssets?: ImagePicker.ImagePickerAsset[]) => {
    // iPhone Safari must receive the file-input click directly from this tap.
    // Native apps continue to use Expo's permission-aware picker.
    let assets: ImagePicker.ImagePickerAsset[];
    if (providedAssets) {
      assets = providedAssets;
    } else if (Platform.OS === "web") {
      assets = await pickImagesOnWeb();
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission needed", "Please allow access to your photo library.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: "images",
        quality: 0.6,
        base64: true,
        allowsEditing: false,
        allowsMultipleSelection: true,
        selectionLimit: MAX_SCAN_PHOTOS,
      });
      assets = result.canceled ? [] : result.assets;
    }
    if (assets.length === 0) return;

    if (assets.length > MAX_SCAN_PHOTOS) {
      // Browser file inputs do not always honour a selection limit. Keep the
      // first batch predictable, rather than silently having later photos fail.
      assets = assets.slice(0, MAX_SCAN_PHOTOS);
      Alert.alert(
        "Photo batch limited",
        `Lookly can scan up to ${MAX_SCAN_PHOTOS} photos at once. Please scan the remaining photos in a second batch.`,
      );
    }

    if (assets.length === 1) {
      const asset = assets[0]!;
      const compressed = await compressAssetForUpload(asset);
      await runScan(compressed.base64, compressed.mimeType, compressed.uri);
      return;
    }

    setIsScanning(true);
    setScanDone(false);
    setScanPhotoTotal(assets.length);
    setScanPhotoIndex(1);
    const firstAsset = assets[0]!;
    setScannedImage(firstAsset.uri);

    const allItems: DetectedItem[] = [];
    const manualPhotos: ManualPhoto[] = [];
    let failedPhotos = 0;
    for (let idx = 0; idx < assets.length; idx++) {
      const asset = assets[idx]!;
      setScanPhotoIndex(idx + 1);
      setScannedImage(asset.uri);
      try {
        // Web pickers often omit asset.base64 for all but the first image.
        // Compressing each asset gives every selected photo the same upload path.
        const compressed = await compressAssetForUpload(asset);
        manualPhotos.push({
          uri: compressed.uri,
          base64: compressed.base64,
          mimeType: compressed.mimeType,
        });
        const found = await scanClothingItems(compressed.base64, compressed.mimeType);
        for (const item of found) {
          // Do not discard items merely because they look similar to something
          // in another selected photo. The user must be able to see and decide
          // on every item found across the complete upload batch.
          const wardrobeDup = wardrobeItems.find((w) => isSimilarToWardrobe(item, w));
          allItems.push({
            ...item,
            _photoUri: asset.uri,
            _photoBase64: compressed.base64,
            _photoMime: compressed.mimeType,
            _isDuplicate: !!wardrobeDup,
            _duplicateOf: wardrobeDup
              ? { name: wardrobeDup.name, color: wardrobeDup.color, category: wardrobeDup.category, fabricWeight: wardrobeDup.fabricWeight }
              : undefined,
          });
        }
      } catch {
        failedPhotos += 1;
      }
    }
    setIsScanning(false);
    setScanPhotoTotal(0);

    if (allItems.length === 0) {
      // AI unavailable — keep last photo visible, let user fill manually
      const [firstPhoto, ...remainingPhotos] = manualPhotos;
      if (firstPhoto) {
        setManualPhotoQueue(remainingPhotos);
        prepareManualPhoto(firstPhoto);
      }
      const photoCount = manualPhotos.length || assets.length;
      Alert.alert(
        "Photos ready to add",
        `${photoCount} photo${photoCount === 1 ? " is" : "s are"} ready. AI identification is unavailable, so add this photo's details and save; Lookly will then show the next selected photo.`
      );
      return;
    }

    setDetectedItems(allItems);
    setScanDone(true);

    if (failedPhotos > 0) {
      Alert.alert(
        "Some photos could not be scanned",
        `${allItems.length} item${allItems.length === 1 ? " was" : "s were"} found from the other selected photo${failedPhotos === 1 ? "" : "s"}.`
      );
    }

    // ── Show picker immediately (non-blocking) ──
    if (allItems.length === 1) {
      applyDetectedItem(allItems[0]!);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowPicker(true);
    }

    // ── BG removal runs in background, updates cards silently ──
    setIsRemovingBg(true);
    Promise.allSettled(
      allItems.map((item, idx) => {
        const color = resolveColor(item.colorName, item.colorHex);
        return removeBg(item.name, item.category, color.name, color.hex, item.material, item.brandLogo, item._photoBase64, item._photoMime)
          .then((cleanUri) => {
            if (!cleanUri) return;
            setDetectedItems((prev) => {
              const next = [...prev];
              if (next[idx]) next[idx] = { ...next[idx]!, _extractedUri: cleanUri };
              return next;
            });
            if (idx === 0) { setScannedImage(cleanUri); setExtractedItemUri(cleanUri); }
          });
      })
    ).then(() => setIsRemovingBg(false));
  };

  const handleWebFileInput = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    // Clear the input so selecting the same photo again is still detected.
    event.target.value = "";
    if (!files.length) return;
    if (files.length > MAX_SCAN_PHOTOS) {
      Alert.alert(
        "Photo batch limited",
        `Lookly can scan up to ${MAX_SCAN_PHOTOS} photos at once. Please scan the remaining photos in a second batch.`,
      );
    }
    await handleScanPhoto(await webFilesToAssets(files));
  };

  const handleWebCameraInput = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    // Clear the input so a second photo is always delivered to the app.
    event.target.value = "";
    if (!files.length) return;
    await handleScanPhoto(await webFilesToAssets(files.slice(0, 1)));
  };

  const handleCameraCapture = async () => {
    if (Platform.OS === "web") {
      // The web UI uses a real <input capture> on the button below. Keep this
      // fallback for any future caller, without invoking Expo's native-only
      // camera picker in a mobile browser.
      const assets = await pickImagesOnWeb();
      if (assets.length) await handleScanPhoto(assets.slice(0, 1));
      return;
    }
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Please allow camera access.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 1,
      base64: false,
      allowsEditing: false,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const compressed = await compressForUpload(asset.uri);
    await runScan(compressed.base64, compressed.mimeType, compressed.uri);
  };

  const canSave = !!name.trim() && !!category && !!selectedColor && seasons.length > 0;

  const handleSave = async () => {
    if (!canSave || !category || !selectedColor) return;
    setIsSaving(true);
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      let cleanImageUri = extractedItemUri;
      if (!cleanImageUri && scanPhotoBase64) {
        setIsRemovingBg(true);
        cleanImageUri = await removeBg(
          name.trim(), category, selectedColor.name, selectedColor.hex, material,
          brandLogo, scanPhotoBase64, scanPhotoMime,
        );
        setIsRemovingBg(false);
      }
      const price = parseFloat(purchasePrice);
      await addItem({
        name: name.trim(), category, color: selectedColor.name, colorHex: selectedColor.hex,
        seasons, fabricWeight, isWorkwear,
        purchasePrice: !isNaN(price) && price > 0 ? price : undefined,
        purchaseCurrency: !isNaN(price) && price > 0 ? purchaseCurrency : undefined,
        tags: tags.length > 0 ? tags : [category],
        imageUri: cleanImageUri ?? (scanPhotoBase64
          ? `data:${scanPhotoMime ?? "image/jpeg"};base64,${scanPhotoBase64}`
          : compressedPhotoUri ?? scannedImage) ?? undefined,
        brandLogo: brandLogo ?? undefined,
      });
      const [nextPhoto, ...remainingPhotos] = manualPhotoQueue;
      if (nextPhoto) {
        setManualPhotoQueue(remainingPhotos);
        prepareManualPhoto(nextPhoto);
        Alert.alert(
          "Next photo ready",
          `${remainingPhotos.length + 1} selected photo${remainingPhotos.length === 0 ? "" : "s"} remaining. Add this item's details and save again.`
        );
        return;
      }
      leaveAddItem();
    } catch (error) {
      Alert.alert("Could not save item", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setIsRemovingBg(false);
      setIsSaving(false);
    }
  };

  if (isSaving && !showPicker) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background, alignItems: "center", justifyContent: "center", gap: 16 }]}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={[styles.savingText, { color: colors.mutedForeground }]}>Saving to wardrobe...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {showPicker && scannedImage && (
        <ItemPicker
          visible={showPicker}
          items={detectedItems}
          imageUri={scannedImage}
          onSelectOne={handlePickerSelectOne}
          onAddAll={handlePickerAddAll}
          onDismiss={handlePickerDismiss}
        />
      )}

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
        <TouchableOpacity onPress={leaveAddItem} accessibilityRole="button" accessibilityLabel="Back to wardrobe" hitSlop={12}>
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
          { paddingBottom: getBottomPadding(insets.bottom, 40) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.scanSection, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <Text style={[styles.scanTitle, { color: colors.foreground }]}>Scan with AI</Text>
          <Text style={[styles.scanSubtitle, { color: colors.mutedForeground }]}>
            Point at one item or a full outfit flat-lay — we'll detect every piece automatically
          </Text>

          {scannedImage && (
            <View style={styles.scannedImageWrap}>
              <Image source={{ uri: scannedImage }} style={styles.scannedImage} contentFit="cover" />
              {isScanning && (
                <View style={[styles.scanOverlay, { backgroundColor: "rgba(28,21,18,0.7)" }]}>
                  <ActivityIndicator size="large" color={colors.primaryForeground} />
                  {scanPhotoTotal > 1 ? (
                    <>
                      <Text style={[styles.scanOverlayText, { color: colors.primaryForeground }]}>
                        Analyzing photo {scanPhotoIndex} of {scanPhotoTotal}…
                      </Text>
                      <View style={styles.scanDots}>
                        {Array.from({ length: scanPhotoTotal }).map((_, i) => (
                          <View
                            key={i}
                            style={[
                              styles.scanDot,
                              i < scanPhotoIndex
                                ? { backgroundColor: colors.accent }
                                : { backgroundColor: "rgba(250,248,245,0.35)" },
                            ]}
                          />
                        ))}
                      </View>
                    </>
                  ) : (
                    <Text style={[styles.scanOverlayText, { color: colors.primaryForeground }]}>Detecting items…</Text>
                  )}
                </View>
              )}
              {isRemovingBg && !isScanning && (
                <View style={[styles.isolatingBadge, { backgroundColor: "rgba(28,21,18,0.82)" }]}>
                  <ActivityIndicator size="small" color={colors.accent} />
                  <Text style={[styles.isolatingText, { color: colors.primaryForeground }]}>Isolating garment…</Text>
                </View>
              )}
              {scanDone && !isScanning && name ? (
                <View style={[styles.scanDoneBadge, { backgroundColor: colors.accent }]}>
                  <Feather name="check" size={12} color={colors.card} />
                  <Text style={[styles.scanDoneText, { color: colors.card }]}>Filled automatically</Text>
                </View>
              ) : null}
              {detectedItems.length > 1 && !isScanning && (
                <TouchableOpacity
                  onPress={() => setShowPicker(true)}
                  style={[styles.rePickBadge, { backgroundColor: colors.primary + "EE" }]}
                >
                  <Feather name="list" size={12} color={colors.primaryForeground} />
                  <Text style={[styles.rePickText, { color: colors.primaryForeground }]}>{detectedItems.length} items found · tap to repick</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          <Animated.View style={[styles.scanButtons, scanAnimStyle]}>
            {Platform.OS === "web" ? (
              <View style={[styles.scanBtn, { backgroundColor: colors.primary, opacity: isScanning ? 0.6 : 1, position: "relative", overflow: "hidden" }]}>
                {isScanning ? <ActivityIndicator size="small" color={colors.primaryForeground} /> : <Feather name="camera" size={16} color={colors.primaryForeground} />}
                <Text style={[styles.scanBtnText, { color: colors.primaryForeground }]}>{isScanning ? "Analyzing..." : "Take photo"}</Text>
                {!isScanning && React.createElement("input", {
                  type: "file",
                  accept: "image/*",
                  capture: "environment",
                  onChange: handleWebCameraInput,
                  "aria-label": "Take a photo with the camera",
                  style: { position: "absolute", top: 0, left: 0, width: "100%", height: "100%", opacity: 0.01, zIndex: 10, cursor: "pointer" },
                })}
              </View>
            ) : (
              <TouchableOpacity
                onPress={handleCameraCapture}
                disabled={isScanning}
                style={[styles.scanBtn, { backgroundColor: colors.primary, opacity: isScanning ? 0.6 : 1 }]}
              >
                <Feather name="camera" size={16} color={colors.primaryForeground} />
                <Text style={[styles.scanBtnText, { color: colors.primaryForeground }]}>Take photo</Text>
              </TouchableOpacity>
            )}
            {Platform.OS === "web" ? (
              <View style={[styles.scanBtn, { backgroundColor: colors.secondary, borderColor: colors.border, borderWidth: 1, opacity: isScanning ? 0.6 : 1, position: "relative", overflow: "hidden" }]}>
                {isScanning ? <ActivityIndicator size="small" color={colors.accent} /> : <Feather name="upload" size={16} color={colors.accent} />}
                <Text style={[styles.scanBtnText, { color: colors.accent }]}>{isScanning ? "Analyzing..." : "Upload photo"}</Text>
                {!isScanning && React.createElement("input", {
                  type: "file",
                  accept: "image/*",
                  multiple: true,
                  onChange: handleWebFileInput,
                  "aria-label": "Upload one or more photos",
                  // This is a real native input receiving the tap directly.
                  // A tiny non-zero opacity keeps it Safari-interactive while
                  // the original Lookly button remains visible underneath.
                  style: { position: "absolute", top: 0, left: 0, width: "100%", height: "100%", opacity: 0.01, zIndex: 10, cursor: "pointer" },
                })}
              </View>
            ) : (
              <TouchableOpacity
                onPress={() => handleScanPhoto()}
                disabled={isScanning}
                style={[styles.scanBtn, { backgroundColor: colors.secondary, borderColor: colors.border, borderWidth: 1, opacity: isScanning ? 0.6 : 1 }]}
              >
                {isScanning ? <ActivityIndicator size="small" color={colors.accent} /> : <Feather name="upload" size={16} color={colors.accent} />}
                <Text style={[styles.scanBtnText, { color: colors.accent }]}>Upload photo</Text>
              </TouchableOpacity>
            )}
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
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            Purchase price <Text style={{ fontWeight: "400" }}>(optional)</Text>
          </Text>
          <Text style={[styles.sectionHint, { color: colors.mutedForeground }]}>
            Used to calculate cost per wear in Stats
          </Text>
          <View style={styles.currencyRow}>
            {CURRENCIES.map((currency) => (
              <Pressable
                key={currency.key}
                onPress={() => setPurchaseCurrency(currency.key)}
                style={[
                  styles.currencyBtn,
                  {
                    backgroundColor: purchaseCurrency === currency.key ? colors.primary : colors.secondary,
                    borderColor: purchaseCurrency === currency.key ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text style={[styles.currencyBtnText, { color: purchaseCurrency === currency.key ? colors.primaryForeground : colors.foreground }]}>
                  {currency.label}
                </Text>
              </Pressable>
            ))}
          </View>
          <View style={[styles.priceInputRow, { borderColor: purchasePrice ? colors.accent : colors.border, backgroundColor: colors.card }]}>
            <Text style={[styles.priceCurrency, { color: colors.mutedForeground }]}>
              {CURRENCIES.find((currency) => currency.key === purchaseCurrency)?.symbol}
            </Text>
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
  savingText: { fontSize: 15, fontWeight: "500" },
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
  scannedImageWrap: {
    borderRadius: 14,
    overflow: "hidden",
    width: "100%",
    height: 200,
    position: "relative",
  },
  scannedImage: { width: "100%", height: "100%" },
  scanOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  scanOverlayText: { color: "#F9F8F6", fontSize: 14, fontWeight: "600" },
  scanDots: { flexDirection: "row", gap: 7, marginTop: 4 },
  scanDot: { width: 8, height: 8, borderRadius: 4 },
  isolatingBadge: {
    position: "absolute",
    bottom: 10,
    left: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 100,
  },
  isolatingText: { color: "#F9F8F6", fontSize: 11, fontWeight: "600" },
  scanDoneBadge: {
    position: "absolute",
    bottom: 10,
    right: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 100,
  },
  scanDoneText: { color: "#FFFFFF", fontSize: 11, fontWeight: "700" },
  rePickBadge: {
    position: "absolute",
    bottom: 10,
    left: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 100,
  },
  rePickText: { color: "#F9F8F6", fontSize: 11, fontWeight: "600" },
  scanButtons: { flexDirection: "row", gap: 10 },
  scanBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingVertical: 12,
    borderRadius: 12,
  },
  scanBtnText: { fontSize: 14, fontWeight: "600" },
  materialCard: { borderRadius: 16, borderWidth: 1, padding: 14, gap: 12 },
  materialRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  materialIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
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
  categoryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
    width: "47%",
  },
  categoryLabel: { fontSize: 14, fontWeight: "500" },
  colorGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  colorItem: { alignItems: "center", gap: 4, width: 52 },
  colorSwatch: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  colorLabel: { fontSize: 10, fontWeight: "500", textAlign: "center" },
  seasonsRow: { flexDirection: "row", gap: 10 },
  seasonBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
  },
  seasonLabel: { fontSize: 13, fontWeight: "600" },
  fabricRow: { flexDirection: "row", gap: 10 },
  fabricBtn: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    gap: 3,
  },
  fabricLabel: { fontSize: 14, fontWeight: "600" },
  fabricHint: { fontSize: 10, textAlign: "center" },
  priceInputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    gap: 4,
  },
  priceCurrency: { fontSize: 16, fontWeight: "600" },
  priceInput: { flex: 1, paddingVertical: 14, fontSize: 15 },
  currencyRow: { flexDirection: "row", gap: 8 },
  currencyBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
  },
  currencyBtnText: { fontSize: 12, fontWeight: "700" },

  pickerOverlay: {
    flex: 1,
    backgroundColor: "rgba(28,21,18,0.5)",
    justifyContent: "flex-end",
  },
  pickerSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: "88%",
    paddingTop: 12,
  },
  pickerHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 16,
  },
  pickerHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 20,
    marginBottom: 16,
    gap: 12,
  },
  pickerTitle: { fontSize: 20, fontWeight: "700" },
  pickerSubtitle: { fontSize: 13, marginTop: 3 },
  pickerImageRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    marginBottom: 14,
  },
  pickerThumb: {
    width: 64,
    height: 64,
    borderRadius: 14,
    borderWidth: 1,
  },
  pickerImageNote: { fontSize: 12, lineHeight: 17 },
  pickerToggleAll: { fontSize: 13, fontWeight: "600", marginTop: 6 },
  pickerList: {
    paddingHorizontal: 20,
    maxHeight: 340,
  },
  pickerItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 18,
    borderWidth: 1,
    padding: 12,
    marginBottom: 10,
  },
  pickerItemColor: {
    width: 76,
    height: 88,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    flexShrink: 0,
  },
  pickerItemImage: { width: "100%", height: "100%" },
  pickerItemName: { fontSize: 15, fontWeight: "700", lineHeight: 20 },
  pickerItemMeta: { flexDirection: "row", alignItems: "center", gap: 6 },
  pickerLegacyMeta: { display: "none" },
  pickerItemCat: { fontSize: 10, fontWeight: "800", letterSpacing: 1.1 },
  pickerCatalogMeta: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: 8, rowGap: 3 },
  pickerCatalogMetaGroup: { flexDirection: "row", alignItems: "center", gap: 4 },
  pickerColorDot: { width: 8, height: 8, borderRadius: 4, borderWidth: 0.5, borderColor: "rgba(0,0,0,0.16)" },
  pickerCatalogMetaText: { fontSize: 11, fontWeight: "500" },
  pickerItemDot: { fontSize: 11 },
  pickerItemMatl: { fontSize: 11, flex: 1 },
  pickerItemHint: { fontSize: 10, fontStyle: "italic" },
  pickerItemTags: { flexDirection: "row", flexWrap: "wrap", gap: 5 },
  pickerTag: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 100 },
  pickerTagText: { fontSize: 10, fontWeight: "500" },
  dupeBadge: { flexDirection: "row", alignItems: "flex-start", gap: 6, padding: 8, borderRadius: 8, borderWidth: 1 },
  dupeBadgeTitle: { fontSize: 11, fontWeight: "700", marginBottom: 1 },
  dupeBadgeDesc: { fontSize: 11, fontWeight: "400", lineHeight: 15 },
  pickerCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  pickerCheckmark: { fontSize: 14, fontWeight: "800", lineHeight: 17 },
  pickerFooter: {
    paddingHorizontal: 20,
    paddingTop: 14,
    gap: 10,
  },
  pickerFillBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1,
  },
  pickerFillBtnText: { fontSize: 14, fontWeight: "600" },
  pickerAddBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 15,
    borderRadius: 14,
  },
  pickerAddBtnText: { fontSize: 15, fontWeight: "700" },
});
