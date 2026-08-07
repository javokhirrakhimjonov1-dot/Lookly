import { Feather } from "@/components/FeatherIcon";
import { useAuth } from "@/contexts/AuthContext";
import type { Gender } from "@/contexts/UserProfileContext";
import { useColors } from "@/hooks/useColors";
import { router, useLocalSearchParams } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { isSupportedAge, MAX_SUPPORTED_AGE, MIN_SUPPORTED_AGE } from "@/lib/profileRules";
import type { HijabPreference } from "@/lib/modestyRules";
import { useLanguage } from "@/contexts/LanguageContext";

const GENDER_OPTIONS: { label: string; value: Gender; icon: "user" | "users" }[] = [
  { label: "Male", value: "male", icon: "user" },
  { label: "Female", value: "female", icon: "user" },
  { label: "Non-binary", value: "non-binary", icon: "users" },
  { label: "Prefer not to say", value: "prefer_not_to_say", icon: "users" },
];

export default function AuthScreen() {
  const colors = useColors();
  const { t } = useLanguage();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { signIn, signUp, requestPasswordReset, updatePassword, session, isConfigured } = useAuth();
  const { reset } = useLocalSearchParams<{ reset?: string }>();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [isRequestingReset, setIsRequestingReset] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [gender, setGender] = useState<Gender | null>(null);
  const [hijabPreference, setHijabPreference] = useState<HijabPreference>(null);
  const [age, setAge] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  const isSignUp = mode === "signup";

  const selectMode = (nextMode: "login" | "signup") => {
    setMode(nextMode);
    setIsRequestingReset(false);
    setMessage(null);
  };

  const changeAge = (amount: -1 | 1) => {
    setAge((current) => {
      if (!current) return String(MIN_SUPPORTED_AGE);
      const next = Number(current) + amount;
      return String(Math.max(MIN_SUPPORTED_AGE, Math.min(MAX_SUPPORTED_AGE, next)));
    });
  };

  const submit = async () => {
    const isResettingPassword = reset === "1";
    if (isResettingPassword) {
      if (!session) {
        setIsError(true);
        setMessage("Open the password-reset link from your email to choose a new password.");
        return;
      }
      if (password.length < 6 || password !== confirmPassword) {
        setIsError(true);
        setMessage("Use a password with at least 6 characters and make both passwords match.");
        return;
      }
      setMessage(null);
      setIsSubmitting(true);
      try {
        const error = await updatePassword(password);
        if (error) {
          setIsError(true);
          setMessage(error);
        } else {
          setIsError(false);
          setMessage("Password updated. You can now sign in.");
          router.replace("/auth");
        }
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (isRequestingReset) {
      if (!email.includes("@")) {
        setIsError(true);
        setMessage("Enter the email address for your Lookly account.");
        return;
      }
      setMessage(null);
      setIsSubmitting(true);
      try {
        const error = await requestPasswordReset(email);
        setIsError(Boolean(error));
        setMessage(error ?? "If this account exists, we sent a secure password-reset link to your email.");
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (!email.includes("@") || password.length < 6) {
      setIsError(true);
      setMessage("Enter a valid email and a password with at least 6 characters.");
      return;
    }
    if (isSignUp && (!fullName.trim() || !gender || !isSupportedAge(Number(age)) || (gender === "female" && hijabPreference === null))) {
      setIsError(true);
      setMessage(gender === "female" && hijabPreference === null
        ? t("hijab_required_error")
        : `Add your full name, choose a gender option, and enter an age from ${MIN_SUPPORTED_AGE} to ${MAX_SUPPORTED_AGE}.`);
      return;
    }

    setMessage(null);
    setIsSubmitting(true);
    try {
      if (isSignUp) {
        const result = await signUp(email, password, { fullName, gender: gender!, age: Number(age), hijabPreference: gender === "female" ? hijabPreference : null });
        if (result.error) {
          setIsError(true);
          setMessage(result.error);
        } else if (result.needsEmailConfirmation) {
          setIsError(false);
          setMessage("Account created. Check your email to confirm it, then come back and log in.");
        }
      } else {
        const error = await signIn(email, password);
        if (error) {
          setIsError(true);
          setMessage(error.toLowerCase().includes("email not confirmed")
            ? "Please confirm your email before logging in."
            : "We couldn't log you in. Check your email and password, or sign up if you're new.");
        }
      }
    } catch {
      setIsError(true);
      setMessage("We couldn't reach the account service. Check your internet connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const title = reset === "1"
    ? "Choose a new password"
    : isRequestingReset
      ? "Reset your password"
      : isSignUp ? "Create your account" : "Welcome back";

  return (
    <SafeAreaView style={styles.root}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.card}>
            <View style={styles.brandRow}>
              <View style={styles.brandMark}><Text style={styles.brandMarkText}>L</Text></View>
              <Text style={styles.brand}>LOOKLY</Text>
            </View>

            {reset !== "1" && !isRequestingReset ? (
              <View style={styles.segmentedControl}>
                {(["login", "signup"] as const).map((item) => {
                  const active = mode === item;
                  return (
                    <Pressable key={item} accessibilityRole="tab" accessibilityState={{ selected: active }} onPress={() => selectMode(item)} style={[styles.segment, active && styles.segmentActive]}>
                      <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{item === "login" ? "Log in" : "Sign up"}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}

            <View style={styles.headingBlock}>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.subtitle}>{isSignUp ? "Tell us a little about you to personalize your wardrobe." : "Your wardrobe is waiting for you."}</Text>
            </View>

            {!isConfigured ? <Text style={[styles.message, { color: colors.destructive }]}>This app is missing its secure Supabase connection.</Text> : null}
            {message ? <Text style={[styles.message, { color: isError ? colors.destructive : colors.success }]}>{message}</Text> : null}

            {isSignUp && !isRequestingReset && reset !== "1" ? (
              <Field label="Full name">
                <TextInput autoCapitalize="words" autoComplete="name" placeholder="Your full name" placeholderTextColor={colors.mutedForeground} value={fullName} onChangeText={setFullName} style={styles.input} />
              </Field>
            ) : null}

            {reset !== "1" ? (
              <Field label="Email">
                <TextInput autoCapitalize="none" autoComplete="email" keyboardType="email-address" placeholder="you@example.com" placeholderTextColor={colors.mutedForeground} value={email} onChangeText={setEmail} style={styles.input} />
              </Field>
            ) : null}

            {!isRequestingReset ? (
              <Field label="Password">
                <TextInput autoComplete={isSignUp || reset === "1" ? "new-password" : "off"} placeholder={reset === "1" ? "New password" : "At least 6 characters"} placeholderTextColor={colors.mutedForeground} secureTextEntry value={password} onChangeText={setPassword} style={styles.input} />
              </Field>
            ) : null}

            {reset === "1" ? (
              <Field label="Confirm password">
                <TextInput autoComplete="new-password" placeholder="Repeat your new password" placeholderTextColor={colors.mutedForeground} secureTextEntry value={confirmPassword} onChangeText={setConfirmPassword} style={styles.input} />
              </Field>
            ) : null}

            {isSignUp && !isRequestingReset && reset !== "1" ? (
              <>
                <Field label="Gender">
                  <View style={styles.genderGrid}>
                    {GENDER_OPTIONS.map((option) => {
                      const selected = gender === option.value;
                      return (
                        <Pressable key={option.value} onPress={() => { setGender(option.value); if (option.value !== "female") setHijabPreference(null); }} style={[styles.genderOption, selected && styles.genderOptionSelected]}>
                          <Feather name={option.icon} size={15} color={selected ? colors.primaryForeground : colors.foreground} />
                          <Text style={[styles.genderText, selected && styles.genderTextSelected]}>{option.label}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </Field>

                {gender === "female" ? (
                  <Field label={t("hijab_question")}>
                    <Text style={styles.preferenceHint}>{t("hijab_question_hint")}</Text>
                    <View style={styles.genderGrid}>
                      {(["always", "no"] as const).map((value) => {
                        const selected = hijabPreference === value;
                        return (
                          <Pressable
                            key={value}
                            accessibilityRole="radio"
                            accessibilityState={{ selected }}
                            onPress={() => setHijabPreference(value)}
                            style={[styles.genderOption, selected && styles.genderOptionSelected]}
                          >
                            <Feather name={value === "always" ? "check-circle" : "circle"} size={15} color={selected ? colors.primaryForeground : colors.foreground} />
                            <Text style={[styles.genderText, selected && styles.genderTextSelected]}>{t(value === "always" ? "hijab_yes_always" : "hijab_no")}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </Field>
                ) : null}

                <Field label="Age" labelAccessory={age ? <Text style={styles.ageValue}>{age} years old</Text> : undefined}>
                  <View style={styles.ageControl}>
                    <Pressable
                      accessibilityLabel="Decrease age"
                      accessibilityRole="button"
                      accessibilityState={{ disabled: Number(age) <= MIN_SUPPORTED_AGE }}
                      disabled={Number(age) <= MIN_SUPPORTED_AGE}
                      onPress={() => changeAge(-1)}
                      style={({ pressed }) => [styles.ageButton, Number(age) <= MIN_SUPPORTED_AGE && styles.ageButtonDisabled, pressed && styles.ageButtonPressed]}
                    >
                      <Feather name="minus" size={22} color={colors.foreground} />
                    </Pressable>
                    <TextInput
                      accessibilityLabel="Age"
                      inputMode="numeric"
                      keyboardType="number-pad"
                      onChangeText={(value) => setAge(value.replace(/[^0-9]/g, ""))}
                      placeholder={`${MIN_SUPPORTED_AGE}–${MAX_SUPPORTED_AGE}`}
                      placeholderTextColor={colors.mutedForeground}
                      returnKeyType="done"
                      selectTextOnFocus
                      style={[styles.ageInput, Platform.OS === "web" ? ({ outlineStyle: "none", outlineWidth: 0 } as any) : null]}
                      value={age}
                    />
                    <Pressable
                      accessibilityLabel="Increase age"
                      accessibilityRole="button"
                      disabled={Number(age) >= MAX_SUPPORTED_AGE}
                      onPress={() => changeAge(1)}
                      style={({ pressed }) => [styles.ageButton, Number(age) >= MAX_SUPPORTED_AGE && styles.ageButtonDisabled, pressed && styles.ageButtonPressed]}
                    >
                      <Feather name="plus" size={22} color={colors.foreground} />
                    </Pressable>
                  </View>
                </Field>
              </>
            ) : null}

            {!isSignUp && reset !== "1" && !isRequestingReset ? (
              <Pressable onPress={() => { setIsRequestingReset(true); setMessage(null); }} style={styles.forgotButton}>
                <Text style={styles.forgotText}>Forgot password?</Text>
              </Pressable>
            ) : null}

            <Pressable disabled={isSubmitting || !isConfigured} onPress={() => void submit()} style={[styles.primaryButton, { opacity: isSubmitting || !isConfigured ? 0.55 : 1 }]}>
              {isSubmitting ? <ActivityIndicator color={colors.primaryForeground} /> : <Text style={styles.primaryButtonText}>{reset === "1" ? "Save new password" : isRequestingReset ? "Send reset link" : isSignUp ? "Create account" : "Log in"}</Text>}
            </Pressable>

            {isRequestingReset ? (
              <Pressable onPress={() => { setIsRequestingReset(false); setMessage(null); }} style={styles.backButton}>
                <Feather name="arrow-left" size={15} color={colors.accent} />
                <Text style={styles.backText}>Back to log in</Text>
              </Pressable>
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({ label, labelAccessory, children }: { label: string; labelAccessory?: React.ReactNode; children: React.ReactNode }) {
  const colors = useColors();
  return (
    <View style={{ gap: 7 }}>
      <View style={{ minHeight: 18, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text style={{ color: colors.foreground, fontSize: 11, fontWeight: "800", letterSpacing: 0.85, textTransform: "uppercase" }}>{label}</Text>
        {labelAccessory}
      </View>
      {children}
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    flex: { flex: 1 },
    page: { flexGrow: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 18, paddingVertical: 28 },
    card: { width: "100%", maxWidth: 480, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 26, padding: 22, gap: 15, shadowColor: "#1C1512", shadowOpacity: 0.07, shadowRadius: 28, shadowOffset: { width: 0, height: 12 }, elevation: 3 },
    brandRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, marginBottom: 1 },
    brandMark: { width: 28, height: 28, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: colors.primary },
    brandMarkText: { color: colors.primaryForeground, fontSize: 15, fontWeight: "900" },
    brand: { color: colors.foreground, fontSize: 14, fontWeight: "900", letterSpacing: 2.8 },
    segmentedControl: { flexDirection: "row", padding: 4, borderWidth: 1, borderColor: colors.border, borderRadius: 16, backgroundColor: colors.secondary },
    segment: { flex: 1, minHeight: 46, borderRadius: 12, alignItems: "center", justifyContent: "center" },
    segmentActive: { backgroundColor: colors.primary },
    segmentText: { color: colors.mutedForeground, fontSize: 15, fontWeight: "800" },
    segmentTextActive: { color: colors.primaryForeground },
    headingBlock: { alignItems: "center", gap: 5, marginVertical: 3 },
    title: { color: colors.foreground, fontSize: 25, lineHeight: 31, fontWeight: "800", letterSpacing: -0.45, textAlign: "center" },
    subtitle: { color: colors.mutedForeground, fontSize: 13, lineHeight: 19, textAlign: "center", maxWidth: 360 },
    message: { fontSize: 13, lineHeight: 19, fontWeight: "600", textAlign: "center", paddingHorizontal: 4 },
    field: { gap: 7 },
    fieldLabelRow: { minHeight: 18, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    fieldLabel: { color: colors.foreground, fontSize: 11, fontWeight: "800", letterSpacing: 0.85, textTransform: "uppercase" },
    input: { minHeight: 52, borderWidth: 1, borderColor: colors.border, borderRadius: 14, paddingHorizontal: 15, paddingVertical: 13, color: colors.foreground, backgroundColor: colors.background, fontSize: 15 },
    genderGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    genderOption: { minHeight: 45, flexGrow: 1, flexBasis: "43%", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, borderWidth: 1, borderColor: colors.border, borderRadius: 13, backgroundColor: colors.background, paddingHorizontal: 10 },
    genderOptionSelected: { borderColor: colors.primary, backgroundColor: colors.primary },
    genderText: { color: colors.foreground, fontSize: 13, fontWeight: "700" },
    genderTextSelected: { color: colors.primaryForeground },
    preferenceHint: { color: colors.mutedForeground, fontSize: 12, lineHeight: 17, marginTop: -2 },
    ageValue: { color: colors.accent, fontSize: 12, fontWeight: "800" },
    ageControl: { minHeight: 62, flexDirection: "row", alignItems: "stretch", gap: 9 },
    ageButton: { width: 62, borderWidth: 1, borderColor: colors.border, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
    ageButtonDisabled: { opacity: 0.35 },
    ageButtonPressed: { backgroundColor: colors.secondary },
    ageInput: { flex: 1, minWidth: 0, borderWidth: 1, borderColor: colors.accent, borderRadius: 14, paddingHorizontal: 10, color: colors.foreground, backgroundColor: colors.accent + "12", fontSize: 22, fontWeight: "800", textAlign: "center" },
    forgotButton: { alignSelf: "flex-end", paddingVertical: 2 },
    forgotText: { color: colors.accent, fontSize: 13, fontWeight: "700", textDecorationLine: "underline" },
    primaryButton: { minHeight: 54, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: colors.primary, marginTop: 2 },
    primaryButtonText: { color: colors.primaryForeground, fontSize: 16, fontWeight: "800" },
    backButton: { minHeight: 36, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
    backText: { color: colors.accent, fontSize: 13, fontWeight: "700" },
  });
}
