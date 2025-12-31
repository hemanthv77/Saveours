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

// Components
import NotificationProvider from './src/components/NotificationProvider';

// Screens
import LoginScreen from './src/screens/LoginScreen';
import SignUpScreen from './src/screens/SignUpScreen';
import CommunitiesScreen from './src/screens/CommunitiesScreen';
import CommunityDetailScreen from './src/screens/CommunityDetailScreen';
import CommunityFeedScreen from './src/screens/CommunityFeedScreen';
import MyCommunitiesScreen from './src/screens/MyCommunitiesScreen';
import MyAccountScreen from './src/screens/MyAccountScreen';
import TodaysMenuScreen from './src/screens/TodaysMenuScreen';
import CartScreen from './src/screens/CartScreen';
import CheckoutScreen from './src/screens/CheckoutScreen';
import OrderConfirmationScreen from './src/screens/OrderConfirmationScreen';
import MyOrdersScreen from './src/screens/MyOrdersScreen';
import BuyerOrdersScreen from './src/screens/BuyerOrdersScreen';
import OrderDetailScreen from './src/screens/OrderDetailScreen';
import ChatScreen from './src/screens/ChatScreen';
import NotificationsScreen from './src/screens/NotificationsScreen';

const Stack = createNativeStackNavigator();

function App() {
  return (
    <Provider store={store}>
      <SafeAreaProvider>
        <StatusBar barStyle="dark-content" />
        <NotificationProvider>
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
            <Stack.Screen 
              name="Cart" 
              component={CartScreen}
              options={{ title: "Today's Cart" }}
            />
            <Stack.Screen 
              name="Checkout" 
              component={CheckoutScreen}
              options={{ title: "Checkout" }}
            />
            <Stack.Screen 
              name="OrderConfirmation" 
              component={OrderConfirmationScreen}
              options={{ title: "Order Confirmed", headerBackVisible: false }}
            />
            <Stack.Screen 
              name="MyOrders" 
              component={MyOrdersScreen}
              options={{ title: "Received Orders" }}
            />
            <Stack.Screen 
              name="BuyerOrders" 
              component={BuyerOrdersScreen}
              options={{ title: "Placed Orders" }}
            />
            <Stack.Screen 
              name="OrderDetail" 
              component={OrderDetailScreen}
              options={{ title: "Order Details" }}
            />
            <Stack.Screen 
              name="Chat" 
              component={ChatScreen}
              options={{ title: "Chat" }}
            />
            <Stack.Screen 
              name="Notifications" 
              component={NotificationsScreen}
              options={{ title: "Notifications" }}
            />
          </Stack.Navigator>
        </NavigationContainer>
        </NotificationProvider>
      </SafeAreaProvider>
    </Provider>
  );
}

export default App;
