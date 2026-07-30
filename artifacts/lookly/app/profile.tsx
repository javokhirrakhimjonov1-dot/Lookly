import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { type UpcomingFeature, useFeatureWaitlist } from "@/contexts/FeatureWaitlistContext";
import { type Gender, useUserProfile } from "@/contexts/UserProfileContext";
import { type Language, useLanguage } from "@/contexts/LanguageContext";
import { submitBugReport } from "@/contexts/serverSync";

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

export default function ProfileScreen() {
  const colors = useColors();
  const { t, lang, setLang } = useLanguage();
  const insets = useSafeAreaInsets();
  const { items } = useWardrobe();
  const { looks } = useSocial();
  const { city, setManualLocation, useCurrentLocation } = useWeather();
  const { joinedFeatures, isLoading: isWaitlistLoading, updatingFeature, toggleWaitlist } = useFeatureWaitlist();
  const {
    fullName,
    gender,
    age,
    bodyPhotoUri,
    setFullName,
    setGender,
    setAge,
    uploadBodyPhoto,
    captureBodyPhoto,
    clearBodyPhoto,
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
  const [localName, setLocalName] = useState(fullName);
  const [localAge, setLocalAge] = useState(age != null ? String(age) : "");
  const [showWeatherLocation, setShowWeatherLocation] = useState(false);
  const [locationQuery, setLocationQuery] = useState("");
  const [manualLocationLoading, setManualLocationLoading] = useState(false);
  const [showBugReport, setShowBugReport] = useState(false);
  const [bugDescription, setBugDescription] = useState("");
  const [bugScreenshotUri, setBugScreenshotUri] = useState<string | null>(null);
  const [bugSubmitting, setBugSubmitting] = useState(false);

  const topPad = getTopPadding(insets.top);
  const myLooks = looks.filter((l) => l.isOwn);
  const initials = fullName ? getInitials(fullName) : "?";
  const displayName = fullName || "Your Profile";
  const firstName = fullName ? fullName.trim().split(/\s+/)[0] : null;

  const handleNameBlur = async () => {
    if (localName !== fullName) await setFullName(localName.trim());
  };

  const handleAgeBlur = async () => {
    const parsed = parseInt(localAge, 10);
    const valid = !isNaN(parsed) && parsed >= 13 && parsed <= 99;
    const newAge = valid ? parsed : null;
    if (newAge !== age) await setAge(newAge);
    if (!valid) setLocalAge(age != null ? String(age) : "");
  };

  const handleUpload = async () => {
    // iPhone and in-app browsers do not reliably report when a file chooser is
    // cancelled. Do not turn the screen into a blocking "Processing" state
    // until an image actually exists; cancelling must leave both choices usable.
    try {
      await uploadBodyPhoto();
    } catch {
      Alert.alert("Photo not added", "Please try again, or open Lookly in Safari or Chrome.");
    }
  };

  const handleCapture = async () => {
    try {
      await captureBodyPhoto();
    } catch {
      Alert.alert("Photo not added", "Please try again, or open Lookly in Safari or Chrome.");
    }
  };

  const handleClear = async () => {
    // Keep this a direct action. Alert dialogs are unreliable in the web build
    // and previously made the Remove button appear to do nothing.
    setPhotoLoading(true);
    try {
      await clearBodyPhoto();
    } finally {
      setPhotoLoading(false);
    }
  };

  const saveManualLocation = async () => {
    setManualLocationLoading(true);
    try {
      const result = await setManualLocation(locationQuery);
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
        "Your privacy",
        "Your wardrobe, personal names, body reference photo and saved looks are private to your signed-in account. Other Lookly users cannot browse them."
      ),
      disabled: false,
    },
    {
      icon: "cloud" as const,
      label: t("weather_loc"),
      description: `${city} · Tap to refresh`,
      onPress: () => setShowWeatherLocation((visible) => !visible),
      disabled: false,
    },
    {
      icon: "alert-circle" as const,
      label: "Report a bug",
      description: "Describe a problem and attach a screenshot.",
      onPress: () => setShowBugReport((visible) => !visible),
      disabled: false,
    },
    {
      icon: "info" as const,
      label: t("about_lookly"),
      description: t("version"),
      onPress: () => Alert.alert("About Lookly", "Lookly 1.0.0 pilot\nYour wardrobe remains private to your account."),
      disabled: false,
    },
  ];

  return (
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
              age ? `${age} yrs` : null,
            ].filter(Boolean).join(" · ")}
          </Text>
        ) : null}
        <Text style={[styles.location, { color: colors.mutedForeground }]}>{city}</Text>
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={[styles.statNumber, { color: colors.foreground }]}>{items.length}</Text>
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

        {/* Full name */}
        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>{t("full_name")}</Text>
          <TextInput
            style={[styles.textInput, { backgroundColor: colors.secondary, color: colors.foreground, borderColor: colors.border }]}
            value={localName}
            onChangeText={setLocalName}
            onBlur={handleNameBlur}
            placeholder={t("name_placeholder")}
            placeholderTextColor={colors.mutedForeground}
            autoCorrect={false}
            returnKeyType="done"
          />
        </View>

        {/* Gender */}
        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>{t("gender_label")}</Text>
          <View style={styles.genderRow}>
            {GENDER_OPTIONS.map((opt) => {
              const active = gender === opt.key;
              return (
                <TouchableOpacity
                  key={opt.key}
                  onPress={() => setGender(active ? null : opt.key)}
                  style={[
                    styles.genderPill,
                    {
                      backgroundColor: active ? colors.primary : colors.secondary,
                      borderColor: active ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.genderPillText,
                      { color: active ? colors.primaryForeground : colors.mutedForeground },
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Age */}
        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>{t("age_label")}</Text>
          <View style={styles.ageRow}>
            <TextInput
              style={[styles.ageInput, { backgroundColor: colors.secondary, color: colors.foreground, borderColor: colors.border }]}
              value={localAge}
              onChangeText={setLocalAge}
              onBlur={handleAgeBlur}
              placeholder={t("age_placeholder")}
              placeholderTextColor={colors.mutedForeground}
              keyboardType="number-pad"
              maxLength={3}
              returnKeyType="done"
            />
            <Text style={[styles.ageHint, { color: colors.mutedForeground }]}>{t("years_old_hint")}</Text>
          </View>
        </View>

        {(fullName || gender || age) ? (
          <View style={[styles.profileTip, { backgroundColor: "#F0FDF4", borderColor: "#BBF7D0" }]}>
            <Feather name="check-circle" size={13} color="#059669" />
            <Text style={[styles.profileTipText, { color: "#065F46" }]}>
              {t("ai_tailored")}{" "}
              {[firstName, gender && gender !== "prefer_not_to_say" ? GENDER_OPTIONS.find((g) => g.key === gender)?.label.toLowerCase() : null, age ? `${age}` : null].filter(Boolean).join(", ")}
            </Text>
          </View>
        ) : (
          <View style={[styles.profileTip, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
            <Feather name="info" size={13} color={colors.mutedForeground} />
            <Text style={[styles.profileTipText, { color: colors.mutedForeground }]}>
              {t("fill_details")}
            </Text>
          </View>
        )}
      </View>

      {/* Body Reference Photo */}
      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
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

        {bodyPhotoUri ? (
          <View style={styles.photoPreviewRow}>
            <Image
              source={{ uri: bodyPhotoUri }}
              style={[styles.bodyThumb, { borderColor: colors.accent }]}
              contentFit="cover"
            />
            <View style={styles.photoInfo}>
              <View style={[styles.photoBadge, { backgroundColor: "#F0FDF4", borderColor: "#BBF7D0" }]}>
                <Feather name="check-circle" size={13} color="#059669" />
                <Text style={[styles.photoBadgeText, { color: "#059669" }]}>{t("ref_photo_set")}</Text>
              </View>
              <Text style={[styles.photoHint, { color: colors.mutedForeground }]}>
                {t("ai_uses_body")}
              </Text>
              <View style={styles.photoActions}>
                <TouchableOpacity
                  onPress={handleUpload}
                  disabled={photoLoading}
                  style={[styles.photoActionBtn, { borderColor: colors.border }]}
                >
                  <Feather name="refresh-cw" size={13} color={colors.accent} />
                  <Text style={[styles.photoActionText, { color: colors.accent }]}>{t("replace")}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => { void handleClear(); }}
                  disabled={photoLoading}
                  style={[styles.photoActionBtn, { borderColor: "#FECACA" }]}
                >
                  <Feather name="trash-2" size={13} color={colors.destructive} />
                  <Text style={[styles.photoActionText, { color: colors.destructive }]}>{t("remove_btn")}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ) : (
          <>
            <View style={[styles.bodyPhotoTip, { backgroundColor: colors.secondary }]}>
              <Feather name="info" size={14} color={colors.mutedForeground} />
              <Text style={[styles.bodyPhotoTipText, { color: colors.mutedForeground }]}>
                {t("upload_hint")}
              </Text>
            </View>
            {photoLoading ? (
              <View style={styles.photoLoadingRow}>
                <ActivityIndicator size="small" color={colors.accent} />
                <Text style={[styles.photoLoadingText, { color: colors.mutedForeground }]}>{t("processing")}</Text>
              </View>
            ) : (
              <View style={styles.photoUploadBtns}>
                <TouchableOpacity
                  onPress={handleCapture}
                  style={[styles.uploadBtn, { backgroundColor: colors.primary }]}
                >
                  <Feather name="camera" size={15} color={colors.primaryForeground} />
                  <Text style={[styles.uploadBtnText, { color: colors.primaryForeground }]}>{t("take_photo")}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleUpload}
                  style={[styles.uploadBtn, { backgroundColor: colors.secondary, borderWidth: 1, borderColor: colors.border }]}
                >
                  <Feather name="upload" size={15} color={colors.accent} />
                  <Text style={[styles.uploadBtnText, { color: colors.accent }]}>{t("upload_photo")}</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
      </View>

      {/* Language */}
      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.sectionHeader}>
          <View style={[styles.sectionIconWrap, { backgroundColor: colors.accent + "22" }]}>
            <Feather name="globe" size={16} color={colors.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{t("language_label")}</Text>
            <Text style={[styles.sectionSub, { color: colors.mutedForeground }]}>{t("language_desc")}</Text>
          </View>
        </View>
        <View style={styles.langRow}>
          {LANG_OPTIONS.map((opt) => {
            const active = lang === opt.key;
            return (
              <TouchableOpacity
                key={opt.key}
                onPress={() => setLang(opt.key)}
                style={[
                  styles.langPill,
                  {
                    backgroundColor: active ? colors.primary : colors.secondary,
                    borderColor: active ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text style={styles.langFlag}>{opt.flag}</Text>
                <Text
                  style={[
                    styles.langPillText,
                    { color: active ? colors.primaryForeground : colors.mutedForeground },
                  ]}
                >
                  {opt.label}
                </Text>
                {active && (
                  <Feather name="check" size={12} color={colors.primaryForeground} />
                )}
              </TouchableOpacity>
            );
          })}
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
                  ? "Your wardrobe, photos and saved looks are private to your account."
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

      {showWeatherLocation ? (
        <View style={[styles.inlinePanel, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.inlinePanelTitle, { color: colors.foreground }]}>Weather location</Text>
          <Text style={[styles.inlinePanelDescription, { color: colors.mutedForeground }]}>
            Search for a city, or use your phone&apos;s current location.
          </Text>
          <TextInput
            value={locationQuery}
            onChangeText={setLocationQuery}
            placeholder="e.g. Samarkand, Uzbekistan"
            placeholderTextColor={colors.mutedForeground}
            style={[styles.inlineInput, { backgroundColor: colors.secondary, color: colors.foreground, borderColor: colors.border }]}
            autoCapitalize="words"
            returnKeyType="done"
            onSubmitEditing={() => { void saveManualLocation(); }}
          />
          <View style={styles.inlineActions}>
            <TouchableOpacity
              onPress={() => { void useDeviceWeatherLocation(); }}
              disabled={manualLocationLoading}
              style={[styles.inlineButton, { borderColor: colors.border, backgroundColor: colors.secondary }]}
            >
              {manualLocationLoading ? <ActivityIndicator size="small" color={colors.accent} /> : <Feather name="navigation" size={14} color={colors.accent} />}
              <Text style={[styles.inlineButtonText, { color: colors.foreground }]}>Use current location</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => { void saveManualLocation(); }}
              disabled={!locationQuery.trim() || manualLocationLoading}
              style={[styles.inlineButton, { borderColor: colors.primary, backgroundColor: colors.primary, opacity: !locationQuery.trim() || manualLocationLoading ? 0.55 : 1 }]}
            >
              <Text style={[styles.inlineButtonText, { color: colors.primaryForeground }]}>Save location</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {showBugReport ? (
        <View style={[styles.inlinePanel, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.inlinePanelTitle, { color: colors.foreground }]}>Report a bug</Text>
          <Text style={[styles.inlinePanelDescription, { color: colors.mutedForeground }]}>Tell us what happened. A screenshot is optional.</Text>
          <TextInput
            value={bugDescription}
            onChangeText={setBugDescription}
            placeholder="What were you trying to do? What happened instead?"
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
                <Text style={[styles.inlineButtonText, { color: colors.destructive }]}>Remove</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          {bugScreenshotUri ? <Image source={{ uri: bugScreenshotUri }} style={styles.bugScreenshot} contentFit="cover" /> : null}
          <TouchableOpacity
            onPress={() => { void sendBugReport(); }}
            disabled={bugSubmitting}
            style={[styles.inlinePrimaryButton, { backgroundColor: colors.primary, opacity: bugSubmitting ? 0.6 : 1 }]}
          >
            {bugSubmitting ? <ActivityIndicator size="small" color={colors.primaryForeground} /> : <Text style={[styles.inlinePrimaryText, { color: colors.primaryForeground }]}>Send report</Text>}
          </TouchableOpacity>
        </View>
      ) : null}
    </ScrollView>
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
  photoUploadBtns: { flexDirection: "row", gap: 10 },
  uploadBtn: {
    flex: 1, flexDirection: "row", alignItems: "center",
    justifyContent: "center", gap: 7, paddingVertical: 12, borderRadius: 12,
  },
  uploadBtnText: { fontSize: 14, fontWeight: "600" },
  photoLoadingRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 },
  photoLoadingText: { fontSize: 14 },
  photoPreviewRow: { flexDirection: "row", gap: 14, alignItems: "flex-start" },
  bodyThumb: { width: 80, height: 120, borderRadius: 14, borderWidth: 2, flexShrink: 0 },
  photoInfo: { flex: 1, gap: 8 },
  photoBadge: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 100, borderWidth: 1,
    alignSelf: "flex-start",
  },
  photoBadgeText: { fontSize: 12, fontWeight: "600" },
  photoHint: { fontSize: 12, lineHeight: 17 },
  photoActions: { flexDirection: "row", gap: 8 },
  photoActionBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1,
  },
  photoActionText: { fontSize: 12, fontWeight: "600" },
  langRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  langPill: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 100, borderWidth: 1,
  },
  langFlag: { fontSize: 16 },
  langPillText: { fontSize: 14, fontWeight: "600" },
  settingsCard: { borderRadius: 18, borderWidth: 1, overflow: "hidden" },
  settingsRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16 },
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
  inlineActions: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  inlineButton: {
    minHeight: 40, borderRadius: 11, borderWidth: 1, paddingHorizontal: 12,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
  },
  inlineButtonText: { fontSize: 13, fontWeight: "700" },
  inlinePrimaryButton: { minHeight: 42, borderRadius: 12, alignItems: "center", justifyContent: "center", paddingHorizontal: 14 },
  inlinePrimaryText: { fontSize: 14, fontWeight: "700" },
  bugScreenshot: { width: 96, height: 72, borderRadius: 10, alignSelf: "flex-start" },
});
