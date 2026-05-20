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

interface UserProfile {
  name: string;
  bodyPhotoUri: string | null;
  bodyPhotoMime: string;
}

interface UserProfileContextValue {
  name: string;
  bodyPhotoUri: string | null;
  bodyPhotoBase64: string | null;
  bodyPhotoMime: string;
  isLoading: boolean;
  setName: (name: string) => Promise<void>;
  uploadBodyPhoto: () => Promise<void>;
  captureBodyPhoto: () => Promise<void>;
  clearBodyPhoto: () => Promise<void>;
}

const PROFILE_KEY = "@lookly_user_profile_v2";
const OLD_PROFILE_KEY = "@lookly_user_profile";

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
  const [name, setNameState] = useState("You");
  const [bodyPhotoUri, setBodyPhotoUri] = useState<string | null>(null);
  const [bodyPhotoBase64, setBodyPhotoBase64] = useState<string | null>(null);
  const [bodyPhotoMime, setBodyPhotoMime] = useState("image/jpeg");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        // Purge old key that stored large base64 blobs — frees AsyncStorage quota
        await AsyncStorage.removeItem(OLD_PROFILE_KEY);
      } catch {}

      try {
        const raw = await AsyncStorage.getItem(PROFILE_KEY);
        if (raw) {
          const stored = JSON.parse(raw) as Partial<UserProfile>;
          if (stored.name) setNameState(stored.name);
          if (stored.bodyPhotoMime) setBodyPhotoMime(stored.bodyPhotoMime);
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

  const persist = useCallback(async (updates: Partial<UserProfile>) => {
    try {
      const current: UserProfile = { name, bodyPhotoUri, bodyPhotoMime };
      await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify({ ...current, ...updates }));
    } catch {
      // Storage full — profile changes remain in memory for this session
    }
  }, [name, bodyPhotoUri, bodyPhotoMime]);

  const setName = useCallback(async (newName: string) => {
    setNameState(newName);
    await persist({ name: newName });
  }, [persist]);

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
      quality: 0.6,
      base64: false,
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
      quality: 0.6,
      base64: false,
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
        name,
        bodyPhotoUri,
        bodyPhotoBase64,
        bodyPhotoMime,
        isLoading,
        setName,
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
