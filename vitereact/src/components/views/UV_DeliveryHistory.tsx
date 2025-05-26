import React, { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch, update_last_activity } from '@/store/main';
import axios from 'axios';

interface DeliveryItem {
  uid: string;
  delivery_number: string;
  status: string;
  pickup_address: string;
  delivery_address: string;
  delivery_date: string;
  total_price: number;
  courier_name: string;
  courier_rating: number;
  package_count: number;
  delivery_time_minutes: number;
  thumbnail_url: string;
}

interface DeliveryHistoryData {
  deliveries: DeliveryItem[];
  pagination: {
    current_page: number;
    total_pages: number;
    total_count: number;
    per_page: number;
    has_next: boolean;
    has_previous: boolean;
  };
}

interface FilterCriteria {
  status_filter: string;
  date_range: {
    start_date: string | null;
    end_date: string | null;
  };
  search_query: string;
  sort_by: string;
  sort_order: string;
  courier_filter: string;
  price_range: {
    min_price: number | null;
    max_price: number | null;
  };
}

interface DeliveryTemplate {
  uid: string;
  name: string;
  pickup_address: any;
  delivery_address: any;
  default_packages: any[];
  usage_count: number;
  created_at: string;
}

interface HistoryAnalytics {
  total_deliveries: number;
  total_spent: number;
  average_delivery_time: number;
  success_rate: number;
  preferred_couriers: Array<{
    courier_name: string;
    delivery_count: number;
    average_rating: number;
  }>;
  monthly_trends: Array<{
    month: string;
    delivery_count: number;
    total_cost: number;
  }>;
  cost_savings: number;
}

interface ExportStatus {
  is_exporting: boolean;
  export_progress: number;
  export_format: string | null;
  download_url: string | null;
  error_message: string | null;
}

const UV_DeliveryHistory: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  
  // Global state
  const authState = useSelector((state: RootState) => state.auth);
  const appSettings = useSelector((state: RootState) => state.app_settings);
  
  // Local state
  const [deliveryHistory, setDeliveryHistory] = useState<DeliveryHistoryData>({
    deliveries: [],
    pagination: {
      current_page: 1,
      total_pages: 0,
      total_count: 0,
      per_page: 20,
      has_next: false,
      has_previous: false,
    },
  });

  const [filterCriteria, setFilterCriteria] = useState<FilterCriteria>({
    status_filter: searchParams.get('status') || 'all',
    date_range: {
      start_date: searchParams.get('date_from') || null,
      end_date: searchParams.get('date_to') || null,
    },
    search_query: searchParams.get('search') || '',
    sort_by: 'created_at',
    sort_order: searchParams.get('sort_order') || 'desc',
    courier_filter: 'all',
    price_range: {
      min_price: null,
      max_price: null,
    },
  });

  const [selectedDeliveries, setSelectedDeliveries] = useState<string[]>([]);
  const [deliveryTemplates, setDeliveryTemplates] = useState<DeliveryTemplate[]>([]);
  const [historyAnalytics, setHistoryAnalytics] = useState<HistoryAnalytics>({
    total_deliveries: 0,
    total_spent: 0,
    average_delivery_time: 0,
    success_rate: 0,
    preferred_couriers: [],
    monthly_trends: [],
    cost_savings: 0,
  });
  const [exportStatus, setExportStatus] = useState<ExportStatus>({
    is_exporting: false,
    export_progress: 0,
    export_format: null,
    download_url: null,
    error_message: null,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [activeTab, setActiveTab] = useState<'list' | 'analytics'>('list');
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [selectedTemplateDelivery, setSelectedTemplateDelivery] = useState<string | null>(null);

  // Load delivery history
  const loadDeliveryHistory = useCallback(async () => {
    if (!authState.user) return;

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      
      if (filterCriteria.status_filter !== 'all') {
        params.append('status', filterCriteria.status_filter);
      }
      if (filterCriteria.date_range.start_date) {
        params.append('date_from', filterCriteria.date_range.start_date);
      }
      if (filterCriteria.date_range.end_date) {
        params.append('date_to', filterCriteria.date_range.end_date);
      }
      if (filterCriteria.search_query) {
        params.append('search', filterCriteria.search_query);
      }
      
      params.append('page', searchParams.get('page') || '1');
      params.append('limit', searchParams.get('limit') || '20');

      const response = await axios.get(`/api/v1/deliveries?${params.toString()}`);
      
      // Map response data correctly using actual API response structure
      const mappedDeliveries = await Promise.all(
        response.data.deliveries.map(async (delivery: any) => {
          // Get address details if needed
          let pickupAddress = 'Address not available';
          let deliveryAddress = 'Address not available';
          let courierName = 'Not assigned';
          
          try {
            // Note: In a real implementation, these should be joined in the backend query
            // For now, using fallback values to prevent crashes
            pickupAddress = delivery.pickup_address?.street_address || 'Pickup address';
            deliveryAddress = delivery.delivery_address?.street_address || 'Delivery address';
            courierName = delivery.courier_info ? 
              `${delivery.courier_info.first_name || ''} ${delivery.courier_info.last_name || ''}`.trim() :
              'Not assigned';
          } catch (err) {
            console.warn('Error mapping delivery addresses:', err);
          }

          return {
            uid: delivery.uid,
            delivery_number: delivery.delivery_number,
            status: delivery.status,
            pickup_address: pickupAddress,
            delivery_address: deliveryAddress,
            delivery_date: delivery.created_at,
            total_price: parseFloat(delivery.total_price?.toString() || '0'),
            courier_name: courierName,
            courier_rating: 4.5, // Default value since not in response
            package_count: delivery.packages?.length || 1,
            delivery_time_minutes: 120, // Default value
            thumbnail_url: `https://picsum.photos/200/150?random=${delivery.uid}`,
          };
        })
      );
      
      setDeliveryHistory({
        deliveries: mappedDeliveries,
        pagination: {
          current_page: response.data.pagination.current_page,
          total_pages: response.data.pagination.total_pages,
          total_count: response.data.pagination.total_count,
          per_page: response.data.pagination.per_page || 20,
          has_next: response.data.pagination.current_page < response.data.pagination.total_pages,
          has_previous: response.data.pagination.current_page > 1,
        },
      });

      // Load analytics from statistics if available
      if (response.data.statistics) {
        setHistoryAnalytics({
          total_deliveries: response.data.statistics.total_deliveries || 0,
          total_spent: response.data.statistics.total_amount || 0,
          average_delivery_time: 120, // Default value
          success_rate: 95, // Default value
          preferred_couriers: [],
          monthly_trends: [],
          cost_savings: 0,
        });
      }

      dispatch(update_last_activity());
    } catch (err: any) {
      console.error('Failed to load delivery history:', err);
      setError(err.response?.data?.message || 'Failed to load delivery history');
    } finally {
      setLoading(false);
    }
  }, [authState.user, filterCriteria, searchParams, dispatch]);

  // Apply filters
  const applyFilters = useCallback((newFilters: Partial<FilterCriteria>) => {
    const updatedFilters = { ...filterCriteria, ...newFilters };
    setFilterCriteria(updatedFilters);

    // Update URL parameters
    const newParams = new URLSearchParams(searchParams);
    
    if (updatedFilters.status_filter !== 'all') {
      newParams.set('status', updatedFilters.status_filter);
    } else {
      newParams.delete('status');
    }
    
    if (updatedFilters.search_query) {
      newParams.set('search', updatedFilters.search_query);
    } else {
      newParams.delete('search');
    }

    if (updatedFilters.date_range.start_date) {
      newParams.set('date_from', updatedFilters.date_range.start_date);
    } else {
      newParams.delete('date_from');
    }

    if (updatedFilters.date_range.end_date) {
      newParams.set('date_to', updatedFilters.date_range.end_date);
    } else {
      newParams.delete('date_to');
    }

    newParams.delete('page'); // Reset to first page when filtering
    setSearchParams(newParams);
  }, [filterCriteria, searchParams, setSearchParams]);

  // Reorder delivery
  const reorderDelivery = async (deliveryUid: string) => {
    try {
      const response = await axios.get(`/api/v1/deliveries/${deliveryUid}`);
      
      // Navigate to delivery request with pre-filled data
      navigate('/send', {
        state: {
          prefilled: {
            pickup: response.data.pickup_address,
            delivery: response.data.delivery_address,
            packages: response.data.packages,
          },
        },
      });
    } catch (err: any) {
      console.error('Failed to load delivery details:', err);
      setError(err.response?.data?.message || 'Failed to load delivery details');
    }
  };

  // Create delivery template - Mock implementation until backend endpoint exists
  const createDeliveryTemplate = async (deliveryUid: string, templateName: string) => {
    if (!authState.user) return;

    try {
      // Mock implementation since endpoint doesn't exist
      console.warn('Template creation not implemented - backend endpoint missing');
      
      // For now, just close the modal
      setShowTemplateModal(false);
      setTemplateName('');
      setSelectedTemplateDelivery(null);
      
      // Show success message or add to local state as mock
      alert('Template creation will be available when backend endpoint is implemented');
    } catch (err: any) {
      console.error('Failed to create delivery template:', err);
      setError('Template creation not available yet');
    }
  };

  // Load delivery templates - Mock implementation
  const loadDeliveryTemplates = useCallback(async () => {
    if (!authState.user) return;

    try {
      // Mock implementation since endpoint doesn't exist
      setDeliveryTemplates([]);
    } catch (err: any) {
      console.error('Failed to load delivery templates:', err);
    }
  }, [authState.user]);

  // Bulk export deliveries - Mock implementation until backend endpoint exists
  const bulkExportDeliveries = async (format: 'csv' | 'pdf') => {
    if (selectedDeliveries.length === 0) return;

    setExportStatus({
      is_exporting: true,
      export_progress: 0,
      export_format: format,
      download_url: null,
      error_message: null,
    });

    try {
      // Mock implementation since endpoint doesn't exist
      console.warn('Export functionality not implemented - backend endpoint missing');
      
      // Simulate progress
      const progressInterval = setInterval(() => {
        setExportStatus(prev => ({
          ...prev,
          export_progress: Math.min(prev.export_progress + 10, 90),
        }));
      }, 200);

      setTimeout(() => {
        clearInterval(progressInterval);
        setExportStatus({
          is_exporting: false,
          export_progress: 100,
          export_format: format,
          download_url: null, // No actual download since endpoint doesn't exist
          error_message: 'Export functionality will be available when backend endpoint is implemented',
        });
      }, 2000);

    } catch (err: any) {
      console.error('Export failed:', err);
      setExportStatus({
        is_exporting: false,
        export_progress: 0,
        export_format: null,
        download_url: null,
        error_message: 'Export functionality not available yet',
      });
    }
  };

  // Delete delivery
  const deleteDelivery = async (deliveryUid: string) => {
    try {
      await axios.delete(`/api/v1/deliveries/${deliveryUid}`);
      loadDeliveryHistory();
    } catch (err: any) {
      console.error('Failed to delete delivery:', err);
      setError(err.response?.data?.message || 'Failed to delete delivery');
    }
  };

  // Handle pagination
  const handlePageChange = (page: number) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set('page', page.toString());
    setSearchParams(newParams);
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: appSettings.currency || 'USD',
    }).format(amount);
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Get status color
  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      completed: 'text-green-600 bg-green-100',
      delivered: 'text-green-600 bg-green-100',
      active: 'text-blue-600 bg-blue-100',
      cancelled: 'text-red-600 bg-red-100',
      failed: 'text-red-600 bg-red-100',
      pending: 'text-yellow-600 bg-yellow-100',
    };
    return colors[status] || 'text-gray-600 bg-gray-100';
  };

  // Status options for filter
  const statusOptions = [
    { value: 'all', label: 'All Deliveries' },
    { value: 'completed', label: 'Completed' },
    { value: 'active', label: 'Active' },
    { value: 'cancelled', label: 'Cancelled' },
    { value: 'failed', label: 'Failed' },
  ];

  // Effects
  useEffect(() => {
    loadDeliveryHistory();
  }, [loadDeliveryHistory]);

  useEffect(() => {
    loadDeliveryTemplates();
  }, [loadDeliveryTemplates]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Delivery History</h1>
              <p className="text-sm text-gray-600 mt-1">
                Manage and track all your past deliveries
              </p>
            </div>
            
            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={() => setActiveTab('list')}
                className={`px-4 py-2 rounded-lg font-medium ${
                  activeTab === 'list'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Delivery List
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('analytics')}
                className={`px-4 py-2 rounded-lg font-medium ${
                  activeTab === 'analytics'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Analytics
              </button>
              
              <Link
                to="/send"
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                New Delivery
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'list' ? (
          <>
            {/* Filters and Search */}
            <div className="bg-white rounded-lg shadow-sm mb-6">
              <div className="p-4 border-b">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex-1 max-w-lg">
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Search by delivery number, recipient, or address..."
                        value={filterCriteria.search_query}
                        onChange={(e) => applyFilters({ search_query: e.target.value })}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <svg className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <select
                      value={filterCriteria.status_filter}
                      onChange={(e) => applyFilters({ status_filter: e.target.value })}
                      className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      {statusOptions.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    
                    <button
                      type="button"
                      onClick={() => setShowFilters(!showFilters)}
                      className="flex items-center space-x-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                      </svg>
                      <span>Filters</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Advanced Filters */}
              {showFilters && (
                <div className="p-4 bg-gray-50 border-t">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="date-from">Date From</label>
                      <input
                        id="date-from"
                        type="date"
                        value={filterCriteria.date_range.start_date || ''}
                        onChange={(e) => applyFilters({
                          date_range: { ...filterCriteria.date_range, start_date: e.target.value || null }
                        })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="date-to">Date To</label>
                      <input
                        id="date-to"
                        type="date"
                        value={filterCriteria.date_range.end_date || ''}
                        onChange={(e) => applyFilters({
                          date_range: { ...filterCriteria.date_range, end_date: e.target.value || null }
                        })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="sort-by">Sort By</label>
                      <select
                        id="sort-by"
                        value={filterCriteria.sort_by}
                        onChange={(e) => applyFilters({ sort_by: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="created_at">Date Created</option>
                        <option value="total_price">Price</option>
                        <option value="status">Status</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Bulk Actions */}
            {selectedDeliveries.length > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-blue-800">
                    {selectedDeliveries.length} delivery{selectedDeliveries.length !== 1 ? 's' : ''} selected
                  </span>
                  
                  <div className="flex items-center space-x-3">
                    <button
                      type="button"
                      onClick={() => bulkExportDeliveries('csv')}
                      disabled={exportStatus.is_exporting}
                      className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                    >
                      Export CSV
                    </button>
                    <button
                      type="button"
                      onClick={() => bulkExportDeliveries('pdf')}
                      disabled={exportStatus.is_exporting}
                      className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                    >
                      Export PDF
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedDeliveries([])}
                      className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50"
                    >
                      Clear Selection
                    </button>
                  </div>
                </div>
                
                {exportStatus.is_exporting && (
                  <div className="mt-3">
                    <div className="flex items-center space-x-2 text-sm text-blue-800">
                      <div className="w-full bg-blue-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${exportStatus.export_progress}%` }}
                        ></div>
                      </div>
                      <span>{exportStatus.export_progress}%</span>
                    </div>
                  </div>
                )}
                
                {exportStatus.error_message && (
                  <div className="mt-3">
                    <p className="text-sm text-red-600">{exportStatus.error_message}</p>
                  </div>
                )}
              </div>
            )}

            {/* Delivery List */}
            {loading ? (
              <div className="bg-white rounded-lg shadow-sm p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-4 text-gray-600">Loading delivery history...</p>
              </div>
            ) : error ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                <div className="flex">
                  <svg className="h-5 w-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">Error</h3>
                    <p className="text-sm text-red-700 mt-1">{error}</p>
                  </div>
                </div>
              </div>
            ) : deliveryHistory.deliveries.length > 0 ? (
              <div className="bg-white rounded-lg shadow-sm">
                <div className="divide-y divide-gray-200">
                  {deliveryHistory.deliveries.map((delivery) => (
                    <div key={delivery.uid} className="p-6 hover:bg-gray-50">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-4">
                          <input
                            type="checkbox"
                            checked={selectedDeliveries.includes(delivery.uid)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedDeliveries([...selectedDeliveries, delivery.uid]);
                              } else {
                                setSelectedDeliveries(selectedDeliveries.filter(id => id !== delivery.uid));
                              }
                            }}
                            className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          
                          <img
                            src={delivery.thumbnail_url}
                            alt="Delivery"
                            className="w-16 h-12 object-cover rounded-lg"
                          />
                          
                          <div className="flex-1">
                            <div className="flex items-center space-x-3">
                              <h3 className="text-lg font-semibold text-gray-900">
                                #{delivery.delivery_number}
                              </h3>
                              <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(delivery.status)}`}>
                                {delivery.status.charAt(0).toUpperCase() + delivery.status.slice(1)}
                              </span>
                            </div>
                            
                            <div className="mt-2 space-y-1 text-sm text-gray-600">
                              <div className="flex items-center space-x-2">
                                <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 00-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                <span>From: {delivery.pickup_address}</span>
                              </div>
                              <div className="flex items-center space-x-2">
                                <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 00-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                <span>To: {delivery.delivery_address}</span>
                              </div>
                              <div className="flex items-center space-x-4">
                                <span>{formatDate(delivery.delivery_date)}</span>
                                <span>Courier: {delivery.courier_name}</span>
                                <span>{delivery.package_count} package{delivery.package_count !== 1 ? 's' : ''}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-4">
                          <div className="text-right">
                            <div className="text-lg font-semibold text-gray-900">
                              {formatCurrency(delivery.total_price)}
                            </div>
                            {delivery.courier_rating > 0 && (
                              <div className="flex items-center justify-end space-x-1 mt-1">
                                {[...Array(5)].map((_, i) => (
                                  <svg
                                    key={i}
                                    className={`h-4 w-4 ${i < Math.floor(delivery.courier_rating) ? 'text-yellow-400' : 'text-gray-300'}`}
                                    fill="currentColor"
                                    viewBox="0 0 20 20"
                                  >
                                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                  </svg>
                                ))}
                                <span className="text-sm text-gray-600">({delivery.courier_rating.toFixed(1)})</span>
                              </div>
                            )}
                          </div>
                          
                          <div className="flex flex-col space-y-2">
                            <Link
                              to={`/track/${delivery.uid}`}
                              className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 text-center"
                            >
                              View Details
                            </Link>
                            
                            {['completed', 'delivered'].includes(delivery.status) && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => reorderDelivery(delivery.uid)}
                                  className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50"
                                >
                                  Reorder
                                </button>
                                
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedTemplateDelivery(delivery.uid);
                                    setShowTemplateModal(true);
                                  }}
                                  className="px-3 py-1 text-sm text-blue-600 hover:text-blue-800"
                                >
                                  Save as Template
                                </button>
                              </>
                            )}
                            
                            {['cancelled', 'failed'].includes(delivery.status) && (
                              <button
                                type="button"
                                onClick={() => {
                                  if (window.confirm('Are you sure you want to delete this delivery?')) {
                                    deleteDelivery(delivery.uid);
                                  }
                                }}
                                className="px-3 py-1 text-sm text-red-600 hover:text-red-800"
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* Pagination */}
                {deliveryHistory.pagination.total_pages > 1 && (
                  <div className="px-6 py-4 border-t bg-gray-50 flex items-center justify-between">
                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                      <span>
                        Showing {((deliveryHistory.pagination.current_page - 1) * deliveryHistory.pagination.per_page) + 1} to{' '}
                        {Math.min(deliveryHistory.pagination.current_page * deliveryHistory.pagination.per_page, deliveryHistory.pagination.total_count)} of{' '}
                        {deliveryHistory.pagination.total_count} deliveries
                      </span>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={() => handlePageChange(deliveryHistory.pagination.current_page - 1)}
                        disabled={!deliveryHistory.pagination.has_previous}
                        className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Previous
                      </button>
                      
                      <div className="flex space-x-1">
                        {[...Array(Math.min(deliveryHistory.pagination.total_pages, 5))].map((_, i) => {
                          const pageNum = deliveryHistory.pagination.current_page - 2 + i;
                          if (pageNum < 1 || pageNum > deliveryHistory.pagination.total_pages) return null;
                          
                          return (
                            <button
                              key={pageNum}
                              type="button"
                              onClick={() => handlePageChange(pageNum)}
                              className={`px-3 py-1 text-sm border rounded ${
                                pageNum === deliveryHistory.pagination.current_page
                                  ? 'bg-blue-600 text-white border-blue-600'
                                  : 'border-gray-300 hover:bg-gray-50'
                              }`}
                            >
                              {pageNum}
                            </button>
                          );
                        })}
                      </div>
                      
                      <button
                        type="button"
                        onClick={() => handlePageChange(deliveryHistory.pagination.current_page + 1)}
                        disabled={!deliveryHistory.pagination.has_next}
                        className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-sm p-12 text-center">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-4.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 009.586 13H7" />
                </svg>
                <h3 className="mt-2 text-lg font-medium text-gray-900">No deliveries found</h3>
                <p className="mt-1 text-gray-500">
                  {filterCriteria.search_query || filterCriteria.status_filter !== 'all'
                    ? 'Try adjusting your search or filters.'
                    : "You haven't created any deliveries yet."}
                </p>
                <div className="mt-6">
                  <Link
                    to="/send"
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Create Your First Delivery
                  </Link>
                </div>
              </div>
            )}
          </>
        ) : (
          /* Analytics Tab */
          <div className="space-y-6">
            {/* Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-4.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 009.586 13H7" />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">Total Deliveries</p>
                    <p className="text-2xl font-bold text-gray-900">{historyAnalytics.total_deliveries}</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">Total Spent</p>
                    <p className="text-2xl font-bold text-gray-900">{formatCurrency(historyAnalytics.total_spent)}</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-yellow-100 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">Avg. Delivery Time</p>
                    <p className="text-2xl font-bold text-gray-900">{historyAnalytics.average_delivery_time} min</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">Success Rate</p>
                    <p className="text-2xl font-bold text-gray-900">{historyAnalytics.success_rate}%</p>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Charts and Additional Analytics */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Monthly Trends</h3>
                <div className="h-64 flex items-center justify-center text-gray-500">
                  Chart visualization would be implemented here
                </div>
              </div>
              
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Preferred Couriers</h3>
                <div className="space-y-3">
                  {historyAnalytics.preferred_couriers.length > 0 ? (
                    historyAnalytics.preferred_couriers.map((courier, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900">{courier.courier_name}</p>
                          <p className="text-sm text-gray-600">{courier.delivery_count} deliveries</p>
                        </div>
                        <div className="flex items-center space-x-1">
                          <svg className="h-4 w-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                          <span className="text-sm text-gray-600">{courier.average_rating.toFixed(1)}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-500 text-center py-8">No courier data available yet</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Template Creation Modal */}
      {showTemplateModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Create Delivery Template</h3>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2" htmlFor="template-name">
                Template Name
              </label>
              <input
                id="template-name"
                type="text"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="e.g., Office to Home"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            
            <div className="flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={() => {
                  setShowTemplateModal(false);
                  setTemplateName('');
                  setSelectedTemplateDelivery(null);
                }}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (selectedTemplateDelivery && templateName.trim()) {
                    createDeliveryTemplate(selectedTemplateDelivery, templateName.trim());
                  }
                }}
                disabled={!templateName.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Create Template
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UV_DeliveryHistory;