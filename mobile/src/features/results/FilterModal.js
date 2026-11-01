import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  SafeAreaView
} from 'react-native';

const CUISINES = [
  'Biriyani',
  'Kabab',
  'Cafe',
  'Coffee',
  'Burger',
  'Japanese',
  'Bangladeshi',
  'Indian',
  'Chinese',
  'Fast Food',
  'Dessert'
];

const RESTAURANT_TYPES = [
  'Dine-in',
  'Casual Dining',
  'Fine Dining',
  'Cafe / Bakery',
  'Fast Food / Takeaway',
  'Buffet'
];

const DIETARY_OPTIONS = [
  { id: 'halal', label: 'Halal' },
  { id: 'vegetarian', label: 'Vegetarian Options' },
  { id: 'vegan', label: 'Vegan Options' },
  { id: 'no_beef', label: 'No Beef' }
];

const FEATURES_OPTIONS = [
  'Air Conditioned (AC)',
  'Free WiFi',
  'Parking Available',
  'Outdoor / Rooftop Seating',
  'Card / bKash Payment',
  'Family Friendly'
];

const AVAILABILITY_OPTIONS = [
  { id: 'open_now', label: 'Open Now' },
  { id: 'closing_soon', label: 'Closing Soon (within 60m)' },
  { id: 'open_late', label: 'Open Late (past 11:30 PM)' }
];

export default function FilterModal({
  visible,
  onClose,
  filters,
  onApplyFilters,
  onResetFilters,
  theme,
  matchCount = 0
}) {
  const [localFilters, setLocalFilters] = useState(filters);
  const [minText, setMinText] = useState(String(filters.priceMin || 0));
  const [maxText, setMaxText] = useState(String(filters.priceMax || 5000));

  const [collapsed, setCollapsed] = useState({
    availability: false,
    cuisine: false,
    restaurantType: false,
    dietary: false,
    features: false
  });

  // Keep in sync when modal opens
  React.useEffect(() => {
    if (visible) {
      setLocalFilters(filters);
      setMinText(String(filters.priceMin || 0));
      setMaxText(String(filters.priceMax || 5000));
    }
  }, [visible, filters]);

  const toggleSection = (sectionKey) => {
    setCollapsed(prev => ({ ...prev, [sectionKey]: !prev[sectionKey] }));
  };

  const toggleArrayFilter = (group, value) => {
    setLocalFilters(prev => {
      const currentList = prev[group] || [];
      const exists = currentList.includes(value);
      const updated = exists
        ? currentList.filter(item => item !== value)
        : [...currentList, value];
      return { ...prev, [group]: updated };
    });
  };

  const applyPreset = (min, max) => {
    setMinText(String(min));
    setMaxText(String(max));
    setLocalFilters(prev => ({
      ...prev,
      priceMin: min,
      priceMax: max
    }));
  };

  const adjustPrice = (type, delta) => {
    if (type === 'min') {
      const current = parseInt(minText, 10) || 0;
      const next = Math.max(0, current + delta);
      setMinText(String(next));
      setLocalFilters(prev => ({ ...prev, priceMin: next }));
    } else {
      const current = parseInt(maxText, 10) || 5000;
      const next = Math.max(100, Math.min(5000, current + delta));
      setMaxText(String(next));
      setLocalFilters(prev => ({ ...prev, priceMax: next }));
    }
  };

  const handleMinChange = (text) => {
    setMinText(text);
    const val = parseInt(text, 10);
    if (!isNaN(val) && val >= 0) {
      setLocalFilters(prev => ({ ...prev, priceMin: val }));
    }
  };

  const handleMaxChange = (text) => {
    setMaxText(text);
    const val = parseInt(text, 10);
    if (!isNaN(val) && val >= 0) {
      setLocalFilters(prev => ({ ...prev, priceMax: val }));
    }
  };

  const handleApply = () => {
    const finalMin = parseInt(minText, 10) || 0;
    const finalMax = parseInt(maxText, 10) || 5000;
    onApplyFilters({
      ...localFilters,
      priceMin: finalMin,
      priceMax: Math.max(finalMin, finalMax)
    });
    onClose();
  };

  const handleReset = () => {
    setMinText('0');
    setMaxText('5000');
    const emptyFilters = {
      priceMin: 0,
      priceMax: 5000,
      availability: [],
      cuisines: [],
      restaurantTypes: [],
      dietary: [],
      features: []
    };
    setLocalFilters(emptyFilters);
    onResetFilters();
  };

  const isPresetActive = (min, max) => {
    return localFilters.priceMin === min && localFilters.priceMax === max;
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        {/* Top Header */}
        <View style={[styles.header, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <View style={styles.headerTitleWrap}>
            <Text style={{ fontSize: 18 }}>⚙️</Text>
            <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
              Price Range & Filters
            </Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={handleReset} style={styles.resetBtn} accessibilityRole="button" accessibilityLabel="Reset all filters">
              <Text style={[styles.resetText, { color: theme.colors.danger }]}>🔄 Reset</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: theme.colors.surfaceAlt }]} accessibilityRole="button" accessibilityLabel="Close filters modal" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={[styles.closeText, { color: theme.colors.text }]}>✕</Text>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={true}
        >
          {/* Section 1: Price Range */}
          <View style={[styles.sectionBox, { borderColor: theme.colors.border }]}>
            <Text style={[styles.sectionHeading, { color: theme.colors.text }]}>
              Price Range (BDT)
            </Text>
            <Text style={[styles.sectionSub, { color: theme.colors.textMuted }]}>
              Filters by verified item prices on menu & estimated cost
            </Text>

            {/* Quick Presets matching 4 Budget Tiers */}
            <View style={styles.presetRow}>
              <TouchableOpacity
                style={[
                  styles.presetChip,
                  { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceAlt },
                  isPresetActive(0, 400) && { borderColor: theme.colors.primary, backgroundColor: theme.colors.primaryTint }
                ]}
                onPress={() => applyPreset(0, 400)}
               accessibilityRole="button" accessibilityLabel="Reset options">
                <Text
                  style={[
                    styles.presetChipText,
                    { color: theme.colors.text },
                    isPresetActive(0, 400) && { color: theme.colors.primary, fontWeight: '800' }
                  ]}
                >
                  ৳ ≤400
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.presetChip,
                  { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceAlt },
                  isPresetActive(400, 1000) && { borderColor: theme.colors.primary, backgroundColor: theme.colors.primaryTint }
                ]}
                onPress={() => applyPreset(400, 1000)}
               accessibilityRole="button" accessibilityLabel="Reset options">
                <Text
                  style={[
                    styles.presetChipText,
                    { color: theme.colors.text },
                    isPresetActive(400, 1000) && { color: theme.colors.primary, fontWeight: '800' }
                  ]}
                >
                  ৳৳ 400–1k
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.presetChip,
                  { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceAlt },
                  isPresetActive(1000, 2000) && { borderColor: theme.colors.primary, backgroundColor: theme.colors.primaryTint }
                ]}
                onPress={() => applyPreset(1000, 2000)}
               accessibilityRole="button" accessibilityLabel="Reset options">
                <Text
                  style={[
                    styles.presetChipText,
                    { color: theme.colors.text },
                    isPresetActive(1000, 2000) && { color: theme.colors.primary, fontWeight: '800' }
                  ]}
                >
                  ৳৳৳ 1k–2k
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.presetChip,
                  { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceAlt },
                  isPresetActive(2000, 5000) && { borderColor: theme.colors.primary, backgroundColor: theme.colors.primaryTint }
                ]}
                onPress={() => applyPreset(2000, 5000)}
               accessibilityRole="button" accessibilityLabel="Reset options">
                <Text
                  style={[
                    styles.presetChipText,
                    { color: theme.colors.text },
                    isPresetActive(2000, 5000) && { color: theme.colors.primary, fontWeight: '800' }
                  ]}
                >
                  ৳৳৳৳ 2k+
                </Text>
              </TouchableOpacity>
            </View>

            {/* Min / Max Inputs Row */}
            <View style={styles.inputsRow}>
              {/* Min Input Box */}
              <View style={styles.inputCol}>
                <Text style={[styles.inputLabel, { color: theme.colors.textMuted }]}>MIN PRICE</Text>
                <View style={[styles.inputWrapper, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                  <Text style={[styles.currencyPrefix, { color: theme.colors.textMuted }]}>৳</Text>
                  <TextInput
                    style={[styles.numericInput, { color: theme.colors.text }]}
                    keyboardType="numeric"
                    value={minText}
                    onChangeText={handleMinChange}
                    placeholder="0"
                    placeholderTextColor={theme.colors.textMuted}
                  />
                </View>
                <View style={styles.stepperRow}>
                  <TouchableOpacity
                    style={[styles.stepBtn, { backgroundColor: theme.colors.surfaceAlt }]}
                    onPress={() => adjustPrice('min', -50)}
                   accessibilityRole="button" accessibilityLabel="Adjust value">
                    <Text style={[styles.stepBtnText, { color: theme.colors.text }]}>-50</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.stepBtn, { backgroundColor: theme.colors.surfaceAlt }]}
                    onPress={() => adjustPrice('min', 50)}
                   accessibilityRole="button" accessibilityLabel="Adjust value">
                    <Text style={[styles.stepBtnText, { color: theme.colors.text }]}>+50</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <Text style={[styles.rangeDash, { color: theme.colors.textMuted }]}>–</Text>

              {/* Max Input Box */}
              <View style={styles.inputCol}>
                <Text style={[styles.inputLabel, { color: theme.colors.textMuted }]}>MAX PRICE</Text>
                <View style={[styles.inputWrapper, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                  <Text style={[styles.currencyPrefix, { color: theme.colors.textMuted }]}>৳</Text>
                  <TextInput
                    style={[styles.numericInput, { color: theme.colors.text }]}
                    keyboardType="numeric"
                    value={maxText}
                    onChangeText={handleMaxChange}
                    placeholder="3000"
                    placeholderTextColor={theme.colors.textMuted}
                  />
                </View>
                <View style={styles.stepperRow}>
                  <TouchableOpacity
                    style={[styles.stepBtn, { backgroundColor: theme.colors.surfaceAlt }]}
                    onPress={() => adjustPrice('max', -100)}
                   accessibilityRole="button" accessibilityLabel="Adjust value">
                    <Text style={[styles.stepBtnText, { color: theme.colors.text }]}>-100</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.stepBtn, { backgroundColor: theme.colors.surfaceAlt }]}
                    onPress={() => adjustPrice('max', 100)}
                   accessibilityRole="button" accessibilityLabel="Adjust value">
                    <Text style={[styles.stepBtnText, { color: theme.colors.text }]}>+100</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>

          {/* Section 2: Availability (Collapsible) */}
          <View style={[styles.sectionBox, { borderColor: theme.colors.border }]}>
            <TouchableOpacity
              style={styles.collapsibleHeader}
              onPress={() => toggleSection('availability')}
              activeOpacity={0.7}
             accessibilityRole="checkbox" accessibilityLabel="Toggle section">
              <Text style={[styles.sectionHeading, { color: theme.colors.text }]}>Availability</Text>
              <Text style={[styles.chevron, { color: theme.colors.textMuted }]}>
                {collapsed.availability ? '▼' : '▲'}
              </Text>
            </TouchableOpacity>

            {!collapsed.availability && (
              <View style={styles.checkboxList}>
                {AVAILABILITY_OPTIONS.map(opt => {
                  const isChecked = (localFilters.availability || []).includes(opt.id);
                  return (
                    <TouchableOpacity
                      key={opt.id}
                      style={styles.checkboxRow}
                      onPress={() => toggleArrayFilter('availability', opt.id)}
                      activeOpacity={0.7}
                     accessibilityRole="checkbox" accessibilityLabel={`Option ${opt.label}`}>
                      <View
                        style={[
                          styles.checkboxSquare,
                          {
                            borderColor: isChecked ? theme.colors.primary : theme.colors.border,
                            backgroundColor: isChecked ? theme.colors.primary : 'transparent'
                          }
                        ]}
                      >
                        {isChecked && (
                          <Text style={[styles.checkMark, { color: theme.colors.onPrimary }]}>✓</Text>
                        )}
                      </View>
                      <Text style={[styles.checkboxLabel, { color: theme.colors.text }]}>{opt.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>

          {/* Section 3: Cuisine (Collapsible, Scrollable) */}
          <View style={[styles.sectionBox, { borderColor: theme.colors.border }]}>
            <TouchableOpacity
              style={styles.collapsibleHeader}
              onPress={() => toggleSection('cuisine')}
              activeOpacity={0.7}
             accessibilityRole="checkbox" accessibilityLabel="Toggle section">
              <Text style={[styles.sectionHeading, { color: theme.colors.text }]}>Cuisine</Text>
              <Text style={[styles.chevron, { color: theme.colors.textMuted }]}>
                {collapsed.cuisine ? '▼' : '▲'}
              </Text>
            </TouchableOpacity>

            {!collapsed.cuisine && (
              <View style={styles.checkboxList}>
                {CUISINES.map(c => {
                  const isChecked = (localFilters.cuisines || []).includes(c);
                  return (
                    <TouchableOpacity
                      key={c}
                      style={styles.checkboxRow}
                      onPress={() => toggleArrayFilter('cuisines', c)}
                      activeOpacity={0.7}
                     accessibilityRole="checkbox" accessibilityLabel={`Cuisine ${c}`}>
                      <View
                        style={[
                          styles.checkboxSquare,
                          {
                            borderColor: isChecked ? theme.colors.primary : theme.colors.border,
                            backgroundColor: isChecked ? theme.colors.primary : 'transparent'
                          }
                        ]}
                      >
                        {isChecked && (
                          <Text style={[styles.checkMark, { color: theme.colors.onPrimary }]}>✓</Text>
                        )}
                      </View>
                      <Text style={[styles.checkboxLabel, { color: theme.colors.text }]}>{c}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>

          {/* Section 4: Restaurant Type (Collapsible) */}
          <View style={[styles.sectionBox, { borderColor: theme.colors.border }]}>
            <TouchableOpacity
              style={styles.collapsibleHeader}
              onPress={() => toggleSection('restaurantType')}
              activeOpacity={0.7}
             accessibilityRole="checkbox" accessibilityLabel="Toggle section">
              <Text style={[styles.sectionHeading, { color: theme.colors.text }]}>Restaurant Type</Text>
              <Text style={[styles.chevron, { color: theme.colors.textMuted }]}>
                {collapsed.restaurantType ? '▼' : '▲'}
              </Text>
            </TouchableOpacity>

            {!collapsed.restaurantType && (
              <View style={styles.checkboxList}>
                {RESTAURANT_TYPES.map(rt => {
                  const isChecked = (localFilters.restaurantTypes || []).includes(rt);
                  return (
                    <TouchableOpacity
                      key={rt}
                      style={styles.checkboxRow}
                      onPress={() => toggleArrayFilter('restaurantTypes', rt)}
                      activeOpacity={0.7}
                     accessibilityRole="checkbox" accessibilityLabel={`Restaurant type ${rt}`}>
                      <View
                        style={[
                          styles.checkboxSquare,
                          {
                            borderColor: isChecked ? theme.colors.primary : theme.colors.border,
                            backgroundColor: isChecked ? theme.colors.primary : 'transparent'
                          }
                        ]}
                      >
                        {isChecked && (
                          <Text style={[styles.checkMark, { color: theme.colors.onPrimary }]}>✓</Text>
                        )}
                      </View>
                      <Text style={[styles.checkboxLabel, { color: theme.colors.text }]}>{rt}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>

          {/* Section 5: Dietary Preferences (Collapsible) */}
          <View style={[styles.sectionBox, { borderColor: theme.colors.border }]}>
            <TouchableOpacity
              style={styles.collapsibleHeader}
              onPress={() => toggleSection('dietary')}
              activeOpacity={0.7}
             accessibilityRole="checkbox" accessibilityLabel="Toggle section">
              <Text style={[styles.sectionHeading, { color: theme.colors.text }]}>Dietary Preferences</Text>
              <Text style={[styles.chevron, { color: theme.colors.textMuted }]}>
                {collapsed.dietary ? '▼' : '▲'}
              </Text>
            </TouchableOpacity>

            {!collapsed.dietary && (
              <View style={styles.checkboxList}>
                {DIETARY_OPTIONS.map(d => {
                  const isChecked = (localFilters.dietary || []).includes(d.id);
                  return (
                    <TouchableOpacity
                      key={d.id}
                      style={styles.checkboxRow}
                      onPress={() => toggleArrayFilter('dietary', d.id)}
                      activeOpacity={0.7}
                     accessibilityRole="checkbox" accessibilityLabel={`Dish type ${d.label}`}>
                      <View
                        style={[
                          styles.checkboxSquare,
                          {
                            borderColor: isChecked ? theme.colors.primary : theme.colors.border,
                            backgroundColor: isChecked ? theme.colors.primary : 'transparent'
                          }
                        ]}
                      >
                        {isChecked && (
                          <Text style={[styles.checkMark, { color: theme.colors.onPrimary }]}>✓</Text>
                        )}
                      </View>
                      <Text style={[styles.checkboxLabel, { color: theme.colors.text }]}>{d.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>

          {/* Section 6: Features & Amenities (Collapsible) */}
          <View style={[styles.sectionBox, { borderColor: theme.colors.border, borderBottomWidth: 0 }]}>
            <TouchableOpacity
              style={styles.collapsibleHeader}
              onPress={() => toggleSection('features')}
              activeOpacity={0.7}
             accessibilityRole="checkbox" accessibilityLabel="Toggle section">
              <Text style={[styles.sectionHeading, { color: theme.colors.text }]}>Features & Amenities</Text>
              <Text style={[styles.chevron, { color: theme.colors.textMuted }]}>
                {collapsed.features ? '▼' : '▲'}
              </Text>
            </TouchableOpacity>

            {!collapsed.features && (
              <View style={styles.checkboxList}>
                {FEATURES_OPTIONS.map(f => {
                  const isChecked = (localFilters.features || []).includes(f);
                  return (
                    <TouchableOpacity
                      key={f}
                      style={styles.checkboxRow}
                      onPress={() => toggleArrayFilter('features', f)}
                      activeOpacity={0.7}
                     accessibilityRole="checkbox" accessibilityLabel={`Feature ${f}`}>
                      <View
                        style={[
                          styles.checkboxSquare,
                          {
                            borderColor: isChecked ? theme.colors.primary : theme.colors.border,
                            backgroundColor: isChecked ? theme.colors.primary : 'transparent'
                          }
                        ]}
                      >
                        {isChecked && (
                          <Text style={[styles.checkMark, { color: theme.colors.onPrimary }]}>✓</Text>
                        )}
                      </View>
                      <Text style={[styles.checkboxLabel, { color: theme.colors.text }]}>{f}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        </ScrollView>

        {/* Bottom CTA Bar */}
        <View style={[styles.bottomBar, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <TouchableOpacity
            style={[styles.applyBtn, { backgroundColor: theme.colors.primary }]}
            onPress={handleApply}
            accessibilityRole="button"
            accessibilityLabel="Apply filters to recommendations"
            activeOpacity={0.85}
          >
            <Text style={[styles.applyBtnText, { color: theme.colors.onPrimary }]}>
              Show Matches
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1
  },
  headerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800'
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  resetBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8
  },
  resetText: {
    fontSize: 13,
    fontWeight: '700'
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center'
  },
  closeText: {
    fontSize: 13,
    fontWeight: '800'
  },
  scrollArea: {
    flex: 1
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 12
  },
  sectionBox: {
    paddingVertical: 12,
    borderBottomWidth: 1
  },
  sectionHeading: {
    fontSize: 14,
    fontWeight: '800'
  },
  sectionSub: {
    fontSize: 11,
    marginTop: 2,
    marginBottom: 8
  },
  collapsibleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4
  },
  chevron: {
    fontSize: 12,
    fontWeight: '700'
  },
  presetRow: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 8
  },
  presetChip: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  presetChipText: {
    fontSize: 12,
    fontWeight: '600'
  },
  inputsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8
  },
  inputCol: {
    flex: 1
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 4,
    letterSpacing: 0.5
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    height: 38
  },
  currencyPrefix: {
    fontSize: 13,
    fontWeight: '700',
    marginRight: 4
  },
  numericInput: {
    flex: 1,
    height: 38,
    fontSize: 13,
    fontWeight: '700',
    padding: 0
  },
  stepperRow: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 4
  },
  stepBtn: {
    flex: 1,
    paddingVertical: 3,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center'
  },
  stepBtnText: {
    fontSize: 11,
    fontWeight: '700'
  },
  rangeDash: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 14
  },
  checkboxList: {
    marginTop: 8,
    gap: 6
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4
  },
  checkboxSquare: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center'
  },
  checkMark: {
    fontSize: 11,
    fontWeight: '900',
    lineHeight: 13
  },
  checkboxLabel: {
    fontSize: 13,
    fontWeight: '600'
  },
  bottomBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1
  },
  applyBtn: {
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center'
  },
  applyBtnText: {
    fontSize: 14,
    fontWeight: '800'
  }
});
