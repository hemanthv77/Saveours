/**
 * Food Sharing App
 * @format
 */

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Provider } from 'react-redux';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'react-native';

// Redux Store
import store from './src/redux/store';

// Screens
import HomeScreen from './src/screens/HomeScreen';
import LoginScreen from './src/screens/LoginScreen';
import SignUpScreen from './src/screens/SignUpScreen';
import CommunitiesScreen from './src/screens/CommunitiesScreen';
import MyCommunitiesScreen from './src/screens/MyCommunitiesScreen';
import MyAccountScreen from './src/screens/MyAccountScreen';

const Stack = createNativeStackNavigator();

function App() {
  return (
    <Provider store={store}>
      <SafeAreaProvider>
        <StatusBar barStyle="dark-content" />
        <NavigationContainer>
          <Stack.Navigator initialRouteName="Home">
            <Stack.Screen 
              name="Home" 
              component={HomeScreen}
              options={{ title: 'Saveours - Food Sharing' }}
            />
            <Stack.Screen 
              name="Login" 
              component={LoginScreen}
              options={{ title: 'Login' }}
            />
            <Stack.Screen 
              name="SignUp" 
              component={SignUpScreen}
              options={{ title: 'Sign Up' }}
            />
            <Stack.Screen 
              name="Communities" 
              component={CommunitiesScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen 
              name="CommunityDetail" 
              component={CommunitiesScreen}
              options={{ title: 'Community Details' }}
            />
            <Stack.Screen 
              name="MyCommunities" 
              component={MyCommunitiesScreen}
              options={{ title: 'My Communities' }}
            />
            <Stack.Screen 
              name="MyAccount" 
              component={MyAccountScreen}
              options={{ title: 'My Account' }}
            />
          </Stack.Navigator>
        </NavigationContainer>
      </SafeAreaProvider>
    </Provider>
  );
}

export default App;
