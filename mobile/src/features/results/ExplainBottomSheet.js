import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView } from 'react-native';

export default function ExplainBottomSheet({ visible, onClose, restaurant, theme }) {
  if (!restaurant) return null;
  const b = restaurant.factorBreakdown || {};

  // Brand rule: Explain-this-recommendation bars: primary fill on a primaryTint track.
  const renderBar = (label, val) => (
    <View style={styles.barItem} key={label}>
      <View style={styles.barHeader}>
        <Text style={[styles.barLabel, { color: theme.colors.textMuted }]}>{label}</Text>
        <Text style={[styles.barVal, { color: theme.colors.text }]}>{val || 50}%</Text>
      </View>
      <View style={[styles.barTrack, { backgroundColor: theme.colors.primaryTint }]}>
        <View style={[styles.barFill, { width: `${val || 50}%`, backgroundColor: theme.colors.primary }]} />
      </View>
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={[styles.backdrop, { backgroundColor: theme.colors.scrim }]}>
        <View style={[styles.sheet, { backgroundColor: theme.colors.card }]}>
          <View style={styles.header}>
            <View>
              <Text style={[styles.title, { color: theme.colors.text }]}>Recommendation Factors</Text>
              <Text style={[styles.sub, { color: theme.colors.primary }]}>{restaurant.displayName}</Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              accessibilityRole="button"
              accessibilityLabel="Close recommendation factors"
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Text style={{ fontSize: 20, color: theme.colors.textMuted }}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body}>
            <Text style={[styles.reason, { color: theme.colors.textMuted }]}>{restaurant.reason}</Text>

            <View style={styles.barsContainer}>
              {renderBar('Taste Match', b.taste)}
              {renderBar('Travel Time (Traffic Aware)', b.time)}
              {renderBar('Traffic Smoothness', b.traffic)}
              {renderBar('User Rating', b.rating)}
              {renderBar('Restaurant Price Level', b.price)}
              {renderBar('Transport Transit Cost', b.cost)}
              {renderBar('Proximity Distance', b.distance)}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '80%', padding: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 18, fontWeight: '800' },
  sub: { fontSize: 14, fontWeight: '700', marginTop: 2 },
  closeBtn: { padding: 8 },
  body: { marginVertical: 8 },
  reason: { fontSize: 13, lineHeight: 18, marginBottom: 16 },
  barsContainer: { gap: 14, paddingBottom: 24 },
  barItem: { marginBottom: 10 },
  barHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  barLabel: { fontSize: 12, fontWeight: '600' },
  barVal: { fontSize: 12, fontWeight: '800' },
  barTrack: { height: 8, borderRadius: 9999, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 9999 }
});
