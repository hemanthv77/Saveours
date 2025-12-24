try {
  // eslint-disable-next-line global-require
  require('react-native-gesture-handler/jestSetup');
} catch (_) {
  // react-native-gesture-handler isn't installed in this project
}

// Silence the warning: Animated: `useNativeDriver` is not supported because the native animated module is missing
// (Path differs across RN versions)
try {
  // eslint-disable-next-line global-require
  require.resolve('react-native/Libraries/Animated/NativeAnimatedHelper');
  jest.mock('react-native/Libraries/Animated/NativeAnimatedHelper', () => ({}));
} catch (_) {
  // no-op
}

// React Navigation uses native modules that aren't present in Jest
jest.mock('react-native-screens', () => {
  const actual = jest.requireActual('react-native-screens');
  return {
    ...actual,
    enableScreens: jest.fn(),
  };
});

jest.mock('react-native-safe-area-context', () => {
  const actual = jest.requireActual('react-native-safe-area-context');
  return {
    ...actual,
    SafeAreaProvider: ({ children }) => children,
    SafeAreaConsumer: ({ children }) => children({ top: 0, right: 0, bottom: 0, left: 0 }),
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  };
});
