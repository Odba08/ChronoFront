import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ActivityIndicator, StatusBar } from 'react-native';
import * as Font from 'expo-font';
import { 
  Merriweather_400Regular, 
  Merriweather_700Bold 
} from '@expo-google-fonts/merriweather';
import { 
  JetBrainsMono_400Regular 
} from '@expo-google-fonts/jetbrains-mono';

export default function App() {
  const [fontsLoaded, setFontsLoaded] = useState(false);

  useEffect(() => {
    async function loadFonts() {
      await Font.loadAsync({
        Merriweather_400Regular,
        Merriweather_700Bold,
        JetBrainsMono_400Regular,
      });
      setFontsLoaded(true);
    }
    loadFonts();
  }, []);

  if (!fontsLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4A4A4A" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* HUD Superior Minimalista */}
      <View style={styles.hud}>
        <Text style={styles.hudText}>SALUD: 100</Text>
        <Text style={styles.hudText}>ENTROPÍA: 00</Text>
      </View>

      {/* Lienzo Narrativo */}
      <View style={styles.narrativeContainer}>
        <Text style={styles.prose}>
          La conexión está establecida. El lienzo está oscuro y esperando los primeros datos del motor cronal.
        </Text>
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#050505',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    flex: 1,
    backgroundColor: '#050505', // Negro OLED casi puro
    paddingTop: 50,
  },
  hud: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
  },
  hudText: {
    fontFamily: 'JetBrainsMono_400Regulaclr',
    color: '#666666', // Gris técnico
    fontSize: 12,
    letterSpacing: 1,
  },
  narrativeContainer: {
    flex: 1,
    padding: 24,
    paddingTop: 40,
  },
  prose: {
    fontFamily: 'Merriweather_400Regular',
    color: '#D4D4D0', // Tono hueso/ceniza para lectura cómoda
    fontSize: 18,
    lineHeight: 30,
  }
});