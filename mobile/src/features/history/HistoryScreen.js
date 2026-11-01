import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { mobileStorage } from '../../services/storage.js';

export default function HistoryScreen({ navigation, theme }) {
  const [history, setHistory] = useState([]);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    const list = await mobileStorage.getHistory();
    setHistory(list);
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
      onPress={() => {
        navigation.navigate('Home', { rerunSearch: item });
      }}
      accessibilityRole="button"
      accessibilityLabel={`Re-run search for ${item.cuisine || 'All'} near ${item.locationName}`}
      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
    >
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: theme.colors.text }]}>
            {item.cuisine || 'All'} ({item.priority})
          </Text>
          <Text style={[styles.sub, { color: theme.colors.textMuted }]}>
            📍 Near {item.locationName} • {'৳'.repeat(item.budget || 2)}
          </Text>
          <Text style={[styles.time, { color: theme.colors.textSubtle }]}>
            {new Date(item.timestamp).toLocaleString()}
          </Text>
        </View>
        <Text style={{ fontSize: 13, fontWeight: '700', color: theme.colors.primary }}>Re-run ➔</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <FlatList
        data={history}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={{ color: theme.colors.textMuted }}>No search history recorded yet.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: 16, gap: 10 },
  card: { padding: 14, borderRadius: 14, borderWidth: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
  title: { fontSize: 15, fontWeight: '700' },
  sub: { fontSize: 13, marginTop: 2 },
  time: { fontSize: 11, marginTop: 4 },
  empty: { padding: 40, alignItems: 'center' }
});
