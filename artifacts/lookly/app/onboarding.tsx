import { Feather } from "@/components/FeatherIcon";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useUserProfile, type Gender } from "@/contexts/UserProfileContext";
import { useColors } from "@/hooks/useColors";
import { isSupportedAge, MAX_SUPPORTED_AGE, MIN_SUPPORTED_AGE } from "@/lib/profileRules";
import type { HijabPreference } from "@/lib/modestyRules";
import { useLanguage } from "@/contexts/LanguageContext";

const GENDER_OPTIONS: { label: string; value: Gender }[] = [
  { label: "Male", value: "male" },
  { label: "Female", value: "female" },
  { label: "Non-binary", value: "non-binary" },
  { label: "Prefer not to say", value: "prefer_not_to_say" },
];

export default function OnboardingScreen() {
  const { completeOnboarding } = useUserProfile();
  const { t } = useLanguage();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState<Gender | null>(null);
  const [hijabPreference, setHijabPreference] = useState<HijabPreference>(null);
  const [completing, setCompleting] = useState(false);
  const validAge = isSupportedAge(Number(age));
  const personalDetailsComplete = name.trim().length > 0 && validAge && gender !== null
    && (gender !== "female" || hijabPreference !== null);

  const finish = async () => {
    if (!gender || !personalDetailsComplete || completing) return;
    setCompleting(true);
    try {
      await completeOnboarding({ fullName: name.trim(), age: Number(age), gender, hijabPreference: gender === "female" ? hijabPreference : null });
      router.replace("/(tabs)");
    } finally {
      setCompleting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.welcomeScroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.hero}><Image source={{ uri: "https://images.unsplash.com/photo-1485968579580-b6d095142e6e?w=1000&h=900&fit=crop&auto=format&q=85" }} style={styles.heroImage} contentFit="cover" /><LinearGradient colors={["rgba(0,0,0,0.05)", "rgba(25,17,14,0.75)"]} style={styles.heroShade} /><View style={styles.heroCopy}><Text style={styles.eyebrow}>LOOKLY</Text><Text style={styles.heroTitle}>Your wardrobe,{"\n"}with a point of view.</Text></View></View>
          <View style={styles.welcomeCopy}>
            <Text style={styles.title}>Let's make it feel like you.</Text>
            <Text style={styles.subtitle}>A few details help Lookly make better outfit suggestions from the clothes you own.</Text>
            <Text style={styles.inputLabel}>Full name</Text>
            <TextInput value={name} onChangeText={setName} placeholder="Your full name" placeholderTextColor={colors.mutedForeground} style={styles.input} autoCapitalize="words" returnKeyType="next" />
            <Text style={styles.inputLabel}>Age</Text>
            <TextInput value={age} onChangeText={(value) => setAge(value.replace(/[^0-9]/g, ""))} placeholder={`${MIN_SUPPORTED_AGE}–${MAX_SUPPORTED_AGE}`} placeholderTextColor={colors.mutedForeground} style={styles.input} keyboardType="number-pad" returnKeyType="done" />
            <Text style={styles.inputLabel}>Gender</Text>
            <View style={styles.genderRow}>{GENDER_OPTIONS.map((option) => <TouchableOpacity key={option.value} onPress={() => { setGender(option.value); if (option.value !== "female") setHijabPreference(null); }} style={[styles.genderButton, gender === option.value && styles.genderButtonSelected]}><Text style={[styles.genderButtonText, gender === option.value && styles.genderButtonTextSelected]}>{option.label}</Text></TouchableOpacity>)}</View>
            {gender === "female" ? <>
              <Text style={styles.inputLabel}>{t("hijab_question")}</Text>
              <Text style={[styles.preferenceHint, { color: colors.mutedForeground }]}>{t("hijab_question_hint")}</Text>
              <View style={styles.genderRow}>{(["always", "no"] as const).map((value) => <TouchableOpacity key={value} onPress={() => setHijabPreference(value)} style={[styles.genderButton, hijabPreference === value && styles.genderButtonSelected]}><Text style={[styles.genderButtonText, hijabPreference === value && styles.genderButtonTextSelected]}>{t(value === "always" ? "hijab_yes_always" : "hijab_no")}</Text></TouchableOpacity>)}</View>
            </> : null}
            <TouchableOpacity onPress={finish} disabled={!personalDetailsComplete || completing} style={[styles.primaryButton, (!personalDetailsComplete || completing) && styles.primaryButtonDisabled]}><Text style={styles.primaryButtonText}>{completing ? "Setting up…" : "Create my wardrobe"}</Text><Feather name="check" size={18} color={colors.card} /></TouchableOpacity>
            <Text style={styles.reassurance}>You can change these details later in your profile.</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function makeStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background }, flex: { flex: 1 },
    welcomeScroll: { paddingBottom: 32 }, hero: { height: 305, margin: 18, borderRadius: 24, overflow: "hidden" }, heroImage: { width: "100%", height: "100%" }, heroShade: { ...StyleSheet.absoluteFillObject }, heroCopy: { position: "absolute", left: 22, right: 22, bottom: 22 }, eyebrow: { color: "rgba(255,255,255,0.78)", fontSize: 11, fontWeight: "800", letterSpacing: 2 }, heroTitle: { color: colors.card, fontSize: 30, fontWeight: "800", lineHeight: 35, letterSpacing: -0.8, marginTop: 8 },
    welcomeCopy: { paddingHorizontal: 24, gap: 12 }, title: { fontSize: 27, fontWeight: "800", color: colors.text, letterSpacing: -0.5 }, subtitle: { fontSize: 15, color: colors.mutedForeground, lineHeight: 22 }, inputLabel: { color: colors.text, fontSize: 13, fontWeight: "700", marginTop: 6 }, input: { borderWidth: 1, borderColor: colors.border, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: colors.text, backgroundColor: colors.card },
    genderRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 }, genderButton: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 }, genderButtonSelected: { borderColor: colors.accent, backgroundColor: colors.accent }, genderButtonText: { color: colors.text, fontSize: 13, fontWeight: "700" }, genderButtonTextSelected: { color: colors.card },
    preferenceHint: { fontSize: 12, lineHeight: 18, marginTop: -6 },
    primaryButton: { marginTop: 8, backgroundColor: colors.foreground, borderRadius: 16, paddingVertical: 16, paddingHorizontal: 20, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }, primaryButtonDisabled: { backgroundColor: colors.border }, primaryButtonText: { color: colors.card, fontSize: 15, fontWeight: "800" }, reassurance: { textAlign: "center", color: colors.mutedForeground, fontSize: 12, marginTop: 2 },
  });
}
