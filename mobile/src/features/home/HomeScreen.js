import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert
} from 'react-native';
import { apiClient } from '../../api/client.js';
import { mobileStorage } from '../../services/storage.js';
import { getCurrentOrFallbackLocation, PRESET_LOCATIONS } from '../../services/location.js';
import { getLocalRecommendations } from '../../services/localEngine.js';
import { t } from '../../i18n/index.js';
import MealTimeView from './MealTimeView.js';

const MOODS = [
  'Something spicy', 'Something light', 'Comfort food', 'Fast food',
  'Healthy food', 'Something new', 'Sweet', 'Coffee', 'Fine dining', 'Budget friendly'
];

const CUISINES = [
  'All', 'Japanese', 'Bangladeshi', 'Indian', 'Chinese', 'Korean',
  'Fast Food', 'Cafe', 'Kabab', 'Biriyani', 'Dessert', 'Coffee', 'Burger'
];

const PRIORITIES = [
  'Best Overall', 'Fastest', 'Closest', 'Cheapest', 'Best Rated', 'Best Value', 'Personalized'
];

const TIME_BUDGETS = [
  { label: 'Any', value: null },
  { label: '30 min', value: 30 },
  { label: '45 min', value: 45 },
  { label: '60 min', value: 60 }
];

const COMPANIONS = [
  { label: 'Anyone', value: null },
  { label: 'Alone', value: 'alone' },
  { label: 'Friends', value: 'friends' },
  { label: 'Family', value: 'family' },
  { label: 'Date', value: 'date' }
];

export default function HomeScreen({ navigation, theme }) {
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [location, setLocation] = useState(PRESET_LOCATIONS['Notun Bazar']);
  const [selectedMood, setSelectedMood] = useState(null);
  const [selectedCuisine, setSelectedCuisine] = useState('All');
  const [selectedPriority, setSelectedPriority] = useState('Best Overall');
  const [selectedBudget, setSelectedBudget] = useState(2);
  const [selectedTimeBudget, setSelectedTimeBudget] = useState(null);
  const [selectedCompanion, setSelectedCompanion] = useState(null);
  const [selectedPreferences, setSelectedPreferences] = useState({ halal: false, vegetarian: false, no_beef: false });
  const [topPicks, setTopPicks] = useState(null);
  const [results, setResults] = useState([]);
  const [weather, setWeather] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [isCachedData, setIsCachedData] = useState(false);
  const [serverWakingMsg, setServerWakingMsg] = useState(null);
  const [activeAppMode, setActiveAppMode] = useState('standard'); // 'standard' | 'mealtime'

  useEffect(() => {
    initHome();
  }, []);

  const initHome = async () => {
    const loc = await getCurrentOrFallbackLocation();
    setLocation(loc);
    const prefs = await mobileStorage.getPreferences();
    if (prefs.cuisine) setSelectedCuisine(prefs.cuisine);
    if (prefs.priority) setSelectedPriority(prefs.priority);
    if (prefs.budget) setSelectedBudget(prefs.budget);

    // Warm-up ping to wake sleeping Render instance if needed
    apiClient.pingWarmUp((statusObj) => {
      if (statusObj.status === 'waking') {
        setServerWakingMsg(statusObj.message);
      } else {
        setServerWakingMsg(null);
      }
    });

    // Weather
    try {
      const w = await apiClient.getWeather(loc.lat, loc.lng);
      setWeather(w);
    } catch (e) {}

    loadRecommendations(loc, prefs.cuisine || 'All', prefs.priority || 'Best Overall', prefs.budget || 2);
  };

  const loadRecommendations = async (
    loc = location,
    cuisine = selectedCuisine,
    priority = selectedPriority,
    budget = selectedBudget,
    mood = selectedMood,
    surpriseMe = false,
    timeBudget = selectedTimeBudget,
    companion = selectedCompanion,
    prefs = selectedPreferences
  ) => {
    setLoading(true);
    setIsCachedData(false);

    let attempt = 0;
    const maxRetries = 6;
    let delayMs = 2000;

    while (attempt <= maxRetries) {
      try {
        const tasteProfile = await mobileStorage.getTasteProfile();
        const foodProfile = await mobileStorage.getFoodProfile();
        const activePrefs = Object.fromEntries(
          Object.entries(prefs || {}).filter(([_, v]) => Boolean(v))
        );

        const data = await apiClient.getRecommendations({
          lat: loc.lat,
          lng: loc.lng,
          cuisine,
          priority,
          budget,
          mood,
          tasteProfile,
          weatherContext: weather,
          surpriseMe,
          timeBudgetMinutes: timeBudget,
          companion,
          preferences: Object.keys(activePrefs).length > 0 ? activePrefs : null,
          foodProfile
        });

        setServerWakingMsg(null);
        setResults(data.results || []);
        setTopPicks(data.topPicks || null);
        setLastUpdated(Date.now());

        // Cache for offline/poor network (30 min cache)
        await mobileStorage.setCachedResults(data);

        // Save search history
        await mobileStorage.addSearchHistory({
          locationName: loc.name,
          cuisine,
          priority,
          budget
        });
        break;
      } catch (err) {
        attempt++;
        const isNetworkOrSleepError = err.message?.includes('Network') ||
          err.message?.includes('Failed to fetch') ||
          err.message?.includes('502') ||
          err.message?.includes('503') ||
          err.message?.includes('504') ||
          err.message?.includes('timeout');

        if (attempt <= maxRetries && isNetworkOrSleepError) {
          setServerWakingMsg(`Waking up the server... Please hold on (${attempt * 5}s)`);
          await new Promise(r => setTimeout(r, delayMs));
          delayMs = Math.min(delayMs * 1.5, 8000);
          continue;
        }

        console.warn('Network recommendation request failed. Checking offline cache...', err);
        setServerWakingMsg(null);
        const cached = await mobileStorage.getCachedResults();
        if (cached && (Date.now() - cached.cachedAt < 30 * 60 * 1000)) {
          setResults(cached.results || []);
          setTopPicks(cached.topPicks || null);
          setLastUpdated(cached.cachedAt);
          setIsCachedData(true);
        } else {
          try {
            const foodProfile = await mobileStorage.getFoodProfile();
            const fallback = getLocalRecommendations({
              lat: loc.lat,
              lng: loc.lng,
              cuisine,
              priority,
              budget,
              mood,
              surpriseMe,
              timeBudgetMinutes: timeBudget,
              companion,
              preferences: Object.keys(activePrefs || {}).length > 0 ? activePrefs : null,
              foodProfile
            });
            setResults(fallback.results || []);
            setTopPicks(fallback.topPicks || null);
            setLastUpdated(Date.now());
            setIsCachedData(true);
          } catch (localErr) {
            console.error('Local engine recommendation fallback failed:', localErr);
            Alert.alert(t('common.error'), 'Could not load restaurant recommendations');
          }
        }
        break;
      }
    }

    setLoading(false);
    setRefreshing(false);
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadRecommendations();
  }, [location, selectedCuisine, selectedPriority, selectedBudget, selectedMood]);

  const handleEatNow = () => {
    if (results.length > 0) {
      const best = results[0];
      Alert.alert(
        `⚡ Eat Now: ${best.displayName}`,
        `${best.reason}\n\nTravel time: ${Math.round(best.durationSeconds / 60)} min (${(best.distanceMeters / 1000).toFixed(1)} km) • ~৳${best.transport.cheapestEstimatedCostBdt}`,
        [
          { text: 'View Details', onPress: () => navigation.navigate('RestaurantDetail', { restaurant: best }) },
          { text: 'OK', style: 'cancel' }
        ]
      );
    } else {
      loadRecommendations();
    }
  };

  const getUpdatedMinutesAgo = () => {
    if (!lastUpdated) return 0;
    return Math.max(0, Math.round((Date.now() - lastUpdated) / 60000));
  };

  const handlePickLocation = () => {
    Alert.alert(
      'Choose Location',
      'Select a Dhaka location or use live GPS:',
      [
        {
          text: '📡 Current GPS Location',
          onPress: async () => {
            const loc = await getCurrentOrFallbackLocation();
            setLocation(loc);
            loadRecommendations(loc);
          }
        },
        ...Object.keys(PRESET_LOCATIONS).map((name) => ({
          text: `📍 ${name}`,
          onPress: () => {
            const loc = PRESET_LOCATIONS[name];
            setLocation(loc);
            loadRecommendations(loc);
          }
        })),
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Mode Switcher: Standard Recommender vs Meal-Time Mode */}
      <View style={[styles.modeToggleBar, { backgroundColor: theme.colors.surfaceAlt, borderColor: theme.colors.border }]}>
        <TouchableOpacity
          style={[
            styles.modeToggleBtn,
            activeAppMode === 'standard' && { backgroundColor: theme.colors.primary }
          ]}
          onPress={() => setActiveAppMode('standard')}
          accessibilityRole="button"
          accessibilityLabel={t('home.standardMode')}
        >
          <Text
            style={[
              styles.modeToggleText,
              { color: activeAppMode === 'standard' ? theme.colors.onPrimary : theme.colors.text }
            ]}
          >
            {t('home.standardMode')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.modeToggleBtn,
            activeAppMode === 'mealtime' && { backgroundColor: theme.colors.primary }
          ]}
          onPress={() => setActiveAppMode('mealtime')}
          accessibilityRole="button"
          accessibilityLabel={t('mealTime.title')}
        >
          <Text
            style={[
              styles.modeToggleText,
              { color: activeAppMode === 'mealtime' ? theme.colors.onPrimary : theme.colors.text }
            ]}
          >
            ⏱️ {t('mealTime.title')}
          </Text>
        </TouchableOpacity>
      </View>

      {activeAppMode === 'mealtime' ? (
        <MealTimeView theme={theme} location={location} navigation={navigation} />
      ) : (
        <>
          {/* Weather Banner */}
      {weather?.isRaining && (
        <View style={[styles.rainBanner, { backgroundColor: theme.colors.primaryTint }]}>
          <Text style={[styles.rainText, { color: theme.colors.primary }]}>{t('home.rainBanner')}</Text>
        </View>
      )}

      {/* Offline Cache Banner */}
      {isCachedData && (
        <View style={[styles.offlineBanner, { backgroundColor: theme.colors.warningTint }]}>
          <Text style={[styles.offlineText, { color: theme.colors.warning }]}>
            {t('home.offlineBanner', { mins: getUpdatedMinutesAgo() })}
          </Text>
        </View>
      )}

      {/* Server Cold-Start Warm-up Banner */}
      {serverWakingMsg && (
        <View style={[styles.wakeUpBanner, { backgroundColor: theme.colors.primary }]}>
          <ActivityIndicator size="small" color={theme.colors.onPrimary} style={{ marginRight: 8 }} />
          <Text style={[styles.wakeUpText, { color: theme.colors.onPrimary }]}>{serverWakingMsg}</Text>
        </View>
      )}

      {/* Location Selector Bar */}
      <View style={[styles.locationCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
        <TouchableOpacity
          style={styles.locationInfo}
          onPress={handlePickLocation}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Change location"
        >
          <Text style={[styles.locPrompt, { color: theme.colors.textMuted }]}>{t('home.locationPrompt')}</Text>
          <Text style={[styles.locName, { color: theme.colors.text }]}>📍 {location.name} ▾</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.gpsBtn, { backgroundColor: theme.colors.surface }]}
          onPress={async () => {
            const loc = await getCurrentOrFallbackLocation();
            setLocation(loc);
            loadRecommendations(loc);
          }}
          accessibilityRole="button"
          accessibilityLabel={t('home.useGps')}
        >
          <Text style={[styles.gpsBtnText, { color: theme.colors.primary }]}>📡 GPS</Text>
        </TouchableOpacity>
      </View>

      {/* Big "Eat Now" Button */}
      <TouchableOpacity
        style={[styles.eatNowBtn, { backgroundColor: theme.colors.primary }]}
        onPress={handleEatNow}
        accessibilityRole="button"
        accessibilityLabel={t('home.eatNow')}
      >
        <Text style={[styles.eatNowText, { color: theme.colors.onPrimary }]}>{t('home.eatNow')}</Text>
      </TouchableOpacity>

      {/* "For You Right Now" Top Picks Section */}
      {topPicks && (
        <View style={[styles.sectionCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>✨ {t('home.forYouRightNow')}</Text>
            {lastUpdated && (
              <Text style={[styles.updatedText, { color: theme.colors.textSubtle }]}>
                {t('home.updatedAgo', { mins: getUpdatedMinutesAgo() })}
              </Text>
            )}
          </View>
          <Text style={[styles.whySummary, { color: theme.colors.primary }]}>{topPicks.summary}</Text>

          {/* Counterfactual Trade-off Explanation */}
          {topPicks.counterfactual && (
            <View style={[styles.counterfactualBox, { backgroundColor: theme.colors.warningTint, borderColor: theme.colors.warning }]}>
              <Text style={[styles.counterfactualText, { color: theme.colors.warning }]}>
                💡 {topPicks.counterfactual}
              </Text>
            </View>
          )}

          {/* Bandit Personal Preference Note */}
          {topPicks.banditNote && (
            <View style={[styles.banditBox, { backgroundColor: theme.colors.primaryTint, borderColor: theme.colors.primary }]}>
              <Text style={[styles.banditText, { color: theme.colors.primary }]}>
                🎯 {topPicks.banditNote}
              </Text>
            </View>
          )}

          {/* Badge Usage Rules:
              Best overall = saffron fill with onAccent text
              Fastest to reach = primaryTint with primary text
              Try something new = outlined, accentStrong text
              Community-verified = success tint */}
          {topPicks.bestMatch && (
            <TouchableOpacity
              style={styles.pickItem}
              onPress={() => navigation.navigate('RestaurantDetail', { restaurant: topPicks.bestMatch })}
             accessibilityRole="button" accessibilityLabel="Interactive button">
              <View style={styles.pickBadgeRow}>
                <View style={[styles.badgePill, { backgroundColor: theme.colors.badgeBest }]}>
                  <Text style={{ color: theme.colors.badgeBestText, fontWeight: '800', fontSize: 12 }}>
                    🌟 {t('picks.bestMatch')}
                  </Text>
                </View>
                {topPicks.bestMatch.departurePredictions?.bestSuggestion && (
                  <View style={[styles.predictionPill, { backgroundColor: theme.colors.badgeVerified }]}>
                    <Text style={{ color: theme.colors.badgeVerifiedText, fontWeight: '800', fontSize: 11 }}>
                      ⏱️ {topPicks.bestMatch.departurePredictions.bestSuggestion.message}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={[styles.pickName, { color: theme.colors.text }]}>{topPicks.bestMatch.displayName}</Text>
              <Text style={[styles.pickReason, { color: theme.colors.textMuted }]}>{topPicks.bestMatch.reason}</Text>
            </TouchableOpacity>
          )}

          {topPicks.fastestOrNearest && (
            <TouchableOpacity
              style={styles.pickItem}
              onPress={() => navigation.navigate('RestaurantDetail', { restaurant: topPicks.fastestOrNearest })}
             accessibilityRole="button" accessibilityLabel="Interactive button">
              <View style={[styles.badgePill, { backgroundColor: theme.colors.badgeFast }]}>
                <Text style={{ color: theme.colors.badgeFastText, fontWeight: '800', fontSize: 12 }}>
                  ⚡ {t('picks.fastestOption')}
                </Text>
              </View>
              <Text style={[styles.pickName, { color: theme.colors.text }]}>{topPicks.fastestOrNearest.displayName}</Text>
              <Text style={[styles.pickReason, { color: theme.colors.textMuted }]}>{topPicks.fastestOrNearest.reason}</Text>
            </TouchableOpacity>
          )}

          {topPicks.trySomethingNew && (
            <TouchableOpacity
              style={styles.pickItem}
              onPress={() => navigation.navigate('RestaurantDetail', { restaurant: topPicks.trySomethingNew })}
             accessibilityRole="button" accessibilityLabel="Interactive button">
              <View style={[styles.badgePill, { backgroundColor: 'transparent', borderWidth: 1, borderColor: theme.colors.badgeNewBorder }]}>
                <Text style={{ color: theme.colors.badgeNewText, fontWeight: '800', fontSize: 12 }}>
                  🎲 {t('picks.trySomethingNew')}
                </Text>
              </View>
              <Text style={[styles.pickName, { color: theme.colors.text }]}>{topPicks.trySomethingNew.displayName}</Text>
              <Text style={[styles.pickReason, { color: theme.colors.textMuted }]}>{topPicks.trySomethingNew.reason}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Time-Budget Selector ("I have 45 minutes") */}
      <View style={styles.chipSection}>
        <Text style={[styles.filterTitle, { color: theme.colors.textMuted }]}>⏱️ Time Budget (Round-trip + Dine)</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scrollRow}>
          {TIME_BUDGETS.map(tb => {
            const active = selectedTimeBudget === tb.value;
            return (
              <TouchableOpacity
                key={tb.label}
                style={[
                  styles.chip,
                  { borderColor: theme.colors.border },
                  active && { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }
                ]}
                onPress={() => {
                  setSelectedTimeBudget(tb.value);
                  loadRecommendations(location, selectedCuisine, selectedPriority, selectedBudget, selectedMood, false, tb.value);
                }}
               accessibilityRole="button" accessibilityLabel={`Time budget ${tb.label}`}>
                <Text style={[styles.chipText, { color: active ? theme.colors.onPrimary : theme.colors.textMuted }]}>{tb.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Companion / "Who with?" Selector */}
      <View style={styles.chipSection}>
        <Text style={[styles.filterTitle, { color: theme.colors.textMuted }]}>👥 Who With?</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scrollRow}>
          {COMPANIONS.map(comp => {
            const active = selectedCompanion === comp.value;
            return (
              <TouchableOpacity
                key={comp.label}
                style={[
                  styles.chip,
                  { borderColor: theme.colors.border },
                  active && { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }
                ]}
                onPress={() => {
                  setSelectedCompanion(comp.value);
                  loadRecommendations(location, selectedCuisine, selectedPriority, selectedBudget, selectedMood, false, selectedTimeBudget, comp.value);
                }}
               accessibilityRole="button" accessibilityLabel={`Dining with ${comp.label}`}>
                <Text style={[styles.chipText, { color: active ? theme.colors.onPrimary : theme.colors.textMuted }]}>{comp.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Dietary Preferences Chips (Marked unverified) */}
      <View style={styles.chipSection}>
        <Text style={[styles.filterTitle, { color: theme.colors.textMuted }]}>🥗 Preferences (Unverified)</Text>
        <View style={styles.scrollRow}>
          {[
            { key: 'halal', label: 'Halal' },
            { key: 'vegetarian', label: 'Vegetarian' },
            { key: 'no_beef', label: 'No Beef' }
          ].map(pref => {
            const active = Boolean(selectedPreferences[pref.key]);
            return (
              <TouchableOpacity
                key={pref.key}
                style={[
                  styles.chip,
                  { borderColor: theme.colors.border },
                  active && { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }
                ]}
                onPress={() => {
                  const updated = { ...selectedPreferences, [pref.key]: !active };
                  setSelectedPreferences(updated);
                  loadRecommendations(location, selectedCuisine, selectedPriority, selectedBudget, selectedMood, false, selectedTimeBudget, selectedCompanion, updated);
                }}
               accessibilityRole="button" accessibilityLabel={`Dietary preference ${pref.label}`}>
                <Text style={[styles.chipText, { color: active ? theme.colors.onPrimary : theme.colors.textMuted }]}>
                  {pref.label} {active ? '✓' : ''}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Mood Selector Chips */}
      <View style={styles.chipSection}>
        <Text style={[styles.filterTitle, { color: theme.colors.textMuted }]}>{t('home.moodPrompt')}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scrollRow}>
          {MOODS.map(m => {
            const active = selectedMood === m;
            return (
              <TouchableOpacity
                key={m}
                style={[
                  styles.chip,
                  { borderColor: theme.colors.border },
                  active && { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }
                ]}
                onPress={() => {
                  const nextMood = active ? null : m;
                  setSelectedMood(nextMood);
                  loadRecommendations(location, selectedCuisine, selectedPriority, selectedBudget, nextMood);
                }}
               accessibilityRole="button" accessibilityLabel={`Mood ${m}`}>
                <Text style={[styles.chipText, { color: active ? theme.colors.onPrimary : theme.colors.textMuted }]}>{m}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Cuisine Selector Chips */}
      <View style={styles.chipSection}>
        <Text style={[styles.filterTitle, { color: theme.colors.textMuted }]}>{t('home.cuisinePrompt')}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scrollRow}>
          {CUISINES.map(c => {
            const active = selectedCuisine === c;
            return (
              <TouchableOpacity
                key={c}
                style={[
                  styles.chip,
                  { borderColor: theme.colors.border },
                  active && { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }
                ]}
                onPress={() => {
                  setSelectedCuisine(c);
                  setSelectedMood(null);
                  loadRecommendations(location, c, selectedPriority, selectedBudget, null);
                }}
               accessibilityRole="button" accessibilityLabel={`Cuisine ${c}`}>
                <Text style={[styles.chipText, { color: active ? theme.colors.onPrimary : theme.colors.textMuted }]}>{c}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Priority Selector Chips */}
      <View style={styles.chipSection}>
        <Text style={[styles.filterTitle, { color: theme.colors.textMuted }]}>{t('home.priorityPrompt')}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scrollRow}>
          {PRIORITIES.map(p => {
            const active = selectedPriority === p;
            return (
              <TouchableOpacity
                key={p}
                style={[
                  styles.chip,
                  { borderColor: theme.colors.border },
                  active && { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }
                ]}
                onPress={() => {
                  setSelectedPriority(p);
                  loadRecommendations(location, selectedCuisine, p, selectedBudget, selectedMood);
                }}
               accessibilityRole="button" accessibilityLabel={`Priority ${p}`}>
                <Text style={[styles.chipText, { color: active ? theme.colors.onPrimary : theme.colors.textMuted }]}>{p}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Budget Selector */}
      <View style={styles.budgetRow}>
        <Text style={[styles.filterTitle, { color: theme.colors.textMuted }]}>{t('home.budgetPrompt')}</Text>
        <View style={styles.budgetChips}>
          {[1, 2, 3, 4].map(b => (
            <TouchableOpacity
              key={b}
              style={[
                styles.budgetBtn,
                selectedBudget === b && { backgroundColor: theme.colors.primary }
              ]}
              onPress={() => {
                setSelectedBudget(b);
                loadRecommendations(location, selectedCuisine, selectedPriority, b, selectedMood);
              }}
             accessibilityRole="button" accessibilityLabel={`Budget tier ${b}`}>
              <Text style={[styles.budgetText, { color: selectedBudget === b ? theme.colors.onPrimary : theme.colors.textMuted }]}>
                {'৳'.repeat(b)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Strict Allergen & Unverified Disclaimer Banner */}
      <View style={[styles.disclaimerBanner, { borderColor: theme.colors.danger, backgroundColor: theme.colors.dangerTint }]}>
        <Text style={[styles.disclaimerText, { color: theme.colors.danger }]}>
          ⚠️ Allergy Notice: Halal & allergen tags are crowd-sourced & unverified by lab. Inquire with restaurant kitchen directly.
        </Text>
      </View>

      {/* View Full Ranked Results Button */}
      <TouchableOpacity
        style={[styles.mainCtaBtn, { backgroundColor: theme.colors.primary }]}
        onPress={() => navigation.navigate('Results', { results, location })}
        accessibilityRole="button"
        accessibilityLabel={t('home.viewRankedList')}
      >
        {loading ? (
          <ActivityIndicator color={theme.colors.onPrimary} />
        ) : (
          <Text style={[styles.mainCtaText, { color: theme.colors.onPrimary }]}>
            {t('home.viewRankedList')} ({results.length})
          </Text>
        )}
      </TouchableOpacity>
        </>
      )}
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  modeToggleBar: {
    flexDirection: 'row',
    borderRadius: 14,
    borderWidth: 1,
    padding: 4,
    marginBottom: 16
  },
  modeToggleBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center'
  },
  modeToggleText: {
    fontSize: 13,
    fontWeight: '800'
  },
  wakeUpBanner: {
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center'
  },
  wakeUpText: { fontSize: 13, fontWeight: '700', flex: 1 },
  rainBanner: { padding: 12, borderRadius: 12, marginBottom: 12 },
  rainText: { fontSize: 13, fontWeight: '700' },
  offlineBanner: { padding: 10, borderRadius: 12, marginBottom: 12 },
  offlineText: { fontSize: 12, fontWeight: '600' },
  locationCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16
  },
  locationInfo: { flex: 1 },
  locPrompt: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  locName: { fontSize: 16, fontWeight: '800', marginTop: 2 },
  gpsBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  gpsBtnText: { fontWeight: '800', fontSize: 13 },
  eatNowBtn: { paddingVertical: 16, borderRadius: 16, alignItems: 'center', marginBottom: 16 },
  eatNowText: { fontSize: 17, fontWeight: '800' },
  sectionCard: { padding: 16, borderRadius: 16, borderWidth: 1, marginBottom: 20 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: 18, fontWeight: '800' },
  updatedText: { fontSize: 12 },
  whySummary: { fontSize: 13, fontWeight: '600', marginVertical: 8, lineHeight: 18 },
  pickItem: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  badgePill: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, marginBottom: 4 },
  pickName: { fontSize: 15, fontWeight: '700' },
  pickReason: { fontSize: 13, marginTop: 2 },
  chipSection: { marginBottom: 16 },
  filterTitle: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', marginBottom: 8 },
  scrollRow: { flexDirection: 'row' },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
    marginRight: 8,
    minHeight: 40,
    justifyContent: 'center'
  },
  chipText: { fontWeight: '700', fontSize: 13 },
  budgetRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  budgetChips: { flexDirection: 'row', gap: 6 },
  budgetBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)'
  },
  budgetText: { fontWeight: '800', fontSize: 14 },
  mainCtaBtn: { paddingVertical: 16, borderRadius: 16, alignItems: 'center' },
  mainCtaText: { fontSize: 16, fontWeight: '800' },
  counterfactualBox: {
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginVertical: 6
  },
  counterfactualText: { fontSize: 12, fontWeight: '700', lineHeight: 16 },
  banditBox: {
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8
  },
  banditText: { fontSize: 12, fontWeight: '700', lineHeight: 16 },
  pickBadgeRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 4 },
  predictionPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  disclaimerBanner: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16
  },
  disclaimerText: { fontSize: 11, fontWeight: '700', textAlign: 'center', lineHeight: 15 }
});
