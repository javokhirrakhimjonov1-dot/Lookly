import AsyncStorage from "@react-native-async-storage/async-storage";
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
  bodyPhotoBase64: string | null;
  bodyPhotoMime: string;
}

interface UserProfileContextValue extends UserProfile {
  isLoading: boolean;
  setName: (name: string) => Promise<void>;
  uploadBodyPhoto: () => Promise<void>;
  captureBodyPhoto: () => Promise<void>;
  clearBodyPhoto: () => Promise<void>;
}

const PROFILE_KEY = "@lookly_user_profile";

const UserProfileContext = createContext<UserProfileContextValue | null>(null);

export function UserProfileProvider({ children }: { children: React.ReactNode }) {
  const [name, setNameState] = useState("You");
  const [bodyPhotoUri, setBodyPhotoUri] = useState<string | null>(null);
  const [bodyPhotoBase64, setBodyPhotoBase64] = useState<string | null>(null);
  const [bodyPhotoMime, setBodyPhotoMime] = useState("image/jpeg");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(PROFILE_KEY);
        if (raw) {
          const stored = JSON.parse(raw) as Partial<UserProfile>;
          if (stored.name) setNameState(stored.name);
          if (stored.bodyPhotoUri) setBodyPhotoUri(stored.bodyPhotoUri);
          if (stored.bodyPhotoBase64) setBodyPhotoBase64(stored.bodyPhotoBase64);
          if (stored.bodyPhotoMime) setBodyPhotoMime(stored.bodyPhotoMime);
        }
      } catch {}
      finally { setIsLoading(false); }
    })();
  }, []);

  const persist = useCallback(async (updates: Partial<UserProfile>) => {
    const current: UserProfile = { name, bodyPhotoUri, bodyPhotoBase64, bodyPhotoMime };
    await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify({ ...current, ...updates }));
  }, [name, bodyPhotoUri, bodyPhotoBase64, bodyPhotoMime]);

  const setName = useCallback(async (newName: string) => {
    setNameState(newName);
    await persist({ name: newName });
  }, [persist]);

  const applyPickerAsset = useCallback(async (asset: ImagePicker.ImagePickerAsset) => {
    if (!asset.base64) {
      Alert.alert("Photo error", "Could not read photo data. Please try again.");
      return;
    }
    const mime = asset.mimeType ?? "image/jpeg";
    setBodyPhotoUri(asset.uri);
    setBodyPhotoBase64(asset.base64);
    setBodyPhotoMime(mime);
    await persist({ bodyPhotoUri: asset.uri, bodyPhotoBase64: asset.base64, bodyPhotoMime: mime });
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
    await persist({ bodyPhotoUri: null, bodyPhotoBase64: null });
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
