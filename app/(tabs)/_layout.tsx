import { Tabs } from 'expo-router';
import { Activity, MapPin } from 'lucide-react-native';
import { theme } from '../../src/theme';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.textMuted,
        tabBarStyle: {
          backgroundColor: theme.bgElevated,
          borderTopColor: theme.border,
          borderTopWidth: 1,
          height: 64,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '700',
          fontFamily: 'Inter-Bold',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Record Ride',
          tabBarIcon: ({ size, color }) => <MapPin size={size} color={color} strokeWidth={2.4} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'Ride History',
          tabBarIcon: ({ size, color }) => <Activity size={size} color={color} strokeWidth={2.4} />,
        }}
      />
    </Tabs>
  );
}
