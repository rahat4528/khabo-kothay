import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Linking,
  Switch,
  ScrollView
} from 'react-native';
import { apiClient } from '../../api/client.js';
import { mobileStorage } from '../../services/storage.js';
import ExplainBottomSheet from './ExplainBottomSheet.js';
import FilterModal from './FilterModal.js';
import { t } from '../../i18n/index.js';

export default function ResultsScreen({ route, navigation, theme }) {
  const { results = [], location } = route.params || {};
  const [explainItem, setExplainItem] = useState(null);
  const [openNowOnly, setOpenNowOnly] = useState(false);
  const [selectedRadius, setSelectedRadius] = useState(null); // in meters: null | 1000 | 2000 | 5000 | 10000
  const [favoriteIds, setFavoriteIds] = useState(new Set());
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [facetFilters, setFacetFilters] = useState({
    priceMin: 0,
    priceMax: 3000,
    availability: [],
    cuisines: [],
    restaurantTypes: [],
    dietary: [],
    features: []
  });

  React.useEffect(() => {
    loadFavorites();
  }, []);

  const loadFavorites = async () => {
    try {
      const favs = await mobileStorage.getFavorites();
      setFavoriteIds(new Set(favs.map(f => f.id)));
    } catch (e) {}
  };

  const handleToggleFav = async (item) => {
    try {
      const isFav = await mobileStorage.toggleFavorite(item);
      setFavoriteIds(prev => {
        const next = new Set(prev);
        if (isFav) {
          next.add(item.id);
        } else {
          next.delete(item.id);
        }
        return next;
      });
    } catch (e) {}
  };

  const getBadgeStyle = (badgeName) => {
    const lower = String(badgeName).toLowerCase();
    if (lower.includes('best overall') || lower.includes('top pick') || lower.includes('best match')) {
      return {
        bg: theme.colors.badgeBest,
        text: theme.colors.badgeBestText,
        border: 'transparent'
      };
    }
    if (lower.includes('price') || lower.includes('fastest') || lower.includes('nearest')) {
      return {
        bg: theme.colors.badgeFast,
        text: theme.colors.badgeFastText,
        border: 'transparent'
      };
    }
    if (lower.includes('new') || lower.includes('try something new')) {
      return {
        bg: 'transparent',
        text: theme.colors.badgeNewText,
        border: theme.colors.badgeNewBorder
      };
    }
    if (lower.includes('verified') || lower.includes('community')) {
      return {
        bg: theme.colors.badgeVerified,
        text: theme.colors.badgeVerifiedText,
        border: 'transparent'
      };
    }
    return {
      bg: theme.colors.surfaceAlt,
      text: theme.colors.textMuted,
      border: 'transparent'
    };
  };

  const filteredResults = useMemo(() => {
    return results.filter(item => {
      // 1. Quick Open Now toggle
      if (openNowOnly) {
        if (!item.openStatus || item.openStatus.isOpen !== true) return false;
      }
      // 2. Radius filter
      if (selectedRadius) {
        if ((item.distanceMeters || 0) > selectedRadius) return false;
      }

      // 3. Facet Filter - Price Range (checks verified menu item prices & estimated cost per person)
      const min = Number.isFinite(facetFilters.priceMin) ? facetFilters.priceMin : 0;
      const max = Number.isFinite(facetFilters.priceMax) ? facetFilters.priceMax : Infinity;

      let matchesPrice = false;
      if (item.menu?.items && item.menu.items.length > 0) {
        const itemPrices = item.menu.items.map(i => i.price).filter(Number.isFinite);
        if (itemPrices.length > 0) {
          const minItemPrice = Math.min(...itemPrices);
          const maxItemPrice = Math.max(...itemPrices);
          const costPerPerson = item.menu?.estimatedCostPerPerson?.amount || item.estimatedCostPerPersonBdt;
          if (costPerPerson && costPerPerson >= min && costPerPerson <= max) {
            matchesPrice = true;
          } else if (minItemPrice <= max && maxItemPrice >= min) {
            matchesPrice = true;
          }
        }
      }
      if (!matchesPrice && (item.estimatedCostPerPerson?.amount || item.estimatedCostPerPersonBdt)) {
        const cost = item.estimatedCostPerPerson?.amount || item.estimatedCostPerPersonBdt;
        if (cost >= min && cost <= max) {
          matchesPrice = true;
        }
      }
      if (!matchesPrice && (!item.menu?.items || item.menu.items.length === 0)) {
        const tierMap = {
          1: { min: 50, max: 400 },
          2: { min: 250, max: 950 },
          3: { min: 700, max: 2000 },
          4: { min: 1500, max: 6000 }
        };
        const tier = tierMap[item.priceLevel || 2] || { min: 0, max: 5000 };
        if (tier.min <= max && tier.max >= min) {
          matchesPrice = true;
        }
      }
      if (!matchesPrice) return false;

      // 4. Facet Filter - Availability
      if (facetFilters.availability && facetFilters.availability.length > 0) {
        const openStatus = item.openStatus || {};
        const matchesAvail = facetFilters.availability.some(av => {
          if (av === 'open_now') return openStatus.isOpen === true;
          if (av === 'closing_soon') return openStatus.isClosingSoon === true;
          if (av === 'open_late') {
            const closeTime = item.regularOpeningHours?.closingTime || '23:00';
            const [cH] = closeTime.split(':').map(Number);
            return cH >= 23 || (cH >= 0 && cH <= 4);
          }
          return false;
        });
        if (!matchesAvail) return false;
      }

      // 5. Facet Filter - Cuisine
      if (facetFilters.cuisines && facetFilters.cuisines.length > 0) {
        if (!facetFilters.cuisines.some(c => c.toLowerCase() === (item.cuisine || '').toLowerCase())) {
          return false;
        }
      }

      // 6. Facet Filter - Restaurant Type
      if (facetFilters.restaurantTypes && facetFilters.restaurantTypes.length > 0) {
        const types = item.restaurantType || ['Dine-in', 'Casual Dining'];
        if (!facetFilters.restaurantTypes.some(t => types.includes(t))) {
          return false;
        }
      }

      // 7. Facet Filter - Dietary
      if (facetFilters.dietary && facetFilters.dietary.length > 0) {
        if (facetFilters.dietary.includes('halal') && item.halal === false) return false;
        if (facetFilters.dietary.includes('vegetarian') && !item.vegetarian) return false;
        if (facetFilters.dietary.includes('vegan') && !item.vegan) return false;
        if (facetFilters.dietary.includes('no_beef') && !item.no_beef) return false;
      }

      // 8. Facet Filter - Features
      if (facetFilters.features && facetFilters.features.length > 0) {
        const placeFeatures = item.features || [];
        if (!facetFilters.features.every(feat => placeFeatures.includes(feat))) {
          return false;
        }
      }

      return true;
    });
  }, [results, openNowOnly, selectedRadius, facetFilters]);

  const renderOpeningBadge = (openStatus) => {
    if (!openStatus || !openStatus.status || openStatus.status === 'Hours unknown') {
      return (
        <View style={[styles.statusBadge, { backgroundColor: theme.colors.surfaceAlt, borderColor: theme.colors.border }]}>
          <Text style={{ color: theme.colors.textMuted, fontSize: 11, fontWeight: '700' }}>⚪ Hours unknown</Text>
        </View>
      );
    }
    if (openStatus.status === 'Closing soon') {
      return (
        <View style={[styles.statusBadge, { backgroundColor: theme.colors.warningTint, borderColor: theme.colors.warning }]}>
          <Text style={{ color: theme.colors.warning, fontSize: 11, fontWeight: '700' }}>
            🟡 Closing soon{openStatus.minutesUntilClose ? ` (${openStatus.minutesUntilClose}m)` : ''}
          </Text>
        </View>
      );
    }
    if (openStatus.status === 'Open now' || openStatus.isOpen === true) {
      return (
        <View style={[styles.statusBadge, { backgroundColor: theme.colors.trafficLowTint, borderColor: theme.colors.trafficLow }]}>
          <Text style={{ color: theme.colors.trafficLow, fontSize: 11, fontWeight: '700' }}>🟢 Open now</Text>
        </View>
      );
    }
    return (
      <View style={[styles.statusBadge, { backgroundColor: theme.colors.dangerTint, borderColor: theme.colors.danger }]}>
        <Text style={{ color: theme.colors.danger, fontSize: 11, fontWeight: '700' }}>🔴 Closed</Text>
      </View>
    );
  };

  const renderItem = ({ item, index }) => {
    const mins = Math.max(1, Math.round(item.durationSeconds / 60));
    const km = (item.distanceMeters / 1000).toFixed(1);
    const travelText = item.durationSeconds !== null && item.durationSeconds !== undefined
      ? `🚗 Driving: ${mins} min • ${km} km`
      : `Travel time: Not available • ${km} km (approx. straight-line)`;

    const trafficColor = item.trafficLevel === 'Low'
      ? theme.colors.trafficLow
      : (item.trafficLevel === 'Moderate' ? theme.colors.trafficModerate : theme.colors.trafficHeavy);
    const trafficBg = item.trafficLevel === 'Low'
      ? theme.colors.trafficLowTint
      : (item.trafficLevel === 'Moderate' ? theme.colors.trafficModerateTint : theme.colors.trafficHeavyTint);
    const photoUrl = apiClient.getPhotoUrl(item.photos?.[0]?.name, 400);

    const handleDirections = () => {
      const userLat = location?.lat || 23.7975;
      const userLng = location?.lng || 90.4234;
      const destLat = item.location?.latitude || 23.7925;
      const destLng = item.location?.longitude || 90.4078;
      const url = `https://www.google.com/maps/dir/?api=1&origin=${userLat},${userLng}&destination=${destLat},${destLng}`;
      
      mobileStorage.setItem('pending_visit_place', {
        id: item.id,
        name: item.displayName,
        cuisine: item.cuisine,
        timestamp: Date.now()
      });

      Linking.openURL(url);
    };

    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
        onPress={() => navigation.navigate('RestaurantDetail', { restaurant: item, location })}
        activeOpacity={0.85}
       accessibilityRole="button" accessibilityLabel={`View restaurant details for ${item.displayName || "restaurant"}`}>
        <Image source={{ uri: photoUrl }} style={styles.cardPhoto} resizeMode="cover" />

        <View style={styles.cardContent}>
          <View style={styles.topRow}>
            <View style={styles.titleWrap}>
              <Text style={[styles.rank, { color: theme.colors.primary }]}>#{index + 1}</Text>
              <Text style={[styles.name, { color: theme.colors.text }]} numberOfLines={1}>
                {item.displayName}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <TouchableOpacity
                onPress={() => handleToggleFav(item)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel={favoriteIds.has(item.id) ? "Remove from favorites" : "Add to favorites"}
              >
                <Text style={{ fontSize: 20 }}>{favoriteIds.has(item.id) ? '❤️' : '🤍'}</Text>
              </TouchableOpacity>
              <View style={[styles.scoreBadge, { backgroundColor: theme.colors.primaryTint }]}>
                <Text style={[styles.scoreText, { color: theme.colors.primary }]}>{item.score}</Text>
              </View>
            </View>
          </View>

          <View style={styles.badgesRow}>
            {renderOpeningBadge(item.openStatus)}
            {item.badges?.map((b) => {
              const bStyle = getBadgeStyle(b);
              return (
                <View
                  key={b}
                  style={[
                    styles.badgePill,
                    {
                      backgroundColor: bStyle.bg,
                      borderWidth: bStyle.border !== 'transparent' ? 1 : 0,
                      borderColor: bStyle.border
                    }
                  ]}
                >
                  <Text style={[styles.badgeText, { color: bStyle.text }]}>{b}</Text>
                </View>
              );
            })}
          </View>

          <View style={styles.metaRow}>
            <Text style={[styles.metaText, { color: theme.colors.textMuted }]}>
              ⭐ {item.rating} ({item.userRatingCount}) • {'৳'.repeat(item.priceLevel || 2)}
            </Text>
            {item.estimatedCostPerPersonBdt && (
              <Text style={[styles.metaText, { color: theme.colors.primary, fontWeight: '700' }]}>
                ~৳{item.estimatedCostPerPersonBdt}/person
              </Text>
            )}
          </View>

          <View style={{ marginBottom: 8 }}>
            <Text style={[styles.metaText, { color: theme.colors.text }]}>
              🕒 {travelText}
            </Text>
          </View>

          <View style={styles.chipRow}>
            {item.trafficLevel && item.trafficLevel !== 'Unknown' && (
              <View style={[styles.trafficChip, { backgroundColor: trafficBg }]}>
                <Text style={[styles.trafficText, { color: trafficColor }]}>
                  🚦 {item.trafficLevel} Traffic
                </Text>
              </View>
            )}
            <View style={styles.transitBox}>
              <Text style={[styles.transitText, { color: theme.colors.primary }]}>
                ~৳{item.transport?.cheapestEstimatedCostBdt} ({item.transport?.cheapestFeasibleMode}) <Text style={[styles.estLabel, { color: theme.colors.textMuted }]}>estimated</Text>
              </Text>
            </View>
          </View>

          {item.departurePredictions?.bestSuggestion && (
            <View style={[styles.predictionPill, { backgroundColor: theme.colors.badgeVerified, alignSelf: 'flex-start', marginVertical: 4 }]}>
              <Text style={{ color: theme.colors.badgeVerifiedText, fontWeight: '800', fontSize: 11 }}>
                ⏱️ {item.departurePredictions.bestSuggestion.message}
              </Text>
            </View>
          )}

          {item.counterfactual && (
            <View style={[styles.counterfactualBox, { backgroundColor: theme.colors.warningTint, borderColor: theme.colors.warning }]}>
              <Text style={[styles.counterfactualText, { color: theme.colors.warning }]}>
                💡 {item.counterfactual}
              </Text>
            </View>
          )}

          <View style={[styles.reasonBox, { backgroundColor: theme.colors.surfaceAlt }]}>
            <Text style={[styles.reasonText, { color: theme.colors.text }]} numberOfLines={2}>
              💡 {item.reason}
            </Text>
          </View>

          <View style={styles.cardActions}>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => setExplainItem(item)}
             accessibilityRole="button" accessibilityLabel="Interactive button">
              <Text style={[styles.actionBtnText, { color: theme.colors.primary }]}>
                📊 {t('restaurant.explain')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, { borderColor: theme.colors.border, borderWidth: 1, borderRadius: 10 }]}
              onPress={handleDirections}
             accessibilityRole="button" accessibilityLabel="Get navigation directions">
              <Text style={[styles.actionBtnText, { color: theme.colors.primary }]}>
                🧭 Directions
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtnPrimary, { backgroundColor: theme.colors.primary }]}
              onPress={() => navigation.navigate('CompareOptions', { restaurant: item, location })}
             accessibilityRole="button" accessibilityLabel="Interactive button">
              <Text style={[styles.actionBtnPrimaryText, { color: theme.colors.onPrimary }]}>
                🔄 {t('restaurant.compare')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderFilterHeader = () => {
    const activeTags = [];
    const isPriceFiltered = (facetFilters.priceMin > 0 || facetFilters.priceMax < 3000);
    if (isPriceFiltered) {
      activeTags.push({
        id: 'price',
        label: `৳${facetFilters.priceMin}–৳${facetFilters.priceMax}`,
        onRemove: () => setFacetFilters(prev => ({ ...prev, priceMin: 0, priceMax: 3000 }))
      });
    }
    const availMap = {
      open_now: 'Open Now',
      closing_soon: 'Closing Soon',
      open_late: 'Open Late'
    };
    (facetFilters.availability || []).forEach(av => {
      activeTags.push({
        id: `avail_${av}`,
        label: availMap[av] || av,
        onRemove: () => setFacetFilters(prev => ({
          ...prev,
          availability: prev.availability.filter(x => x !== av)
        }))
      });
    });
    (facetFilters.cuisines || []).forEach(c => {
      activeTags.push({
        id: `c_${c}`,
        label: c,
        onRemove: () => setFacetFilters(prev => ({
          ...prev,
          cuisines: prev.cuisines.filter(x => x !== c)
        }))
      });
    });
    (facetFilters.restaurantTypes || []).forEach(rt => {
      activeTags.push({
        id: `rt_${rt}`,
        label: rt,
        onRemove: () => setFacetFilters(prev => ({
          ...prev,
          restaurantTypes: prev.restaurantTypes.filter(x => x !== rt)
        }))
      });
    });
    const dietMap = {
      halal: 'Halal',
      vegetarian: 'Vegetarian',
      vegan: 'Vegan',
      no_beef: 'No Beef'
    };
    (facetFilters.dietary || []).forEach(d => {
      activeTags.push({
        id: `d_${d}`,
        label: dietMap[d] || d,
        onRemove: () => setFacetFilters(prev => ({
          ...prev,
          dietary: prev.dietary.filter(x => x !== d)
        }))
      });
    });
    (facetFilters.features || []).forEach(feat => {
      activeTags.push({
        id: `f_${feat}`,
        label: feat,
        onRemove: () => setFacetFilters(prev => ({
          ...prev,
          features: prev.features.filter(x => x !== feat)
        }))
      });
    });

    const totalFacetCount = activeTags.length;

    return (
      <View style={[styles.filterBar, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
        <View style={styles.filterTopRow}>
          <View>
            <Text style={[styles.filterHeading, { color: theme.colors.text }]}>
              {filteredResults.length} matches found
            </Text>
            <Text style={{ fontSize: 11, color: theme.colors.textMuted }}>
              Dhaka • Gulshan & Nearby
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TouchableOpacity
              style={[
                styles.filterTriggerBtn,
                { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceAlt },
                totalFacetCount > 0 && { borderColor: theme.colors.primary, backgroundColor: theme.colors.primaryTint }
              ]}
              onPress={() => setFilterModalVisible(true)}
              activeOpacity={0.8}
             accessibilityRole="button" accessibilityLabel="Interactive button">
              <Text
                style={[
                  styles.filterTriggerText,
                  { color: totalFacetCount > 0 ? theme.colors.primary : theme.colors.text }
                ]}
              >
                ⚙️ Filters {totalFacetCount > 0 ? `(${totalFacetCount})` : ''}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Active Filter Chips Horizontal Row (Removable with ✕) */}
        {totalFacetCount > 0 && (
          <View style={styles.activeFiltersSection}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.activeTagsScroll}>
              {activeTags.map(tag => (
                <TouchableOpacity
                  key={tag.id}
                  style={[styles.activeTagBadge, { backgroundColor: theme.colors.primaryTint, borderColor: theme.colors.primary }]}
                  onPress={tag.onRemove}
                  activeOpacity={0.7}
                 accessibilityRole="button" accessibilityLabel={`Remove filter ${tag.label}`}>
                  <Text style={[styles.activeTagText, { color: theme.colors.primary }]}>{tag.label}</Text>
                  <Text style={[styles.activeTagRemove, { color: theme.colors.primary }]}>✕</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                onPress={() => setFacetFilters({
                  priceMin: 0,
                  priceMax: 3000,
                  availability: [],
                  cuisines: [],
                  restaurantTypes: [],
                  dietary: [],
                  features: []
                })}
                style={styles.clearAllBtn}
               accessibilityRole="button" accessibilityLabel="Interactive button">
                <Text style={[styles.clearAllText, { color: theme.colors.danger }]}>Clear all</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        )}

        {/* Radius Row */}
        <View style={styles.radiusRow}>
          <Text style={[styles.radiusLabel, { color: theme.colors.textMuted }]}>Radius:</Text>
          {[
            { label: 'Any', value: null },
            { label: '≤ 1km', value: 1000 },
            { label: '≤ 2km', value: 2000 },
            { label: '≤ 5km', value: 5000 },
            { label: '≤ 10km', value: 10000 }
          ].map(r => {
            const active = selectedRadius === r.value;
            return (
              <TouchableOpacity
                key={r.label}
                style={[
                  styles.radiusChip,
                  { borderColor: theme.colors.border },
                  active && { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }
                ]}
                onPress={() => setSelectedRadius(r.value)}
               accessibilityRole="button" accessibilityLabel={`Radius ${r.label}`}>
                <Text style={[styles.radiusChipText, { color: active ? theme.colors.onPrimary : theme.colors.text }]}>
                  {r.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <FlatList
        data={filteredResults}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListHeaderComponent={renderFilterHeader}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={[styles.emptyText, { color: theme.colors.textMuted }]}>
              {openNowOnly || selectedRadius || (facetFilters.priceMin > 0 || facetFilters.priceMax < 3000 || (facetFilters.cuisines && facetFilters.cuisines.length > 0) || (facetFilters.availability && facetFilters.availability.length > 0) || (facetFilters.restaurantTypes && facetFilters.restaurantTypes.length > 0) || (facetFilters.dietary && facetFilters.dietary.length > 0) || (facetFilters.features && facetFilters.features.length > 0)) ? 'No places match the active filters. Try expanding your radius or resetting your price & filters.' : t('common.emptyDesc')}
            </Text>
          </View>
        }
      />

      <ExplainBottomSheet
        visible={Boolean(explainItem)}
        onClose={() => setExplainItem(null)}
        restaurant={explainItem}
        theme={theme}
      />

      <FilterModal
        visible={filterModalVisible}
        onClose={() => setFilterModalVisible(false)}
        filters={facetFilters}
        onApplyFilters={(newFilters) => setFacetFilters(newFilters)}
        onResetFilters={() => setFacetFilters({
          priceMin: 0,
          priceMax: 3000,
          availability: [],
          cuisines: [],
          restaurantTypes: [],
          dietary: [],
          features: []
        })}
        theme={theme}
        matchCount={filteredResults.length}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: 16, gap: 16 },
  card: { borderRadius: 18, borderWidth: 1, overflow: 'hidden' },
  cardPhoto: { width: '100%', height: 160 },
  cardContent: { padding: 16 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  titleWrap: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 6 },
  rank: { fontSize: 16, fontWeight: '800' },
  name: { fontSize: 17, fontWeight: '800', flex: 1 },
  scoreBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  scoreText: { fontWeight: '800', fontSize: 14 },
  badgesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: 8 },
  badgePill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  metaText: { fontSize: 13, fontWeight: '600' },
  chipRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  trafficChip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  trafficText: { fontSize: 12, fontWeight: '800' },
  transitBox: { flex: 1 },
  transitText: { fontSize: 12, fontWeight: '700' },
  estLabel: { fontSize: 10 },
  reasonBox: { padding: 10, borderRadius: 8, marginBottom: 12 },
  reasonText: { fontSize: 12, lineHeight: 16 },
  cardActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  actionBtn: { paddingVertical: 8, paddingHorizontal: 12 },
  actionBtnText: { fontSize: 13, fontWeight: '700' },
  actionBtnPrimary: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10 },
  actionBtnPrimaryText: { fontSize: 13, fontWeight: '700' },
  empty: { padding: 40, alignItems: 'center' },
  emptyText: { textAlign: 'center' },
  predictionPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  filterBar: { padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: 12 },
  filterTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  filterHeading: { fontSize: 13, fontWeight: '800' },
  filterTriggerBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1
  },
  filterTriggerText: {
    fontSize: 12,
    fontWeight: '800'
  },
  activeFiltersSection: {
    marginTop: 4,
    marginBottom: 8
  },
  activeTagsScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  activeTagBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 14,
    borderWidth: 1
  },
  activeTagText: {
    fontSize: 11,
    fontWeight: '700'
  },
  activeTagRemove: {
    fontSize: 11,
    fontWeight: '800'
  },
  clearAllBtn: {
    paddingHorizontal: 6,
    paddingVertical: 3
  },
  clearAllText: {
    fontSize: 11,
    fontWeight: '800',
    textDecorationLine: 'underline'
  },
  openNowRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  openNowLabel: { fontSize: 12, fontWeight: '700' },
  radiusRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  radiusLabel: { fontSize: 12, fontWeight: '700', marginRight: 4 },
  radiusChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, borderWidth: 1 },
  radiusChipText: { fontSize: 11, fontWeight: '700' },
  counterfactualBox: {
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8
  },
  counterfactualText: { fontSize: 11, fontWeight: '700', lineHeight: 15 }
});
