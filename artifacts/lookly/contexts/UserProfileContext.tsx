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
import { Alert } from "react-native";

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

const PROFILE_KEY = "@lookly_user_profile_v5";

const UserProfileContext = createContext<UserProfileContextValue | null>(null);

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

export function UserProfileProvider({ children }: { children: React.ReactNode }) {
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

  useEffect(() => {
    (async () => {
      try {
        await AsyncStorage.multiRemove([
          "@lookly_user_profile",
          "@lookly_user_profile_v2",
          "@lookly_user_profile_v3",
          "@lookly_user_profile_v4",
        ]);
      } catch {}

      try {
        const raw = await AsyncStorage.getItem(PROFILE_KEY);
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
      finally { setIsLoading(false); }
    })();
  }, []);

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
    try {
      await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify({ ...buildCurrent(), ...updates }));
    } catch {}
  }, [buildCurrent]);

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
    try {
      await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    } catch {}
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [buildCurrent]);

  const applyPickerAsset = useCallback(async (asset: ImagePicker.ImagePickerAsset) => {
    const mime = asset.mimeType ?? "image/jpeg";
    const uri = asset.uri;
    setBodyPhotoUri(uri);
    setBodyPhotoMime(mime);
    const b64 = asset.base64 ?? await readBase64FromUri(uri);
    setBodyPhotoBase64(b64);
    await persist({ bodyPhotoUri: uri, bodyPhotoMime: mime });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [persist]);

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
    await persist({ bodyPhotoUri: null });
  }, [persist]);

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
        isLoading,
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
