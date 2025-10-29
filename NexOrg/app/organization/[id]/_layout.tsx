import { Stack } from 'expo-router';
import React from 'react';

export default function OrganizationLayout() {
  return (
    <Stack>
      <Stack.Screen 
        name="index" 
        options={{
          headerShown: false
        }} 
      />
      <Stack.Screen 
        name="members" 
        options={{
          headerShown: false
        }} 
      />
      <Stack.Screen 
        name="settings" 
        options={{
          headerShown: false
        }} 
      />
      <Stack.Screen 
        name="redbook" 
        options={{
          headerShown: false
        }} 
      />
      <Stack.Screen 
        name="create-announcement" 
        options={{
          headerShown: false,
          presentation: 'modal',
        }} 
      />
    </Stack>
  );
}
