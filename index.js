/**
 * @format
 */

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import { setBackgroundMessageHandler } from './src/services/NotificationService';

// Set up background message handler for FCM
// This must be called before AppRegistry.registerComponent
setBackgroundMessageHandler();

AppRegistry.registerComponent(appName, () => App);
