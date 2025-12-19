import React, { memo } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';

/**
 * CommunityCard Component
 * Displays a community card with image, name, location, member count, and description
 * Used in the CommunitiesScreen FlatList
 */
const CommunityCard = memo(({ community, onPress }) => {
  const {
    name,
    location,
    currentMembers,
    maxCapacity,
    description,
    imageUrl,
  } = community;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityLabel={`${name} community card`}
      accessibilityHint="Tap to view community details"
    >
      {/* Community Image */}
      <View style={styles.imageContainer}>
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={styles.image}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.placeholderImage}>
            <Text style={styles.placeholderText}>🍽️</Text>
          </View>
        )}
      </View>

      {/* Community Info */}
      <View style={styles.infoContainer}>
        {/* Community Name */}
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>

        {/* Location */}
        <View style={styles.row}>
          <Text style={styles.icon}>📍</Text>
          <Text style={styles.location} numberOfLines={1}>
            {location}
          </Text>
        </View>

        {/* Member Count */}
        <View style={styles.row}>
          <Text style={styles.icon}>👥</Text>
          <Text style={styles.members}>
            {currentMembers}/{maxCapacity} members
          </Text>
        </View>

        {/* Description Preview */}
        <Text style={styles.description} numberOfLines={2}>
          {description}
        </Text>
      </View>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginHorizontal: 8,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    overflow: 'hidden',
    flex: 1,
    maxWidth: '47%',
  },
  imageContainer: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#E0E0E0',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholderImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 32,
  },
  infoContainer: {
    padding: 12,
  },
  name: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  icon: {
    fontSize: 12,
    marginRight: 4,
  },
  location: {
    fontSize: 12,
    color: '#666666',
    flex: 1,
  },
  members: {
    fontSize: 12,
    color: '#666666',
  },
  description: {
    fontSize: 12,
    color: '#888888',
    marginTop: 6,
    lineHeight: 16,
  },
});

export default CommunityCard;
