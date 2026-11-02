import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Linking,
  Share,
  Alert
} from 'react-native';
import { apiClient } from '../../api/client.js';
import { mobileStorage } from '../../services/storage.js';
import { t } from '../../i18n/index.js';

export default function RestaurantDetailScreen({ route, navigation, theme }) {
  const { restaurant, location } = route.params || {};
  const [details, setDetails] = useState(restaurant);
  const [isFav, setIsFav] = useState(false);

  useEffect(() => {
    initDetails();
  }, []);

  const initDetails = async () => {
    const favStatus = await mobileStorage.isFavorite(restaurant.id);
    setIsFav(favStatus);

    try {
      const full = await apiClient.getPlaceDetails(restaurant.id);
      setDetails(prev => ({ ...prev, ...full }));
    } catch (e) {
      console.warn('Could not fetch extra details:', e);
    }
  };

  const handleCall = () => {
    const phone = details?.nationalPhoneNumber || details?.internationalPhoneNumber;
    if (phone) {
      Linking.openURL(`tel:${phone.replace(/\s+/g, '')}`);
    } else {
      Alert.alert(t('restaurant.call'), t('restaurant.noPhone'));
    }
  };

  const handleWebsite = () => {
    if (details?.websiteUri) {
      Linking.openURL(details.websiteUri);
    }
  };

  const handleDirections = () => {
    const userLat = location?.lat || 23.7975;
    const userLng = location?.lng || 90.4234;
    const destLat = details.location.latitude;
    const destLng = details.location.longitude;
    const url = `https://www.google.com/maps/dir/?api=1&origin=${userLat},${userLng}&destination=${destLat},${destLng}`;
    
    // Set pending visit flag for "Did you go?" prompt next time
    mobileStorage.setItem('pending_visit_place', {
      id: details.id,
      name: details.displayName,
      cuisine: details.cuisine,
      timestamp: Date.now()
    });

    Linking.openURL(url);
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Check out ${details.displayName} in Dhaka (${details.cuisine}): ${details.reason}`,
        title: details.displayName
      });
    } catch (e) {}
  };

  const handleToggleFav = async () => {
    const next = await mobileStorage.toggleFavorite(details);
    setIsFav(next);
  };

  const handleDismiss = async () => {
    const currentProfile = await mobileStorage.getTasteProfile();
    await apiClient.postTasteEvent(currentProfile, {
      type: 'dismissed',
      restaurantId: details.id,
      cuisine: details.cuisine
    });
    Alert.alert('Feedback Recorded', 'Your taste profile has been updated to recommend less of this food.');
    navigation.goBack();
  };

  const photoUrl = apiClient.getPhotoUrl(details?.photos?.[0]?.name, 600);

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Image source={{ uri: photoUrl }} style={styles.heroPhoto} />

      <View style={styles.body}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: theme.colors.text }]}>{details.displayName}</Text>
            <Text style={[styles.cuisine, { color: theme.colors.secondary }]}>{details.cuisine}</Text>
          </View>
          <TouchableOpacity onPress={handleToggleFav} style={styles.favBtn} accessibilityRole="button" accessibilityLabel={isFav ? "Remove from favorites" : "Save to favorites"}>
            <Text style={{ fontSize: 26 }}>{isFav ? '❤️' : '🤍'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.metaRow}>
          <Text style={[styles.metaText, { color: theme.colors.textMuted }]}>
            ⭐ {details.rating} ({details.userRatingCount} reviews) • {'৳'.repeat(details.priceLevel || 2)}
          </Text>
          <Text style={[styles.metaText, { color: theme.colors.textMuted }]}>
            {details.durationSeconds !== null && details.durationSeconds !== undefined
              ? `🚗 ${Math.max(1, Math.round(details.durationSeconds / 60))} min • ${(details.distanceMeters / 1000).toFixed(1)} km`
              : `Not available • ${(details.distanceMeters / 1000).toFixed(1)} km (approx. straight-line)`}
          </Text>
        </View>

        {/* Operating Hours Status Badge */}
        <View style={styles.statusRow}>
          {(!details.openStatus || details.openStatus.status === 'Hours unknown') && (
            <View style={[styles.statusBadge, { backgroundColor: theme.colors.surfaceAlt, borderColor: theme.colors.border }]}>
              <Text style={{ color: theme.colors.textMuted, fontSize: 12, fontWeight: '700' }}>⚪ Hours unknown</Text>
            </View>
          )}
          {details.openStatus?.status === 'Closing soon' && (
            <View style={[styles.statusBadge, { backgroundColor: theme.colors.warningTint, borderColor: theme.colors.warning }]}>
              <Text style={{ color: theme.colors.warning, fontSize: 12, fontWeight: '700' }}>
                🟡 Closing soon{details.openStatus.minutesUntilClose ? ` (${details.openStatus.minutesUntilClose} min)` : ''}
              </Text>
            </View>
          )}
          {(details.openStatus?.status === 'Open now' || details.openStatus?.isOpen === true) && (
            <View style={[styles.statusBadge, { backgroundColor: theme.colors.trafficLowTint, borderColor: theme.colors.trafficLow }]}>
              <Text style={{ color: theme.colors.trafficLow, fontSize: 12, fontWeight: '700' }}>🟢 Open now</Text>
            </View>
          )}
          {details.openStatus?.status === 'Closed' && (
            <View style={[styles.statusBadge, { backgroundColor: theme.colors.dangerTint, borderColor: theme.colors.danger }]}>
              <Text style={{ color: theme.colors.danger, fontSize: 12, fontWeight: '700' }}>🔴 Closed</Text>
            </View>
          )}
        </View>

        <Text style={[styles.address, { color: theme.colors.textSubtle }]}>
          📍 {details.formattedAddress}
        </Text>

        {/* Estimated Cost per Person (Phase 2) */}
        <View style={[styles.costBox, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          {details.estimatedCostPerPersonBdt ? (
            <>
              <View style={styles.costHeader}>
                <Text style={[styles.costTitle, { color: theme.colors.primary }]}>
                  ~৳{details.estimatedCostPerPersonBdt} / person
                </Text>
                {details.costRangeMinBdt && details.costRangeMaxBdt && (
                  <Text style={[styles.costRange, { color: theme.colors.textMuted }]}>
                    Range: ৳{details.costRangeMinBdt} - ৳{details.costRangeMaxBdt}
                  </Text>
                )}
              </View>
              <Text style={[styles.costDerivation, { color: theme.colors.textSubtle }]}>
                How derived: {details.costDerivation || 'Based on price level and typical dining portion'}
              </Text>
            </>
          ) : (
            <Text style={{ color: theme.colors.textMuted, fontSize: 13 }}>
              Estimated cost per person: <Text style={{ fontWeight: '700' }}>Not available</Text> (insufficient verified pricing data)
            </Text>
          )}
        </View>

        {/* Verified Menu Items Section (Phase 2) */}
        <View style={styles.menuSection}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>🍽️ Verified Menu & Prices</Text>
          {details.menu?.items && details.menu.items.length > 0 ? (
            <View style={styles.menuList}>
              {details.menu.items.map((item, idx) => (
                <View
                  key={idx}
                  style={[styles.menuItemCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
                >
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={[styles.menuItemName, { color: theme.colors.text }]}>{item.name}</Text>
                      <View style={[
                        styles.badgePill,
                        {
                          backgroundColor: item.status === 'Verified' ? theme.colors.trafficLowTint : theme.colors.warningTint,
                          borderColor: item.status === 'Verified' ? theme.colors.trafficLow : theme.colors.warning
                        }
                      ]}>
                        <Text style={{
                          fontSize: 10,
                          fontWeight: '800',
                          color: item.status === 'Verified' ? theme.colors.trafficLow : theme.colors.warning
                        }}>
                          {item.status || 'Verified'}
                        </Text>
                      </View>
                    </View>
                    {item.description ? (
                      <Text style={[styles.menuItemDesc, { color: theme.colors.textMuted }]}>{item.description}</Text>
                    ) : null}
                  </View>
                  <Text style={[styles.menuItemPrice, { color: theme.colors.primary }]}>
                    {item.priceBdt ? `৳${item.priceBdt}` : 'Not available'}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <View style={[styles.emptyMenuBox, { backgroundColor: theme.colors.surfaceAlt, borderColor: theme.colors.border }]}>
              <Text style={[styles.emptyMenuTitle, { color: theme.colors.text }]}>No verified menu on file yet</Text>
              <Text style={[styles.emptyMenuSub, { color: theme.colors.textMuted }]}>
                Only prices from official websites, social pages, or delivery listings are shown. Verified entries can be submitted by restaurant owners.
              </Text>
            </View>
          )}

          {/* Traceable Menu Source Metadata */}
          {details.menu?.sourceUrl ? (
            <View style={[styles.sourceCard, { backgroundColor: theme.colors.surfaceAlt, borderColor: theme.colors.border }]}>
              <Text style={[styles.sourceLabel, { color: theme.colors.textMuted }]}>
                Traceable Source: <Text style={{ color: theme.colors.text, fontWeight: '700' }}>{details.menu.sourceName || 'Official Listing'}</Text>
              </Text>
              <TouchableOpacity onPress={() => Linking.openURL(details.menu.sourceUrl)} accessibilityRole="button" accessibilityLabel="Interactive button">
                <Text style={[styles.sourceLink, { color: theme.colors.primary }]} numberOfLines={1}>
                  🔗 {details.menu.sourceUrl}
                </Text>
              </TouchableOpacity>
              <Text style={[styles.lastChecked, { color: theme.colors.textSubtle }]}>
                Last checked: {details.menu.lastChecked || 'Recently'}
              </Text>
            </View>
          ) : (
            <View style={[styles.sourceCard, { backgroundColor: theme.colors.surfaceAlt, borderColor: theme.colors.border }]}>
              <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>
                Source: Unverified / Awaiting owner or verified submission
              </Text>
            </View>
          )}
        </View>

        <View style={[styles.reasonCard, { backgroundColor: theme.colors.surfaceAlt }]}>
          <Text style={styles.reasonIcon}>💡</Text>
          <Text style={[styles.reasonText, { color: theme.colors.text }]}>{details.reason}</Text>
        </View>

        {/* Primary Action Buttons */}
        <View style={styles.actionGrid}>
          <TouchableOpacity
            style={[styles.primaryAction, { backgroundColor: theme.colors.primary }]}
            onPress={handleCall}
           accessibilityRole="button" accessibilityLabel="Interactive button">
            <Text style={[styles.primaryActionText, { color: theme.colors.onPrimary }]}>📞 {details.nationalPhoneNumber ? t('restaurant.call') : t('restaurant.noPhone')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryAction, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
            onPress={handleDirections}
           accessibilityRole="button" accessibilityLabel="Get navigation directions">
            <Text style={[styles.secondaryActionText, { color: theme.colors.text }]}>🧭 {t('restaurant.directions')}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.extraActions}>
          {details.websiteUri && (
            <TouchableOpacity style={styles.textBtn} onPress={handleWebsite} accessibilityRole="button" accessibilityLabel="Visit restaurant website">
              <Text style={{ color: theme.colors.primary, fontWeight: '700' }}>🌐 {t('restaurant.website')}</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.textBtn} onPress={handleShare} accessibilityRole="button" accessibilityLabel="Share restaurant details">
            <Text style={{ color: theme.colors.textMuted, fontWeight: '700' }}>📤 {t('restaurant.share')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.textBtn}
            onPress={() => navigation.navigate('CompareOptions', { restaurant: details, location })}
           accessibilityRole="button" accessibilityLabel="Interactive button">
            <Text style={{ color: theme.colors.primary, fontWeight: '800' }}>🔄 {t('restaurant.compare')}</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.dismissBtn} onPress={handleDismiss} accessibilityRole="button" accessibilityLabel="Dismiss this recommendation">
          <Text style={{ color: theme.colors.danger, fontSize: 13, fontWeight: '600' }}>
            ✕ {t('restaurant.dismiss')}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  heroPhoto: { width: '100%', height: 240 },
  body: { padding: 20 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  title: { fontSize: 22, fontWeight: '800' },
  cuisine: { fontSize: 15, fontWeight: '700', marginTop: 2 },
  favBtn: { padding: 6 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 8 },
  metaText: { fontSize: 14, fontWeight: '600' },
  address: { fontSize: 13, marginBottom: 16 },
  reasonCard: {
    flexDirection: 'row',
    gap: 8,
    padding: 14,
    borderRadius: 14,
    marginBottom: 20
  },
  reasonIcon: { fontSize: 18 },
  reasonText: { flex: 1, fontSize: 13, lineHeight: 18 },
  actionGrid: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  primaryAction: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  primaryActionText: { fontWeight: '800', fontSize: 15 },
  secondaryAction: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center', borderWidth: 1 },
  secondaryActionText: { fontWeight: '800', fontSize: 15 },
  extraActions: { flexDirection: 'row', justifyContent: 'space-around', marginVertical: 12 },
  textBtn: { padding: 8 },
  dismissBtn: { alignSelf: 'center', marginTop: 24, padding: 8 },
  statusRow: { flexDirection: 'row', marginBottom: 12 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
  costBox: { padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: 18 },
  costHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 },
  costTitle: { fontSize: 16, fontWeight: '800' },
  costRange: { fontSize: 12, fontWeight: '700' },
  costDerivation: { fontSize: 11, marginTop: 2 },
  menuSection: { marginBottom: 20 },
  sectionTitle: { fontSize: 17, fontWeight: '800', marginBottom: 12 },
  menuList: { gap: 8 },
  menuItemCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderRadius: 12, borderWidth: 1 },
  menuItemName: { fontSize: 14, fontWeight: '700' },
  menuItemDesc: { fontSize: 11, marginTop: 2 },
  menuItemPrice: { fontSize: 15, fontWeight: '800' },
  badgePill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1 },
  emptyMenuBox: { padding: 16, borderRadius: 12, borderWidth: 1, alignItems: 'center' },
  emptyMenuTitle: { fontSize: 14, fontWeight: '700', marginBottom: 4 },
  emptyMenuSub: { fontSize: 12, textAlign: 'center', lineHeight: 16 },
  sourceCard: { padding: 12, borderRadius: 12, borderWidth: 1, marginTop: 10 },
  sourceLabel: { fontSize: 12 },
  sourceLink: { fontSize: 12, fontWeight: '700', textDecorationLine: 'underline', marginVertical: 3 },
  lastChecked: { fontSize: 10 }
});
