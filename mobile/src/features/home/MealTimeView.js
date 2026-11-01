import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
  Linking
} from 'react-native';
import { apiClient } from '../../api/client.js';
import { mobileStorage } from '../../services/storage.js';
import { getLocalMealTime } from '../../services/localEngine.js';
import { t } from '../../i18n/index.js';

const MODES = [
  { key: 'breakfast', labelKey: 'mealTime.modes.breakfast', defaultTime: 30, icon: '🥐' },
  { key: 'lunch', labelKey: 'mealTime.modes.lunch', defaultTime: 45, icon: '🍛' },
  { key: 'snacks', labelKey: 'mealTime.modes.snacks', defaultTime: 30, icon: '☕' },
  { key: 'dinner', labelKey: 'mealTime.modes.dinner', defaultTime: 90, icon: '🍲' }
];

const TIME_PRESETS = [15, 30, 45, 60, 90];

const TRANSPORTS = [
  { key: 'car', label: 'Car', icon: '🚗' },
  { key: 'walk', label: 'Walk', icon: '🚶' },
  { key: 'rickshaw', label: 'Rickshaw', icon: '🛺' },
  { key: 'cng', label: 'CNG Auto', icon: '🟢' },
  { key: 'ride-share', label: 'Ride-Share', icon: '🚖' },
  { key: 'motorcycle', label: 'Motorcycle', icon: '🏍️' },
  { key: 'bicycle', label: 'Bicycle', icon: '🚲' },
  { key: 'public_transport', label: 'Public Bus', icon: '🚌' }
];

const RETURN_DESTS = [
  { key: 'same-as-origin', labelKey: 'mealTime.sameAsStart', icon: '↩️' },
  { key: 'current', labelKey: 'mealTime.currentLocation', icon: '📍' },
  { key: 'office', labelKey: 'mealTime.office', icon: '🏢' },
  { key: 'home', labelKey: 'mealTime.home', icon: '🏠' },
  { key: 'university', labelKey: 'mealTime.university', icon: '🎓' },
  { key: 'custom', labelKey: 'mealTime.customPlace', icon: '📌' }
];

// Helper to determine initial mode from Asia/Dhaka time
function getDhakaHour() {
  try {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Dhaka',
      hour: 'numeric',
      minute: 'numeric',
      hour12: false
    });
    const parts = fmt.formatToParts(new Date());
    const hourPart = parts.find(p => p.type === 'hour')?.value;
    const minPart = parts.find(p => p.type === 'minute')?.value;
    return parseFloat(`${parseInt(hourPart, 10)}.${parseInt(minPart, 10)}`);
  } catch (e) {
    const now = new Date();
    return now.getHours() + now.getMinutes() / 60;
  }
}

function getDefaultModeFromTime() {
  const h = getDhakaHour();
  if (h < 10.5) return 'breakfast';
  if (h >= 11.5 && h < 15.0) return 'lunch';
  if (h >= 16.0 && h < 19.0) return 'snacks';
  return 'dinner';
}

export default function MealTimeView({ theme, location, navigation }) {
  const initialMode = getDefaultModeFromTime();
  const [selectedMode, setSelectedMode] = useState(initialMode);
  const [selectedTime, setSelectedTime] = useState(45);
  const [isCustomTime, setIsCustomTime] = useState(false);
  const [customMinutesInput, setCustomMinutesInput] = useState('45');
  const [returnDest, setReturnDest] = useState('same-as-origin');
  const [customDestName, setCustomDestName] = useState('');
  const [transport, setTransport] = useState('car');
  const [diningStyle, setDiningStyle] = useState('dine_in'); // dine_in | takeaway
  const [bufferPref, setBufferPref] = useState('Balanced'); // Balanced | Safe | Flexible
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [leaveAtTime, setLeaveAtTime] = useState('');

  // Results & UI State
  const [loading, setLoading] = useState(false);
  const [searchResponse, setSearchResponse] = useState(null);
  const [flexibleExpanded, setFlexibleExpanded] = useState(false);
  const [explainCandidate, setExplainCandidate] = useState(null);

  // Feedback State
  const [feedbackMins, setFeedbackMins] = useState('');
  const [feedbackLate, setFeedbackLate] = useState(false);
  const [feedbackSent, setFeedbackSent] = useState(false);

  // On mode change, set default time for mode
  const handleSelectMode = (modeKey) => {
    setSelectedMode(modeKey);
    const m = MODES.find(item => item.key === modeKey);
    if (m) {
      setSelectedTime(m.defaultTime);
      setIsCustomTime(false);
      setCustomMinutesInput(String(m.defaultTime));
    }
  };

  const handleSelectReturnDest = async (destKey) => {
    setReturnDest(destKey);
    if (['office', 'home', 'university'].includes(destKey)) {
      const saved = await mobileStorage.getSavedPlaces();
      if (!saved[destKey]) {
        const hasPrompted = await mobileStorage.hasPromptedForPlace(destKey);
        if (!hasPrompted) {
          await mobileStorage.setPromptedForPlace(destKey);
          Alert.alert(
            `Save ${destKey.toUpperCase()}`,
            `Would you like to save this device's current location (${location.name}) as your ${destKey.toUpperCase()}? (Saved strictly on device, never sent to analytics)`,
            [
              {
                text: 'Save Here',
                onPress: async () => {
                  await mobileStorage.saveSavedPlace(destKey, {
                    name: `${location.name} (${destKey})`,
                    lat: location.lat,
                    lng: location.lng
                  });
                }
              },
              { text: 'Not Now', style: 'cancel' }
            ]
          );
        }
      }
    }
  };

  const executeSearch = async (overrideParams = {}) => {
    if (transport === 'public_transport') {
      Alert.alert(
        'Public Bus Unavailable',
        "Public transport times aren't available here in Dhaka. Rickshaw or CNG is recommended.",
        [
          { text: 'Switch to Rickshaw', onPress: () => { setTransport('rickshaw'); executeSearch({ transport: 'rickshaw' }); } },
          { text: 'Switch to CNG', onPress: () => { setTransport('cng'); executeSearch({ transport: 'cng' }); } },
          { text: 'Cancel', style: 'cancel' }
        ]
      );
      return;
    }

    const availableMins = overrideParams.availableMinutes !== undefined
      ? overrideParams.availableMinutes
      : isCustomTime
        ? parseInt(customMinutesInput, 10) || 30
        : selectedTime;

    const activeDining = overrideParams.diningStyle || diningStyle;
    const activeTransport = overrideParams.transport || transport;

    let destPayload = 'same-as-origin';
    if (returnDest !== 'same-as-origin') {
      if (returnDest === 'current') {
        destPayload = { lat: location.lat, lng: location.lng, name: location.name };
      } else if (['office', 'home', 'university'].includes(returnDest)) {
        const saved = await mobileStorage.getSavedPlaces();
        if (saved[returnDest]) {
          destPayload = saved[returnDest];
        } else {
          destPayload = { lat: location.lat, lng: location.lng, name: `${returnDest.toUpperCase()}` };
        }
      } else if (returnDest === 'custom') {
        destPayload = {
          name: customDestName.trim() || 'Custom Destination',
          lat: location.lat + 0.008,
          lng: location.lng + 0.008
        };
      }
    }

    let leaveAtIso = null;
    if (leaveAtTime && leaveAtTime.includes(':')) {
      const parts = leaveAtTime.split(':');
      const d = new Date();
      d.setHours(parseInt(parts[0], 10), parseInt(parts[1], 10), 0, 0);
      leaveAtIso = d.toISOString();
    }

    setLoading(true);
    setSearchResponse(null);

    try {
      const tasteProfile = await mobileStorage.getTasteProfile();
      const res = await apiClient.searchMealTime({
        mode: selectedMode,
        availableMinutes: availableMins,
        leaveAt: leaveAtIso,
        origin: { lat: location.lat, lng: location.lng, name: location.name },
        destination: destPayload,
        transport: activeTransport,
        diningStyle: activeDining,
        bufferPreference: bufferPref,
        tasteProfile
      });

      setSearchResponse(res);
    } catch (err) {
      console.warn('Backend searchMealTime unavailable, falling back to local engine:', err);
      try {
        const localRes = getLocalMealTime({
          mode: selectedMode,
          availableMinutes: availableMins,
          origin: { lat: location.lat, lng: location.lng, name: location.name },
          destination: destPayload,
          transport: activeTransport,
          diningStyle: activeDining,
          bufferPreference: bufferPref
        });
        setSearchResponse(localRes);
      } catch (fallbackErr) {
        console.error('Local meal-time fallback failed:', fallbackErr);
        Alert.alert(t('common.error'), 'Meal-Time search could not complete');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSendFeedback = async (candidate) => {
    const mins = parseInt(feedbackMins, 10);
    if (!mins || mins <= 0) {
      Alert.alert('Invalid Duration', 'Please enter how many minutes the trip took.');
      return;
    }

    try {
      await apiClient.sendMealTimeFeedback({
        mode: selectedMode,
        venueType: candidate.venueType || 'casual_dining',
        actualTotalMinutes: mins,
        wasLate: feedbackLate,
        placeId: candidate.placeId
      });
      setFeedbackSent(true);
      Alert.alert('Thank You!', 'Your feedback helps improve wait and travel estimates.');
    } catch (e) {
      Alert.alert('Error', 'Could not record feedback.');
    }
  };

  const renderStatusBadge = (status) => {
    let bg = theme.colors.trafficLowTint;
    let color = theme.colors.trafficLow;
    let icon = '✓';
    let text = t('mealTime.statusSafe');

    if (status === 'TIGHT') {
      bg = theme.colors.trafficModerateTint;
      color = theme.colors.trafficModerate;
      icon = '⚠';
      text = t('mealTime.statusTight');
    } else if (status === 'NOT_RECOMMENDED') {
      bg = theme.colors.trafficHeavyTint;
      color = theme.colors.trafficHeavy;
      icon = '✕';
      text = t('mealTime.statusNotRecommended');
    }

    return (
      <View style={[styles.statusBadge, { backgroundColor: bg }]}>
        <Text style={[styles.statusBadgeText, { color }]}>{`${icon} ${text}`}</Text>
      </View>
    );
  };

  const renderSegmentedBar = (tb, availableMinutes) => {
    if (!tb) return null;
    return (
      <View style={styles.segmentedBarContainer}>
        <View style={[styles.segmentedBar, { backgroundColor: theme.colors.surfaceAlt, borderColor: theme.colors.border }]}>
          {tb.outbound > 0 && (
            <View style={[styles.barSegment, { flex: tb.outbound, backgroundColor: theme.colors.primaryTint }]}>
              <Text style={[styles.barSegmentText, { color: theme.colors.primary }]}>→ {tb.outbound}m</Text>
            </View>
          )}
          {tb.wait > 0 && (
            <View style={[styles.barSegment, { flex: tb.wait, backgroundColor: theme.colors.warningTint }]}>
              <Text style={[styles.barSegmentText, { color: theme.colors.warning }]}>◷ {tb.wait}m</Text>
            </View>
          )}
          {tb.eat > 0 && (
            <View style={[styles.barSegment, { flex: tb.eat, backgroundColor: theme.colors.accent }]}>
              <Text style={[styles.barSegmentText, { color: theme.colors.onAccent }]}>🍴 {tb.eat}m</Text>
            </View>
          )}
          {tb.return > 0 && (
            <View style={[styles.barSegment, { flex: tb.return, backgroundColor: theme.colors.primaryTint, opacity: 0.85 }]}>
              <Text style={[styles.barSegmentText, { color: theme.colors.primary }]}>↩ {tb.return}m</Text>
            </View>
          )}
          {tb.buffer > 0 && (
            <View style={[styles.barSegment, { flex: tb.buffer, backgroundColor: theme.colors.surfaceAlt }]}>
              <Text style={[styles.barSegmentText, { color: theme.colors.textMuted }]}>🛡 {tb.buffer}m</Text>
            </View>
          )}
          {tb.spareMinutes > 0 && (
            <View style={[styles.barSegment, { flex: tb.spareMinutes, backgroundColor: theme.colors.trafficLowTint }]}>
              <Text style={[styles.barSegmentText, { color: theme.colors.trafficLow }]}>✦ {tb.spareMinutes}m</Text>
            </View>
          )}
        </View>
        <View style={styles.barLegendRow}>
          <Text style={[styles.barLegendText, { color: theme.colors.textMuted }]}>
            Total: <Text style={{ fontWeight: '800', color: theme.colors.text }}>{tb.total}m</Text> / {availableMinutes}m
          </Text>
          <Text style={[styles.barLegendText, { color: theme.colors.primary, fontWeight: '700' }]}>
            {tb.spareMinutes} min spare
          </Text>
        </View>
      </View>
    );
  };

  const renderCandidateCard = (c, idx, isFlexible = false) => {
    const tb = c.timeBreakdown;
    return (
      <View
        key={c.placeId || idx}
        style={[
          styles.candidateCard,
          {
            backgroundColor: theme.colors.card,
            borderColor: isFlexible ? theme.colors.warning : theme.colors.border
          }
        ]}
      >
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleCol}>
            <View style={styles.rankRow}>
              <Text style={[styles.rankBadge, { backgroundColor: theme.colors.surfaceAlt, color: theme.colors.primary }]}>
                #{idx + 1}
              </Text>
              <Text style={[styles.cardTitle, { color: theme.colors.text }]}>{c.name}</Text>
            </View>
            <Text style={[styles.cardSubText, { color: theme.colors.textMuted }]}>
              {c.cuisine || 'Restaurant'} • {'৳'.repeat(c.priceLevel || 2)} • ★ {c.rating || 4.2}
            </Text>
          </View>
          {renderStatusBadge(c.status)}
        </View>

        {/* Time Meta Row */}
        <View style={styles.timeMetaRow}>
          <Text style={[styles.timeMetaItem, { color: theme.colors.text }]}>
            🏁 <Text style={{ fontWeight: '800' }}>Back by: {c.backByTime}</Text>
          </Text>
          <Text style={[styles.timeMetaItem, { color: theme.colors.textMuted }]}>
            🕒 {c.openCheck?.closesAt ? `Open until ${c.openCheck.closesAt}` : 'Hours unverified'}
          </Text>
        </View>

        {/* Segmented Time Bar with dedicated icon glyphs */}
        {renderSegmentedBar(tb, c.availableMinutes)}

        {/* Plain Language Reason */}
        {c.reasons && c.reasons.length > 0 && (
          <Text style={[styles.reasonText, { color: theme.colors.text }]}>
            💡 {c.reasons[0]}
          </Text>
        )}

        {/* Detour info if applicable */}
        {c.detourMinutes > 0 && (
          <Text style={[styles.detourNote, { color: theme.colors.warning }]}>
            🔄 +{c.detourMinutes} min detour along your route
          </Text>
        )}

        {/* Flags Row */}
        {c.flags && c.flags.length > 0 && (
          <View style={styles.flagsRow}>
            {c.flags.map((flag, fIdx) => (
              <View key={fIdx} style={[styles.flagPill, { backgroundColor: theme.colors.surfaceAlt, borderColor: theme.colors.border }]}>
                <Text style={[styles.flagText, { color: theme.colors.textMuted }]}>🏷️ {flag}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Action Buttons: Explain, Directions, Call */}
        <View style={styles.cardActionsRow}>
          <TouchableOpacity
            style={[styles.explainBtn, { borderColor: theme.colors.primary }]}
            onPress={() => setExplainCandidate(c)}
            accessibilityRole="button"
            accessibilityLabel="Explain this pick"
          >
            <Text style={[styles.explainBtnText, { color: theme.colors.primary }]}>ℹ️ Explain</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.directionsBtn, { backgroundColor: theme.colors.primary }]}
            onPress={() => {
              const url = `https://www.google.com/maps/dir/?api=1&destination=${c.lat || location.lat},${c.lng || location.lng}`;
              Linking.openURL(url).catch(() => {});
            }}
            accessibilityRole="button"
            accessibilityLabel="Get directions"
          >
            <Text style={[styles.directionsBtnText, { color: theme.colors.onPrimary }]}>🗺️ Directions</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* 1. Meal Mode Selector */}
      <View style={styles.sectionBlock}>
        <Text style={[styles.sectionHeading, { color: theme.colors.textMuted }]}>
          🍽️ 1. {t('mealTime.title')}
        </Text>
        <View style={styles.modesRow}>
          {MODES.map(m => {
            const active = selectedMode === m.key;
            return (
              <TouchableOpacity
                key={m.key}
                style={[
                  styles.modeButton,
                  {
                    backgroundColor: active ? theme.colors.primary : theme.colors.surface,
                    borderColor: active ? theme.colors.primary : theme.colors.border
                  }
                ]}
                onPress={() => handleSelectMode(m.key)}
                accessibilityRole="button"
                accessibilityLabel={t(m.labelKey)}
              >
                <Text style={styles.modeIcon}>{m.icon}</Text>
                <Text
                  style={[
                    styles.modeLabel,
                    { color: active ? theme.colors.onPrimary : theme.colors.text }
                  ]}
                >
                  {t(m.labelKey)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* 2. Available Total Time */}
      <View style={styles.sectionBlock}>
        <Text style={[styles.sectionHeading, { color: theme.colors.textMuted }]}>
          ⏱️ 2. Available Total Time (Round-trip)
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
          {TIME_PRESETS.map(mins => {
            const active = !isCustomTime && selectedTime === mins;
            return (
              <TouchableOpacity
                key={mins}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? theme.colors.primary : theme.colors.surface,
                    borderColor: active ? theme.colors.primary : theme.colors.border
                  }
                ]}
                onPress={() => {
                  setSelectedTime(mins);
                  setIsCustomTime(false);
                }}
               accessibilityRole="button" accessibilityLabel={`Window ${mins} minutes`}>
                <Text style={[styles.chipText, { color: active ? theme.colors.onPrimary : theme.colors.text }]}>
                  {mins} min
                </Text>
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity
            style={[
              styles.chip,
              {
                backgroundColor: isCustomTime ? theme.colors.primary : theme.colors.surface,
                borderColor: isCustomTime ? theme.colors.primary : theme.colors.border
              }
            ]}
            onPress={() => setIsCustomTime(true)}
           accessibilityRole="button" accessibilityLabel="Interactive button">
            <Text style={[styles.chipText, { color: isCustomTime ? theme.colors.onPrimary : theme.colors.text }]}>
              {t('mealTime.times.custom')}
            </Text>
          </TouchableOpacity>
        </ScrollView>

        {isCustomTime && (
          <View style={styles.customTimeRow}>
            <Text style={[styles.customTimeLabel, { color: theme.colors.text }]}>Minutes:</Text>
            <TextInput
              style={[
                styles.customTimeInput,
                {
                  backgroundColor: theme.colors.card,
                  color: theme.colors.text,
                  borderColor: theme.colors.border
                }
              ]}
              keyboardType="numeric"
              value={customMinutesInput}
              onChangeText={setCustomMinutesInput}
              placeholder="e.g. 50"
              placeholderTextColor={theme.colors.textMuted}
            />
          </View>
        )}
      </View>

      {/* 3. Return Destination */}
      <View style={styles.sectionBlock}>
        <Text style={[styles.sectionHeading, { color: theme.colors.textMuted }]}>
          🏁 3. {t('mealTime.returnDestination')}
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
          {RETURN_DESTS.map(d => {
            const active = returnDest === d.key;
            return (
              <TouchableOpacity
                key={d.key}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? theme.colors.primary : theme.colors.surface,
                    borderColor: active ? theme.colors.primary : theme.colors.border
                  }
                ]}
                onPress={() => handleSelectReturnDest(d.key)}
               accessibilityRole="button" accessibilityLabel={`Dietary option ${d.label}`}>
                <Text style={[styles.chipText, { color: active ? theme.colors.onPrimary : theme.colors.text }]}>
                  {d.icon} {t(d.labelKey)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {returnDest === 'custom' && (
          <TextInput
            style={[
              styles.textInput,
              {
                backgroundColor: theme.colors.card,
                color: theme.colors.text,
                borderColor: theme.colors.border
              }
            ]}
            value={customDestName}
            onChangeText={setCustomDestName}
            placeholder="e.g. Banani 11 or Dhanmondi 27"
            placeholderTextColor={theme.colors.textMuted}
          />
        )}
      </View>

      {/* 4. Transport Mode */}
      <View style={styles.sectionBlock}>
        <Text style={[styles.sectionHeading, { color: theme.colors.textMuted }]}>
          🚗 4. {t('mealTime.transportTitle')}
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
          {TRANSPORTS.map(tr => {
            const active = transport === tr.key;
            return (
              <TouchableOpacity
                key={tr.key}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? theme.colors.primary : theme.colors.surface,
                    borderColor: active ? theme.colors.primary : theme.colors.border
                  }
                ]}
                onPress={() => setTransport(tr.key)}
               accessibilityRole="button" accessibilityLabel={`Transit mode ${tr.label}`}>
                <Text style={[styles.chipText, { color: active ? theme.colors.onPrimary : theme.colors.text }]}>
                  {tr.icon} {tr.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* 5. Advanced Options Accordion */}
      <View style={styles.sectionBlock}>
        <TouchableOpacity
          style={[styles.accordionHeader, { borderColor: theme.colors.border }]}
          onPress={() => setShowAdvanced(!showAdvanced)}
         accessibilityRole="button" accessibilityLabel="Toggle section">
          <Text style={[styles.accordionTitle, { color: theme.colors.text }]}>
            ⚙️ Advanced Options (Dining Style, Buffer, Leave At) {showAdvanced ? '▲' : '▼'}
          </Text>
        </TouchableOpacity>

        {showAdvanced && (
          <View style={[styles.accordionBody, { backgroundColor: theme.colors.surfaceAlt, borderColor: theme.colors.border }]}>
            {/* Dining Style */}
            <Text style={[styles.subLabel, { color: theme.colors.textMuted }]}>{t('mealTime.diningStyle')}:</Text>
            <View style={styles.rowWrap}>
              {[
                { key: 'dine_in', label: t('mealTime.dineIn') },
                { key: 'takeaway', label: t('mealTime.takeaway') }
              ].map(st => {
                const active = diningStyle === st.key;
                return (
                  <TouchableOpacity
                    key={st.key}
                    style={[
                      styles.chipSm,
                      {
                        backgroundColor: active ? theme.colors.primary : theme.colors.surface,
                        borderColor: active ? theme.colors.primary : theme.colors.border
                      }
                    ]}
                    onPress={() => setDiningStyle(st.key)}
                   accessibilityRole="button" accessibilityLabel={`Seating ${st.label}`}>
                    <Text style={[styles.chipSmText, { color: active ? theme.colors.onPrimary : theme.colors.text }]}>
                      {st.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Safety Buffer */}
            <Text style={[styles.subLabel, { color: theme.colors.textMuted, marginTop: 10 }]}>{t('mealTime.bufferPreference')}:</Text>
            <View style={styles.rowWrap}>
              {[
                { key: 'Balanced', label: t('mealTime.bufferBalanced') },
                { key: 'Safe', label: t('mealTime.bufferSafe') },
                { key: 'Flexible', label: t('mealTime.bufferFlexible') }
              ].map(bf => {
                const active = bufferPref === bf.key;
                return (
                  <TouchableOpacity
                    key={bf.key}
                    style={[
                      styles.chipSm,
                      {
                        backgroundColor: active ? theme.colors.primary : theme.colors.surface,
                        borderColor: active ? theme.colors.primary : theme.colors.border
                      }
                    ]}
                    onPress={() => setBufferPref(bf.key)}
                   accessibilityRole="button" accessibilityLabel={`Buffet focus ${bf.label}`}>
                    <Text style={[styles.chipSmText, { color: active ? theme.colors.onPrimary : theme.colors.text }]}>
                      {bf.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Leave At Time */}
            <Text style={[styles.subLabel, { color: theme.colors.textMuted, marginTop: 10 }]}>{t('mealTime.leaveAt')} (HH:mm):</Text>
            <TextInput
              style={[
                styles.textInput,
                {
                  backgroundColor: theme.colors.card,
                  color: theme.colors.text,
                  borderColor: theme.colors.border
                }
              ]}
              value={leaveAtTime}
              onChangeText={setLeaveAtTime}
              placeholder="Leave blank to plan for Now"
              placeholderTextColor={theme.colors.textMuted}
            />
          </View>
        )}
      </View>

      {/* Main Search Action Button */}
      <TouchableOpacity
        style={[styles.searchActionBtn, { backgroundColor: theme.colors.primary }]}
        onPress={() => executeSearch()}
        disabled={loading}
        accessibilityRole="button"
        accessibilityLabel={t('mealTime.findMeals')}
      >
        {loading ? (
          <ActivityIndicator color={theme.colors.onPrimary} />
        ) : (
          <Text style={[styles.searchActionText, { color: theme.colors.onPrimary }]}>
            ⏱️ {t('mealTime.findMeals')}
          </Text>
        )}
      </TouchableOpacity>

      {/* Results Section */}
      {searchResponse && (
        <View style={styles.resultsBlock}>
          {/* Summary / Status Bar */}
          <View style={styles.summaryBar}>
            <Text style={[styles.summaryTitle, { color: theme.colors.text }]}>
              {searchResponse.results.length > 0
                ? `Time-Feasible Food (${searchResponse.summary.mode.toUpperCase()})`
                : searchResponse.summary.message}
            </Text>
            {searchResponse.results.length > 0 && (
              <Text style={[styles.summaryCount, { color: theme.colors.primary }]}>
                {searchResponse.results.length} fit your break
              </Text>
            )}
          </View>

          {/* No Result Experience */}
          {searchResponse.results.length === 0 && (
            <View style={[styles.noResultCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
              <Text style={[styles.noResultTitle, { color: theme.colors.text }]}>
                ⏳ {searchResponse.summary.message}
              </Text>
              <Text style={[styles.noResultSubText, { color: theme.colors.textMuted }]}>
                Your total round-trip travel, ordering, eating, and safety buffer exceed your available time.
              </Text>

              {searchResponse.summary.shortestFeasibleTime && (
                <Text style={[styles.shortestTimeNote, { color: theme.colors.primary }]}>
                  {t('mealTime.shortestTimeNeeded', { mins: searchResponse.summary.shortestFeasibleTime })}
                </Text>
              )}

              {/* Computed Alternatives List */}
              {searchResponse.suggestions && searchResponse.suggestions.length > 0 && (
                <View style={styles.altsContainer}>
                  <Text style={[styles.altsHeader, { color: theme.colors.text }]}>
                    💡 {t('mealTime.alternativesTitle')}
                  </Text>
                  {searchResponse.suggestions.map((sug, sIdx) => (
                    <TouchableOpacity
                      key={sIdx}
                      style={[styles.altButton, { borderColor: theme.colors.primary, backgroundColor: theme.colors.surfaceAlt }]}
                      onPress={() => {
                        if (sug.type === 'takeaway') {
                          setDiningStyle('takeaway');
                          executeSearch({ diningStyle: 'takeaway' });
                        } else if (sug.type === 'add_time') {
                          const newTime = (isCustomTime ? parseInt(customMinutesInput, 10) : selectedTime) + 15;
                          setSelectedTime(newTime);
                          setCustomMinutesInput(String(newTime));
                          executeSearch({ availableMinutes: newTime });
                        }
                      }}
                     accessibilityRole="button" accessibilityLabel={`Select departure slot at ${s.time}`}>
                      <Text style={[styles.altButtonText, { color: theme.colors.primary }]}>
                        {sug.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* Feasible Candidates List */}
          {searchResponse.results.map((c, idx) => renderCandidateCard(c, idx, false))}

          {/* Flexible Collapsible Section */}
          {searchResponse.flexibleResults && searchResponse.flexibleResults.length > 0 && (
            <View style={[styles.flexibleBlock, { borderColor: theme.colors.warning, backgroundColor: theme.colors.warningTint }]}>
              <TouchableOpacity
                style={styles.flexibleToggle}
                onPress={() => setFlexibleExpanded(!flexibleExpanded)}
               accessibilityRole="checkbox" accessibilityLabel="Interactive button">
                <Text style={[styles.flexibleToggleText, { color: theme.colors.warning }]}>
                  ⚡ {t('mealTime.slightlyOverTitle', { mins: 5 })} ({searchResponse.flexibleResults.length}) {flexibleExpanded ? '▲' : '▼'}
                </Text>
              </TouchableOpacity>
              <Text style={[styles.flexibleWarningText, { color: theme.colors.warning }]}>
                {t('mealTime.slightlyOverWarning')}
              </Text>

              {flexibleExpanded && (
                <View style={{ marginTop: 10 }}>
                  {searchResponse.flexibleResults.map((fc, fIdx) => renderCandidateCard(fc, fIdx, true))}
                </View>
              )}
            </View>
          )}

          {/* Trip Feedback Loop Form */}
          {searchResponse.results.length > 0 && !feedbackSent && (
            <View style={[styles.feedbackCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
              <Text style={[styles.feedbackTitle, { color: theme.colors.text }]}>
                📝 {t('mealTime.feedbackPrompt')}
              </Text>
              <View style={styles.feedbackRow}>
                <TextInput
                  style={[
                    styles.feedbackInput,
                    {
                      backgroundColor: theme.colors.surfaceAlt,
                      color: theme.colors.text,
                      borderColor: theme.colors.border
                    }
                  ]}
                  keyboardType="numeric"
                  placeholder="Minutes"
                  placeholderTextColor={theme.colors.textMuted}
                  value={feedbackMins}
                  onChangeText={setFeedbackMins}
                />
                <TouchableOpacity
                  style={[
                    styles.lateToggleBtn,
                    {
                      backgroundColor: feedbackLate ? theme.colors.dangerTint : theme.colors.surfaceAlt,
                      borderColor: feedbackLate ? theme.colors.danger : theme.colors.border
                    }
                  ]}
                  onPress={() => setFeedbackLate(!feedbackLate)}
                 accessibilityRole="checkbox" accessibilityLabel="Interactive button">
                  <Text style={{ color: feedbackLate ? theme.colors.danger : theme.colors.textMuted, fontWeight: '700', fontSize: 12 }}>
                    {feedbackLate ? 'Late ⚠️' : 'On-time ✓'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.feedbackSubmitBtn, { backgroundColor: theme.colors.primary }]}
                  onPress={() => handleSendFeedback(searchResponse.results[0])}
                 accessibilityRole="button" accessibilityLabel="Search restaurants">
                  <Text style={{ color: theme.colors.onPrimary, fontWeight: '800', fontSize: 13 }}>
                    Send
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      )}

      {/* Explain This Modal Sheet */}
      <Modal
        visible={Boolean(explainCandidate)}
        transparent
        animationType="slide"
        onRequestClose={() => setExplainCandidate(null)}
      >
        <View style={[styles.modalBackdrop, { backgroundColor: theme.colors.scrim }]}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
                ℹ️ {t('mealTime.explainTitle')}
              </Text>
              <TouchableOpacity onPress={() => setExplainCandidate(null)} accessibilityRole="button" accessibilityLabel="Interactive button">
                <Text style={[styles.closeModalText, { color: theme.colors.textMuted }]}>✕</Text>
              </TouchableOpacity>
            </View>

            {explainCandidate && (
              <ScrollView style={styles.modalScroll}>
                <Text style={[styles.explainSpotName, { color: theme.colors.primary }]}>
                  {explainCandidate.name}
                </Text>

                {/* Full Breakdown Table */}
                <Text style={[styles.explainSubHeader, { color: theme.colors.text }]}>
                  ⏱️ {t('mealTime.timeBreakdown')}
                </Text>
                <View style={[styles.breakdownTable, { borderColor: theme.colors.border }]}>
                  <View style={styles.tableRow}>
                    <Text style={[styles.tableLabel, { color: theme.colors.textMuted }]}>Outbound Travel:</Text>
                    <Text style={[styles.tableValue, { color: theme.colors.text }]}>{explainCandidate.timeBreakdown.outbound} min</Text>
                  </View>
                  <View style={styles.tableRow}>
                    <Text style={[styles.tableLabel, { color: theme.colors.textMuted }]}>Wait & Order:</Text>
                    <Text style={[styles.tableValue, { color: theme.colors.text }]}>{explainCandidate.timeBreakdown.wait} min</Text>
                  </View>
                  <View style={styles.tableRow}>
                    <Text style={[styles.tableLabel, { color: theme.colors.textMuted }]}>Eating Time:</Text>
                    <Text style={[styles.tableValue, { color: theme.colors.text }]}>{explainCandidate.timeBreakdown.eat} min</Text>
                  </View>
                  <View style={styles.tableRow}>
                    <Text style={[styles.tableLabel, { color: theme.colors.textMuted }]}>Return Travel (Predicted):</Text>
                    <Text style={[styles.tableValue, { color: theme.colors.text }]}>{explainCandidate.timeBreakdown.return} min</Text>
                  </View>
                  <View style={styles.tableRow}>
                    <Text style={[styles.tableLabel, { color: theme.colors.textMuted }]}>Safety Buffer ({bufferPref}):</Text>
                    <Text style={[styles.tableValue, { color: theme.colors.text }]}>{explainCandidate.timeBreakdown.buffer} min</Text>
                  </View>
                  <View style={[styles.tableRow, styles.tableRowHighlight, { backgroundColor: theme.colors.surfaceAlt }]}>
                    <Text style={[styles.tableLabelBold, { color: theme.colors.text }]}>Total Required:</Text>
                    <Text style={[styles.tableValueBold, { color: theme.colors.text }]}>{explainCandidate.timeBreakdown.total} min</Text>
                  </View>
                  <View style={styles.tableRow}>
                    <Text style={[styles.tableLabel, { color: theme.colors.primary }]}>Available Time:</Text>
                    <Text style={[styles.tableValue, { color: theme.colors.primary }]}>{explainCandidate.availableMinutes} min</Text>
                  </View>
                  <View style={styles.tableRow}>
                    <Text style={[styles.tableLabelBold, { color: theme.colors.trafficLow }]}>Spare Time:</Text>
                    <Text style={[styles.tableValueBold, { color: theme.colors.trafficLow }]}>{explainCandidate.spareMinutes} min</Text>
                  </View>
                </View>

                {/* Score Breakdown */}
                <Text style={[styles.explainSubHeader, { color: theme.colors.text, marginTop: 16 }]}>
                  🎯 {t('mealTime.explainScore')}
                </Text>
                <Text style={[styles.scoreSummaryText, { color: theme.colors.textMuted }]}>
                  Overall Feasibility & Preference Score: {(explainCandidate.score * 100).toFixed(0)}/100
                </Text>

                <View style={{ height: 30 }} />
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 24
  },
  sectionBlock: {
    marginBottom: 16
  },
  sectionHeading: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    marginBottom: 8,
    letterSpacing: 0.5
  },
  modesRow: {
    flexDirection: 'row',
    gap: 8
  },
  modeButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 70
  },
  modeIcon: {
    fontSize: 22,
    marginBottom: 4
  },
  modeLabel: {
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center'
  },
  horizontalScroll: {
    flexDirection: 'row'
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
    minHeight: 40,
    justifyContent: 'center'
  },
  chipText: {
    fontSize: 13,
    fontWeight: '700'
  },
  customTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8
  },
  customTimeLabel: {
    fontSize: 13,
    fontWeight: '700',
    marginRight: 8
  },
  customTimeInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    width: 90,
    fontSize: 14,
    fontWeight: '700'
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    marginTop: 8
  },
  accordionHeader: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center'
  },
  accordionTitle: {
    fontSize: 13,
    fontWeight: '700'
  },
  accordionBody: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginTop: 6
  },
  subLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase'
  },
  rowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4
  },
  chipSm: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1
  },
  chipSmText: {
    fontSize: 12,
    fontWeight: '700'
  },
  searchActionBtn: {
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginVertical: 12
  },
  searchActionText: {
    fontSize: 16,
    fontWeight: '800'
  },
  resultsBlock: {
    marginTop: 8
  },
  summaryBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '800',
    flex: 1
  },
  summaryCount: {
    fontSize: 13,
    fontWeight: '800'
  },
  candidateCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 14
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start'
  },
  cardTitleCol: {
    flex: 1,
    paddingRight: 8
  },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  rankBadge: {
    fontSize: 11,
    fontWeight: '800',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800'
  },
  cardSubText: {
    fontSize: 12,
    marginTop: 2
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '800'
  },
  timeMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 8
  },
  timeMetaItem: {
    fontSize: 12
  },
  segmentedBarContainer: {
    marginVertical: 6
  },
  segmentedBar: {
    flexDirection: 'row',
    height: 26,
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden'
  },
  barSegment: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 2
  },
  barSegmentText: {
    fontSize: 9,
    fontWeight: '800'
  },
  barLegendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4
  },
  barLegendText: {
    fontSize: 11
  },
  reasonText: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 6
  },
  detourNote: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4
  },
  flagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8
  },
  flagPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1
  },
  flagText: {
    fontSize: 10,
    fontWeight: '700'
  },
  cardActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)'
  },
  explainBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1
  },
  explainBtnText: {
    fontSize: 12,
    fontWeight: '800'
  },
  directionsBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10
  },
  directionsBtnText: {
    fontSize: 12,
    fontWeight: '800'
  },
  noResultCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16
  },
  noResultTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 6
  },
  noResultSubText: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 8
  },
  shortestTimeNote: {
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 12
  },
  altsContainer: {
    marginTop: 8
  },
  altsHeader: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 8
  },
  altButton: {
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 6
  },
  altButtonText: {
    fontSize: 13,
    fontWeight: '700'
  },
  flexibleBlock: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginBottom: 16
  },
  flexibleToggle: {
    paddingVertical: 4
  },
  flexibleToggleText: {
    fontSize: 13,
    fontWeight: '800'
  },
  flexibleWarningText: {
    fontSize: 11,
    lineHeight: 15,
    marginTop: 2
  },
  feedbackCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginTop: 8,
    marginBottom: 16
  },
  feedbackTitle: {
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 8
  },
  feedbackRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center'
  },
  feedbackInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    width: 80,
    fontSize: 13
  },
  lateToggleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1
  },
  feedbackSubmitBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end'
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%'
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800'
  },
  closeModalText: {
    fontSize: 20,
    fontWeight: '800',
    padding: 4
  },
  modalScroll: {
    marginBottom: 10
  },
  explainSpotName: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 12
  },
  explainSubHeader: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 8
  },
  breakdownTable: {
    borderWidth: 1,
    borderRadius: 10,
    overflow: 'hidden'
  },
  tableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 7
  },
  tableRowHighlight: {
    paddingVertical: 9
  },
  tableLabel: {
    fontSize: 13
  },
  tableValue: {
    fontSize: 13,
    fontWeight: '700'
  },
  tableLabelBold: {
    fontSize: 13,
    fontWeight: '800'
  },
  tableValueBold: {
    fontSize: 13,
    fontWeight: '800'
  },
  scoreSummaryText: {
    fontSize: 13,
    lineHeight: 18
  }
});
