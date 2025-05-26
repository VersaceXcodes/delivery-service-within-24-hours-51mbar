import { configureStore, createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { persistStore, persistReducer, FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER } from 'redux-persist';
import storage from 'redux-persist/lib/storage';
import { io, Socket } from 'socket.io-client';
import axios from 'axios';

// Types
interface User {
  uid: string;
  email: string;
  user_type: 'sender' | 'courier' | 'business_admin';
  first_name: string;
  last_name: string;
  profile_photo_url: string;
  is_email_verified: boolean;
  is_phone_verified: boolean;
  preferred_language: string;
  timezone: string;
}

interface Session {
  access_token: string;
  refresh_token: string;
  expires_at: string;
  is_authenticated: boolean;
  last_activity: string;
}

interface Permissions {
  can_create_deliveries: boolean;
  can_manage_team: boolean;
  can_view_analytics: boolean;
  can_process_payments: boolean;
}

interface AuthState {
  user: User | null;
  session: Session | null;
  permissions: Permissions;
  loading: boolean;
  error: string | null;
}

interface Notification {
  uid: string;
  type: 'delivery_status' | 'payment' | 'system' | 'emergency';
  title: string;
  message: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  is_read: boolean;
  created_at: string;
  action_url?: string;
  metadata?: any;
}

interface NotificationPreferences {
  push_enabled: boolean;
  sms_enabled: boolean;
  email_enabled: boolean;
  do_not_disturb_hours: {
    start: string;
    end: string;
    timezone: string;
  };
}

interface NotificationsState {
  unread_count: number;
  notifications: Notification[];
  preferences: NotificationPreferences;
  toast_queue: Notification[];
  show_notification_center: boolean;
}

interface WebSocketConnection {
  status: 'connecting' | 'connected' | 'disconnected' | 'error';
  last_ping: string;
  reconnect_attempts: number;
  connection_quality: 'poor' | 'fair' | 'good' | 'excellent';
}

interface CourierLocation {
  latitude: number;
  longitude: number;
  heading: number;
  updated_at: string;
  accuracy: number;
}

interface DeliveryStatus {
  status: string;
  timestamp: string;
  courier_info?: any;
}

interface RealtimeState {
  websocket_connection: WebSocketConnection;
  active_subscriptions: Array<{
    channel: string;
    subscription_id: string;
    last_message: string;
  }>;
  courier_location_updates: Record<string, CourierLocation>;
  delivery_status_updates: Record<string, DeliveryStatus>;
}

interface AccessibilitySettings {
  high_contrast: boolean;
  large_fonts: boolean;
  screen_reader: boolean;
  keyboard_navigation: boolean;
}

interface PerformanceSettings {
  offline_mode: boolean;
  cache_enabled: boolean;
  background_sync: boolean;
  reduced_motion: boolean;
}

interface PrivacySettings {
  analytics_enabled: boolean;
  location_tracking: boolean;
  marketing_communications: boolean;
  data_sharing_consent: boolean;
}

interface AppSettingsState {
  theme: 'light' | 'dark' | 'auto';
  language: string;
  currency: string;
  timezone: string;
  accessibility: AccessibilitySettings;
  performance: PerformanceSettings;
  privacy: PrivacySettings;
}

interface ErrorDetails {
  error_id: string;
  type: 'network' | 'authentication' | 'validation' | 'server' | 'client';
  message: string;
  technical_details: string;
  timestamp: string;
  user_action_required: boolean;
  retry_available: boolean;
  escalation_needed: boolean;
}

interface NetworkStatus {
  is_online: boolean;
  connection_type: string;
  last_sync: string;
  pending_requests: number;
}

interface ErrorReporting {
  automatic_reporting: boolean;
  user_consent: boolean;
  debug_mode: boolean;
}

interface ErrorState {
  global_errors: ErrorDetails[];
  view_specific_errors: Record<string, ErrorDetails[]>;
  network_status: NetworkStatus;
  error_reporting: ErrorReporting;
}

// Root State
interface RootState {
  auth: AuthState;
  notifications: NotificationsState;
  realtime: RealtimeState;
  app_settings: AppSettingsState;
  error: ErrorState;
}

// Websocket instance
let socket: Socket | null = null;

// Async Thunks
export const authenticate_user = createAsyncThunk(
  'auth/authenticate',
  async (credentials: { login_identifier: string; password: string; remember_me?: boolean }) => {
    const response = await axios.post('/api/v1/auth/login', credentials);
    return response.data;
  }
);

export const refresh_auth_token = createAsyncThunk(
  'auth/refresh',
  async (refresh_token: string) => {
    const response = await axios.post('/api/v1/auth/refresh', { refresh_token });
    return response.data;
  }
);

export const load_user_profile = createAsyncThunk(
  'auth/load_profile',
  async () => {
    const response = await axios.get('/api/v1/auth/profile');
    return response.data;
  }
);

export const update_notification_preferences = createAsyncThunk(
  'notifications/update_preferences',
  async (preferences: NotificationPreferences) => {
    const response = await axios.put('/api/v1/auth/profile', {
      notification_preferences: JSON.stringify(preferences)
    });
    return preferences;
  }
);

export const load_notifications = createAsyncThunk(
  'notifications/load',
  async (params: { page?: number; limit?: number; unread_only?: boolean } = {}) => {
    const response = await axios.get('/api/v1/notifications', { params });
    return response.data;
  }
);

export const mark_notification_read = createAsyncThunk(
  'notifications/mark_read',
  async (notification_uid: string) => {
    await axios.put(`/api/v1/notifications/${notification_uid}/read`);
    return notification_uid;
  }
);

export const mark_all_notifications_read = createAsyncThunk(
  'notifications/mark_all_read',
  async () => {
    await axios.put('/api/v1/notifications/mark-all-read');
    return true;
  }
);

export const update_app_settings = createAsyncThunk(
  'app_settings/update',
  async (settings: Partial<AppSettingsState>) => {
    const response = await axios.put('/api/v1/auth/profile', settings);
    return settings;
  }
);

// Auth Slice
const auth_slice = createSlice({
  name: 'auth',
  initialState: {
    user: null,
    session: null,
    permissions: {
      can_create_deliveries: false,
      can_manage_team: false,
      can_view_analytics: false,
      can_process_payments: false,
    },
    loading: false,
    error: null,
  } as AuthState,
  reducers: {
    clear_auth_state: (state) => {
      state.user = null;
      state.session = null;
      state.permissions = {
        can_create_deliveries: false,
        can_manage_team: false,
        can_view_analytics: false,
        can_process_payments: false,
      };
      state.error = null;
    },
    set_auth_error: (state, action: PayloadAction<string>) => {
      state.error = action.payload;
    },
    update_last_activity: (state) => {
      if (state.session) {
        state.session.last_activity = new Date().toISOString();
      }
    },
    update_user_profile: (state, action: PayloadAction<Partial<User>>) => {
      if (state.user) {
        state.user = { ...state.user, ...action.payload };
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(authenticate_user.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(authenticate_user.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload.user;
        state.session = {
          access_token: action.payload.access_token,
          refresh_token: action.payload.refresh_token,
          expires_at: new Date(Date.now() + action.payload.expires_in * 1000).toISOString(),
          is_authenticated: true,
          last_activity: new Date().toISOString(),
        };
        
        // Set permissions based on user type
        const userType = action.payload.user.user_type;
        state.permissions = {
          can_create_deliveries: ['sender', 'business_admin'].includes(userType),
          can_manage_team: userType === 'business_admin',
          can_view_analytics: ['business_admin', 'manager'].includes(userType),
          can_process_payments: ['sender', 'business_admin'].includes(userType),
        };

        // Set axios default headers
        axios.defaults.headers.common['Authorization'] = `Bearer ${action.payload.access_token}`;
      })
      .addCase(authenticate_user.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Authentication failed';
      })
      .addCase(refresh_auth_token.fulfilled, (state, action) => {
        if (state.session) {
          state.session.access_token = action.payload.access_token;
          state.session.expires_at = new Date(Date.now() + action.payload.expires_in * 1000).toISOString();
          axios.defaults.headers.common['Authorization'] = `Bearer ${action.payload.access_token}`;
        }
      })
      .addCase(load_user_profile.fulfilled, (state, action) => {
        state.user = action.payload;
      });
  },
});

// Notifications Slice
const notifications_slice = createSlice({
  name: 'notifications',
  initialState: {
    unread_count: 0,
    notifications: [],
    preferences: {
      push_enabled: true,
      sms_enabled: true,
      email_enabled: true,
      do_not_disturb_hours: {
        start: '22:00',
        end: '07:00',
        timezone: 'UTC',
      },
    },
    toast_queue: [],
    show_notification_center: false,
  } as NotificationsState,
  reducers: {
    add_notification: (state, action: PayloadAction<Notification>) => {
      state.notifications.unshift(action.payload);
      if (!action.payload.is_read) {
        state.unread_count += 1;
      }
    },
    add_toast_notification: (state, action: PayloadAction<Notification>) => {
      state.toast_queue.push(action.payload);
    },
    remove_toast_notification: (state, action: PayloadAction<string>) => {
      state.toast_queue = state.toast_queue.filter(toast => toast.uid !== action.payload);
    },
    toggle_notification_center: (state) => {
      state.show_notification_center = !state.show_notification_center;
    },
    set_notification_center_visibility: (state, action: PayloadAction<boolean>) => {
      state.show_notification_center = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(load_notifications.fulfilled, (state, action) => {
        state.notifications = action.payload.notifications;
        state.unread_count = action.payload.unread_count;
      })
      .addCase(mark_notification_read.fulfilled, (state, action) => {
        const notification = state.notifications.find(n => n.uid === action.payload);
        if (notification && !notification.is_read) {
          notification.is_read = true;
          state.unread_count = Math.max(0, state.unread_count - 1);
        }
      })
      .addCase(mark_all_notifications_read.fulfilled, (state) => {
        state.notifications.forEach(notification => {
          notification.is_read = true;
        });
        state.unread_count = 0;
      })
      .addCase(update_notification_preferences.fulfilled, (state, action) => {
        state.preferences = action.payload;
      });
  },
});

// Realtime Slice
const realtime_slice = createSlice({
  name: 'realtime',
  initialState: {
    websocket_connection: {
      status: 'disconnected',
      last_ping: '',
      reconnect_attempts: 0,
      connection_quality: 'good',
    },
    active_subscriptions: [],
    courier_location_updates: {},
    delivery_status_updates: {},
  } as RealtimeState,
  reducers: {
    set_websocket_status: (state, action: PayloadAction<RealtimeState['websocket_connection']['status']>) => {
      state.websocket_connection.status = action.payload;
      if (action.payload === 'connected') {
        state.websocket_connection.reconnect_attempts = 0;
      }
    },
    increment_reconnect_attempts: (state) => {
      state.websocket_connection.reconnect_attempts += 1;
    },
    update_last_ping: (state) => {
      state.websocket_connection.last_ping = new Date().toISOString();
    },
    add_subscription: (state, action: PayloadAction<{ channel: string; subscription_id: string }>) => {
      const existing = state.active_subscriptions.find(sub => sub.channel === action.payload.channel);
      if (!existing) {
        state.active_subscriptions.push({
          ...action.payload,
          last_message: new Date().toISOString(),
        });
      }
    },
    remove_subscription: (state, action: PayloadAction<string>) => {
      state.active_subscriptions = state.active_subscriptions.filter(
        sub => sub.channel !== action.payload
      );
    },
    update_courier_location: (state, action: PayloadAction<{ delivery_uid: string; location: CourierLocation }>) => {
      state.courier_location_updates[action.payload.delivery_uid] = action.payload.location;
    },
    update_delivery_status: (state, action: PayloadAction<{ delivery_uid: string; status: DeliveryStatus }>) => {
      state.delivery_status_updates[action.payload.delivery_uid] = action.payload.status;
    },
    set_connection_quality: (state, action: PayloadAction<RealtimeState['websocket_connection']['connection_quality']>) => {
      state.websocket_connection.connection_quality = action.payload;
    },
  },
});

// App Settings Slice
const app_settings_slice = createSlice({
  name: 'app_settings',
  initialState: {
    theme: 'light',
    language: 'en',
    currency: 'USD',
    timezone: 'UTC',
    accessibility: {
      high_contrast: false,
      large_fonts: false,
      screen_reader: false,
      keyboard_navigation: true,
    },
    performance: {
      offline_mode: false,
      cache_enabled: true,
      background_sync: true,
      reduced_motion: false,
    },
    privacy: {
      analytics_enabled: true,
      location_tracking: true,
      marketing_communications: false,
      data_sharing_consent: true,
    },
  } as AppSettingsState,
  reducers: {
    update_theme: (state, action: PayloadAction<AppSettingsState['theme']>) => {
      state.theme = action.payload;
    },
    update_language: (state, action: PayloadAction<string>) => {
      state.language = action.payload;
    },
    update_currency: (state, action: PayloadAction<string>) => {
      state.currency = action.payload;
    },
    update_timezone: (state, action: PayloadAction<string>) => {
      state.timezone = action.payload;
    },
    update_accessibility_settings: (state, action: PayloadAction<Partial<AccessibilitySettings>>) => {
      state.accessibility = { ...state.accessibility, ...action.payload };
    },
    update_performance_settings: (state, action: PayloadAction<Partial<PerformanceSettings>>) => {
      state.performance = { ...state.performance, ...action.payload };
    },
    update_privacy_settings: (state, action: PayloadAction<Partial<PrivacySettings>>) => {
      state.privacy = { ...state.privacy, ...action.payload };
    },
  },
  extraReducers: (builder) => {
    builder.addCase(update_app_settings.fulfilled, (state, action) => {
      Object.assign(state, action.payload);
    });
  },
});

// Error Slice
const error_slice = createSlice({
  name: 'error',
  initialState: {
    global_errors: [],
    view_specific_errors: {},
    network_status: {
      is_online: navigator.onLine,
      connection_type: 'unknown',
      last_sync: new Date().toISOString(),
      pending_requests: 0,
    },
    error_reporting: {
      automatic_reporting: true,
      user_consent: true,
      debug_mode: false,
    },
  } as ErrorState,
  reducers: {
    add_global_error: (state, action: PayloadAction<ErrorDetails>) => {
      state.global_errors.push(action.payload);
    },
    remove_global_error: (state, action: PayloadAction<string>) => {
      state.global_errors = state.global_errors.filter(error => error.error_id !== action.payload);
    },
    add_view_error: (state, action: PayloadAction<{ view_id: string; error: ErrorDetails }>) => {
      if (!state.view_specific_errors[action.payload.view_id]) {
        state.view_specific_errors[action.payload.view_id] = [];
      }
      state.view_specific_errors[action.payload.view_id].push(action.payload.error);
    },
    clear_view_errors: (state, action: PayloadAction<string>) => {
      delete state.view_specific_errors[action.payload];
    },
    update_network_status: (state, action: PayloadAction<Partial<NetworkStatus>>) => {
      state.network_status = { ...state.network_status, ...action.payload };
    },
    increment_pending_requests: (state) => {
      state.network_status.pending_requests += 1;
    },
    decrement_pending_requests: (state) => {
      state.network_status.pending_requests = Math.max(0, state.network_status.pending_requests - 1);
    },
    update_error_reporting_settings: (state, action: PayloadAction<Partial<ErrorReporting>>) => {
      state.error_reporting = { ...state.error_reporting, ...action.payload };
    },
  },
});

// Persistence Configuration
const auth_persist_config = {
  key: 'quickdrop_auth',
  storage,
  whitelist: ['user', 'session', 'permissions'],
};

const notifications_persist_config = {
  key: 'quickdrop_notifications',
  storage,
  whitelist: ['preferences'],
};

const app_settings_persist_config = {
  key: 'quickdrop_app_settings',
  storage,
};

const error_persist_config = {
  key: 'quickdrop_error',
  storage,
  whitelist: ['error_reporting'],
};

// WebSocket Middleware
const websocket_middleware = (store: any) => (next: any) => (action: any) => {
  const state = store.getState() as RootState;
  
  // Initialize WebSocket connection
  if (action.type === 'auth/authenticate/fulfilled' || action.type === 'realtime/connect') {
    if (!socket && state.auth.session?.access_token) {
      socket = io(import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000', {
        auth: {
          token: state.auth.session.access_token,
        },
      });

      store.dispatch(realtime_slice.actions.set_websocket_status('connecting'));

      socket.on('connect', () => {
        store.dispatch(realtime_slice.actions.set_websocket_status('connected'));
      });

      socket.on('disconnect', () => {
        store.dispatch(realtime_slice.actions.set_websocket_status('disconnected'));
      });

      socket.on('connect_error', () => {
        store.dispatch(realtime_slice.actions.set_websocket_status('error'));
        store.dispatch(realtime_slice.actions.increment_reconnect_attempts());
      });

      // Handle real-time events
      socket.on('courier_location_update', (data) => {
        store.dispatch(realtime_slice.actions.update_courier_location({
          delivery_uid: data.data.delivery_uid,
          location: data.data.courier_location,
        }));
      });

      socket.on('delivery_status_changed', (data) => {
        store.dispatch(realtime_slice.actions.update_delivery_status({
          delivery_uid: data.data.delivery_uid,
          status: {
            status: data.data.status,
            timestamp: data.data.status_timestamp,
            courier_info: data.data.courier_info,
          },
        }));

        // Add as notification
        store.dispatch(notifications_slice.actions.add_notification({
          uid: `delivery_${data.data.delivery_uid}_${Date.now()}`,
          type: 'delivery_status',
          title: 'Delivery Update',
          message: `Your delivery status changed to ${data.data.status}`,
          priority: 'normal',
          is_read: false,
          created_at: data.data.status_timestamp,
          action_url: `/track/${data.data.delivery_uid}`,
          metadata: data.data,
        }));
      });

      socket.on('system_notification', (data) => {
        const notification: Notification = {
          uid: data.data.notification_uid,
          type: 'system',
          title: data.data.title,
          message: data.data.message,
          priority: data.data.priority,
          is_read: false,
          created_at: new Date().toISOString(),
          action_url: data.data.action_url,
          metadata: data.data.metadata,
        };

        store.dispatch(notifications_slice.actions.add_notification(notification));
        store.dispatch(notifications_slice.actions.add_toast_notification(notification));
      });

      socket.on('chat_message', (data) => {
        const notification: Notification = {
          uid: `chat_${data.data.message_uid}`,
          type: 'system',
          title: 'New Message',
          message: `Message from ${data.data.sender_info.first_name}`,
          priority: 'normal',
          is_read: false,
          created_at: data.data.timestamp,
          action_url: `/track/${data.data.delivery_uid}`,
          metadata: data.data,
        };

        store.dispatch(notifications_slice.actions.add_toast_notification(notification));
      });
    }
  }

  // Disconnect WebSocket
  if (action.type === 'auth/clear_auth_state' || action.type === 'realtime/disconnect') {
    if (socket) {
      socket.disconnect();
      socket = null;
      store.dispatch(realtime_slice.actions.set_websocket_status('disconnected'));
    }
  }

  return next(action);
};

// Axios Interceptors
axios.interceptors.request.use(
  (config) => {
    const state = store.getState() as RootState;
    store.dispatch(error_slice.actions.increment_pending_requests());
    
    if (state.auth.session?.access_token) {
      config.headers.Authorization = `Bearer ${state.auth.session.access_token}`;
    }
    
    return config;
  },
  (error) => {
    store.dispatch(error_slice.actions.decrement_pending_requests());
    return Promise.reject(error);
  }
);

axios.interceptors.response.use(
  (response) => {
    store.dispatch(error_slice.actions.decrement_pending_requests());
    return response;
  },
  async (error) => {
    const state = store.getState() as RootState;
    store.dispatch(error_slice.actions.decrement_pending_requests());

    // Handle token refresh
    if (error.response?.status === 401 && state.auth.session?.refresh_token) {
      try {
        await store.dispatch(refresh_auth_token(state.auth.session.refresh_token));
        return axios.request(error.config);
      } catch (refreshError) {
        store.dispatch(auth_slice.actions.clear_auth_state());
      }
    }

    // Add global error
    const errorDetails: ErrorDetails = {
      error_id: `error_${Date.now()}`,
      type: error.response ? 'server' : 'network',
      message: error.message,
      technical_details: error.response?.data?.message || error.message,
      timestamp: new Date().toISOString(),
      user_action_required: error.response?.status === 401,
      retry_available: !error.response || error.response.status >= 500,
      escalation_needed: false,
    };

    store.dispatch(error_slice.actions.add_global_error(errorDetails));

    return Promise.reject(error);
  }
);

// Network Status Monitoring
window.addEventListener('online', () => {
  store.dispatch(error_slice.actions.update_network_status({
    is_online: true,
    last_sync: new Date().toISOString(),
  }));
});

window.addEventListener('offline', () => {
  store.dispatch(error_slice.actions.update_network_status({
    is_online: false,
  }));
});

// Configure Store
const store = configureStore({
  reducer: {
    auth: persistReducer(auth_persist_config, auth_slice.reducer),
    notifications: persistReducer(notifications_persist_config, notifications_slice.reducer),
    realtime: realtime_slice.reducer,
    app_settings: persistReducer(app_settings_persist_config, app_settings_slice.reducer),
    error: persistReducer(error_persist_config, error_slice.reducer),
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }).concat(websocket_middleware),
});

export const persistor = persistStore(store);

// Action Exports
export const {
  clear_auth_state,
  set_auth_error,
  update_last_activity,
  update_user_profile,
} = auth_slice.actions;

export const {
  add_notification,
  add_toast_notification,
  remove_toast_notification,
  toggle_notification_center,
  set_notification_center_visibility,
} = notifications_slice.actions;

export const {
  set_websocket_status,
  increment_reconnect_attempts,
  update_last_ping,
  add_subscription,
  remove_subscription,
  update_courier_location,
  update_delivery_status,
  set_connection_quality,
} = realtime_slice.actions;

export const {
  update_theme,
  update_language,
  update_currency,
  update_timezone,
  update_accessibility_settings,
  update_performance_settings,
  update_privacy_settings,
} = app_settings_slice.actions;

export const {
  add_global_error,
  remove_global_error,
  add_view_error,
  clear_view_errors,
  update_network_status,
  increment_pending_requests,
  decrement_pending_requests,
  update_error_reporting_settings,
} = error_slice.actions;

// Type Exports
export type { RootState };
export type AppDispatch = typeof store.dispatch;

export default store;