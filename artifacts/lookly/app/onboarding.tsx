import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
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

const CARD_W = SCREEN_W * 0.58;
const CARD_H = CARD_W * 1.55;
const CARD_GAP = 12;

const GENDERS: { label: string; value: Gender }[] = [
  { label: "Male", value: "male" },
  { label: "Female", value: "female" },
  { label: "Non-binary", value: "non-binary" },
  { label: "Prefer not to say", value: "prefer_not_to_say" },
];

const AESTHETICS: { label: string; value: StyleAesthetic; desc: string; imageUri: string }[] = [
  {
    label: "Minimalist",
    value: "minimalist",
    desc: "Clean lines, neutral tones",
    imageUri: "https://images.unsplash.com/photo-1594938298603-c8148c4b4816?w=400&h=620&fit=crop&auto=format&q=80",
  },
  {
    label: "Streetwear",
    value: "streetwear",
    desc: "Bold, urban, expressive",
    imageUri: "https://images.unsplash.com/photo-1552374196-1ab2a1c593e8?w=400&h=620&fit=crop&auto=format&q=80",
  },
  {
    label: "Smart Casual",
    value: "smart_casual",
    desc: "Polished yet relaxed",
    imageUri: "https://images.unsplash.com/photo-1617137984095-74e4e5e3613f?w=400&h=620&fit=crop&auto=format&q=80",
  },
];

const HEATS: { label: string; value: HeatAdaptation; desc: string; imageUri: string }[] = [
  {
    label: "Light Linen",
    value: "light_linen",
    desc: "Breathable & breezy",
    imageUri: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=400&h=620&fit=crop&auto=format&q=80",
  },
  {
    label: "Cotton / Denim",
    value: "cotton_denim",
    desc: "Classic everyday staples",
    imageUri: "https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=400&h=620&fit=crop&auto=format&q=80",
  },
];

const PALETTES: { label: string; value: ColorPalette; desc: string; imageUri: string }[] = [
  {
    label: "Earthy Neutrals",
    value: "earthy_neutrals",
    desc: "Warm tones, natural hues",
    imageUri: "https://images.unsplash.com/photo-1445205170230-053b83016050?w=400&h=620&fit=crop&auto=format&q=80",
  },
  {
    label: "Monochrome",
    value: "monochrome",
    desc: "Black, white & grey",
    imageUri: "https://images.unsplash.com/photo-1509631179647-0177331693ae?w=400&h=620&fit=crop&auto=format&q=80",
  },
  {
    label: "Vivid Colors",
    value: "vivid_colors",
    desc: "Bold, saturated pops",
    imageUri: "https://images.unsplash.com/photo-1523381294911-8d3cead13475?w=400&h=620&fit=crop&auto=format&q=80",
  },
];

function StyleImageCard<T extends string>({
  label,
  desc,
  value,
  imageUri,
  selected,
  onPress,
}: {
  label: string;
  desc: string;
  value: T;
  imageUri: string;
  selected: boolean;
  onPress: (v: T) => void;
}) {
  return (
    <TouchableOpacity
      onPress={() => onPress(value)}
      activeOpacity={0.88}
      style={[
        styles.imgCard,
        selected && styles.imgCardSelected,
      ]}
    >
      <Image
        source={{ uri: imageUri }}
        style={styles.imgCardPhoto}
        contentFit="cover"
        transition={200}
      />
      {/* dark gradient overlay always */}
      <LinearGradient
        colors={["transparent", "rgba(28,21,18,0.88)"]}
        style={styles.imgCardGradient}
      />
      {/* selected overlay */}
      {selected && <View style={styles.imgCardSelectedOverlay} />}
      {/* check badge */}
      {selected && (
        <View style={styles.imgCardCheckBadge}>
          <Feather name="check" size={13} color={C.white} />
        </View>
      )}
      {/* label */}
      <View style={styles.imgCardLabel}>
        <Text style={styles.imgCardLabelText}>{label}</Text>
        <Text style={styles.imgCardDescText}>{desc}</Text>
      </View>
    </TouchableOpacity>
  );
}

export default function OnboardingScreen() {
  const { completeOnboarding } = useUserProfile();

  const [step, setStep] = useState(0);
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
      Animated.timing(slideAnim, { toValue: dir * SCREEN_W, duration: 0, useNativeDriver: true }),
    ]).start(() => {
      setStep(next);
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 80, friction: 12 }).start();
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

  const progressPercent = (step / 4) * 100 + 25;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
      </View>

      <Animated.View style={[styles.container, { transform: [{ translateX: slideAnim }] }]}>

        {/* ── STEP 0: Demographics ── */}
        {step === 0 && (
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
              <View style={styles.header}>
                <Text style={styles.tagline}>WELCOME TO</Text>
                <Text style={styles.appName}>Lookly</Text>
                <Text style={styles.subtitle}>Let's personalise your style in under a minute.</Text>
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
                {ageError && <Text style={styles.errorText}>Enter a valid age (10–99)</Text>}
              </View>

              <View style={styles.section}>
                <Text style={styles.label}>Gender</Text>
                <View style={styles.genderGrid}>
                  {GENDERS.map((g) => (
                    <Pressable
                      key={g.value}
                      onPress={() => { setGender(g.value); setGenderError(false); }}
                      style={[styles.genderBtn, gender === g.value && styles.genderBtnSelected, genderError && !gender && styles.genderBtnError]}
                    >
                      <Text style={[styles.genderBtnText, gender === g.value && styles.genderBtnTextSelected]}>
                        {g.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                {genderError && <Text style={styles.errorText}>Please select a gender</Text>}
              </View>

              <TouchableOpacity onPress={handleDemographicsNext} style={styles.primaryBtn} activeOpacity={0.85}>
                <Text style={styles.primaryBtnText}>Next</Text>
                <Feather name="arrow-right" size={18} color={C.white} />
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        )}

        {/* ── STEP 1: Aesthetic Quiz ── */}
        {step === 1 && (
          <View style={{ flex: 1 }}>
            <View style={styles.quizHeader}>
              <Text style={styles.quizStep}>STEP 1 OF 3 · STYLE</Text>
              <Text style={styles.quizTitle}>What's your vibe?</Text>
              <Text style={styles.quizSub}>Choose the look that feels most like you.</Text>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              snapToInterval={CARD_W + CARD_GAP}
              decelerationRate="fast"
              contentContainerStyle={styles.imgRow}
            >
              {AESTHETICS.map((a) => (
                <StyleImageCard
                  key={a.value}
                  label={a.label}
                  desc={a.desc}
                  value={a.value}
                  imageUri={a.imageUri}
                  selected={aesthetic === a.value}
                  onPress={(v) => setAesthetic(v)}
                />
              ))}
            </ScrollView>
            <Text style={styles.swipeHint}>← Swipe to browse</Text>

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
          </View>
        )}

        {/* ── STEP 2: Heat Adaptation ── */}
        {step === 2 && (
          <View style={{ flex: 1 }}>
            <View style={styles.quizHeader}>
              <Text style={styles.quizStep}>STEP 2 OF 3 · SUMMER</Text>
              <Text style={styles.quizTitle}>Tashkent summer days</Text>
              <Text style={styles.quizSub}>Scorching 30°C+ — which outfit feels right?</Text>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              snapToInterval={CARD_W + CARD_GAP}
              decelerationRate="fast"
              contentContainerStyle={styles.imgRow}
            >
              {HEATS.map((h) => (
                <StyleImageCard
                  key={h.value}
                  label={h.label}
                  desc={h.desc}
                  value={h.value}
                  imageUri={h.imageUri}
                  selected={heat === h.value}
                  onPress={(v) => setHeat(v)}
                />
              ))}
            </ScrollView>
            <Text style={styles.swipeHint}>← Swipe to browse</Text>

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
          </View>
        )}

        {/* ── STEP 3: Colour Palette ── */}
        {step === 3 && (
          <View style={{ flex: 1 }}>
            <View style={styles.quizHeader}>
              <Text style={styles.quizStep}>STEP 3 OF 3 · COLOUR</Text>
              <Text style={styles.quizTitle}>Your colour palette</Text>
              <Text style={styles.quizSub}>Pick the palette that speaks to you.</Text>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              snapToInterval={CARD_W + CARD_GAP}
              decelerationRate="fast"
              contentContainerStyle={styles.imgRow}
            >
              {PALETTES.map((p) => (
                <StyleImageCard
                  key={p.value}
                  label={p.label}
                  desc={p.desc}
                  value={p.value}
                  imageUri={p.imageUri}
                  selected={palette === p.value}
                  onPress={(v) => setPalette(v)}
                />
              ))}
            </ScrollView>
            <Text style={styles.swipeHint}>← Swipe to browse</Text>

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
          </View>
        )}

      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  progressTrack: { height: 3, backgroundColor: C.border },
  progressFill: { height: 3, backgroundColor: C.accent },
  container: { flex: 1 },

  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 40,
    gap: 24,
  },

  header: { gap: 6 },
  tagline: { fontSize: 11, fontWeight: "700", letterSpacing: 2, color: C.accent },
  appName: { fontSize: 40, fontWeight: "800", color: C.primary, letterSpacing: -1 },
  subtitle: { fontSize: 15, color: C.muted, lineHeight: 22, marginTop: 4 },

  section: { gap: 8 },
  label: { fontSize: 13, fontWeight: "600", color: C.primary, letterSpacing: 0.2 },
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
  inputShort: { maxWidth: 120 },
  inputError: { borderColor: "#DC2626" },
  errorText: { fontSize: 12, color: "#DC2626", marginTop: 2 },

  genderGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  genderBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 100,
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: C.white,
  },
  genderBtnSelected: { backgroundColor: C.primary, borderColor: C.primary },
  genderBtnError: { borderColor: "#DC2626" },
  genderBtnText: { fontSize: 13, fontWeight: "600", color: C.primary },
  genderBtnTextSelected: { color: C.white },

  // ── Quiz ──
  quizHeader: {
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 20,
    gap: 5,
  },
  quizStep: { fontSize: 11, fontWeight: "700", letterSpacing: 2, color: C.accent },
  quizTitle: { fontSize: 26, fontWeight: "800", color: C.primary, letterSpacing: -0.5 },
  quizSub: { fontSize: 14, color: C.muted, lineHeight: 20 },

  imgRow: {
    paddingLeft: 24,
    paddingRight: 24,
    gap: CARD_GAP,
    alignItems: "flex-start",
  },

  // ── Image Card ──
  imgCard: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 3,
    borderColor: "transparent",
    position: "relative",
  },
  imgCardSelected: {
    borderColor: C.accent,
  },
  imgCardPhoto: {
    width: "100%",
    height: "100%",
    position: "absolute",
    top: 0,
    left: 0,
  },
  imgCardGradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "60%",
  },
  imgCardSelectedOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(200,144,106,0.18)",
  },
  imgCardCheckBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: C.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  imgCardLabel: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    gap: 3,
  },
  imgCardLabelText: {
    fontSize: 17,
    fontWeight: "800",
    color: C.white,
    letterSpacing: -0.3,
  },
  imgCardDescText: {
    fontSize: 12,
    color: "rgba(250,248,245,0.75)",
    lineHeight: 16,
  },

  swipeHint: {
    textAlign: "center",
    fontSize: 11,
    color: C.muted,
    marginTop: 10,
    letterSpacing: 0.5,
  },

  // ── Nav ──
  navRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 24,
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
  backBtnText: { fontSize: 14, fontWeight: "600", color: C.muted },
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
  primaryBtnCompact: { paddingVertical: 13, paddingHorizontal: 20, marginTop: 0, flex: 1, maxWidth: 160 },
  primaryBtnDisabled: { backgroundColor: C.border },
  primaryBtnText: { color: C.white, fontSize: 15, fontWeight: "700" },
});
