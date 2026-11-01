import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity, Linking, FlatList } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { getCurrentOrFallbackLocation } from '../../services/location.js';
import { apiClient } from '../../api/client.js';
import { localEngine } from '../../services/localEngine.js';
import { darkMapStyle } from '../../config/mapStyleDark.js';
import { checkGoogleMapsKeyConfigured } from '../../services/mapsConfig.js';

const { width, height } = Dimensions.get('window');

export default function MapTabScreen({ navigation, theme }) {
  const mapRef = useRef(null);
  const [location, setLocation] = useState({ lat: 23.7925, lng: 90.4150, name: 'Gulshan' });
  const [restaurants, setRestaurants] = useState([]);
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [statusBanner, setStatusBanner] = useState(null);

  const hasMapKey = checkGoogleMapsKeyConfigured();

  useEffect(() => {
    loadMapData();
  }, []);

  const loadMapData = async () => {
    const loc = await getCurrentOrFallbackLocation();
    setLocation(loc);

    if (loc.permissionDenied) {
      setStatusBanner('GPS permission denied. Viewing Dhaka preset location.');
    } else if (loc.servicesDisabled) {
      setStatusBanner('Device location services off. Viewing Dhaka preset location.');
    } else {
      setStatusBanner(null);
    }

    try {
      const data = await apiClient.getRecommendations({
        lat: loc.lat,
        lng: loc.lng,
        cuisine: 'All',
        priority: 'Best Overall'
      });
      const results = data.results || [];
      if (results.length > 0) {
        setRestaurants(results);
        setSelectedPlace(results[0]);
        return;
      }
    } catch (e) {
      console.warn('Map data network load error, falling back to localEngine:', e);
    }

    // Reliable offline / fallback recommendation engine
    try {
      const localData = await localEngine.getLocalRecommendations({
        lat: loc.lat,
        lng: loc.lng,
        cuisine: 'All',
        priority: 'Best Overall'
      });
      const localResults = localData.results || [];
      setRestaurants(localResults);
      if (localResults.length > 0) {
        setSelectedPlace(localResults[0]);
      }
    } catch (localErr) {
      console.warn('Local engine error on map tab:', localErr);
    }
  };

  const handleRecenter = () => {
    if (mapRef.current && location) {
      mapRef.current.animateToRegion({
        latitude: location.lat,
        longitude: location.lng,
        latitudeDelta: 0.03,
        longitudeDelta: 0.03
      }, 500);
    }
  };

  const openNavigationDirections = (restaurant) => {
    if (!restaurant?.location) return;
    const origin = `${location.lat},${location.lng}`;
    const destination = `${restaurant.location.latitude},${restaurant.location.longitude}`;
    const url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}`;
    Linking.openURL(url).catch(err => console.warn('Could not open maps navigation:', err));
  };

  // If no Google Maps Android key is configured, show accessible list view instead of blank map
  if (!hasMapKey) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={[styles.fallbackBanner, { backgroundColor: theme.colors.surfaceAlt, borderColor: theme.colors.border }]}>
          <Text style={[styles.fallbackBannerTitle, { color: theme.colors.text }]}>
            🗺️ Nearby Restaurants (List View)
          </Text>
          <Text style={[styles.fallbackBannerDesc, { color: theme.colors.textMuted }]}>
            Interactive Google Maps view requires a configured maps key. Showing live ranked spots by proximity.
          </Text>
        </View>

        {statusBanner && (
          <View style={[styles.statusBannerInline, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <Text style={[styles.statusBannerText, { color: theme.colors.textMuted }]}>
              ℹ️ {statusBanner}
            </Text>
          </View>
        )}

        <FlatList
          data={restaurants}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          renderItem={({ item, index }) => (
            <View style={[styles.fallbackCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, shadowColor: theme.colors.scrim }]}>
              <View style={styles.calloutHeader}>
                <Text style={[styles.calloutTitle, { color: theme.colors.text }]} numberOfLines={1}>
                  {index + 1}. {item.displayName}
                </Text>
                <Text style={[styles.calloutRating, { color: theme.colors.primary }]}>
                  {item.rating}★ ({item.userRatingCount || 100}+)
                </Text>
              </View>
              <Text style={[styles.calloutReason, { color: theme.colors.textMuted }]} numberOfLines={2}>
                {item.cuisine} • 🚗 {Math.round(item.durationSeconds / 60)} min • ৳{item.estimatedCostPerPersonBdt || item.menu?.estimatedCostPerPerson?.amount || 500}/person
              </Text>
              <View style={styles.calloutActions}>
                <TouchableOpacity
                  style={[styles.directionsBtn, { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceAlt }]}
                  onPress={() => openNavigationDirections(item)}
                  accessibilityLabel={`Get directions to ${item.displayName}`}
                >
                  <Text style={[styles.directionsBtnText, { color: theme.colors.text }]}>🧭 Directions</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.calloutBtn, { backgroundColor: theme.colors.primary }]}
                  onPress={() => navigation?.navigate('RestaurantDetail', { restaurant: item, location })}
                  accessibilityLabel={`View details for ${item.displayName}`}
                >
                  <Text style={[styles.calloutBtnText, { color: theme.colors.onPrimary }]}>View Details →</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <MapView
        ref={mapRef}
        style={styles.map}
        customMapStyle={theme.isDark ? darkMapStyle : []}
        initialRegion={{
          latitude: location.lat,
          longitude: location.lng,
          latitudeDelta: 0.04,
          longitudeDelta: 0.04
        }}
      >
        {/* User Location Marker: Primary dot */}
        <Marker
          coordinate={{ latitude: location.lat, longitude: location.lng }}
          title="You are here"
          description={location.name || 'Current Spot'}
          pinColor={theme.colors.primary}
        />

        {/* Restaurant Markers: Primary numbered pins, selected is saffron */}
        {restaurants.map((r, idx) => (
          <Marker
            key={r.id}
            coordinate={{
              latitude: r.location.latitude,
              longitude: r.location.longitude
            }}
            title={`${idx + 1}. ${r.displayName}`}
            description={`${r.rating}★ • ${Math.round(r.durationSeconds / 60)} min`}
            onPress={() => setSelectedPlace(r)}
            pinColor={selectedPlace?.id === r.id ? theme.colors.accent : theme.colors.primary}
          />
        ))}
      </MapView>

      {/* Non-blocking GPS Status Banner if needed */}
      {statusBanner && (
        <View style={[styles.statusBanner, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <Text style={[styles.statusBannerText, { color: theme.colors.textMuted }]}>
            ℹ️ {statusBanner}
          </Text>
        </View>
      )}

      {/* Floating Recenter GPS Button */}
      <TouchableOpacity
        style={[styles.recenterBtn, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, shadowColor: theme.colors.scrim }]}
        onPress={handleRecenter}
        accessibilityLabel="Recenter map to my location"
      >
        <Text style={{ fontSize: 18 }}>📍</Text>
      </TouchableOpacity>

      {/* Selected Card Popup at Bottom */}
      {selectedPlace && (
        <View style={[styles.calloutCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, shadowColor: theme.colors.scrim }]}>
          <View style={styles.calloutHeader}>
            <Text style={[styles.calloutTitle, { color: theme.colors.text }]} numberOfLines={1}>
              {selectedPlace.displayName}
            </Text>
            <Text style={[styles.calloutRating, { color: theme.colors.primary }]}>
              {selectedPlace.rating}★ ({selectedPlace.userRatingCount || 100}+)
            </Text>
          </View>
          <Text style={[styles.calloutReason, { color: theme.colors.textMuted }]} numberOfLines={2}>
            {selectedPlace.cuisine} • 🚗 {Math.round(selectedPlace.durationSeconds / 60)} min • ৳{selectedPlace.estimatedCostPerPersonBdt || selectedPlace.menu?.estimatedCostPerPerson?.amount || 500}/person
          </Text>
          <View style={styles.calloutActions}>
            <TouchableOpacity
              style={[styles.directionsBtn, { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceAlt }]}
              onPress={() => openNavigationDirections(selectedPlace)}
              accessibilityLabel={`Get directions to ${selectedPlace.displayName}`}
            >
              <Text style={[styles.directionsBtnText, { color: theme.colors.text }]}>🧭 Directions</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.calloutBtn, { backgroundColor: theme.colors.primary }]}
              onPress={() => navigation?.navigate('RestaurantDetail', { restaurant: selectedPlace, location })}
              accessibilityLabel={`View details for ${selectedPlace.displayName}`}
            >
              <Text style={[styles.calloutBtnText, { color: theme.colors.onPrimary }]}>View Details →</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { width, height },
  fallbackBanner: {
    margin: 16,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1
  },
  fallbackBannerTitle: { fontSize: 15, fontWeight: '700', marginBottom: 4 },
  fallbackBannerDesc: { fontSize: 12, lineHeight: 16 },
  statusBannerInline: {
    marginHorizontal: 16,
    marginBottom: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1
  },
  statusBanner: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    elevation: 4
  },
  statusBannerText: { fontSize: 12, fontWeight: '600', textAlign: 'center' },
  recenterBtn: {
    position: 'absolute',
    top: 70,
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4
  },
  calloutCard: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    elevation: 8,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8
  },
  fallbackCard: {
    marginBottom: 12,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    elevation: 2,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4
  },
  calloutHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  calloutTitle: { fontSize: 16, fontWeight: '800', flex: 1 },
  calloutRating: { fontSize: 14, fontWeight: '800' },
  calloutReason: { fontSize: 12, lineHeight: 16, marginBottom: 12 },
  calloutActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  directionsBtn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1 },
  directionsBtnText: { fontWeight: '700', fontSize: 12 },
  calloutBtn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 10 },
  calloutBtnText: { fontWeight: '800', fontSize: 13 }
});
