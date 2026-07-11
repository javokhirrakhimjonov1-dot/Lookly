import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useMemo, useRef, useState } from "react";
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
import { useColors } from "@/hooks/useColors";

const { width: SCREEN_W } = Dimensions.get("window");

const CARD_W = SCREEN_W * 0.58;
const CARD_H = CARD_W * 1.55;
const CARD_GAP = 12;

const GENDERS: { label: string; value: Gender }[] = [
  { label: "Male", value: "male" },
  { label: "Female", value: "female" },
  { label: "Non-binary", value: "non-binary" },
  { label: "Prefer not to say", value: "prefer_not_to_say" },
];

const AESTHETICS: {
  label: string;
  value: StyleAesthetic;
  desc: string;
  maleUri: string;
  femaleUri: string;
  neutralUri: string;
}[] = [
  {
    label: "Minimalist",
    value: "minimalist",
    desc: "Clean lines, neutral tones",
    maleUri:   "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=400&h=620&fit=crop&auto=format&q=80",
    femaleUri: "https://images.unsplash.com/photo-1594938298603-c8148c4b4816?w=400&h=620&fit=crop&auto=format&q=80",
    neutralUri:"https://images.unsplash.com/photo-1594938298603-c8148c4b4816?w=400&h=620&fit=crop&auto=format&q=80",
  },
  {
    label: "Streetwear",
    value: "streetwear",
    desc: "Bold, urban, expressive",
    maleUri:   "https://images.unsplash.com/photo-1552374196-1ab2a1c593e8?w=400&h=620&fit=crop&auto=format&q=80",
    femaleUri: "https://images.unsplash.com/photo-1521133573892-e1be2b12c5a5?w=400&h=620&fit=crop&auto=format&q=80",
    neutralUri:"https://images.unsplash.com/photo-1552374196-1ab2a1c593e8?w=400&h=620&fit=crop&auto=format&q=80",
  },
  {
    label: "Smart Casual",
    value: "smart_casual",
    desc: "Polished yet relaxed",
    maleUri:   "https://images.unsplash.com/photo-1617137984095-74e4e5e3613f?w=400&h=620&fit=crop&auto=format&q=80",
    femaleUri: "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=400&h=620&fit=crop&auto=format&q=80",
    neutralUri:"https://images.unsplash.com/photo-1617137984095-74e4e5e3613f?w=400&h=620&fit=crop&auto=format&q=80",
  },
  {
    label: "Boho",
    value: "boho",
    desc: "Flowy, textured, earthy",
    maleUri:   "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=400&h=620&fit=crop&auto=format&q=80",
    femaleUri: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=400&h=620&fit=crop&auto=format&q=80",
    neutralUri:"https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=400&h=620&fit=crop&auto=format&q=80",
  },
  {
    label: "Classic",
    value: "classic",
    desc: "Timeless tailored basics",
    maleUri:   "https://images.unsplash.com/photo-1490114538077-0a7f8cb49891?w=400&h=620&fit=crop&auto=format&q=80",
    femaleUri: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=620&fit=crop&auto=format&q=80",
    neutralUri:"https://images.unsplash.com/photo-1490114538077-0a7f8cb49891?w=400&h=620&fit=crop&auto=format&q=80",
  },
  {
    label: "Sporty",
    value: "sporty",
    desc: "Functional, clean, active",
    maleUri:   "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&h=620&fit=crop&auto=format&q=80",
    femaleUri: "https://images.unsplash.com/photo-1519669556870-42659c6da78c?w=400&h=620&fit=crop&auto=format&q=80",
    neutralUri:"https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&h=620&fit=crop&auto=format&q=80",
  },
];

const HEATS: {
  label: string;
  value: HeatAdaptation;
  desc: string;
  maleUri: string;
  femaleUri: string;
  neutralUri: string;
}[] = [
  {
    label: "Linen & Loose",
    value: "light_linen",
    desc: "Breathable fabrics, loose fit",
    maleUri:   "https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=400&h=620&fit=crop&auto=format&q=80",
    femaleUri: "https://images.unsplash.com/photo-1623091410901-00e2d268901f?w=400&h=620&fit=crop&auto=format&q=80",
    neutralUri:"https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=400&h=620&fit=crop&auto=format&q=80",
  },
  {
    label: "Shorts & Tee",
    value: "shorts_casual",
    desc: "Casual cool, easy summer",
    maleUri:   "https://images.unsplash.com/photo-1527719327859-c6ce80353573?w=400&h=620&fit=crop&auto=format&q=80",
    femaleUri: "https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=400&h=620&fit=crop&auto=format&q=80",
    neutralUri:"https://images.unsplash.com/photo-1527719327859-c6ce80353573?w=400&h=620&fit=crop&auto=format&q=80",
  },
  {
    label: "Sport & Active",
    value: "sport_active",
    desc: "Moisture-wicking, on-the-go",
    maleUri:   "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=400&h=620&fit=crop&auto=format&q=80",
    femaleUri: "https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?w=400&h=620&fit=crop&auto=format&q=80",
    neutralUri:"https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=400&h=620&fit=crop&auto=format&q=80",
  },
];

const PALETTES: {
  label: string;
  value: ColorPalette;
  desc: string;
  maleUri: string;
  femaleUri: string;
  neutralUri: string;
}[] = [
  {
    label: "Earthy Neutrals",
    value: "earthy_neutrals",
    desc: "Camel, beige, terracotta",
    maleUri:   "https://images.unsplash.com/photo-1607345366928-199ea26cfe3e?w=400&h=620&fit=crop&auto=format&q=80",
    femaleUri: "https://images.unsplash.com/photo-1445205170230-053b83016050?w=400&h=620&fit=crop&auto=format&q=80",
    neutralUri:"https://images.unsplash.com/photo-1445205170230-053b83016050?w=400&h=620&fit=crop&auto=format&q=80",
  },
  {
    label: "Monochrome",
    value: "monochrome",
    desc: "Black, white & grey",
    maleUri:   "https://images.unsplash.com/photo-1617196034183-421b4040ed20?w=400&h=620&fit=crop&auto=format&q=80",
    femaleUri: "https://images.unsplash.com/photo-1509631179647-0177331693ae?w=400&h=620&fit=crop&auto=format&q=80",
    neutralUri:"https://images.unsplash.com/photo-1509631179647-0177331693ae?w=400&h=620&fit=crop&auto=format&q=80",
  },
  {
    label: "Vivid Colors",
    value: "vivid_colors",
    desc: "Bold, saturated pops",
    maleUri:   "https://images.unsplash.com/photo-1550995694-3b5b49089e5e?w=400&h=620&fit=crop&auto=format&q=80",
    femaleUri: "https://images.unsplash.com/photo-1523381294911-8d3cead13475?w=400&h=620&fit=crop&auto=format&q=80",
    neutralUri:"https://images.unsplash.com/photo-1523381294911-8d3cead13475?w=400&h=620&fit=crop&auto=format&q=80",
  },
  {
    label: "Soft Pastels",
    value: "pastels",
    desc: "Muted lavender, blush, sage",
    maleUri:   "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=400&h=620&fit=crop&auto=format&q=80",
    femaleUri: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=400&h=620&fit=crop&auto=format&q=80",
    neutralUri:"https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=400&h=620&fit=crop&auto=format&q=80",
  },
  {
    label: "Sand & Clay",
    value: "desert_sand",
    desc: "Warm desert hues, nude tones",
    maleUri:   "https://images.unsplash.com/photo-1551803091-e20673f15770?w=400&h=620&fit=crop&auto=format&q=80",
    femaleUri: "https://images.unsplash.com/photo-1551803091-e20673f15770?w=400&h=620&fit=crop&auto=format&q=80",
    neutralUri:"https://images.unsplash.com/photo-1551803091-e20673f15770?w=400&h=620&fit=crop&auto=format&q=80",
  },
];

function pickUri(item: { maleUri: string; femaleUri: string; neutralUri: string }, gender: Gender | null) {
  if (gender === "male") return item.maleUri;
  if (gender === "female") return item.femaleUri;
  return item.neutralUri;
}

function StyleImageCard<T extends string>({
  label,
  desc,
  value,
  imageUri,
  selected,
  multiSelect,
  onPress,
}: {
  label: string;
  desc: string;
  value: T;
  imageUri: string;
  selected: boolean;
  multiSelect?: boolean;
  onPress: (v: T) => void;
}) {
  const colors = useColors();
  const s = useMemo(() => makeStyles(colors), [colors]);
  return (
    <TouchableOpacity
      onPress={() => onPress(value)}
      activeOpacity={0.88}
      style={[s.imgCard, selected && s.imgCardSelected]}
    >
      <Image
        source={{ uri: imageUri }}
        style={s.imgCardPhoto}
        contentFit="cover"
        transition={200}
      />
      <LinearGradient
        colors={["transparent", "rgba(28,21,18,0.88)"]}
        style={s.imgCardGradient}
      />
      {selected && <View style={s.imgCardSelectedOverlay} />}
      {selected && (
        <View style={s.imgCardCheckBadge}>
          <Feather name={multiSelect ? "check" : "check"} size={13} color={colors.card} />
        </View>
      )}
      <View style={s.imgCardLabel}>
        <Text style={s.imgCardLabelText}>{label}</Text>
        <Text style={s.imgCardDescText}>{desc}</Text>
      </View>
    </TouchableOpacity>
  );
}

export default function OnboardingScreen() {
  const { completeOnboarding } = useUserProfile();
  const colors = useColors();
  const s = useMemo(() => makeStyles(colors), [colors]);

  const [step, setStep] = useState(0);
  const slideAnim = useRef(new Animated.Value(0)).current;

  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState<Gender | null>(null);
  const [nameError, setNameError] = useState(false);
  const [ageError, setAgeError] = useState(false);
  const [genderError, setGenderError] = useState(false);

  const [aesthetics, setAesthetics] = useState<StyleAesthetic[]>([]);
  const [heat, setHeat] = useState<HeatAdaptation | null>(null);
  const [palette, setPalette] = useState<ColorPalette | null>(null);

  const [completing, setCompleting] = useState(false);

  function toggleAesthetic(v: StyleAesthetic) {
    setAesthetics((prev) =>
      prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]
    );
  }

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
      styleAesthetics: aesthetics,
      heatAdaptation: heat,
      colorPalette: palette,
    });
    router.replace("/(tabs)");
  }

  const progressPercent = (step / 4) * 100 + 25;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={s.progressTrack}>
        <View style={[s.progressFill, { width: `${progressPercent}%` }]} />
      </View>

      <Animated.View style={[s.container, { transform: [{ translateX: slideAnim }] }]}>

        {step === 0 && (
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
              <View style={s.header}>
                <Text style={s.tagline}>WELCOME TO</Text>
                <Text style={s.appName}>Lookly</Text>
                <Text style={s.subtitle}>Let's personalise your style in under a minute.</Text>
              </View>

              <View style={s.section}>
                <Text style={s.label}>Your name</Text>
                <TextInput
                  value={name}
                  onChangeText={(t) => { setName(t); setNameError(false); }}
                  placeholder="e.g. Aziz"
                  placeholderTextColor={colors.mutedForeground}
                  style={[s.input, nameError && s.inputError]}
                  autoCapitalize="words"
                />
                {nameError && <Text style={s.errorText}>Please enter your name</Text>}
              </View>

              <View style={s.section}>
                <Text style={s.label}>Your age</Text>
                <TextInput
                  value={age}
                  onChangeText={(t) => { setAge(t.replace(/[^0-9]/g, "")); setAgeError(false); }}
                  placeholder="e.g. 24"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="number-pad"
                  maxLength={2}
                  style={[s.input, s.inputShort, ageError && s.inputError]}
                />
                {ageError && <Text style={s.errorText}>Enter a valid age (10–99)</Text>}
              </View>

              <View style={s.section}>
                <Text style={s.label}>Gender</Text>
                <View style={s.genderGrid}>
                  {GENDERS.map((g) => (
                    <Pressable
                      key={g.value}
                      onPress={() => { setGender(g.value); setGenderError(false); }}
                      style={[s.genderBtn, gender === g.value && s.genderBtnSelected, genderError && !gender && s.genderBtnError]}
                    >
                      <Text style={[s.genderBtnText, gender === g.value && s.genderBtnTextSelected]}>
                        {g.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                {genderError && <Text style={s.errorText}>Please select a gender</Text>}
              </View>

              <TouchableOpacity onPress={handleDemographicsNext} style={s.primaryBtn} activeOpacity={0.85}>
                <Text style={s.primaryBtnText}>Next</Text>
                <Feather name="arrow-right" size={18} color={colors.card} />
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        )}

        {step === 1 && (
          <View style={{ flex: 1 }}>
            <View style={s.quizHeader}>
              <Text style={s.quizStep}>STEP 1 OF 3 · YOUR STYLE</Text>
              <Text style={s.quizTitle}>How do you dress?</Text>
              <Text style={s.quizSub}>
                Pick every style you wear — you can mix and match.
              </Text>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              snapToInterval={CARD_W + CARD_GAP}
              decelerationRate="fast"
              contentContainerStyle={s.imgRow}
            >
              {AESTHETICS.map((a) => (
                <StyleImageCard
                  key={a.value}
                  label={a.label}
                  desc={a.desc}
                  value={a.value}
                  imageUri={pickUri(a, gender)}
                  selected={aesthetics.includes(a.value)}
                  multiSelect
                  onPress={toggleAesthetic}
                />
              ))}
            </ScrollView>

            <View style={s.selectionRow}>
              {aesthetics.length > 0 ? (
                <Text style={s.selectionLabel}>
                  Selected: {aesthetics.map((a) => AESTHETICS.find((x) => x.value === a)?.label).join(", ")}
                </Text>
              ) : (
                <Text style={s.swipeHint}>← Swipe · tap to select</Text>
              )}
            </View>

            <View style={s.navRow}>
              <TouchableOpacity onPress={() => goToStep(0)} style={s.backBtn}>
                <Feather name="arrow-left" size={16} color={colors.mutedForeground} />
                <Text style={s.backBtnText}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => aesthetics.length > 0 && goToStep(2)}
                style={[s.primaryBtn, s.primaryBtnCompact, aesthetics.length === 0 && s.primaryBtnDisabled]}
                activeOpacity={0.85}
              >
                <Text style={s.primaryBtnText}>Next</Text>
                <Feather name="arrow-right" size={16} color={colors.card} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {step === 2 && (
          <View style={{ flex: 1 }}>
            <View style={s.quizHeader}>
              <Text style={s.quizStep}>STEP 2 OF 3 · SUMMER</Text>
              <Text style={s.quizTitle}>Tashkent summer heat</Text>
              <Text style={s.quizSub}>30°C+ outside — which look fits you best?</Text>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              snapToInterval={CARD_W + CARD_GAP}
              decelerationRate="fast"
              contentContainerStyle={s.imgRow}
            >
              {HEATS.map((h) => (
                <StyleImageCard
                  key={h.value}
                  label={h.label}
                  desc={h.desc}
                  value={h.value}
                  imageUri={pickUri(h, gender)}
                  selected={heat === h.value}
                  onPress={(v) => setHeat(v)}
                />
              ))}
            </ScrollView>
            <Text style={s.swipeHint}>← Swipe to browse</Text>

            <View style={s.navRow}>
              <TouchableOpacity onPress={() => goToStep(1)} style={s.backBtn}>
                <Feather name="arrow-left" size={16} color={colors.mutedForeground} />
                <Text style={s.backBtnText}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => heat && goToStep(3)}
                style={[s.primaryBtn, s.primaryBtnCompact, !heat && s.primaryBtnDisabled]}
                activeOpacity={0.85}
              >
                <Text style={s.primaryBtnText}>Next</Text>
                <Feather name="arrow-right" size={16} color={colors.card} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {step === 3 && (
          <View style={{ flex: 1 }}>
            <View style={s.quizHeader}>
              <Text style={s.quizStep}>STEP 3 OF 3 · COLOUR</Text>
              <Text style={s.quizTitle}>Your colour palette</Text>
              <Text style={s.quizSub}>Pick the palette that feels most like you.</Text>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              snapToInterval={CARD_W + CARD_GAP}
              decelerationRate="fast"
              contentContainerStyle={s.imgRow}
            >
              {PALETTES.map((p) => (
                <StyleImageCard
                  key={p.value}
                  label={p.label}
                  desc={p.desc}
                  value={p.value}
                  imageUri={pickUri(p, gender)}
                  selected={palette === p.value}
                  onPress={(v) => setPalette(v)}
                />
              ))}
            </ScrollView>
            <Text style={s.swipeHint}>← Swipe to browse</Text>

            <View style={s.navRow}>
              <TouchableOpacity onPress={() => goToStep(2)} style={s.backBtn}>
                <Feather name="arrow-left" size={16} color={colors.mutedForeground} />
                <Text style={s.backBtnText}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleComplete}
                disabled={!palette || completing}
                style={[s.primaryBtn, s.primaryBtnCompact, (!palette || completing) && s.primaryBtnDisabled]}
                activeOpacity={0.85}
              >
                <Text style={s.primaryBtnText}>{completing ? "Setting up…" : "Complete"}</Text>
                {!completing && <Feather name="check" size={16} color={colors.card} />}
              </TouchableOpacity>
            </View>
          </View>
        )}

      </Animated.View>
    </SafeAreaView>
  );
}

function makeStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    progressTrack: { height: 3, backgroundColor: colors.border },
    progressFill: { height: 3, backgroundColor: colors.accent },
    container: { flex: 1 },

    scrollContent: {
      paddingHorizontal: 24,
      paddingTop: 32,
      paddingBottom: 40,
      gap: 24,
    },

    header: { gap: 6 },
    tagline: { fontSize: 11, fontWeight: "700", letterSpacing: 2, color: colors.accent },
    appName: { fontSize: 40, fontWeight: "800", color: colors.text, letterSpacing: -1 },
    subtitle: { fontSize: 15, color: colors.mutedForeground, lineHeight: 22, marginTop: 4 },

    section: { gap: 8 },
    label: { fontSize: 13, fontWeight: "600", color: colors.text, letterSpacing: 0.2 },
    input: {
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: 14,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: 16,
      color: colors.text,
      backgroundColor: colors.card,
    },
    inputShort: { maxWidth: 120 },
    inputError: { borderColor: colors.destructive },
    errorText: { fontSize: 12, color: colors.destructive, marginTop: 2 },

    genderGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    genderBtn: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 100,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    genderBtnSelected: { backgroundColor: colors.foreground, borderColor: colors.foreground },
    genderBtnError: { borderColor: colors.destructive },
    genderBtnText: { fontSize: 13, fontWeight: "600", color: colors.text },
    genderBtnTextSelected: { color: colors.card },

    quizHeader: {
      paddingHorizontal: 24,
      paddingTop: 28,
      paddingBottom: 18,
      gap: 5,
    },
    quizStep: { fontSize: 11, fontWeight: "700", letterSpacing: 2, color: colors.accent },
    quizTitle: { fontSize: 26, fontWeight: "800", color: colors.text, letterSpacing: -0.5 },
    quizSub: { fontSize: 14, color: colors.mutedForeground, lineHeight: 20 },

    imgRow: {
      paddingLeft: 24,
      paddingRight: 24,
      gap: CARD_GAP,
      alignItems: "flex-start",
    },

    imgCard: {
      width: CARD_W,
      height: CARD_H,
      borderRadius: 20,
      overflow: "hidden",
      borderWidth: 3,
      borderColor: "transparent",
      position: "relative",
    },
    imgCardSelected: { borderColor: colors.accent },
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
      backgroundColor: colors.secondary,
    },
    imgCardCheckBadge: {
      position: "absolute",
      top: 12,
      right: 12,
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.accent,
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
      color: colors.card,
      letterSpacing: -0.3,
    },
    imgCardDescText: {
      fontSize: 12,
      color: "rgba(255,255,255,0.75)",
      lineHeight: 16,
    },

    selectionRow: {
      minHeight: 26,
      paddingHorizontal: 24,
      marginTop: 10,
      justifyContent: "center",
    },
    selectionLabel: {
      fontSize: 12,
      color: colors.accent,
      fontWeight: "600",
      textAlign: "center",
    },
    swipeHint: {
      textAlign: "center",
      fontSize: 11,
      color: colors.mutedForeground,
      marginTop: 10,
      letterSpacing: 0.5,
    },

    navRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      paddingHorizontal: 24,
      paddingTop: 14,
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
      borderColor: colors.border,
    },
    backBtnText: { fontSize: 14, fontWeight: "600", color: colors.mutedForeground },
    primaryBtn: {
      backgroundColor: colors.foreground,
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
    primaryBtnDisabled: { backgroundColor: colors.border },
    primaryBtnText: { color: colors.card, fontSize: 15, fontWeight: "700" },
  });
}
