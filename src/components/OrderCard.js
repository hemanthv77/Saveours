import React, { memo, useCallback, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  TextInput,
  Modal,
} from 'react-native';

// ============================================================
// CONSTANTS
// ============================================================
const COLORS = {
  primary: '#FF6B4A',
  primaryLight: '#FFF0ED',
  background: '#F5F5F5',
  white: '#FFFFFF',
  text: '#1A1A1A',
  textLight: '#666666',
  textMuted: '#888888',
  error: '#FF3B30',
  border: '#E0E0E0',
  success: '#34C759',
  successLight: '#E8F5E9',
  warning: '#FF9500',
  warningLight: '#FFF3E0',
  pending: '#2196F3',
  pendingLight: '#E3F2FD',
};

// Status configuration
const STATUS_CONFIG = {
  pending: {
    label: 'Pending',
    color: COLORS.pending,
    bgColor: COLORS.pendingLight,
  },
  confirmed: {
    label: 'Confirmed',
    color: COLORS.primary,
    bgColor: COLORS.primaryLight,
  },
  preparing: {
    label: 'Preparing',
    color: COLORS.warning,
    bgColor: COLORS.warningLight,
  },
  ready: {
    label: 'Ready for Pickup',
    color: COLORS.success,
    bgColor: COLORS.successLight,
  },
  completed: {
    label: 'Completed',
    color: COLORS.textMuted,
    bgColor: COLORS.background,
  },
  cancelled: {
    label: 'Cancelled',
    color: COLORS.error,
    bgColor: '#FFEBEE',
  },
};

// Format timestamp
const formatTime = (timestamp) => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;

  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * OrderCard - Reusable component for displaying order information
 * 
 * @param {Object} props
 * @param {Object} props.order - The order object
 * @param {boolean} props.isActive - Whether this is an active order
 * @param {Function} props.onStatusUpdate - Callback for status updates
 * @param {Function} props.onPress - Callback when card is pressed
 */
// Auto-cancel time (30 minutes in milliseconds)
const AUTO_CANCEL_TIME = 30 * 60 * 1000;

const OrderCard = memo(({
  order,
  isActive = true,
  onStatusUpdate,
  onCancelOrder,
  onMessageBuyer,
  onPress,
}) => {
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelNote, setCancelNote] = useState('');
  const [timeRemaining, setTimeRemaining] = useState(null);

  const statusConfig = STATUS_CONFIG[order?.orderStatus] || STATUS_CONFIG.pending;

  // Auto-cancel timer for pending orders
  useEffect(() => {
    if (order?.orderStatus !== 'pending' || !order?.createdAt) {
      setTimeRemaining(null);
      return;
    }

    const updateTimer = () => {
      const elapsed = Date.now() - order.createdAt;
      const remaining = AUTO_CANCEL_TIME - elapsed;

      if (remaining <= 0) {
        // Auto-cancel the order
        if (onCancelOrder) {
          onCancelOrder(order.id, order.buyerId, 'Order automatically cancelled - not confirmed within 30 minutes');
        }
        setTimeRemaining(0);
      } else {
        setTimeRemaining(remaining);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [order?.orderStatus, order?.createdAt, order?.id, order?.buyerId, onCancelOrder]);

  // Format remaining time
  const formatTimeRemaining = useCallback((ms) => {
    if (!ms || ms <= 0) return '0:00';
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, []);

  // Handle cancel button press
  const handleCancelPress = useCallback(() => {
    setShowCancelModal(true);
  }, []);

  // Handle cancel confirmation
  const handleConfirmCancel = useCallback(() => {
    if (onCancelOrder) {
      onCancelOrder(order.id, order.buyerId, cancelNote.trim() || 'Order cancelled by seller');
    }
    setShowCancelModal(false);
    setCancelNote('');
  }, [onCancelOrder, order?.id, order?.buyerId, cancelNote]);

  // Get next status action
  const getNextAction = useCallback(() => {
    switch (order?.orderStatus) {
      case 'pending':
        return { label: 'Confirm Order', status: 'confirmed' };
      case 'confirmed':
        return { label: 'Start Preparing', status: 'preparing' };
      case 'preparing':
        return { label: 'Mark Ready', status: 'ready' };
      case 'ready':
        return { label: 'Complete Order', status: 'completed' };
      default:
        return null;
    }
  }, [order?.orderStatus]);

  const nextAction = getNextAction();

  const handleActionPress = useCallback(() => {
    if (nextAction && onStatusUpdate) {
      onStatusUpdate(order.id, nextAction.status, order.buyerId);
    }
  }, [nextAction, onStatusUpdate, order]);

  if (!order) return null;

  return (
    <TouchableOpacity
      style={[styles.container, !isActive && styles.containerInactive]}
      onPress={() => onPress?.(order)}
      activeOpacity={0.7}
      disabled={!onPress}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.buyerInfo}>
          <View style={styles.buyerAvatar}>
            <Text style={styles.buyerAvatarText}>
              {order.buyerName?.charAt(0)?.toUpperCase() || '?'}
            </Text>
          </View>
          <View style={styles.buyerDetails}>
            <Text style={styles.buyerName}>{order.buyerName || 'Customer'}</Text>
            <Text style={styles.orderTime}>{formatTime(order.createdAt)}</Text>
          </View>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusConfig.bgColor }]}>
          <Text style={[styles.statusText, { color: statusConfig.color }]}>
            {statusConfig.label}
          </Text>
        </View>
      </View>

      {/* Order Items */}
      <View style={styles.itemsContainer}>
        {order.items?.map((item, index) => (
          <View key={index} style={styles.itemRow}>
            <View style={styles.itemLeft}>
              <Text style={styles.itemQty}>{item.quantity}x</Text>
              <Text style={styles.itemName} numberOfLines={1}>
                {item.dishName}
              </Text>
            </View>
            <Text style={styles.itemPrice}>₹{item.subtotal?.toFixed(2)}</Text>
          </View>
        ))}
      </View>

      {/* Order Total */}
      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Total Amount</Text>
        <Text style={styles.totalValue}>₹{order.totalAmount?.toFixed(2)}</Text>
      </View>

      {/* Contact Info */}
      {isActive && order.buyerPhone && (
        <View style={styles.contactRow}>
          <Text style={styles.contactIcon}>📞</Text>
          <Text style={styles.contactText}>{order.buyerPhone}</Text>
        </View>
      )}

      {/* Special Instructions */}
      {order.specialInstructions && (
        <View style={styles.instructionsRow}>
          <Text style={styles.instructionsIcon}>📝</Text>
          <Text style={styles.instructionsText} numberOfLines={2}>
            {order.specialInstructions}
          </Text>
        </View>
      )}

      {/* Payment Info */}
      <View style={styles.paymentRow}>
        <Text style={styles.paymentLabel}>Payment:</Text>
        <Text style={styles.paymentValue}>
          {order.paymentMethod === 'cash' ? 'Cash on Pickup' :
           order.paymentMethod === 'upi' ? 'UPI on Pickup' :
           order.paymentMethod || 'Pending'}
        </Text>
      </View>

      {/* Auto-cancel Timer for Pending Orders */}
      {isActive && order.orderStatus === 'pending' && timeRemaining !== null && (
        <View style={styles.timerRow}>
          <Text style={styles.timerIcon}>⏱️</Text>
          <Text style={styles.timerText}>
            Auto-cancels in {formatTimeRemaining(timeRemaining)}
          </Text>
        </View>
      )}

      {/* Action Buttons */}
      {isActive && nextAction && (
        <View style={styles.actionButtonsRow}>
          {/* Cancel Button - only show for pending orders */}
          {order.orderStatus === 'pending' && (
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleCancelPress}
              activeOpacity={0.8}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          )}
          
          {/* Message Buyer Button */}
          {onMessageBuyer && (
            <TouchableOpacity
              style={styles.messageButton}
              onPress={() => onMessageBuyer(order)}
              activeOpacity={0.8}
            >
              <Text style={styles.messageButtonIcon}>💬</Text>
              <Text style={styles.messageButtonText}>Message</Text>
            </TouchableOpacity>
          )}
          
          {/* Primary Action Button */}
          <TouchableOpacity
            style={[
              styles.actionButton,
              order.orderStatus === 'ready' && styles.actionButtonSuccess,
              order.orderStatus === 'pending' && styles.actionButtonFlex,
            ]}
            onPress={handleActionPress}
            activeOpacity={0.8}
          >
            <Text style={styles.actionButtonText}>{nextAction.label}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Order ID */}
      <Text style={styles.orderId}>
        Order #{order.id?.slice(-8).toUpperCase()}
      </Text>

      {/* Cancel Modal */}
      <Modal
        visible={showCancelModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCancelModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Cancel Order</Text>
            <Text style={styles.modalSubtitle}>
              Are you sure you want to cancel this order? The buyer will be notified.
            </Text>
            
            <TextInput
              style={styles.cancelNoteInput}
              placeholder="Add a reason (optional)"
              placeholderTextColor={COLORS.textMuted}
              value={cancelNote}
              onChangeText={setCancelNote}
              multiline
              numberOfLines={3}
              maxLength={200}
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => {
                  setShowCancelModal(false);
                  setCancelNote('');
                }}
              >
                <Text style={styles.modalCancelBtnText}>Go Back</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={handleConfirmCancel}
              >
                <Text style={styles.modalConfirmBtnText}>Cancel Order</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </TouchableOpacity>
  );
});

// ============================================================
// STYLES
// ============================================================
const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  containerInactive: {
    opacity: 0.7,
    backgroundColor: COLORS.background,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  buyerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  buyerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  buyerAvatarText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  buyerDetails: {
    flex: 1,
  },
  buyerName: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  orderTime: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },

  // Items
  itemsContainer: {
    backgroundColor: COLORS.background,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  itemQty: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
    marginRight: 8,
    minWidth: 28,
  },
  itemName: {
    fontSize: 14,
    color: COLORS.text,
    flex: 1,
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text,
    marginLeft: 8,
  },

  // Total
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    marginBottom: 12,
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.primary,
  },

  // Contact
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  contactIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  contactText: {
    fontSize: 14,
    color: COLORS.textLight,
  },

  // Instructions
  instructionsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
    backgroundColor: COLORS.warningLight,
    padding: 10,
    borderRadius: 8,
  },
  instructionsIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  instructionsText: {
    fontSize: 13,
    color: COLORS.text,
    flex: 1,
    fontStyle: 'italic',
  },

  // Payment
  paymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  paymentLabel: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginRight: 6,
  },
  paymentValue: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.text,
  },

  // Timer Row
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF3E0',
    padding: 8,
    borderRadius: 8,
    marginBottom: 12,
  },
  timerIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  timerText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#E65100',
  },

  // Action Buttons Row
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },

  // Action Button
  actionButton: {
    backgroundColor: COLORS.primary,
    height: 48,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
  },
  actionButtonFlex: {
    flex: 2,
  },
  actionButtonSuccess: {
    backgroundColor: COLORS.success,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.white,
  },

  // Cancel Button
  cancelButton: {
    backgroundColor: COLORS.white,
    height: 48,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
    borderWidth: 2,
    borderColor: COLORS.error,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.error,
  },

  // Message Button
  messageButton: {
    backgroundColor: COLORS.white,
    height: 48,
    borderRadius: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
    borderWidth: 2,
    borderColor: COLORS.primary,
    gap: 6,
  },
  messageButtonIcon: {
    fontSize: 14,
  },
  messageButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.error,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: COLORS.textLight,
    marginBottom: 16,
    lineHeight: 20,
  },
  cancelNoteInput: {
    backgroundColor: COLORS.background,
    borderRadius: 10,
    padding: 14,
    fontSize: 14,
    color: COLORS.text,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  modalCancelBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  modalConfirmBtn: {
    flex: 1,
    height: 48,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.error,
  },
  modalConfirmBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.white,
  },

  // Order ID
  orderId: {
    fontSize: 11,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
});

export default OrderCard;
