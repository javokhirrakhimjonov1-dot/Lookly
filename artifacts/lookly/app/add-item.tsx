import { Feather } from "@/components/FeatherIcon";
import { ClothingCategoryIcon } from "@/components/ClothingCategoryIcon";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
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
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
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
  type ClothingVisualSignature,
  type Currency,
  type FabricWeight,
  type Season,
  useWardrobe,
} from "@/contexts/WardrobeContext";
import { useUserProfile } from "@/contexts/UserProfileContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { getProfileCategoryOptions } from "@/lib/profileCategories";
import { getGarmentTone } from "@/lib/garmentTone";
import {
  groupDetectionsByPhoto,
  type PhotoDetectionReview,
} from "@/lib/photoDetectionReview";
import {
  defaultDuplicateSelection,
  isHighConfidenceMetadataDuplicate,
  isNearIdenticalDescriptionDuplicate,
  shortlistDuplicateCandidates,
  type DuplicateComparable,
} from "@/lib/duplicateDetection";

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

function formatPriceInput(value: string, currency: Currency): string {
  if (currency === "USD") {
    const normalized = value.replace(/[^\d.]/g, "");
    const [whole = "", ...decimalParts] = normalized.split(".");
    const groupedWhole = whole.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    return decimalParts.length ? `${groupedWhole}.${decimalParts.join("").slice(0, 2)}` : groupedWhole;
  }

  // Sum and roubles are usually whole amounts. Group the thousands as the
  // person types so 102000 becomes the much clearer 102 000.
  const digits = value.replace(/\D/g, "");
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function priceNumber(value: string): number {
  return Number.parseFloat(value.replace(/\s/g, "").replace(/,/g, ""));
}

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

export interface DetectedItem {
  name: string;
  localizedNames?: Partial<Record<"en" | "ru" | "uz", string>>;
  category: ClothingCategory;
  colorName: string;
  colorHex: string;
  material: string;
  fabricWeight: FabricWeight;
  seasons: Season[];
  tags: string[];
  locationHint: string;
  brandLogo?: BrandLogo | null;
  visualSignature?: ClothingVisualSignature;
  _photoUri?: string;
  _photoBase64?: string;
  _photoMime?: string;
  _photoIndex?: number;
  _photoTotal?: number;
  _extractedUri?: string;
  _imageProcessingVersion?: number;
  _isDuplicate?: boolean;
  _duplicateOf?: {
    id: string;
    name: string;
    color: string;
    category: string;
    fabricWeight: string;
    imageUri?: string;
    confidence: number;
    source: "wardrobe" | "batch";
  };
}

type ManualPhoto = {
  uri: string;
  base64: string;
  mimeType: string;
};

/** Vision models often label the left and right sides of one pair separately.
 * Keep the pair as one wardrobe item, while preserving the useful shoe details. */
function mergeDetectedShoePairs(items: DetectedItem[]): DetectedItem[] {
  const merged: DetectedItem[] = [];
  const used = new Set<number>();
  const isSide = (item: DetectedItem) => /\b(left|right)\s+shoe\b/i.test(item.locationHint ?? "");

  items.forEach((item, index) => {
    if (used.has(index)) return;
    const pairIndex = items.findIndex((candidate, candidateIndex) =>
      candidateIndex > index
      && !used.has(candidateIndex)
      && item.category === "shoes"
      && candidate.category === "shoes"
      && item.name.trim().toLowerCase() === candidate.name.trim().toLowerCase()
      && item.colorName.trim().toLowerCase() === candidate.colorName.trim().toLowerCase()
      && isSide(item)
      && isSide(candidate)
    );
    if (pairIndex >= 0) {
      const pair = items[pairIndex]!;
      used.add(pairIndex);
      merged.push({
        ...item,
        locationHint: "pair of shoes",
        tags: [...new Set([...item.tags, ...pair.tags, "pair"])],
      });
    } else {
      merged.push(item);
    }
  });
  return merged;
}

async function scanClothingItems(base64: string, mimeType: string): Promise<DetectedItem[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);
  try {
    const res = await fetch(`${API_BASE}/identify-clothing`, {
      method: "POST",
      headers: await apiAuthHeaders(),
      body: JSON.stringify({ image: base64, mimeType }),
      signal: controller.signal,
    });
    const data = await res.json().catch(() => ({})) as { items?: unknown; error?: string };
    if (!res.ok) {
      throw new Error(data.error || `Photo identification failed (${res.status}).`);
    }
    if (!Array.isArray(data.items)) {
      throw new Error("Photo identification returned an invalid response. Please try again.");
    }
    return data.items as DetectedItem[];
  } catch (error: unknown) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Photo identification took too long. Please try again.");
    }
    if (error instanceof TypeError || (error instanceof Error && /load failed|failed to fetch|network request failed/i.test(error.message))) {
      throw new Error("Lookly could not reach the photo analysis server. Refresh this page, confirm your phone is on the same Wi-Fi, and try again.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

type DuplicateSource = DuplicateComparable & {
  id: string;
  imageUri?: string;
  imageBase64?: string;
  imageMime?: string;
  source: "wardrobe" | "batch";
};

function detectedComparable(item: DetectedItem): DuplicateComparable {
  return {
    name: item.name,
    category: item.category,
    color: item.colorName,
    colorHex: item.colorHex,
    fabricWeight: item.fabricWeight,
    tags: item.tags,
    visualSignature: item.visualSignature,
  };
}

function wardrobeDuplicateSource(item: ClothingItem): DuplicateSource {
  return {
    id: item.id,
    name: item.name,
    category: item.category,
    color: item.color,
    colorHex: item.colorHex,
    fabricWeight: item.fabricWeight,
    tags: item.tags,
    visualSignature: item.visualSignature,
    imageUri: item.imageUri,
    source: "wardrobe",
  };
}

function batchDuplicateSource(item: DetectedItem, index: number): DuplicateSource {
  return {
    id: `batch-${index}`,
    name: item.name,
    category: item.category,
    color: item.colorName,
    colorHex: item.colorHex,
    fabricWeight: item.fabricWeight,
    tags: item.tags,
    visualSignature: item.visualSignature,
    imageUri: item._photoUri,
    imageBase64: item._photoBase64,
    imageMime: item._photoMime,
    source: "batch",
  };
}

async function imageUriToBase64(uri: string): Promise<{ imageBase64: string; mimeType: string } | null> {
  if (uri.startsWith("data:")) {
    const match = uri.match(/^data:([^;,]+)[;,]/i);
    const imageBase64 = uri.split(",")[1] ?? "";
    return imageBase64 ? { imageBase64, mimeType: match?.[1] ?? "image/jpeg" } : null;
  }
  try {
    const response = await fetch(uri, { signal: AbortSignal.timeout(10_000) });
    if (!response.ok) return null;
    const bytes = new Uint8Array(await response.arrayBuffer());
    let binary = "";
    for (let index = 0; index < bytes.length; index += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
    }
    return {
      imageBase64: globalThis.btoa(binary),
      mimeType: response.headers.get("content-type")?.split(";")[0] ?? "image/jpeg",
    };
  } catch {
    return null;
  }
}

function duplicateDetails(source: DuplicateSource, confidence: number): NonNullable<DetectedItem["_duplicateOf"]> {
  return {
    id: source.id,
    name: source.name,
    color: source.color,
    category: source.category,
    fabricWeight: source.fabricWeight ?? "medium",
    imageUri: source.imageUri,
    confidence,
    source: source.source,
  };
}

interface CleanProductImage {
  uri: string;
  imageProcessingVersion: number;
  backgroundRemoved: boolean;
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
  locationHint?: string,
  tags?: string[],
): Promise<CleanProductImage | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 180_000);
  try {
    const res = await fetch(`${API_BASE}/remove-bg`, {
      method: "POST",
      headers: await apiAuthHeaders(),
      signal: controller.signal,
      body: JSON.stringify({
        itemName,
        category,
        colorName,
        colorHex,
        material,
        brandLogo: brandLogo ?? undefined,
        photoBase64,
        mimeType: photoMimeType,
        locationHint,
        tags,
      }),
    });
    const data = await res.json().catch(() => ({})) as {
      image?: string;
      url?: string;
      studioGenerated?: boolean;
      backgroundRemoved?: boolean;
      imageProcessingVersion?: number;
      error?: string;
    };
    if (!res.ok) {
      throw new Error(data.error || `Premium image generation failed (${res.status}).`);
    }
    // A local segmenter can return the person from a mirror photo. Only a
    // confirmed Gemini studio result is safe to show as a product image.
    if (!data.studioGenerated) {
      throw new Error(data.error || "Gemini did not return a clean product image.");
    }
    let uri: string | null = null;
    if (data.url) {
      // Uploaded images are served from /uploads, outside the /api router.
      uri = `${API_BASE.replace(/\/api$/, "")}${data.url}`;
    }
    if (!uri && data.image) uri = `data:image/png;base64,${data.image}`;
    return uri ? {
      uri,
      // A confirmed studio result is already a safe isolated catalog asset,
      // even when the final transparent-background pass falls back to the
      // studio's clean off-white square.
      imageProcessingVersion: Math.max(data.imageProcessingVersion ?? 0, 1),
      backgroundRemoved: data.backgroundRemoved === true,
    } : null;
  } catch (error: unknown) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Premium product image took too long. Please try again.");
    }
    throw error instanceof Error ? error : new Error("Premium image generation failed.");
  } finally {
    clearTimeout(timeout);
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

async function compressWebFileForUpload(file: File): Promise<{ uri: string; base64: string; mimeType: string }> {
  const decodeTimeout = () => new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("Image decode timed out")), 12_000)
  );
  let source: CanvasImageSource;
  let width: number;
  let height: number;
  let cleanup = () => {};

  try {
    if (typeof createImageBitmap !== "function") throw new Error("ImageBitmap is unavailable");
    const bitmap = await Promise.race([createImageBitmap(file), decodeTimeout()]);
    source = bitmap;
    width = bitmap.width;
    height = bitmap.height;
    cleanup = () => bitmap.close();
  } catch {
    // iPhone Safari can expose createImageBitmap but still reject photos from
    // the camera roll. Its normal <img> decoder handles many of those JPEG/
    // HEIC variants, so use it before falling back to the full-size original.
    const objectUrl = URL.createObjectURL(file);
    const imageElement = document.createElement("img");
    cleanup = () => URL.revokeObjectURL(objectUrl);
    try {
      await Promise.race([
        new Promise<void>((resolve, reject) => {
          imageElement.onload = () => resolve();
          imageElement.onerror = () => reject(new Error("Browser could not decode this photo"));
          imageElement.src = objectUrl;
        }),
        decodeTimeout(),
      ]);
      source = imageElement;
      width = imageElement.naturalWidth;
      height = imageElement.naturalHeight;
    } catch (error) {
      cleanup();
      throw error;
    }
  }

  try {
    const maxDimension = 1280;
    const scale = Math.min(1, maxDimension / Math.max(width, height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Image canvas is unavailable");
    context.drawImage(source, 0, 0, canvas.width, canvas.height);
    const uri = canvas.toDataURL("image/jpeg", 0.72);
    const base64 = uri.split(",")[1] ?? "";
    if (!base64) throw new Error("Browser returned an empty photo");
    return { uri, base64, mimeType: "image/jpeg" };
  } finally {
    cleanup();
  }
}

async function compressAssetForUpload(asset: ImagePicker.ImagePickerAsset): Promise<{ uri: string; base64: string; mimeType: string }> {
  // Browser photo libraries can return full-resolution files whose base64 form
  // exceeds the API body limit. Resize browser-readable images before sending
  // them to identification, with a short timeout for Safari/HEIC.
  if (Platform.OS === "web" && asset.base64) {
    const file = asset.file;
    if (file && typeof document !== "undefined") {
      try {
        return await compressWebFileForUpload(file);
      } catch {
        // HEIC decoding varies by browser. A reasonably sized original can
        // still be accepted by Gemini, so retain the safe fallback below.
      }
    }
    if (asset.base64.length > 18_000_000) {
      throw new Error("This photo is too large to analyze. Please choose a smaller image or a JPEG screenshot.");
    }
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
  hasNextPhoto: boolean;
  onSelectOne: (item: DetectedItem) => void;
  onAddAll: (items: DetectedItem[]) => void;
  onDismiss: () => void;
}

function ItemPicker({ visible, items, imageUri, hasNextPhoto, onSelectOne, onAddAll, onDismiss }: ItemPickerProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<Set<number>>(() => defaultDuplicateSelection(items));

  // The sheet stays mounted between scans. Reset every new batch so an old
  // selection never hides items from the next multi-photo upload.
  useEffect(() => {
    if (visible) setSelected(defaultDuplicateSelection(items));
  }, [items, visible]);

  const photoCount = Math.max(1, ...items.map((item) => item._photoTotal ?? 1));
  const photoNumber = Math.min(photoCount, (items[0]?._photoIndex ?? 0) + 1);
  const newItemCount = items.filter((item) => !item._isDuplicate).length;

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
              {photoCount > 1 ? (
                <Text style={[styles.pickerSubtitle, { color: colors.mutedForeground }]}>
                  Photo {photoNumber} of {photoCount}
                </Text>
              ) : null}
              <Text style={[styles.pickerSubtitle, { color: colors.mutedForeground }]}>
                {items.filter((i) => i._isDuplicate).length > 0
                  ? `${items.filter((i) => i._isDuplicate).length} possible duplicate${items.filter((i) => i._isDuplicate).length === 1 ? "" : "s"} · deselected`
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
                disabled={selected.size === 0 && newItemCount === 0}
                onPress={() =>
                  setSelected(
                    selected.size > 0
                      ? new Set()
                      : defaultDuplicateSelection(items)
                  )
                }
              >
                <Text style={[styles.pickerToggleAll, { color: colors.accent }]}>
                  {selected.size > 0 ? "Deselect all" : newItemCount > 0 ? "Select all new items" : "No new items to select"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView style={styles.pickerList} showsVerticalScrollIndicator={false}>
            {items.map((item, idx) => {
              const isSelected = selected.has(idx);
              const color = resolveColor(item.colorName, item.colorHex);
              const tone = getGarmentTone(color.hex, colors.border);
              return (
                <TouchableOpacity
                  key={idx}
                  onPress={() => toggleSelect(idx)}
                  style={[
                    styles.pickerItem,
                    {
                      backgroundColor: tone.background,
                      borderColor: tone.border,
                      opacity: isSelected ? 1 : 0.72,
                    },
                  ]}
                >
                  <View style={[styles.pickerItemColor, { backgroundColor: tone.background }]}>
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
                        {item._duplicateOf.imageUri ? (
                          <Image source={{ uri: item._duplicateOf.imageUri }} style={[styles.dupeImage, { backgroundColor: tone.background, borderColor: tone.border }]} contentFit="contain" />
                        ) : (
                          <Feather name="alert-circle" size={15} color="#D97706" />
                        )}
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.dupeBadgeTitle, { color: "#92400E" }]}>
                            Possible duplicate
                          </Text>
                          <Text style={[styles.dupeBadgeDesc, { color: "#78350F" }]} numberOfLines={2}>
                            Looks like {item._duplicateOf.name} already {item._duplicateOf.source === "wardrobe" ? "exists in your wardrobe" : "appears in this batch"}.
                          </Text>
                          <TouchableOpacity
                            onPress={(event) => {
                              event.stopPropagation();
                              if (!isSelected) toggleSelect(idx);
                            }}
                            disabled={isSelected}
                          >
                            <Text style={[styles.dupeAction, { color: isSelected ? "#78716C" : "#B45309" }]}>
                              {isSelected ? "Will be added as a different item" : "Add anyway — this is a different item"}
                            </Text>
                          </TouchableOpacity>
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
                        <View key={t} style={[styles.pickerTag, { backgroundColor: tone.stronger }]}>
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
                  : hasNextPhoto
                    ? `Add ${selectedItems.length} item${selectedItems.length > 1 ? "s" : ""} & review next photo`
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
  const { preferredCurrency, gender } = useUserProfile();
  const { t, lang } = useLanguage();
  const visibleCategories = getProfileCategoryOptions(gender, lang, t);

  const [name, setName] = useState("");
  const [localizedNames, setLocalizedNames] = useState<DetectedItem["localizedNames"]>();
  const [category, setCategory] = useState<ClothingCategory | null>(null);
  const [selectedColor, setSelectedColor] = useState<{ name: string; hex: string } | null>(null);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [fabricWeight, setFabricWeight] = useState<FabricWeight>("medium");
  const [isWorkwear, setIsWorkwear] = useState(false);
  const [purchasePrice, setPurchasePrice] = useState("");
  const [purchaseCurrency, setPurchaseCurrency] = useState<Currency>(preferredCurrency);
  const [isPriceFocused, setIsPriceFocused] = useState(false);
  const [material, setMaterial] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [footwearType, setFootwearType] = useState<"open-toe" | "closed-toe" | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [brandLogo, setBrandLogo] = useState<BrandLogo | null>(null);
  const [visualSignature, setVisualSignature] = useState<ClothingVisualSignature | undefined>();
  const [scannedImage, setScannedImage] = useState<string | null>(null);
  const [extractedItemUri, setExtractedItemUri] = useState<string | null>(null);
  const [compressedPhotoUri, setCompressedPhotoUri] = useState<string | null>(null);
  const [scanPhotoBase64, setScanPhotoBase64] = useState<string | null>(null);
  const [scanPhotoMime, setScanPhotoMime] = useState<string>("image/jpeg");
  const [itemLocationHint, setItemLocationHint] = useState("");
  const [manualPhotoQueue, setManualPhotoQueue] = useState<ManualPhoto[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isRemovingBg, setIsRemovingBg] = useState(false);
  const [saveProgress, setSaveProgress] = useState("Saving to wardrobe...");
  const [imageExtractionError, setImageExtractionError] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanDone, setScanDone] = useState(false);
  const [scanPhotoIndex, setScanPhotoIndex] = useState(0);
  const [scanPhotoTotal, setScanPhotoTotal] = useState(0);

  const [detectedItems, setDetectedItems] = useState<DetectedItem[]>([]);
  const [detectedPhotoQueue, setDetectedPhotoQueue] = useState<PhotoDetectionReview<DetectedItem>[]>([]);
  const [reviewingDetectedItem, setReviewingDetectedItem] = useState<DetectedItem | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const scanRequestRef = useRef(0);

  const cancelUpload = () => {
    scanRequestRef.current += 1;
    setShowPicker(false);
    setDetectedItems([]);
    setDetectedPhotoQueue([]);
    setReviewingDetectedItem(null);
    setManualPhotoQueue([]);
    setScannedImage(null);
    setExtractedItemUri(null);
    setCompressedPhotoUri(null);
    setScanPhotoBase64(null);
    setItemLocationHint("");
    setImageExtractionError(null);
    setScanError(null);
    setIsScanning(false);
    setIsRemovingBg(false);
    setScanDone(false);
    setScanPhotoIndex(0);
    setScanPhotoTotal(0);
    setName("");
    setCategory(null);
    setSelectedColor(null);
    setSeasons([]);
    setMaterial("");
    setTags([]);
    setFootwearType(null);
    setBrandLogo(null);
    setVisualSignature(undefined);
    setPurchasePrice("");
  };

  const createCleanProductImage = async (item: DetectedItem): Promise<CleanProductImage> => {
    if (item._extractedUri) return {
      uri: item._extractedUri,
      imageProcessingVersion: item._imageProcessingVersion ?? 0,
      backgroundRemoved: (item._imageProcessingVersion ?? 0) >= 1,
    };
    // Never quietly store the original room/selfie photo as a wardrobe product.
    // Every detected item must retain its compressed source so the server can
    // produce one isolated catalog image for that specific item.
    if (!item._photoBase64) {
      throw new Error("The source photo is unavailable for clean product extraction. Please scan it again.");
    }
    const color = resolveColor(item.colorName, item.colorHex);
    const cleanUri = await removeBg(
      item.name, item.category, color.name, color.hex, item.material,
      item.brandLogo, item._photoBase64, item._photoMime, item.locationHint, item.tags,
    );
    if (!cleanUri) {
      throw new Error("The clean product image was not returned. Please try again.");
    }
    return cleanUri;
  };

  const createProductImageWithRetry = async (item: DetectedItem): Promise<CleanProductImage> => {
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        return await createCleanProductImage(item);
      } catch (error) {
        lastError = error;
      }
    }

    const detail = lastError instanceof Error ? lastError.message : "Premium extraction failed.";
    throw new Error(`${detail} The original photo was not added; please retry.`);
  };

  const markPossibleDuplicate = async (
    item: DetectedItem,
    earlierBatchItems: DetectedItem[] = [],
    allowVisualComparison = true,
  ): Promise<DetectedItem> => {
    const sources = [
      ...wardrobeItems.map(wardrobeDuplicateSource),
      ...earlierBatchItems.map(batchDuplicateSource),
    ];
    const shortlist = shortlistDuplicateCandidates(detectedComparable(item), sources, 3);
    if (shortlist.length === 0) return item;

    // Generated catalog art can vary slightly even for the same source item.
    // Do not let that override an effectively identical descriptive identity.
    const metadataMatch = shortlist.find((candidate) =>
      isHighConfidenceMetadataDuplicate(candidate)
      || isNearIdenticalDescriptionDuplicate(detectedComparable(item), candidate)
    );
    if (metadataMatch) {
      return {
        ...item,
        _isDuplicate: true,
        _duplicateOf: duplicateDetails(metadataMatch.item, Math.max(metadataMatch.score, 0.92)),
      };
    }

    // Visual comparison is helpful, but it is a second AI request and must
    // never hold the recognized fields hostage. Scan flows first run the
    // local metadata check, render the form, and may enrich the duplicate
    // warning in the background afterward.
    if (!allowVisualComparison) return item;

    const visualCandidates = (await Promise.all(shortlist.map(async ({ item: candidate }) => {
      const image = candidate.imageBase64
        ? { imageBase64: candidate.imageBase64, mimeType: candidate.imageMime ?? "image/jpeg" }
        : candidate.imageUri
          ? await imageUriToBase64(candidate.imageUri)
          : null;
      return image ? { candidate, ...image } : null;
    }))).filter((candidate): candidate is NonNullable<typeof candidate> => candidate !== null);

    if (item._photoBase64 && visualCandidates.length > 0) {
      try {
        const response = await fetch(`${API_BASE}/compare-clothing`, {
          method: "POST",
          headers: await apiAuthHeaders(),
          body: JSON.stringify({
            imageBase64: item._photoBase64,
            mimeType: item._photoMime ?? "image/jpeg",
            itemName: item.name,
            locationHint: item.locationHint,
            visualSignature: item.visualSignature,
            candidates: visualCandidates.map(({ candidate, imageBase64, mimeType }) => ({
              id: candidate.id,
              name: candidate.name,
              imageBase64,
              mimeType,
              visualSignature: candidate.visualSignature,
            })),
          }),
          signal: AbortSignal.timeout(30_000),
        });
        if (response.ok) {
          const result = await response.json() as {
            candidateId?: string | null;
            confidence?: number;
            sameItem?: boolean;
            contradictions?: string[];
          };
          const matched = result.sameItem && (result.confidence ?? 0) >= 0.85 && !(result.contradictions?.length)
            ? visualCandidates.find(({ candidate }) => candidate.id === result.candidateId)?.candidate
            : undefined;
          if (matched) {
            return {
              ...item,
              _isDuplicate: true,
              _duplicateOf: duplicateDetails(matched, result.confidence ?? 0.85),
            };
          }
          // A successful visual comparison that says the pieces differ takes
          // precedence over metadata similarity and prevents a false warning.
          return item;
        }
      } catch {
        // Fall through to the deliberately stricter offline metadata rule.
      }
    }

    return item;
  };

  const scanScale = useSharedValue(1);
  const scanCardOpacity = useSharedValue(0);
  const scanBeam = useSharedValue(0);
  const scanPulse = useSharedValue(0);

  const topPad = getTopPadding(insets.top);

  // A profile has one price currency. Keep a manually chosen currency until
  // the person changes it in Stats; never carry the previous item's amount.
  useEffect(() => {
    if (!purchasePrice) setPurchaseCurrency(preferredCurrency);
  }, [preferredCurrency, purchasePrice]);

  const scanAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scanScale.value }],
  }));
  const scanCardStyle = useAnimatedStyle(() => ({
    opacity: scanCardOpacity.value,
  }));
  const scanBeamStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scanBeam.value, [0, 0.15, 0.85, 1], [0, 0.82, 0.82, 0]),
    transform: [{ translateY: interpolate(scanBeam.value, [0, 1], [-120, 220]) }],
  }));
  const scanPulseStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scanPulse.value, [0, 0.5, 1], [0.48, 1, 0.48]),
    transform: [{ scale: interpolate(scanPulse.value, [0, 0.5, 1], [0.92, 1.08, 0.92]) }],
  }));

  // Keep the AI feedback lively without delaying either the scan or the
  // background-removal request. The loop stops as soon as work is complete.
  useEffect(() => {
    if (!isScanning && !isRemovingBg) {
      cancelAnimation(scanBeam);
      cancelAnimation(scanPulse);
      scanBeam.value = 0;
      scanPulse.value = 0;
      return;
    }

    scanBeam.value = 0;
    scanPulse.value = 0;
    scanBeam.value = withRepeat(withTiming(1, { duration: isScanning ? 1450 : 1850 }), -1, false);
    scanPulse.value = withRepeat(withTiming(1, { duration: 950 }), -1, true);

    return () => {
      cancelAnimation(scanBeam);
      cancelAnimation(scanPulse);
    };
  }, [isScanning, isRemovingBg, scanBeam, scanPulse]);

  const toggleSeason = (s: Season) => {
    setSeasons((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  };

  const applyDetectedItem = (item: DetectedItem) => {
    const color = resolveColor(item.colorName, item.colorHex);
    setName(item.name);
    setLocalizedNames(item.localizedNames);
    setCategory(item.category);
    setSelectedColor(color);
    setSeasons(item.seasons.filter((s): s is Season => ["spring", "summer", "fall", "winter"].includes(s)));
    setMaterial(item.material);
    setFabricWeight(item.fabricWeight ?? "medium");
    setTags(item.tags);
    setFootwearType(
      item.visualSignature?.toeStyle === "open" || item.tags.some((tag) => tag.toLowerCase() === "open-toe")
        ? "open-toe"
        : item.visualSignature?.toeStyle === "closed" || item.tags.some((tag) => tag.toLowerCase() === "closed-toe")
          ? "closed-toe"
          : null
    );
    setBrandLogo(item.brandLogo ?? null);
    setVisualSignature(item.visualSignature);
    setItemLocationHint(item.locationHint ?? "");
    if (item._photoBase64) setScanPhotoBase64(item._photoBase64);
    if (item._photoMime) setScanPhotoMime(item._photoMime);
    if (item._photoUri) {
      setCompressedPhotoUri(item._photoUri);
      setScannedImage(item._extractedUri ?? item._photoUri);
    }
    setExtractedItemUri(item._extractedUri ?? null);
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
    setItemLocationHint("");
    setDetectedItems([]);
    setDetectedPhotoQueue([]);
    setReviewingDetectedItem(null);
    setName("");
    setCategory(null);
    setSelectedColor(null);
    setSeasons([]);
    setMaterial("");
    setPurchasePrice("");
    setTags([]);
    setBrandLogo(null);
    setVisualSignature(undefined);
    setScanDone(true);
    setIsScanning(false);
  };

  const handlePickerSelectOne = (item: DetectedItem) => {
    setShowPicker(false);
    setReviewingDetectedItem(item);
    applyDetectedItem(item);
  };

  const continueToNextDetectedPhoto = () => {
    const [nextPhoto, ...remainingPhotos] = detectedPhotoQueue;
    if (!nextPhoto) return false;

    setDetectedPhotoQueue(remainingPhotos);
    setDetectedItems(nextPhoto.items);
    setReviewingDetectedItem(null);
    setScannedImage(nextPhoto.imageUri);
    setCompressedPhotoUri(nextPhoto.imageUri);
    setImageExtractionError(null);
    setShowPicker(true);
    return true;
  };

  const handlePickerAddAll = async (items: DetectedItem[]) => {
    // Prevent a second tap from starting a competing save while the first
    // extraction is still running. Competing requests used to make the picker
    // appear again on mobile, which felt like an endless selection loop.
    if (items.length === 0 || isSaving) return;
    setShowPicker(false);
    setIsSaving(true);
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const preparedItems: Array<Omit<ClothingItem, "id" | "createdAt" | "timesWorn">> = [];
      for (const [index, item] of items.entries()) {
        setSaveProgress(`Preparing clean product image ${index + 1} of ${items.length}...`);
        const cleanImage = await createProductImageWithRetry(item);
        const color = resolveColor(item.colorName, item.colorHex);
        preparedItems.push({
          name: item.name,
          localizedNames: item.localizedNames,
          category: item.category,
          color: color.name,
          colorHex: color.hex,
          seasons: item.seasons.filter((s): s is Season =>
            ["spring", "summer", "fall", "winter"].includes(s)
          ),
          fabricWeight: item.fabricWeight ?? "medium",
          isWorkwear: false,
          tags: item.tags.length > 0 ? item.tags : [item.category],
          imageUri: cleanImage.uri,
          imageProcessingVersion: cleanImage.imageProcessingVersion,
          brandLogo: item.brandLogo ?? undefined,
          visualSignature: item.visualSignature,
        });
      }
      setSaveProgress("Saving clean items to your wardrobe...");
      const savedItems = await addBulkItems(preparedItems);
      if (savedItems.length !== preparedItems.length) {
        setShowPicker(true);
        return;
      }
      if (continueToNextDetectedPhoto()) return;
      // Clear the completed scan before leaving. This also prevents a stale
      // picker from being restored if navigation is briefly delayed on mobile.
      setDetectedItems([]);
      setDetectedPhotoQueue([]);
      setScanDone(false);
      leaveAddItem();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Please try again.";
      setImageExtractionError(message);
      Alert.alert(
        "Items could not be saved",
        `${message}\n\nNothing was added. Your selections are still available to retry.`
      );
    } finally {
      setIsSaving(false);
      setSaveProgress("Saving to wardrobe...");
    }
  };

  const handlePickerDismiss = () => {
    setShowPicker(false);
    if (detectedItems.length === 1 && detectedItems[0]) {
      setReviewingDetectedItem(detectedItems[0]);
      applyDetectedItem(detectedItems[0]);
    }
  };

  const leaveAddItem = () => {
    router.replace("/(tabs)/wardrobe");
  };

  const runScan = async (base64: string, mimeType: string, localUri?: string) => {
    const scanRequest = ++scanRequestRef.current;
    const photoRef = localUri ?? `data:${mimeType};base64,${base64}`;
    setDetectedPhotoQueue([]);
    setReviewingDetectedItem(null);
    setScannedImage(photoRef);
    setExtractedItemUri(null);
    setCompressedPhotoUri(localUri ?? null);
    setScanPhotoBase64(base64);
    setScanPhotoMime(mimeType);
    setIsScanning(true);
    setIsRemovingBg(false);
    setImageExtractionError(null);
    setScanError(null);
    setScanDone(false);
    scanScale.value = withSpring(0.97, { damping: 12 }, () => {
      scanScale.value = withSpring(1);
    });

    try {
      // ── Phase 1 (BLOCKING): identify items ──
      const items = mergeDetectedShoePairs(await scanClothingItems(base64, mimeType));
      if (scanRequest !== scanRequestRef.current) return;

      if (items.length === 0) {
        setScanError("No fully visible clothing item was detected. Try a clearer photo, or enter the details manually.");
        // AI unavailable — keep photo, let user fill in manually
        setScanDone(true);
        return;
      }

      const taggedItems: DetectedItem[] = [];
      for (const item of items) {
        const tagged = {
          ...item,
          _photoUri: photoRef,
          _photoBase64: base64,
          _photoMime: mimeType,
          _photoIndex: 0,
          _photoTotal: 1,
        };
        taggedItems.push(await markPossibleDuplicate(tagged, taggedItems, false));
      }
      if (scanRequest !== scanRequestRef.current) return;
      setDetectedItems(taggedItems);
      setIsScanning(false);
      setScanDone(true);

      // ── Phase 2 (NON-BLOCKING): show form/picker immediately, BG removal in background ──
      if (taggedItems.length === 1) {
        setReviewingDetectedItem(taggedItems[0]!);
        applyDetectedItem(taggedItems[0]!);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setShowPicker(true);
      }

      // Duplicate comparison is deliberately non-blocking. Identification
      // has already populated the form/picker; a slower comparison may only
      // add a warning and cannot leave the scan spinner running.
      void Promise.all(taggedItems.map((item, index) =>
        item._isDuplicate
          ? Promise.resolve(item)
          : markPossibleDuplicate(item, taggedItems.slice(0, index), true)
      )).then((reviewedItems) => {
        if (scanRequest !== scanRequestRef.current) return;
        setDetectedItems(reviewedItems);
        if (reviewedItems.length === 1 && reviewedItems[0]) {
          setReviewingDetectedItem(reviewedItems[0]);
        }
      }).catch(() => {
        // Autofill is already complete; duplicate review is best-effort.
      });

      // Fire BG removal — UI is already unblocked, image swaps silently when ready
      // Background work is deferred until the customer saves an item.
      /*
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
          }).catch((error: unknown) => {
            const message = error instanceof Error ? error.message : "Premium image generation failed.";
            setImageExtractionError(message);
          });
        })
      ).then(() => setIsRemovingBg(false));
      */

    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "The photo could not be analyzed.";
      setScanError(message);
      Alert.alert("Could not scan photo", message);
      // AI unavailable — keep the photo, let user fill in details manually
      setScanDone(true);
    } finally {
      if (scanRequest === scanRequestRef.current) setIsScanning(false);
    }
  };

  const handleScanPhoto = async (providedAssets?: ImagePicker.ImagePickerAsset[]) => {
    const scanRequest = ++scanRequestRef.current;
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
      try {
        const compressed = await compressAssetForUpload(asset);
        await runScan(compressed.base64, compressed.mimeType, compressed.uri);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "This photo could not be analyzed.";
        setScanError(message);
        Alert.alert("Could not scan photo", message);
      }
      return;
    }

    setIsScanning(true);
    setDetectedPhotoQueue([]);
    setReviewingDetectedItem(null);
    setScanDone(false);
    setScanError(null);
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
        const found = mergeDetectedShoePairs(await scanClothingItems(compressed.base64, compressed.mimeType));
        if (scanRequest !== scanRequestRef.current) return;
        for (const item of found) {
          // Do not discard items merely because they look similar to something
          // in another selected photo. The user must be able to see and decide
          // on every item found across the complete upload batch.
          const taggedItem: DetectedItem = {
            ...item,
            // Use the processed URI that was actually sent to AI. iPhone
            // picker URIs can expire after another selected photo is opened.
            _photoUri: compressed.uri,
            _photoBase64: compressed.base64,
            _photoMime: compressed.mimeType,
            _photoIndex: idx,
            _photoTotal: assets.length,
          };
          allItems.push(await markPossibleDuplicate(taggedItem, allItems, false));
        }
      } catch {
        failedPhotos += 1;
      }
    }
    if (scanRequest !== scanRequestRef.current) return;
    setIsScanning(false);
    setScanPhotoTotal(0);

    if (allItems.length === 0) {
      setScanError("AI identification is unavailable. You can still enter this photo's details manually.");
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

    const [firstReview, ...remainingReviews] = groupDetectionsByPhoto(allItems, firstAsset.uri);
    if (!firstReview) return;
    setDetectedItems(firstReview.items);
    setDetectedPhotoQueue(remainingReviews);
    setScannedImage(firstReview.imageUri);
    setCompressedPhotoUri(firstReview.imageUri);
    setScanDone(true);

    if (failedPhotos > 0) {
      Alert.alert(
        "Some photos could not be scanned",
        `${allItems.length} item${allItems.length === 1 ? " was" : "s were"} found from the other selected photo${failedPhotos === 1 ? "" : "s"}.`
      );
    }

    // ── Show picker immediately (non-blocking) ──
    // Always show the batch selector. Even when one photo yields one item,
    // this proves every selected image was processed instead of silently
    // opening the first result and making later photos feel lost.
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowPicker(true);

    // ── BG removal runs in background, updates cards silently ──
    // Background work is deferred until the customer saves an item.
    /*
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
          }).catch((error: unknown) => {
            const message = error instanceof Error ? error.message : "Premium image generation failed.";
            setImageExtractionError(message);
          });
      })
    ).then(() => setIsRemovingBg(false));
    */
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

  const tagsForSave = () => {
    const withoutFootwearType = tags.filter(
      (tag) => tag.toLowerCase() !== "open-toe" && tag.toLowerCase() !== "closed-toe"
    );
    if (category === "shoes" && footwearType) return [...withoutFootwearType, footwearType];
    return withoutFootwearType.length > 0 ? withoutFootwearType : [category ?? "tops"];
  };

  const handleSave = async () => {
    if (!canSave || !category || !selectedColor) return;
    setIsSaving(true);
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const price = priceNumber(purchasePrice);
      let imageUri = extractedItemUri ?? compressedPhotoUri ?? scannedImage ?? undefined;
      let imageProcessingVersion = 0;
      if (!extractedItemUri && (compressedPhotoUri || scannedImage)) {
        if (!scanPhotoBase64) {
          throw new Error("The source photo is unavailable for clean product extraction. Please scan it again.");
        }
        setSaveProgress("Creating your clean product image...");
        const cleanImage = await createProductImageWithRetry({
          name: name.trim(), category, colorName: selectedColor.name,
          colorHex: selectedColor.hex, material, fabricWeight, seasons,
          tags: tagsForSave(), brandLogo, locationHint: itemLocationHint,
          _photoBase64: scanPhotoBase64, _photoMime: scanPhotoMime,
          _photoUri: compressedPhotoUri ?? scannedImage ?? undefined,
        });
        imageUri = cleanImage.uri;
        imageProcessingVersion = cleanImage.imageProcessingVersion;
      }
      setSaveProgress("Saving to wardrobe...");
      const savedItem = await addItem({
        name: name.trim(), localizedNames, category, color: selectedColor.name, colorHex: selectedColor.hex,
        seasons, fabricWeight, isWorkwear,
        purchasePrice: !isNaN(price) && price > 0 ? price : undefined,
        purchaseCurrency: !isNaN(price) && price > 0 ? purchaseCurrency : undefined,
        tags: tagsForSave(),
        imageUri,
        imageProcessingVersion,
        brandLogo: brandLogo ?? undefined,
        visualSignature,
      });
      if (!savedItem) return;
      if (reviewingDetectedItem) {
        setReviewingDetectedItem(null);
        if (continueToNextDetectedPhoto()) return;
      }
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
      Alert.alert("Could not create clean product image", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setIsRemovingBg(false);
      setIsSaving(false);
      setSaveProgress("Saving to wardrobe...");
    }
  };

  if (isSaving && !showPicker) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background, alignItems: "center", justifyContent: "center", gap: 16 }]}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={[styles.savingText, { color: colors.mutedForeground }]}>{saveProgress}</Text>
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
          hasNextPhoto={detectedPhotoQueue.length > 0}
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
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>{t("add_item")}</Text>
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
          <Text style={[styles.scanTitle, { color: colors.foreground }]}>{t("scan_with_ai")}</Text>
          <Text style={[styles.scanSubtitle, { color: colors.mutedForeground }]}>
            Point at one item or a full outfit flat-lay — we'll detect every piece automatically
          </Text>

          {scannedImage && (
            <View style={styles.scannedImageWrap}>
              <Image source={{ uri: scannedImage }} style={styles.scannedImage} contentFit="cover" />
              {isScanning && (
                <View style={[styles.scanOverlay, { backgroundColor: "rgba(28,21,18,0.7)" }]}>
                  <Animated.View
                    pointerEvents="none"
                    style={[styles.scanBeam, { backgroundColor: colors.accent }, scanBeamStyle]}
                  />
                  <Animated.View style={[styles.aiScanOrb, { borderColor: colors.accent }, scanPulseStyle]}>
                    <Feather name="search" size={18} color={colors.primaryForeground} />
                  </Animated.View>
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
                    <Text style={[styles.scanOverlayText, { color: colors.primaryForeground }]}>{t("detecting_items")}</Text>
                  )}
                </View>
              )}
              {isRemovingBg && !isScanning && (
                <View style={[styles.isolatingBadge, { backgroundColor: "rgba(28,21,18,0.82)" }]}>
                  <Animated.View
                    pointerEvents="none"
                    style={[styles.isolationSweep, { backgroundColor: colors.accent }, scanBeamStyle]}
                  />
                  <Animated.View style={[styles.isolatingOrb, { borderColor: colors.accent }, scanPulseStyle]}>
                    <Feather name="scissors" size={13} color={colors.primaryForeground} />
                  </Animated.View>
                  <Text style={[styles.isolatingText, { color: colors.primaryForeground }]}>{t("isolating_garment")}</Text>
                </View>
              )}
              {scanDone && !isScanning && name ? (
                <View style={[styles.scanDoneBadge, { backgroundColor: colors.accent }]}>
                  <Feather name="check" size={12} color={colors.card} />
                  <Text style={[styles.scanDoneText, { color: colors.card }]}>{t("filled_automatically")}</Text>
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

          {reviewingDetectedItem?._isDuplicate && reviewingDetectedItem._duplicateOf ? (
            <View
              accessibilityRole="alert"
              style={[styles.singleDupeWarning, { backgroundColor: "#FEF9EC", borderColor: "#FDE68A" }]}
            >
              {reviewingDetectedItem._duplicateOf.imageUri ? (
                <Image
                  source={{ uri: reviewingDetectedItem._duplicateOf.imageUri }}
                  style={[styles.singleDupeImage, { borderColor: "#FDE68A" }]}
                  contentFit="contain"
                />
              ) : (
                <View style={styles.singleDupeIcon}>
                  <Feather name="alert-circle" size={20} color="#D97706" />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={[styles.dupeBadgeTitle, { color: "#92400E", fontSize: 13 }]}>Possible duplicate</Text>
                <Text style={[styles.dupeBadgeDesc, { color: "#78350F", fontSize: 12 }]}>
                  Looks like {reviewingDetectedItem._duplicateOf.name} already {reviewingDetectedItem._duplicateOf.source === "wardrobe" ? "exists in your wardrobe" : "appears in this photo batch"}. Save only if this is a different item.
                </Text>
              </View>
            </View>
          ) : null}

          {imageExtractionError && !isRemovingBg && (
            <View style={[styles.imageGenerationError, { backgroundColor: "#FDF0EE", borderColor: "#E78A6B" }]}>
              <Feather name="alert-circle" size={15} color="#B42318" />
              <Text style={[styles.imageGenerationErrorText, { color: "#B42318" }]}>
                Product image was not created: {imageExtractionError}
              </Text>
            </View>
          )}

          {scanError && !isScanning && (
            <View style={[styles.imageGenerationError, { backgroundColor: "#FDF0EE", borderColor: "#E78A6B" }]}>
              <Feather name="alert-circle" size={15} color="#B42318" />
              <Text style={[styles.imageGenerationErrorText, { color: "#B42318" }]}>
                Autofill could not finish: {scanError}
              </Text>
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
                <Text style={[styles.scanBtnText, { color: colors.primaryForeground }]}>{t("take_photo")}</Text>
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
                <Text style={[styles.scanBtnText, { color: colors.accent }]}>{t("upload_photo")}</Text>
              </TouchableOpacity>
            )}
          </Animated.View>
          {(scannedImage || isScanning) && (
            <TouchableOpacity
              onPress={cancelUpload}
              style={[styles.cancelUploadButton, { borderColor: colors.border, backgroundColor: colors.background }]}
              accessibilityRole="button"
              accessibilityLabel="Cancel uploaded photo"
            >
              <Feather name="x" size={15} color={colors.mutedForeground} />
              <Text style={[styles.cancelUploadText, { color: colors.mutedForeground }]}>{t("cancel_upload")}</Text>
            </TouchableOpacity>
          )}
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
                <Text style={[styles.materialLabel, { color: colors.mutedForeground }]}>{t("fabric_material")}</Text>
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
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{t("item_name")}</Text>
          <Text style={[styles.sectionHint, { color: colors.mutedForeground }]}>{t("item_name_hint")}</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="e.g. White linen shirt"
            placeholderTextColor={colors.mutedForeground}
            style={[styles.input, { borderColor: name ? colors.accent : colors.border, backgroundColor: colors.card, color: colors.foreground }]}
          />
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{t("category")}</Text>
          <View style={styles.categoryGrid}>
            {visibleCategories.map((c) => (
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
                <ClothingCategoryIcon
                  category={c.key}
                  gender={gender}
                  size={22}
                  color={category === c.key ? colors.primaryForeground : colors.mutedForeground}
                />
                <Text style={[styles.categoryLabel, { color: category === c.key ? colors.primaryForeground : colors.foreground }]}>
                  {c.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {category === "shoes" && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{t("footwear_type")}</Text>
            <Text style={[styles.sectionHint, { color: colors.mutedForeground }]}>{t("footwear_hint")}</Text>
            <View style={styles.fabricRow}>
              {([
                { key: "open-toe", label: "Open-toe", hint: "sandals, slides" },
                { key: "closed-toe", label: "Closed-toe", hint: "sneakers, boots" },
              ] as const).map((type) => (
                <Pressable
                  key={type.key}
                  onPress={() => {
                    setFootwearType(type.key);
                    setVisualSignature((current) => ({
                      itemType: current?.itemType ?? "shoes",
                      shape: current?.shape ?? "regular",
                      pattern: current?.pattern ?? "solid",
                      materialFamily: current?.materialFamily ?? "unknown",
                      closures: current?.closures ?? [],
                      sleeve: current?.sleeve ?? "not-applicable",
                      collar: current?.collar ?? "not-applicable",
                      features: current?.features ?? [],
                      ...current,
                      toeStyle: type.key === "open-toe" ? "open" : "closed",
                    }));
                  }}
                  style={({ pressed }) => [
                    styles.fabricBtn,
                    {
                      backgroundColor: footwearType === type.key ? colors.primary : colors.card,
                      borderColor: footwearType === type.key ? colors.primary : colors.border,
                      opacity: pressed ? 0.8 : 1,
                    },
                  ]}
                >
                  <Text style={[styles.fabricLabel, { color: footwearType === type.key ? colors.primaryForeground : colors.foreground }]}>{type.label}</Text>
                  <Text style={[styles.fabricHint, { color: footwearType === type.key ? "rgba(250,248,245,0.7)" : colors.mutedForeground }]}>{type.hint}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {category ? (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Garment details</Text>
            <Text style={[styles.sectionHint, { color: colors.mutedForeground }]}>Correct these optional details when the AI needs help. They improve proportions, coverage, and weather matching.</Text>
            <TextInput value={visualSignature?.garmentFamily ?? visualSignature?.itemType ?? ""} onChangeText={(value) => setVisualSignature((current) => ({ itemType: current?.itemType ?? value, shape: current?.shape ?? "regular", pattern: current?.pattern ?? "solid", materialFamily: current?.materialFamily ?? "unknown", closures: current?.closures ?? [], sleeve: current?.sleeve ?? "not-applicable", collar: current?.collar ?? "not-applicable", features: current?.features ?? [], ...current, garmentFamily: value.toLowerCase() }))} placeholder="Subtype: skirt, blouse, jumpsuit, boots…" placeholderTextColor={colors.mutedForeground} style={[styles.input, { borderColor: colors.border, backgroundColor: colors.card, color: colors.foreground }]} />
            <View style={styles.fabricRow}>
              <TextInput value={visualSignature?.silhouette ?? ""} onChangeText={(value) => setVisualSignature((current) => ({ itemType: current?.itemType ?? category, shape: current?.shape ?? value, pattern: current?.pattern ?? "solid", materialFamily: current?.materialFamily ?? "unknown", closures: current?.closures ?? [], sleeve: current?.sleeve ?? "not-applicable", collar: current?.collar ?? "not-applicable", features: current?.features ?? [], ...current, silhouette: value.toLowerCase() }))} placeholder="Silhouette: A-line, fitted…" placeholderTextColor={colors.mutedForeground} style={[styles.input, { flex: 1, borderColor: colors.border, backgroundColor: colors.card, color: colors.foreground }]} />
              <TextInput value={visualSignature?.length ?? ""} onChangeText={(value) => setVisualSignature((current) => ({ itemType: current?.itemType ?? category, shape: current?.shape ?? "regular", pattern: current?.pattern ?? "solid", materialFamily: current?.materialFamily ?? "unknown", closures: current?.closures ?? [], sleeve: current?.sleeve ?? "not-applicable", collar: current?.collar ?? "not-applicable", features: current?.features ?? [], ...current, length: value.toLowerCase() }))} placeholder="Length: midi, ankle…" placeholderTextColor={colors.mutedForeground} style={[styles.input, { flex: 1, borderColor: colors.border, backgroundColor: colors.card, color: colors.foreground }]} />
            </View>
            <TextInput value={visualSignature?.coverage ?? ""} onChangeText={(value) => setVisualSignature((current) => ({ itemType: current?.itemType ?? category, shape: current?.shape ?? "regular", pattern: current?.pattern ?? "solid", materialFamily: current?.materialFamily ?? "unknown", closures: current?.closures ?? [], sleeve: current?.sleeve ?? "not-applicable", collar: current?.collar ?? "not-applicable", features: current?.features ?? [], ...current, coverage: value.toLowerCase() }))} placeholder="Coverage: standard, modest, maximum" placeholderTextColor={colors.mutedForeground} style={[styles.input, { borderColor: colors.border, backgroundColor: colors.card, color: colors.foreground }]} />
            <View style={styles.fabricRow}>
              <TextInput value={visualSignature?.sleeve ?? ""} onChangeText={(value) => setVisualSignature((current) => ({ itemType: current?.itemType ?? category, shape: current?.shape ?? "regular", pattern: current?.pattern ?? "solid", materialFamily: current?.materialFamily ?? "unknown", closures: current?.closures ?? [], collar: current?.collar ?? "not-applicable", features: current?.features ?? [], ...current, sleeve: value.toLowerCase() }))} placeholder="Sleeve: long, short…" placeholderTextColor={colors.mutedForeground} style={[styles.input, { flex: 1, borderColor: colors.border, backgroundColor: colors.card, color: colors.foreground }]} />
              <TextInput value={visualSignature?.neckline ?? ""} onChangeText={(value) => setVisualSignature((current) => ({ itemType: current?.itemType ?? category, shape: current?.shape ?? "regular", pattern: current?.pattern ?? "solid", materialFamily: current?.materialFamily ?? "unknown", closures: current?.closures ?? [], sleeve: current?.sleeve ?? "not-applicable", collar: current?.collar ?? "not-applicable", features: current?.features ?? [], ...current, neckline: value.toLowerCase() }))} placeholder="Neckline: high, crew…" placeholderTextColor={colors.mutedForeground} style={[styles.input, { flex: 1, borderColor: colors.border, backgroundColor: colors.card, color: colors.foreground }]} />
            </View>
            <TextInput value={visualSignature?.opacity ?? ""} onChangeText={(value) => setVisualSignature((current) => ({ itemType: current?.itemType ?? category, shape: current?.shape ?? "regular", pattern: current?.pattern ?? "solid", materialFamily: current?.materialFamily ?? "unknown", closures: current?.closures ?? [], sleeve: current?.sleeve ?? "not-applicable", collar: current?.collar ?? "not-applicable", features: current?.features ?? [], ...current, opacity: value.toLowerCase() }))} placeholder="Opacity: opaque, semi-sheer, sheer" placeholderTextColor={colors.mutedForeground} style={[styles.input, { borderColor: colors.border, backgroundColor: colors.card, color: colors.foreground }]} />
            {category === "shoes" ? <View style={styles.fabricRow}><TextInput value={visualSignature?.heelType ?? ""} onChangeText={(value) => setVisualSignature((current) => ({ itemType: current?.itemType ?? "shoes", shape: current?.shape ?? "regular", pattern: current?.pattern ?? "solid", materialFamily: current?.materialFamily ?? "unknown", closures: current?.closures ?? [], sleeve: "not-applicable", collar: "not-applicable", features: current?.features ?? [], ...current, heelType: value.toLowerCase() }))} placeholder="Heel: flat, block…" placeholderTextColor={colors.mutedForeground} style={[styles.input, { flex: 1, borderColor: colors.border, backgroundColor: colors.card, color: colors.foreground }]} /><TextInput value={visualSignature?.bootShaft ?? ""} onChangeText={(value) => setVisualSignature((current) => ({ itemType: current?.itemType ?? "shoes", shape: current?.shape ?? "regular", pattern: current?.pattern ?? "solid", materialFamily: current?.materialFamily ?? "unknown", closures: current?.closures ?? [], sleeve: "not-applicable", collar: "not-applicable", features: current?.features ?? [], ...current, bootShaft: value.toLowerCase() }))} placeholder="Boot shaft" placeholderTextColor={colors.mutedForeground} style={[styles.input, { flex: 1, borderColor: colors.border, backgroundColor: colors.card, color: colors.foreground }]} /></View> : null}
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{t("color")}</Text>
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
                  {t(`color_${c.name.toLowerCase()}`)}
                </Text>
              </TouchableOpacity>
            ))}
            {selectedColor && !COLOR_SWATCHES.find((c) => c.hex === selectedColor.hex) && (
              <View style={styles.colorItem}>
                <View style={[styles.colorSwatch, { backgroundColor: selectedColor.hex, borderColor: colors.accent, borderWidth: 2.5 }]}>
                  <Feather name="check" size={14} color={isLight(selectedColor.hex) ? "#1C1512" : "#FFFFFF"} />
                </View>
                <Text style={[styles.colorLabel, { color: colors.foreground }]} numberOfLines={1}>
                  {t(`color_${selectedColor.name.toLowerCase()}`)}
                </Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{t("seasons")}</Text>
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
                  {t(`season_${s}`)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{t("fabric_weight")}</Text>
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
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{t("workwear_uniform")}</Text>
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
          <Text style={[styles.currencyLocked, { color: colors.accent }]}>
            {purchaseCurrency} · Change this in Stats
          </Text>
          <View style={[styles.priceInputRow, { borderColor: purchasePrice || isPriceFocused ? colors.accent : colors.border, backgroundColor: colors.card }]}>
            <Text style={[styles.priceCurrency, { color: colors.mutedForeground }]}>
              {CURRENCIES.find((currency) => currency.key === purchaseCurrency)?.symbol}
            </Text>
            <TextInput
              value={purchasePrice}
              onChangeText={(value) => setPurchasePrice(formatPriceInput(value, purchaseCurrency))}
              onFocus={() => setIsPriceFocused(true)}
              onBlur={() => setIsPriceFocused(false)}
              placeholder={purchaseCurrency === "USD" ? "0.00" : "0"}
              placeholderTextColor={colors.mutedForeground}
              keyboardType="decimal-pad"
              style={[styles.priceInput, { color: colors.foreground }, Platform.OS === "web" ? ({ outlineStyle: "none", outlineWidth: 0 } as any) : null]}
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
  scanBeam: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 2,
    shadowColor: "#F3B079",
    shadowOpacity: 0.85,
    shadowRadius: 12,
    elevation: 4,
  },
  aiScanOrb: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(250,248,245,0.12)",
  },
  scanOverlayText: { color: "#F9F8F6", fontSize: 14, fontWeight: "600" },
  scanDots: { flexDirection: "row", gap: 7, marginTop: 4 },
  scanDot: { width: 8, height: 8, borderRadius: 4 },
  isolatingBadge: {
    position: "absolute",
    bottom: 10,
    left: 10,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 100,
  },
  isolationSweep: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    opacity: 0.8,
  },
  isolatingOrb: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(250,248,245,0.12)",
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
  imageGenerationError: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 10,
  },
  imageGenerationErrorText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
  },
  scanButtons: { flexDirection: "row", gap: 10 },
  cancelUploadButton: {
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderWidth: 1,
    borderRadius: 10,
  },
  cancelUploadText: { fontSize: 13, fontWeight: "600" },
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
  currencyLocked: { fontSize: 12, fontWeight: "700", marginTop: 3 },
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
    height: 76,
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
  dupeImage: { width: 38, height: 38, borderRadius: 7, borderWidth: 1 },
  dupeAction: { fontSize: 11, fontWeight: "700", lineHeight: 16, marginTop: 4 },
  singleDupeWarning: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 12, borderWidth: 1 },
  singleDupeImage: { width: 54, height: 54, borderRadius: 9, borderWidth: 1, backgroundColor: "#FFFFFF" },
  singleDupeIcon: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
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
