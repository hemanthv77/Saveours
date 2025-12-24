module.exports = {
  preset: 'react-native',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  transformIgnorePatterns: [
    'node_modules/(?!(react-native'
      + '|@react-native'
      + '|@react-native-community'
      + '|@react-navigation'
      + '|react-redux'
      + '|@reduxjs'
      + '|react-native-screens'
      + '|react-native-safe-area-context'
      + '|@react-native-firebase'
      + ')/)',
  ],
};
