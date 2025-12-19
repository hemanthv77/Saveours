import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert } from 'react-native';
import { useDispatch } from 'react-redux';
import firestore from '@react-native-firebase/firestore';
import { signUp } from '../services/firebase';
import { setUser } from '../redux/authSlice';

const SignUpScreen = ({ navigation }) => {
  const dispatch = useDispatch();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleSignUp = async () => {
    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    try {
      const user = await signUp(email, password);
      
      // Create user document in Firestore
      const userData = {
        userId: user.uid,
        email: user.email,
        name: '', // To be filled in My Account
        dateOfBirth: null,
        phoneNumber: '',
        profilePictureUrl: '',
        createdAt: firestore.FieldValue.serverTimestamp(),
        updatedAt: firestore.FieldValue.serverTimestamp(),
        communities: [], // Array of community IDs user is part of
        adminCommunities: [] // Array of community IDs user manages
      };

      await firestore()
        .collection('users')
        .doc(user.uid)
        .set(userData);

      // Update Redux store with user data
      dispatch(setUser({
        uid: user.uid,
        email: user.email,
        ...userData
      }));

      Alert.alert('Success', 'Account created successfully!');
      navigation.reset({
        index: 0,
        routes: [{ name: 'Communities' }],
      });
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sign Up</Text>
      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      <TextInput
        style={styles.input}
        placeholder="Confirm Password"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry
      />
      <Button title="Sign Up" onPress={handleSignUp} />
      <Button
        title="Back to Login"
        onPress={() => navigation.navigate('Login')}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 10,
    marginBottom: 10,
    borderRadius: 5,
  },
});

export default SignUpScreen;
