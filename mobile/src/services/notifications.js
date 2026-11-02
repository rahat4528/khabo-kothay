import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false
  })
});

export async function requestNotificationPermission() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('meal-reminders', {
      name: 'Meal Reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 250, 250, 250]
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  return finalStatus === 'granted';
}

export async function scheduleMealNudges(enableLunch = true, enableDinner = true) {
  await Notifications.cancelAllScheduledNotificationsAsync();

  const granted = await requestNotificationPermission();
  if (!granted) return false;

  if (enableLunch) {
    // 1:00 PM daily nudge
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Hungry? 🍱',
        body: 'Check out the fastest lunch spots in Dhaka with light traffic right now!',
        data: { screen: 'Home' }
      },
      trigger: {
        hour: 13,
        minute: 0,
        repeats: true
      }
    });
  }

  if (enableDinner) {
    // 8:00 PM daily nudge
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Dinner time! 🍲',
        body: 'Find top-rated dining spots and avoid evening bottlenecks.',
        data: { screen: 'Home' }
      },
      trigger: {
        hour: 20,
        minute: 0,
        repeats: true
      }
    });
  }

  return true;
}

export async function cancelAllNudges() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}
