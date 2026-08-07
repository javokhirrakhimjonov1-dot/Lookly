import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { router, Stack, useLocalSearchParams, usePathname } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { WardrobeProvider } from "@/contexts/WardrobeContext";
import { WeatherProvider } from "@/contexts/WeatherContext";
import { SocialProvider } from "@/contexts/SocialContext";
import { SquadVoteProvider } from "@/contexts/SquadVoteContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { DealsProvider } from "@/contexts/DealsContext";
import { UserProfileProvider, useUserProfile } from "@/contexts/UserProfileContext";
import { CalendarProvider } from "@/contexts/CalendarContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { FeatureWaitlistProvider } from "@/contexts/FeatureWaitlistContext";
import { needsHijabProfileCompletion } from "@/lib/profileRules";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function OnboardingGuard() {
  const { onboardingComplete, gender, stylingPreferences, isLoading } = useUserProfile();
  const { session, isLoading: isAuthLoading } = useAuth();
  const pathname = usePathname();
  const { reset } = useLocalSearchParams<{ reset?: string }>();

  useEffect(() => {
    if (isAuthLoading || reset === "1") return;
    if (!session) {
      // Expo refreshes typed route declarations when the dev server starts.
      router.replace("/auth" as never);
    } else if (!isLoading && !onboardingComplete) {
      router.replace("/onboarding");
    } else if (!isLoading && onboardingComplete && needsHijabProfileCompletion(gender, stylingPreferences.hijabPreference) && pathname !== "/hijab-profile") {
      router.replace("/hijab-profile" as never);
    } else if (!isLoading && onboardingComplete && pathname === "/hijab-profile" && !needsHijabProfileCompletion(gender, stylingPreferences.hijabPreference)) {
      router.replace("/(tabs)");
    } else if (!isLoading && onboardingComplete && (pathname === "/onboarding" || pathname === "/auth")) {
      // A web refresh can reopen the prior /onboarding URL. Once the saved
      // profile is loaded, always take completed users to the actual app.
      router.replace("/(tabs)");
    }
  }, [isAuthLoading, session, isLoading, onboardingComplete, gender, stylingPreferences.hijabPreference, pathname, reset]);

  return null;
}

function RootLayoutNav() {
  return (
    <>
      <OnboardingGuard />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="hijab-profile" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="auth" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen
          name="add-item"
          options={{ headerShown: false, presentation: "modal" }}
        />
        <Stack.Screen name="profile" options={{ headerShown: false }} />
        <Stack.Screen name="outfit-builder" options={{ headerShown: false }} />
        <Stack.Screen name="calendar" options={{ headerShown: false }} />
        <Stack.Screen name="pack-trip" options={{ headerShown: false }} />
        <Stack.Screen name="shuffle" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}

function TelegramBrowserNotice() {
  const [dismissed, setDismissed] = useState(false);
  const [copied, setCopied] = useState(false);
  const isTelegram = Platform.OS === "web"
    && typeof navigator !== "undefined"
    && /telegram/i.test(navigator.userAgent);

  if (!isTelegram || dismissed) return null;

  const copyLink = async () => {
    try {
      await navigator.clipboard?.writeText(window.location.href);
      setCopied(true);
    } catch {
      // The address remains visible in Telegram's browser bar, so users can
      // still open it with Telegram's “Open in Safari/Chrome” menu item.
      setCopied(false);
    }
  };

  return (
    <View style={styles.telegramNotice} accessibilityRole="alert">
      <View style={styles.telegramCopy}>
        <Text style={styles.telegramTitle}>Open Lookly in your browser</Text>
        <Text style={styles.telegramText}>
          Telegram may block photo and camera uploads. Tap ⋯ in Telegram, then choose Open in Safari or Chrome.
        </Text>
      </View>
      <View style={styles.telegramActions}>
        <Pressable onPress={() => void copyLink()} style={styles.telegramCopyButton}>
          <Text style={styles.telegramCopyButtonText}>{copied ? "Copied" : "Copy link"}</Text>
        </Pressable>
        <Pressable onPress={() => setDismissed(true)} hitSlop={10}>
          <Text style={styles.telegramClose}>×</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <LanguageProvider>
          <AuthProvider>
          <UserProfileProvider>
            <WeatherProvider>
              <WardrobeProvider>
                <CalendarProvider>
                  <SocialProvider>
                    <SquadVoteProvider>
                      <FeatureWaitlistProvider>
                        <DealsProvider>
                          <GestureHandlerRootView style={styles.root}>
                            <KeyboardProvider>
                              <RootLayoutNav />
                              <TelegramBrowserNotice />
                            </KeyboardProvider>
                          </GestureHandlerRootView>
                        </DealsProvider>
                      </FeatureWaitlistProvider>
                    </SquadVoteProvider>
                  </SocialProvider>
                </CalendarProvider>
              </WardrobeProvider>
            </WeatherProvider>
          </UserProfileProvider>
          </AuthProvider>
          </LanguageProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  telegramNotice: {
    position: "absolute",
    top: 14,
    left: 14,
    right: 14,
    zIndex: 1000,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#F5C7A9",
    backgroundColor: "#FFF7F1",
    padding: 12,
    shadowColor: "#1C1512",
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 6,
  },
  telegramCopy: { flex: 1, gap: 3 },
  telegramTitle: { color: "#1C1512", fontSize: 14, fontWeight: "800" },
  telegramText: { color: "#705F56", fontSize: 12, lineHeight: 17 },
  telegramActions: { alignItems: "center", gap: 4 },
  telegramCopyButton: { backgroundColor: "#1C1512", borderRadius: 9, paddingHorizontal: 9, paddingVertical: 7 },
  telegramCopyButtonText: { color: "#FFFFFF", fontSize: 11, fontWeight: "800" },
  telegramClose: { color: "#705F56", fontSize: 22, lineHeight: 22 },
});
