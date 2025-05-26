import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import axios from 'axios';
import {
  RootState,
  clear_auth_state,
  add_global_error
} from '@/store/main';

interface NavigationMenuItem {
  label: string;
  path: string;
  icon: string;
  visible: boolean;
  badge_count?: number;
}

interface CourierStatus {
  is_available: boolean;
  last_status_change: string;
  pending_requests_nearby: number;
}

const GV_TopNav: React.FC = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();

  // Local state
  const [menuMobileOpen, setMenuMobileOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isTogglingAvailability, setIsTogglingAvailability] = useState(false);
  const [courierStatus, setCourierStatus] = useState<CourierStatus>({
    is_available: false,
    last_status_change: '',
    pending_requests_nearby: 0
  });
  const [currentLanguage, setCurrentLanguage] = useState('en');
  const [notificationCenterOpen, setNotificationCenterOpen] = useState(false);

  // Global state selectors
  const currentUserInfo = useSelector((state: RootState) => state.auth.user);
  const isAuthenticated = useSelector((state: RootState) => state.auth.session?.is_authenticated || false);
  const unreadNotificationCount = useSelector((state: RootState) => state.notifications?.unread_count || 0);
  const websocketStatus = useSelector((state: RootState) => state.realtime?.websocket_connection?.status || 'disconnected');

  // Generate navigation menu items based on user type
  const getNavigationMenuItems = (): NavigationMenuItem[] => {
    if (!currentUserInfo) return [];

    const baseItems: NavigationMenuItem[] = [];

    switch (currentUserInfo.user_type) {
      case 'sender':
        baseItems.push(
          { label: 'Dashboard', path: '/dashboard', icon: '🏠', visible: true },
          { label: 'Send Package', path: '/send', icon: '📦', visible: true },
          { label: 'Track Deliveries', path: '/deliveries?status=active', icon: '📍', visible: true },
          { label: 'History', path: '/deliveries', icon: '📋', visible: true }
        );
        break;

      case 'courier':
        baseItems.push(
          { label: 'Dashboard', path: '/courier-dashboard', icon: '🏠', visible: true },
          { label: 'Available Jobs', path: '/courier-dashboard?view=jobs', icon: '🚚', visible: true },
          { label: 'Earnings', path: '/courier-dashboard?view=earnings', icon: '💰', visible: true }
        );
        break;

      case 'business_admin':
        baseItems.push(
          { label: 'Dashboard', path: '/dashboard', icon: '🏠', visible: true },
          { label: 'Send Package', path: '/send', icon: '📦', visible: true },
          { label: 'Team Management', path: '/team', icon: '👥', visible: true },
          { label: 'Analytics', path: '/analytics', icon: '📊', visible: true },
          { label: 'Billing', path: '/billing', icon: '💳', visible: true }
        );
        break;
    }

    return baseItems;
  };

  const navigationMenuItems = getNavigationMenuItems();

  // Fetch courier status on mount for courier users
  useEffect(() => {
    const fetchCourierStatus = async () => {
      if (currentUserInfo?.user_type === 'courier' && currentUserInfo.uid) {
        try {
          const response = await axios.get(`/api/v1/couriers/${currentUserInfo.uid}`);
          setCourierStatus({
            is_available: response.data.is_available || false,
            last_status_change: new Date().toISOString(),
            pending_requests_nearby: 0
          });
        } catch (error) {
          // Handle error silently for now
        }
      }
    };

    if (isAuthenticated && currentUserInfo) {
      fetchCourierStatus();
    }
  }, [isAuthenticated, currentUserInfo]);

  // Action handlers
  const toggleMobileMenu = () => {
    setMenuMobileOpen(!menuMobileOpen);
  };

  const toggleUserDropdown = () => {
    setUserDropdownOpen(!userDropdownOpen);
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await axios.post('/api/v1/auth/logout');
      dispatch(clear_auth_state());
      navigate('/login');
    } catch (error: any) {
      dispatch(add_global_error({
        error_id: `logout_error_${Date.now()}`,
        type: 'authentication',
        message: 'Failed to logout properly',
        technical_details: error.message,
        timestamp: new Date().toISOString(),
        user_action_required: false,
        retry_available: true,
        escalation_needed: false,
      }));
      // Clear auth state anyway on logout failure
      dispatch(clear_auth_state());
      navigate('/login');
    } finally {
      setIsLoggingOut(false);
    }
  };

  const toggleCourierAvailability = async () => {
    if (currentUserInfo?.user_type !== 'courier') return;

    setIsTogglingAvailability(true);
    try {
      const newAvailability = !courierStatus.is_available;

      let currentLocation = null;
      if (navigator.geolocation) {
        try {
          currentLocation = await getCurrentLocation();
        } catch (error) {
          // Location not available, continue without it
        }
      }

      const response = await axios.put('/api/v1/couriers/availability', {
        is_available: newAvailability,
        current_location: currentLocation
      });

      // Update local courier status with API response
      setCourierStatus({
        is_available: response.data.is_available,
        last_status_change: new Date().toISOString(),
        pending_requests_nearby: response.data.pending_requests_nearby || 0
      });

    } catch (error: any) {
      dispatch(add_global_error({
        error_id: `availability_error_${Date.now()}`,
        type: 'server',
        message: 'Failed to update availability status',
        technical_details: error.message,
        timestamp: new Date().toISOString(),
        user_action_required: true,
        retry_available: true,
        escalation_needed: false,
      }));
    } finally {
      setIsTogglingAvailability(false);
    }
  };

  const getCurrentLocation = (): Promise<{ latitude: number; longitude: number }> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          });
        },
        (error) => reject(error),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  };

  const accessNotificationCenter = () => {
    setNotificationCenterOpen(!notificationCenterOpen);
  };

  const accessEmergencyHelp = () => {
    // Navigate to help page with emergency flag
    navigate('/help?emergency=true');
  };

  const changeLanguageRegion = async (newLanguage: string) => {
    try {
      await axios.put('/api/v1/auth/profile', {
        preferred_language: newLanguage
      });
      setCurrentLanguage(newLanguage);
      // In a real app, this would trigger a page reload or language change
      window.location.reload();
    } catch (error: any) {
      dispatch(add_global_error({
        error_id: `language_change_error_${Date.now()}`,
        type: 'server',
        message: 'Failed to update language preference',
        technical_details: error.message,
        timestamp: new Date().toISOString(),
        user_action_required: false,
        retry_available: true,
        escalation_needed: false,
      }));
    }
  };

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (userDropdownOpen && !target.closest('.user-dropdown')) {
        setUserDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [userDropdownOpen]);

  // Close mobile menu on route change
  useEffect(() => {
    setMenuMobileOpen(false);
    setUserDropdownOpen(false);
  }, [location.pathname]);

  // Keyboard event handlers
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuMobileOpen(false);
        setUserDropdownOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (!isAuthenticated || !currentUserInfo) {
    return null;
  }

  return (
    <>
      {/* Fixed header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            
            {/* Logo and brand */}
            <div className="flex items-center">
              <Link 
                to={currentUserInfo.user_type === 'courier' ? '/courier-dashboard' : '/dashboard'}
                className="flex items-center space-x-2 text-blue-600 hover:text-blue-700 transition-colors"
              >
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">QD</span>
                </div>
                <span className="text-xl font-bold hidden sm:block">QuickDrop</span>
              </Link>
            </div>

            {/* Desktop navigation */}
            <nav className="hidden md:flex items-center space-x-8">
              {navigationMenuItems.map((item) => (
                item.visible && (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center space-x-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      location.pathname === item.path
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-gray-700 hover:text-blue-600 hover:bg-gray-50'
                    }`}
                  >
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                    {item.badge_count && item.badge_count > 0 && (
                      <span className="bg-red-500 text-white text-xs rounded-full px-2 py-1 min-w-[20px] h-5 flex items-center justify-center">
                        {item.badge_count > 99 ? '99+' : item.badge_count}
                      </span>
                    )}
                  </Link>
                )
              ))}
            </nav>

            {/* Right side actions */}
            <div className="flex items-center space-x-4">
              
              {/* Courier availability toggle */}
              {currentUserInfo.user_type === 'courier' && (
                <div className="hidden md:flex items-center space-x-2">
                  <span className="text-sm text-gray-600">
                    {courierStatus.is_available ? 'Online' : 'Offline'}
                  </span>
                  <button
                    onClick={toggleCourierAvailability}
                    disabled={isTogglingAvailability}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      courierStatus.is_available ? 'bg-green-600' : 'bg-gray-200'
                    } ${isTogglingAvailability ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        courierStatus.is_available ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                  {courierStatus.pending_requests_nearby > 0 && (
                    <span className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded-full">
                      {courierStatus.pending_requests_nearby} nearby
                    </span>
                  )}
                </div>
              )}

              {/* Language selector */}
              <div className="hidden md:block">
                <select
                  value={currentLanguage}
                  onChange={(e) => changeLanguageRegion(e.target.value)}
                  className="text-sm border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="en">EN</option>
                  <option value="es">ES</option>
                  <option value="fr">FR</option>
                </select>
              </div>

              {/* Emergency help button */}
              <button
                onClick={accessEmergencyHelp}
                className="text-red-600 hover:text-red-700 p-2 rounded-md hover:bg-red-50 transition-colors"
                title="Emergency Help"
                type="button"
              >
                <span className="text-lg">🚨</span>
              </button>

              {/* Notifications bell */}
              <button
                onClick={accessNotificationCenter}
                className="relative text-gray-600 hover:text-blue-600 p-2 rounded-md hover:bg-gray-50 transition-colors"
                title="Notifications"
                type="button"
              >
                <span className="text-lg">🔔</span>
                {unreadNotificationCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full px-2 py-1 min-w-[20px] h-5 flex items-center justify-center">
                    {unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}
                  </span>
                )}
              </button>

              {/* User avatar dropdown */}
              <div className="relative user-dropdown">
                <button
                  onClick={toggleUserDropdown}
                  className="flex items-center space-x-2 p-1 rounded-md hover:bg-gray-50 transition-colors"
                  type="button"
                >
                  <img
                    src={currentUserInfo.profile_photo_url || 'https://picsum.photos/40/40?random=1'}
                    alt={`${currentUserInfo.first_name} ${currentUserInfo.last_name}`}
                    className="w-8 h-8 rounded-full object-cover"
                  />
                  <span className="hidden md:block text-sm font-medium text-gray-700">
                    {currentUserInfo.first_name}
                  </span>
                  <svg
                    className={`w-4 h-4 text-gray-500 transition-transform ${userDropdownOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* User dropdown menu */}
                {userDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg border border-gray-200 py-1 z-50">
                    <div className="px-4 py-2 border-b border-gray-100">
                      <p className="text-sm font-medium text-gray-900">
                        {currentUserInfo.first_name} {currentUserInfo.last_name}
                      </p>
                      <p className="text-sm text-gray-500">{currentUserInfo.email}</p>
                      <p className="text-xs text-gray-400 capitalize">{currentUserInfo.user_type.replace('_', ' ')}</p>
                    </div>
                    
                    <Link
                      to="/profile"
                      className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      <span className="mr-2">👤</span>
                      Profile Settings
                    </Link>
                    
                    {currentUserInfo.user_type === 'business_admin' && (
                      <Link
                        to="/team"
                        className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        <span className="mr-2">👥</span>
                        Manage Team
                      </Link>
                    )}
                    
                    <Link
                      to="/help"
                      className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      <span className="mr-2">❓</span>
                      Help Center
                    </Link>
                    
                    <div className="border-t border-gray-100 my-1"></div>
                    
                    <button
                      onClick={handleLogout}
                      disabled={isLoggingOut}
                      className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                      type="button"
                    >
                      <span className="mr-2">🚪</span>
                      {isLoggingOut ? 'Logging out...' : 'Logout'}
                    </button>
                  </div>
                )}
              </div>

              {/* Mobile menu button */}
              <button
                onClick={toggleMobileMenu}
                className="md:hidden p-2 text-gray-600 hover:text-blue-600 hover:bg-gray-50 rounded-md transition-colors"
                aria-label="Toggle mobile menu"
                type="button"
              >
                {menuMobileOpen ? (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile menu overlay */}
      {menuMobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="fixed inset-0 bg-black bg-opacity-50" onClick={toggleMobileMenu}></div>
          
          <div className="fixed top-16 left-0 right-0 bg-white border-b border-gray-200 shadow-lg">
            <div className="max-h-screen overflow-y-auto">
              <nav className="px-4 py-4 space-y-2">
                {navigationMenuItems.map((item) => (
                  item.visible && (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`flex items-center justify-between px-4 py-3 rounded-md text-base font-medium transition-colors ${
                        location.pathname === item.path
                          ? 'bg-blue-50 text-blue-700'
                          : 'text-gray-700 hover:text-blue-600 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <span>{item.icon}</span>
                        <span>{item.label}</span>
                      </div>
                      {item.badge_count && item.badge_count > 0 && (
                        <span className="bg-red-500 text-white text-xs rounded-full px-2 py-1 min-w-[20px] h-5 flex items-center justify-center">
                          {item.badge_count > 99 ? '99+' : item.badge_count}
                        </span>
                      )}
                    </Link>
                  )
                ))}
                
                {/* Mobile courier availability */}
                {currentUserInfo.user_type === 'courier' && (
                  <div className="px-4 py-3 border-t border-gray-200">
                    <div className="flex items-center justify-between">
                      <span className="text-base font-medium text-gray-700">Availability</span>
                      <button
                        onClick={toggleCourierAvailability}
                        disabled={isTogglingAvailability}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          courierStatus.is_available ? 'bg-green-600' : 'bg-gray-200'
                        } ${isTogglingAvailability ? 'opacity-50' : ''}`}
                        type="button"
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            courierStatus.is_available ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                    {courierStatus.pending_requests_nearby > 0 && (
                      <p className="text-sm text-orange-600 mt-1">
                        {courierStatus.pending_requests_nearby} requests nearby
                      </p>
                    )}
                  </div>
                )}
                
                {/* Mobile language selector */}
                <div className="px-4 py-3 border-t border-gray-200">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Language</label>
                  <select
                    value={currentLanguage}
                    onChange={(e) => changeLanguageRegion(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="en">English</option>
                    <option value="es">Español</option>
                    <option value="fr">Français</option>
                  </select>
                </div>
              </nav>
            </div>
          </div>
        </div>
      )}

      {/* Connection status indicator */}
      {websocketStatus !== 'connected' && (
        <div className="fixed top-16 left-0 right-0 bg-yellow-50 border-b border-yellow-200 px-4 py-2 z-30">
          <div className="max-w-7xl mx-auto">
            <p className="text-sm text-yellow-800 text-center">
              {websocketStatus === 'connecting' && 'Connecting to real-time updates...'}
              {websocketStatus === 'disconnected' && 'Disconnected from real-time updates. Trying to reconnect...'}
              {websocketStatus === 'error' && 'Connection error. Some features may not work properly.'}
            </p>
          </div>
        </div>
      )}
    </>
  );
};

export default GV_TopNav;