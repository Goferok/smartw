import React, { useEffect, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import AppNavigator from "./AppNavigator";
import SplashScreen from "./screens/SplashScreen";

export default function App() {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setIsLoading(false);
    }, 3000); // 2.5 секунды

    return () => clearTimeout(timeout);
  }, []);

  return isLoading ? <SplashScreen /> : (
    <NavigationContainer>
      <AppNavigator />
    </NavigationContainer>
  );
}
