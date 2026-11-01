import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
  TextInput,
  Alert
} from 'react-native';
import { mobileStorage } from '../../services/storage.js';
import { apiClient } from '../../api/client.js';
import { t } from '../../i18n/index.js';

const ALL_CUISINES = [
  'Japanese', 'Bangladeshi', 'Indian', 'Chinese', 'Korean',
  'Fast Food', 'Cafe', 'Kabab', 'Biriyani', 'Dessert', 'Coffee', 'Burger'
];

const COMMON_DISLIKED = [
  'Bitter gourd', 'Mustard oil', 'Beef', 'Prawns', 'Pork', 'Dairy', 'Spicy chili', 'Cilantro'
];

export default function TasteScreen({ theme }) {
  const [activeTab, setActiveTab] = useState('profile'); // 'profile' | 'weights'

  // Food Profile State (Phase 3)
  const [foodProfile, setFoodProfile] = useState({
    preferredCuisines: [],
    budgetMin: 200,
    budgetMax: 1200,
    dietary: {
      halal: false,
      vegetarian: false,
      vegan: false,
      no_beef: false
    },
    dislikedFoods: []
  });
  const [customDislikeText, setCustomDislikeText] = useState('');
  const [saveSuccessMsg, setSaveSuccessMsg] = useState(false);

  // AI Taste Learning State
  const [tasteProfile, setTasteProfile] = useState({});
  const [learningEnabled, setLearningEnabled] = useState(true);
  const [banditProfile, setBanditProfile] = useState(null);

  useEffect(() => {
    loadAllProfiles();
  }, []);

  const loadAllProfiles = async () => {
    // 1. Food Profile
    const fp = await mobileStorage.getFoodProfile();
    if (fp) setFoodProfile(fp);

    // 2. Taste Learning Profile
    const tp = await mobileStorage.getTasteProfile();
    const le = await mobileStorage.isLearningEnabled();
    setTasteProfile(tp);
    setLearningEnabled(le);

    // 3. Bandit Weights
    try {
      const b = await apiClient.getBanditWeights();
      if (b) setBanditProfile(b);
    } catch (e) {}
  };

  // --- Food Profile Handlers ---

  const handleToggleCuisine = (cuisine) => {
    const list = [...foodProfile.preferredCuisines];
    const idx = list.indexOf(cuisine);
    if (idx >= 0) {
      list.splice(idx, 1);
    } else {
      list.push(cuisine);
    }
    const updated = { ...foodProfile, preferredCuisines: list };
    setFoodProfile(updated);
    mobileStorage.saveFoodProfile(updated);
  };

  const handleAdjustBudget = (type, delta) => {
    let nextMin = foodProfile.budgetMin;
    let nextMax = foodProfile.budgetMax;

    if (type === 'min') {
      nextMin = Math.max(50, Math.min(foodProfile.budgetMax - 50, nextMin + delta));
    } else {
      nextMax = Math.max(foodProfile.budgetMin + 50, Math.min(6000, nextMax + delta));
    }

    const updated = { ...foodProfile, budgetMin: nextMin, budgetMax: nextMax };
    setFoodProfile(updated);
    mobileStorage.saveFoodProfile(updated);
  };

  const handleSetBudgetPreset = (min, max) => {
    const updated = { ...foodProfile, budgetMin: min, budgetMax: max };
    setFoodProfile(updated);
    mobileStorage.saveFoodProfile(updated);
  };

  const handleToggleDietary = (key) => {
    const updated = {
      ...foodProfile,
      dietary: {
        ...foodProfile.dietary,
        [key]: !foodProfile.dietary[key]
      }
    };
    setFoodProfile(updated);
    mobileStorage.saveFoodProfile(updated);
  };

  const handleToggleDisliked = (item) => {
    const list = [...(foodProfile.dislikedFoods || [])];
    const idx = list.indexOf(item);
    if (idx >= 0) {
      list.splice(idx, 1);
    } else {
      list.push(item);
    }
    const updated = { ...foodProfile, dislikedFoods: list };
    setFoodProfile(updated);
    mobileStorage.saveFoodProfile(updated);
  };

  const handleAddCustomDislike = () => {
    const trimmed = customDislikeText.trim();
    if (!trimmed) return;
    if (!(foodProfile.dislikedFoods || []).includes(trimmed)) {
      const updated = {
        ...foodProfile,
        dislikedFoods: [...(foodProfile.dislikedFoods || []), trimmed]
      };
      setFoodProfile(updated);
      mobileStorage.saveFoodProfile(updated);
    }
    setCustomDislikeText('');
  };

  const handleSaveFoodProfile = async () => {
    await mobileStorage.saveFoodProfile(foodProfile);
    setSaveSuccessMsg(true);
    setTimeout(() => setSaveSuccessMsg(false), 3000);
    Alert.alert('Profile Saved', 'Your personal food preferences have been saved and applied to recommendations.');
  };

  const handleResetFoodProfile = () => {
    Alert.alert(
      'Reset Preferences',
      'Are you sure you want to reset your personal food preferences? All preferred cuisines, budget targets, and dietary settings will be reset to default.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            const def = await mobileStorage.resetFoodProfile();
            setFoodProfile(def);
            Alert.alert('Reset Complete', 'Your food profile has been reset to defaults.');
          }
        }
      ]
    );
  };

  // --- Taste Learning Handlers ---

  const handleToggleLearning = async (val) => {
    setLearningEnabled(val);
    await mobileStorage.setLearningEnabled(val);
  };

  const handleResetTasteProfile = async () => {
    Alert.alert(
      t('taste.resetBtn'),
      t('taste.resetConfirm'),
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            const def = {
              Japanese: 50, Bangladeshi: 50, Indian: 50, Chinese: 50, Korean: 50,
              'Fast Food': 50, Cafe: 50, Kabab: 50, Biriyani: 50, Dessert: 50, Coffee: 50, Burger: 50
            };
            await mobileStorage.saveTasteProfile(def);
            setTasteProfile(def);
          }
        }
      ]
    );
  };

  const adjustScore = async (cuisine, delta) => {
    const cur = tasteProfile[cuisine] || 50;
    const next = Math.max(0, Math.min(100, cur + delta));
    const updated = { ...tasteProfile, [cuisine]: next };
    setTasteProfile(updated);
    await mobileStorage.saveTasteProfile(updated);
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Top Segmented Tab Switcher */}
      <View style={[styles.tabBar, { backgroundColor: theme.colors.surfaceAlt, borderColor: theme.colors.border }]}>
        <TouchableOpacity
          style={[
            styles.tabBtn,
            activeTab === 'profile' && { backgroundColor: theme.colors.primary }
          ]}
          onPress={() => setActiveTab('profile')}
          accessibilityRole="button"
          accessibilityLabel="Personal Food Profile"
        >
          <Text
            style={[
              styles.tabBtnText,
              { color: activeTab === 'profile' ? theme.colors.onPrimary : theme.colors.text }
            ]}
          >
            🍽️ Personal Profile
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabBtn,
            activeTab === 'weights' && { backgroundColor: theme.colors.primary }
          ]}
          onPress={() => setActiveTab('weights')}
          accessibilityRole="button"
          accessibilityLabel="AI Taste Weights"
        >
          <Text
            style={[
              styles.tabBtnText,
              { color: activeTab === 'weights' ? theme.colors.onPrimary : theme.colors.text }
            ]}
          >
            🧠 AI Taste Weights
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'profile' ? (
        <View style={styles.content}>
          <Text style={[styles.desc, { color: theme.colors.textMuted }]}>
            Set your personal food preferences to get honest, tailored recommendations in Dhaka. Saved securely on your device.
          </Text>

          {saveSuccessMsg && (
            <View style={[styles.successBanner, { backgroundColor: theme.colors.successTint, borderColor: theme.colors.success }]}>
              <Text style={{ color: theme.colors.success, fontWeight: '700', fontSize: 13 }}>
                ✓ Preferences updated successfully
              </Text>
            </View>
          )}

          {/* 1. Preferred Cuisines */}
          <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <View style={styles.cardHeader}>
              <Text style={[styles.cardTitle, { color: theme.colors.text }]}>🍛 Preferred Cuisines</Text>
              <Text style={[styles.cardCounter, { color: theme.colors.primary }]}>
                {foodProfile.preferredCuisines.length} selected
              </Text>
            </View>
            <Text style={[styles.subHint, { color: theme.colors.textMuted }]}>
              Recommendations will highlight matches for these cuisines.
            </Text>

            <View style={styles.chipsWrap}>
              {ALL_CUISINES.map((c) => {
                const active = foodProfile.preferredCuisines.includes(c);
                return (
                  <TouchableOpacity
                    key={c}
                    style={[
                      styles.chip,
                      { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceAlt },
                      active && { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }
                    ]}
                    onPress={() => handleToggleCuisine(c)}
                   accessibilityRole="checkbox" accessibilityLabel={`Cuisine ${c}`}>
                    <Text
                      style={[
                        styles.chipText,
                        { color: active ? theme.colors.onPrimary : theme.colors.text }
                      ]}
                    >
                      {active ? '✓ ' : ''}{c}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* 2. Budget Range */}
          <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <Text style={[styles.cardTitle, { color: theme.colors.text }]}>💰 Target Budget (BDT / Person)</Text>
            <Text style={[styles.subHint, { color: theme.colors.textMuted }]}>
              Current: ৳{foodProfile.budgetMin} – ৳{foodProfile.budgetMax} per person
            </Text>

            <View style={styles.budgetPresets}>
              <TouchableOpacity
                style={[
                  styles.presetBtn,
                  { backgroundColor: theme.colors.surfaceAlt, borderColor: theme.colors.border },
                  foodProfile.budgetMax <= 500 && { borderColor: theme.colors.primary, backgroundColor: theme.colors.primaryTint }
                ]}
                onPress={() => handleSetBudgetPreset(100, 500)}
               accessibilityRole="button" accessibilityLabel="Reset options">
                <Text style={[styles.presetText, { color: theme.colors.text }]}>Budget (≤ ৳500)</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.presetBtn,
                  { backgroundColor: theme.colors.surfaceAlt, borderColor: theme.colors.border },
                  foodProfile.budgetMin === 500 && foodProfile.budgetMax === 1200 && { borderColor: theme.colors.primary, backgroundColor: theme.colors.primaryTint }
                ]}
                onPress={() => handleSetBudgetPreset(500, 1200)}
               accessibilityRole="button" accessibilityLabel="Reset options">
                <Text style={[styles.presetText, { color: theme.colors.text }]}>Mid (৳500–1.2k)</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.presetBtn,
                  { backgroundColor: theme.colors.surfaceAlt, borderColor: theme.colors.border },
                  foodProfile.budgetMin >= 1200 && { borderColor: theme.colors.primary, backgroundColor: theme.colors.primaryTint }
                ]}
                onPress={() => handleSetBudgetPreset(1200, 3000)}
               accessibilityRole="button" accessibilityLabel="Reset options">
                <Text style={[styles.presetText, { color: theme.colors.text }]}>Premium (৳1.2k+)</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.budgetStepperRow}>
              <View style={styles.stepperCol}>
                <Text style={[styles.stepperLabel, { color: theme.colors.textMuted }]}>Min: ৳{foodProfile.budgetMin}</Text>
                <View style={styles.stepperBtns}>
                  <TouchableOpacity
                    style={[styles.miniBtn, { backgroundColor: theme.colors.surfaceAlt }]}
                    onPress={() => handleAdjustBudget('min', -50)}
                   accessibilityRole="button" accessibilityLabel="Interactive button">
                    <Text style={[styles.miniBtnText, { color: theme.colors.text }]}>-50</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.miniBtn, { backgroundColor: theme.colors.surfaceAlt }]}
                    onPress={() => handleAdjustBudget('min', 50)}
                   accessibilityRole="button" accessibilityLabel="Interactive button">
                    <Text style={[styles.miniBtnText, { color: theme.colors.text }]}>+50</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.stepperCol}>
                <Text style={[styles.stepperLabel, { color: theme.colors.textMuted }]}>Max: ৳{foodProfile.budgetMax}</Text>
                <View style={styles.stepperBtns}>
                  <TouchableOpacity
                    style={[styles.miniBtn, { backgroundColor: theme.colors.surfaceAlt }]}
                    onPress={() => handleAdjustBudget('max', -100)}
                   accessibilityRole="button" accessibilityLabel="Interactive button">
                    <Text style={[styles.miniBtnText, { color: theme.colors.text }]}>-100</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.miniBtn, { backgroundColor: theme.colors.surfaceAlt }]}
                    onPress={() => handleAdjustBudget('max', 100)}
                   accessibilityRole="button" accessibilityLabel="Interactive button">
                    <Text style={[styles.miniBtnText, { color: theme.colors.text }]}>+100</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>

          {/* 3. Dietary Requirements */}
          <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <Text style={[styles.cardTitle, { color: theme.colors.text }]}>🥗 Dietary Preferences</Text>
            <View style={[styles.disclaimerBox, { backgroundColor: theme.colors.warningTint, borderColor: theme.colors.warning }]}>
              <Text style={[styles.disclaimerText, { color: theme.colors.warning }]}>
                ⚠️ Notice: Dietary attributes in Dhaka are based on restaurant menus & crowd reports. Inquire directly with kitchen if severe.
              </Text>
            </View>

            {[
              { key: 'halal', label: 'Halal Certified / Halal Meat' },
              { key: 'vegetarian', label: 'Vegetarian Options Only' },
              { key: 'vegan', label: 'Vegan Options Only' },
              { key: 'no_beef', label: 'No Beef (Strict)' }
            ].map((diet) => {
              const active = Boolean(foodProfile.dietary?.[diet.key]);
              return (
                <View key={diet.key} style={styles.dietRow}>
                  <Text style={[styles.dietLabel, { color: theme.colors.text }]}>{diet.label}</Text>
                  <Switch
                    value={active}
                    onValueChange={() => handleToggleDietary(diet.key)}
                    trackColor={{ false: theme.colors.skeleton, true: theme.colors.primary }}
                  />
                </View>
              );
            })}
          </View>

          {/* 4. Disliked Foods / Ingredients */}
          <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <Text style={[styles.cardTitle, { color: theme.colors.text }]}>🚫 Disliked Foods & Ingredients</Text>
            <Text style={[styles.subHint, { color: theme.colors.textMuted }]}>
              Places featuring these items will be ranked lower or marked accordingly.
            </Text>

            {/* Quick Suggestions */}
            <View style={styles.chipsWrap}>
              {COMMON_DISLIKED.map((d) => {
                const active = (foodProfile.dislikedFoods || []).includes(d);
                return (
                  <TouchableOpacity
                    key={d}
                    style={[
                      styles.chip,
                      { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceAlt },
                      active && { backgroundColor: theme.colors.danger, borderColor: theme.colors.danger }
                    ]}
                    onPress={() => handleToggleDisliked(d)}
                   accessibilityRole="checkbox" accessibilityLabel="Interactive button">
                    <Text
                      style={[
                        styles.chipText,
                        { color: active ? theme.colors.onPrimary : theme.colors.text }
                      ]}
                    >
                      {active ? '✕ ' : ''}{d}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Custom Input */}
            <View style={styles.customInputRow}>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.colors.surfaceAlt,
                    borderColor: theme.colors.border,
                    color: theme.colors.text
                  }
                ]}
                placeholder="Add custom ingredient (e.g. Squid)..."
                placeholderTextColor={theme.colors.textMuted}
                value={customDislikeText}
                onChangeText={setCustomDislikeText}
              />
              <TouchableOpacity
                style={[styles.addBtn, { backgroundColor: theme.colors.primary }]}
                onPress={handleAddCustomDislike}
               accessibilityRole="button" accessibilityLabel="Interactive button">
                <Text style={{ color: theme.colors.onPrimary, fontWeight: '800' }}>+ Add</Text>
              </TouchableOpacity>
            </View>

            {/* Active Custom Dislikes */}
            {(foodProfile.dislikedFoods || []).filter(d => !COMMON_DISLIKED.includes(d)).length > 0 && (
              <View style={[styles.chipsWrap, { marginTop: 8 }]}>
                {(foodProfile.dislikedFoods || [])
                  .filter(d => !COMMON_DISLIKED.includes(d))
                  .map((d) => (
                    <TouchableOpacity
                      key={d}
                      style={[styles.chip, { backgroundColor: theme.colors.danger, borderColor: theme.colors.danger }]}
                      onPress={() => handleToggleDisliked(d)}
                     accessibilityRole="checkbox" accessibilityLabel="Interactive button">
                      <Text style={[styles.chipText, { color: theme.colors.onPrimary }]}>✕ {d}</Text>
                    </TouchableOpacity>
                  ))}
              </View>
            )}
          </View>

          {/* Action Buttons */}
          <TouchableOpacity
            style={[styles.primaryActionBtn, { backgroundColor: theme.colors.primary }]}
            onPress={handleSaveFoodProfile}
            accessibilityRole="button"
            accessibilityLabel="Save Food Profile"
          >
            <Text style={[styles.primaryActionText, { color: theme.colors.onPrimary }]}>
              💾 Save Food Profile
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.resetActionBtn, { borderColor: theme.colors.danger }]}
            onPress={handleResetFoodProfile}
            accessibilityRole="button"
            accessibilityLabel="Reset Preferences"
          >
            <Text style={{ color: theme.colors.danger, fontWeight: '800', fontSize: 14 }}>
              🔄 Reset Preferences to Default
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        /* Weights Tab: AI Learning & Bandit Factors */
        <View style={styles.content}>
          <Text style={[styles.desc, { color: theme.colors.textMuted }]}>
            {t('taste.desc')}
          </Text>

          <View style={[styles.learningCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <Text style={[styles.learningText, { color: theme.colors.text }]}>
              {t('taste.learningToggle')}
            </Text>
            <Switch
              value={learningEnabled}
              onValueChange={handleToggleLearning}
              trackColor={{ false: theme.colors.skeleton, true: theme.colors.primary }}
            />
          </View>

          {/* Bandit Personal Factor Weights Card */}
          {banditProfile && (
            <View style={[styles.banditCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
              <View style={styles.banditHeader}>
                <Text style={[styles.banditTitle, { color: theme.colors.text }]}>
                  🎯 Personal Decision Weights
                </Text>
                <Switch
                  value={banditProfile.enabled}
                  onValueChange={async (val) => {
                    const updated = await apiClient.toggleBandit(val);
                    setBanditProfile(updated.profile);
                  }}
                  trackColor={{ false: theme.colors.skeleton, true: theme.colors.primary }}
                />
              </View>

              <Text style={[styles.banditNote, { color: theme.colors.primary }]}>
                {banditProfile.explanationNote || "Learning your personal balance between speed, rating, cost, and distance."}
              </Text>

              <View style={styles.weightsGrid}>
                {banditProfile.weights && Object.entries(banditProfile.weights).map(([k, w]) => (
                  <View key={k} style={styles.weightBadge}>
                    <Text style={[styles.weightKey, { color: theme.colors.textMuted }]}>{k}</Text>
                    <Text style={[styles.weightVal, { color: theme.colors.text }]}>{Math.round(w * 100)}%</Text>
                  </View>
                ))}
              </View>

              <TouchableOpacity
                style={styles.banditResetBtn}
                onPress={async () => {
                accessibilityRole="button"
                accessibilityLabel="Reset learned recommendation weights to balanced default"

                  const res = await apiClient.resetBanditWeights();
                  setBanditProfile(res.profile);
                }}
              >
                <Text style={{ color: theme.colors.textMuted, fontSize: 12, fontWeight: '700' }}>
                  🔄 Reset Personal Weights
                </Text>
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity style={styles.resetBtn} onPress={handleResetTasteProfile} accessibilityRole="button" accessibilityLabel="Reset taste profile to default">
            <Text style={{ color: theme.colors.danger, fontWeight: '700' }}>
              🔄 {t('taste.resetBtn')}
            </Text>
          </TouchableOpacity>

          <View style={styles.list}>
            {Object.entries(tasteProfile).map(([cuisine, score]) => (
              <View key={cuisine} style={[styles.itemCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                <View style={styles.itemHeader}>
                  <Text style={[styles.cuisineName, { color: theme.colors.text }]}>{cuisine}</Text>
                  <Text style={[styles.scoreVal, { color: theme.colors.primary }]}>{score}%</Text>
                </View>

                <View style={[styles.barTrack, { backgroundColor: theme.colors.primaryTint }]}>
                  <View style={[styles.barFill, { width: `${score}%`, backgroundColor: theme.colors.primary }]} />
                </View>

                <View style={styles.controls}>
                  <TouchableOpacity style={[styles.stepBtn, { backgroundColor: theme.colors.surfaceAlt }]} onPress={() => adjustScore(cuisine, -10)} accessibilityRole="button" accessibilityLabel="Adjust value">
                    <Text style={[styles.stepBtnText, { color: theme.colors.text }]}>-10%</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.stepBtn, { backgroundColor: theme.colors.surfaceAlt }]} onPress={() => adjustScore(cuisine, 10)} accessibilityRole="button" accessibilityLabel="Adjust value">
                    <Text style={[styles.stepBtnText, { color: theme.colors.text }]}>+10%</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        </View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  tabBar: {
    flexDirection: 'row',
    margin: 16,
    borderRadius: 14,
    borderWidth: 1,
    padding: 4
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center'
  },
  tabBtnText: {
    fontSize: 13,
    fontWeight: '800'
  },
  content: { paddingHorizontal: 16 },
  desc: { fontSize: 13, lineHeight: 18, marginBottom: 16 },
  successBanner: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16
  },
  card: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800'
  },
  cardCounter: {
    fontSize: 12,
    fontWeight: '700'
  },
  subHint: {
    fontSize: 12,
    marginBottom: 12,
    lineHeight: 16
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
    borderWidth: 1
  },
  chipText: {
    fontSize: 12,
    fontWeight: '700'
  },
  budgetPresets: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12
  },
  presetBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center'
  },
  presetText: {
    fontSize: 11,
    fontWeight: '700'
  },
  budgetStepperRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16
  },
  stepperCol: {
    flex: 1
  },
  stepperLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6
  },
  stepperBtns: {
    flexDirection: 'row',
    gap: 8
  },
  miniBtn: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: 'center'
  },
  miniBtnText: {
    fontSize: 12,
    fontWeight: '700'
  },
  disclaimerBox: {
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 12
  },
  disclaimerText: {
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 15
  },
  dietRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)'
  },
  dietLabel: {
    fontSize: 13,
    fontWeight: '600'
  },
  customInputRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12
  },
  input: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 13
  },
  addBtn: {
    paddingHorizontal: 16,
    justifyContent: 'center',
    borderRadius: 10
  },
  primaryActionBtn: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 12
  },
  primaryActionText: {
    fontSize: 15,
    fontWeight: '800'
  },
  resetActionBtn: {
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: 20
  },
  learningCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 12
  },
  learningText: { fontSize: 14, fontWeight: '700' },
  resetBtn: { alignSelf: 'flex-end', marginBottom: 16 },
  list: { gap: 12 },
  itemCard: { padding: 14, borderRadius: 14, borderWidth: 1 },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  cuisineName: { fontSize: 15, fontWeight: '700' },
  scoreVal: { fontSize: 14, fontWeight: '800' },
  barTrack: { height: 8, borderRadius: 9999, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 9999 },
  controls: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 8 },
  stepBtn: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8
  },
  stepBtnText: { fontWeight: '700', fontSize: 12 },
  banditCard: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16
  },
  banditHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  banditTitle: { fontSize: 15, fontWeight: '800' },
  banditNote: { fontSize: 13, lineHeight: 18, marginBottom: 12, fontWeight: '600' },
  weightsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  weightBadge: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: 'center'
  },
  weightKey: { fontSize: 11, textTransform: 'uppercase', fontWeight: '700' },
  weightVal: { fontSize: 13, fontWeight: '800', marginTop: 2 },
  banditResetBtn: { alignSelf: 'flex-start', paddingVertical: 4 }
});
