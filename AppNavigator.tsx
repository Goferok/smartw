import React, { useState, useEffect } from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { NavigationContainer } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Ionicons from "react-native-vector-icons/Ionicons";
import HomeScreen from "./screens/HomeScreen";
import ModesScreen from "./screens/ModesScreen";
import SettingsScreen from "./screens/SettingsScreen";
import { Alert } from "react-native";

// ✅ Обновлённый RootStackParamList с поддержкой демо-режима
export type RootStackParamList = {
  MainTabs: {
    screen?: "Home" | "Modes" | "Settings";
    params?: { deviceIp?: string; isDemoMode?: boolean };
  };
  Modes: { deviceIp: string; isDemoMode?: boolean }; // 👈 добавлено isDemoMode
  Settings: { deviceIp: string; isDemoMode?: boolean };
};

type BottomTabParamList = {
  Home: undefined;
  Modes: { deviceIp: string; isDemoMode?: boolean };
  Settings: { deviceIp: string; isDemoMode?: boolean };
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<BottomTabParamList>();

type MainTabsProps = {
  selectedDevice: string | null;
  updateSelectedDevice: (deviceIp: string) => void;
};

export default function AppNavigator() {
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);

  const updateSelectedDevice = (deviceIp: string) => {
    setSelectedDevice(deviceIp);
    AsyncStorage.setItem("selectedDevice", deviceIp);
  };

  useEffect(() => {
    const loadSelectedDevice = async () => {
      const storedDeviceIp = await AsyncStorage.getItem("selectedDevice");
      if (storedDeviceIp) setSelectedDevice(storedDeviceIp);
    };
    loadSelectedDevice();
  }, []);

  return (
  
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="MainTabs">
          {() => (
            <MainTabs
              selectedDevice={selectedDevice}
              updateSelectedDevice={updateSelectedDevice}
            />
          )}
        </Stack.Screen>

        {/* 👇 Передаём deviceIp и isDemoMode в стек */}
        <Stack.Screen
          name="Modes"
          component={ModesScreen}
          options={{ title: "Режимы" }}
          initialParams={{ deviceIp: selectedDevice || "" }}
        />
      </Stack.Navigator>
  
  );
}

function MainTabs({ selectedDevice, updateSelectedDevice }: MainTabsProps) {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color, size }) => {
          let iconName = "help-circle";

          if (route.name === "Home") iconName = "home";
          else if (route.name === "Modes") iconName = "sunny";
          else if (route.name === "Settings") iconName = "settings";

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: "#f9c154",
        tabBarInactiveTintColor: "gray",
        tabBarStyle: { backgroundColor: "#282A36" },
        headerShown: false,
      })}
    >
      <Tab.Screen name="Home" options={{ title: "Главная" }}>
        {() => <HomeScreen updateSelectedDevice={updateSelectedDevice} />}
      </Tab.Screen>

      <Tab.Screen
        name="Modes"
        component={ModesScreen}
        options={{ title: "Режимы" }}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            if (!selectedDevice) {
              e.preventDefault();
              Alert.alert("Устройство не выбрано", "Пожалуйста, выберите устройство на главной странице.");
            } else {
              navigation.navigate("Modes", { deviceIp: selectedDevice });
            }
          },
        })}
      />

      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: "Настройки" }}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            if (!selectedDevice) {
              e.preventDefault();
              Alert.alert("Устройство не выбрано", "Пожалуйста, выберите устройство на главной странице.");
            } else {
              e.preventDefault();
              navigation.navigate("Settings", {
              deviceIp: selectedDevice,
              isDemoMode: selectedDevice === "0.0.0.0", // ✅ если IP "0.0.0.0", включаем демо-режим
});
            }
          },
        })}
      />
    </Tab.Navigator>
  );
}
