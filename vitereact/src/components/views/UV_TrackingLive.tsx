import React, { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { 
  RootState, 
  AppDispatch,
  add_subscription,
  remove_subscription,
  add_toast_notification,
  add_notification
} from '@/store/main';

interface DeliveryDetails {
  uid: string;
  delivery_number: string;
  status: string;
  pickup_address: {
    street_address: string;
    city: string;
    latitude: number;
    longitude: number;
  };
  delivery_address: {
    street_address: string;
    city: string;
    latitude: number;
    longitude: number;
  };
  package_info: Array<{
    package_number: number;
    description: string;
    size: string;
    weight: number;
  }>;
  sender_info: {
    first_name: string;
    last_name: string;
  };
  recipient_info: {
    first_name: string;
    last_name: string;
  };
  estimated_pickup_time: string;
  estimated_delivery_time: string;
  actual_pickup_time: string;
  actual_delivery_time: string;
  courier_info?: {
    uid: string;
    first_name: string;
    last_name: string;
    vehicle_type: string;
    average_rating: number;
    total_deliveries: number;
    profile_photo_url: string;
  };
  packages?: Array<{
    package_number: number;
    description?: string;
    size: string;
    weight?: number;
  }>;
  tracking_history?: Array<{
    status: string;
    created_at: string;
    notes?: string;
  }>;
}

interface ChatMessage {
  message_uid: string;
  sender_uid: string;
  sender_name: string;
  sender_type: string;
  message_type: string;
  content: string;
  photo_url?: string;
  location?: {
    latitude: number;
    longitude: number;
  };
  timestamp: string;
  is_read: boolean;
}

interface DeliveryProof {
  pickup_photos: string[];
  delivery_photos: string[];
  signature_data: string | null;
  recipient_name: string | null;
  delivery_method: string | null;
  proof_timestamp: string | null;
  location_verification: {
    latitude: number;
    longitude: number;
  } | null;
}

const UV_TrackingLive: React.FC = () => {
  const { delivery_uid, delivery_number } = useParams<{
    delivery_uid?: string;
    delivery_number?: string;
  }>();
  
  const [searchParams] = useSearchParams();
  const share_token = searchParams.get('share_token');
  const recipient_view = searchParams.get('recipient') === 'true';
  const embed_mode = searchParams.get('embed') === 'true';

  const dispatch = useDispatch<AppDispatch>();
  const auth_state = useSelector((state: RootState) => state.auth);
  const realtime_state = useSelector((state: RootState) => state.realtime);
  const app_settings = useSelector((state: RootState) => state.app_settings);
  const error_state = useSelector((state: RootState) => state.error);

  // State variables from datamap
  const [delivery_details, setDeliveryDetails] = useState<DeliveryDetails | null>(null);
  const [courier_location, setCourierLocation] = useState<{
    courier_uid: string;
    current_position: {
      latitude: number;
      longitude: number;
      accuracy: number;
      heading: number;
      speed: number;
      timestamp: string;
    };
    route_progress: number;
    distance_remaining: number;
    is_moving: boolean;
  } | null>(null);

  const [delivery_status, setDeliveryStatus] = useState<{
    current_status: string;
    status_timestamp: string;
    progress_percentage: number;
    milestone_history: Array<{
      status: string;
      timestamp: string;
      notes?: string;
    }>;
    next_expected_status: string;
    status_descriptions: Record<string, string>;
  }>({
    current_status: 'unknown',
    status_timestamp: '',
    progress_percentage: 0,
    milestone_history: [],
    next_expected_status: '',
    status_descriptions: {}
  });

  const [estimated_arrival, setEstimatedArrival] = useState<{
    pickup_eta: string | null;
    delivery_eta: string | null;
    confidence_level: string;
    delay_minutes: number;
    traffic_impact: string;
    weather_impact: string;
    last_updated: string | null;
  }>({
    pickup_eta: null,
    delivery_eta: null,
    confidence_level: 'unknown',
    delay_minutes: 0,
    traffic_impact: 'none',
    weather_impact: 'none',
    last_updated: null
  });

  const [chat_messages, setChatMessages] = useState<ChatMessage[]>([]);
  const [delivery_proof, setDeliveryProof] = useState<DeliveryProof>({
    pickup_photos: [],
    delivery_photos: [],
    signature_data: null,
    recipient_name: null,
    delivery_method: null,
    proof_timestamp: null,
    location_verification: null
  });

  const [sharing_settings, setSharingSettings] = useState<{
    is_public: boolean;
    share_token: string | null;
    shared_with: string[];
    privacy_level: string;
    expiry_time: string | null;
  }>({
    is_public: false,
    share_token: share_token || null,
    shared_with: [],
    privacy_level: 'private',
    expiry_time: null
  });

  const [map_configuration, setMapConfiguration] = useState<{
    zoom_level: number;
    map_type: string;
    show_route: boolean;
    show_traffic: boolean;
    center_on_courier: boolean;
    fullscreen_mode: boolean;
    marker_icons: Record<string, string>;
  }>({
    zoom_level: 12,
    map_type: 'roadmap',
    show_route: true,
    show_traffic: false,
    center_on_courier: true,
    fullscreen_mode: false,
    marker_icons: {}
  });

  // Component state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chat_input, setChatInput] = useState('');
  const [sharing_modal_open, setSharingModalOpen] = useState(false);
  const [issue_report_open, setIssueReportOpen] = useState(false);
  const [chat_open, setChatOpen] = useState(false);
  const [refresh_loading, setRefreshLoading] = useState(false);

  const refresh_interval_ref = useRef<NodeJS.Timeout | null>(null);
  const chat_container_ref = useRef<HTMLDivElement>(null);
  const subscription_id_ref = useRef<string | null>(null);

  // Status descriptions mapping
  const status_descriptions = {
    'requested': 'Your delivery request has been submitted and we\'re finding a courier',
    'courier_assigned': 'A courier has been assigned to your delivery',
    'en_route_pickup': 'Your courier is on the way to pick up your package',
    'picked_up': 'Your package has been picked up and is in transit',
    'en_route_delivery': 'Your courier is on the way to deliver your package',
    'delivered': 'Your package has been delivered successfully',
    'cancelled': 'This delivery has been cancelled',
    'failed': 'This delivery could not be completed'
  };

  // Fetch delivery details
  const fetch_delivery_details = async () => {
    try {
      setLoading(true);
      setError(null);

      const delivery_id = delivery_uid || delivery_number;
      if (!delivery_id) {
        throw new Error('No delivery identifier provided');
      }

      // Build request URL based on authentication and access type
      let url = '';
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };

      if (delivery_uid && auth_state.session?.access_token) {
        // Authenticated access
        url = `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/v1/deliveries/${delivery_uid}`;
        headers['Authorization'] = `Bearer ${auth_state.session.access_token}`;
      } else if (delivery_number) {
        // Public tracking access using status endpoint
        url = `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/v1/deliveries/${delivery_number}/status`;
        if (share_token) {
          url += `?share_token=${share_token}`;
        }
      } else {
        throw new Error('Invalid access method');
      }

      const response = await fetch(url, { headers });
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Delivery not found');
        } else if (response.status === 403) {
          throw new Error('Access denied - invalid sharing token');
        } else {
          throw new Error('Failed to load delivery details');
        }
      }

      const data = await response.json();
      // Map API response to component state structure
      const mapped_data: DeliveryDetails = {
        ...data,
        package_info: data.packages || [],
        sender_info: data.sender_info || { first_name: '', last_name: '' },
        recipient_info: data.recipient_info || { first_name: '', last_name: '' }
      };
      setDeliveryDetails(mapped_data);

      // Update delivery status with correct field mapping
      setDeliveryStatus({
        current_status: data.status || 'unknown',
        status_timestamp: data.updated_at || '',
        progress_percentage: getProgressPercentage(data.status || 'unknown'),
        milestone_history: (data.tracking_history || []).map((item: any) => ({
          status: item.status,
          timestamp: item.created_at,
          notes: item.notes
        })),
        next_expected_status: getNextExpectedStatus(data.status || 'unknown'),
        status_descriptions
      });

      // Set estimated arrival times
      if (data.estimated_delivery_time) {
        setEstimatedArrival(prev => ({
          ...prev,
          delivery_eta: data.estimated_delivery_time,
          last_updated: new Date().toISOString()
        }));
      }

      // Load chat messages if authenticated
      if (auth_state.session?.access_token && data.uid) {
        await load_chat_messages(data.uid);
      }

      // Subscribe to real-time updates
      if (data.courier_info?.uid && data.uid) {
        subscribe_location_updates(data.uid);
      }

    } catch (error) {
      console.error('Failed to fetch delivery details:', error);
      setError(error instanceof Error ? error.message : 'Failed to load delivery details');
    } finally {
      setLoading(false);
    }
  };

  // Load chat messages
  const load_chat_messages = async (delivery_id: string) => {
    try {
      if (!auth_state.session?.access_token) return;

      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/v1/deliveries/${delivery_id}/messages`,
        {
          headers: {
            'Authorization': `Bearer ${auth_state.session.access_token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.ok) {
        const messages = await response.json();
        setChatMessages(messages);
      }
    } catch (error) {
      console.error('Failed to load chat messages:', error);
    }
  };

  // Subscribe to real-time location updates
  const subscribe_location_updates = (delivery_id: string) => {
    if (realtime_state.websocket_connection.status === 'connected') {
      const sub_id = `delivery_${delivery_id}`;
      subscription_id_ref.current = sub_id;
      dispatch(add_subscription({
        channel: 'delivery_updates',
        subscription_id: sub_id
      }));
    }
  };

  // Send chat message
  const send_chat_message = async () => {
    if (!chat_input.trim() || !delivery_details || !auth_state.session?.access_token) return;

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/v1/deliveries/${delivery_details.uid}/messages`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${auth_state.session.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            recipient_user_uid: delivery_details.courier_info?.uid || '',
            message_type: 'text',
            content: chat_input.trim()
          })
        }
      );

      if (response.ok) {
        const new_message = await response.json();
        setChatMessages(prev => [...prev, new_message]);
        setChatInput('');

        // Scroll to bottom of chat
        if (chat_container_ref.current) {
          chat_container_ref.current.scrollTop = chat_container_ref.current.scrollHeight;
        }
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      dispatch(add_toast_notification({
        uid: `error_${Date.now()}`,
        type: 'system',
        title: 'Message Failed',
        message: 'Could not send message. Please try again.',
        priority: 'normal',
        is_read: false,
        created_at: new Date().toISOString()
      }));
    }
  };

  // Share tracking link with proper error handling
  const share_tracking_link = async (method: string) => {
    if (!delivery_details) return;

    try {
      let share_url = `${window.location.origin}/track/${delivery_details.delivery_number}`;
      
      if (sharing_settings.share_token) {
        share_url += `?share_token=${sharing_settings.share_token}`;
      }

      if (method === 'copy') {
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(share_url);
          } else {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = share_url;
            textArea.style.position = 'fixed';
            textArea.style.opacity = '0';
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
          }
          dispatch(add_toast_notification({
            uid: `share_success_${Date.now()}`,
            type: 'system',
            title: 'Link Copied',
            message: 'Tracking link copied to clipboard',
            priority: 'normal',
            is_read: false,
            created_at: new Date().toISOString()
          }));
        } catch (clipboard_error) {
          console.error('Failed to copy to clipboard:', clipboard_error);
          dispatch(add_toast_notification({
            uid: `share_error_${Date.now()}`,
            type: 'system',
            title: 'Copy Failed',
            message: 'Could not copy link to clipboard',
            priority: 'normal',
            is_read: false,
            created_at: new Date().toISOString()
          }));
        }
      } else if (method === 'sms') {
        window.open(`sms:?body=Track your delivery: ${share_url}`);
      } else if (method === 'email') {
        window.open(`mailto:?subject=Delivery Tracking&body=Track your delivery: ${share_url}`);
      }

      setSharingModalOpen(false);
    } catch (error) {
      console.error('Failed to share tracking link:', error);
    }
  };

  // Download delivery receipt
  const download_delivery_receipt = async () => {
    if (!delivery_details || !auth_state.session?.access_token) return;

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/v1/deliveries/${delivery_details.uid}/receipt`,
        {
          headers: {
            'Authorization': `Bearer ${auth_state.session.access_token}`
          }
        }
      );

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `delivery_receipt_${delivery_details.delivery_number}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Failed to download receipt:', error);
      dispatch(add_toast_notification({
        uid: `download_error_${Date.now()}`,
        type: 'system',
        title: 'Download Failed',
        message: 'Could not download delivery receipt',
        priority: 'normal',
        is_read: false,
        created_at: new Date().toISOString()
      }));
    }
  };

  // Report delivery issue
  const report_delivery_issue = async (issue_type: string, description: string) => {
    if (!delivery_details) return;

    try {
      // Create support ticket (simulated)
      dispatch(add_notification({
        uid: `support_${Date.now()}`,
        type: 'system',
        title: 'Issue Reported',
        message: `We've received your ${issue_type} report and will investigate immediately.`,
        priority: 'high',
        is_read: false,
        created_at: new Date().toISOString(),
        action_url: '/help'
      }));

      setIssueReportOpen(false);
    } catch (error) {
      console.error('Failed to report issue:', error);
    }
  };

  // Refresh tracking status
  const refresh_tracking_status = async () => {
    setRefreshLoading(true);
    await fetch_delivery_details();
    setRefreshLoading(false);
  };

  // Helper functions
  const getProgressPercentage = (status: string): number => {
    const progress_map: Record<string, number> = {
      'requested': 10,
      'courier_assigned': 25,
      'en_route_pickup': 40,
      'picked_up': 60,
      'en_route_delivery': 80,
      'delivered': 100,
      'cancelled': 0,
      'failed': 0
    };
    return progress_map[status] || 0;
  };

  const getNextExpectedStatus = (current_status: string): string => {
    const next_status_map: Record<string, string> = {
      'requested': 'courier_assigned',
      'courier_assigned': 'en_route_pickup',
      'en_route_pickup': 'picked_up',
      'picked_up': 'en_route_delivery',
      'en_route_delivery': 'delivered'
    };
    return next_status_map[current_status] || '';
  };

  const formatTimestamp = (timestamp: string): string => {
    if (!timestamp) return '';
    return new Date(timestamp).toLocaleString(app_settings.language || 'en-US', {
      timeZone: app_settings.timezone || 'UTC'
    });
  };

  const getStatusColor = (status: string): string => {
    const color_map: Record<string, string> = {
      'requested': 'text-blue-600',
      'courier_assigned': 'text-purple-600',
      'en_route_pickup': 'text-orange-600',
      'picked_up': 'text-yellow-600',
      'en_route_delivery': 'text-blue-600',
      'delivered': 'text-green-600',
      'cancelled': 'text-red-600',
      'failed': 'text-red-600'
    };
    return color_map[status] || 'text-gray-600';
  };

  // Effects
  useEffect(() => {
    fetch_delivery_details();

    // Set up refresh interval
    refresh_interval_ref.current = setInterval(() => {
      if (!loading && delivery_details) {
        refresh_tracking_status();
      }
    }, 30000); // Refresh every 30 seconds

    return () => {
      if (refresh_interval_ref.current) {
        clearInterval(refresh_interval_ref.current);
      }
      
      // Clean up subscriptions with correct subscription ID
      if (subscription_id_ref.current) {
        dispatch(remove_subscription(subscription_id_ref.current));
      }
    };
  }, [delivery_uid, delivery_number, share_token]);

  // Update courier location from global state
  useEffect(() => {
    if (delivery_details && realtime_state.courier_location_updates?.[delivery_details.uid]) {
      const location_data = realtime_state.courier_location_updates[delivery_details.uid];
      setCourierLocation(prev => ({
        ...prev,
        courier_uid: delivery_details.courier_info?.uid || '',
        current_position: {
          latitude: location_data.latitude,
          longitude: location_data.longitude,
          accuracy: location_data.accuracy || 0,
          heading: location_data.heading || 0,
          speed: 0,
          timestamp: location_data.updated_at
        },
        route_progress: 0,
        distance_remaining: 0,
        is_moving: true
      }));
    }
  }, [realtime_state.courier_location_updates, delivery_details]);

  // Update delivery status from global state
  useEffect(() => {
    if (delivery_details && realtime_state.delivery_status_updates?.[delivery_details.uid]) {
      const status_data = realtime_state.delivery_status_updates[delivery_details.uid];
      setDeliveryStatus(prev => ({
        ...prev,
        current_status: status_data.status,
        status_timestamp: status_data.timestamp,
        progress_percentage: getProgressPercentage(status_data.status),
        next_expected_status: getNextExpectedStatus(status_data.status)
      }));
    }
  }, [realtime_state.delivery_status_updates, delivery_details]);

  if (loading) {
    return (
      <>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-lg text-gray-600">Loading tracking information...</p>
          </div>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center max-w-md mx-auto p-6">
            <div className="bg-red-100 rounded-full p-3 mx-auto w-16 h-16 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.982 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Tracking Error</h1>
            <p className="text-gray-600 mb-6">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      </>
    );
  }

  if (!delivery_details) {
    return (
      <>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <p className="text-lg text-gray-600">No delivery information available</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className={`min-h-screen bg-gray-50 ${embed_mode ? 'p-0' : 'p-4'}`}>
        {/* Header */}
        {!embed_mode && (
          <div className="max-w-7xl mx-auto mb-6">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Delivery Tracking</h1>
                  <p className="text-gray-600">#{delivery_details.delivery_number}</p>
                </div>
                <div className="flex items-center space-x-3">
                  <button
                    onClick={refresh_tracking_status}
                    disabled={refresh_loading}
                    className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    <svg className={`w-4 h-4 ${refresh_loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 014.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span>Refresh</span>
                  </button>
                  <button
                    onClick={() => setSharingModalOpen(true)}
                    className="flex items-center space-x-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
                    </svg>
                    <span>Share</span>
                  </button>
                  {auth_state.session && delivery_status.current_status === 'delivered' && (
                    <button
                      onClick={download_delivery_receipt}
                      className="flex items-center space-x-2 px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span>Receipt</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content - Map and Timeline */}
          <div className="lg:col-span-2 space-y-6">
            {/* Live Map */}
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              <div className="h-96 bg-gradient-to-br from-blue-100 to-green-100 relative flex items-center justify-center">
                <div className="text-center">
                  <div className="bg-white rounded-full p-4 mb-4 shadow-lg inline-block">
                    <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <p className="text-gray-600">Interactive map showing courier location</p>
                  {courier_location && (
                    <p className="text-sm text-gray-500 mt-2">
                      Last updated: {formatTimestamp(courier_location.current_position.timestamp)}
                    </p>
                  )}
                </div>

                {/* Map Controls */}
                <div className="absolute top-4 right-4 flex flex-col space-y-2">
                  <button
                    onClick={() => setMapConfiguration(prev => ({ ...prev, show_traffic: !prev.show_traffic }))}
                    className={`p-2 rounded-lg shadow-lg ${map_configuration.show_traffic ? 'bg-blue-600 text-white' : 'bg-white text-gray-600'} hover:shadow-xl transition-all`}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setMapConfiguration(prev => ({ ...prev, fullscreen_mode: !prev.fullscreen_mode }))}
                    className="p-2 bg-white text-gray-600 rounded-lg shadow-lg hover:shadow-xl transition-all"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            {/* Delivery Timeline */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Delivery Progress</h2>

              {/* Progress Bar */}
              <div className="mb-8">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Progress</span>
                  <span className="text-sm text-gray-500">{delivery_status.progress_percentage}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-in-out"
                    style={{ width: `${delivery_status.progress_percentage}%` }}
                  ></div>
                </div>
              </div>

              {/* Current Status */}
              <div className="bg-blue-50 rounded-lg p-4 mb-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className={`text-lg font-semibold ${getStatusColor(delivery_status.current_status)}`}>
                      {delivery_status.current_status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </h3>
                    <p className="text-gray-600 mt-1">
                      {delivery_status.status_descriptions[delivery_status.current_status] || 'Status update'}
                    </p>
                    {delivery_status.status_timestamp && (
                      <p className="text-sm text-gray-500 mt-1">
                        Updated: {formatTimestamp(delivery_status.status_timestamp)}
                      </p>
                    )}
                  </div>
                  <div className="flex-shrink-0">
                    <div className={`w-4 h-4 rounded-full ${delivery_status.current_status === 'delivered' ? 'bg-green-500' : 'bg-blue-500'} animate-pulse`}></div>
                  </div>
                </div>
              </div>

              {/* Timeline */}
              <div className="space-y-4">
                {delivery_status.milestone_history.map((milestone, index) => (
                  <div key={index} className="flex items-start space-x-4">
                    <div className="flex-shrink-0">
                      <div className={`w-3 h-3 rounded-full ${milestone.status === delivery_status.current_status ? 'bg-blue-600' : 'bg-gray-400'}`}></div>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        {milestone.status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </p>
                      {milestone.notes && (
                        <p className="text-sm text-gray-600">{milestone.notes}</p>
                      )}
                      <p className="text-xs text-gray-500">{formatTimestamp(milestone.timestamp)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* ETA Card */}
            {estimated_arrival.delivery_eta && (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Estimated Arrival</h3>
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600 mb-2">
                    {new Date(estimated_arrival.delivery_eta).toLocaleTimeString(app_settings.language || 'en-US', {
                      hour: '2-digit',
                      minute: '2-digit',
                      timeZone: app_settings.timezone || 'UTC'
                    })}
                  </div>
                  <p className="text-gray-600">
                    {new Date(estimated_arrival.delivery_eta).toLocaleDateString(app_settings.language || 'en-US', {
                      weekday: 'long',
                      month: 'short',
                      day: 'numeric',
                      timeZone: app_settings.timezone || 'UTC'
                    })}
                  </p>
                  {estimated_arrival.delay_minutes > 0 && (
                    <p className="text-orange-600 text-sm mt-2">
                      {estimated_arrival.delay_minutes} min delay due to {estimated_arrival.traffic_impact}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Courier Info */}
            {delivery_details.courier_info && (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Your Courier</h3>
                <div className="flex items-center space-x-4 mb-4">
                  <img
                    src={delivery_details.courier_info.profile_photo_url || `https://picsum.photos/80/80?random=${delivery_details.courier_info.uid}`}
                    alt="Courier"
                    className="w-16 h-16 rounded-full object-cover"
                  />
                  <div>
                    <h4 className="font-semibold text-gray-900">
                      {delivery_details.courier_info.first_name} {delivery_details.courier_info.last_name}
                    </h4>
                    <p className="text-gray-600 capitalize">{delivery_details.courier_info.vehicle_type}</p>
                    <div className="flex items-center mt-1">
                      <div className="flex text-yellow-400">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <svg 
                            key={star} 
                            className={`w-4 h-4 ${star <= delivery_details.courier_info!.average_rating ? 'fill-current' : 'text-gray-300'}`} 
                            viewBox="0 0 20 20"
                          >
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                        ))}
                      </div>
                      <span className="text-sm text-gray-600 ml-1">
                        ({delivery_details.courier_info.total_deliveries} deliveries)
                      </span>
                    </div>
                  </div>
                </div>

                {/* Contact Options */}
                {auth_state.session && (
                  <div className="flex space-x-2">
                    <button
                      onClick={() => setChatOpen(true)}
                      className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                    >
                      Message
                    </button>
                    <button
                      onClick={() => setIssueReportOpen(true)}
                      className="flex-1 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
                    >
                      Report Issue
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Delivery Details */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Delivery Details</h3>
              
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-1">From</h4>
                  <p className="text-sm text-gray-600">
                    {delivery_details.pickup_address.street_address}, {delivery_details.pickup_address.city}
                  </p>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-1">To</h4>
                  <p className="text-sm text-gray-600">
                    {delivery_details.delivery_address.street_address}, {delivery_details.delivery_address.city}
                  </p>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-1">Packages</h4>
                  {delivery_details.package_info.map((pkg, index) => (
                    <div key={index} className="bg-gray-50 p-3 rounded-lg mb-2">
                      <p className="text-sm font-medium text-gray-900">Package #{pkg.package_number}</p>
                      {pkg.description && (
                        <p className="text-sm text-gray-600">{pkg.description}</p>
                      )}
                      <p className="text-xs text-gray-500 mt-1">
                        Size: {pkg.size} • Weight: {pkg.weight}kg
                      </p>
                    </div>
                  ))}
                </div>

                {!recipient_view && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-1">Recipient</h4>
                    <p className="text-sm text-gray-600">
                      {delivery_details.recipient_info.first_name} {delivery_details.recipient_info.last_name}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Delivery Proof */}
            {delivery_proof.pickup_photos.length > 0 || delivery_proof.delivery_photos.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Delivery Proof</h3>
                
                {delivery_proof.pickup_photos.length > 0 && (
                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Pickup Photos</h4>
                    <div className="grid grid-cols-2 gap-2">
                      {delivery_proof.pickup_photos.map((photo, index) => (
                        <img 
                          key={index} 
                          src={photo} 
                          alt={`Pickup ${index + 1}`}
                          className="w-full h-20 object-cover rounded-lg"
                        />
                      ))}
                    </div>
                  </div>
                )}

                {delivery_proof.delivery_photos.length > 0 && (
                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Delivery Photos</h4>
                    <div className="grid grid-cols-2 gap-2">
                      {delivery_proof.delivery_photos.map((photo, index) => (
                        <img 
                          key={index} 
                          src={photo} 
                          alt={`Delivery ${index + 1}`}
                          className="w-full h-20 object-cover rounded-lg"
                        />
                      ))}
                    </div>
                  </div>
                )}

                {delivery_proof.signature_data && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Digital Signature</h4>
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <p className="text-sm text-gray-600">Signature captured</p>
                      {delivery_proof.recipient_name && (
                        <p className="text-xs text-gray-500">Received by: {delivery_proof.recipient_name}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Chat Modal */}
        {chat_open && auth_state.session && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[80vh] flex flex-col">
              <div className="flex items-center justify-between p-4 border-b">
                <h3 className="text-lg font-semibold">Message Courier</h3>
                <button
                  onClick={() => setChatOpen(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div ref={chat_container_ref} className="flex-1 p-4 overflow-y-auto space-y-3">
                {chat_messages.length === 0 ? (
                  <p className="text-gray-500 text-center">No messages yet. Start a conversation!</p>
                ) : (
                  chat_messages.map((message, index) => (
                    <div 
                      key={index}
                      className={`flex ${message.sender_uid === auth_state.user?.uid ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`max-w-xs px-4 py-2 rounded-lg ${
                        message.sender_uid === auth_state.user?.uid 
                          ? 'bg-blue-600 text-white' 
                          : 'bg-gray-100 text-gray-900'
                      }`}>
                        <p className="text-sm">{message.content}</p>
                        <p className={`text-xs mt-1 ${
                          message.sender_uid === auth_state.user?.uid ? 'text-blue-100' : 'text-gray-500'
                        }`}>
                          {formatTimestamp(message.timestamp)}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="p-4 border-t">
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={chat_input}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && send_chat_message()}
                    placeholder="Type your message..."
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={send_chat_message}
                    disabled={!chat_input.trim()}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    Send
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Sharing Modal */}
        {sharing_modal_open && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Share Tracking</h3>
                <button
                  onClick={() => setSharingModalOpen(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-3">
                <button
                  onClick={() => share_tracking_link('copy')}
                  className="w-full flex items-center space-x-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  <span>Copy Link</span>
                </button>

                <button
                  onClick={() => share_tracking_link('sms')}
                  className="w-full flex items-center space-x-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <span>Send SMS</span>
                </button>

                <button
                  onClick={() => share_tracking_link('email')}
                  className="w-full flex items-center space-x-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <span>Send Email</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Issue Report Modal */}
        {issue_report_open && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Report Issue</h3>
                <button
                  onClick={() => setIssueReportOpen(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-3">
                <button
                  onClick={() => report_delivery_issue('delay', 'Delivery delay reported')}
                  className="w-full text-left p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="font-medium">Delivery Delay</div>
                  <div className="text-sm text-gray-600">The delivery is taking longer than expected</div>
                </button>

                <button
                  onClick={() => report_delivery_issue('wrong_location', 'Wrong location reported')}
                  className="w-full text-left p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="font-medium">Wrong Location</div>
                  <div className="text-sm text-gray-600">The courier went to the wrong address</div>
                </button>

                <button
                  onClick={() => report_delivery_issue('communication', 'Communication issue reported')}
                  className="w-full text-left p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="font-medium">Communication Issue</div>
                  <div className="text-sm text-gray-600">Unable to reach the courier</div>
                </button>

                <button
                  onClick={() => report_delivery_issue('other', 'Other issue reported')}
                  className="w-full text-left p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="font-medium">Other Issue</div>
                  <div className="text-sm text-gray-600">Something else went wrong</div>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Back to Dashboard Link (non-embed mode) */}
        {!embed_mode && auth_state.session && (
          <div className="max-w-7xl mx-auto mt-6">
            <Link
              to={auth_state.user?.user_type === 'courier' ? '/courier-dashboard' : '/dashboard'}
              className="inline-flex items-center space-x-2 text-blue-600 hover:text-blue-700 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span>Back to Dashboard</span>
            </Link>
          </div>
        )}
      </div>
    </>
  );
};

export default UV_TrackingLive;