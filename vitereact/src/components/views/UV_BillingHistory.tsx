import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '@/store/main';
import axios, { AxiosResponse } from 'axios';

interface Transaction {
  uid: string;
  delivery_uid: string | null;
  amount: number;
  currency: string;
  status: string;
  payment_method_uid: string | null;
  transaction_type: string;
  fee_amount: number;
  tax_amount: number;
  description: string | null;
  processed_at: string | null;
  created_at: string;
  delivery_info?: {
    delivery_number: string;
    pickup_address: string;
    delivery_address: string;
  };
}

interface BillingSummary {
  total_spent: number;
  monthly_average: number;
  yearly_total: number;
  tax_total: number;
  refund_total: number;
  pending_charges: number;
  currency: string;
  period_comparison: {
    delivery_change: number;
    cost_change: number;
    efficiency_change: number;
  };
}

interface FilterCriteria {
  date_from: string | null;
  date_to: string | null;
  status_filter: string[];
  amount_range: {
    min: number | null;
    max: number | null;
  };
  payment_method_filter: string[];
  delivery_type_filter: string[];
  search_query: string;
}

interface TransactionHistoryState {
  transactions: Transaction[];
  pagination: {
    current_page: number;
    total_pages: number;
    total_count: number;
    per_page: number;
  };
  last_updated: string | null;
}

interface ExportConfiguration {
  export_format: string;
  include_fields: string[];
  date_range: Record<string, unknown>;
  is_generating: boolean;
  download_url: string | null;
  generation_progress: number;
}

interface PaymentDispute {
  dispute_uid: string;
  transaction_uid: string;
  dispute_reason: string;
  status: string;
  amount: number;
  created_at: string;
  resolution_deadline: string;
  evidence_required: string[];
}

const UV_BillingHistory: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { user, session } = useSelector((state: RootState) => state.auth);
  const { currency, timezone } = useSelector((state: RootState) => state.app_settings);
  const { is_online } = useSelector((state: RootState) => state.error.network_status);
  const [searchParams, setSearchParams] = useSearchParams();

  // State variables based on architecture
  const [transactionHistory, setTransactionHistory] = useState<TransactionHistoryState>({
    transactions: [],
    pagination: {
      current_page: 1,
      total_pages: 0,
      total_count: 0,
      per_page: 20,
    },
    last_updated: null,
  });

  const [billingSummary, setBillingSummary] = useState<BillingSummary>({
    total_spent: 0,
    monthly_average: 0,
    yearly_total: 0,
    tax_total: 0,
    refund_total: 0,
    pending_charges: 0,
    currency: currency || 'USD',
    period_comparison: {
      delivery_change: 0,
      cost_change: 0,
      efficiency_change: 0,
    },
  });

  const [filterCriteria, setFilterCriteria] = useState<FilterCriteria>({
    date_from: null,
    date_to: null,
    status_filter: [],
    amount_range: { min: null, max: null },
    payment_method_filter: [],
    delivery_type_filter: [],
    search_query: '',
  });

  const [exportConfiguration, setExportConfiguration] = useState<ExportConfiguration>({
    export_format: 'PDF',
    include_fields: [],
    date_range: {},
    is_generating: false,
    download_url: null,
    generation_progress: 0,
  });

  const [paymentDisputes, setPaymentDisputes] = useState<PaymentDispute[]>([]);
  const [analyticsData, setAnalyticsData] = useState({
    spending_trends: [],
    delivery_patterns: {},
    cost_breakdown: {},
    seasonal_analysis: [],
    optimization_suggestions: [],
  });

  const [invoiceManagement, setInvoiceManagement] = useState({
    monthly_invoices: [],
    invoice_templates: [],
    auto_generation_enabled: false,
    invoice_recipients: [],
    tax_settings: {},
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchDebounceTimer = useRef<NodeJS.Timeout | null>(null);

  // Configure axios with auth headers
  const getAuthHeaders = useCallback(() => {
    if (!session?.access_token) return {};
    return {
      Authorization: `Bearer ${session.access_token}`,
    };
  }, [session?.access_token]);

  // Load transaction history
  const loadTransactionHistory = useCallback(async (page: number = 1, filters?: Partial<FilterCriteria>) => {
    if (!session?.access_token) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('limit', transactionHistory.pagination.per_page.toString());
      
      const currentFilters = filters || filterCriteria;
      
      if (currentFilters.date_from) params.append('date_from', currentFilters.date_from);
      if (currentFilters.date_to) params.append('date_to', currentFilters.date_to);
      if (currentFilters.status_filter.length > 0) {
        currentFilters.status_filter.forEach(status => params.append('status', status));
      }
      if (currentFilters.search_query) params.append('search', currentFilters.search_query);

      const response: AxiosResponse = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/v1/transactions?${params.toString()}`,
        { headers: getAuthHeaders() }
      );
      
      if (response.data) {
        setTransactionHistory({
          transactions: response.data.transactions || [],
          pagination: response.data.pagination || {
            current_page: page,
            total_pages: 0,
            total_count: 0,
            per_page: 20,
          },
          last_updated: new Date().toISOString(),
        });

        // Calculate billing summary from transactions
        const transactions = response.data.transactions || [];
        const totalSpent = transactions.reduce((sum: number, t: Transaction) => sum + t.amount, 0);
        const taxTotal = transactions.reduce((sum: number, t: Transaction) => sum + (t.tax_amount || 0), 0);
        const refundTotal = transactions.filter((t: Transaction) => t.status === 'refunded').reduce((sum: number, t: Transaction) => sum + t.amount, 0);
        const pendingCharges = transactions.filter((t: Transaction) => t.status === 'pending').reduce((sum: number, t: Transaction) => sum + t.amount, 0);

        setBillingSummary(prev => ({
          ...prev,
          total_spent: totalSpent,
          tax_total: taxTotal,
          refund_total: refundTotal,
          pending_charges: pendingCharges,
          monthly_average: totalSpent / 12, // Simplified calculation
          yearly_total: totalSpent,
        }));
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 'Failed to load transaction history';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [session?.access_token, getAuthHeaders]);

  // Apply advanced filters
  const applyAdvancedFilters = useCallback((newFilters: Partial<FilterCriteria>) => {
    const updatedFilters = { ...filterCriteria, ...newFilters };
    setFilterCriteria(updatedFilters);
    
    // Update URL params
    const newSearchParams = new URLSearchParams(searchParams);
    Object.entries(updatedFilters).forEach(([key, value]) => {
      if (value !== null && value !== '' && (!Array.isArray(value) || value.length > 0)) {
        if (Array.isArray(value)) {
          newSearchParams.delete(key);
          value.forEach(v => newSearchParams.append(key, v));
        } else if (typeof value === 'object' && value !== null) {
          // Handle nested objects like amount_range
          Object.entries(value).forEach(([subKey, subValue]) => {
            if (subValue !== null && subValue !== '') {
              newSearchParams.set(`${key}_${subKey}`, String(subValue));
            }
          });
        } else {
          newSearchParams.set(key, String(value));
        }
      } else {
        newSearchParams.delete(key);
      }
    });
    setSearchParams(newSearchParams);
    
    // Debounced search for text queries
    if (searchDebounceTimer.current) {
      clearTimeout(searchDebounceTimer.current);
    }
    
    const delay = newFilters.search_query !== undefined ? 500 : 0;
    searchDebounceTimer.current = setTimeout(() => {
      loadTransactionHistory(1, updatedFilters);
    }, delay);
  }, [filterCriteria, searchParams, setSearchParams, loadTransactionHistory]);

  // Export billing data
  const exportBillingData = async (format: string = 'PDF') => {
    if (!session?.access_token) return;
    
    setExportConfiguration(prev => ({
      ...prev,
      is_generating: true,
      export_format: format,
      generation_progress: 0,
    }));

    try {
      // Simulate export progress
      const progressInterval = setInterval(() => {
        setExportConfiguration(prev => ({
          ...prev,
          generation_progress: Math.min(prev.generation_progress + 10, 90),
        }));
      }, 200);

      const params = new URLSearchParams();
      params.append('format', format);
      if (filterCriteria.date_from) params.append('date_from', filterCriteria.date_from);
      if (filterCriteria.date_to) params.append('date_to', filterCriteria.date_to);

      // Mock export - in real implementation, this would generate actual files
      setTimeout(() => {
        clearInterval(progressInterval);
        setExportConfiguration(prev => ({
          ...prev,
          is_generating: false,
          generation_progress: 100,
          download_url: `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/v1/transactions/export/${Date.now()}.${format.toLowerCase()}`,
        }));
      }, 2000);
      
    } catch (err: any) {
      setError('Failed to generate export');
      setExportConfiguration(prev => ({
        ...prev,
        is_generating: false,
        generation_progress: 0,
      }));
    }
  };

  // Download individual receipt - using transaction details endpoint since receipt endpoint doesn't exist
  const downloadIndividualReceipt = async (transactionUid: string) => {
    if (!session?.access_token) return;
    
    try {
      const response = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/v1/transactions/${transactionUid}`,
        { headers: getAuthHeaders() }
      );
      
      // Generate receipt from transaction data
      const transaction = response.data;
      const receiptData = {
        transaction_uid: transaction.uid,
        amount: transaction.amount,
        currency: transaction.currency,
        status: transaction.status,
        date: transaction.created_at,
        description: transaction.description,
      };
      
      // Create downloadable receipt (mock implementation)
      const blob = new Blob([JSON.stringify(receiptData, null, 2)], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `receipt_${transactionUid}.txt`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      setError('Failed to download receipt');
    }
  };

  // Initiate payment dispute
  const initiatePaymentDispute = async (transactionUid: string, reason: string) => {
    if (!session?.access_token || !user?.uid) return;
    
    try {
      // Create dispute record
      const disputeData = {
        transaction_uid: transactionUid,
        dispute_reason: reason,
        user_uid: user.uid,
        created_at: new Date().toISOString(),
      };

      // Mock API call - in real implementation would call actual dispute endpoint
      const newDispute: PaymentDispute = {
        dispute_uid: `dispute_${Date.now()}`,
        transaction_uid: transactionUid,
        dispute_reason: reason,
        status: 'pending',
        amount: transactionHistory.transactions.find(t => t.uid === transactionUid)?.amount || 0,
        created_at: new Date().toISOString(),
        resolution_deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        evidence_required: ['transaction_details', 'delivery_proof'],
      };

      setPaymentDisputes(prev => [...prev, newDispute]);
    } catch (err: any) {
      setError('Failed to initiate dispute');
    }
  };

  // Format currency
  const formatCurrency = (amount: number, currencyCode: string = currency || 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode,
    }).format(amount);
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: timezone || 'UTC',
    }).format(new Date(dateString));
  };

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-100';
      case 'pending': return 'text-yellow-600 bg-yellow-100';
      case 'failed': return 'text-red-600 bg-red-100';
      case 'refunded': return 'text-blue-600 bg-blue-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  // Load data on mount and URL param changes
  useEffect(() => {
    const period = searchParams.get('period');
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const dateRange = searchParams.get('date_range');
    
    // Apply URL parameters to filters
    const urlFilters: Partial<FilterCriteria> = {};
    if (status) urlFilters.status_filter = [status];
    if (dateRange) {
      const [start, end] = dateRange.split(',');
      if (start) urlFilters.date_from = start;
      if (end) urlFilters.date_to = end;
    }
    if (period) {
      const now = new Date();
      switch (period) {
        case 'monthly':
          urlFilters.date_from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
          urlFilters.date_to = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
          break;
        case 'yearly':
          urlFilters.date_from = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
          urlFilters.date_to = new Date(now.getFullYear(), 11, 31).toISOString().split('T')[0];
          break;
      }
    }
    
    if (Object.keys(urlFilters).length > 0) {
      setFilterCriteria(prev => ({ ...prev, ...urlFilters }));
    }
    
    loadTransactionHistory(page, urlFilters);
  }, [searchParams.toString()]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (searchDebounceTimer.current) {
        clearTimeout(searchDebounceTimer.current);
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Billing History</h1>
              <p className="mt-2 text-gray-600">Manage your transactions, invoices, and billing information</p>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => exportBillingData('PDF')}
                disabled={exportConfiguration.is_generating || !is_online}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>{exportConfiguration.is_generating ? `Exporting... ${exportConfiguration.generation_progress}%` : 'Export'}</span>
              </button>
              <Link
                to="/payment-methods"
                className="text-blue-600 hover:text-blue-800 flex items-center space-x-1"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
                <span>Payment Methods</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Billing Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                  </svg>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Total Spent</dt>
                  <dd className="text-lg font-medium text-gray-900">{formatCurrency(billingSummary.total_spent)}</dd>
                </dl>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Monthly Average</dt>
                  <dd className="text-lg font-medium text-gray-900">{formatCurrency(billingSummary.monthly_average)}</dd>
                </dl>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Pending Charges</dt>
                  <dd className="text-lg font-medium text-gray-900">{formatCurrency(billingSummary.pending_charges)}</dd>
                </dl>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2zM10 8.5a.5.5 0 11-1 0 .5.5 0 011 0zm5 5a.5.5 0 11-1 0 .5.5 0 011 0z" />
                  </svg>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Tax Total</dt>
                  <dd className="text-lg font-medium text-gray-900">{formatCurrency(billingSummary.tax_total)}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Filter Transactions</h3>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {/* Search Query */}
              <div className="lg:col-span-2">
                <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-1">
                  Search
                </label>
                <input
                  type="text"
                  id="search"
                  value={filterCriteria.search_query}
                  onChange={(e) => applyAdvancedFilters({ search_query: e.target.value })}
                  placeholder="Search transactions..."
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Date From */}
              <div>
                <label htmlFor="date-from" className="block text-sm font-medium text-gray-700 mb-1">
                  Date From
                </label>
                <input
                  type="date"
                  id="date-from"
                  value={filterCriteria.date_from || ''}
                  onChange={(e) => applyAdvancedFilters({ date_from: e.target.value || null })}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Date To */}
              <div>
                <label htmlFor="date-to" className="block text-sm font-medium text-gray-700 mb-1">
                  Date To
                </label>
                <input
                  type="date"
                  id="date-to"
                  value={filterCriteria.date_to || ''}
                  onChange={(e) => applyAdvancedFilters({ date_to: e.target.value || null })}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Status Filter */}
              <div>
                <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  id="status"
                  value={filterCriteria.status_filter[0] || ''}
                  onChange={(e) => applyAdvancedFilters({ status_filter: e.target.value ? [e.target.value] : [] })}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All Statuses</option>
                  <option value="completed">Completed</option>
                  <option value="pending">Pending</option>
                  <option value="failed">Failed</option>
                  <option value="refunded">Refunded</option>
                </select>
              </div>
            </div>

            {/* Clear Filters */}
            {(filterCriteria.search_query || filterCriteria.date_from || filterCriteria.date_to || filterCriteria.status_filter.length > 0) && (
              <div className="mt-4">
                <button
                  onClick={() => {
                    setFilterCriteria({
                      date_from: null,
                      date_to: null,
                      status_filter: [],
                      amount_range: { min: null, max: null },
                      payment_method_filter: [],
                      delivery_type_filter: [],
                      search_query: '',
                    });
                    loadTransactionHistory(1);
                  }}
                  className="text-blue-600 hover:text-blue-800 text-sm flex items-center space-x-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <span>Clear All Filters</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 19.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error</h3>
                <div className="mt-2 text-sm text-red-700">
                  <p>{error}</p>
                </div>
              </div>
              <div className="ml-auto pl-3">
                <div className="-mx-1.5 -my-1.5">
                  <button
                    onClick={() => setError(null)}
                    className="inline-flex bg-red-50 rounded-md p-1.5 text-red-500 hover:bg-red-100"
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Transaction List */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">Transactions</h3>
              <div className="text-sm text-gray-500">
                {transactionHistory.pagination.total_count} total transactions
              </div>
            </div>
          </div>

          {loading ? (
            <div className="px-6 py-12 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-500">Loading transactions...</p>
            </div>
          ) : transactionHistory.transactions.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No transactions found</h3>
              <p className="mt-1 text-sm text-gray-500">Try adjusting your search criteria or date range.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Transaction</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {transactionHistory.transactions.map((transaction) => (
                    <tr key={transaction.uid} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10">
                            <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                              <svg className="h-6 w-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                              </svg>
                            </div>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {transaction.description || `Transaction ${transaction.uid.slice(-8)}`}
                            </div>
                            <div className="text-sm text-gray-500">
                              {transaction.delivery_info?.delivery_number && (
                                <Link
                                  to={`/track/${transaction.delivery_uid}`}
                                  className="text-blue-600 hover:text-blue-800"
                                >
                                  {transaction.delivery_info.delivery_number}
                                </Link>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {formatCurrency(transaction.amount)}
                        </div>
                        {transaction.tax_amount > 0 && (
                          <div className="text-sm text-gray-500">
                            Tax: {formatCurrency(transaction.tax_amount)}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(transaction.status)}`}>
                          {transaction.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(transaction.created_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => downloadIndividualReceipt(transaction.uid)}
                            className="text-blue-600 hover:text-blue-900 p-1"
                            title="Download Receipt"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </button>
                          {transaction.status === 'completed' && (
                            <button
                              onClick={() => initiatePaymentDispute(transaction.uid, 'unauthorized_charge')}
                              className="text-red-600 hover:text-red-900 p-1"
                              title="Dispute Transaction"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 19.5c-.77.833.192 2.5 1.732 2.5z" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {transactionHistory.pagination.total_pages > 1 && (
            <div className="px-6 py-4 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-700">
                    Showing page {transactionHistory.pagination.current_page} of {transactionHistory.pagination.total_pages}
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => loadTransactionHistory(transactionHistory.pagination.current_page - 1)}
                    disabled={transactionHistory.pagination.current_page <= 1}
                    className="bg-white text-gray-500 border border-gray-300 hover:bg-gray-50 px-3 py-2 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-gray-700">
                    Page {transactionHistory.pagination.current_page}
                  </span>
                  <button
                    onClick={() => loadTransactionHistory(transactionHistory.pagination.current_page + 1)}
                    disabled={transactionHistory.pagination.current_page >= transactionHistory.pagination.total_pages}
                    className="bg-white text-gray-500 border border-gray-300 hover:bg-gray-50 px-3 py-2 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Payment Disputes Section */}
        {paymentDisputes.length > 0 && (
          <div className="bg-white rounded-lg shadow mt-8">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Payment Disputes</h3>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                {paymentDisputes.map((dispute) => (
                  <div key={dispute.dispute_uid} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-medium text-gray-900">
                          Dispute {dispute.dispute_uid.slice(-8)}
                        </h4>
                        <p className="text-sm text-gray-500 mt-1">
                          Amount in dispute: {formatCurrency(dispute.amount)}
                        </p>
                        <p className="text-sm text-gray-500">
                          Reason: {dispute.dispute_reason}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(dispute.status)}`}>
                          {dispute.status}
                        </span>
                        <p className="text-sm text-gray-500 mt-1">
                          Due: {formatDate(dispute.resolution_deadline)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Export Download */}
        {exportConfiguration.download_url && (
          <div className="bg-green-50 border border-green-200 rounded-md p-4 mt-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-green-800">Export Ready</h3>
                <div className="mt-2">
                  <a
                    href={exportConfiguration.download_url}
                    download
                    className="text-sm text-green-700 underline hover:text-green-900"
                  >
                    Download your billing export ({exportConfiguration.export_format})
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UV_BillingHistory;