import React, { memo, useCallback, useMemo, useState, useRef } from 'react';
import {
  Dimensions,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import auth from '@react-native-firebase/auth';
import { useSelector } from 'react-redux';
import { selectOrderCounts } from '../redux/creatorOrdersSlice';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_MARGIN = 16;
const CARD_PADDING = 16;
const IMAGE_WIDTH = SCREEN_WIDTH - (CARD_MARGIN * 2) - (CARD_PADDING * 2);

const COLORS = {
  primary: '#FF6B4A',
  primaryLight: '#FFF0ED',
  white: '#FFFFFF',
  text: '#1A1A1A',
  textLight: '#666666',
  textMuted: '#888888',
  border: '#E0E0E0',
  borderLight: '#EEEEEE',
  soldOut: '#FF3B30',
  lowStock: '#FF9500',
  disabled: '#CCCCCC',
};

// Helper to format relative time
const formatTimeAgo = (timestamp) => {
  if (!timestamp) return '';
  const now = new Date();
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
};

// Get user initials for avatar fallback
const getInitials = (name) => {
  if (!name) return '?';
  const parts = name.trim().split(' ').filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};

/**
 * KitchenCard - A reusable component for displaying food posts
 * 
 * @param {Object} props
 * @param {Object} props.post - The post object containing:
 *   - postId: string
 *   - userId: string
 *   - userName: string
 *   - userAvatar: string (optional)
 *   - dishes: Array of dish objects
 *   - createdAt: timestamp
 *   - status: 'active' | 'expired' | 'sold_out' | 'manually_closed'
 * @param {Function} props.onPress - Callback when card is pressed, receives post object
 * @param {Function} props.onBuyPress - Optional custom handler for buy button
 */
const KitchenCard = memo(({ post, onPress, onBuyPress }) => {
  const navigation = useNavigation();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  
  // Check if current user is the post creator
  const currentUserId = auth().currentUser?.uid;
  const isOwnPost = currentUserId && post?.userId === currentUserId;
  
  // Get order counts for this post from Redux
  const orderCounts = useSelector(selectOrderCounts);
  const postId = post?.postId || post?.id;
  const postOrderCount = orderCounts[postId] || 0;

  // Collect all photos from all dishes with dish name association
  const allPhotos = useMemo(() => {
    if (!post?.dishes || !Array.isArray(post.dishes)) return [];
    const photos = [];
    post.dishes.forEach((dish) => {
      (dish.photos || []).forEach((photoUrl) => {
        if (photoUrl) {
          photos.push({
            url: photoUrl,
            dishName: dish.name || 'Unnamed dish',
          });
        }
      });
    });
    return photos;
  }, [post?.dishes]);

  // Handle photo scroll for page indicator
  const handleViewableItemsChanged = useCallback(({ viewableItems }) => {
    if (viewableItems.length > 0) {
      setCurrentImageIndex(viewableItems[0].index || 0);
    }
  }, []);

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  const displayName = post?.userName || 'Anonymous';
  const timeAgo = formatTimeAgo(post?.createdAt);

  // Determine if all dishes are sold out
  const isAllSoldOut = useMemo(() => {
    if (!post?.dishes || post.dishes.length === 0) return true;
    return post.dishes.every((dish) => {
      const available = (dish.portionsAvailable || 0) - (dish.portionsReserved || 0) - (dish.portionsSold || 0);
      return available <= 0;
    });
  }, [post?.dishes]);

  // Check if post is expired or closed
  const isExpiredOrClosed = useMemo(() => {
    if (!post) return true;
    if (post.status === 'expired' || post.status === 'manually_closed') return true;
    if (post.expiresAt) {
      const expiryDate = post.expiresAt.toDate ? post.expiresAt.toDate() : new Date(post.expiresAt);
      return new Date() > expiryDate;
    }
    return false;
  }, [post]);

  // Determine button state
  const buttonState = useMemo(() => {
    if (isOwnPost) {
      // Show "View Orders (X)" if there are orders, otherwise "Your Post"
      if (postOrderCount > 0) {
        return { 
          disabled: false, 
          text: `View Orders (${postOrderCount})`, 
          isOwn: true,
          hasOrders: true 
        };
      }
      return { disabled: true, text: 'Your Post', isOwn: true, hasOrders: false };
    }
    if (isExpiredOrClosed) {
      return { disabled: true, text: 'No Longer Available' };
    }
    if (isAllSoldOut || post?.status === 'sold_out') {
      return { disabled: true, text: 'Sold Out' };
    }
    return { disabled: false, text: 'View & Order' };
  }, [isOwnPost, isExpiredOrClosed, isAllSoldOut, post?.status, postOrderCount]);

  // Handle buy button press
  const handleBuyPress = useCallback(() => {
    // If it's creator's own post with orders, navigate to MyOrders
    if (buttonState.isOwn && buttonState.hasOrders) {
      navigation.navigate('MyOrders', {
        postId: post.postId || post.id,
        postTitle: post.dishes?.[0]?.name || 'Your Post',
      });
      return;
    }
    
    if (buttonState.disabled) return;
    
    if (onBuyPress) {
      onBuyPress(post);
    } else {
      navigation.navigate('Cart', {
        postId: post.postId || post.id,
        sellerId: post.userId,
        sellerName: post.userName,
        dishes: post.dishes,
      });
    }
  }, [buttonState, onBuyPress, post, navigation]);

  if (!post) return null;

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={() => onPress?.(post)}
      activeOpacity={0.7}
      accessibilityLabel={`${displayName}'s kitchen post`}
      accessibilityRole="button"
    >
      {/* Card Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {post.userAvatar ? (
            <Image source={{ uri: post.userAvatar }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarText}>{getInitials(displayName)}</Text>
            </View>
          )}
          <View style={styles.userInfo}>
            <Text style={styles.userName} numberOfLines={1}>
              {displayName}'s Kitchen
            </Text>
            <Text style={styles.timeAgo}>{timeAgo}</Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.moreButton}
          accessibilityLabel="More options"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={styles.moreButtonText}>⋮</Text>
        </TouchableOpacity>
      </View>

      {/* Photos Section */}
      {allPhotos.length > 0 ? (
        <View style={styles.photosContainer}>
          <FlatList
            data={allPhotos}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onViewableItemsChanged={handleViewableItemsChanged}
            viewabilityConfig={viewabilityConfig}
            keyExtractor={(item, index) => `photo-${index}`}
            renderItem={({ item }) => (
              <View style={styles.photoWrapper}>
                <Image
                  source={{ uri: item.url }}
                  style={styles.photo}
                  resizeMode="cover"
                />
                <View style={styles.dishNameOverlay}>
                  <Text style={styles.dishNameText} numberOfLines={1}>
                    {item.dishName}
                  </Text>
                </View>
              </View>
            )}
            getItemLayout={(data, index) => ({
              length: IMAGE_WIDTH,
              offset: IMAGE_WIDTH * index,
              index,
            })}
          />
          {allPhotos.length > 1 && (
            <View style={styles.pageIndicators}>
              {allPhotos.map((_, index) => (
                <View
                  key={`indicator-${index}`}
                  style={[
                    styles.pageIndicator,
                    index === currentImageIndex && styles.pageIndicatorActive,
                  ]}
                />
              ))}
            </View>
          )}
        </View>
      ) : (
        <View style={styles.noPhotoPlaceholder}>
          <Text style={styles.noPhotoIcon}>🍽️</Text>
          <Text style={styles.noPhotoText}>No photos</Text>
        </View>
      )}

      {/* Dishes List */}
      <View style={styles.dishesList}>
        {(post.dishes || []).map((dish, index) => {
          const portionsAvailable = dish.portionsAvailable || 0;
          const portionsReserved = dish.portionsReserved || 0;
          const portionsSold = dish.portionsSold || 0;
          const available = portionsAvailable - portionsReserved - portionsSold;
          
          const isSoldOut = available <= 0;
          const isLowStock = available > 0 && available < 3;

          return (
            <View key={dish.dishId || `dish-${index}`} style={styles.dishRow}>
              <Text style={styles.dishName} numberOfLines={1}>
                {dish.name || 'Unnamed dish'}
              </Text>
              <View style={styles.dishDetails}>
                <Text style={styles.dishPrice}>
                  ₹{dish.pricePerPortion || 0}/portion
                </Text>
                <Text style={styles.separator}>•</Text>
                {isSoldOut ? (
                  <Text style={styles.soldOutText}>Sold Out</Text>
                ) : (
                  <Text
                    style={[
                      styles.availableText,
                      isLowStock && styles.lowStockText,
                    ]}
                  >
                    {available} available
                  </Text>
                )}
              </View>
            </View>
          );
        })}
      </View>

      {/* Card Footer with Buy Button */}
      <View style={styles.cardFooter}>
        <TouchableOpacity
          style={[
            styles.buyButton,
            buttonState.disabled && styles.buyButtonDisabled,
            buttonState.isOwn && !buttonState.hasOrders && styles.buyButtonOwn,
            buttonState.hasOrders && styles.buyButtonViewOrders,
          ]}
          onPress={handleBuyPress}
          disabled={buttonState.disabled && !buttonState.hasOrders}
          activeOpacity={0.8}
          accessibilityLabel={buttonState.text}
          accessibilityRole="button"
        >
          <Text
            style={[
              styles.buyButtonText,
              buttonState.disabled && styles.buyButtonTextDisabled,
              buttonState.isOwn && !buttonState.hasOrders && styles.buyButtonTextOwn,
              buttonState.hasOrders && styles.buyButtonTextViewOrders,
            ]}
          >
            {buttonState.text}
          </Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: CARD_PADDING,
    marginHorizontal: CARD_MARGIN,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.border,
  },
  avatarFallback: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '800',
  },
  userInfo: {
    marginLeft: 10,
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  timeAgo: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  moreButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreButtonText: {
    fontSize: 18,
    color: COLORS.textMuted,
    fontWeight: '700',
  },

  // Photos
  photosContainer: {
    marginBottom: 12,
    borderRadius: 12,
    overflow: 'hidden',
  },
  photoWrapper: {
    width: IMAGE_WIDTH,
    height: 200,
    position: 'relative',
  },
  photo: {
    width: IMAGE_WIDTH,
    height: 200,
    backgroundColor: COLORS.border,
  },
  dishNameOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  dishNameText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '600',
  },
  pageIndicators: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 8,
    gap: 6,
  },
  pageIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.border,
  },
  pageIndicatorActive: {
    backgroundColor: COLORS.primary,
    width: 18,
  },

  // No photo placeholder
  noPhotoPlaceholder: {
    height: 120,
    backgroundColor: COLORS.primaryLight,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  noPhotoIcon: {
    fontSize: 40,
  },
  noPhotoText: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 4,
  },

  // Dishes list
  dishesList: {
    gap: 8,
  },
  dishRow: {
    marginBottom: 4,
  },
  dishName: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 2,
  },
  dishDetails: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dishPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
  },
  separator: {
    fontSize: 14,
    color: COLORS.textMuted,
    marginHorizontal: 8,
  },
  availableText: {
    fontSize: 14,
    color: COLORS.textMuted,
  },
  lowStockText: {
    color: COLORS.lowStock,
    fontWeight: '600',
  },
  soldOutText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.soldOut,
  },

  // Card Footer
  cardFooter: {
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
    paddingTop: 12,
    marginTop: 12,
  },
  buyButton: {
    backgroundColor: COLORS.primary,
    height: 44,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  buyButtonDisabled: {
    backgroundColor: COLORS.disabled,
    shadowOpacity: 0,
    elevation: 0,
  },
  buyButtonOwn: {
    backgroundColor: COLORS.primaryLight,
    borderWidth: 1,
    borderColor: COLORS.primary,
    shadowOpacity: 0,
    elevation: 0,
  },
  buyButtonViewOrders: {
    backgroundColor: '#2196F3',
    borderWidth: 0,
    shadowColor: '#2196F3',
    shadowOpacity: 0.3,
    elevation: 3,
  },
  buyButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  buyButtonTextDisabled: {
    color: COLORS.white,
  },
  buyButtonTextOwn: {
    color: COLORS.primary,
  },
  buyButtonTextViewOrders: {
    color: COLORS.white,
  },
});

export default KitchenCard;
