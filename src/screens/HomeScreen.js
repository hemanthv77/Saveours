import React from 'react';
import { View, Text, Button, StyleSheet, ImageBackground } from 'react-native';

const welcomeBackgroundImage = require('../../assets/login-bg.png');

const HomeScreen = ({ navigation }) => {
  return (
    <ImageBackground
      source={welcomeBackgroundImage}
      style={styles.background}
      resizeMode="cover"
    >
      <View style={styles.backgroundOverlay} />

      <View style={styles.container}>
        <Text style={styles.title}>Welcome to Saveours</Text>
        <Text style={styles.subtitle}>Share food, reduce waste</Text>
        <View style={styles.buttonContainer}>
          <Button
            title="Get Started"
            onPress={() => navigation.navigate('Login')}
            color="#FF6B4A"
          />
        </View>
      </View>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  background: {
    flex: 1,
  },
  backgroundOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 30,
  },
  buttonContainer: {
    width: '100%',
    maxWidth: 320,
  },
});

export default HomeScreen;
