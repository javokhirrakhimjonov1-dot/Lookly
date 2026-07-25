import React, { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";

export default function AuthScreen() {
  const colors = useColors();
  const { signIn, signUp, isConfigured } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  const submit = async () => {
    if (!email.includes("@") || password.length < 6) {
      setIsError(true);
      setMessage("Enter a valid email and a password with at least 6 characters.");
      return;
    }
    setMessage(null);
    setIsSubmitting(true);
    try {
      if (isSignUp) {
        const result = await signUp(email, password);
        if (result.error) {
          setIsError(true);
          setMessage(result.error);
        } else if (result.needsEmailConfirmation) {
          setIsError(false);
          setMessage("Account created. Open the confirmation email, then return here and sign in.");
        }
      } else {
        const error = await signIn(email, password);
        if (error) {
          setIsError(true);
          if (error.toLowerCase().includes("email not confirmed")) {
            setMessage("This account is still waiting for email verification. Delete this old test account in Supabase Users, then create it again.");
          } else {
            setMessage("We couldn't sign you in. Check your email and password, or create an account if you're new.");
          }
        }
      }
    } catch {
      setIsError(true);
      setMessage("We couldn't reach the account service. Check your internet connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <Text style={[styles.brand, { color: colors.primary }]}>LOOKLY</Text>
        <Text style={[styles.title, { color: colors.foreground }]}>{isSignUp ? "Create your account" : "Welcome back"}</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Your wardrobe stays private to your account.</Text>

        {!isConfigured ? (
          <Text style={[styles.error, { color: colors.destructive }]}>This app is missing its secure Supabase connection.</Text>
        ) : null}
        {message ? <Text style={[styles.message, { color: isError ? colors.destructive : colors.success }]}>{message}</Text> : null}

        <TextInput
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          placeholder="Email"
          placeholderTextColor={colors.mutedForeground}
          value={email}
          onChangeText={setEmail}
          style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
        />
        <TextInput
          autoComplete={isSignUp ? "new-password" : "password"}
          placeholder="Password (at least 6 characters)"
          placeholderTextColor={colors.mutedForeground}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
        />
        <Pressable
          disabled={isSubmitting || !isConfigured}
          onPress={() => void submit()}
          style={[styles.primaryButton, { backgroundColor: colors.primary, opacity: isSubmitting || !isConfigured ? 0.6 : 1 }]}
        >
          {isSubmitting ? <ActivityIndicator color={colors.primaryForeground} /> : <Text style={[styles.primaryButtonText, { color: colors.primaryForeground }]}>{isSignUp ? "Create account" : "Sign in"}</Text>}
        </Pressable>
        <Pressable onPress={() => { setIsSignUp((value) => !value); setMessage(null); }} style={styles.switchButton}>
          <Text style={[styles.switchText, { color: colors.accent }]}>{isSignUp ? "Already have an account? Sign in" : "New to Lookly? Create an account"}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flex: 1, justifyContent: "center", padding: 24, gap: 14 },
  brand: { fontSize: 15, fontWeight: "800", letterSpacing: 3 },
  title: { fontSize: 32, fontWeight: "700", marginTop: 4 },
  subtitle: { fontSize: 15, lineHeight: 22, marginBottom: 18 },
  input: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 15, paddingVertical: 14, fontSize: 16 },
  primaryButton: { borderRadius: 14, paddingVertical: 15, alignItems: "center", marginTop: 6, minHeight: 52 },
  primaryButtonText: { fontSize: 16, fontWeight: "700" },
  switchButton: { alignItems: "center", paddingVertical: 10 },
  switchText: { fontSize: 14, fontWeight: "600" },
  error: { fontSize: 14, lineHeight: 20 },
  message: { fontSize: 14, lineHeight: 20, fontWeight: "600" },
});
