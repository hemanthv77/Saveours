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
import LoginScreen from './src/screens/LoginScreen';
import SignUpScreen from './src/screens/SignUpScreen';
import CommunitiesScreen from './src/screens/CommunitiesScreen';
import CommunityDetailScreen from './src/screens/CommunityDetailScreen';
import CommunityFeedScreen from './src/screens/CommunityFeedScreen';
import MyCommunitiesScreen from './src/screens/MyCommunitiesScreen';
import MyAccountScreen from './src/screens/MyAccountScreen';
import TodaysMenuScreen from './src/screens/TodaysMenuScreen';

const Stack = createNativeStackNavigator();

function App() {
  return (
    <Provider store={store}>
      <SafeAreaProvider>
        <StatusBar barStyle="dark-content" />
        <NavigationContainer>
          <Stack.Navigator initialRouteName="Login">
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
              component={CommunityDetailScreen}
              options={{ title: 'Community Details' }}
            />
            <Stack.Screen
              name="CommunityFeed"
              component={CommunityFeedScreen}
              options={{ title: 'Community Feed' }}
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
            <Stack.Screen 
              name="TodaysMenu" 
              component={TodaysMenuScreen}
              options={{ title: "Today's Menu" }}
            />
          </Stack.Navigator>
        </NavigationContainer>
      </SafeAreaProvider>
    </Provider>
  );
}

export default App;
