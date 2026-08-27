import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { Inter_400Regular, Inter_700Bold, Inter_900Black } from '@expo-google-fonts/inter';
import { SplashScreen } from 'expo-router';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';

// Conditionally import expo-navigation-bar (Android-only API)
let NavigationBar: typeof import('expo-navigation-bar') | null = null;
if (Platform.OS === 'android') {
  NavigationBar = require('expo-navigation-bar');
}

SplashScreen.preventAutoHideAsync();

/** Apply sticky immersive mode: hide navigation bar */
function applyImmersiveMode() {
  if (!NavigationBar || Platform.OS !== 'android') return;
  try {
    NavigationBar.NavigationBar.setHidden(true);
  } catch (err) {
    console.warn('Failed to apply immersive mode:', err);
  }
}

export default function RootLayout() {
  useFrameworkReady();

  const [fontsLoaded, fontError] = useFonts({
    'Inter-Regular': Inter_400Regular,
    'Inter-Bold': Inter_700Bold,
    'Inter-Black': Inter_900Black,
  });

  const appStateRef = useRef(AppState.currentState);

  // Apply immersive mode on mount
  useEffect(() => {
    applyImmersiveMode();
  }, []);

  // Re-apply immersive mode when app returns from background
  // Android resets system bar visibility when switching apps
  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        applyImmersiveMode();
      }
      appStateRef.current = nextAppState;
    });

    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="ride/[id]"
          options={{ headerShown: false, presentation: 'card', animation: 'slide_from_right' }}
        />
        <Stack.Screen name="+not-found" />
      </Stack>
      <StatusBar hidden={true} />
    </>
  );
}
