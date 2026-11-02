import * as Location from 'expo-location';

export const PRESET_LOCATIONS = {
  'Notun Bazar': { lat: 23.7975, lng: 90.4234, name: 'Notun Bazar Bus Stand' },
  'Gulshan 1': { lat: 23.7785, lng: 90.4178, name: 'Gulshan 1 Circle' },
  'Gulshan 2': { lat: 23.7925, lng: 90.4150, name: 'Gulshan 2 Circle' },
  'Banani': { lat: 23.7937, lng: 90.4046, name: 'Banani Road 11' },
  'Baridhara': { lat: 23.7998, lng: 90.4215, name: 'Baridhara Diplomatic Zone' },
  'Dhanmondi': { lat: 23.7465, lng: 90.3760, name: 'Dhanmondi Road 27' },
  'Uttara': { lat: 23.8728, lng: 90.3984, name: 'Uttara Sector 3' },
  'Bashundhara R/A': { lat: 23.8164, lng: 90.4278, name: 'Bashundhara R/A Gate' },
  'Mirpur': { lat: 23.8071, lng: 90.3686, name: 'Mirpur 10 Circle' },
  'Bailey Road': { lat: 23.7410, lng: 90.4072, name: 'Bailey Road' }
};

export const DEFAULT_LOCATION = { lat: 23.8103, lng: 90.4125, name: 'Dhaka' };

/**
 * Robust device GPS location retriever:
 * Handles:
 * - Location services turned off (hardware/system level)
 * - Permission granted, denied, or "ask every time"
 * - GPS retrieval failure / timeout
 * Falls back safely to selected or default Dhaka area preset without crashing.
 */
export async function getCurrentOrFallbackLocation() {
  try {
    // 1. Check if location services (GPS) are enabled at system level
    const servicesEnabled = await Location.hasServicesEnabledAsync().catch(() => true);
    if (!servicesEnabled) {
      return {
        ...DEFAULT_LOCATION,
        isGps: false,
        servicesDisabled: true,
        permissionDenied: false,
        statusMessage: 'Location services are disabled. Using manual Dhaka area.'
      };
    }

    // 2. Check permission status
    let { status, canAskAgain } = await Location.getForegroundPermissionsAsync().catch(() => ({ status: 'undetermined', canAskAgain: true }));
    if (status !== 'granted') {
      const requested = await Location.requestForegroundPermissionsAsync().catch(() => ({ status: 'denied', canAskAgain: false }));
      status = requested.status;
      canAskAgain = requested.canAskAgain;
    }

    if (status !== 'granted') {
      return {
        ...DEFAULT_LOCATION,
        isGps: false,
        permissionDenied: true,
        canAskAgain: Boolean(canAskAgain),
        statusMessage: 'GPS permission denied. Please select your Dhaka area manually.'
      };
    }

    // 3. Try to get current position with 8s timeout
    const loc = await Promise.race([
      Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('GPS timeout')), 8000))
    ]).catch(async () => {
      // Fallback to last known position
      return Location.getLastKnownPositionAsync().catch(() => null);
    });

    if (loc && loc.coords) {
      return {
        lat: loc.coords.latitude,
        lng: loc.coords.longitude,
        name: 'Current Location',
        isGps: true,
        permissionDenied: false,
        servicesDisabled: false
      };
    }

    return {
      ...DEFAULT_LOCATION,
      isGps: false,
      permissionDenied: false,
      servicesDisabled: false,
      statusMessage: 'Could not obtain GPS fix. Using manual Dhaka area.'
    };
  } catch (err) {
    console.warn('GPS location retrieval error:', err);
    return {
      ...DEFAULT_LOCATION,
      isGps: false,
      permissionDenied: false,
      servicesDisabled: false
    };
  }
}
