import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { mobileStorage } from '../../services/storage.js';

export default function FavoritesScreen({ navigation, theme }) {
  const [favorites, setFavorites] = useState([]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadFavorites();
    });
    loadFavorites();
    return unsubscribe;
  }, [navigation]);

  const loadFavorites = async () => {
    const list = await mobileStorage.getFavorites();
    setFavorites(list);
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
      onPress={() => navigation.navigate('RestaurantDetail', { restaurant: item })}
      accessibilityRole="button"
      accessibilityLabel={`View details for ${item.displayName}`}
      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
    >
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.name, { color: theme.colors.text }]}>{item.displayName}</Text>
          <Text style={[styles.sub, { color: theme.colors.textMuted }]}>
            {item.cuisine} • ⭐ {item.rating} • {'৳'.repeat(item.priceLevel || 2)}
          </Text>
          <Text style={[styles.address, { color: theme.colors.textSubtle }]}>{item.formattedAddress}</Text>
        </View>
        <Text style={{ fontSize: 22 }}>❤️</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <FlatList
        data={favorites}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={{ fontSize: 40, marginBottom: 12 }}>🤍</Text>
            <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>No Favorites Saved Yet</Text>
            <Text style={{ color: theme.colors.textMuted, textAlign: 'center' }}>
              Tap the heart icon on any restaurant to save it here for quick access.
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: 16, gap: 12 },
  card: { padding: 16, borderRadius: 16, borderWidth: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
  name: { fontSize: 16, fontWeight: '800' },
  sub: { fontSize: 13, marginTop: 2 },
  address: { fontSize: 12, marginTop: 4 },
  empty: { padding: 48, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 18, fontWeight: '800', marginBottom: 6 }
});
