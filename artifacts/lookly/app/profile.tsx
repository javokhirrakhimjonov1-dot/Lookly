import { Feather } from "@/components/FeatherIcon";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Modal,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
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
import { useWardrobe } from "@/contexts/WardrobeContext";
import { useSocial } from "@/contexts/SocialContext";
import { useWeather } from "@/contexts/WeatherContext";
import { useAuth } from "@/contexts/AuthContext";
import { type UpcomingFeature, useFeatureWaitlist } from "@/contexts/FeatureWaitlistContext";
import { type BodyPhotoSelection, type Gender, useUserProfile } from "@/contexts/UserProfileContext";
import { MAX_SUPPORTED_AGE, MIN_SUPPORTED_AGE } from "@/lib/profileRules";
import { type Language, useLanguage } from "@/contexts/LanguageContext";
import { submitBugReport } from "@/contexts/serverSync";
import { shopSuggestionTypeLabel } from "@/lib/shopSuggestionPreferences";

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

const AGE_ITEM_HEIGHT = 58;
const AGE_PICKER_HEIGHT = AGE_ITEM_HEIGHT * 3;
const AGE_OPTIONS = Array.from({ length: MAX_SUPPORTED_AGE - MIN_SUPPORTED_AGE + 1 }, (_, index) => MIN_SUPPORTED_AGE + index);

type LocationSuggestion = {
  id: number;
  name: string;
  admin1?: string;
  country?: string;
};

export default function ProfileScreen() {
  const colors = useColors();
  const { t, lang, setLang } = useLanguage();
  const insets = useSafeAreaInsets();
  const { items, isLoading: isWardrobeLoading } = useWardrobe();
  const { looks } = useSocial();
  const { city, setManualLocation, useCurrentLocation } = useWeather();
  const { user, signOut, updateEmail, updatePassword } = useAuth();
  const { joinedFeatures, isLoading: isWaitlistLoading, updatingFeature, toggleWaitlist } = useFeatureWaitlist();
  const {
    fullName,
    gender,
    age,
    bodyPhotoUri,
    setFullName,
    setGender,
    setAge,
    chooseBodyPhoto,
    takeBodyPhoto,
    saveBodyPhoto,
    clearBodyPhoto,
    stylingPreferences,
    setStylingPreferences,
    setHijabPreference,
    isLoading: isProfileLoading,
  } = useUserProfile();

  const GENDER_OPTIONS: { key: Gender; label: string }[] = [
    { key: "male", label: t("gender_male") },
    { key: "female", label: t("gender_female") },
    { key: "non-binary", label: t("gender_nonbinary") },
    { key: "prefer_not_to_say", label: t("gender_prefer_not") },
  ];

const LANG_OPTIONS: { key: Language; flag: string; label: string }[] = [
    { key: "en", flag: "🇬🇧", label: "English" },
    { key: "ru", flag: "🇷🇺", label: "Русский" },
    { key: "uz", flag: "🇺🇿", label: "O'zbekcha" },
];

  const [photoLoading, setPhotoLoading] = useState(false);
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);
  const [showStylingPreferences, setShowStylingPreferences] = useState(false);
  const [showBodyPhotoManager, setShowBodyPhotoManager] = useState(false);
  const [draftBodyPhotoUri, setDraftBodyPhotoUri] = useState<string | null>(null);
  const [draftBodyPhotoSelection, setDraftBodyPhotoSelection] = useState<BodyPhotoSelection | null>(null);
  const [draftBodyPhotoRemoved, setDraftBodyPhotoRemoved] = useState(false);
  const [showPersonalEditor, setShowPersonalEditor] = useState(false);
  const [draftName, setDraftName] = useState(fullName);
  const [draftGender, setDraftGender] = useState<Gender | null>(gender);
  const [draftAge, setDraftAge] = useState<number | null>(age);
  const agePickerRef = useRef<ScrollView>(null);
  const ageScrollY = useRef(new Animated.Value(0)).current;
  const [profileSaving, setProfileSaving] = useState(false);
  const [accountEditor, setAccountEditor] = useState<"email" | "password" | null>(null);
  const [draftEmail, setDraftEmail] = useState(user?.email ?? "");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [emailSaving, setEmailSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [showWeatherLocation, setShowWeatherLocation] = useState(false);
  const [locationQuery, setLocationQuery] = useState("");
  const [locationSuggestions, setLocationSuggestions] = useState<LocationSuggestion[]>([]);
  const [locationSuggestionsLoading, setLocationSuggestionsLoading] = useState(false);
  const [selectedLocationQuery, setSelectedLocationQuery] = useState("");
  const [manualLocationLoading, setManualLocationLoading] = useState(false);
  const [showBugReport, setShowBugReport] = useState(false);
  const [bugDescription, setBugDescription] = useState("");
  const [bugScreenshotUri, setBugScreenshotUri] = useState<string | null>(null);
  const [bugSubmitting, setBugSubmitting] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const topPad = getTopPadding(insets.top);
  const myLooks = looks.filter((l) => l.isOwn);
  const initials = fullName ? getInitials(fullName) : "?";
  const displayName = fullName || "Your Profile";
  const firstName = fullName ? fullName.trim().split(/\s+/)[0] : null;

  useEffect(() => {
    const query = locationQuery.trim();
    if (!query || query.toLocaleLowerCase() === selectedLocationQuery.toLocaleLowerCase()) {
      setLocationSuggestions([]);
      setLocationSuggestionsLoading(false);
      return;
    }

    setLocationSuggestionsLoading(true);
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query.toLocaleLowerCase())}&count=5&language=en&format=json`,
          { signal: controller.signal },
        );
        const data = await response.json() as { results?: LocationSuggestion[] };
        setLocationSuggestions(data.results ?? []);
      } catch {
        if (!controller.signal.aborted) setLocationSuggestions([]);
      } finally {
        if (!controller.signal.aborted) setLocationSuggestionsLoading(false);
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [locationQuery, selectedLocationQuery]);

  const handleLocationQueryChange = (value: string) => {
    setSelectedLocationQuery("");
    setLocationQuery(value);
  };

  const selectLocationSuggestion = (suggestion: LocationSuggestion) => {
    const display = [suggestion.name, suggestion.admin1, suggestion.country].filter(Boolean).join(", ");
    setSelectedLocationQuery(display);
    setLocationQuery(display);
    setLocationSuggestions([]);
  };

  const personalDetailsSummary = [
    gender ? GENDER_OPTIONS.find((option) => option.key === gender)?.label : "Not set",
    age != null ? `${age} ${t("years_old_hint").split("·")[0]?.trim()}` : t("not_set"),
  ].join(" · ");

  const stylingPreferencesSummary = [
    gender === "female"
      ? t(stylingPreferences.hijabPreference === "always" ? "hijab_yes_always" : "hijab_no")
      : null,
    t(stylingPreferences.coverage === "no_preference" ? "pref_none" : stylingPreferences.coverage === "modest" ? "pref_modest" : "pref_max_coverage"),
    t(stylingPreferences.silhouette === "balanced" ? "pref_balanced" : stylingPreferences.silhouette === "fitted" ? "pref_fitted" : "pref_relaxed"),
    t(stylingPreferences.heels === "flats" ? "pref_flats" : stylingPreferences.heels === "low_heels" ? "pref_low_heels" : "pref_any_heels"),
  ].filter(Boolean).join(" · ");

  const openPersonalEditor = () => {
    setDraftName(fullName);
    setDraftGender(gender);
    setDraftAge(age);
    setShowPersonalEditor(true);
  };

  useEffect(() => {
    if (!showPersonalEditor) return;
    const selectedIndex = Math.max(0, AGE_OPTIONS.indexOf(draftAge ?? MIN_SUPPORTED_AGE));
    const frame = requestAnimationFrame(() => {
      ageScrollY.setValue(selectedIndex * AGE_ITEM_HEIGHT);
      agePickerRef.current?.scrollTo({ y: selectedIndex * AGE_ITEM_HEIGHT, animated: false });
    });
    return () => cancelAnimationFrame(frame);
  }, [showPersonalEditor]);

  const commitAgePickerScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const selectedIndex = Math.max(
      0,
      Math.min(AGE_OPTIONS.length - 1, Math.round(event.nativeEvent.contentOffset.y / AGE_ITEM_HEIGHT)),
    );
    const selectedAge = AGE_OPTIONS[selectedIndex]!;
    if (selectedAge !== draftAge) setDraftAge(selectedAge);
  };

  const selectAge = (selectedAge: number, index: number) => {
    setDraftAge(selectedAge);
    agePickerRef.current?.scrollTo({ y: index * AGE_ITEM_HEIGHT, animated: true });
  };

  const savePersonalDetails = async () => {
    setProfileSaving(true);
    try {
      const nextName = draftName.trim();
      if (nextName !== fullName) {
        await setFullName(nextName);
      }
      if (draftGender !== gender) await setGender(draftGender);
      if (draftAge !== age) await setAge(draftAge);
      setShowPersonalEditor(false);
    } catch {
      Alert.alert("Couldn't save changes", "Please try again.");
    } finally {
      setProfileSaving(false);
    }
  };

  const openBodyPhotoManager = () => {
    setDraftBodyPhotoUri(bodyPhotoUri);
    setDraftBodyPhotoSelection(null);
    setDraftBodyPhotoRemoved(false);
    setShowBodyPhotoManager(true);
  };

  const openAccountEditor = (action: "email" | "password") => {
    if (action === "email") {
      setDraftEmail(user?.email ?? "");
    } else {
      setNewPassword("");
      setConfirmNewPassword("");
      setShowNewPassword(false);
    }
    setAccountEditor(action);
  };

  const closeAccountEditor = () => {
    if (emailSaving || passwordSaving) return;
    setNewPassword("");
    setConfirmNewPassword("");
    setShowNewPassword(false);
    setAccountEditor(null);
  };

  const saveEmail = async () => {
    const normalizedEmail = draftEmail.trim().toLowerCase();
    if (!normalizedEmail.includes("@") || !normalizedEmail.includes(".")) {
      Alert.alert(t("invalid_email_title"), t("invalid_email_message"));
      return;
    }
    if (normalizedEmail === user?.email?.toLowerCase()) {
      Alert.alert(t("email_unchanged_title"), t("email_unchanged_message"));
      return;
    }

    setEmailSaving(true);
    try {
      const result = await updateEmail(normalizedEmail);
      if (result.error) {
        Alert.alert(t("email_update_failed"), result.error);
        return;
      }
      Alert.alert(
        result.needsConfirmation ? t("verify_new_email_title") : t("email_updated_title"),
        result.needsConfirmation ? t("verify_new_email_message") : t("email_updated_message"),
      );
    } catch {
      Alert.alert(t("email_update_failed"), t("account_connection_error"));
    } finally {
      setEmailSaving(false);
    }
  };

  const saveNewPassword = async () => {
    if (newPassword.length < 6) {
      Alert.alert(t("password_too_short_title"), t("password_too_short_message"));
      return;
    }
    if (newPassword !== confirmNewPassword) {
      Alert.alert(t("password_mismatch_title"), t("password_mismatch_message"));
      return;
    }

    setPasswordSaving(true);
    try {
      const error = await updatePassword(newPassword);
      if (error) {
        Alert.alert(t("password_update_failed"), error);
        return;
      }
      setNewPassword("");
      setConfirmNewPassword("");
      setShowNewPassword(false);
      Alert.alert(t("password_updated_title"), t("password_updated_message"));
    } catch {
      Alert.alert(t("password_update_failed"), t("account_connection_error"));
    } finally {
      setPasswordSaving(false);
    }
  };

  const discardBodyPhotoChanges = () => {
    if (photoLoading) return;
    setDraftBodyPhotoUri(bodyPhotoUri);
    setDraftBodyPhotoSelection(null);
    setDraftBodyPhotoRemoved(false);
    setShowBodyPhotoManager(false);
  };

  const handleUpload = async () => {
    // iPhone and in-app browsers do not reliably report when a file chooser is
    // cancelled. Do not turn the screen into a blocking "Processing" state
    // until an image actually exists; cancelling must leave both choices usable.
    try {
      const photo = await chooseBodyPhoto();
      if (!photo) return;
      setDraftBodyPhotoSelection(photo);
      setDraftBodyPhotoUri(photo.uri);
      setDraftBodyPhotoRemoved(false);
    } catch {
      Alert.alert("Photo not added", "Please try again, or open Lookly in Safari or Chrome.");
    }
  };

  const handleCapture = async () => {
    try {
      const photo = await takeBodyPhoto();
      if (!photo) return;
      setDraftBodyPhotoSelection(photo);
      setDraftBodyPhotoUri(photo.uri);
      setDraftBodyPhotoRemoved(false);
    } catch {
      Alert.alert("Photo not added", "Please try again, or open Lookly in Safari or Chrome.");
    }
  };

  const handleClear = () => {
    setDraftBodyPhotoUri(null);
    setDraftBodyPhotoSelection(null);
    setDraftBodyPhotoRemoved(true);
  };

  const commitBodyPhotoChanges = async () => {
    if (photoLoading) return;
    setPhotoLoading(true);
    try {
      if (draftBodyPhotoSelection) {
        await saveBodyPhoto(draftBodyPhotoSelection);
      } else if (draftBodyPhotoRemoved) {
        await clearBodyPhoto();
      }
      setShowBodyPhotoManager(false);
      setDraftBodyPhotoSelection(null);
      setDraftBodyPhotoRemoved(false);
    } catch {
      Alert.alert("Photo not saved", "Please try again.");
    } finally {
      setPhotoLoading(false);
    }
  };

  const saveManualLocation = async (requestedLocation = locationQuery) => {
    const requested = requestedLocation.trim();
    if (!requested) {
      Alert.alert("Choose a city", "Start typing a city name or use your current location.");
      return;
    }
    setManualLocationLoading(true);
    try {
      const result = await setManualLocation(requested);
      if (result.error) {
        Alert.alert("Location not found", result.error);
        return;
      }
      setLocationQuery("");
      setShowWeatherLocation(false);
      Alert.alert("Location updated", "Lookly will use this location for weather-aware suggestions.");
    } finally {
      setManualLocationLoading(false);
    }
  };

  const useDeviceWeatherLocation = async () => {
    setManualLocationLoading(true);
    try {
      await useCurrentLocation();
      setShowWeatherLocation(false);
      Alert.alert("Location updated", "Lookly is using your current location when permission is available.");
    } finally {
      setManualLocationLoading(false);
    }
  };

  const chooseBugScreenshot = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        quality: 0.7,
      });
      if (!result.canceled) setBugScreenshotUri(result.assets[0]?.uri ?? null);
    } catch {
      Alert.alert("Screenshot not added", "Please try again.");
    }
  };

  const sendBugReport = async () => {
    if (bugDescription.trim().length < 5) {
      Alert.alert("Add a little more detail", "Please describe what happened so we can reproduce it.");
      return;
    }

    setBugSubmitting(true);
    try {
      const result = await submitBugReport({
        description: bugDescription.trim(),
        screenshotUri: bugScreenshotUri ?? undefined,
        platform: Platform.OS,
      });
      if (result.error) {
        Alert.alert("Report not sent", result.error);
        return;
      }
      setBugDescription("");
      setBugScreenshotUri(null);
      setShowBugReport(false);
      Alert.alert("Report sent", result.warning ?? "Thank you — your report will help us improve Lookly.");
    } finally {
      setBugSubmitting(false);
    }
  };

  const toggleUpcomingFeature = async (feature: UpcomingFeature) => {
    const wasJoined = joinedFeatures.has(feature);
    const error = await toggleWaitlist(feature);
    if (error) Alert.alert(t("waitlist_unavailable_title"), error);
    else if (!wasJoined) Alert.alert(t("waitlist_joined_title"), t("waitlist_joined_message"));
  };

  const handleSignOut = async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    try {
      const error = await signOut();
      if (error) {
        Alert.alert("Couldn't log out", error);
        return;
      }
      router.replace("/auth");
    } catch {
      Alert.alert("Couldn't log out", "Please check your connection and try again.");
    } finally {
      setIsSigningOut(false);
    }
  };

  const rows = [
    {
      icon: "bell" as const,
      label: t("deal_notif"),
      description: `${t("coming_soon")} · ${t("coming_soon_hint")}`,
      feature: "deal_notifications" as UpcomingFeature,
    },
    {
      icon: "shield" as const,
      label: t("privacy"),
      description: `${t("coming_soon")} · ${t("coming_soon_hint")}`,
      onPress: () => Alert.alert(
        t("privacy_title"),
        t("privacy_account_desc")
      ),
      disabled: false,
    },
    {
      icon: "cloud" as const,
      label: t("weather_loc"),
      description: `${city} · ${t("tap_to_refresh")}`,
      onPress: () => setShowWeatherLocation(true),
      disabled: false,
    },
    {
      icon: "alert-circle" as const,
      label: t("report_bug"),
      description: t("report_bug_desc"),
      onPress: () => setShowBugReport(true),
      disabled: false,
    },
    {
      icon: "info" as const,
      label: t("about_lookly"),
      description: t("version"),
      onPress: () => Alert.alert(t("about_lookly"), t("about_message")),
      disabled: false,
    },
  ];

  return (
    <>
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={[
        styles.content,
        { paddingTop: topPad + 16, paddingBottom: getBottomPadding(insets.bottom, 40) },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <TouchableOpacity onPress={() => router.replace("/(tabs)")} style={styles.backBtn}>
        <Feather name="arrow-left" size={22} color={colors.foreground} />
      </TouchableOpacity>

      {/* Profile card */}
      <View style={styles.profileCard}>
        <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
          <Text style={[styles.avatarText, { color: colors.primaryForeground }]}>{initials}</Text>
        </View>
        <Text style={[styles.name, { color: colors.foreground }]}>{displayName || t("your_profile")}</Text>
        {(gender || age) ? (
          <Text style={[styles.profileMeta, { color: colors.mutedForeground }]}>
            {[
              gender && gender !== "prefer_not_to_say"
                ? GENDER_OPTIONS.find((g) => g.key === gender)?.label
                : null,
              age ? `${age} ${t("years_old_hint").split("·")[0]?.trim()}` : null,
            ].filter(Boolean).join(" · ")}
          </Text>
        ) : null}
        <Text style={[styles.location, { color: colors.mutedForeground }]}>{city}</Text>
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            {isWardrobeLoading ? (
              <ActivityIndicator size="small" color={colors.accent} />
            ) : (
              <Text style={[styles.statNumber, { color: colors.foreground }]}>{items.length}</Text>
            )}
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{t("stat_items")}</Text>
          </View>
          <View style={[styles.dividerV, { backgroundColor: colors.border }]} />
          <View style={styles.stat}>
            <Text style={[styles.statNumber, { color: colors.foreground }]}>{myLooks.length}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{t("stat_my_looks")}</Text>
          </View>
        </View>
      </View>

      {/* About You section */}
      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.sectionHeader}>
          <View style={[styles.sectionIconWrap, { backgroundColor: colors.accent + "22" }]}>
            <Feather name="user" size={16} color={colors.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{t("about_you")}</Text>
            <Text style={[styles.sectionSub, { color: colors.mutedForeground }]}>
              {t("personalise_hint")}
            </Text>
          </View>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>{t("personal_details").toUpperCase()}</Text>
          <TouchableOpacity
            activeOpacity={0.75}
            onPress={openPersonalEditor}
            style={[styles.profileDetailsEditor, { backgroundColor: colors.secondary, borderColor: colors.border }]}
          >
            <View style={[styles.profileDetailsIcon, { backgroundColor: colors.card }]}>
              <Feather name="user" size={18} color={colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.profileDetailsValue, { color: colors.foreground }]}>{t("edit_name_gender_age")}</Text>
              <Text style={[styles.profileDetailsHint, { color: colors.mutedForeground }]}>{personalDetailsSummary}</Text>
            </View>
            <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        {!isProfileLoading && (fullName || gender || age) ? (
          <View style={[styles.profileTip, { backgroundColor: "#F0FDF4", borderColor: "#BBF7D0" }]}>
            <Feather name="check-circle" size={13} color="#059669" />
            <Text style={[styles.profileTipText, { color: "#065F46" }]}>
              {bodyPhotoUri ? (
                t("ref_photo_priority_short")
              ) : (
                <>{t("ai_tailored")}{" "}{[firstName, gender && gender !== "prefer_not_to_say" ? GENDER_OPTIONS.find((g) => g.key === gender)?.label.toLowerCase() : null, age ? `${age}` : null].filter(Boolean).join(", ")}</>
              )}
            </Text>
          </View>
        ) : !isProfileLoading ? (
          <View style={[styles.profileTip, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
            <Feather name="info" size={13} color={colors.mutedForeground} />
            <Text style={[styles.profileTipText, { color: colors.mutedForeground }]}>
              {t("fill_details")}
            </Text>
          </View>
        ) : null}
      </View>

      <TouchableOpacity
        activeOpacity={0.78}
        onPress={openBodyPhotoManager}
        style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}
      >
        <View style={styles.sectionHeader}>
          <View style={[styles.sectionIconWrap, { backgroundColor: colors.accent + "22" }]}>
            <Feather name="camera" size={16} color={colors.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{t("body_ref")}</Text>
            <Text style={[styles.sectionSub, { color: colors.mutedForeground }]}>
              {t("body_ref_hint")}
            </Text>
          </View>
        </View>

        <View style={[styles.bodyPhotoSummary, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
          <View style={[styles.bodyPhotoStatusIcon, { backgroundColor: bodyPhotoUri ? "#ECFDF5" : colors.card }]}>
            <Feather name={bodyPhotoUri ? "check" : "upload"} size={17} color={bodyPhotoUri ? "#059669" : colors.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.bodyPhotoSummaryTitle, { color: bodyPhotoUri ? "#059669" : colors.foreground }]}>
              {bodyPhotoUri ? t("ref_photo_set") : t("upload_photo")}
            </Text>
            <Text style={[styles.bodyPhotoSummaryHint, { color: colors.mutedForeground }]}>
              {bodyPhotoUri ? t("ref_photo_priority_hint") : t("upload_hint")}
            </Text>
          </View>
          <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
        </View>
      </TouchableOpacity>

      {gender === "female" ? <TouchableOpacity
          activeOpacity={0.78}
          onPress={() => setShowStylingPreferences(true)}
          accessibilityRole="button"
          accessibilityLabel={t("styling_preferences")}
          style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIconWrap, { backgroundColor: colors.accent + "22" }]}><Feather name="sliders" size={16} color={colors.accent} /></View>
            <View style={{ flex: 1 }}><Text style={[styles.sectionTitle, { color: colors.foreground }]}>{t("styling_preferences")}</Text><Text style={[styles.sectionSub, { color: colors.mutedForeground }]}>{t("styling_preferences_hint")}</Text></View>
          </View>
          <View style={styles.stylingPreferencesSummary}>
            <Text numberOfLines={1} style={[styles.stylingPreferencesSummaryText, { color: colors.foreground }]}>{stylingPreferencesSummary}</Text>
            <Feather name="chevron-right" size={17} color={colors.mutedForeground} />
          </View>
        </TouchableOpacity> : null}

      {/* Language */}
      <TouchableOpacity
        onPress={() => setShowLanguagePicker(true)}
        activeOpacity={0.78}
        style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}
      >
        <View style={styles.sectionHeader}>
          <View style={[styles.sectionIconWrap, { backgroundColor: colors.accent + "22" }]}>
            <Feather name="globe" size={16} color={colors.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{t("language_label")}</Text>
            <Text style={[styles.sectionSub, { color: colors.mutedForeground }]}>{t("language_desc")}</Text>
          </View>
        </View>
        <View style={styles.languageSummary}>
          <Text style={[styles.languageSummaryText, { color: colors.foreground }]}>
            {LANG_OPTIONS.find((option) => option.key === lang)?.label}
          </Text>
          <Feather name="chevron-right" size={17} color={colors.mutedForeground} />
        </View>
      </TouchableOpacity>

      {/* Account and security */}
      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.sectionHeader}>
          <View style={[styles.sectionIconWrap, { backgroundColor: colors.accent + "22" }]}>
            <Feather name="key" size={16} color={colors.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{t("account_security")}</Text>
            <Text style={[styles.sectionSub, { color: colors.mutedForeground }]}>{t("account_security_desc")}</Text>
          </View>
        </View>
        <View style={[styles.accountRows, { borderColor: colors.border }]}>
          <TouchableOpacity onPress={() => openAccountEditor("email")} activeOpacity={0.75} style={styles.accountRow}>
            <Feather name="mail" size={17} color={colors.accent} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.accountLabel, { color: colors.mutedForeground }]}>{t("email_address")}</Text>
              <Text numberOfLines={1} style={[styles.accountValue, { color: colors.foreground }]}>{user?.email ?? t("not_set")}</Text>
            </View>
            <Feather name="edit-2" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
          <View style={[styles.accountDivider, { backgroundColor: colors.border }]} />
          <TouchableOpacity onPress={() => openAccountEditor("password")} activeOpacity={0.75} style={styles.accountRow}>
            <Feather name="lock" size={17} color={colors.accent} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.accountLabel, { color: colors.mutedForeground }]}>{t("password")}</Text>
              <Text style={[styles.accountValue, { color: colors.foreground }]}>••••••••</Text>
            </View>
            <Feather name="edit-2" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Settings */}
      <View style={[styles.settingsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {rows.map((row, i) => {
          const border = i < rows.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border };
          const content = <>
            <View style={[styles.rowIcon, { backgroundColor: colors.secondary }]}>
              <Feather name={row.icon} size={16} color={colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowLabel, { color: colors.foreground }]}>{row.label}</Text>
              <Text style={[styles.rowDesc, { color: colors.mutedForeground }]}>
                {row.label === t("privacy")
                  ? t("privacy_short_desc")
                  : row.description}
              </Text>
            </View>
          </>;

          if ("feature" in row && row.feature) {
            const feature = row.feature;
            const joined = joinedFeatures.has(feature);
            const isUpdating = updatingFeature === feature;
            return <View key={row.label} style={[styles.settingsRow, border]}>
              {content}
              <TouchableOpacity
                onPress={() => void toggleUpcomingFeature(feature)}
                disabled={isWaitlistLoading || isUpdating}
                style={[styles.waitlistButton, { backgroundColor: joined ? colors.secondary : colors.primary, borderColor: joined ? colors.border : colors.primary }]}
              >
                <Feather name={joined ? "check" : "clock"} size={12} color={joined ? colors.foreground : colors.primaryForeground} />
                <Text style={[styles.waitlistButtonText, { color: joined ? colors.foreground : colors.primaryForeground }]}>
                  {isUpdating ? t("waitlist_saving") : joined ? t("waitlist_joined") : t("waitlist_join")}
                </Text>
              </TouchableOpacity>
            </View>;
          }

          return <TouchableOpacity
            key={row.label}
            onPress={row.onPress}
            disabled={row.disabled}
            style={[styles.settingsRow, border, row.disabled && { opacity: 0.55 }]}
          >
            {content}
            <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>;
        })}
      </View>

      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Log out"
        activeOpacity={0.75}
        disabled={isSigningOut}
        onPress={() => void handleSignOut()}
        style={[
          styles.logoutButton,
          { borderColor: colors.destructive, opacity: isSigningOut ? 0.6 : 1 },
        ]}
      >
        {isSigningOut ? (
          <ActivityIndicator size="small" color={colors.destructive} />
        ) : (
          <Feather name="log-out" size={18} color={colors.destructive} />
        )}
        <Text style={[styles.logoutButtonText, { color: colors.destructive }]}>
          {isSigningOut ? "Logging out..." : "Log out"}
        </Text>
      </TouchableOpacity>

      <Modal visible={accountEditor !== null} transparent animationType="slide" onRequestClose={closeAccountEditor}>
        <TouchableOpacity activeOpacity={1} onPress={closeAccountEditor} style={styles.sheetBackdrop}>
          <TouchableOpacity
            activeOpacity={1}
            onPress={(event) => event.stopPropagation()}
            style={[styles.sheet, styles.accountSheet, { backgroundColor: colors.card }]}
          >
            <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
            <View style={styles.sheetTitleRow}>
              <Text style={[styles.sheetTitle, { color: colors.foreground }]}>
                {accountEditor === "password" ? t("password") : t("email_address")}
              </Text>
              <TouchableOpacity disabled={emailSaving || passwordSaving} onPress={closeAccountEditor} style={[styles.sheetClose, { backgroundColor: colors.secondary }]}>
                <Feather name="x" size={18} color={colors.foreground} />
              </TouchableOpacity>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.accountForm}>
              {accountEditor === "email" ? <>
                <Text style={[styles.sheetSectionLabel, { color: colors.mutedForeground }]}>{t("email_address")}</Text>
                <TextInput
                  value={draftEmail}
                  onChangeText={setDraftEmail}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  keyboardType="email-address"
                  placeholder="you@example.com"
                  placeholderTextColor={colors.mutedForeground}
                  style={[styles.textInput, { backgroundColor: colors.secondary, color: colors.foreground, borderColor: colors.border }]}
                />
                <Text style={[styles.accountHint, { color: colors.mutedForeground }]}>{t("email_change_hint")}</Text>
                <TouchableOpacity
                  disabled={emailSaving}
                  onPress={() => { void saveEmail(); }}
                  style={[styles.accountSaveButton, { backgroundColor: colors.primary, opacity: emailSaving ? 0.6 : 1 }]}
                >
                  {emailSaving ? <ActivityIndicator size="small" color={colors.primaryForeground} /> : <Text style={[styles.accountSaveButtonText, { color: colors.primaryForeground }]}>{t("update_email")}</Text>}
                </TouchableOpacity>
              </> : null}

              {accountEditor === "password" ? <>
                <View style={[styles.passwordSecurityNote, { backgroundColor: colors.secondary }]}>
                  <Feather name="shield" size={15} color={colors.accent} />
                  <Text style={[styles.accountHint, { color: colors.mutedForeground }]}>{t("password_security_hint")}</Text>
                </View>
                <View style={[styles.passwordInputWrap, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                  <TextInput
                    value={newPassword}
                    onChangeText={setNewPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="new-password"
                    secureTextEntry={!showNewPassword}
                    placeholder={t("new_password")}
                    placeholderTextColor={colors.mutedForeground}
                    style={[styles.passwordInput, { color: colors.foreground }]}
                  />
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={showNewPassword ? t("hide_password") : t("show_password")}
                    onPress={() => setShowNewPassword((visible) => !visible)}
                    style={styles.passwordVisibilityButton}
                  >
                    <Feather name={showNewPassword ? "eye-off" : "eye"} size={18} color={colors.mutedForeground} />
                  </TouchableOpacity>
                </View>
                <TextInput
                  value={confirmNewPassword}
                  onChangeText={setConfirmNewPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="new-password"
                  secureTextEntry={!showNewPassword}
                  placeholder={t("confirm_new_password")}
                  placeholderTextColor={colors.mutedForeground}
                  style={[styles.textInput, { backgroundColor: colors.secondary, color: colors.foreground, borderColor: colors.border }]}
                />
                <TouchableOpacity
                  disabled={passwordSaving}
                  onPress={() => { void saveNewPassword(); }}
                  style={[styles.accountSaveButton, { backgroundColor: colors.primary, opacity: passwordSaving ? 0.6 : 1 }]}
                >
                  {passwordSaving ? <ActivityIndicator size="small" color={colors.primaryForeground} /> : <Text style={[styles.accountSaveButtonText, { color: colors.primaryForeground }]}>{t("update_password")}</Text>}
                </TouchableOpacity>
              </> : null}
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <Modal visible={showLanguagePicker} transparent animationType="slide" onRequestClose={() => setShowLanguagePicker(false)}>
        <TouchableOpacity activeOpacity={1} onPress={() => setShowLanguagePicker(false)} style={styles.sheetBackdrop}>
          <TouchableOpacity activeOpacity={1} onPress={(event) => event.stopPropagation()} style={[styles.sheet, { backgroundColor: colors.card }]}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
            <View style={styles.sheetTitleRow}>
              <Text style={[styles.sheetTitle, { color: colors.foreground }]}>{t("language_label")}</Text>
              <TouchableOpacity onPress={() => setShowLanguagePicker(false)} style={[styles.sheetClose, { backgroundColor: colors.secondary }]}><Feather name="x" size={18} color={colors.foreground} /></TouchableOpacity>
            </View>
            <Text style={[styles.sheetDescription, { color: colors.mutedForeground }]}>{t("language_desc")}</Text>
            {LANG_OPTIONS.map((option) => {
              const selected = option.key === lang;
              return <TouchableOpacity key={option.key} onPress={() => { setLang(option.key); setShowLanguagePicker(false); }} style={[styles.sheetOption, { borderColor: selected ? colors.accent : colors.border, backgroundColor: selected ? colors.accent + "18" : colors.secondary }]}>
                <Text style={styles.langFlag}>{option.flag}</Text><Text style={[styles.sheetOptionText, { color: colors.foreground }]}>{option.label}</Text>{selected ? <Feather name="check" size={18} color={colors.accent} /> : null}
              </TouchableOpacity>;
            })}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <Modal visible={gender === "female" && showStylingPreferences} transparent animationType="slide" onRequestClose={() => setShowStylingPreferences(false)}>
        <TouchableOpacity activeOpacity={1} onPress={() => setShowStylingPreferences(false)} style={styles.sheetBackdrop}>
          <TouchableOpacity activeOpacity={1} onPress={(event) => event.stopPropagation()} style={[styles.sheet, styles.preferencesSheet, { backgroundColor: colors.card }]}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
            <View style={styles.sheetTitleRow}>
              <Text style={[styles.sheetTitle, { color: colors.foreground }]}>{t("styling_preferences")}</Text>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel="Close styling preferences" onPress={() => setShowStylingPreferences(false)} style={[styles.sheetClose, { backgroundColor: colors.secondary }]}>
                <Feather name="x" size={18} color={colors.foreground} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.sheetDescription, { color: colors.mutedForeground }]}>{t("styling_preferences_hint")}</Text>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.preferencesForm}>
              {gender === "female" ? <View style={styles.preferencesGroup}>
                <Text style={[styles.sheetSectionLabel, { color: colors.mutedForeground }]}>{t("hijab_question")}</Text>
                <Text style={[styles.preferenceGroupHint, { color: colors.mutedForeground }]}>{t("hijab_question_hint")}</Text>
                <View style={styles.editorGenderGrid}>{(["always", "no"] as const).map((value) => { const selected = stylingPreferences.hijabPreference === value; return <TouchableOpacity key={value} onPress={() => void setHijabPreference(value)} style={[styles.editorGenderOption, { backgroundColor: selected ? colors.primary : colors.secondary, borderColor: selected ? colors.primary : colors.border }]}><Text style={[styles.editorGenderText, { color: selected ? colors.primaryForeground : colors.foreground }]}>{t(value === "always" ? "hijab_yes_always" : "hijab_no")}</Text></TouchableOpacity>; })}</View>
              </View> : null}
              {([
                ["coverage", t("coverage_label"), [["no_preference", t("pref_none")], ["modest", t("pref_modest")], ["maximum_coverage", t("pref_max_coverage")]]],
                ["silhouette", t("silhouette_label"), [["balanced", t("pref_balanced")], ["fitted", t("pref_fitted")], ["relaxed", t("pref_relaxed")]]],
                ["heels", t("heel_label"), [["flats", t("pref_flats")], ["low_heels", t("pref_low_heels")], ["any", t("pref_any_heels")]]],
              ] as const).map(([key, label, options]) => <View key={key} style={styles.preferencesGroup}><Text style={[styles.sheetSectionLabel, { color: colors.mutedForeground }]}>{label}</Text><View style={styles.editorGenderGrid}>{options.map(([value, optionLabel]) => { const selected = stylingPreferences[key] === value; return <TouchableOpacity key={value} onPress={() => void setStylingPreferences({ ...stylingPreferences, [key]: value })} style={[styles.editorGenderOption, { backgroundColor: selected ? colors.primary : colors.secondary, borderColor: selected ? colors.primary : colors.border }]}><Text style={[styles.editorGenderText, { color: selected ? colors.primaryForeground : colors.foreground }]}>{optionLabel}</Text></TouchableOpacity>; })}</View></View>)}
              {stylingPreferences.excludedShopTypes.length > 0 ? <View style={styles.preferencesGroup}>
                <Text style={[styles.sheetSectionLabel, { color: colors.mutedForeground }]}>NOT SUGGESTING</Text>
                <Text style={[styles.preferenceGroupHint, { color: colors.mutedForeground }]}>Tap a clothing type to allow it in store recommendations again.</Text>
                <View style={styles.editorGenderGrid}>{stylingPreferences.excludedShopTypes.map((type) => <TouchableOpacity key={type} onPress={() => void setStylingPreferences({ ...stylingPreferences, excludedShopTypes: stylingPreferences.excludedShopTypes.filter((value) => value !== type) })} style={[styles.editorGenderOption, { backgroundColor: colors.secondary, borderColor: colors.border }]}><Text style={[styles.editorGenderText, { color: colors.foreground }]}>{shopSuggestionTypeLabel(type)} ×</Text></TouchableOpacity>)}</View>
              </View> : null}
            </ScrollView>
            <TouchableOpacity onPress={() => setShowStylingPreferences(false)} style={[styles.preferencesDoneButton, { backgroundColor: colors.primary }]}>
              <Text style={[styles.preferencesDoneButtonText, { color: colors.primaryForeground }]}>{t("done")}</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <Modal visible={showBodyPhotoManager} transparent animationType="slide" onRequestClose={discardBodyPhotoChanges}>
        <TouchableOpacity activeOpacity={1} onPress={discardBodyPhotoChanges} style={styles.sheetBackdrop}>
          <TouchableOpacity activeOpacity={1} onPress={(event) => event.stopPropagation()} style={[styles.sheet, { backgroundColor: colors.card }]}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
            <View style={styles.sheetTitleRow}>
              <Text style={[styles.sheetTitle, { color: colors.foreground }]}>{t("body_ref")}</Text>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Close body photo manager"
                onPress={discardBodyPhotoChanges}
                style={[styles.sheetClose, { backgroundColor: colors.secondary }]}
              >
                <Feather name="x" size={18} color={colors.foreground} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.sheetDescription, { color: colors.mutedForeground }]}>{t("body_ref_hint")}</Text>

            {draftBodyPhotoUri ? (
              <>
                <View style={[styles.bodyPhotoSheetPreview, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                  <Image
                    source={{ uri: draftBodyPhotoUri }}
                    style={styles.bodyPhotoSheetImage}
                    contentFit="contain"
                  />
                </View>
                <View style={[styles.bodyPhotoSheetStatus, { backgroundColor: "#F0FDF4", borderColor: "#BBF7D0" }]}>
                  <View style={styles.bodyPhotoSheetStatusHeading}>
                    <Feather name="check-circle" size={18} color="#059669" />
                    <Text style={[styles.bodyPhotoSheetStatusTitle, { color: "#059669" }]}>{t("ref_photo_set")}</Text>
                  </View>
                  <Text style={[styles.bodyPhotoSheetStatusText, { color: "#065F46" }]}>{t("ref_photo_priority_hint")}</Text>
                </View>
                {photoLoading ? (
                  <View style={styles.photoLoadingRow}>
                    <ActivityIndicator size="small" color={colors.accent} />
                    <Text style={[styles.photoLoadingText, { color: colors.mutedForeground }]}>{t("processing")}</Text>
                  </View>
                ) : (
                  <>
                    <View style={styles.bodyPhotoSheetActions}>
                      <TouchableOpacity onPress={handleUpload} style={[styles.bodyPhotoSheetButton, { backgroundColor: colors.secondary, borderWidth: 1, borderColor: colors.border }]}>
                        <Feather name="refresh-cw" size={15} color={colors.foreground} />
                        <Text style={[styles.bodyPhotoSheetButtonText, { color: colors.foreground }]}>{t("replace")}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={handleClear} style={[styles.bodyPhotoSheetButton, { backgroundColor: colors.card, borderWidth: 1, borderColor: "#FECACA" }]}>
                        <Feather name="trash-2" size={15} color={colors.destructive} />
                        <Text style={[styles.bodyPhotoSheetButtonText, { color: colors.destructive }]}>{t("remove_btn")}</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </>
            ) : (
              <>
                <View style={[styles.bodyPhotoTip, { backgroundColor: colors.secondary }]}>
                  <Feather name="info" size={14} color={colors.mutedForeground} />
                  <Text style={[styles.bodyPhotoTipText, { color: colors.mutedForeground }]}>{t("upload_hint")}</Text>
                </View>
                <View style={styles.bodyPhotoSheetActions}>
                  <TouchableOpacity onPress={handleCapture} style={[styles.bodyPhotoSheetButton, { backgroundColor: colors.primary }]}>
                    <Feather name="camera" size={15} color={colors.primaryForeground} />
                    <Text style={[styles.bodyPhotoSheetButtonText, { color: colors.primaryForeground }]}>{t("take_photo")}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleUpload} style={[styles.bodyPhotoSheetButton, { backgroundColor: colors.secondary, borderWidth: 1, borderColor: colors.border }]}>
                    <Feather name="upload" size={15} color={colors.accent} />
                    <Text style={[styles.bodyPhotoSheetButtonText, { color: colors.accent }]}>{t("upload_photo")}</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
            {draftBodyPhotoSelection || draftBodyPhotoRemoved ? (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={t("done")}
                disabled={photoLoading}
                onPress={() => { void commitBodyPhotoChanges(); }}
                style={[styles.bodyPhotoDoneButton, { backgroundColor: colors.primary, opacity: photoLoading ? 0.65 : 1 }]}
              >
                {photoLoading ? (
                  <ActivityIndicator size="small" color={colors.primaryForeground} />
                ) : (
                  <Feather name="check" size={17} color={colors.primaryForeground} />
                )}
                <Text style={[styles.bodyPhotoDoneButtonText, { color: colors.primaryForeground }]}>
                  {photoLoading ? t("processing") : t("done")}
                </Text>
              </TouchableOpacity>
            ) : null}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <Modal visible={showPersonalEditor} transparent animationType="slide" onRequestClose={() => setShowPersonalEditor(false)}>
        <TouchableOpacity activeOpacity={1} onPress={() => setShowPersonalEditor(false)} style={styles.sheetBackdrop}>
          <TouchableOpacity activeOpacity={1} onPress={(event) => event.stopPropagation()} style={[styles.sheet, { backgroundColor: colors.card }]}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
            <View style={styles.sheetTitleRow}>
              <Text style={[styles.sheetTitle, { color: colors.foreground }]}>{t("personal_details")}</Text>
              <TouchableOpacity onPress={() => setShowPersonalEditor(false)} style={[styles.sheetClose, { backgroundColor: colors.secondary }]}><Feather name="x" size={18} color={colors.foreground} /></TouchableOpacity>
            </View>
            <Text style={[styles.sheetSectionLabel, { color: colors.mutedForeground }]}>{t("full_name")}</Text>
            <TextInput
              value={draftName}
              onChangeText={setDraftName}
              placeholder={t("name_placeholder")}
              placeholderTextColor={colors.mutedForeground}
              autoCorrect={false}
              returnKeyType="done"
              style={[styles.textInput, { backgroundColor: colors.secondary, color: colors.foreground, borderColor: colors.border }]}
            />
            <Text style={[styles.sheetSectionLabel, { color: colors.mutedForeground }]}>{t("gender_label")}</Text>
            <View style={styles.editorGenderGrid}>
              {GENDER_OPTIONS.map((opt) => {
                const selected = draftGender === opt.key;
                return <TouchableOpacity key={opt.key} onPress={() => setDraftGender(opt.key)} style={[styles.editorGenderOption, { backgroundColor: selected ? colors.primary : colors.secondary, borderColor: selected ? colors.primary : colors.border }]}>
                  <Text style={[styles.editorGenderText, { color: selected ? colors.primaryForeground : colors.foreground }]}>{opt.label}</Text>
                </TouchableOpacity>;
              })}
            </View>
            <Text style={[styles.sheetSectionLabel, { color: colors.mutedForeground }]}>{t("age_label")}</Text>
            <Text style={[styles.agePickerHint, { color: colors.mutedForeground }]}>{t("choose_age")}</Text>
            <View style={[styles.agePickerFrame, { height: AGE_PICKER_HEIGHT }]}>
              <View pointerEvents="none" style={[styles.agePickerSelection, { top: AGE_ITEM_HEIGHT, height: AGE_ITEM_HEIGHT, borderColor: colors.border, backgroundColor: colors.secondary + "80" }]} />
              <Animated.ScrollView
                ref={agePickerRef}
                showsVerticalScrollIndicator={false}
                snapToInterval={AGE_ITEM_HEIGHT}
                decelerationRate="fast"
                scrollEventThrottle={16}
                onScroll={Animated.event(
                  [{ nativeEvent: { contentOffset: { y: ageScrollY } } }],
                  { useNativeDriver: false, listener: commitAgePickerScroll },
                )}
                onMomentumScrollEnd={commitAgePickerScroll}
                onScrollEndDrag={commitAgePickerScroll}
                contentContainerStyle={{ paddingVertical: AGE_ITEM_HEIGHT }}
                style={styles.agePickerScroll}
              >
                {AGE_OPTIONS.map((optionAge, index) => {
                  const inputRange = [
                    (index - 2) * AGE_ITEM_HEIGHT,
                    (index - 1) * AGE_ITEM_HEIGHT,
                    index * AGE_ITEM_HEIGHT,
                    (index + 1) * AGE_ITEM_HEIGHT,
                    (index + 2) * AGE_ITEM_HEIGHT,
                  ];
                  const opacity = ageScrollY.interpolate({ inputRange, outputRange: [0, 0.28, 1, 0.28, 0], extrapolate: "clamp" });
                  const scale = ageScrollY.interpolate({ inputRange, outputRange: [0.72, 0.82, 1, 0.82, 0.72], extrapolate: "clamp" });
                  return <TouchableOpacity key={optionAge} onPress={() => selectAge(optionAge, index)} style={styles.agePickerOption}>
                    <Animated.Text style={[
                      styles.agePickerText,
                      { color: colors.foreground, opacity, transform: [{ scale }] },
                    ]}>{optionAge}</Animated.Text>
                  </TouchableOpacity>;
                })}
              </Animated.ScrollView>
              <LinearGradient pointerEvents="none" colors={[colors.card, colors.card + "00"]} style={styles.agePickerFadeTop} />
              <LinearGradient pointerEvents="none" colors={[colors.card + "00", colors.card]} style={styles.agePickerFadeBottom} />
            </View>
            <TouchableOpacity disabled={profileSaving} onPress={() => { void savePersonalDetails(); }} style={[styles.saveProfileButton, { backgroundColor: colors.primary, opacity: profileSaving ? 0.6 : 1 }]}>
              {profileSaving ? <ActivityIndicator size="small" color={colors.primaryForeground} /> : <Text style={[styles.saveProfileText, { color: colors.primaryForeground }]}>{t("save_changes")}</Text>}
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <Modal visible={showWeatherLocation} transparent animationType="slide" onRequestClose={() => setShowWeatherLocation(false)}>
        <TouchableOpacity activeOpacity={1} onPress={() => setShowWeatherLocation(false)} style={styles.sheetBackdrop}>
          <TouchableOpacity activeOpacity={1} onPress={(event) => event.stopPropagation()} style={[styles.sheet, { backgroundColor: colors.card }]}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
            <View style={styles.sheetTitleRow}><Text style={[styles.sheetTitle, { color: colors.foreground }]}>{t("weather_location_title")}</Text><TouchableOpacity onPress={() => setShowWeatherLocation(false)} style={[styles.sheetClose, { backgroundColor: colors.secondary }]}><Feather name="x" size={18} color={colors.foreground} /></TouchableOpacity></View>
            <Text style={[styles.sheetDescription, { color: colors.mutedForeground }]}>{t("weather_location_prompt")}</Text>
          <TextInput
            value={locationQuery}
            onChangeText={handleLocationQueryChange}
            placeholder={t("city_placeholder")}
            placeholderTextColor={colors.mutedForeground}
            style={[styles.inlineInput, { backgroundColor: colors.secondary, color: colors.foreground, borderColor: colors.border }]}
            autoCapitalize="words"
            returnKeyType="done"
            onSubmitEditing={() => { void saveManualLocation(); }}
          />
          {locationQuery.trim() ? <View style={styles.locationSuggestions}>
            <Text style={[styles.locationSuggestionsLabel, { color: colors.mutedForeground }]}>{t("suggested_places")}</Text>
            {locationSuggestions.map((suggestion) => {
              const subtitle = [suggestion.admin1, suggestion.country].filter(Boolean).join(", ");
              return <TouchableOpacity key={suggestion.id} onPress={() => selectLocationSuggestion(suggestion)} style={[styles.locationSuggestion, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                <Feather name="map-pin" size={16} color={colors.accent} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.locationSuggestionCity, { color: colors.foreground }]}>{suggestion.name}</Text>
                  {subtitle ? <Text style={[styles.locationSuggestionCountry, { color: colors.mutedForeground }]}>{subtitle}</Text> : null}
                </View>
              </TouchableOpacity>;
            })}
            {locationSuggestionsLoading ? <ActivityIndicator size="small" color={colors.accent} /> : null}
            {locationQuery.trim().length > 1 && !locationSuggestionsLoading && locationSuggestions.length === 0 && !selectedLocationQuery ? <Text style={[styles.locationNoSuggestion, { color: colors.mutedForeground }]}>{t("no_city_suggestion")}</Text> : null}
          </View> : null}
          <View style={styles.inlineActions}>
            <TouchableOpacity
              onPress={() => { void useDeviceWeatherLocation(); }}
              disabled={manualLocationLoading}
              style={[styles.inlineButton, { borderColor: colors.border, backgroundColor: colors.secondary }]}
            >
              {manualLocationLoading ? <ActivityIndicator size="small" color={colors.accent} /> : <Feather name="navigation" size={14} color={colors.accent} />}
              <Text style={[styles.inlineButtonText, { color: colors.foreground }]}>{t("use_current_location")}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => { void saveManualLocation(); }}
              disabled={!locationQuery.trim() || manualLocationLoading}
              style={[styles.inlineButton, { borderColor: colors.primary, backgroundColor: colors.primary, opacity: !locationQuery.trim() || manualLocationLoading ? 0.55 : 1 }]}
            >
              <Text style={[styles.inlineButtonText, { color: colors.primaryForeground }]}>{t("save_location")}</Text>
            </TouchableOpacity>
          </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <Modal visible={showBugReport} transparent animationType="slide" onRequestClose={() => setShowBugReport(false)}>
        <TouchableOpacity activeOpacity={1} onPress={() => setShowBugReport(false)} style={styles.sheetBackdrop}>
          <TouchableOpacity activeOpacity={1} onPress={(event) => event.stopPropagation()} style={[styles.sheet, { backgroundColor: colors.card }]}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
            <View style={styles.sheetTitleRow}><Text style={[styles.sheetTitle, { color: colors.foreground }]}>{t("report_bug")}</Text><TouchableOpacity onPress={() => setShowBugReport(false)} style={[styles.sheetClose, { backgroundColor: colors.secondary }]}><Feather name="x" size={18} color={colors.foreground} /></TouchableOpacity></View>
          <Text style={[styles.inlinePanelDescription, { color: colors.mutedForeground }]}>{t("report_bug_prompt")}</Text>
          <TextInput
            value={bugDescription}
            onChangeText={setBugDescription}
            placeholder={t("bug_placeholder")}
            placeholderTextColor={colors.mutedForeground}
            multiline
            textAlignVertical="top"
            style={[styles.inlineInput, styles.bugInput, { backgroundColor: colors.secondary, color: colors.foreground, borderColor: colors.border }]}
          />
          <View style={styles.inlineActions}>
            <TouchableOpacity
              onPress={() => { void chooseBugScreenshot(); }}
              style={[styles.inlineButton, { borderColor: colors.border, backgroundColor: colors.secondary }]}
            >
              <Feather name="image" size={14} color={colors.accent} />
              <Text style={[styles.inlineButtonText, { color: colors.foreground }]}>{bugScreenshotUri ? "Replace screenshot" : "Add screenshot"}</Text>
            </TouchableOpacity>
            {bugScreenshotUri ? (
              <TouchableOpacity onPress={() => setBugScreenshotUri(null)} style={[styles.inlineButton, { borderColor: colors.border, backgroundColor: colors.secondary }]}>
                <Text style={[styles.inlineButtonText, { color: colors.destructive }]}>{t("remove")}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          {bugScreenshotUri ? <Image source={{ uri: bugScreenshotUri }} style={styles.bugScreenshot} contentFit="cover" /> : null}
          <TouchableOpacity
            onPress={() => { void sendBugReport(); }}
            disabled={bugSubmitting}
            style={[styles.inlinePrimaryButton, { backgroundColor: colors.primary, opacity: bugSubmitting ? 0.6 : 1 }]}
          >
            {bugSubmitting ? <ActivityIndicator size="small" color={colors.primaryForeground} /> : <Text style={[styles.inlinePrimaryText, { color: colors.primaryForeground }]}>{t("send_report")}</Text>}
          </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 18, gap: 16 },
  backBtn: { alignSelf: "flex-start", marginBottom: 8 },
  profileCard: { alignItems: "center", gap: 4, paddingVertical: 12 },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    alignItems: "center", justifyContent: "center", marginBottom: 4,
  },
  avatarText: { fontSize: 28, fontWeight: "700" },
  name: { fontSize: 22, fontWeight: "700" },
  profileMeta: { fontSize: 13, fontWeight: "500", marginTop: 1 },
  location: { fontSize: 13 },
  statsRow: { flexDirection: "row", alignItems: "center", gap: 24, marginTop: 10 },
  stat: { alignItems: "center", gap: 2 },
  statNumber: { fontSize: 24, fontWeight: "800" },
  statLabel: { fontSize: 12, fontWeight: "500" },
  dividerV: { width: 1, height: 32 },
  section: { borderRadius: 18, borderWidth: 1, padding: 16, gap: 14 },
  sectionHeader: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  sectionIconWrap: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  sectionTitle: { fontSize: 15, fontWeight: "700" },
  sectionSub: { fontSize: 12, lineHeight: 17, marginTop: 2 },
  fieldGroup: { gap: 7 },
  fieldLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 0.8 },
  profileDetailsEditor: {
    minHeight: 72, borderWidth: 1, borderRadius: 16, padding: 12,
    flexDirection: "row", alignItems: "center", gap: 12,
  },
  profileDetailsIcon: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  profileDetailsValue: { fontWeight: "700", fontSize: 15 },
  profileDetailsHint: { fontSize: 13, marginTop: 3 },
  textInput: {
    borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11,
    fontSize: 15, fontWeight: "500",
  },
  genderRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  genderPill: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 100, borderWidth: 1,
  },
  genderPillText: { fontSize: 13, fontWeight: "600" },
  ageRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  ageInput: {
    borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11,
    fontSize: 15, fontWeight: "500", width: 80, textAlign: "center",
  },
  ageHint: { fontSize: 12 },
  profileTip: {
    flexDirection: "row", alignItems: "flex-start", gap: 8,
    padding: 10, borderRadius: 10, borderWidth: 1,
  },
  profileTipText: { flex: 1, fontSize: 12, lineHeight: 17 },
  bodyPhotoTip: {
    flexDirection: "row", alignItems: "flex-start", gap: 10,
    padding: 12, borderRadius: 12,
  },
  bodyPhotoTipText: { flex: 1, fontSize: 12, lineHeight: 18 },
  photoLoadingRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 },
  photoLoadingText: { fontSize: 14 },
  bodyPhotoSummary: { minHeight: 70, borderWidth: 1, borderRadius: 16, padding: 12, flexDirection: "row", alignItems: "center", gap: 12 },
  bodyPhotoStatusIcon: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  bodyPhotoSummaryTitle: { fontSize: 14, fontWeight: "700" },
  bodyPhotoSummaryHint: { fontSize: 12, lineHeight: 17, marginTop: 2 },
  bodyPhotoSheetPreview: { height: 240, borderWidth: 1, borderRadius: 16, overflow: "hidden" },
  bodyPhotoSheetImage: { width: "100%", height: "100%" },
  bodyPhotoSheetStatus: { borderWidth: 1, borderRadius: 16, padding: 15, gap: 7 },
  bodyPhotoSheetStatusHeading: { flexDirection: "row", alignItems: "center", gap: 8 },
  bodyPhotoSheetStatusTitle: { fontSize: 15, fontWeight: "800" },
  bodyPhotoSheetStatusText: { fontSize: 13, lineHeight: 19 },
  bodyPhotoSheetActions: { flexDirection: "row", gap: 10, marginTop: 2 },
  bodyPhotoSheetButton: { flex: 1, minHeight: 48, borderRadius: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingHorizontal: 12 },
  bodyPhotoSheetButtonText: { fontSize: 14, fontWeight: "700" },
  bodyPhotoDoneButton: { minHeight: 52, borderRadius: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 2 },
  bodyPhotoDoneButtonText: { fontSize: 15, fontWeight: "800" },
  languageSummary: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 2 },
  languageSummaryText: { fontSize: 14, fontWeight: "700" },
  stylingPreferencesSummary: { flexDirection: "row", alignItems: "center", gap: 10, paddingTop: 2 },
  stylingPreferencesSummaryText: { flex: 1, fontSize: 14, fontWeight: "700" },
  accountRows: { borderWidth: 1, borderRadius: 14, overflow: "hidden" },
  accountRow: { minHeight: 64, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14 },
  accountDivider: { height: 1, marginLeft: 43 },
  accountLabel: { fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  accountValue: { fontSize: 14, fontWeight: "700", marginTop: 3 },
  langPill: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 100, borderWidth: 1,
  },
  langFlag: { fontSize: 16 },
  langPillText: { fontSize: 14, fontWeight: "600" },
  settingsCard: { borderRadius: 18, borderWidth: 1, overflow: "hidden" },
  settingsRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16 },
  logoutButton: {
    minHeight: 52, borderRadius: 16, borderWidth: 1,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9,
  },
  logoutButtonText: { fontSize: 15, fontWeight: "700" },
  rowIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  rowLabel: { fontSize: 14, fontWeight: "600", marginBottom: 1 },
  rowDesc: { fontSize: 12 },
  waitlistButton: { flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 1, borderRadius: 10, paddingHorizontal: 9, paddingVertical: 7 },
  waitlistButtonText: { fontSize: 11, fontWeight: "700" },
  inlinePanel: { borderWidth: 1, borderRadius: 18, padding: 16, gap: 10 },
  inlinePanelTitle: { fontSize: 16, fontWeight: "700" },
  inlinePanelDescription: { fontSize: 13, lineHeight: 19 },
  inlineInput: { minHeight: 44, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, fontSize: 14 },
  bugInput: { minHeight: 100, paddingTop: 12 },
  locationSuggestions: { marginTop: 2, gap: 7 },
  locationSuggestionsLabel: { fontSize: 12, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.7 },
  locationSuggestion: { borderWidth: 1, borderRadius: 13, padding: 11, flexDirection: "row", alignItems: "center", gap: 10 },
  locationSuggestionCity: { fontSize: 14, fontWeight: "700" },
  locationSuggestionCountry: { fontSize: 12, marginTop: 1 },
  locationNoSuggestion: { fontSize: 13, lineHeight: 19 },
  inlineActions: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  inlineButton: {
    minHeight: 40, borderRadius: 11, borderWidth: 1, paddingHorizontal: 12,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
  },
  inlineButtonText: { fontSize: 13, fontWeight: "700" },
  inlinePrimaryButton: { minHeight: 42, borderRadius: 12, alignItems: "center", justifyContent: "center", paddingHorizontal: 14 },
  inlinePrimaryText: { fontSize: 14, fontWeight: "700" },
  bugScreenshot: { width: 96, height: 72, borderRadius: 10, alignSelf: "flex-start" },
  sheetBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(20, 15, 12, 0.42)" },
  sheet: { borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 28, gap: 12 },
  preferencesSheet: { maxHeight: "92%" },
  preferencesForm: { gap: 16, paddingBottom: 4 },
  preferencesGroup: { gap: 9 },
  preferenceGroupHint: { fontSize: 12, lineHeight: 18 },
  preferencesDoneButton: { minHeight: 50, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  preferencesDoneButtonText: { fontSize: 15, fontWeight: "800" },
  accountSheet: { maxHeight: "92%" },
  accountForm: { gap: 12, paddingBottom: 8 },
  accountHint: { flex: 1, fontSize: 12, lineHeight: 18 },
  accountSaveButton: { minHeight: 48, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  accountSaveButtonText: { fontSize: 14, fontWeight: "800" },
  passwordSecurityNote: { flexDirection: "row", alignItems: "flex-start", gap: 9, padding: 12, borderRadius: 12 },
  passwordInputWrap: { minHeight: 48, borderWidth: 1, borderRadius: 12, flexDirection: "row", alignItems: "center" },
  passwordInput: { flex: 1, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, fontWeight: "500" },
  passwordVisibilityButton: { width: 48, alignSelf: "stretch", alignItems: "center", justifyContent: "center" },
  sheetHandle: { alignSelf: "center", width: 42, height: 4, borderRadius: 99, marginBottom: 2 },
  sheetTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sheetTitle: { fontSize: 20, fontWeight: "800" },
  sheetDescription: { fontSize: 13, lineHeight: 19, marginBottom: 4 },
  sheetClose: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  sheetSectionLabel: { fontSize: 12, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.8, marginTop: 8, marginBottom: -3 },
  editorGenderGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  editorGenderOption: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 11 },
  editorGenderText: { fontSize: 13, fontWeight: "700" },
  agePickerHint: { fontSize: 13, marginBottom: 0 },
  agePickerFrame: { position: "relative", overflow: "hidden" },
  agePickerScroll: { flex: 1, zIndex: 2 },
  agePickerSelection: { position: "absolute", alignSelf: "center", width: 110, zIndex: 1, borderTopWidth: 1, borderBottomWidth: 1, borderRadius: 14 },
  agePickerOption: { height: AGE_ITEM_HEIGHT, alignItems: "center", justifyContent: "center" },
  agePickerText: { fontSize: 38, fontWeight: "700" },
  agePickerFadeTop: { position: "absolute", zIndex: 3, top: 0, left: 0, right: 0, height: AGE_ITEM_HEIGHT, opacity: 0.94 },
  agePickerFadeBottom: { position: "absolute", zIndex: 3, bottom: 0, left: 0, right: 0, height: AGE_ITEM_HEIGHT, opacity: 0.94 },
  saveProfileButton: { marginTop: 8, minHeight: 50, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  saveProfileText: { fontWeight: "800", fontSize: 15 },
  sheetOption: { minHeight: 58, borderWidth: 1, borderRadius: 15, paddingHorizontal: 15, flexDirection: "row", alignItems: "center", gap: 11 },
  sheetOptionText: { flex: 1, fontSize: 15, fontWeight: "700" },
});
