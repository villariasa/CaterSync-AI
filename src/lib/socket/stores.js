/**
 * CaterSync AI — Svelte 5 Real-Time Reactive Stores
 *
 * Exposes reactive global state stores updated automatically via Socket.IO events.
 * Svelte 5 reactive class instances are imported directly into templates.
 */

// ── Notifications Store ──────────────────────────────────────────────────────
class NotificationsStore {
  list = $state([]);
  unreadCount = $derived(this.list.filter(n => !n.read).length);

  add(notification) {
    // Avoid duplicates
    if (this.list.some(n => n.id === notification.notificationId)) return;
    this.list = [{
      id: notification.notificationId || Date.now(),
      message: notification.message,
      type: notification.type || 'info',
      timestamp: notification.timestamp || new Date().toISOString(),
      read: false
    }, ...this.list];
  }

  markRead(notificationId) {
    this.list = this.list.map(n => n.id === notificationId ? { ...n, read: true } : n);
  }

  delete(notificationId) {
    this.list = this.list.filter(n => n.id !== notificationId);
  }
}

export const notificationsStore = new NotificationsStore();

// ── Online Users Store ────────────────────────────────────────────────────────
class OnlineUsersStore {
  users = $state([]);

  setList(list) {
    this.users = list;
  }

  add(user) {
    if (!this.users.some(u => u.userId === user.userId)) {
      this.users = [...this.users, {
        userId: user.userId,
        username: user.username,
        role: user.role || 'staff',
        connectedAt: new Date().toISOString(),
        lastSeen: new Date().toISOString()
      }];
    }
  }

  remove(userId) {
    this.users = this.users.filter(u => u.userId !== userId);
  }

  updatePresence(userId, lastSeen) {
    this.users = this.users.map(u => u.userId === userId ? { ...u, lastSeen } : u);
  }
}

export const onlineUsersStore = new OnlineUsersStore();

// ── Bookings Store ────────────────────────────────────────────────────────────
class BookingsStore {
  recentUpdates = $state([]); // list of recent real-time status changes

  logUpdate(bookingId, status, details = '') {
    this.recentUpdates = [{
      bookingId,
      status,
      details,
      timestamp: new Date().toISOString()
    }, ...this.recentUpdates.slice(0, 19)]; // keep last 20
  }
}

export const bookingsStore = new BookingsStore();

// ── Inventory Store ───────────────────────────────────────────────────────────
class InventoryStore {
  lowStockAlerts = $state([]);

  addAlert(ingredientId, name, quantity, threshold) {
    if (!this.lowStockAlerts.some(a => a.ingredientId === ingredientId)) {
      this.lowStockAlerts = [...this.lowStockAlerts, { ingredientId, name, quantity, threshold }];
    } else {
      this.lowStockAlerts = this.lowStockAlerts.map(a =>
        a.ingredientId === ingredientId ? { ...a, quantity } : a
      );
    }
  }

  removeAlert(ingredientId) {
    this.lowStockAlerts = this.lowStockAlerts.filter(a => a.ingredientId !== ingredientId);
  }
}

export const inventoryStore = new InventoryStore();

// ── Dashboard Store ───────────────────────────────────────────────────────────
class DashboardStore {
  stats = $state({
    totalRevenue: 0,
    todaySales: 0,
    pendingBookings: 0,
    activeEvents: 0
  });

  update(newStats) {
    this.stats = {
      totalRevenue: newStats.totalRevenue ?? this.stats.totalRevenue,
      todaySales: newStats.todaySales ?? this.stats.todaySales,
      pendingBookings: newStats.pendingBookings ?? this.stats.pendingBookings,
      activeEvents: newStats.activeEvents ?? this.stats.activeEvents
    };
  }
}

export const dashboardStore = new DashboardStore();

// ── Chat Store ────────────────────────────────────────────────────────────────
class ChatStore {
  messages = $state({}); // key: bookingId, value: Array of message objects
  typing = $state({});   // key: bookingId, value: Array of userIds currently typing

  addMessage(bookingId, msg) {
    if (!this.messages[bookingId]) {
      this.messages[bookingId] = [];
    }
    // Avoid duplicate messages (e.g. from connection state recovery or rapid clicks)
    if (this.messages[bookingId].some(m => m.messageId === msg.messageId)) return;
    this.messages[bookingId] = [...this.messages[bookingId], msg];
  }

  deleteMessage(bookingId, messageId) {
    if (this.messages[bookingId]) {
      this.messages[bookingId] = this.messages[bookingId].filter(m => m.messageId !== messageId);
    }
  }

  setTyping(bookingId, userId, username, isTyping) {
    if (!this.typing[bookingId]) {
      this.typing[bookingId] = [];
    }
    if (isTyping) {
      if (!this.typing[bookingId].some(t => t.userId === userId)) {
        this.typing[bookingId] = [...this.typing[bookingId], { userId, username }];
      }
    } else {
      this.typing[bookingId] = this.typing[bookingId].filter(t => t.userId !== userId);
    }
  }

  clearChat(bookingId) {
    this.messages[bookingId] = [];
    this.typing[bookingId] = [];
  }
}

export const chatStore = new ChatStore();
