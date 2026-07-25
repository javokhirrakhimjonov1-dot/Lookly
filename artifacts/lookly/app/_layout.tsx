import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { router, Stack, usePathname } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { StyleSheet } from "react-native";
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

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function OnboardingGuard() {
  const { onboardingComplete, isLoading } = useUserProfile();
  const { session, isLoading: isAuthLoading } = useAuth();
  const pathname = usePathname();

  useEffect(() => {
    if (isAuthLoading) return;
    if (!session) {
      // Expo refreshes typed route declarations when the dev server starts.
      router.replace("/auth" as never);
    } else if (!isLoading && !onboardingComplete) {
      router.replace("/onboarding");
    } else if (!isLoading && onboardingComplete && (pathname === "/onboarding" || pathname === "/auth")) {
      // A web refresh can reopen the prior /onboarding URL. Once the saved
      // profile is loaded, always take completed users to the actual app.
      router.replace("/(tabs)");
    }
  }, [isAuthLoading, session, isLoading, onboardingComplete, pathname]);

  return null;
}

function RootLayoutNav() {
  return (
    <>
      <OnboardingGuard />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
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
});
