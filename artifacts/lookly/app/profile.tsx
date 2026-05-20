import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
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
import { useColors } from "@/hooks/useColors";
import { useWardrobe } from "@/contexts/WardrobeContext";
import { useSocial } from "@/contexts/SocialContext";
import { type Gender, useUserProfile } from "@/contexts/UserProfileContext";

const GENDER_OPTIONS: { key: Gender; label: string }[] = [
  { key: "male", label: "Male" },
  { key: "female", label: "Female" },
  { key: "non-binary", label: "Non-binary" },
  { key: "prefer_not_to_say", label: "Prefer not to say" },
];

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { items } = useWardrobe();
  const { looks } = useSocial();
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

  const [photoLoading, setPhotoLoading] = useState(false);
  const [localName, setLocalName] = useState(fullName);
  const [localAge, setLocalAge] = useState(age != null ? String(age) : "");

  const topPad = Platform.OS === "web" ? 67 : insets.top;
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
    setPhotoLoading(true);
    try { await uploadBodyPhoto(); } finally { setPhotoLoading(false); }
  };

  const handleCapture = async () => {
    setPhotoLoading(true);
    try { await captureBodyPhoto(); } finally { setPhotoLoading(false); }
  };

  const handleClear = () => {
    Alert.alert(
      "Remove body photo?",
      "Outfit previews will use a generic model instead of your reference photo.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Remove", style: "destructive", onPress: clearBodyPhoto },
      ]
    );
  };

  const rows = [
    { icon: "bell" as const, label: "Deal notifications", description: "Get alerts for new Tashkent discounts" },
    { icon: "cloud" as const, label: "Weather location", description: "Auto-detected · fallback to Tashkent" },
    { icon: "shield" as const, label: "Privacy", description: "Manage who sees your looks" },
    { icon: "info" as const, label: "About Lookly", description: "Version 1.0.0" },
  ];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={[
        styles.content,
        { paddingTop: topPad + 16, paddingBottom: Platform.OS === "web" ? 60 : insets.bottom + 40 },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
        <Feather name="arrow-left" size={22} color={colors.foreground} />
      </TouchableOpacity>

      {/* Profile card */}
      <View style={styles.profileCard}>
        <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
          <Text style={[styles.avatarText, { color: colors.primaryForeground }]}>{initials}</Text>
        </View>
        <Text style={[styles.name, { color: colors.foreground }]}>{displayName}</Text>
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
        <Text style={[styles.location, { color: colors.mutedForeground }]}>Tashkent, Uzbekistan</Text>
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={[styles.statNumber, { color: colors.foreground }]}>{items.length}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Items</Text>
          </View>
          <View style={[styles.dividerV, { backgroundColor: colors.border }]} />
          <View style={styles.stat}>
            <Text style={[styles.statNumber, { color: colors.foreground }]}>{myLooks.length}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>My Looks</Text>
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
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>About You</Text>
            <Text style={[styles.sectionSub, { color: colors.mutedForeground }]}>
              Helps personalise outfit suggestions and AI model previews
            </Text>
          </View>
        </View>

        {/* Full name */}
        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>FULL NAME</Text>
          <TextInput
            style={[styles.textInput, { backgroundColor: colors.secondary, color: colors.foreground, borderColor: colors.border }]}
            value={localName}
            onChangeText={setLocalName}
            onBlur={handleNameBlur}
            placeholder="e.g. Dilnoza Yusupova"
            placeholderTextColor={colors.mutedForeground}
            autoCorrect={false}
            returnKeyType="done"
          />
        </View>

        {/* Gender */}
        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>GENDER</Text>
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
          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>AGE</Text>
          <View style={styles.ageRow}>
            <TextInput
              style={[styles.ageInput, { backgroundColor: colors.secondary, color: colors.foreground, borderColor: colors.border }]}
              value={localAge}
              onChangeText={setLocalAge}
              onBlur={handleAgeBlur}
              placeholder="e.g. 24"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="number-pad"
              maxLength={3}
              returnKeyType="done"
            />
            <Text style={[styles.ageHint, { color: colors.mutedForeground }]}>years old · ages 13–99</Text>
          </View>
        </View>

        {(fullName || gender || age) ? (
          <View style={[styles.profileTip, { backgroundColor: "#F0FDF4", borderColor: "#BBF7D0" }]}>
            <Feather name="check-circle" size={13} color="#059669" />
            <Text style={[styles.profileTipText, { color: "#065F46" }]}>
              AI outfit previews will be tailored for{" "}
              {[firstName, gender && gender !== "prefer_not_to_say" ? GENDER_OPTIONS.find((g) => g.key === gender)?.label.toLowerCase() : null, age ? `age ${age}` : null].filter(Boolean).join(", ")}
            </Text>
          </View>
        ) : (
          <View style={[styles.profileTip, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
            <Feather name="info" size={13} color={colors.mutedForeground} />
            <Text style={[styles.profileTipText, { color: colors.mutedForeground }]}>
              Fill in your details so the AI can generate outfit previews that look right for you
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
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Body Reference Photo</Text>
            <Text style={[styles.sectionSub, { color: colors.mutedForeground }]}>
              Used to personalise outfit previews so the model resembles you
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
                <Text style={[styles.photoBadgeText, { color: "#059669" }]}>Reference photo set</Text>
              </View>
              <Text style={[styles.photoHint, { color: colors.mutedForeground }]}>
                AI previews will use your body type and appearance as a guide
              </Text>
              <View style={styles.photoActions}>
                <TouchableOpacity
                  onPress={handleUpload}
                  disabled={photoLoading}
                  style={[styles.photoActionBtn, { borderColor: colors.border }]}
                >
                  <Feather name="refresh-cw" size={13} color={colors.accent} />
                  <Text style={[styles.photoActionText, { color: colors.accent }]}>Replace</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleClear}
                  style={[styles.photoActionBtn, { borderColor: "#FECACA" }]}
                >
                  <Feather name="trash-2" size={13} color="#DC2626" />
                  <Text style={[styles.photoActionText, { color: "#DC2626" }]}>Remove</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ) : (
          <>
            <View style={[styles.bodyPhotoTip, { backgroundColor: colors.secondary }]}>
              <Feather name="info" size={14} color={colors.mutedForeground} />
              <Text style={[styles.bodyPhotoTipText, { color: colors.mutedForeground }]}>
                Upload a clear, well-lit full-body photo standing straight. The AI will use your body type, skin tone, and hair to generate a personalised outfit preview.
              </Text>
            </View>
            {photoLoading ? (
              <View style={styles.photoLoadingRow}>
                <ActivityIndicator size="small" color={colors.accent} />
                <Text style={[styles.photoLoadingText, { color: colors.mutedForeground }]}>Processing...</Text>
              </View>
            ) : (
              <View style={styles.photoUploadBtns}>
                <TouchableOpacity
                  onPress={handleCapture}
                  style={[styles.uploadBtn, { backgroundColor: colors.primary }]}
                >
                  <Feather name="camera" size={15} color={colors.primaryForeground} />
                  <Text style={[styles.uploadBtnText, { color: colors.primaryForeground }]}>Take photo</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleUpload}
                  style={[styles.uploadBtn, { backgroundColor: colors.secondary, borderWidth: 1, borderColor: colors.border }]}
                >
                  <Feather name="upload" size={15} color={colors.accent} />
                  <Text style={[styles.uploadBtnText, { color: colors.accent }]}>Upload photo</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
      </View>

      {/* Settings */}
      <View style={[styles.settingsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {rows.map((row, i) => (
          <TouchableOpacity
            key={row.label}
            style={[
              styles.settingsRow,
              i < rows.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
            ]}
          >
            <View style={[styles.rowIcon, { backgroundColor: colors.secondary }]}>
              <Feather name={row.icon} size={16} color={colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowLabel, { color: colors.foreground }]}>{row.label}</Text>
              <Text style={[styles.rowDesc, { color: colors.mutedForeground }]}>{row.description}</Text>
            </View>
            <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
        ))}
      </View>
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
  settingsCard: { borderRadius: 18, borderWidth: 1, overflow: "hidden" },
  settingsRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16 },
  rowIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  rowLabel: { fontSize: 14, fontWeight: "600", marginBottom: 1 },
  rowDesc: { fontSize: 12 },
});
