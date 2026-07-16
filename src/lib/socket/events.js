/**
 * CaterSync AI — Socket.IO Event Constants
 *
 * Defines all valid event types for communication between client and server.
 * Ensures consistent event names and type-safety across the codebase.
 */

export const EVENTS = {
  // Connection / Status
  CONNECT:    'connect',
  DISCONNECT: 'disconnect',
  CONNECT_ERROR: 'connect_error',
  ERROR:      'error',
  SYSTEM:     'system',

  // Authentication
  AUTH_OK:    'auth.ok',

  // Room Management
  ROOM_JOINED: 'room.joined',
  ROOM_LEFT:   'room.left',

  // Bookings
  BOOKING_CREATED:   'booking.created',
  BOOKING_UPDATED:   'booking.updated',
  BOOKING_CONFIRMED: 'booking.confirmed',
  BOOKING_REJECTED:  'booking.rejected',
  BOOKING_COMPLETED: 'booking.completed',
  BOOKING_CANCELLED: 'booking.cancelled',

  // Notifications
  NOTIFICATION_CREATED: 'notification.created',
  NOTIFICATION_READ:    'notification.read',
  NOTIFICATION_DELETED: 'notification.deleted',

  // Payments
  PAYMENT_RECEIVED: 'payment.received',
  PAYMENT_UPDATED:  'payment.updated',
  PAYMENT_FAILED:   'payment.failed',

  // Inventory
  INVENTORY_UPDATED:      'inventory.updated',
  INVENTORY_LOW_STOCK:    'inventory.low_stock',
  INVENTORY_OUT_OF_STOCK: 'inventory.out_of_stock',

  // Dashboard Sync
  DASHBOARD_STATS_UPDATED: 'dashboard.stats.updated',

  // Chat
  CHAT_MESSAGE:   'chat.message',
  CHAT_TYPING:    'chat.typing',
  CHAT_DELIVERED: 'chat.delivered',
  CHAT_READ:      'chat.read',
  CHAT_DELETED:   'chat.deleted',

  // User presence
  USER_ONLINE:      'user.online',
  USER_OFFLINE:     'user.offline',
  USER_ONLINE_LIST: 'user.online_list',

  // Organization
  ORGANIZATION_UPDATED: 'organization.updated',
};
