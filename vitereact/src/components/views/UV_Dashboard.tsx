import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Link } from 'react-router-dom';
import { RootState, AppDispatch, load_notifications } from '@/store/main';

interface DeliveryInfo {
  deliveryUid: string;
  deliveryNumber: string;
  status: 'requested' | 'courier_assigned' | 'en_route_pickup' | 'picked_up' | 'en_route_delivery';
  pickupAddress: string;
  deliveryAddress: string;
  estimatedDeliveryTime: string;
  courierInfo?: {
    name: string;
    rating: number;
    vehicleType: string;
    currentLocation?: {
      latitude: number;
      longitude: number;
    };
  };
  totalPrice: number;
  createdAt: string;
}

interface DashboardStats {
  monthlyDeliveries: number;
  monthlySpending: number;
  totalSavings: number;
  averageDeliveryTime: number;
  successRate: number;
  preferredTimeSlots: string[];
  mostUsedRoutes: Array<{
    from: string;
    to: string;
    count: number;
  }>;
}

interface Address {
  addressUid: string;
  label: string;
  streetAddress: string;
  city: string;
  useCount: number;
  isFavorite: boolean;
  lastUsed: string;
}

interface WeatherAlert {
  severity: 'low' | 'moderate' | 'high' | 'severe';
  title: string;
  description: string;
  affectedAreas: string[];
  expectedDuration: string;
}

interface QuickSendTemplate {
  templateUid: string;
  templateName: string;
  pickupAddressUid: string;
  deliveryAddressUid: string;
  packageDefaults: {
    size: string;
    weight: number;
    category: string;
  };
  deliveryType: string;
  useCount: number;
  lastUsed: string;
}

interface PromotionalOffer {
  promotionUid: string;
  title: string;
  description: string;
  discountType: string;
  discountValue: number;
  minimumOrder: number;
  expiresAt: string;
  code: string;
}

const UV_Dashboard: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { user, session } = useSelector((state: RootState) => state.auth);
  const { unread_count, recent_notifications } = useSelector((state: RootState) => state.notifications_state || { unread_count: 0, recent_notifications: [] });
  const { delivery_status_updates } = useSelector((state: RootState) => state.realtime_state || { delivery_status_updates: {} });
  const { currency, timezone } = useSelector((state: RootState) => state.app_settings_state || { currency: 'USD', timezone: 'UTC' });

  // Local state
  const [activeDeliveries, setActiveDeliveries] = useState<DeliveryInfo[]>([]);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats>({
    monthlyDeliveries: 0,
    monthlySpending: 0,
    totalSavings: 0,
    averageDeliveryTime: 0,
    successRate: 0,
    preferredTimeSlots: [],
    mostUsedRoutes: []
  });
  const [recentAddresses, setRecentAddresses] = useState<Address[]>([]);
  const [weatherAlerts, setWeatherAlerts] = useState<{
    currentConditions: {
      temperature: number;
      condition: string;
      icon: string;
    };
    activeAlerts: WeatherAlert[];
    deliveryImpact: {
      delaysExpected: boolean;
      estimatedDelay: number;
      affectedServices: string[];
    };
  }>({
    currentConditions: { temperature: 0, condition: '', icon: '' },
    activeAlerts: [],
    deliveryImpact: { delaysExpected: false, estimatedDelay: 0, affectedServices: [] }
  });
  const [quickSendTemplates, setQuickSendTemplates] = useState<QuickSendTemplate[]>([]);
  const [promotionalOffers, setPromotionalOffers] = useState<{
    activePromotions: PromotionalOffer[];
    loyaltyProgram: {
      currentTier: string;
      pointsBalance: number;
      pointsToNextTier: number;
      availableRewards: any[];
    };
  }>({
    activePromotions: [],
    loyaltyProgram: { currentTier: '', pointsBalance: 0, pointsToNextTier: 0, availableRewards: [] }
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // API Functions
  const fetchActiveDeliveries = async () => {
    try {
      const response = await fetch('/api/v1/deliveries?status=requested,courier_assigned,en_route_pickup,picked_up,en_route_delivery', {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json'
        }
      });
      if (response.ok) {
        const data = await response.json();
        // Map backend delivery data to component interface
        const mappedDeliveries = (data.deliveries || []).map((delivery: any) => ({
          deliveryUid: delivery.uid,
          deliveryNumber: delivery.delivery_number,
          status: delivery.status,
          pickupAddress: delivery.pickup_address?.street_address || 'Pickup Address',
          deliveryAddress: delivery.delivery_address?.street_address || 'Delivery Address', 
          estimatedDeliveryTime: delivery.estimated_delivery_time,
          totalPrice: delivery.total_price,
          createdAt: delivery.created_at,
          courierInfo: delivery.courier_info ? {
            name: `${delivery.courier_info.first_name} ${delivery.courier_info.last_name}`,
            rating: delivery.courier_info.average_rating || 0,
            vehicleType: delivery.courier_info.vehicle_type,
            currentLocation: delivery.courier_info.current_location
          } : undefined
        }));
        setActiveDeliveries(mappedDeliveries);
      }
    } catch (err) {
      console.error('Failed to fetch active deliveries:', err);
    }
  };

  const loadDashboardStats = async () => {
    try {
      // Use mock data since backend endpoint doesn't exist
      setDashboardStats({
        monthlyDeliveries: 12,
        monthlySpending: 485.20,
        totalSavings: 67.50,
        averageDeliveryTime: 45,
        successRate: 98.5,
        preferredTimeSlots: ['10:00-12:00', '14:00-16:00'],
        mostUsedRoutes: [
          { from: 'Home', to: 'Office', count: 8 },
          { from: 'Office', to: 'Client Site', count: 4 }
        ]
      });
    } catch (err) {
      console.error('Failed to load dashboard stats:', err);
    }
  };

  const loadRecentAddresses = async () => {
    try {
      const response = await fetch(`/api/v1/users/${user?.uid}/addresses`, {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json'
        }
      });
      if (response.ok) {
        const data = await response.json();
        // Map backend address data to component interface
        const mappedAddresses = (data || []).map((address: any) => ({
          addressUid: address.uid,
          label: address.label || 'Address',
          streetAddress: address.street_address,
          city: address.city,
          useCount: address.use_count || 0,
          isFavorite: address.is_favorite || false,
          lastUsed: address.updated_at
        }));
        setRecentAddresses(mappedAddresses);
      }
    } catch (err) {
      console.error('Failed to load recent addresses:', err);
    }
  };

  const getWeatherAlerts = async () => {
    try {
      // Use mock weather data since backend endpoint doesn't exist
      setWeatherAlerts({
        currentConditions: {
          temperature: 22,
          condition: 'Partly Cloudy',
          icon: '⛅'
        },
        activeAlerts: [],
        deliveryImpact: {
          delaysExpected: false,
          estimatedDelay: 0,
          affectedServices: []
        }
      });
    } catch (err) {
      console.error('Failed to get weather alerts:', err);
    }
  };

  const loadQuickSendTemplates = async () => {
    try {
      // Use mock template data since backend endpoint doesn't exist
      setQuickSendTemplates([]);
    } catch (err) {
      console.error('Failed to load quick send templates:', err);
    }
  };

  const loadPromotionalOffers = async () => {
    try {
      // Use mock promotional data since backend endpoints don't exist
      setPromotionalOffers({
        activePromotions: [
          {
            promotionUid: 'promo1',
            title: '20% Off Next Delivery',
            description: 'Save on your next same-day delivery',
            discountType: 'percentage',
            discountValue: 20,
            minimumOrder: 25,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            code: 'SAVE20'
          }
        ],
        loyaltyProgram: {
          currentTier: 'Bronze',
          pointsBalance: 250,
          pointsToNextTier: 750,
          availableRewards: []
        }
      });
    } catch (err) {
      console.error('Failed to load promotional offers:', err);
    }
  };

  const createQuickDelivery = async (templateUid?: string) => {
    try {
      // Navigate directly since quick-create endpoint doesn't exist
      const queryParams = templateUid ? `?template_uid=${templateUid}` : '?quick_send=true';
      window.location.href = `/send${queryParams}`;
    } catch (err) {
      console.error('Failed to create quick delivery:', err);
      // Fallback navigation
      window.location.href = '/send?quick_send=true';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD'
    }).format(amount);
  };

  const formatTime = (timeString: string) => {
    if (!timeString) return 'Calculating...';
    const date = new Date(timeString);
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: timezone || 'UTC'
    }).format(date);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'requested': return 'bg-yellow-100 text-yellow-800';
      case 'courier_assigned': return 'bg-blue-100 text-blue-800';
      case 'en_route_pickup': return 'bg-orange-100 text-orange-800';
      case 'picked_up': return 'bg-purple-100 text-purple-800';
      case 'en_route_delivery': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'requested': return 'Finding Courier';
      case 'courier_assigned': return 'Courier Assigned';
      case 'en_route_pickup': return 'En Route to Pickup';
      case 'picked_up': return 'Package Picked Up';
      case 'en_route_delivery': return 'En Route to Delivery';
      default: return status;
    }
  };

  // Load data on mount
  useEffect(() => {
    const loadDashboardData = async () => {
      setLoading(true);
      setError(null);

      try {
        await Promise.all([
          fetchActiveDeliveries(),
          loadDashboardStats(),
          loadRecentAddresses(),
          getWeatherAlerts(),
          loadQuickSendTemplates(),
          loadPromotionalOffers(),
          dispatch(load_notifications())
        ]);
      } catch (err) {
        setError('Failed to load dashboard data');
        console.error('Dashboard load error:', err);
      } finally {
        setLoading(false);
      }
    };

    if (user && session?.access_token) {
      loadDashboardData();
    }
  }, [user, session, dispatch]);

  // Real-time updates with proper null checking
  useEffect(() => {
    if (delivery_status_updates && typeof delivery_status_updates === 'object') {
      Object.entries(delivery_status_updates).forEach(([deliveryUid, statusUpdate]: [string, any]) => {
        if (statusUpdate && statusUpdate.status) {
          setActiveDeliveries(prev => 
            prev.map(delivery => 
              delivery.deliveryUid === deliveryUid 
                ? { ...delivery, status: statusUpdate.status as any }
                : delivery
            )
          );
        }
      });
    }
  }, [delivery_status_updates]);

  if (loading) {
    return (
      <>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading your dashboard...</p>
          </div>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="text-red-500 text-xl mb-4">⚠️</div>
            <p className="text-gray-800 font-medium">{error}</p>
            <button 
              onClick={() => window.location.reload()} 
              className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
              type="button"
            >
              Retry
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-gray-50">
        {/* Header Section */}
        <div className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Welcome back, {user?.first_name}! 👋
                </h1>
                <p className="text-gray-600 mt-1">
                  {user?.user_type === 'business_admin' ? 'Business Account' : 'Personal Account'} • {new Date().toLocaleDateString()}
                </p>
              </div>
              
              {/* Weather Widget */}
              {weatherAlerts.currentConditions.condition && (
                <div className="hidden md:flex items-center space-x-2 bg-blue-50 px-4 py-2 rounded-lg">
                  <span className="text-2xl">{weatherAlerts.currentConditions.icon}</span>
                  <div>
                    <p className="text-sm font-medium text-blue-900">{weatherAlerts.currentConditions.temperature}°C</p>
                    <p className="text-xs text-blue-700">{weatherAlerts.currentConditions.condition}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Quick Stats Row */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">This Month</p>
                  <p className="text-2xl font-bold text-gray-900">{dashboardStats.monthlyDeliveries}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="p-2 bg-green-100 rounded-lg">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Monthly Spending</p>
                  <p className="text-2xl font-bold text-gray-900">{formatCurrency(dashboardStats.monthlySpending)}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2m0 0V3a1 1 0 011 1v1M7 4V3a1 1 0 011-1m0 0h8m-8 0V2m8 2v1M9 4h6m-6 0a1 1 0 00-1 1v12a1 1 0 001 1h6a1 1 0 001-1V5a1 1 0 00-1-1" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Savings</p>
                  <p className="text-2xl font-bold text-gray-900">{formatCurrency(dashboardStats.totalSavings)}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Avg. Delivery Time</p>
                  <p className="text-2xl font-bold text-gray-900">{dashboardStats.averageDeliveryTime}min</p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column */}
            <div className="lg:col-span-2 space-y-8">
              {/* Active Deliveries */}
              <div className="bg-white rounded-lg shadow">
                <div className="p-6 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-gray-900">Active Deliveries</h2>
                    <Link 
                      to="/deliveries" 
                      className="text-blue-600 hover:text-blue-500 text-sm font-medium"
                    >
                      View All
                    </Link>
                  </div>
                </div>
                
                <div className="p-6">
                  {activeDeliveries.length === 0 ? (
                    <div className="text-center py-12">
                      <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10" />
                      </svg>
                      <h3 className="text-lg font-medium text-gray-900 mb-2">No active deliveries</h3>
                      <p className="text-gray-600 mb-4">Start a new delivery to see it here</p>
                      <Link 
                        to="/send" 
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 inline-flex items-center"
                      >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Send Package
                      </Link>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {activeDeliveries.map((delivery) => (
                        <div key={delivery.deliveryUid} className="border border-gray-200 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center space-x-3">
                              <div className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(delivery.status)}`}>
                                {getStatusText(delivery.status)}
                              </div>
                              <span className="text-sm text-gray-600">#{delivery.deliveryNumber}</span>
                            </div>
                            <span className="text-sm font-medium text-gray-900">{formatCurrency(delivery.totalPrice)}</span>
                          </div>
                          
                          <div className="mb-3">
                            <div className="flex items-center text-sm text-gray-600 mb-1">
                              <svg className="w-4 h-4 mr-2 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                                <circle cx="10" cy="10" r="3" />
                              </svg>
                              <span className="truncate">{delivery.pickupAddress}</span>
                            </div>
                            <div className="flex items-center text-sm text-gray-600">
                              <svg className="w-4 h-4 mr-2 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                                <circle cx="10" cy="10" r="3" />
                              </svg>
                              <span className="truncate">{delivery.deliveryAddress}</span>
                            </div>
                          </div>

                          {delivery.courierInfo && (
                            <div className="flex items-center justify-between mb-3 p-2 bg-gray-50 rounded">
                              <div className="flex items-center space-x-2">
                                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                                  <span className="text-xs font-medium text-blue-600">
                                    {delivery.courierInfo.name.charAt(0)}
                                  </span>
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-gray-900">{delivery.courierInfo.name}</p>
                                  <p className="text-xs text-gray-600">{delivery.courierInfo.vehicleType}</p>
                                </div>
                              </div>
                              <div className="flex items-center space-x-1">
                                <svg className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                </svg>
                                <span className="text-sm text-gray-600">{delivery.courierInfo.rating}</span>
                              </div>
                            </div>
                          )}

                          <div className="flex items-center justify-between">
                            <div className="text-sm text-gray-600">
                              ETA: {formatTime(delivery.estimatedDeliveryTime)}
                            </div>
                            <div className="flex space-x-2">
                              <Link 
                                to={`/track/${delivery.deliveryUid}`}
                                className="bg-blue-100 text-blue-700 px-3 py-1 rounded text-sm font-medium hover:bg-blue-200"
                              >
                                Track
                              </Link>
                              {delivery.courierInfo && (
                                <button 
                                  className="bg-green-100 text-green-700 px-3 py-1 rounded text-sm font-medium hover:bg-green-200"
                                  type="button"
                                >
                                  Contact
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Quick Send Section */}
              <div className="bg-white rounded-lg shadow">
                <div className="p-6 border-b border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-900">Quick Send</h2>
                </div>
                
                <div className="p-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                    <button 
                      onClick={() => createQuickDelivery()}
                      className="flex items-center justify-center p-6 border-2 border-dashed border-blue-300 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors"
                      type="button"
                    >
                      <div className="text-center">
                        <svg className="w-8 h-8 text-blue-600 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        <span className="text-blue-600 font-medium">New Delivery</span>
                      </div>
                    </button>

                    <button 
                      className="flex items-center justify-center p-6 border-2 border-dashed border-red-300 rounded-lg hover:border-red-400 hover:bg-red-50 transition-colors"
                      type="button"
                    >
                      <div className="text-center">
                        <svg className="w-8 h-8 text-red-600 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                        <span className="text-red-600 font-medium">Emergency Delivery</span>
                      </div>
                    </button>
                  </div>

                  {quickSendTemplates.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-900 mb-3">Saved Templates</h3>
                      <div className="space-y-2">
                        {quickSendTemplates.slice(0, 3).map((template) => (
                          <button 
                            key={template.templateUid}
                            onClick={() => createQuickDelivery(template.templateUid)}
                            className="w-full text-left p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                            type="button"
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium text-gray-900">{template.templateName}</p>
                                <p className="text-sm text-gray-600">Used {template.useCount} times</p>
                              </div>
                              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-8">
              {/* Notifications */}
              <div className="bg-white rounded-lg shadow">
                <div className="p-6 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-gray-900">Notifications</h2>
                    {unread_count > 0 && (
                      <span className="bg-red-100 text-red-800 text-xs font-medium px-2 py-1 rounded-full">
                        {unread_count}
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="p-6">
                  {!recent_notifications || recent_notifications.length === 0 ? (
                    <div className="text-center py-6">
                      <svg className="w-8 h-8 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5v-5z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7v10l5-5-5-5z" />
                      </svg>
                      <p className="text-gray-600">No new notifications</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {recent_notifications.slice(0, 5).map((notification: any) => (
                        <div key={notification.uid} className={`p-3 rounded-lg ${notification.is_read ? 'bg-gray-50' : 'bg-blue-50'}`}>
                          <div className="flex items-start space-x-3">
                            <div className={`w-2 h-2 rounded-full mt-2 ${notification.is_read ? 'bg-gray-400' : 'bg-blue-500'}`} />
                            <div className="flex-1">
                              <p className="text-sm font-medium text-gray-900">{notification.title}</p>
                              <p className="text-sm text-gray-600">{notification.message}</p>
                              <p className="text-xs text-gray-400 mt-1">
                                {new Date(notification.created_at).toLocaleString()}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Recent Addresses */}
              <div className="bg-white rounded-lg shadow">
                <div className="p-6 border-b border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-900">Recent Addresses</h2>
                </div>
                
                <div className="p-6">
                  {recentAddresses.length === 0 ? (
                    <div className="text-center py-6">
                      <svg className="w-8 h-8 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <p className="text-gray-600">No saved addresses</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {recentAddresses.slice(0, 5).map((address) => (
                        <div key={address.addressUid} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded">
                          <div className="flex items-center space-x-3">
                            <div className="flex-shrink-0">
                              {address.isFavorite ? (
                                <svg className="w-4 h-4 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                </svg>
                              ) : (
                                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                              )}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900">{address.label}</p>
                              <p className="text-xs text-gray-600 truncate">{address.streetAddress}, {address.city}</p>
                            </div>
                          </div>
                          <button 
                            onClick={() => createQuickDelivery()}
                            className="text-blue-600 hover:text-blue-700"
                            type="button"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Promotions */}
              {promotionalOffers.activePromotions.length > 0 && (
                <div className="bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg shadow text-white">
                  <div className="p-6">
                    <div className="flex items-center mb-4">
                      <svg className="w-6 h-6 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zM12 2a1 1 0 01.967.744L14.146 7.2 17.5 9.134a1 1 0 010 1.732L14.146 12.8l-1.179 4.456a1 1 0 01-1.934 0L9.854 12.8 6.5 10.866a1 1 0 010-1.732L9.854 7.2l1.179-4.456A1 1 0 0112 2z" clipRule="evenodd" />
                      </svg>
                      <h2 className="text-lg font-semibold">Special Offers</h2>
                    </div>
                    
                    {promotionalOffers.activePromotions.map((promo) => (
                      <div key={promo.promotionUid} className="mb-4">
                        <h3 className="font-medium mb-1">{promo.title}</h3>
                        <p className="text-sm opacity-90 mb-2">{promo.description}</p>
                        <div className="flex items-center justify-between">
                          <code className="bg-white bg-opacity-20 px-2 py-1 rounded text-sm font-mono">
                            {promo.code}
                          </code>
                          <span className="text-sm opacity-75">
                            Expires {new Date(promo.expiresAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    ))}
                    
                    {promotionalOffers.loyaltyProgram.currentTier && (
                      <div className="border-t border-white border-opacity-20 pt-4 mt-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm">Loyalty Status</span>
                          <span className="font-medium">{promotionalOffers.loyaltyProgram.currentTier}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Points Balance</span>
                          <span className="font-medium">{promotionalOffers.loyaltyProgram.pointsBalance}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default UV_Dashboard;