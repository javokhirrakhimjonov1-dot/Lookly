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
import { supabase } from "@/lib/supabase";

export type Gender = "male" | "female" | "non-binary" | "prefer_not_to_say";
export type StyleAesthetic = "minimalist" | "streetwear" | "smart_casual" | "boho" | "classic" | "sporty";
export type HeatAdaptation = "light_linen" | "shorts_casual" | "sport_active" | "cotton_denim";
export type ColorPalette = "earthy_neutrals" | "monochrome" | "vivid_colors" | "pastels" | "desert_sand";

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
  isLoading: boolean;
  setFullName: (name: string) => Promise<void>;
  setGender: (gender: Gender | null) => Promise<void>;
  setAge: (age: number | null) => Promise<void>;
  setOnboardingComplete: (v: boolean) => Promise<void>;
  setStyleAesthetics: (v: StyleAesthetic[]) => Promise<void>;
  setHeatAdaptation: (v: HeatAdaptation | null) => Promise<void>;
  setColorPalette: (v: ColorPalette | null) => Promise<void>;
  completeOnboarding: (data: {
    fullName: string;
    gender: Gender | null;
    age: number | null;
    styleAesthetics: StyleAesthetic[];
    heatAdaptation: HeatAdaptation | null;
    colorPalette: ColorPalette | null;
  }) => Promise<void>;
  uploadBodyPhoto: () => Promise<void>;
  captureBodyPhoto: () => Promise<void>;
  clearBodyPhoto: () => Promise<void>;
}

const profileKey = (userId: string) => `@lookly_user_profile_v6_${userId}`;
const PRIVATE_IMAGE_BUCKET = "lookly-private";

const UserProfileContext = createContext<UserProfileContextValue | null>(null);

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

async function getPrivatePhoto(path: string): Promise<{ uri: string; base64: string } | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.storage
      .from(PRIVATE_IMAGE_BUCKET)
      .createSignedUrl(path, 60 * 60 * 24 * 7);
    if (error) return null;
    const response = await fetch(data.signedUrl);
    if (!response.ok) return null;
    return { uri: data.signedUrl, base64: arrayBufferToBase64(await response.arrayBuffer()) };
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
          if (stored.age != null) setAgeState(stored.age);
          if (stored.bodyPhotoMime) setBodyPhotoMime(stored.bodyPhotoMime);
          if (stored.onboardingComplete) setOnboardingCompleteState(stored.onboardingComplete);
          if (Array.isArray(stored.styleAesthetics)) setStyleAestheticsState(stored.styleAesthetics);
          if (stored.heatAdaptation) setHeatAdaptationState(stored.heatAdaptation);
          if (stored.colorPalette) setColorPaletteState(stored.colorPalette);
          if (stored.bodyPhotoUri) {
            setBodyPhotoUri(stored.bodyPhotoUri);
            const b64 = await readBase64FromUri(stored.bodyPhotoUri);
            if (b64) setBodyPhotoBase64(b64);
          }
        }
      } catch {}
      try {
        const { data } = await supabase
          ?.from("profiles")
          .select("full_name, gender, age, style_aesthetics, heat_adaptation, color_palette, body_photo_path")
          .eq("id", user.id)
          .maybeSingle() ?? { data: null };
        if (data) {
          setFullNameState(data.full_name ?? "");
          setGenderState((data.gender as Gender | null) ?? null);
          setAgeState(data.age ?? null);
          setStyleAestheticsState(Array.isArray(data.style_aesthetics) ? data.style_aesthetics as StyleAesthetic[] : []);
          setHeatAdaptationState((data.heat_adaptation as HeatAdaptation | null) ?? null);
          setColorPaletteState((data.color_palette as ColorPalette | null) ?? null);
          setOnboardingCompleteState(true);
          if (data.body_photo_path) {
            const photo = await getPrivatePhoto(data.body_photo_path);
            if (photo) {
              setBodyPhotoUri(photo.uri);
              setBodyPhotoBase64(photo.base64);
            }
          }
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
  }), [fullName, gender, age, bodyPhotoUri, bodyPhotoMime, onboardingComplete, styleAesthetics, heatAdaptation, colorPalette]);

  const persist = useCallback(async (updates: Partial<UserProfile>) => {
    if (!user) return;
    const next = { ...buildCurrent(), ...updates };
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
      });
    } catch {}
  }, [buildCurrent, user]);

  const setFullName = useCallback(async (name: string) => {
    setFullNameState(name);
    await persist({ fullName: name });
  }, [persist]);

  const setGender = useCallback(async (g: Gender | null) => {
    setGenderState(g);
    await persist({ gender: g });
  }, [persist]);

  const setAge = useCallback(async (a: number | null) => {
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

  const completeOnboarding = useCallback(async (data: {
    fullName: string;
    gender: Gender | null;
    age: number | null;
    styleAesthetics: StyleAesthetic[];
    heatAdaptation: HeatAdaptation | null;
    colorPalette: ColorPalette | null;
  }) => {
    setFullNameState(data.fullName);
    setGenderState(data.gender);
    setAgeState(data.age);
    setStyleAestheticsState(data.styleAesthetics);
    setHeatAdaptationState(data.heatAdaptation);
    setColorPaletteState(data.colorPalette);
    setOnboardingCompleteState(true);
    const profile: UserProfile = {
      ...buildCurrent(),
      ...data,
      onboardingComplete: true,
    };
    await persist(profile);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [buildCurrent, persist]);

  const applyPickerAsset = useCallback(async (asset: ImagePicker.ImagePickerAsset) => {
    const mime = asset.mimeType ?? "image/jpeg";
    const uri = asset.uri;
    setBodyPhotoUri(uri);
    setBodyPhotoMime(mime);
    const b64 = asset.base64 ?? await finishWithin(readBase64FromUri(uri), 10_000);
    setBodyPhotoBase64(b64);
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

  const uploadBodyPhoto = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Allow access to your photo library.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      quality: 0.7,
      base64: true,
      allowsEditing: true,
      aspect: [3, 5],
    });
    if (result.canceled || !result.assets[0]) return;
    await applyPickerAsset(result.assets[0]);
  }, [applyPickerAsset]);

  const captureBodyPhoto = useCallback(async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Allow camera access.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.7,
      base64: true,
      allowsEditing: true,
      aspect: [3, 5],
    });
    if (result.canceled || !result.assets[0]) return;
    await applyPickerAsset(result.assets[0]);
  }, [applyPickerAsset]);

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
        completeOnboarding,
        uploadBodyPhoto,
        captureBodyPhoto,
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
