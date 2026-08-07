import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { Alert, Platform } from "react-native";
import { useAuth } from "@/contexts/AuthContext";
import type { Currency } from "@/contexts/WardrobeContext";
import { supabase } from "@/lib/supabase";
import { isSupportedAge } from "@/lib/profileRules";
import type { HijabPreference } from "@/lib/modestyRules";
import type { ShopSuggestionType } from "@/lib/shopSuggestionPreferences";
import { normalizeStylingPreferencesForGender } from "@/lib/profileStylingPreferences";

export type Gender = "male" | "female" | "non-binary" | "prefer_not_to_say";
export type StyleAesthetic = "minimalist" | "streetwear" | "smart_casual" | "boho" | "classic" | "sporty";
export type HeatAdaptation = "light_linen" | "shorts_casual" | "sport_active" | "cotton_denim";
export type ColorPalette = "earthy_neutrals" | "monochrome" | "vivid_colors" | "pastels" | "desert_sand";
export type CoveragePreference = "no_preference" | "modest" | "maximum_coverage";
export type SilhouettePreference = "balanced" | "fitted" | "relaxed";
export type HeelPreference = "flats" | "low_heels" | "any";
export interface StylingPreferences {
  coverage: CoveragePreference;
  silhouette: SilhouettePreference;
  heels: HeelPreference;
  hijabPreference: HijabPreference;
  excludedShopTypes: ShopSuggestionType[];
}
export interface BodyPhotoSelection {
  uri: string;
  base64: string;
  mime: string;
}
export const DEFAULT_STYLING_PREFERENCES: StylingPreferences = {
  coverage: "no_preference",
  silhouette: "balanced",
  heels: "any",
  hijabPreference: null,
  excludedShopTypes: [],
};

interface UserProfile {
  fullName: string;
  gender: Gender | null;
  age: number | null;
  bodyPhotoUri: string | null;
  bodyPhotoMime: string;
  onboardingComplete: boolean;
  styleAesthetics: StyleAesthetic[];
  heatAdaptation: HeatAdaptation | null;
  colorPalette: ColorPalette | null;
  stylingPreferences: StylingPreferences;
  preferredCurrency: Currency;
}

interface UserProfileContextValue {
  fullName: string;
  gender: Gender | null;
  age: number | null;
  bodyPhotoUri: string | null;
  bodyPhotoBase64: string | null;
  bodyPhotoMime: string;
  onboardingComplete: boolean;
  styleAesthetics: StyleAesthetic[];
  heatAdaptation: HeatAdaptation | null;
  colorPalette: ColorPalette | null;
  stylingPreferences: StylingPreferences;
  preferredCurrency: Currency;
  isLoading: boolean;
  setFullName: (name: string) => Promise<void>;
  setGender: (gender: Gender | null) => Promise<void>;
  setAge: (age: number | null) => Promise<void>;
  setOnboardingComplete: (v: boolean) => Promise<void>;
  setStyleAesthetics: (v: StyleAesthetic[]) => Promise<void>;
  setHeatAdaptation: (v: HeatAdaptation | null) => Promise<void>;
  setColorPalette: (v: ColorPalette | null) => Promise<void>;
  setStylingPreferences: (v: StylingPreferences) => Promise<void>;
  setHijabPreference: (v: Exclude<HijabPreference, null>) => Promise<void>;
  setPreferredCurrency: (v: Currency) => Promise<void>;
  completeOnboarding: (data: {
    fullName: string;
    gender: Gender | null;
    age: number | null;
    hijabPreference: HijabPreference;
  }) => Promise<void>;
  chooseBodyPhoto: () => Promise<BodyPhotoSelection | null>;
  takeBodyPhoto: () => Promise<BodyPhotoSelection | null>;
  saveBodyPhoto: (photo: BodyPhotoSelection) => Promise<void>;
  clearBodyPhoto: () => Promise<void>;
}

const profileKey = (userId: string) => `@lookly_user_profile_v6_${userId}`;
const PRIVATE_IMAGE_BUCKET = "lookly-private";

const UserProfileContext = createContext<UserProfileContextValue | null>(null);

// iPhone browsers only open the gallery when a real file input is clicked
// directly from the user's tap. Expo's web image picker can lose that gesture
// after its asynchronous permission check and immediately close the chooser.
async function pickBodyPhotoOnWeb(capture = false): Promise<ImagePicker.ImagePickerAsset | null> {
  if (typeof document === "undefined") return null;

  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    if (capture) input.setAttribute("capture", "user");
    input.style.position = "fixed";
    input.style.left = "-9999px";
    document.body.appendChild(input);

    // iOS does not fire `change` when the chooser is dismissed with Cancel.
    // Listening for focus/visibility returning lets us resolve that cancelled
    // choice instead of leaving Profile stuck on "Processing…" forever.
    let settled = false;
    const cleanUp = () => {
      input.remove();
      window.removeEventListener("focus", handleChooserClosed);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
    const finish = (asset: ImagePicker.ImagePickerAsset | null) => {
      if (settled) return;
      settled = true;
      cleanUp();
      resolve(asset);
    };
    const handleChooserClosed = () => {
      setTimeout(() => {
        if (!settled && !input.files?.length) finish(null);
      }, 300);
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") handleChooserClosed();
    };
    window.addEventListener("focus", handleChooserClosed);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      if (!file) {
        finish(null);
        return;
      }
      const base64 = await new Promise<string>((done) => {
        const reader = new FileReader();
        reader.onload = () => done(typeof reader.result === "string" ? (reader.result.split(",")[1] ?? "") : "");
        reader.onerror = () => done("");
        reader.onabort = () => done("");
        reader.readAsDataURL(file);
      });
      const asset = {
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
      finish(asset);
    }, { once: true });

    // Keep this synchronous with the tap. Do not await before calling click().
    input.click();
  });
}

async function readStoredProfile(userId: string): Promise<string | null> {
  try {
    const value = await AsyncStorage.getItem(profileKey(userId));
    if (value) return value;
  } catch {}
  // Web builds can occasionally initialize AsyncStorage after the first route
  // guard runs. Keep a small browser fallback so completed onboarding survives
  // a refresh or a direct link on desktop and mobile Safari.
  if (Platform.OS === "web" && typeof window !== "undefined") {
    try { return window.localStorage.getItem(profileKey(userId)); } catch {}
  }
  return null;
}

async function writeStoredProfile(userId: string, value: string): Promise<void> {
  try { await AsyncStorage.setItem(profileKey(userId), value); } catch {}
  if (Platform.OS === "web" && typeof window !== "undefined") {
    try { window.localStorage.setItem(profileKey(userId), value); } catch {}
  }
}

async function readBase64FromUri(uri: string): Promise<string | null> {
  if (uri.startsWith("data:")) {
    return uri.split(",", 2)[1] || null;
  }
  if (Platform.OS === "web") {
    try {
      const response = await fetch(uri);
      if (!response.ok) return null;
      return arrayBufferToBase64(await response.arrayBuffer());
    } catch {
      return null;
    }
  }
  try {
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return base64;
  } catch {
    return null;
  }
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = globalThis.atob(base64.includes(",") ? base64.split(",")[1]! : base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes.buffer;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return globalThis.btoa(binary);
}

async function uploadBodyPhotoToStorage(userId: string, base64: string | null, uri: string, mime: string): Promise<string | null> {
  if (!supabase) return null;
  try {
    const file = base64 ? base64ToArrayBuffer(base64) : await (await fetch(uri)).arrayBuffer();
    const path = `${userId}/profile/body.${mime.includes("png") ? "png" : "jpg"}`;
    const { error } = await supabase.storage.from(PRIVATE_IMAGE_BUCKET).upload(path, file, {
      contentType: mime,
      upsert: true,
    });
    return error ? null : path;
  } catch {
    return null;
  }
}

async function finishWithin<T>(task: Promise<T>, milliseconds: number): Promise<T | null> {
  return Promise.race([
    task,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), milliseconds)),
  ]);
}

async function getPrivatePhoto(path: string): Promise<{ uri: string; base64: string; mime: string } | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.storage
      .from(PRIVATE_IMAGE_BUCKET)
      .createSignedUrl(path, 60 * 60 * 24 * 7);
    if (error) return null;
    const response = await fetch(data.signedUrl);
    if (!response.ok) return null;
    const responseMime = response.headers.get("content-type")?.split(";", 1)[0];
    const mime = responseMime?.startsWith("image/")
      ? responseMime
      : path.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
    return { uri: data.signedUrl, base64: arrayBufferToBase64(await response.arrayBuffer()), mime };
  } catch {
    return null;
  }
}

export function UserProfileProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [fullName, setFullNameState] = useState("");
  const [gender, setGenderState] = useState<Gender | null>(null);
  const [age, setAgeState] = useState<number | null>(null);
  const [bodyPhotoUri, setBodyPhotoUri] = useState<string | null>(null);
  const [bodyPhotoBase64, setBodyPhotoBase64] = useState<string | null>(null);
  const [bodyPhotoMime, setBodyPhotoMime] = useState("image/jpeg");
  const [onboardingComplete, setOnboardingCompleteState] = useState(false);
  const [styleAesthetics, setStyleAestheticsState] = useState<StyleAesthetic[]>([]);
  const [heatAdaptation, setHeatAdaptationState] = useState<HeatAdaptation | null>(null);
  const [colorPalette, setColorPaletteState] = useState<ColorPalette | null>(null);
  const [stylingPreferences, setStylingPreferencesState] = useState<StylingPreferences>(DEFAULT_STYLING_PREFERENCES);
  const [preferredCurrency, setPreferredCurrencyState] = useState<Currency>("USD");
  const [isLoading, setIsLoading] = useState(true);
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null);

  const resetProfile = useCallback(() => {
    setFullNameState("");
    setGenderState(null);
    setAgeState(null);
    setBodyPhotoUri(null);
    setBodyPhotoBase64(null);
    setBodyPhotoMime("image/jpeg");
    setOnboardingCompleteState(false);
    setStyleAestheticsState([]);
    setHeatAdaptationState(null);
    setColorPaletteState(null);
    setStylingPreferencesState(DEFAULT_STYLING_PREFERENCES);
    setPreferredCurrencyState("USD");
  }, []);

  useEffect(() => {
    (async () => {
      resetProfile();
      if (!user) {
        setLoadedUserId(null);
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      setLoadedUserId(null);
      try {
        await AsyncStorage.multiRemove([
          "@lookly_user_profile",
          "@lookly_user_profile_v2",
          "@lookly_user_profile_v3",
          "@lookly_user_profile_v4",
        ]);
      } catch {}

      try {
        const raw = await readStoredProfile(user.id);
        if (raw) {
          const stored = JSON.parse(raw) as Partial<UserProfile>;
          if (stored.fullName) setFullNameState(stored.fullName);
          if (stored.gender) setGenderState(stored.gender);
          if (isSupportedAge(stored.age)) setAgeState(stored.age);
          if (stored.bodyPhotoMime) setBodyPhotoMime(stored.bodyPhotoMime);
          if (stored.onboardingComplete) setOnboardingCompleteState(stored.onboardingComplete);
          if (Array.isArray(stored.styleAesthetics)) setStyleAestheticsState(stored.styleAesthetics);
          if (stored.heatAdaptation) setHeatAdaptationState(stored.heatAdaptation);
          if (stored.colorPalette) setColorPaletteState(stored.colorPalette);
          if (stored.stylingPreferences) {
            setStylingPreferencesState(normalizeStylingPreferencesForGender(stored.gender, stored.stylingPreferences));
          }
          if (stored.preferredCurrency) setPreferredCurrencyState(stored.preferredCurrency);
          if (stored.bodyPhotoUri) {
            const b64 = await readBase64FromUri(stored.bodyPhotoUri);
            if (b64) {
              setBodyPhotoUri(stored.bodyPhotoUri);
              setBodyPhotoBase64(b64);
            }
          }
        }
      } catch {}
      const metadata = user.user_metadata as Partial<{
        full_name: string;
        gender: Gender;
        age: number;
        onboarding_complete: boolean;
        hijab_preference: Exclude<HijabPreference, null>;
      }>;
      const hasCompleteSignUpProfile = Boolean(
        metadata.onboarding_complete
        && metadata.full_name?.trim()
        && metadata.gender
        && isSupportedAge(metadata.age)
      );
      try {
        const { data } = await supabase
          ?.from("profiles")
          .select("full_name, gender, age, style_aesthetics, heat_adaptation, color_palette, styling_preferences, preferred_currency, body_photo_path")
          .eq("id", user.id)
          .maybeSingle() ?? { data: null };
        if (data) {
          setFullNameState(data.full_name ?? "");
          setGenderState((data.gender as Gender | null) ?? null);
          setAgeState(isSupportedAge(data.age) ? data.age : null);
          setStyleAestheticsState(Array.isArray(data.style_aesthetics) ? data.style_aesthetics as StyleAesthetic[] : []);
          setHeatAdaptationState((data.heat_adaptation as HeatAdaptation | null) ?? null);
          setColorPaletteState((data.color_palette as ColorPalette | null) ?? null);
          const profileGender = (data.gender as Gender | null) ?? null;
          const nextPreferences = normalizeStylingPreferencesForGender(
            profileGender,
            data.styling_preferences as Partial<StylingPreferences> | null,
          );
          setStylingPreferencesState(nextPreferences);
          setPreferredCurrencyState((data.preferred_currency as Currency | null) ?? "USD");
          setOnboardingCompleteState(true);
          if (data.body_photo_path) {
            const photo = await getPrivatePhoto(data.body_photo_path);
            if (photo) {
              setBodyPhotoUri(photo.uri);
              setBodyPhotoBase64(photo.base64);
              setBodyPhotoMime(photo.mime);
            }
          }
        } else if (hasCompleteSignUpProfile) {
          const signUpProfile: UserProfile = {
            fullName: metadata.full_name!.trim(),
            gender: metadata.gender!,
            age: metadata.age!,
            bodyPhotoUri: null,
            bodyPhotoMime: "image/jpeg",
            onboardingComplete: true,
            styleAesthetics: [],
            heatAdaptation: null,
            colorPalette: null,
            stylingPreferences: {
              ...DEFAULT_STYLING_PREFERENCES,
              hijabPreference: metadata.gender === "female" ? (metadata.hijab_preference ?? null) : null,
              ...(metadata.hijab_preference === "always"
                ? { coverage: "maximum_coverage" as const, silhouette: "relaxed" as const }
                : {}),
            },
            preferredCurrency: "USD",
          };
          setFullNameState(signUpProfile.fullName);
          setGenderState(signUpProfile.gender);
          setAgeState(signUpProfile.age);
          setOnboardingCompleteState(true);
          setStylingPreferencesState(signUpProfile.stylingPreferences);
          await writeStoredProfile(user.id, JSON.stringify(signUpProfile));
          await supabase?.from("profiles").upsert({
            id: user.id,
            full_name: signUpProfile.fullName,
            gender: signUpProfile.gender,
            age: signUpProfile.age,
            styling_preferences: signUpProfile.stylingPreferences,
          });
        }
      } catch {}
      finally {
        setLoadedUserId(user.id);
        setIsLoading(false);
      }
    })();
  }, [resetProfile, user?.id]);

  const buildCurrent = useCallback((): UserProfile => ({
    fullName,
    gender,
    age,
    bodyPhotoUri,
    bodyPhotoMime,
    onboardingComplete,
    styleAesthetics,
    heatAdaptation,
    colorPalette,
    stylingPreferences,
    preferredCurrency,
  }), [fullName, gender, age, bodyPhotoUri, bodyPhotoMime, onboardingComplete, styleAesthetics, heatAdaptation, colorPalette, stylingPreferences, preferredCurrency]);

  const persist = useCallback(async (updates: Partial<UserProfile>) => {
    if (!user) return;
    const next = { ...buildCurrent(), ...updates };
    next.stylingPreferences = normalizeStylingPreferencesForGender(next.gender, next.stylingPreferences);
    await writeStoredProfile(user.id, JSON.stringify(next));
    try {
      await supabase?.from("profiles").upsert({
        id: user.id,
        full_name: next.fullName,
        gender: next.gender,
        age: next.age,
        style_aesthetics: next.styleAesthetics,
        heat_adaptation: next.heatAdaptation,
        color_palette: next.colorPalette,
        styling_preferences: next.stylingPreferences,
        preferred_currency: next.preferredCurrency,
      });
    } catch {}
  }, [buildCurrent, user]);

  const setFullName = useCallback(async (name: string) => {
    setFullNameState(name);
    await persist({ fullName: name });
  }, [persist]);

  const setGender = useCallback(async (g: Gender | null) => {
    setGenderState(g);
    const nextPreferences = normalizeStylingPreferencesForGender(g, stylingPreferences);
    setStylingPreferencesState(nextPreferences);
    await persist({ gender: g, stylingPreferences: nextPreferences });
  }, [persist, stylingPreferences]);

  const setAge = useCallback(async (a: number | null) => {
    if (a !== null && !isSupportedAge(a)) return;
    setAgeState(a);
    await persist({ age: a });
  }, [persist]);

  const setOnboardingComplete = useCallback(async (v: boolean) => {
    setOnboardingCompleteState(v);
    await persist({ onboardingComplete: v });
  }, [persist]);

  const setStyleAesthetics = useCallback(async (v: StyleAesthetic[]) => {
    setStyleAestheticsState(v);
    await persist({ styleAesthetics: v });
  }, [persist]);

  const setHeatAdaptation = useCallback(async (v: HeatAdaptation | null) => {
    setHeatAdaptationState(v);
    await persist({ heatAdaptation: v });
  }, [persist]);

  const setColorPalette = useCallback(async (v: ColorPalette | null) => {
    setColorPaletteState(v);
    await persist({ colorPalette: v });
  }, [persist]);

  const setStylingPreferences = useCallback(async (v: StylingPreferences) => {
    const next = normalizeStylingPreferencesForGender(gender, v);
    setStylingPreferencesState(next);
    await persist({ stylingPreferences: next });
  }, [gender, persist]);

  const setHijabPreference = useCallback(async (v: Exclude<HijabPreference, null>) => {
    if (gender !== "female") return;
    const next: StylingPreferences = {
      ...stylingPreferences,
      hijabPreference: v,
      ...(v === "always"
        ? { coverage: "maximum_coverage", silhouette: "relaxed" }
        : {}),
    };
    setStylingPreferencesState(next);
    await persist({ stylingPreferences: next });
  }, [gender, persist, stylingPreferences]);

  const setPreferredCurrency = useCallback(async (v: Currency) => {
    setPreferredCurrencyState(v);
    await persist({ preferredCurrency: v });
  }, [persist]);

  const completeOnboarding = useCallback(async (data: {
    fullName: string;
    gender: Gender | null;
    age: number | null;
    hijabPreference: HijabPreference;
  }) => {
    if (data.age !== null && !isSupportedAge(data.age)) return;
    setFullNameState(data.fullName);
    setGenderState(data.gender);
    setAgeState(data.age);
    setOnboardingCompleteState(true);
    const nextPreferences = normalizeStylingPreferencesForGender(data.gender, {
      ...stylingPreferences,
      hijabPreference: data.gender === "female" ? data.hijabPreference : null,
      ...(data.hijabPreference === "always"
        ? { coverage: "maximum_coverage", silhouette: "relaxed" }
        : {}),
    });
    setStylingPreferencesState(nextPreferences);
    const profile: UserProfile = {
      ...buildCurrent(),
      fullName: data.fullName,
      gender: data.gender,
      age: data.age,
      stylingPreferences: nextPreferences,
      onboardingComplete: true,
    };
    await persist(profile);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [buildCurrent, persist, stylingPreferences]);

  const preparePickerAsset = useCallback(async (asset: ImagePicker.ImagePickerAsset): Promise<BodyPhotoSelection | null> => {
    const mime = asset.mimeType ?? "image/jpeg";
    const uri = asset.uri;
    const b64 = asset.base64 ?? await finishWithin(readBase64FromUri(uri), 10_000);
    if (!b64) {
      Alert.alert("Photo error", "Lookly could not read that photo. Please choose it again.");
      return null;
    }

    return { uri, base64: b64, mime };
  }, []);

  const saveBodyPhoto = useCallback(async (photo: BodyPhotoSelection) => {
    const { uri, base64: b64, mime } = photo;
    setBodyPhotoUri(uri);
    setBodyPhotoBase64(b64);
    setBodyPhotoMime(mime);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // The selected photo is usable immediately. Cloud backup must never keep
    // the profile screen spinning when a connection or Storage is slow.
    void (async () => {
      await finishWithin(persist({ bodyPhotoUri: uri, bodyPhotoMime: mime }), 8_000);
      if (!user) return;
      const path = await finishWithin(uploadBodyPhotoToStorage(user.id, b64, uri, mime), 15_000);
      if (path) {
        await finishWithin(
          (async () => {
            if (supabase) await supabase.from("profiles").update({ body_photo_path: path }).eq("id", user.id);
          })(),
          8_000,
        );
      }
    })();
  }, [persist, user]);

  const chooseBodyPhoto = useCallback(async (): Promise<BodyPhotoSelection | null> => {
    if (Platform.OS === "web") {
      const asset = await pickBodyPhotoOnWeb();
      return asset ? preparePickerAsset(asset) : null;
    }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Allow access to your photo library.");
      return null;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      quality: 0.7,
      base64: true,
      allowsEditing: false,
    });
    if (result.canceled || !result.assets[0]) return null;
    return preparePickerAsset(result.assets[0]);
  }, [preparePickerAsset]);

  const takeBodyPhoto = useCallback(async (): Promise<BodyPhotoSelection | null> => {
    if (Platform.OS === "web") {
      const asset = await pickBodyPhotoOnWeb(true);
      return asset ? preparePickerAsset(asset) : null;
    }
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Allow camera access.");
      return null;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.7,
      base64: true,
      allowsEditing: false,
    });
    if (result.canceled || !result.assets[0]) return null;
    return preparePickerAsset(result.assets[0]);
  }, [preparePickerAsset]);

  const clearBodyPhoto = useCallback(async () => {
    setBodyPhotoUri(null);
    setBodyPhotoBase64(null);
    setBodyPhotoMime("image/jpeg");
    await persist({ bodyPhotoUri: null, bodyPhotoMime: "image/jpeg" });
    if (user) {
      await supabase?.storage.from(PRIVATE_IMAGE_BUCKET).remove([
        `${user.id}/profile/body.jpg`,
        `${user.id}/profile/body.png`,
      ]);
      // Use upsert so the cleared state is retained even if a user profile row
      // has not been created yet. This prevents an old cloud path from bringing
      // the image back after a refresh.
      await supabase?.from("profiles").upsert({ id: user.id, body_photo_path: null });
    }
  }, [persist, user]);

  return (
    <UserProfileContext.Provider
      value={{
        fullName,
        gender,
        age,
        bodyPhotoUri,
        bodyPhotoBase64,
        bodyPhotoMime,
        onboardingComplete,
        styleAesthetics,
        heatAdaptation,
        colorPalette,
        stylingPreferences,
        preferredCurrency,
        // The profile effect starts after AuthContext publishes its session.
        // Keep consumers loading during that small gap so route guards never
        // mistake a saved profile for an unfinished onboarding.
        isLoading: isLoading || (!!user && loadedUserId !== user.id),
        setFullName,
        setGender,
        setAge,
        setOnboardingComplete,
        setStyleAesthetics,
        setHeatAdaptation,
        setColorPalette,
        setStylingPreferences,
        setHijabPreference,
        setPreferredCurrency,
        completeOnboarding,
        chooseBodyPhoto,
        takeBodyPhoto,
        saveBodyPhoto,
        clearBodyPhoto,
      }}
    >
      {children}
    </UserProfileContext.Provider>
  );
}

export function useUserProfile() {
  const ctx = useContext(UserProfileContext);
  if (!ctx) throw new Error("useUserProfile must be inside UserProfileProvider");
  return ctx;
}
