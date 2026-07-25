import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  Dimensions,
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
import {
  useUserProfile,
  type ColorPalette,
  type Gender,
  type HeatAdaptation,
  type StyleAesthetic,
} from "@/contexts/UserProfileContext";
import { useColors } from "@/hooks/useColors";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_WIDTH = Math.min(SCREEN_WIDTH * 0.72, 310);
const CARD_HEIGHT = CARD_WIDTH * 1.32;
const CARD_GAP = 14;

type VisualChoice<T extends string> = {
  label: string;
  value: T;
  description: string;
  imageUri: string;
};

const STYLE_EDITS: VisualChoice<StyleAesthetic>[] = [
  { label: "Easy essentials", value: "minimalist", description: "Clean tees, denim and quiet confidence", imageUri: "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?w=700&h=1050&fit=crop&auto=format&q=85" },
  { label: "Tailored layers", value: "classic", description: "Overshirts, jackets and structure", imageUri: "https://images.unsplash.com/photo-1617127365659-c47fa864d8bc?w=700&h=1050&fit=crop&auto=format&q=85" },
  { label: "Polished casual", value: "smart_casual", description: "Refined pieces that still feel relaxed", imageUri: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=700&h=1050&fit=crop&auto=format&q=85" },
  { label: "Relaxed street", value: "streetwear", description: "Hoodies, sneakers and statement layers", imageUri: "https://images.unsplash.com/photo-1523398002811-999ca8dec234?w=700&h=1050&fit=crop&auto=format&q=85" },
  { label: "Soft & expressive", value: "boho", description: "Texture, flow and personality", imageUri: "https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=700&h=1050&fit=crop&auto=format&q=85" },
  { label: "Active off-duty", value: "sporty", description: "Functional pieces made for movement", imageUri: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=700&h=1050&fit=crop&auto=format&q=85" },
];

const DAILY_RHYTHMS: VisualChoice<HeatAdaptation>[] = [
  { label: "Long city days", value: "light_linen", description: "Breathable layers that stay composed", imageUri: "https://images.unsplash.com/photo-1610652492500-ded49ceeb378?w=700&h=1050&fit=crop&auto=format&q=85" },
  { label: "Easy weekends", value: "shorts_casual", description: "Comfortable, uncomplicated favourites", imageUri: "https://images.unsplash.com/photo-1523398002811-999ca8dec234?w=700&h=1050&fit=crop&auto=format&q=85" },
  { label: "Always moving", value: "sport_active", description: "Flexible looks for an active day", imageUri: "https://images.unsplash.com/photo-1538805060514-97d9cc17730c?w=700&h=1050&fit=crop&auto=format&q=85" },
];

const COLOUR_MOODS: VisualChoice<ColorPalette>[] = [
  { label: "Warm neutrals", value: "earthy_neutrals", description: "Camel, cream, olive and clay", imageUri: "https://images.unsplash.com/photo-1551803091-e20673f15770?w=700&h=1050&fit=crop&auto=format&q=85" },
  { label: "Dark & tonal", value: "monochrome", description: "Black, navy, white and grey", imageUri: "https://images.unsplash.com/photo-1539533018447-63fcce2678e3?w=700&h=1050&fit=crop&auto=format&q=85" },
  { label: "Colour accent", value: "vivid_colors", description: "One bold piece changes the whole look", imageUri: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=700&h=1050&fit=crop&auto=format&q=85" },
  { label: "Soft shades", value: "pastels", description: "Muted blue, blush, sage and stone", imageUri: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=700&h=1050&fit=crop&auto=format&q=85" },
  { label: "Desert tones", value: "desert_sand", description: "Sand, tobacco and sun-faded hues", imageUri: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=700&h=1050&fit=crop&auto=format&q=85" },
];

const GENDER_OPTIONS: { label: string; value: Gender }[] = [
  { label: "Male", value: "male" },
  { label: "Female", value: "female" },
  { label: "Non-binary", value: "non-binary" },
  { label: "Prefer not to say", value: "prefer_not_to_say" },
];

function VisualCard<T extends string>({ choice, selected, onPress }: {
  choice: VisualChoice<T>;
  selected: boolean;
  onPress: (value: T) => void;
}) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <TouchableOpacity onPress={() => onPress(choice.value)} activeOpacity={0.9} style={[styles.card, selected && styles.cardSelected]}>
      <Image source={{ uri: choice.imageUri }} style={styles.cardImage} contentFit="cover" transition={180} />
      <LinearGradient colors={["transparent", "rgba(20,14,12,0.9)"]} style={styles.cardShade} />
      {selected && <View style={styles.selectedBadge}><Feather name="check" size={15} color={colors.card} /></View>}
      <View style={styles.cardCopy}><Text style={styles.cardLabel}>{choice.label}</Text><Text style={styles.cardDescription}>{choice.description}</Text></View>
    </TouchableOpacity>
  );
}

export default function OnboardingScreen() {
  const { completeOnboarding } = useUserProfile();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState<Gender | null>(null);
  const [styleAesthetics, setStyleAesthetics] = useState<StyleAesthetic[]>([]);
  const [heatAdaptation, setHeatAdaptation] = useState<HeatAdaptation | null>(null);
  const [colorPalette, setColorPalette] = useState<ColorPalette | null>(null);
  const [completing, setCompleting] = useState(false);
  const validAge = Number.isInteger(Number(age)) && Number(age) >= 13 && Number(age) <= 120;
  const personalDetailsComplete = name.trim().length > 0 && validAge && gender !== null;
  const progress = (String(25 + step * 25) + "%") as `${number}%`;

  const toggleStyle = (value: StyleAesthetic) => setStyleAesthetics((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  const finish = async () => {
    if (!colorPalette || !gender || !personalDetailsComplete) return;
    setCompleting(true);
    await completeOnboarding({ fullName: name.trim(), age: Number(age), gender, styleAesthetics, heatAdaptation, colorPalette });
    router.replace("/(tabs)");
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.progressTrack}><View style={[styles.progressFill, { width: progress }]} /></View>
      {step === 0 && <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.welcomeScroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.hero}><Image source={{ uri: "https://images.unsplash.com/photo-1485968579580-b6d095142e6e?w=1000&h=900&fit=crop&auto=format&q=85" }} style={styles.heroImage} contentFit="cover" /><LinearGradient colors={["rgba(0,0,0,0.05)", "rgba(25,17,14,0.75)"]} style={styles.heroShade} /><View style={styles.heroCopy}><Text style={styles.eyebrow}>LOOKLY</Text><Text style={styles.heroTitle}>Your wardrobe,{"\n"}with a point of view.</Text></View></View>
          <View style={styles.welcomeCopy}>
            <Text style={styles.title}>Let's make it feel like you.</Text>
            <Text style={styles.subtitle}>A few details help Lookly make better outfit suggestions from the clothes you own.</Text>
            <Text style={styles.inputLabel}>Full name</Text>
            <TextInput value={name} onChangeText={setName} placeholder="Your full name" placeholderTextColor={colors.mutedForeground} style={styles.input} autoCapitalize="words" returnKeyType="next" />
            <Text style={styles.inputLabel}>Age</Text>
            <TextInput value={age} onChangeText={(value) => setAge(value.replace(/[^0-9]/g, ""))} placeholder="Your age" placeholderTextColor={colors.mutedForeground} style={styles.input} keyboardType="number-pad" maxLength={3} returnKeyType="done" />
            <Text style={styles.inputLabel}>Gender</Text>
            <View style={styles.genderRow}>{GENDER_OPTIONS.map((option) => <TouchableOpacity key={option.value} onPress={() => setGender(option.value)} style={[styles.genderButton, gender === option.value && styles.genderButtonSelected]}><Text style={[styles.genderButtonText, gender === option.value && styles.genderButtonTextSelected]}>{option.label}</Text></TouchableOpacity>)}</View>
            <TouchableOpacity onPress={() => setStep(1)} disabled={!personalDetailsComplete} style={[styles.primaryButton, !personalDetailsComplete && styles.primaryButtonDisabled]}><Text style={styles.primaryButtonText}>Continue</Text><Feather name="arrow-right" size={18} color={colors.card} /></TouchableOpacity>
            <Text style={styles.reassurance}>You can change these details later in your profile.</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>}
      {step === 1 && <ChoiceStep eyebrow="01 · YOUR STYLE EDIT" title="What would you happily wear?" subtitle="Tap every direction that feels like you. Mixing is encouraged." choices={STYLE_EDITS} selected={styleAesthetics} onPress={toggleStyle} selectedCopy={styleAesthetics.map((value) => STYLE_EDITS.find((choice) => choice.value === value)?.label).filter(Boolean).join(" · ")} back={() => setStep(0)} next={() => setStep(2)} nextDisabled={!styleAesthetics.length} nextLabel="Next" />}
      {step === 2 && <ChoiceStep eyebrow="02 · YOUR RHYTHM" title="What does a good day look like?" subtitle="This helps us make weather-aware suggestions that fit your real routine." choices={DAILY_RHYTHMS} selected={heatAdaptation ? [heatAdaptation] : []} onPress={setHeatAdaptation} back={() => setStep(1)} next={() => setStep(3)} nextDisabled={!heatAdaptation} nextLabel="Next" />}
      {step === 3 && <ChoiceStep eyebrow="03 · COLOUR MOOD" title="Which palette feels most like home?" subtitle="You can change this any time as your wardrobe grows." choices={COLOUR_MOODS} selected={colorPalette ? [colorPalette] : []} onPress={setColorPalette} back={() => setStep(2)} next={finish} nextDisabled={!colorPalette || completing} nextLabel={completing ? "Setting up…" : "Create my wardrobe"} />}
    </SafeAreaView>
  );
}

function ChoiceStep<T extends string>({ eyebrow, title, subtitle, choices, selected, onPress, selectedCopy, back, next, nextDisabled, nextLabel }: {
  eyebrow: string; title: string; subtitle: string; choices: VisualChoice<T>[]; selected: T[]; onPress: (value: T) => void; selectedCopy?: string; back: () => void; next: () => void; nextDisabled: boolean; nextLabel: string;
}) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return <View style={styles.flex}>
    <View style={styles.choiceHeader}><Text style={styles.eyebrowDark}>{eyebrow}</Text><Text style={styles.choiceTitle}>{title}</Text><Text style={styles.choiceSubtitle}>{subtitle}</Text></View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} snapToInterval={CARD_WIDTH + CARD_GAP} decelerationRate="fast" contentContainerStyle={styles.cardRow}>{choices.map((choice) => <VisualCard key={choice.value} choice={choice} selected={selected.includes(choice.value)} onPress={onPress} />)}</ScrollView>
    <View style={styles.selectionLine}><Text style={selectedCopy ? styles.selectionText : styles.hint}>{selectedCopy || "Swipe to browse · tap to choose"}</Text></View>
    <View style={styles.nav}><TouchableOpacity onPress={back} style={styles.backButton}><Feather name="arrow-left" size={16} color={colors.mutedForeground} /><Text style={styles.backText}>Back</Text></TouchableOpacity><TouchableOpacity onPress={next} disabled={nextDisabled} style={[styles.nextButton, nextDisabled && styles.nextButtonDisabled]}><Text style={styles.primaryButtonText}>{nextLabel}</Text><Feather name={nextLabel.includes("wardrobe") ? "check" : "arrow-right"} size={16} color={colors.card} /></TouchableOpacity></View>
  </View>;
}

function makeStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background }, flex: { flex: 1 }, progressTrack: { height: 3, backgroundColor: colors.border }, progressFill: { height: 3, backgroundColor: colors.accent },
    welcomeScroll: { paddingBottom: 32 }, hero: { height: 305, margin: 18, borderRadius: 24, overflow: "hidden" }, heroImage: { width: "100%", height: "100%" }, heroShade: { ...StyleSheet.absoluteFillObject }, heroCopy: { position: "absolute", left: 22, right: 22, bottom: 22 }, eyebrow: { color: "rgba(255,255,255,0.78)", fontSize: 11, fontWeight: "800", letterSpacing: 2 }, heroTitle: { color: colors.card, fontSize: 30, fontWeight: "800", lineHeight: 35, letterSpacing: -0.8, marginTop: 8 },
    welcomeCopy: { paddingHorizontal: 24, gap: 12 }, title: { fontSize: 27, fontWeight: "800", color: colors.text, letterSpacing: -0.5 }, subtitle: { fontSize: 15, color: colors.mutedForeground, lineHeight: 22 }, inputLabel: { color: colors.text, fontSize: 13, fontWeight: "700", marginTop: 6 }, input: { borderWidth: 1, borderColor: colors.border, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: colors.text, backgroundColor: colors.card },
    genderRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 }, genderButton: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 }, genderButtonSelected: { borderColor: colors.accent, backgroundColor: colors.accent }, genderButtonText: { color: colors.text, fontSize: 13, fontWeight: "700" }, genderButtonTextSelected: { color: colors.card },
    primaryButton: { marginTop: 8, backgroundColor: colors.foreground, borderRadius: 16, paddingVertical: 16, paddingHorizontal: 20, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }, primaryButtonDisabled: { backgroundColor: colors.border }, primaryButtonText: { color: colors.card, fontSize: 15, fontWeight: "800" }, reassurance: { textAlign: "center", color: colors.mutedForeground, fontSize: 12, marginTop: 2 },
    choiceHeader: { paddingHorizontal: 24, paddingTop: 30, paddingBottom: 18, gap: 6 }, eyebrowDark: { fontSize: 11, fontWeight: "800", letterSpacing: 1.6, color: colors.accent }, choiceTitle: { fontSize: 27, fontWeight: "800", color: colors.text, letterSpacing: -0.6 }, choiceSubtitle: { fontSize: 14, lineHeight: 20, color: colors.mutedForeground }, cardRow: { paddingHorizontal: 24, gap: CARD_GAP }, card: { width: CARD_WIDTH, height: CARD_HEIGHT, borderRadius: 22, overflow: "hidden", borderWidth: 3, borderColor: "transparent" }, cardSelected: { borderColor: colors.accent }, cardImage: { width: "100%", height: "100%", position: "absolute" }, cardShade: { position: "absolute", left: 0, right: 0, bottom: 0, height: "65%" }, selectedBadge: { position: "absolute", top: 12, right: 12, width: 30, height: 30, borderRadius: 15, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" }, cardCopy: { position: "absolute", left: 16, right: 16, bottom: 16 }, cardLabel: { color: colors.card, fontSize: 18, fontWeight: "800" }, cardDescription: { color: "rgba(255,255,255,0.8)", fontSize: 12, lineHeight: 16, marginTop: 3 },
    selectionLine: { minHeight: 28, paddingHorizontal: 24, justifyContent: "center", marginTop: 10 }, selectionText: { color: colors.accent, fontWeight: "700", fontSize: 12, textAlign: "center" }, hint: { color: colors.mutedForeground, fontSize: 12, textAlign: "center" }, nav: { flexDirection: "row", gap: 12, paddingHorizontal: 24, paddingTop: 14, paddingBottom: 24, alignItems: "center" }, backButton: { paddingVertical: 13, paddingHorizontal: 14, borderWidth: 1, borderColor: colors.border, borderRadius: 14, flexDirection: "row", gap: 6, alignItems: "center" }, backText: { color: colors.mutedForeground, fontWeight: "700", fontSize: 14 }, nextButton: { flex: 1, maxWidth: 190, backgroundColor: colors.foreground, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 16, flexDirection: "row", gap: 7, alignItems: "center", justifyContent: "center" }, nextButtonDisabled: { backgroundColor: colors.border },
  });
}
