import { Feather } from "@/components/FeatherIcon";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUserProfile } from "@/contexts/UserProfileContext";
import { useColors } from "@/hooks/useColors";
import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function HijabProfileScreen() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { t } = useLanguage();
  const { setHijabPreference } = useUserProfile();
  const [saving, setSaving] = useState<"always" | "no" | null>(null);

  const choose = async (value: "always" | "no") => {
    if (saving) return;
    setSaving(value);
    try {
      await setHijabPreference(value);
      router.replace("/(tabs)");
    } finally {
      setSaving(null);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.page}>
        <View style={styles.icon}><Feather name="shield" size={28} color={colors.accent} /></View>
        <Text style={styles.eyebrow}>LOOKLY</Text>
        <Text style={styles.title}>{t("hijab_question")}</Text>
        <Text style={styles.subtitle}>{t("hijab_completion_hint")}</Text>
        <View style={styles.actions}>
          {(["always", "no"] as const).map((value) => (
            <TouchableOpacity
              key={value}
              accessibilityRole="button"
              disabled={saving !== null}
              onPress={() => void choose(value)}
              style={[styles.choice, value === "always" && styles.primaryChoice]}
            >
              {saving === value ? <ActivityIndicator color={value === "always" ? colors.primaryForeground : colors.foreground} /> : <>
                <Feather name={value === "always" ? "check-circle" : "circle"} size={19} color={value === "always" ? colors.primaryForeground : colors.foreground} />
                <Text style={[styles.choiceText, value === "always" && styles.primaryChoiceText]}>{t(value === "always" ? "hijab_yes_always" : "hijab_no")}</Text>
              </>}
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.privacy}>{t("hijab_privacy_hint")}</Text>
      </View>
    </SafeAreaView>
  );
}

function makeStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    page: { flex: 1, justifyContent: "center", paddingHorizontal: 28, maxWidth: 520, width: "100%", alignSelf: "center", gap: 14 },
    icon: { width: 58, height: 58, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.accent + "1F", marginBottom: 4 },
    eyebrow: { color: colors.accent, fontSize: 11, fontWeight: "900", letterSpacing: 2.4 },
    title: { color: colors.foreground, fontSize: 30, lineHeight: 36, fontWeight: "800", letterSpacing: -0.7 },
    subtitle: { color: colors.mutedForeground, fontSize: 15, lineHeight: 22, marginBottom: 8 },
    actions: { gap: 10 },
    choice: { minHeight: 58, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, paddingHorizontal: 16 },
    primaryChoice: { backgroundColor: colors.primary, borderColor: colors.primary },
    choiceText: { color: colors.foreground, fontSize: 15, fontWeight: "800" },
    primaryChoiceText: { color: colors.primaryForeground },
    privacy: { color: colors.mutedForeground, textAlign: "center", fontSize: 12, lineHeight: 18, marginTop: 6 },
  });
}
