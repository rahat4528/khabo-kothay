import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image } from 'react-native';
import { mobileStorage } from '../../services/storage.js';
import { getCurrentOrFallbackLocation } from '../../services/location.js';
import { t } from '../../i18n/index.js';

export default function OnboardingScreen({ navigation, theme }) {
  const [step, setStep] = useState(1);
  const [tasteRatings, setTasteRatings] = useState({
    Japanese: 50,
    Bangladeshi: 60,
    Biriyani: 70,
    Cafe: 60,
    Kabab: 65,
    Burger: 50
  });

  const handleLocationPerm = async () => {
    await getCurrentOrFallbackLocation();
    setStep(2);
  };

  const handleFinish = async () => {
    // Save onboarding preferences & taste
    const currentProfile = await mobileStorage.getTasteProfile();
    await mobileStorage.saveTasteProfile({ ...currentProfile, ...tasteRatings });
    await mobileStorage.setOnboarded(true);
    navigation.replace('MainTabs');
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {step === 1 ? (
          <View style={styles.card}>
            <Image source={require('../../../assets/icon.png')} style={styles.logoBadge} resizeMode="contain" />
            <Text style={[styles.title, { color: theme.colors.text }]}>
              Welcome to Khabo Kothay?
            </Text>
            <Text style={{ fontSize: 18, color: theme.colors.primary, fontWeight: '700', marginBottom: 6 }}>
              খাবো কোথায়?
            </Text>
            <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>
              We answer one question: "Where should you actually eat right now, and why?"
            </Text>
            <Text style={[styles.desc, { color: theme.colors.textSubtle }]}>
              To calculate traffic-aware travel times and Dhaka transport fares (rickshaws, CNGs, ride-shares), the app needs your approximate location.
            </Text>
            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: theme.colors.primary }]}
              onPress={handleLocationPerm}
              accessibilityRole="button"
              accessibilityLabel="Enable location services"
            >
              <Text style={styles.primaryBtnText}>Enable Location & Continue</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => setStep(2)}
              accessibilityRole="button"
              accessibilityLabel="Skip location for now"
            >
              <Text style={[styles.secondaryBtnText, { color: theme.colors.textMuted }]}>
                Skip & Use Default Location (Dhaka)
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.emoji}>🎯</Text>
            <Text style={[styles.title, { color: theme.colors.text }]}>
              Tell us what you like
            </Text>
            <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>
              Tap cuisines you enjoy. We will tailor recommendations to your taste!
            </Text>

            <View style={styles.tasteChips}>
              {Object.keys(tasteRatings).map((cuisine) => {
                const isBoosted = tasteRatings[cuisine] >= 75;
                return (
                  <TouchableOpacity
                    key={cuisine}
                    style={[
                      styles.chip,
                      isBoosted && { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }
                    ]}
                    onPress={() => {
                      setTasteRatings(prev => ({
                        ...prev,
                        [cuisine]: prev[cuisine] >= 75 ? 50 : 80
                      }));
                    }}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: isBoosted }}
                    accessibilityLabel={`${cuisine} preference, ${isBoosted ? 'selected' : 'unselected'}`}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={[styles.chipText, { color: isBoosted ? theme.colors.onPrimary : theme.colors.textMuted }]}>
                      {cuisine} {isBoosted ? '❤️' : '🤍'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: theme.colors.primary }]}
              onPress={handleFinish}
              accessibilityRole="button"
              accessibilityLabel="Complete onboarding"
            >
              <Text style={[styles.primaryBtnText, { color: theme.colors.onPrimary }]}>Start Finding Food 🚀</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  card: { alignItems: 'center' },
  logoBadge: { width: 72, height: 72, borderRadius: 16, alignSelf: 'center', marginBottom: 16 },
  emoji: { fontSize: 64, marginBottom: 16 },
  title: { fontSize: 24, fontWeight: '800', textAlign: 'center', marginBottom: 10 },
  subtitle: { fontSize: 16, textAlign: 'center', marginBottom: 16, lineHeight: 22 },
  desc: { fontSize: 14, textAlign: 'center', marginBottom: 32, lineHeight: 20 },
  primaryBtn: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 12
  },
  primaryBtnText: { fontSize: 16, fontWeight: '800' },
  secondaryBtn: { paddingVertical: 12 },
  secondaryBtnText: { fontSize: 14, fontWeight: '600' },
  tasteChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginVertical: 20 },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.05)'
  },
  chipText: { fontWeight: '700', fontSize: 14 }
});
