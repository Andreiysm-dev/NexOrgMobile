import { DefaultTheme, DarkTheme, ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';

// Create custom navigation themes with your maroon branding
const LightNavigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: '#FFFFFF',
    card: '#FFFFFF',
    text: '#1F2937',
    border: '#E5E7EB',
    notification: '#800020',
    primary: '#800020',
  },
};

const DarkNavigationTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: '#111827',
    card: '#1F2937',
    text: '#F9FAFB',
    border: '#374151',
    notification: '#A0002B',
    primary: '#A0002B',
  },
};

function InnerLayout() {
  const { theme } = useTheme();
  const navigationTheme = theme === 'dark' ? DarkNavigationTheme : LightNavigationTheme;

  return (
    <NavigationThemeProvider value={navigationTheme}>
      <Stack>
        <Stack.Screen name="auth" options={{ headerShown: false }} />
        <Stack.Screen 
          name="profile-setup" 
          options={{ 
            title: 'Profile Setup',
            headerStyle: {
              backgroundColor: navigationTheme.colors.background,
            },
            headerTintColor: '#800020',
            headerTitleStyle: {
              fontWeight: '700',
              fontSize: 18,
              color: theme === 'dark' ? '#F9FAFB' : '#1F2937',
            },
            headerShadowVisible: true,
            headerBackButtonDisplayMode: 'minimal',
            headerTitleAlign: 'center',
          }} 
        />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen 
          name="organization" 
          options={{ 
            title: 'Organization',
            headerStyle: {
              backgroundColor: navigationTheme.colors.background,
            },
            headerTintColor: '#800020',
            headerTitleStyle: {
              fontWeight: '700',
              fontSize: 18,
              color: theme === 'dark' ? '#F9FAFB' : '#1F2937',
            },
            headerShadowVisible: true,
            headerBackButtonDisplayMode: 'minimal',
            headerTitleAlign: 'center',
          }} 
        />
        <Stack.Screen name="+not-found" />
      </Stack>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
    </NavigationThemeProvider>
  );
}

export default function RootLayout() {
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  if (!loaded) {
    return null;
  }

  return (
    <ThemeProvider>
      <InnerLayout />
    </ThemeProvider>
  );
}
