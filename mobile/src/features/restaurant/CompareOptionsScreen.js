import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Linking
} from 'react-native';
import { apiClient } from '../../api/client.js';
import { mobileStorage } from '../../services/storage.js';
import { REAL_DHAKA_RESTAURANTS } from '../../data/embedded-restaurants.js';
import { t } from '../../i18n/index.js';

export default function CompareOptionsScreen({ route, theme }) {
  const { restaurant, location } = route.params || {};
  const [activeTab, setActiveTab] = useState('routes'); // 'routes' | 'places'
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [placesList, setPlacesList] = useState([]);
  const [selectedPlaceIds, setSelectedPlaceIds] = useState([]);
  const [budgetLimit, setBudgetLimit] = useState(2500);

  useEffect(() => {
    fetchComparison();
    loadPlacesForComparison();
  }, []);

  const loadPlacesForComparison = async () => {
    try {
      const cached = await mobileStorage.getCachedResults();
      const available = (cached?.results && cached.results.length > 0)
        ? cached.results
        : REAL_DHAKA_RESTAURANTS;
      setPlacesList(available);

      const initialIds = [
        restaurant?.id,
        available.find(p => p.id !== restaurant?.id)?.id,
        available.filter(p => p.id !== restaurant?.id)[1]?.id
      ].filter(Boolean);
      setSelectedPlaceIds(initialIds);
    } catch (e) {
      setPlacesList(REAL_DHAKA_RESTAURANTS);
      setSelectedPlaceIds([restaurant?.id, REAL_DHAKA_RESTAURANTS[0]?.id].filter(Boolean));
    }
  };

  const fetchComparison = async () => {
    try {
      const res = await apiClient.compareRoutes(
        { lat: location?.lat || 23.7975, lng: location?.lng || 90.4234 },
        { lat: restaurant.location.latitude, lng: restaurant.location.longitude }
      );
      setData(res);
    } catch (e) {
      console.warn('Compare routes error:', e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (!data) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <Text style={{ color: theme.colors.textMuted }}>Unable to compare routes right now.</Text>
      </View>
    );
  }

  const selectedPlaces = selectedPlaceIds
    .map(id => placesList.find(p => p.id === id))
    .filter(Boolean);

  const toggleSelectPlace = (id) => {
    if (selectedPlaceIds.includes(id)) {
      if (selectedPlaceIds.length > 2) {
        setSelectedPlaceIds(selectedPlaceIds.filter(x => x !== id));
      }
    } else {
      if (selectedPlaceIds.length < 3) {
        setSelectedPlaceIds([...selectedPlaceIds, id]);
      } else {
        setSelectedPlaceIds([selectedPlaceIds[1], selectedPlaceIds[2], id]);
      }
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.content}>
        {/* Tab Switcher: Routes vs Side-by-Side Restaurants */}
        <View style={[styles.tabBar, { backgroundColor: theme.colors.surfaceAlt, borderColor: theme.colors.border }]}>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'routes' && { backgroundColor: theme.colors.primary }]}
            onPress={() => setActiveTab('routes')}
           accessibilityRole="tab" accessibilityLabel="Interactive button">
            <Text style={[styles.tabBtnText, { color: activeTab === 'routes' ? theme.colors.onPrimary : theme.colors.text }]}>
              🔄 Route Options
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'places' && { backgroundColor: theme.colors.primary }]}
            onPress={() => setActiveTab('places')}
           accessibilityRole="tab" accessibilityLabel="Interactive button">
            <Text style={[styles.tabBtnText, { color: activeTab === 'places' ? theme.colors.onPrimary : theme.colors.text }]}>
              ⚖️ Compare Places ({selectedPlaces.length})
            </Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'routes' ? (
          <>
            {/* Recommended Highlight */}
            <View style={[styles.recommendBox, { backgroundColor: theme.colors.primaryTint, borderLeftColor: theme.colors.primary }]}>
              <Text style={[styles.recTitle, { color: theme.colors.primary }]}>★ {t('compare.recommendedRoute')}</Text>
              <Text style={[styles.recText, { color: theme.colors.text }]}>{data.recommendationReason}</Text>
            </View>

            {/* Alternative Routes Grid */}
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              {t('compare.alternativeRoutes')}
            </Text>
            {data.routes?.map((r, idx) => (
              <View
                key={idx}
                style={[
                  styles.routeCard,
                  { backgroundColor: theme.colors.card, borderColor: idx === data.recommendedRouteIndex ? theme.colors.primary : theme.colors.border }
                ]}
              >
                <View style={styles.routeHeader}>
                  <Text style={[styles.routeName, { color: theme.colors.text }]}>{r.name}</Text>
                  {idx === data.recommendedRouteIndex && (
                    <View style={[styles.recBadge, { backgroundColor: theme.colors.primary }]}>
                      <Text style={[styles.recBadgeText, { color: theme.colors.onPrimary }]}>Recommended</Text>
                    </View>
                  )}
                </View>
                <View style={styles.routeStats}>
                  <Text style={[styles.statText, { color: theme.colors.textMuted }]}>⏱️ {Math.round(r.durationSeconds / 60)} min</Text>
                  <Text style={[styles.statText, { color: theme.colors.textMuted }]}>🛣️ {(r.distanceMeters / 1000).toFixed(1)} km</Text>
                  <Text
                    style={[
                      styles.trafficTag,
                      {
                        color: r.trafficLevel === 'Low'
                          ? theme.colors.trafficLow
                          : (r.trafficLevel === 'Moderate' ? theme.colors.trafficModerate : theme.colors.trafficHeavy)
                      }
                    ]}
                  >
                    {r.trafficLevel} Traffic
                  </Text>
                </View>
              </View>
            ))}

            {/* Transport Mode Table */}
            <Text style={[styles.sectionTitle, { color: theme.colors.text, marginTop: 24 }]}>
              {t('compare.transportModes')}
            </Text>
            <Text style={[styles.disclaimer, { color: theme.colors.textSubtle }]}>
              All costs are estimated based on Dhaka standard rates &amp; congestion.
            </Text>

            <View style={[styles.table, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
              {data.transportModes?.map((m, idx) => (
                <View key={idx} style={styles.tableRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.modeName, { color: theme.colors.text }]}>{m.modeName}</Text>
                    <Text style={[styles.modeCalc, { color: theme.colors.textSubtle }]}>{m.breakdown.calculation}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[styles.costVal, { color: theme.colors.primary }]}>~৳{m.estimatedCostBdt}</Text>
                    <Text style={[styles.feasibleText, { color: theme.colors.textMuted }]}>{m.feasible ? '✅ Feasible' : '⚠️ Long'}</Text>
                  </View>
                </View>
              ))}
            </View>
          </>
        ) : (
          /* Side-by-Side Restaurants Comparison Mode (Phase 2) */
          <View>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              Compare 2 to 3 Restaurants Side-by-Side
            </Text>
            <Text style={[styles.disclaimer, { color: theme.colors.textSubtle }]}>
              Tap to pick places to compare:
            </Text>

            {/* Pickers list */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
              {placesList.map(p => {
                const isSelected = selectedPlaceIds.includes(p.id);
                return (
                  <TouchableOpacity
                    key={p.id}
                    style={[
                      styles.pickChip,
                      { borderColor: theme.colors.border },
                      isSelected && { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }
                    ]}
                    onPress={() => toggleSelectPlace(p.id)}
                   accessibilityRole="checkbox" accessibilityLabel="Interactive button">
                    <Text style={[styles.pickChipText, { color: isSelected ? theme.colors.onPrimary : theme.colors.text }]}>
                      {isSelected ? '✓ ' : ''}{p.displayName}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Budget filter buttons */}
            <View style={styles.budgetFilterRow}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: theme.colors.textMuted }}>Max Budget:</Text>
              {[500, 1000, 1500, 2500].map(b => (
                <TouchableOpacity
                  key={b}
                  style={[
                    styles.budgetChip,
                    { borderColor: theme.colors.border },
                    budgetLimit === b && { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }
                  ]}
                  onPress={() => setBudgetLimit(b)}
                 accessibilityRole="button" accessibilityLabel={`Budget tier ${b}`}>
                  <Text style={[styles.budgetChipText, { color: budgetLimit === b ? theme.colors.onPrimary : theme.colors.text }]}>
                    ≤ ৳{b}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Side-by-side cards grid */}
            <View style={styles.comparisonGrid}>
              {selectedPlaces.map(p => {
                const km = (p.distanceMeters / 1000).toFixed(1);
                const hasTime = p.durationSeconds !== null && p.durationSeconds !== undefined;
                const cost = p.estimatedCostPerPersonBdt;
                const isOverBudget = cost && cost > budgetLimit;

                return (
                  <View
                    key={p.id}
                    style={[
                      styles.placeCard,
                      { backgroundColor: theme.colors.card, borderColor: theme.colors.border }
                    ]}
                  >
                    <Text style={[styles.placeTitle, { color: theme.colors.text }]}>{p.displayName}</Text>
                    <Text style={[styles.placeCuisine, { color: theme.colors.primary }]}>{p.cuisine}</Text>

                    {/* Status */}
                    <View style={styles.attrRow}>
                      <Text style={[styles.attrLabel, { color: theme.colors.textMuted }]}>Status:</Text>
                      <Text style={[styles.attrVal, { color: p.openStatus?.isOpen ? theme.colors.trafficLow : theme.colors.textMuted }]}>
                        {p.openStatus?.status || 'Hours unknown'}
                      </Text>
                    </View>

                    {/* Distance & Travel time */}
                    <View style={styles.attrRow}>
                      <Text style={[styles.attrLabel, { color: theme.colors.textMuted }]}>Distance:</Text>
                      <Text style={[styles.attrVal, { color: theme.colors.text }]}>
                        {km} km {hasTime ? '' : '(straight-line)'}
                      </Text>
                    </View>

                    <View style={styles.attrRow}>
                      <Text style={[styles.attrLabel, { color: theme.colors.textMuted }]}>Travel:</Text>
                      <Text style={[styles.attrVal, { color: theme.colors.text }]}>
                        {hasTime ? `🚗 ${Math.max(1, Math.round(p.durationSeconds / 60))} min` : 'Not available'}
                      </Text>
                    </View>

                    {/* Price Range */}
                    <View style={styles.attrRow}>
                      <Text style={[styles.attrLabel, { color: theme.colors.textMuted }]}>Price:</Text>
                      <Text style={[styles.attrVal, { color: theme.colors.text }]}>
                        {p.priceLevel ? '৳'.repeat(p.priceLevel) : 'Not available'}
                      </Text>
                    </View>

                    {/* Cost Per Person */}
                    <View style={styles.attrRow}>
                      <Text style={[styles.attrLabel, { color: theme.colors.textMuted }]}>Per person:</Text>
                      <Text style={[styles.attrVal, { color: isOverBudget ? theme.colors.danger : theme.colors.primary, fontWeight: '800' }]}>
                        {cost ? `~৳${cost}` : 'Not available'}
                        {isOverBudget ? ' ⚠️ Over' : ''}
                      </Text>
                    </View>

                    {/* Dietary info */}
                    <View style={styles.attrRow}>
                      <Text style={[styles.attrLabel, { color: theme.colors.textMuted }]}>Dietary:</Text>
                      <Text style={[styles.attrVal, { color: theme.colors.text, fontSize: 11 }]}>
                        {p.halal ? '🕌 Halal ' : ''}{p.vegetarian ? '🥗 Veg ' : ''}{(!p.halal && !p.vegetarian) ? 'Unverified' : ''}
                      </Text>
                    </View>

                    {/* Traceable Menu Source */}
                    {p.menu?.sourceUrl ? (
                      <TouchableOpacity onPress={() => Linking.openURL(p.menu.sourceUrl)} style={{ marginTop: 6 }} accessibilityRole="button" accessibilityLabel="Interactive button">
                        <Text style={[styles.sourceLinkText, { color: theme.colors.primary }]} numberOfLines={1}>
                          🔗 {p.menu.sourceName || 'Menu Source'}
                        </Text>
                      </TouchableOpacity>
                    ) : (
                      <Text style={[styles.sourceLinkText, { color: theme.colors.textSubtle }]}>
                        Menu: Unverified
                      </Text>
                    )}

                    {/* Directions button */}
                    <TouchableOpacity
                      style={[styles.dirBtn, { backgroundColor: theme.colors.primary }]}
                      onPress={() => {
                        const userLat = location?.lat || 23.7975;
                        const userLng = location?.lng || 90.4234;
                        const destLat = p.location?.latitude || 23.7925;
                        const destLng = p.location?.longitude || 90.4078;
                        Linking.openURL(`https://www.google.com/maps/dir/?api=1&origin=${userLat},${userLng}&destination=${destLat},${destLng}`);
                      }}
                     accessibilityRole="button" accessibilityLabel="Get navigation directions">
                      <Text style={[styles.dirBtnText, { color: theme.colors.onPrimary }]}>🧭 Directions</Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: 16 },
  tabBar: { flexDirection: 'row', borderRadius: 12, borderWidth: 1, padding: 4, marginBottom: 16 },
  tabBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  tabBtnText: { fontSize: 13, fontWeight: '800' },
  recommendBox: {
    borderLeftWidth: 4,
    padding: 14,
    borderRadius: 8,
    marginBottom: 20
  },
  recTitle: { fontSize: 13, fontWeight: '800', textTransform: 'uppercase' },
  recText: { fontSize: 14, marginTop: 4, lineHeight: 18 },
  sectionTitle: { fontSize: 17, fontWeight: '800', marginBottom: 12 },
  disclaimer: { fontSize: 12, marginBottom: 12 },
  routeCard: { padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: 12 },
  routeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  routeName: { fontSize: 15, fontWeight: '700' },
  recBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  recBadgeText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  routeStats: { flexDirection: 'row', gap: 12 },
  statText: { fontSize: 13 },
  trafficTag: { fontSize: 13, fontWeight: '700' },
  table: { borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  tableRow: { flexDirection: 'row', justifyContent: 'space-between', padding: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  modeName: { fontSize: 14, fontWeight: '700' },
  modeCalc: { fontSize: 11, marginTop: 2 },
  costVal: { fontSize: 14, fontWeight: '800' },
  feasibleText: { fontSize: 11, marginTop: 2 },
  pickChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, marginRight: 8 },
  pickChipText: { fontSize: 12, fontWeight: '700' },
  budgetFilterRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  budgetChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, borderWidth: 1 },
  budgetChipText: { fontSize: 12, fontWeight: '700' },
  comparisonGrid: { gap: 12 },
  placeCard: { padding: 14, borderRadius: 14, borderWidth: 1 },
  placeTitle: { fontSize: 16, fontWeight: '800' },
  placeCuisine: { fontSize: 12, fontWeight: '700', marginBottom: 8 },
  attrRow: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 3 },
  attrLabel: { fontSize: 12, fontWeight: '600' },
  attrVal: { fontSize: 12, fontWeight: '700' },
  sourceLinkText: { fontSize: 11, textDecorationLine: 'underline', marginTop: 4 },
  dirBtn: { paddingVertical: 8, borderRadius: 8, alignItems: 'center', marginTop: 10 },
  dirBtnText: { fontSize: 12, fontWeight: '800' }
});
