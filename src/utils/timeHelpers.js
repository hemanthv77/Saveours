import { formatDistanceToNow } from 'date-fns';

/**
 * Converts Firestore timestamp to "2 hours ago" format
 * @param {Object} timestamp - Firestore timestamp object
 * @returns {string} Formatted time string like "2 hours ago"
 */
export const formatPostTime = (timestamp) => {
  if (!timestamp) return '';
  
  // Handle both Firestore timestamps and milliseconds
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return formatDistanceToNow(date, { addSuffix: true });
};

/**
 * Returns timestamp for end of current day (11:59:59 PM)
 * @returns {Date} End of day date object
 */
export const getEndOfDay = () => {
  const now = new Date();
  const endOfDay = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    23,
    59,
    59
  );
  return endOfDay;
};

/**
 * Checks if post has expired
 * @param {Object} expiresAt - Firestore timestamp or Date object
 * @returns {boolean} True if expired
 */
export const isExpired = (expiresAt) => {
  if (!expiresAt) return false;
  
  // Handle both Firestore timestamps and milliseconds
  const expiryDate = expiresAt.toDate ? expiresAt.toDate() : new Date(expiresAt);
  return new Date() > expiryDate;
};

/**
 * Gets remaining time until expiry in human-readable format
 * @param {Object} expiresAt - Firestore timestamp or Date object
 * @returns {string} Formatted remaining time
 */
export const getRemainingTime = (expiresAt) => {
  if (!expiresAt) return '';
  
  const expiryDate = expiresAt.toDate ? expiresAt.toDate() : new Date(expiresAt);
  const now = new Date();
  
  if (now > expiryDate) {
    return 'Expired';
  }
  
  return formatDistanceToNow(expiryDate, { addSuffix: false }) + ' left';
};
