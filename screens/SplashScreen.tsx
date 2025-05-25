import React from "react";
import { StyleSheet, Image, ImageBackground, View, Text } from "react-native";

const SplashScreen = () => {
  return (
    <ImageBackground
      source={require("../assets/splash_background.png")}
      style={styles.background}
      resizeMode="cover"
    >
      <View style={styles.overlay}>
        <Image
          source={require("../assets/logo.png")}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.title}>LUMI</Text>
        <Text style={styles.slogan}>управление искусственным окном</Text>
      </View>
    </ImageBackground>
  );
};

export default SplashScreen;

const styles = StyleSheet.create({
  background: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  logo: {
    width: 160,
    height: 160,
  },
  title: {
    fontSize: 48,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginTop: 20,
    fontFamily: "Montserrat",
    textShadowColor: "rgba(0, 0, 0, 0.6)",
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
  },
  slogan: {
    color: "#FFFFFF",
    fontSize: 18,
    textAlign: "center",
    marginTop: 10,
    fontFamily: "Lora",
    textShadowColor: "rgba(0, 0, 0, 0.4)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
});
