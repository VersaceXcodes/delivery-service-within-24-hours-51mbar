import React, { useEffect, useCallback, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Link } from 'react-router-dom';
import { 
  RootState,
  createAsyncThunk,
  PayloadAction
} from '@/store/main';
import axios from 'axios';

// Define proper Redux actions matching backend API
const loadNotifications = createAsyncThunk(
  'notifications/load',
  async (params: { page?: number; limit?: number; unread_only?: boolean }) => {
    const response = await axios.get('/api/v1/notifications', {
      params: {
        page: params.page || 1,
        limit: params.limit || 20,
        unread_only: params.unread_only || false
      }
    });
    return response.data;
  }
);

const markNotificationRead = createAsyncThunk(
  'notifications/markRead',
  async (notificationUid: string) => {
    await axios.put(`/api/v1/notifications/${notificationUid}/read`);
    return notificationUid;
  }
);

const markAllNotificationsRead = createAsyncThunk(
  'notifications/markAllRead',
  async () => {
    await axios.put('/api/v1/notifications/mark-all-read');
    return true;
  }
);

const updateNotificationPreferences = createAsyncThunk(
  'notifications/updatePreferences',
  async (preferences: any) => {
    const response = await axios.put('/api/v1/auth/profile', {
      notification_preferences: JSON.stringify(preferences)
    });
    return response.data;
  }
);

// Define interfaces matching datamap schema
interface ToastNotification {
  uid: string;
  type: string;
  title: string;
  message: string;
  priority: string;
  duration: number;
  dismissible: boolean;
  action_buttons: Array<{
    label: string;
    action: string;
    style: string;
  }>;
  created_at: string;
}

interface NotificationItem {
  uid: string;
  type: string;
  title: string;
  message: string;
  priority: string;
  is_read: boolean;
  action_url: string;
  metadata: any;
  created_at: string;
}

interface SystemAlert {
  uid: string;
  alert_type: string;
  priority: string;
  title: string;
  message: string;
  action_required: boolean;
  dismissible: boolean;
  expires_at: string;
}

const GV_NotificationSystem: React.FC = () => {
  const dispatch = useDispatch();
  
  // Global state selectors matching datamap schema
  const notifications_state = useSelector((state: RootState) => state.globalAppState?.notifications_state);
  const auth_state = useSelector((state: RootState) => state.auth_state);
  const realtime_state = useSelector((state: RootState) => state.realtime_state);
  const app_settings_state = useSelector((state: RootState) => state.app_settings_state);
  
  // Extract state variables matching datamap
  const toastNotifications: ToastNotification[] = notifications_state?.toastNotifications || [];
  const notificationCenterOpen: boolean = notifications_state?.notificationCenterOpen || false;
  const notificationsList = notifications_state?.notificationsList || {
    notifications: [],
    pagination: {
      current_page: 1,
      total_pages: 1,
      total_count: 0,
      per_page: 20
    },
    unread_count: 0
  };
  const activeSystemAlerts: SystemAlert[] = notifications_state?.activeSystemAlerts || [];
  const notificationPreferences = notifications_state?.notificationPreferences || {
    push_enabled: true,
    email_enabled: true,
    sms_enabled: false,
    do_not_disturb_hours: {
      enabled: false,
      start_time: '22:00',
      end_time: '07:00',
      timezone: 'UTC'
    },
    category_preferences: {
      delivery_updates: true,
      payment_notifications: true,
      promotional: false,
      system_announcements: true
    }
  };
  
  // Local state for UI management
  const [dismissingToasts, setDismissingToasts] = useState<Set<string>>(new Set());
  const [notificationPage, setNotificationPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);

  // Auto-dismiss timer management
  useEffect(() => {
    const timers: Record<string, NodeJS.Timeout> = {};
    
    toastNotifications.forEach(toast => {
      if (toast.uid && !dismissingToasts.has(toast.uid) && toast.dismissible) {
        const duration = toast.duration || (toast.priority === 'urgent' ? 8000 : toast.priority === 'high' ? 6000 : 4000);
        
        timers[toast.uid] = setTimeout(() => {
          dismissToastNotification(toast.uid);
        }, duration);
      }
    });

    return () => {
      Object.values(timers).forEach(timer => clearTimeout(timer));
    };
  }, [toastNotifications, dismissingToasts]);

  // Load initial notifications on mount
  useEffect(() => {
    if (auth_state?.session?.is_authenticated) {
      dispatch(loadNotifications({ page: 1, limit: 20 }));
    }
  }, [auth_state?.session?.is_authenticated, dispatch]);

  // Action functions
  const showToastNotification = useCallback((notification: ToastNotification) => {
    // This would be handled by Redux action to add to toastNotifications array
    console.log('Adding toast notification:', notification);
  }, []);

  const dismissToastNotification = useCallback((notificationUid: string) => {
    setDismissingToasts(prev => new Set(prev).add(notificationUid));
    setTimeout(() => {
      // This would be handled by Redux action to remove from toastNotifications array
      console.log('Removing toast notification:', notificationUid);
      setDismissingToasts(prev => {
        const newSet = new Set(prev);
        newSet.delete(notificationUid);
        return newSet;
      });
    }, 300);
  }, []);

  const toggleNotificationCenter = useCallback(() => {
    // This would be handled by Redux action to toggle notificationCenterOpen
    console.log('Toggling notification center');
  }, []);

  const markNotificationAsRead = useCallback(async (notificationUid: string) => {
    try {
      await dispatch(markNotificationRead(notificationUid));
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  }, [dispatch]);

  const markAllNotificationsAsRead = useCallback(async () => {
    try {
      await dispatch(markAllNotificationsRead());
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    }
  }, [dispatch]);

  const loadMoreNotifications = useCallback(async () => {
    if (loadingMore || notificationsList.pagination.current_page >= notificationsList.pagination.total_pages) return;
    
    setLoadingMore(true);
    try {
      const nextPage = notificationsList.pagination.current_page + 1;
      await dispatch(loadNotifications({ page: nextPage, limit: 20 }));
      setNotificationPage(nextPage);
    } catch (error) {
      console.error('Failed to load more notifications:', error);
    } finally {
      setLoadingMore(false);
    }
  }, [dispatch, notificationsList.pagination, loadingMore]);

  const handleNotificationAction = useCallback((notification: NotificationItem) => {
    if (!notification.is_read) {
      markNotificationAsRead(notification.uid);
    }
    
    if (notification.action_url) {
      // Handle navigation or external actions
      if (notification.action_url.startsWith('http')) {
        window.open(notification.action_url, '_blank');
      }
    }
  }, [markNotificationAsRead]);

  const updateNotificationPreferencesHandler = useCallback(async (preferences: any) => {
    try {
      await dispatch(updateNotificationPreferences(preferences));
    } catch (error) {
      console.error('Failed to update notification preferences:', error);
    }
  }, [dispatch]);

  const dismissSystemAlert = useCallback((alertUid: string) => {
    // This would be handled by Redux action to remove from activeSystemAlerts array
    console.log('Dismissing system alert:', alertUid);
  }, []);

  const closeNotificationCenter = useCallback(() => {
    // This would be handled by Redux action to set notificationCenterOpen to false
    console.log('Closing notification center');
  }, []);

  // Format timestamp helper
  const formatTimestamp = useCallback((timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString();
  }, []);

  // Priority colors
  const getPriorityColor = useCallback((priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-500 border-red-600';
      case 'high': return 'bg-orange-500 border-orange-600';
      case 'normal': return 'bg-blue-500 border-blue-600';
      case 'low': return 'bg-gray-500 border-gray-600';
      default: return 'bg-blue-500 border-blue-600';
    }
  }, []);

  const getNotificationIcon = useCallback((type: string) => {
    switch (type) {
      case 'delivery_status': return '📦';
      case 'payment': return '💳';
      case 'system': return '⚙️';
      case 'emergency': return '🚨';
      default: return '🔔';
    }
  }, []);

  // Handle keyboard events for accessibility
  const handleKeyDown = useCallback((event: React.KeyboardEvent, action: () => void) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      action();
    }
  }, []);

  return (
    <>
      {/* Toast Notifications Container */}
      <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm" role="region" aria-label="Toast notifications">
        {toastNotifications.map((toast) => (
          <div
            key={toast.uid}
            className={`transform transition-all duration-300 ease-in-out ${
              dismissingToasts.has(toast.uid) 
                ? 'translate-x-full opacity-0' 
                : 'translate-x-0 opacity-100'
            }`}
            role="alert"
            aria-live="polite"
          >
            <div className={`rounded-lg shadow-lg border-l-4 ${getPriorityColor(toast.priority)} bg-white p-4 max-w-sm`}>
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <span className="text-lg" aria-hidden="true">{getNotificationIcon(toast.type)}</span>
                </div>
                <div className="ml-3 w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900">
                    {toast.title}
                  </p>
                  <p className="mt-1 text-sm text-gray-500">
                    {toast.message}
                  </p>
                  {toast.action_buttons && toast.action_buttons.length > 0 && (
                    <div className="mt-2 flex space-x-2">
                      {toast.action_buttons.map((button, index) => (
                        <button
                          key={index}
                          onClick={() => {
                            if (button.action === 'navigate' && toast.action_url) {
                              handleNotificationAction(toast as unknown as NotificationItem);
                            }
                          }}
                          className={`text-xs px-2 py-1 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                            button.style === 'primary' 
                              ? 'bg-blue-600 text-white hover:bg-blue-700' 
                              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                          }`}
                        >
                          {button.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {toast.dismissible && (
                  <div className="ml-4 flex-shrink-0 flex">
                    <button
                      onClick={() => dismissToastNotification(toast.uid)}
                      onKeyDown={(e) => handleKeyDown(e, () => dismissToastNotification(toast.uid))}
                      className="bg-white rounded-md inline-flex text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      aria-label="Close notification"
                    >
                      <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* System Alert Banners */}
      {activeSystemAlerts
        .filter(alert => alert.priority === 'urgent')
        .slice(0, 3)
        .map((alert) => (
          <div
            key={alert.uid}
            className="fixed top-0 left-0 right-0 z-40 bg-red-600 text-white px-4 py-2"
            role="alert"
            aria-live="assertive"
          >
            <div className="flex items-center justify-between max-w-7xl mx-auto">
              <div className="flex items-center">
                <span className="text-lg mr-2" aria-hidden="true">🚨</span>
                <div>
                  <p className="font-medium text-sm">{alert.title}</p>
                  <p className="text-xs opacity-90">{alert.message}</p>
                </div>
              </div>
              {alert.dismissible && (
                <button
                  onClick={() => dismissSystemAlert(alert.uid)}
                  onKeyDown={(e) => handleKeyDown(e, () => dismissSystemAlert(alert.uid))}
                  className="text-white hover:text-gray-200 ml-4 focus:outline-none focus:ring-2 focus:ring-white"
                  aria-label="Dismiss alert"
                >
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        ))}

      {/* Notification Center Overlay */}
      {notificationCenterOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div className="absolute inset-0 overflow-hidden">
            {/* Backdrop */}
            <div 
              className="absolute inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
              onClick={closeNotificationCenter}
              onKeyDown={(e) => handleKeyDown(e, closeNotificationCenter)}
              role="button"
              tabIndex={0}
              aria-label="Close notification center"
            />
            
            {/* Panel */}
            <section className="absolute inset-y-0 right-0 pl-10 max-w-full flex" role="dialog" aria-modal="true" aria-labelledby="notification-center-title">
              <div className="w-screen max-w-md">
                <div className="h-full flex flex-col bg-white shadow-xl">
                  {/* Header */}
                  <div className="px-4 py-6 bg-gray-50 sm:px-6">
                    <div className="flex items-center justify-between">
                      <h2 id="notification-center-title" className="text-lg font-medium text-gray-900">
                        Notifications
                      </h2>
                      <div className="flex items-center space-x-2">
                        {notificationsList.unread_count > 0 && (
                          <button
                            onClick={markAllNotificationsAsRead}
                            className="text-sm text-blue-600 hover:text-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            Mark all read
                          </button>
                        )}
                        <button
                          onClick={closeNotificationCenter}
                          className="bg-white rounded-md text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          aria-label="Close panel"
                        >
                          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    
                    {/* Unread count badge */}
                    {notificationsList.unread_count > 0 && (
                      <div className="mt-2">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {notificationsList.unread_count} unread
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Notification List */}
                  <div className="flex-1 overflow-y-auto">
                    {notificationsList.notifications.length === 0 ? (
                      <div className="flex items-center justify-center h-32">
                        <div className="text-center">
                          <span className="text-4xl" aria-hidden="true">🔔</span>
                          <p className="mt-2 text-sm text-gray-500">No notifications yet</p>
                        </div>
                      </div>
                    ) : (
                      <div className="divide-y divide-gray-200">
                        {notificationsList.notifications.map((notification) => (
                          <div
                            key={notification.uid}
                            className={`p-4 hover:bg-gray-50 cursor-pointer focus:outline-none focus:bg-gray-50 ${
                              !notification.is_read ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                            }`}
                            onClick={() => handleNotificationAction(notification)}
                            onKeyDown={(e) => handleKeyDown(e, () => handleNotificationAction(notification))}
                            role="button"
                            tabIndex={0}
                            aria-label={`${notification.title} - ${notification.is_read ? 'Read' : 'Unread'}`}
                          >
                            <div className="flex items-start">
                              <div className="flex-shrink-0">
                                <span className="text-lg" aria-hidden="true">{getNotificationIcon(notification.type)}</span>
                              </div>
                              <div className="ml-3 flex-1">
                                <p className={`text-sm ${!notification.is_read ? 'font-medium text-gray-900' : 'text-gray-700'}`}>
                                  {notification.title}
                                </p>
                                <p className="mt-1 text-sm text-gray-500">
                                  {notification.message}
                                </p>
                                <div className="mt-2 flex items-center justify-between">
                                  <span className="text-xs text-gray-400">
                                    {formatTimestamp(notification.created_at)}
                                  </span>
                                  {!notification.is_read && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        markNotificationAsRead(notification.uid);
                                      }}
                                      className="text-xs text-blue-600 hover:text-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                      Mark as read
                                    </button>
                                  )}
                                </div>
                                {notification.action_url && (
                                  <div className="mt-2">
                                    {notification.action_url.startsWith('/') ? (
                                      <Link
                                        to={notification.action_url}
                                        className="text-xs text-blue-600 hover:text-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        onClick={closeNotificationCenter}
                                      >
                                        View Details →
                                      </Link>
                                    ) : (
                                      <a
                                        href={notification.action_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs text-blue-600 hover:text-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                      >
                                        Open Link →
                                      </a>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                        
                        {/* Load More Button */}
                        {notificationsList.pagination.current_page < notificationsList.pagination.total_pages && (
                          <div className="p-4 text-center">
                            <button
                              onClick={loadMoreNotifications}
                              disabled={loadingMore}
                              className="text-sm text-blue-600 hover:text-blue-500 disabled:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              {loadingMore ? 'Loading...' : 'Load more notifications'}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Footer with Settings */}
                  <div className="px-4 py-3 bg-gray-50 border-t">
                    <button
                      onClick={() => {
                        closeNotificationCenter();
                        // Navigate to notification settings - would need routing context
                      }}
                      className="text-sm text-gray-600 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      ⚙️ Notification Settings
                    </button>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      )}

      {/* Connection Status Indicator */}
      {realtime_state?.websocket_connection?.status !== 'connected' && auth_state?.session?.is_authenticated && (
        <div className="fixed bottom-4 left-4 z-40">
          <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-3 py-2 rounded-md text-sm" role="status" aria-live="polite">
            <div className="flex items-center">
              <div className="animate-pulse w-2 h-2 bg-yellow-500 rounded-full mr-2" aria-hidden="true"></div>
              {realtime_state?.websocket_connection?.status === 'connecting' && 'Connecting...'}
              {realtime_state?.websocket_connection?.status === 'disconnected' && 'Disconnected'}
              {realtime_state?.websocket_connection?.status === 'error' && 'Connection Error'}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default GV_NotificationSystem;