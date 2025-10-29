import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { Appearance, ColorSchemeName } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface ThemeContextType {
  theme: ColorSchemeName;
  toggleTheme: (selectedTheme?: ColorSchemeName) => Promise<void>;
  isSystemTheme: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  // DEFAULT TO LIGHT MODE EXPLICITLY
  const [theme, setTheme] = useState<ColorSchemeName>('light');
  const [isSystemTheme, setIsSystemTheme] = useState(false); // Changed to false

  useEffect(() => {
    loadSavedTheme();
  }, []);

  const loadSavedTheme = async () => {
    try {
      const storedTheme = await AsyncStorage.getItem('app_theme');
      const storedUseSystem = await AsyncStorage.getItem('use_system_theme');
      
      if (storedUseSystem === 'true') {
        // User chose system theme
        const systemTheme = Appearance.getColorScheme() || 'light';
        setTheme(systemTheme);
        setIsSystemTheme(true);
      } else if (storedTheme) {
        // User chose manual theme
        setTheme(storedTheme as ColorSchemeName);
        setIsSystemTheme(false);
      } else {
        // NO STORED PREFERENCE - DEFAULT TO LIGHT
        setTheme('light');
        setIsSystemTheme(false);
        // Save the default preference
        await AsyncStorage.setItem('app_theme', 'light');
        await AsyncStorage.setItem('use_system_theme', 'false');
      }
    } catch (error) {
      console.error('Error loading theme:', error);
      // Fallback to light mode
      setTheme('light');
      setIsSystemTheme(false);
    }
  };

  const toggleTheme = async (selectedTheme?: ColorSchemeName) => {
    try {
      if (selectedTheme === 'system') {
        // Switch to system theme
        const currentSystemTheme = Appearance.getColorScheme() || 'light';
        setTheme(currentSystemTheme);
        setIsSystemTheme(true);
        await AsyncStorage.setItem('use_system_theme', 'true');
        await AsyncStorage.removeItem('app_theme');
      } else {
        // Manual theme selection
        const newTheme = selectedTheme || (theme === 'dark' ? 'light' : 'dark');
        setTheme(newTheme);
        setIsSystemTheme(false);
        await AsyncStorage.setItem('app_theme', newTheme);
        await AsyncStorage.setItem('use_system_theme', 'false');
      }
    } catch (error) {
      console.error('Error saving theme:', error);
    }
  };

  // Listen for system theme changes only when using system theme
  useEffect(() => {
    if (isSystemTheme) {
      const subscription = Appearance.addChangeListener(({ colorScheme }) => {
        setTheme(colorScheme || 'light');
      });
      return () => subscription.remove();
    }
  }, [isSystemTheme]);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, isSystemTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
