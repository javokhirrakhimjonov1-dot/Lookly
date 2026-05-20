import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  useUserProfile,
  type Gender,
  type StyleAesthetic,
  type HeatAdaptation,
  type ColorPalette,
} from "@/contexts/UserProfileContext";

const { width: SCREEN_W } = Dimensions.get("window");

const C = {
  bg: "#FAF8F5",
  primary: "#1C1512",
  accent: "#C8906A",
  muted: "#78716C",
  border: "#E8E2DA",
  card: "#F4F0EA",
  white: "#FFFFFF",
};

const GENDERS: { label: string; value: Gender }[] = [
  { label: "Male", value: "male" },
  { label: "Female", value: "female" },
  { label: "Non-binary", value: "non-binary" },
  { label: "Prefer not to say", value: "prefer_not_to_say" },
];

const AESTHETICS: { label: string; value: StyleAesthetic; icon: string; desc: string }[] = [
  { label: "Minimalist", value: "minimalist", icon: "minus-circle", desc: "Clean lines, neutral tones" },
  { label: "Streetwear", value: "streetwear", icon: "zap", desc: "Bold, urban, expressive" },
  { label: "Smart Casual", value: "smart_casual", icon: "briefcase", desc: "Polished yet relaxed" },
];

const HEATS: { label: string; value: HeatAdaptation; icon: string; desc: string }[] = [
  { label: "Light Linen", value: "light_linen", icon: "wind", desc: "Breathable & breezy fabrics" },
  { label: "Cotton / Denim", value: "cotton_denim", icon: "layers", desc: "Classic everyday staples" },
];

const PALETTES: { label: string; value: ColorPalette; swatch: string[]; desc: string }[] = [
  { label: "Earthy Neutrals", value: "earthy_neutrals", swatch: ["#C8906A", "#8B7355", "#D4C5B0"], desc: "Warm tones, natural hues" },
  { label: "Monochrome", value: "monochrome", swatch: ["#1C1512", "#78716C", "#FAF8F5"], desc: "Black, white & grey" },
  { label: "Vivid Colors", value: "vivid_colors", swatch: ["#2D5BE3", "#DC2626", "#16A34A"], desc: "Bold, saturated pops" },
];

export default function OnboardingScreen() {
  const { completeOnboarding } = useUserProfile();

  const [step, setStep] = useState(0); // 0 = demographics, 1-3 = quiz steps
  const slideAnim = useRef(new Animated.Value(0)).current;

  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState<Gender | null>(null);
  const [nameError, setNameError] = useState(false);
  const [ageError, setAgeError] = useState(false);
  const [genderError, setGenderError] = useState(false);

  const [aesthetic, setAesthetic] = useState<StyleAesthetic | null>(null);
  const [heat, setHeat] = useState<HeatAdaptation | null>(null);
  const [palette, setPalette] = useState<ColorPalette | null>(null);

  const [completing, setCompleting] = useState(false);

  function goToStep(next: number) {
    const dir = next > step ? 1 : -1;
    Animated.sequence([
      Animated.timing(slideAnim, {
        toValue: -dir * SCREEN_W,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: dir * SCREEN_W,
        duration: 0,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setStep(next);
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 80,
        friction: 12,
      }).start();
    });
  }

  function handleDemographicsNext() {
    let hasError = false;
    if (!name.trim()) { setNameError(true); hasError = true; } else setNameError(false);
    const ageNum = parseInt(age, 10);
    if (!age || isNaN(ageNum) || ageNum < 10 || ageNum > 99) { setAgeError(true); hasError = true; } else setAgeError(false);
    if (!gender) { setGenderError(true); hasError = true; } else setGenderError(false);
    if (!hasError) goToStep(1);
  }

  async function handleComplete() {
    if (!palette) return;
    setCompleting(true);
    await completeOnboarding({
      fullName: name.trim(),
      gender,
      age: parseInt(age, 10) || null,
      styleAesthetic: aesthetic,
      heatAdaptation: heat,
      colorPalette: palette,
    });
    router.replace("/(tabs)");
  }

  const progressPercent = ((step) / 4) * 100;

  return (
    <SafeAreaView style={styles.safe}>
      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <Animated.View style={[styles.progressFill, { width: `${progressPercent + 25}%` }]} />
      </View>

      <Animated.View style={[styles.container, { transform: [{ translateX: slideAnim }] }]}>
        {step === 0 && (
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={{ flex: 1 }}
          >
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
              <View style={styles.header}>
                <Text style={styles.tagline}>WELCOME TO</Text>
                <Text style={styles.appName}>Lookly</Text>
                <Text style={styles.subtitle}>
                  Let's personalize your style experience in under a minute.
                </Text>
              </View>

              <View style={styles.section}>
                <Text style={styles.label}>Your name</Text>
                <TextInput
                  value={name}
                  onChangeText={(t) => { setName(t); setNameError(false); }}
                  placeholder="e.g. Aziz"
                  placeholderTextColor={C.muted}
                  style={[styles.input, nameError && styles.inputError]}
                  autoCapitalize="words"
                />
                {nameError && <Text style={styles.errorText}>Please enter your name</Text>}
              </View>

              <View style={styles.section}>
                <Text style={styles.label}>Your age</Text>
                <TextInput
                  value={age}
                  onChangeText={(t) => { setAge(t.replace(/[^0-9]/g, "")); setAgeError(false); }}
                  placeholder="e.g. 24"
                  placeholderTextColor={C.muted}
                  keyboardType="number-pad"
                  maxLength={2}
                  style={[styles.input, styles.inputShort, ageError && styles.inputError]}
                />
                {ageError && <Text style={styles.errorText}>Please enter a valid age (10–99)</Text>}
              </View>

              <View style={styles.section}>
                <Text style={styles.label}>Gender</Text>
                <View style={styles.genderGrid}>
                  {GENDERS.map((g) => (
                    <Pressable
                      key={g.value}
                      onPress={() => { setGender(g.value); setGenderError(false); }}
                      style={[
                        styles.genderBtn,
                        gender === g.value && styles.genderBtnSelected,
                        genderError && !gender && styles.genderBtnError,
                      ]}
                    >
                      <Text style={[
                        styles.genderBtnText,
                        gender === g.value && styles.genderBtnTextSelected,
                      ]}>
                        {g.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                {genderError && <Text style={styles.errorText}>Please select a gender</Text>}
              </View>

              <TouchableOpacity
                onPress={handleDemographicsNext}
                style={styles.primaryBtn}
                activeOpacity={0.85}
              >
                <Text style={styles.primaryBtnText}>Next</Text>
                <Feather name="arrow-right" size={18} color={C.white} />
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        )}

        {step === 1 && (
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <View style={styles.quizHeader}>
              <Text style={styles.quizStep}>STEP 1 OF 3</Text>
              <Text style={styles.quizTitle}>Choose your casual baseline</Text>
              <Text style={styles.quizSub}>
                How would you describe your everyday style?
              </Text>
            </View>
            <View style={styles.quizCards}>
              {AESTHETICS.map((a) => (
                <Pressable
                  key={a.value}
                  onPress={() => setAesthetic(a.value)}
                  style={[styles.quizCard, aesthetic === a.value && styles.quizCardSelected]}
                >
                  <View style={[styles.quizCardIcon, aesthetic === a.value && styles.quizCardIconSelected]}>
                    <Feather name={a.icon as never} size={22} color={aesthetic === a.value ? C.white : C.accent} />
                  </View>
                  <Text style={[styles.quizCardLabel, aesthetic === a.value && styles.quizCardLabelSelected]}>
                    {a.label}
                  </Text>
                  <Text style={[styles.quizCardDesc, aesthetic === a.value && { color: "rgba(250,248,245,0.8)" }]}>
                    {a.desc}
                  </Text>
                  {aesthetic === a.value && (
                    <View style={styles.quizCardCheck}>
                      <Feather name="check" size={14} color={C.white} />
                    </View>
                  )}
                </Pressable>
              ))}
            </View>
            <View style={styles.navRow}>
              <TouchableOpacity onPress={() => goToStep(0)} style={styles.backBtn}>
                <Feather name="arrow-left" size={16} color={C.muted} />
                <Text style={styles.backBtnText}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => aesthetic && goToStep(2)}
                style={[styles.primaryBtn, styles.primaryBtnCompact, !aesthetic && styles.primaryBtnDisabled]}
                activeOpacity={0.85}
              >
                <Text style={styles.primaryBtnText}>Next</Text>
                <Feather name="arrow-right" size={16} color={C.white} />
              </TouchableOpacity>
            </View>
          </ScrollView>
        )}

        {step === 2 && (
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <View style={styles.quizHeader}>
              <Text style={styles.quizStep}>STEP 2 OF 3</Text>
              <Text style={styles.quizTitle}>Tashkent summer days</Text>
              <Text style={styles.quizSub}>
                Your preference for scorching 30°C+ summer heat?
              </Text>
            </View>
            <View style={styles.quizCards}>
              {HEATS.map((h) => (
                <Pressable
                  key={h.value}
                  onPress={() => setHeat(h.value)}
                  style={[styles.quizCard, styles.quizCardWide, heat === h.value && styles.quizCardSelected]}
                >
                  <View style={[styles.quizCardIcon, heat === h.value && styles.quizCardIconSelected]}>
                    <Feather name={h.icon as never} size={22} color={heat === h.value ? C.white : C.accent} />
                  </View>
                  <Text style={[styles.quizCardLabel, heat === h.value && styles.quizCardLabelSelected]}>
                    {h.label}
                  </Text>
                  <Text style={[styles.quizCardDesc, heat === h.value && { color: "rgba(250,248,245,0.8)" }]}>
                    {h.desc}
                  </Text>
                  {heat === h.value && (
                    <View style={styles.quizCardCheck}>
                      <Feather name="check" size={14} color={C.white} />
                    </View>
                  )}
                </Pressable>
              ))}
            </View>
            <View style={styles.navRow}>
              <TouchableOpacity onPress={() => goToStep(1)} style={styles.backBtn}>
                <Feather name="arrow-left" size={16} color={C.muted} />
                <Text style={styles.backBtnText}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => heat && goToStep(3)}
                style={[styles.primaryBtn, styles.primaryBtnCompact, !heat && styles.primaryBtnDisabled]}
                activeOpacity={0.85}
              >
                <Text style={styles.primaryBtnText}>Next</Text>
                <Feather name="arrow-right" size={16} color={C.white} />
              </TouchableOpacity>
            </View>
          </ScrollView>
        )}

        {step === 3 && (
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <View style={styles.quizHeader}>
              <Text style={styles.quizStep}>STEP 3 OF 3</Text>
              <Text style={styles.quizTitle}>Your colour palette</Text>
              <Text style={styles.quizSub}>
                What tones feel most like you?
              </Text>
            </View>
            <View style={styles.quizCards}>
              {PALETTES.map((p) => (
                <Pressable
                  key={p.value}
                  onPress={() => setPalette(p.value)}
                  style={[styles.quizCard, palette === p.value && styles.quizCardSelected]}
                >
                  <View style={styles.swatchRow}>
                    {p.swatch.map((s, i) => (
                      <View key={i} style={[styles.swatch, { backgroundColor: s }]} />
                    ))}
                  </View>
                  <Text style={[styles.quizCardLabel, palette === p.value && styles.quizCardLabelSelected]}>
                    {p.label}
                  </Text>
                  <Text style={[styles.quizCardDesc, palette === p.value && { color: "rgba(250,248,245,0.8)" }]}>
                    {p.desc}
                  </Text>
                  {palette === p.value && (
                    <View style={styles.quizCardCheck}>
                      <Feather name="check" size={14} color={C.white} />
                    </View>
                  )}
                </Pressable>
              ))}
            </View>
            <View style={styles.navRow}>
              <TouchableOpacity onPress={() => goToStep(2)} style={styles.backBtn}>
                <Feather name="arrow-left" size={16} color={C.muted} />
                <Text style={styles.backBtnText}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleComplete}
                disabled={!palette || completing}
                style={[styles.primaryBtn, styles.primaryBtnCompact, (!palette || completing) && styles.primaryBtnDisabled]}
                activeOpacity={0.85}
              >
                <Text style={styles.primaryBtnText}>{completing ? "Setting up…" : "Complete"}</Text>
                {!completing && <Feather name="check" size={16} color={C.white} />}
              </TouchableOpacity>
            </View>
          </ScrollView>
        )}
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: C.bg,
  },
  progressTrack: {
    height: 3,
    backgroundColor: C.border,
    marginHorizontal: 0,
  },
  progressFill: {
    height: 3,
    backgroundColor: C.accent,
    borderRadius: 2,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 40,
    gap: 24,
  },
  header: {
    gap: 6,
  },
  tagline: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 2,
    color: C.accent,
  },
  appName: {
    fontSize: 40,
    fontWeight: "800",
    color: C.primary,
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 15,
    color: C.muted,
    lineHeight: 22,
    marginTop: 4,
  },
  section: {
    gap: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: C.primary,
    letterSpacing: 0.2,
  },
  input: {
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: C.primary,
    backgroundColor: C.white,
  },
  inputShort: {
    maxWidth: 120,
  },
  inputError: {
    borderColor: "#DC2626",
  },
  errorText: {
    fontSize: 12,
    color: "#DC2626",
    marginTop: 2,
  },
  genderGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  genderBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 100,
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: C.white,
  },
  genderBtnSelected: {
    backgroundColor: C.primary,
    borderColor: C.primary,
  },
  genderBtnError: {
    borderColor: "#DC2626",
  },
  genderBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: C.primary,
  },
  genderBtnTextSelected: {
    color: C.white,
  },
  primaryBtn: {
    backgroundColor: C.primary,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 8,
  },
  primaryBtnCompact: {
    paddingVertical: 13,
    paddingHorizontal: 20,
    marginTop: 0,
    flex: 1,
    maxWidth: 160,
  },
  primaryBtnDisabled: {
    backgroundColor: C.border,
  },
  primaryBtnText: {
    color: C.white,
    fontSize: 15,
    fontWeight: "700",
  },
  quizHeader: {
    gap: 6,
  },
  quizStep: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 2,
    color: C.accent,
  },
  quizTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: C.primary,
    letterSpacing: -0.5,
  },
  quizSub: {
    fontSize: 14,
    color: C.muted,
    lineHeight: 20,
  },
  quizCards: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  quizCard: {
    flex: 1,
    minWidth: (SCREEN_W - 60) / 3 - 4,
    backgroundColor: C.white,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: C.border,
    padding: 16,
    gap: 8,
    position: "relative",
  },
  quizCardWide: {
    minWidth: (SCREEN_W - 60) / 2 - 6,
  },
  quizCardSelected: {
    backgroundColor: C.primary,
    borderColor: C.primary,
  },
  quizCardIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: C.card,
    alignItems: "center",
    justifyContent: "center",
  },
  quizCardIconSelected: {
    backgroundColor: "rgba(250,248,245,0.2)",
  },
  quizCardLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: C.primary,
  },
  quizCardLabelSelected: {
    color: C.white,
  },
  quizCardDesc: {
    fontSize: 11,
    color: C.muted,
    lineHeight: 16,
  },
  quizCardCheck: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: C.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  swatchRow: {
    flexDirection: "row",
    gap: 4,
    marginBottom: 4,
  },
  swatch: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
  },
  navRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 8,
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: C.border,
  },
  backBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: C.muted,
  },
});
