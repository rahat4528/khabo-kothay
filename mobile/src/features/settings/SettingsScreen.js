import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Share,
  Alert,
  Image
} from 'react-native';
import { mobileStorage } from '../../services/storage.js';
import { scheduleMealNudges, cancelAllNudges } from '../../services/notifications.js';
import { t, setLocale, getLocale } from '../../i18n/index.js';

export default function SettingsScreen({ theme, onThemeChange }) {
  const [currentLang, setCurrentLang] = useState(getLocale());
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [learningEnabled, setLearningEnabled] = useState(true);
  const [currentThemeMode, setCurrentThemeMode] = useState('system');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const isLearn = await mobileStorage.isLearningEnabled();
    setLearningEnabled(isLearn);
    const prefs = await mobileStorage.getPreferences();
    if (prefs.themeMode) {
      setCurrentThemeMode(prefs.themeMode);
    }
  };

  const handleLangToggle = (lang) => {
    setCurrentLang(lang);
    setLocale(lang);
  };

  const handleThemeSelect = async (mode) => {
    setCurrentThemeMode(mode);
    await mobileStorage.savePreferences({ themeMode: mode });
    if (onThemeChange) {
      onThemeChange(mode);
    }
  };

  const handleNotificationsToggle = async (val) => {
    setNotificationsEnabled(val);
    if (val) {
      await scheduleMealNudges(true, true);
    } else {
      await cancelAllNudges();
    }
  };

  const handleExportData = async () => {
    const data = await mobileStorage.exportAllData();
    try {
      await Share.share({
        title: 'Khabo Kothay? - Data Export',
        message: JSON.stringify(data, null, 2)
      });
    } catch (e) {}
  };

  const handleDeleteData = () => {
    Alert.alert(
      t('settings.deleteData'),
      t('settings.deleteConfirm'),
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Everything',
          style: 'destructive',
          onPress: async () => {
            await mobileStorage.deleteAllData();
            Alert.alert('Data Deleted', 'All local preferences and taste data have been wiped.');
          }
        }
      ]
    );
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.content}>
        {/* Language Selection */}
        <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>🌐 {t('settings.language')}</Text>
          <View style={styles.btnRow}>
            <TouchableOpacity
              style={[
                styles.langBtn,
                { backgroundColor: currentLang === 'en' ? theme.colors.primary : theme.colors.surfaceAlt }
              ]}
              onPress={() => handleLangToggle('en')}
             accessibilityRole="checkbox" accessibilityLabel="Interactive button">
              <Text style={[styles.langBtnText, { color: currentLang === 'en' ? theme.colors.onPrimary : theme.colors.textMuted }]}>
                English
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.langBtn,
                { backgroundColor: currentLang === 'bn' ? theme.colors.primary : theme.colors.surfaceAlt }
              ]}
              onPress={() => handleLangToggle('bn')}
             accessibilityRole="checkbox" accessibilityLabel="Interactive button">
              <Text style={[styles.langBtnText, { color: currentLang === 'bn' ? theme.colors.onPrimary : theme.colors.textMuted }]}>
                বাংলা (Bangla)
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Theme Appearance Selection: System / Light / Dark */}
        <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>🎨 {t('settings.theme')}</Text>
          <View style={styles.btnRow}>
            <TouchableOpacity
              style={[
                styles.langBtn,
                { backgroundColor: currentThemeMode === 'system' ? theme.colors.primary : theme.colors.surfaceAlt }
              ]}
              onPress={() => handleThemeSelect('system')}
             accessibilityRole="button" accessibilityLabel="Interactive button">
              <Text style={[styles.langBtnText, { color: currentThemeMode === 'system' ? theme.colors.onPrimary : theme.colors.textMuted }]}>
                {t('settings.themeSystem')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.langBtn,
                { backgroundColor: currentThemeMode === 'light' ? theme.colors.primary : theme.colors.surfaceAlt }
              ]}
              onPress={() => handleThemeSelect('light')}
             accessibilityRole="button" accessibilityLabel="Interactive button">
              <Text style={[styles.langBtnText, { color: currentThemeMode === 'light' ? theme.colors.onPrimary : theme.colors.textMuted }]}>
                {t('settings.themeLight')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.langBtn,
                { backgroundColor: currentThemeMode === 'dark' ? theme.colors.primary : theme.colors.surfaceAlt }
              ]}
              onPress={() => handleThemeSelect('dark')}
             accessibilityRole="button" accessibilityLabel="Interactive button">
              <Text style={[styles.langBtnText, { color: currentThemeMode === 'dark' ? theme.colors.onPrimary : theme.colors.textMuted }]}>
                {t('settings.themeDark')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Notifications */}
        <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <View style={styles.switchRow}>
            <View>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>🔔 {t('settings.notifications')}</Text>
              <Text style={[styles.subText, { color: theme.colors.textMuted }]}>
                {t('settings.lunchNudge')} &amp; {t('settings.dinnerNudge')}
              </Text>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={handleNotificationsToggle}
              trackColor={{ false: theme.colors.skeleton, true: theme.colors.primary }}
            />
          </View>
        </View>

        {/* Privacy & Data Management */}
        <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>🔒 Privacy &amp; Data</Text>
          <Text style={[styles.privacyNote, { color: theme.colors.textSubtle }]}>
            {t('settings.privacyNote')}
          </Text>

          <TouchableOpacity style={styles.actionBtn} onPress={handleExportData} accessibilityRole="button" accessibilityLabel="Export my search and taste data">
            <Text style={{ color: theme.colors.primary, fontWeight: '700' }}>
              📥 {t('settings.exportData')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionBtn} onPress={handleDeleteData} accessibilityRole="button" accessibilityLabel="Delete all stored local data">
            <Text style={{ color: theme.colors.danger, fontWeight: '700' }}>
              🗑️ {t('settings.deleteData')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* About Info */}
        <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <Image
              source={require('../../../assets/icon.png')}
              style={{ width: 44, height: 44, borderRadius: 10, marginRight: 12 }}
              resizeMode="contain"
            />
            <View>
              <Text style={[styles.sectionTitle, { color: theme.colors.text, marginBottom: 2 }]}>ℹ️ {t('settings.about')}</Text>
              <Text style={{ fontSize: 12, color: theme.colors.primary, fontWeight: '700' }}>খাবো কোথায়? • Official App</Text>
            </View>
          </View>
          <Text style={[styles.aboutText, { color: theme.colors.textMuted }]}>
            Khabo Kothay? (খাবো কোথায়?) - Dhaka Traffic-Aware Dining Assistant
          </Text>
          <Text style={[styles.aboutText, { color: theme.colors.textSubtle }]}>
            {t('settings.version')} 1.1.0 • Mobile Client
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 16 },
  card: { padding: 16, borderRadius: 16, borderWidth: 1 },
  sectionTitle: { fontSize: 16, fontWeight: '800', marginBottom: 8 },
  subText: { fontSize: 12, marginTop: 2 },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
  langBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center'
  },
  langBtnText: { fontWeight: '700', fontSize: 13 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  privacyNote: { fontSize: 12, lineHeight: 18, marginBottom: 16 },
  actionBtn: { paddingVertical: 12 },
  aboutText: { fontSize: 13, marginTop: 4 }
});
