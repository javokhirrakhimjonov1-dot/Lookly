import { BlurView } from "expo-blur";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Tabs } from "expo-router";
import { Icon, Label, NativeTabs } from "expo-router/unstable-native-tabs";
import { SymbolView } from "expo-symbols";
import { Feather } from "@/components/FeatherIcon";
import React from "react";
import { Platform, StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";
import { useLanguage } from "@/contexts/LanguageContext";

function TabLabel({ children }: { children: string }) {
  return (
    <Text
      style={{ fontSize: 11, fontWeight: "600" }}
      numberOfLines={1}
      adjustsFontSizeToFit
      ellipsizeMode="tail"
    >
      {children}
    </Text>
  );
}

function NativeTabLayout() {
  const { t } = useLanguage();
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <Icon sf={{ default: "house", selected: "house.fill" }} />
        <Label>{t("tab_home")}</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="wardrobe">
        <Icon sf={{ default: "hanger", selected: "hanger" }} />
        <Label>{t("tab_wardrobe")}</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="looks">
        <Icon sf={{ default: "camera", selected: "camera.fill" }} />
        <Label>{t("tab_looks")}</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="deals">
        <Icon sf={{ default: "tag", selected: "tag.fill" }} />
        <Label>{t("tab_deals")}</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="stats">
        <Icon sf={{ default: "chart.bar", selected: "chart.bar.fill" }} />
        <Label>{t("tab_stats")}</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

function ClassicTabLayout() {
  const colors = useColors();
  const { t } = useLanguage();
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        headerShown: false,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: isIOS ? "transparent" : colors.background,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          elevation: 0,
          height: isWeb ? 84 : 60,
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView
              intensity={100}
              tint="light"
              style={StyleSheet.absoluteFill}
            />
          ) : isWeb ? (
            <View
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: colors.background },
              ]}
            />
          ) : null,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
          marginBottom: isWeb ? 12 : 4,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={() => ({
          title: t("tab_home"),
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="house" tintColor={color} size={22} />
            ) : (
              <Feather name="home" size={22} color={color} />
            ),
          tabBarLabel: ({ color }) => <TabLabel>{t("tab_home")}</TabLabel>,
        })}
      />
      <Tabs.Screen
        name="wardrobe"
        options={() => ({
          title: t("tab_wardrobe"),
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="tshirt" tintColor={color} size={22} />
            ) : (
              <Feather name="layers" size={22} color={color} />
            ),
          tabBarLabel: ({ color }) => <TabLabel>{t("tab_wardrobe")}</TabLabel>,
        })}
      />
      <Tabs.Screen
        name="looks"
        options={() => ({
          title: t("tab_looks"),
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="camera" tintColor={color} size={22} />
            ) : (
              <Feather name="camera" size={22} color={color} />
            ),
          tabBarLabel: ({ color }) => <TabLabel>{t("tab_looks")}</TabLabel>,
        })}
      />
      <Tabs.Screen
        name="deals"
        options={() => ({
          title: t("tab_deals"),
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="tag" tintColor={color} size={22} />
            ) : (
              <Feather name="tag" size={22} color={color} />
            ),
          tabBarLabel: ({ color }) => <TabLabel>{t("tab_deals")}</TabLabel>,
        })}
      />
      <Tabs.Screen
        name="stats"
        options={() => ({
          title: t("tab_stats"),
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="chart.bar" tintColor={color} size={22} />
            ) : (
              <Feather name="bar-chart-2" size={22} color={color} />
            ),
          tabBarLabel: ({ color }) => <TabLabel>{t("tab_stats")}</TabLabel>,
        })}
      />
    </Tabs>
  );
}

export default function TabLayout() {
  if (Platform.OS === "web") {
    return <ClassicTabLayout />;
  }
  if (isLiquidGlassAvailable()) {
    return <NativeTabLayout />;
  }
  return <ClassicTabLayout />;
}
