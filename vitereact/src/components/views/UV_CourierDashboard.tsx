import React, { useState, useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Link, useSearchParams } from 'react-router-dom';
import { RootState, AppDispatch } from '@/store/main';
import {
  update_courier_location,
  update_delivery_status,
  add_notification,
  add_toast_notification,
  update_last_activity,
  add_global_error,
  increment_pending_requests,
  decrement_pending_requests
} from '@/store/main';

interface CourierStatus {
  is_available: boolean;
  current_capacity: number;
  max_concurrent_deliveries: number;
  service_radius: number;
  base_location_lat: number | null;
  base_location_lng: number | null;
}

interface ActiveJob {
  delivery_uid: string;
  delivery_number: string;
  status: string;
  pickup_address: any;
  delivery_address: any;
  package_info: any;
  estimated_earnings: number;
  pickup_deadline: string;
  customer_contact: any;
  sender_user_uid?: string;
}

interface JobRequest {
  delivery_uid: string;
  pickup_location: any;
  delivery_location: any;
  package_details: any;
  estimated_earnings: number;
  distance_km: number;
  expires_at: string;
  priority_level: number;
}

interface EarningsCurrent {
  today_earnings: number;
  week_earnings: number;
  month_earnings: number;
  shift_earnings: number;
  total_deliveries_today: number;
  average_per_delivery: number;
  payment_pending: number;
}

interface LocationSharing {
  is_sharing: boolean;
  current_position: {
    latitude: number;
    longitude: number;
    accuracy: number;
    timestamp: string;
  } | null;
  tracking_enabled: boolean;
}

interface PerformanceMetrics {
  average_rating: number;
  total_deliveries: number;
  completion_rate: number;
  on_time_rate: number;
  customer_ratings: number[];
  recent_feedback: Array<{
    rating: number;
    comment: string;
    date: string;
  }>;
}

interface ChatMessage {
  message_id: string;
  sender_type: string;
  sender_name: string;
  content: string;
  message_type: string;
  timestamp: string;
  is_read: boolean;
}

const UV_CourierDashboard: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const [searchParams] = useSearchParams();
  const { auth, realtime, notifications, app_settings, error } = useSelector((state: RootState) => state);

  // URL Parameters
  const shiftDate = searchParams.get('shift_date');
  const jobStatus = searchParams.get('job_status');
  const earningsPeriod = searchParams.get('earnings_period') || 'today';

  // Local state variables aligned with backend schema
  const [courierStatus, setCourierStatus] = useState<CourierStatus>({
    is_available: false,
    current_capacity: 0,
    max_concurrent_deliveries: 3,
    service_radius: 50,
    base_location_lat: null,
    base_location_lng: null
  });

  const [activeJobs, setActiveJobs] = useState<ActiveJob[]>([]);
  const [jobRequests, setJobRequests] = useState<JobRequest[]>([]);
  const [earningsCurrent, setEarningsCurrent] = useState<EarningsCurrent>({
    today_earnings: 0,
    week_earnings: 0,
    month_earnings: 0,
    shift_earnings: 0,
    total_deliveries_today: 0,
    average_per_delivery: 0,
    payment_pending: 0
  });

  const [locationSharing, setLocationSharing] = useState<LocationSharing>({
    is_sharing: false,
    current_position: null,
    tracking_enabled: false
  });

  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics>({
    average_rating: 0,
    total_deliveries: 0,
    completion_rate: 0,
    on_time_rate: 0,
    customer_ratings: [],
    recent_feedback: []
  });

  const [selectedJob, setSelectedJob] = useState<ActiveJob | null>(null);
  const [showJobModal, setShowJobModal] = useState(false);
  const [showEarningsModal, setShowEarningsModal] = useState(false);
  const [showChatModal, setShowChatModal] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [selectedDeliveryForChat, setSelectedDeliveryForChat] = useState<string | null>(null);

  const locationWatchId = useRef<number | null>(null);
  const audioContext = useRef<AudioContext | null>(null);
  const jobRequestInterval = useRef<NodeJS.Timeout | null>(null);

  // Audio notification for new job requests
  const playNotificationSound = (): void => {
    if (!audioContext.current) {
      audioContext.current = new AudioContext();
    }
    const oscillator = audioContext.current.createOscillator();
    const gainNode = audioContext.current.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.current.destination);
    
    oscillator.frequency.value = 800;
    oscillator.type = 'sine';
    gainNode.gain.value = 0.3;
    
    oscillator.start();
    oscillator.stop(audioContext.current.currentTime + 0.3);
  };

  // Backend API calls
  const toggleCourierAvailability = async (): Promise<void> => {
    if (!auth.user?.uid || !auth.session?.access_token) {
      dispatch(add_global_error({
        error_id: `auth_error_${Date.now()}`,
        type: 'authentication',
        message: 'Authentication required',
        technical_details: 'User not authenticated',
        timestamp: new Date().toISOString(),
        user_action_required: true,
        retry_available: false,
        escalation_needed: false
      }));
      return;
    }

    try {
      dispatch(increment_pending_requests());
      const response = await fetch(`/api/v1/couriers/${auth.user.uid}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${auth.session.access_token}`
        },
        body: JSON.stringify({
          is_available: !courierStatus.is_available,
          base_location_lat: locationSharing.current_position?.latitude,
          base_location_lng: locationSharing.current_position?.longitude
        })
      });

      if (response.ok) {
        const data = await response.json();
        setCourierStatus(prev => ({
          ...prev,
          is_available: data.is_available,
          current_capacity: data.current_capacity || 0,
          max_concurrent_deliveries: data.max_concurrent_deliveries || 3
        }));
        
        dispatch(add_toast_notification({
          uid: `availability_${Date.now()}`,
          type: 'system',
          title: 'Availability Updated',
          message: `You are now ${data.is_available ? 'online' : 'offline'}`,
          priority: 'normal',
          is_read: false,
          created_at: new Date().toISOString()
        }));

        if (data.is_available) {
          startLocationTracking();
        } else {
          stopLocationTracking();
        }
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      dispatch(add_global_error({
        error_id: `availability_error_${Date.now()}`,
        type: 'network',
        message: 'Failed to update availability',
        technical_details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        user_action_required: true,
        retry_available: true,
        escalation_needed: false
      }));
    } finally {
      dispatch(decrement_pending_requests());
    }
  };

  const acceptDeliveryRequest = async (deliveryUid: string): Promise<void> => {
    if (!auth.session?.access_token) return;

    try {
      dispatch(increment_pending_requests());
      const response = await fetch(`/api/v1/deliveries/${deliveryUid}/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${auth.session.access_token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        // Remove from job requests and add to active jobs
        setJobRequests(prev => prev.filter(job => job.delivery_uid !== deliveryUid));
        
        const acceptedJob = jobRequests.find(job => job.delivery_uid === deliveryUid);
        if (acceptedJob) {
          setActiveJobs(prev => [...prev, {
            ...acceptedJob,
            delivery_number: data.delivery_number || '',
            status: 'courier_assigned',
            pickup_deadline: data.estimated_delivery_time || '',
            customer_contact: data.pickup_contact_name || ''
          }]);
        }

        dispatch(add_toast_notification({
          uid: `job_accepted_${Date.now()}`,
          type: 'delivery_status',
          title: 'Job Accepted',
          message: 'Navigate to pickup location',
          priority: 'high',
          is_read: false,
          created_at: new Date().toISOString()
        }));
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      dispatch(add_global_error({
        error_id: `accept_error_${Date.now()}`,
        type: 'network',
        message: 'Failed to accept delivery',
        technical_details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        user_action_required: true,
        retry_available: true,
        escalation_needed: false
      }));
    } finally {
      dispatch(decrement_pending_requests());
    }
  };

  const confirmPickup = async (deliveryUid: string): Promise<void> => {
    if (!auth.session?.access_token) return;

    try {
      dispatch(increment_pending_requests());
      const response = await fetch(`/api/v1/deliveries/${deliveryUid}/pickup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${auth.session.access_token}`
        },
        body: JSON.stringify({
          photo_urls: [],
          notes: 'Package collected successfully',
          pickup_time: new Date().toISOString()
        })
      });

      if (response.ok) {
        setActiveJobs(prev => prev.map(job => 
          job.delivery_uid === deliveryUid 
            ? { ...job, status: 'picked_up' }
            : job
        ));

        dispatch(add_toast_notification({
          uid: `pickup_confirmed_${Date.now()}`,
          type: 'delivery_status',
          title: 'Pickup Confirmed',
          message: 'Navigate to delivery location',
          priority: 'high',
          is_read: false,
          created_at: new Date().toISOString()
        }));
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      dispatch(add_global_error({
        error_id: `pickup_error_${Date.now()}`,
        type: 'network',
        message: 'Failed to confirm pickup',
        technical_details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        user_action_required: true,
        retry_available: true,
        escalation_needed: false
      }));
    } finally {
      dispatch(decrement_pending_requests());
    }
  };

  const confirmDelivery = async (deliveryUid: string): Promise<void> => {
    if (!auth.session?.access_token) return;

    try {
      dispatch(increment_pending_requests());
      const response = await fetch(`/api/v1/deliveries/${deliveryUid}/deliver`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${auth.session.access_token}`
        },
        body: JSON.stringify({
          delivery_confirmation_method: 'handed_to_recipient',
          photo_urls: [],
          notes: 'Package delivered successfully',
          delivery_time: new Date().toISOString()
        })
      });

      if (response.ok) {
        setActiveJobs(prev => prev.filter(job => job.delivery_uid !== deliveryUid));
        
        dispatch(add_toast_notification({
          uid: `delivery_completed_${Date.now()}`,
          type: 'delivery_status',
          title: 'Delivery Completed',
          message: 'Payment processed successfully',
          priority: 'high',
          is_read: false,
          created_at: new Date().toISOString()
        }));

        await loadEarnings();
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      dispatch(add_global_error({
        error_id: `delivery_error_${Date.now()}`,
        type: 'network',
        message: 'Failed to complete delivery',
        technical_details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        user_action_required: true,
        retry_available: true,
        escalation_needed: false
      }));
    } finally {
      dispatch(decrement_pending_requests());
    }
  };

  const loadEarnings = async (): Promise<void> => {
    if (!auth.user?.uid || !auth.session?.access_token) return;

    try {
      const params = new URLSearchParams();
      if (shiftDate) {
        params.append('date_from', shiftDate);
        params.append('date_to', shiftDate);
      }

      const response = await fetch(
        `/api/v1/couriers/${auth.user.uid}/earnings${params.toString() ? `?${params}` : ''}`,
        {
          headers: {
            'Authorization': `Bearer ${auth.session.access_token}`
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        const today = new Date().toISOString().split('T')[0];
        const todayData = data.daily_earnings?.find((d: any) => d.date === today);

        setEarningsCurrent({
          today_earnings: todayData?.earnings || 0,
          week_earnings: data.weekly_summary?.total_earnings || 0,
          month_earnings: data.total_earnings || 0,
          shift_earnings: data.current_balance || 0,
          total_deliveries_today: todayData?.deliveries_count || 0,
          average_per_delivery: data.weekly_summary?.average_per_delivery || 0,
          payment_pending: data.current_balance || 0
        });
      }
    } catch (error) {
      console.error('Failed to load earnings:', error);
    }
  };

  const startLocationTracking = (): void => {
    if (!navigator.geolocation) {
      console.error('Geolocation is not supported by this browser.');
      return;
    }

    locationWatchId.current = navigator.geolocation.watchPosition(
      (position) => {
        const newLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: new Date().toISOString()
        };

        setLocationSharing(prev => ({
          ...prev,
          current_position: newLocation,
          is_sharing: true,
          tracking_enabled: true
        }));

        // Only emit location update if websocket is connected
        if (realtime.websocket_connection?.status === 'connected') {
          dispatch(update_courier_location({
            delivery_uid: 'current_courier',
            location: {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              heading: position.coords.heading || 0,
              updated_at: new Date().toISOString(),
              accuracy: position.coords.accuracy
            }
          }));
        }
      },
      (error) => {
        console.error('Location tracking error:', error);
        setLocationSharing(prev => ({
          ...prev,
          is_sharing: false,
          tracking_enabled: false
        }));
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5000
      }
    );
  };

  const stopLocationTracking = (): void => {
    if (locationWatchId.current) {
      navigator.geolocation.clearWatch(locationWatchId.current);
      locationWatchId.current = null;
      setLocationSharing(prev => ({
        ...prev,
        is_sharing: false,
        tracking_enabled: false
      }));
    }
  };

  const sendChatMessage = async (deliveryUid: string, message: string): Promise<void> => {
    if (!auth.session?.access_token) return;

    // Find the delivery to get the customer user ID
    const delivery = activeJobs.find(job => job.delivery_uid === deliveryUid);
    if (!delivery?.sender_user_uid) {
      console.error('Cannot find customer user ID for delivery');
      return;
    }

    try {
      const response = await fetch(`/api/v1/deliveries/${deliveryUid}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${auth.session.access_token}`
        },
        body: JSON.stringify({
          recipient_user_uid: delivery.sender_user_uid,
          message_type: 'text',
          content: message
        })
      });

      if (response.ok) {
        setChatMessages(prev => [...prev, {
          message_id: `msg_${Date.now()}`,
          sender_type: 'courier',
          sender_name: auth.user?.first_name || 'Courier',
          content: message,
          message_type: 'text',
          timestamp: new Date().toISOString(),
          is_read: false
        }]);
        setChatInput('');
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  // Mock data for demonstration
  useEffect(() => {
    // Simulate incoming job requests
    const mockJobRequests: JobRequest[] = [
      {
        delivery_uid: 'del_001',
        pickup_location: { address: '123 Main St', latitude: 40.7128, longitude: -74.0060 },
        delivery_location: { address: '456 Oak Ave', latitude: 40.7589, longitude: -73.9851 },
        package_details: { size: 'medium', weight: 2.5, description: 'Electronics' },
        estimated_earnings: 18.50,
        distance_km: 5.2,
        expires_at: new Date(Date.now() + 300000).toISOString(),
        priority_level: 2
      },
      {
        delivery_uid: 'del_002',
        pickup_location: { address: '789 Pine St', latitude: 40.7505, longitude: -73.9934 },
        delivery_location: { address: '321 Elm Dr', latitude: 40.7831, longitude: -73.9712 },
        package_details: { size: 'small', weight: 1.0, description: 'Documents' },
        estimated_earnings: 12.00,
        distance_km: 3.1,
        expires_at: new Date(Date.now() + 240000).toISOString(),
        priority_level: 1
      }
    ];

    // Filter job requests based on URL parameters
    let filteredRequests = mockJobRequests;
    if (jobStatus) {
      filteredRequests = filteredRequests.filter(job => 
        job.delivery_uid.includes(jobStatus)
      );

    }

    setJobRequests(filteredRequests);
    setPerformanceMetrics({
      average_rating: 4.8,
      total_deliveries: 127,
      completion_rate: 98.5,
      on_time_rate: 94.2,
      customer_ratings: [5, 5, 4, 5, 5],
      recent_feedback: [
        { rating: 5, comment: 'Excellent service!', date: '2024-01-15' },
        { rating: 4, comment: 'Good communication', date: '2024-01-14' }
      ]
    });

    loadEarnings();

    // Cleanup
    return () => {
      stopLocationTracking();
    };
  }, [jobStatus, shiftDate]);

  // Listen for real-time events
  useEffect(() => {
    // Cleanup function for interval
    const cleanup = (): void => {
      if (jobRequestInterval.current) {
        clearInterval(jobRequestInterval.current);
        jobRequestInterval.current = null;
      }
    };

    if (realtime.websocket_connection?.status === 'connected') {
      // Handle new delivery requests
      const handleNewDeliveryRequest = (data: JobRequest): void => {
        setJobRequests(prev => [...prev, data]);
        playNotificationSound();
        dispatch(add_toast_notification({
          uid: `new_job_${Date.now()}`,
          type: 'delivery_status',
          title: 'New Job Request',
          message: `$${data.estimated_earnings.toFixed(2)} - ${data.distance_km}km`,
          priority: 'high',
          is_read: false,
          created_at: new Date().toISOString()
        }));
      };

      // Simulate periodic job requests
      jobRequestInterval.current = setInterval(() => {
        if (courierStatus.is_available && Math.random() > 0.7) {
          const mockRequest: JobRequest = {
            delivery_uid: `del_${Date.now()}`,
            pickup_location: { 
              address: `${Math.floor(Math.random() * 999)} Random St`, 
              latitude: 40.7128 + (Math.random() - 0.5) * 0.1, 
              longitude: -74.0060 + (Math.random() - 0.5) * 0.1 
            },
            delivery_location: { 
              address: `${Math.floor(Math.random() * 999)} Target Ave`, 
              latitude: 40.7589 + (Math.random() - 0.5) * 0.1, 
              longitude: -73.9851 + (Math.random() - 0.5) * 0.1 
            },
            package_details: { 
              size: ['small', 'medium', 'large'][Math.floor(Math.random() * 3)], 
              weight: Math.random() * 5, 
              description: ['Electronics', 'Documents', 'Clothing', 'Food'][Math.floor(Math.random() * 4)]
            },
            estimated_earnings: Math.random() * 20 + 10,
            distance_km: Math.random() * 10 + 2,
            expires_at: new Date(Date.now() + 300000).toISOString(),
            priority_level: Math.floor(Math.random() * 3) + 1
          };
          handleNewDeliveryRequest(mockRequest);
        }
      }, 30000);
    }

    return cleanup;
  }, [realtime.websocket_connection?.status, courierStatus.is_available, dispatch]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopLocationTracking();
    };
  }, []);

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatDistance = (km: number): string => {
    return `${km.toFixed(1)}km`;
  };

  const getCurrentStatusColor = (): string => {
    if (!courierStatus.is_available) return 'bg-gray-500';
    if (activeJobs.length > 0) return 'bg-blue-500';
    return 'bg-green-500';
  };

  const getCurrentStatusText = (): string => {
    if (!courierStatus.is_available) return 'Offline';
    if (activeJobs.length > 0) return 'Busy';
    return 'Available';
  };

  const handleChatSubmit = (): void => {
    if (chatInput.trim() && selectedDeliveryForChat) {
      sendChatMessage(selectedDeliveryForChat, chatInput);
    }
  };

  const handleChatKeyPress = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') {
      handleChatSubmit();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-gray-900">Courier Dashboard</h1>
          <div className="flex items-center space-x-4">
            {/* Availability Status */}
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${getCurrentStatusColor()}`}></div>
              <span className="text-sm font-medium text-gray-700">
                {getCurrentStatusText()}
              </span>
            </div>
            {/* Earnings Quick View */}
            <div className="bg-white px-3 py-1 rounded-lg shadow-sm">
              <span className="text-xs text-gray-500">Today</span>
              <div className="text-lg font-semibold text-green-600">
                {formatCurrency(earningsCurrent.today_earnings)}
              </div>
            </div>
          </div>
        </div>

        {/* Availability Control */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Availability</h2>
              <p className="text-sm text-gray-600">
                {courierStatus.is_available ? 'You are online and receiving job requests' : 'You are offline'}
              </p>
            </div>
            <div className="flex items-center">
              <button
                onClick={toggleCourierAvailability}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 ${
                  courierStatus.is_available ? 'bg-blue-600' : 'bg-gray-200'
                }`}
                aria-label="Toggle availability"
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    courierStatus.is_available ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Jobs */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Active Jobs</h2>
              <span className="text-sm text-gray-500">
                {activeJobs.length} of {courierStatus.max_concurrent_deliveries} jobs
              </span>
            </div>
            
            {activeJobs.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-gray-400 mb-2">
                  <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2 2v-5m16 0h-2M4 13h2m-2 4h2" />
                  </svg>
                </div>
                <p className="text-gray-500">No active jobs</p>
                <p className="text-sm text-gray-400">
                  {courierStatus.is_available ? 'You will receive job requests when available' : 'Turn on availability to receive jobs'}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {activeJobs.map((job) => (
                  <div key={job.delivery_uid} className="border rounded-lg p-4 bg-gray-50">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium text-gray-900">
                          #{job.delivery_uid.slice(-6)}
                        </span>
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          job.status === 'courier_assigned' ? 'bg-blue-100 text-blue-800' :
                          job.status === 'picked_up' ? 'bg-green-100 text-green-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {job.status.replace('_', ' ')}
                        </span>
                      </div>
                      <span className="text-lg font-semibold text-green-600">
                        {formatCurrency(job.estimated_earnings)}
                      </span>
                    </div>
                    
                    <div className="space-y-2 mb-4">
                      <div className="flex items-center text-sm">
                        <div className="w-3 h-3 bg-blue-500 rounded-full mr-2"></div>
                        <span className="text-gray-600">Pickup: {job.pickup_address?.address || 'N/A'}</span>
                      </div>
                      <div className="flex items-center text-sm">
                        <div className="w-3 h-3 bg-red-500 rounded-full mr-2"></div>
                        <span className="text-gray-600">Delivery: {job.delivery_address?.address || 'N/A'}</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => {
                            setSelectedDeliveryForChat(job.delivery_uid);
                            setShowChatModal(true);
                          }}
                          className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200"
                          type="button"
                        >
                          Chat
                        </button>
                        <button 
                          className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
                          type="button"
                        >
                          Navigate
                        </button>
                      </div>
                      <div className="flex space-x-2">
                        {job.status === 'courier_assigned' && (
                          <button
                            onClick={() => confirmPickup(job.delivery_uid)}
                            className="px-4 py-1 text-sm bg-green-600 text-white rounded-md hover:bg-green-700"
                            type="button"
                          >
                            Confirm Pickup
                          </button>
                        )}
                        {job.status === 'picked_up' && (
                          <button
                            onClick={() => confirmDelivery(job.delivery_uid)}
                            className="px-4 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
                            type="button"
                          >
                            Complete Delivery
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Job Requests */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Job Requests</h2>
              <span className="text-sm text-gray-500">
                {jobRequests.length} available
              </span>
            </div>
            
            {!courierStatus.is_available ? (
              <div className="text-center py-8">
                <p className="text-gray-500">Turn on availability to see job requests</p>
              </div>
            ) : jobRequests.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-gray-400 mb-2">
                  <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-gray-500">No job requests available</p>
                <p className="text-sm text-gray-400">New requests will appear here</p>
              </div>
            ) : (
              <div className="space-y-4">
                {jobRequests.map((job) => (
                  <div key={job.delivery_uid} className="border rounded-lg p-4 hover:bg-gray-50">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium text-gray-900">
                          #{job.delivery_uid.slice(-6)}
                        </span>
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          job.priority_level === 3 ? 'bg-red-100 text-red-800' :
                          job.priority_level === 2 ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {job.priority_level === 3 ? 'High Priority' : 
                           job.priority_level === 2 ? 'Medium Priority' : 'Standard'}
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-semibold text-green-600">
                          {formatCurrency(job.estimated_earnings)}
                        </div>
                        <div className="text-sm text-gray-500">
                          {formatDistance(job.distance_km)}
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-2 mb-4">
                      <div className="flex items-center text-sm">
                        <div className="w-3 h-3 bg-blue-500 rounded-full mr-2"></div>
                        <span className="text-gray-600">From: {job.pickup_location.address}</span>
                      </div>
                      <div className="flex items-center text-sm">
                        <div className="w-3 h-3 bg-red-500 rounded-full mr-2"></div>
                        <span className="text-gray-600">To: {job.delivery_location.address}</span>
                      </div>
                      <div className="flex items-center text-sm">
                        <div className="w-3 h-3 bg-gray-400 rounded-full mr-2"></div>
                        <span className="text-gray-600">
                          {job.package_details.size} package - {job.package_details.description}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-gray-500">
                        Expires in {Math.floor((new Date(job.expires_at).getTime() - Date.now()) / 60000)} minutes
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => {
                            setJobRequests(prev => prev.filter(j => j.delivery_uid !== job.delivery_uid));
                          }}
                          className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
                          type="button"
                        >
                          Decline
                        </button>
                        <button
                          onClick={() => acceptDeliveryRequest(job.delivery_uid)}
                          className="px-4 py-1 text-sm bg-green-600 text-white rounded-md hover:bg-green-700"
                          type="button"
                        >
                          Accept
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Earnings Summary */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Earnings</h2>
              <button
                onClick={() => setShowEarningsModal(true)}
                className="text-sm text-blue-600 hover:text-blue-700"
                type="button"
              >
                View Details
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Today</span>
                <span className="text-lg font-semibold text-gray-900">
                  {formatCurrency(earningsCurrent.today_earnings)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">This Week</span>
                <span className="text-lg font-semibold text-gray-900">
                  {formatCurrency(earningsCurrent.week_earnings)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">This Month</span>
                <span className="text-lg font-semibold text-gray-900">
                  {formatCurrency(earningsCurrent.month_earnings)}
                </span>
              </div>
              <div className="border-t pt-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Deliveries Today</span>
                  <span className="text-lg font-semibold text-gray-900">
                    {earningsCurrent.total_deliveries_today}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Avg per Delivery</span>
                  <span className="text-lg font-semibold text-gray-900">
                    {formatCurrency(earningsCurrent.average_per_delivery)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Performance Metrics */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Performance</h2>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Rating</span>
                <div className="flex items-center space-x-2">
                  <div className="flex items-center">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <svg
                        key={star}
                        className={`w-4 h-4 ${
                          star <= Math.floor(performanceMetrics.average_rating)
                            ? 'text-yellow-400'
                            : 'text-gray-300'
                        }`}
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </div>
                  <span className="text-sm font-medium text-gray-900">
                    {performanceMetrics.average_rating.toFixed(1)}
                  </span>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Total Deliveries</span>
                <span className="text-sm font-medium text-gray-900">
                  {performanceMetrics.total_deliveries}
                </span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Completion Rate</span>
                <span className="text-sm font-medium text-gray-900">
                  {performanceMetrics.completion_rate.toFixed(1)}%
                </span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">On-Time Rate</span>
                <span className="text-sm font-medium text-gray-900">
                  {performanceMetrics.on_time_rate.toFixed(1)}%
                </span>
              </div>
            </div>
          </div>

          {/* Location Sharing */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Location Sharing</h2>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Share Location</span>
                <div className="flex items-center">
                  <button
                    onClick={() => {
                      if (locationSharing.is_sharing) {
                        stopLocationTracking();
                      } else {
                        startLocationTracking();
                      }
                    }}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 ${
                      locationSharing.is_sharing ? 'bg-blue-600' : 'bg-gray-200'
                    }`}
                    aria-label="Toggle location sharing"
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        locationSharing.is_sharing ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
              
              {locationSharing.current_position && (
                <div className="text-xs text-gray-500">
                  Last update: {new Date(locationSharing.current_position.timestamp).toLocaleTimeString()}
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
            
            <div className="space-y-2">
              <Link
                to="/profile"
                className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md flex items-center"
              >
                <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Edit Profile
              </Link>
              
              <Link
                to="/help"
                className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md flex items-center"
              >
                <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Help & Support
              </Link>
              
              <button
                onClick={() => setShowEarningsModal(true)}
                className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md flex items-center"
                type="button"
              >
                <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                </svg>
                View Earnings
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Chat Modal */}
      {showChatModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="flex items-center justify-between pb-3 border-b">
              <h3 className="text-lg font-semibold text-gray-900">Customer Chat</h3>
              <button
                onClick={() => setShowChatModal(false)}
                className="text-gray-400 hover:text-gray-600"
                type="button"
                aria-label="Close chat"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="py-4">
              <div className="h-64 overflow-y-auto mb-4 space-y-2">
                {chatMessages.length === 0 ? (
                  <div className="text-center text-gray-500 py-8">
                    No messages yet
                  </div>
                ) : (
                  chatMessages.map((message, index) => (
                    <div
                      key={index}
                      className={`flex ${
                        message.sender_type === 'courier' ? 'justify-end' : 'justify-start'
                      }`}
                    >
                      <div
                        className={`max-w-xs px-3 py-2 rounded-lg text-sm ${
                          message.sender_type === 'courier'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-200 text-gray-900'
                        }`}
                      >
                        {message.content}
                      </div>
                    </div>
                  ))
                )}
              </div>
              
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Type your message..."
                  className="flex-1 border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                  onKeyPress={handleChatKeyPress}
                />
                <button
                  onClick={handleChatSubmit}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
                  type="button"
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Earnings Modal */}
      {showEarningsModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
            <div className="flex items-center justify-between pb-3 border-b">
              <h3 className="text-lg font-semibold text-gray-900">Earnings Details</h3>
              <button
                onClick={() => setShowEarningsModal(false)}
                className="text-gray-400 hover:text-gray-600"
                type="button"
                aria-label="Close earnings modal"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="py-4">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="text-sm text-gray-600">Today</div>
                    <div className="text-2xl font-bold text-gray-900">
                      {formatCurrency(earningsCurrent.today_earnings)}
                    </div>
                    <div className="text-sm text-gray-500">
                      {earningsCurrent.total_deliveries_today} deliveries
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="text-sm text-gray-600">This Week</div>
                    <div className="text-2xl font-bold text-gray-900">
                      {formatCurrency(earningsCurrent.week_earnings)}
                    </div>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="text-sm text-gray-600">This Month</div>
                    <div className="text-2xl font-bold text-gray-900">
                      {formatCurrency(earningsCurrent.month_earnings)}
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="text-sm text-gray-600">Average per Delivery</div>
                    <div className="text-2xl font-bold text-gray-900">
                      {formatCurrency(earningsCurrent.average_per_delivery)}
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="mt-6 pt-6 border-t">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-600">Payment Pending</div>
                  <div className="text-lg font-semibold text-green-600">
                    {formatCurrency(earningsCurrent.payment_pending)}
                  </div>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Payments are processed weekly on Fridays
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UV_CourierDashboard;