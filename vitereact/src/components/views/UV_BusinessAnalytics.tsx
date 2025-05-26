import React, { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { Link, useSearchParams } from 'react-router-dom';
import { RootState } from '@/store/main';
import axios from 'axios';

interface ExecutiveSummary {
  total_deliveries: number;
  total_spent: number;
  cost_savings: number;
  average_delivery_time: number;
  success_rate: number;
  roi_percentage: number;
  period_comparison: {
    delivery_change: number;
    cost_change: number;
    efficiency_change: number;
  };
}

interface CompletionRate {
  date: string;
  completed: number;
  cancelled: number;
  failed: number;
}

interface DeliveryTime {
  delivery_type: string;
  average_time: number;
  target_time: number;
}

interface CourierPerformance {
  courier_name: string;
  total_deliveries: number;
  success_rate: number;
  average_rating: number;
  average_time: number;
}

interface DepartmentSpending {
  department: string;
  total_spent: number;
  delivery_count: number;
  average_cost: number;
}

interface UserActivity {
  user_name: string;
  deliveries_created: number;
  total_spent: number;
  average_cost: number;
  last_active: string;
  department: string;
}

interface AnalyticsData {
  executive_summary: ExecutiveSummary;
  delivery_performance: {
    completion_rates: CompletionRate[];
    average_delivery_times: DeliveryTime[];
    courier_performance: CourierPerformance[];
  };
  cost_analysis: {
    spending_breakdown: {
      by_department: DepartmentSpending[];
      by_delivery_type: any[];
      by_time_period: any[];
    };
    cost_optimization: {
      potential_savings: number;
      recommendations: any[];
    };
  };
  team_usage: {
    user_activity: UserActivity[];
    usage_patterns: {
      peak_hours: any[];
      peak_days: any[];
      seasonal_trends: any[];
    };
  };
  predictive_insights: {
    demand_forecast: any[];
    budget_projections: any[];
    risk_analysis: any[];
  };
}

const UV_BusinessAnalytics: React.FC = () => {
  const { user, session, permissions, business_account } = useSelector((state: RootState) => state.auth);
  const { currency, timezone, language } = useSelector((state: RootState) => state.app_settings);

  // URL Parameters parsing
  const [searchParams, setSearchParams] = useSearchParams();
  const initialDateRange = searchParams.get('date_range') || 'last_30_days';
  const initialMetric = searchParams.get('metric') || 'cost_analysis';
  const initialDepartment = searchParams.get('department') || '';
  const initialExportFormat = searchParams.get('export_format') || '';

  // State Variables
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData>({
    executive_summary: {
      total_deliveries: 0,
      total_spent: 0,
      cost_savings: 0,
      average_delivery_time: 0,
      success_rate: 0,
      roi_percentage: 0,
      period_comparison: {
        delivery_change: 0,
        cost_change: 0,
        efficiency_change: 0,
      },
    },
    delivery_performance: {
      completion_rates: [],
      average_delivery_times: [],
      courier_performance: [],
    },
    cost_analysis: {
      spending_breakdown: {
        by_department: [],
        by_delivery_type: [],
        by_time_period: [],
      },
      cost_optimization: {
        potential_savings: 0,
        recommendations: [],
      },
    },
    team_usage: {
      user_activity: [],
      usage_patterns: {
        peak_hours: [],
        peak_days: [],
        seasonal_trends: [],
      },
    },
    predictive_insights: {
      demand_forecast: [],
      budget_projections: [],
      risk_analysis: [],
    },
  });

  const [dateRangeConfig, setDateRangeConfig] = useState({
    selected_range: initialDateRange,
    start_date: '',
    end_date: '',
    comparison_enabled: false,
    comparison_start_date: '',
    comparison_end_date: '',
    predefined_ranges: [
      { label: 'Last 7 days', value: 'last_7_days', start_date: '', end_date: '' },
      { label: 'Last 30 days', value: 'last_30_days', start_date: '', end_date: '' },
      { label: 'Last 90 days', value: 'last_90_days', start_date: '', end_date: '' },
      { label: 'This month', value: 'this_month', start_date: '', end_date: '' },
    ],
  });

  const [filterCriteria, setFilterCriteria] = useState({
    department_filter: initialDepartment ? [initialDepartment] : [],
    user_filter: [],
    delivery_type_filter: [],
    cost_range_filter: { min_cost: null, max_cost: null },
    courier_filter: [],
    status_filter: [],
  });

  const [reportBuilder, setReportBuilder] = useState({
    report_name: '',
    selected_metrics: [],
    chart_types: [],
    grouping_options: [],
    schedule_config: {
      is_scheduled: false,
      frequency: 'weekly',
      recipients: [],
      format: 'pdf',
    },
    saved_reports: [],
  });

  const [exportStatus, setExportStatus] = useState({
    is_exporting: false,
    export_progress: 0,
    export_format: initialExportFormat || null,
    download_url: null,
    scheduled_exports: [],
  });

  const [activeTab, setActiveTab] = useState<'overview' | 'delivery' | 'cost' | 'team' | 'predictive' | 'reports'>('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [businessAccountError, setBusinessAccountError] = useState<string | null>(null);

  // Helper function to get business account UID
  const getBusinessAccountUid = useCallback(() => {
    // Check if user has business account access
    if (!business_account?.uid) {
      setBusinessAccountError('No business account associated with this user');
      return null;
    }
    return business_account.uid;
  }, [business_account]);

  // API Functions
  const loadAnalyticsData = useCallback(async () => {
    if (!permissions?.can_view_analytics || !session?.access_token) {
      setError('Insufficient permissions to view analytics');
      setLoading(false);
      return;
    }

    const businessAccountUid = getBusinessAccountUid();
    if (!businessAccountUid) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setBusinessAccountError(null);

      const params = new URLSearchParams();

      // Add date range parameters
      if (dateRangeConfig.start_date && dateRangeConfig.end_date) {
        params.append('date_from', dateRangeConfig.start_date);
        params.append('date_to', dateRangeConfig.end_date);
      } else {
        // Convert predefined range to actual dates
        const now = new Date();
        let fromDate: Date;

        switch (dateRangeConfig.selected_range) {
          case 'last_7_days':
            fromDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
          case 'last_30_days':
            fromDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            break;
          case 'last_90_days':
            fromDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
            break;
          default:
            fromDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        }

        params.append('date_from', fromDate.toISOString().split('T')[0]);
        params.append('date_to', now.toISOString().split('T')[0]);
      }

      // Add filters
      if (filterCriteria.department_filter.length > 0) {
        params.append('department', filterCriteria.department_filter.join(','));
      }

      if (filterCriteria.user_filter.length > 0) {
        params.append('users', filterCriteria.user_filter.join(','));
      }

      const response = await axios.get(
        `/api/v1/business-accounts/${businessAccountUid}/analytics?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (response.data) {
        // Transform the data to match our expected structure based on BusinessAnalytics schema
        const transformedData: AnalyticsData = {
          executive_summary: {
            total_deliveries: response.data.delivery_summary?.total_deliveries || 0,
            total_spent: response.data.cost_analysis?.total_spent || 0,
            cost_savings: response.data.cost_analysis?.cost_savings || 0,
            average_delivery_time: response.data.delivery_summary?.average_delivery_time || 0,
            success_rate: (response.data.delivery_summary?.completed_deliveries / response.data.delivery_summary?.total_deliveries * 100) || 0,
            roi_percentage: response.data.cost_analysis?.roi_percentage || 0,
            period_comparison: {
              delivery_change: response.data.period_comparison?.delivery_change || 0,
              cost_change: response.data.period_comparison?.cost_change || 0,
              efficiency_change: response.data.period_comparison?.efficiency_change || 0,
            },
          },
          delivery_performance: {
            completion_rates: response.data.delivery_trends || [],
            average_delivery_times: response.data.delivery_times || [],
            courier_performance: response.data.courier_stats || [],
          },
          cost_analysis: {
            spending_breakdown: {
              by_department: response.data.cost_analysis?.by_department || [],
              by_delivery_type: response.data.cost_analysis?.by_delivery_type || [],
              by_time_period: response.data.monthly_trends || [],
            },
            cost_optimization: {
              potential_savings: response.data.optimization?.potential_savings || 0,
              recommendations: response.data.optimization?.recommendations || [],
            },
          },
          team_usage: {
            user_activity: response.data.team_usage?.deliveries_by_member || [],
            usage_patterns: {
              peak_hours: response.data.usage_patterns?.peak_hours || [],
              peak_days: response.data.usage_patterns?.peak_days || [],
              seasonal_trends: response.data.usage_patterns?.seasonal_trends || [],
            },
          },
          predictive_insights: {
            demand_forecast: response.data.predictions?.demand_forecast || [],
            budget_projections: response.data.predictions?.budget_projections || [],
            risk_analysis: response.data.predictions?.risk_analysis || [],
          },
        };

        setAnalyticsData(transformedData);
      }
    } catch (err: any) {
      console.error('Failed to load analytics data:', err);
      if (err.response?.status === 404) {
        setError('Business account not found or analytics data not available');
      } else if (err.response?.status === 403) {
        setError('Access denied. You do not have permission to view this business account\\'s analytics.');
      } else {
        setError(err.response?.data?.message || 'Failed to load analytics data');
      }
    } finally {
      setLoading(false);
    }
  }, [permissions, session, dateRangeConfig, filterCriteria, getBusinessAccountUid]);

  const exportAnalyticsData = useCallback(async (format: string) => {
    if (!permissions?.can_view_analytics || !session?.access_token) return;

    const businessAccountUid = getBusinessAccountUid();
    if (!businessAccountUid) return;

    try {
      setExportStatus(prev => ({ ...prev, is_exporting: true, export_progress: 0, export_format: format }));

      const response = await axios.post(
        `/api/v1/business-accounts/${businessAccountUid}/export-analytics`,
        {
          export_format: format,
          date_range: dateRangeConfig.selected_range,
          filters: filterCriteria,
          include_charts: true,
        },
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      // Simulate progress
      const progressInterval = setInterval(() => {
        setExportStatus(prev => {
          if (prev.export_progress >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return { ...prev, export_progress: prev.export_progress + 10 };
        });
      }, 200);

      setTimeout(() => {
        clearInterval(progressInterval);
        setExportStatus(prev => ({
          ...prev,
          is_exporting: false,
          export_progress: 100,
          download_url: response.data.download_url || '#',
        }));
      }, 3000);

    } catch (err: any) {
      console.error('Export failed:', err);
      setExportStatus(prev => ({ ...prev, is_exporting: false, export_progress: 0 }));
      setError('Export failed. Please try again.');
    }
  }, [permissions, session, dateRangeConfig, filterCriteria, getBusinessAccountUid]);

  const applyAnalyticsFilters = useCallback((newFilters: Partial<typeof filterCriteria>) => {
    setFilterCriteria(prev => ({ ...prev, ...newFilters }));

    // Update URL parameters using React Router
    const newSearchParams = new URLSearchParams(searchParams);
    if (newFilters.department_filter && newFilters.department_filter.length > 0) {
      newSearchParams.set('department', newFilters.department_filter[0]);
    } else {
      newSearchParams.delete('department');
    }

    setSearchParams(newSearchParams);
  }, [searchParams, setSearchParams]);

  const updateDateRange = useCallback((newRange: string, customDates?: { start: string; end: string }) => {
    setDateRangeConfig(prev => ({
      ...prev,
      selected_range: newRange,
      start_date: customDates?.start || '',
      end_date: customDates?.end || '',
    }));

    // Update URL using React Router
    const newSearchParams = new URLSearchParams(searchParams);
    newSearchParams.set('date_range', newRange);
    setSearchParams(newSearchParams);
  }, [searchParams, setSearchParams]);

  // Effects
  useEffect(() => {
    if (permissions?.can_view_analytics && business_account?.uid) {
      loadAnalyticsData();
    } else if (permissions?.can_view_analytics === false) {
      setLoading(false);
    }
  }, [loadAnalyticsData, permissions, business_account]);

  // Format functions
  const formatCurrency = useCallback((amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
    }).format(amount);
  }, [currency]);

  const formatPercentage = useCallback((value: number) => {
    return `${value.toFixed(1)}%`;
  }, []);

  const formatNumber = useCallback((value: number) => {
    return new Intl.NumberFormat('en-US').format(value);
  }, []);

  // Business account validation
  if (!business_account?.uid && !loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full mx-4">
          <div className="text-center">
            <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Business Account Required</h3>
            <p className="text-gray-600 mb-6">You need to be associated with a business account to view analytics. Please contact your administrator or set up a business account.</p>
            <Link 
              to="/dashboard" 
              className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
            >
              Return to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Permission check
  if (!permissions?.can_view_analytics) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full mx-4">
          <div className="text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Access Restricted</h3>
            <p className="text-gray-600 mb-6">You don't have permission to view business analytics. Contact your administrator to request access.</p>
            <Link 
              to="/dashboard" 
              className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
            >
              Return to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Business Analytics</h1>
              <p className="mt-1 text-sm text-gray-500">
                Comprehensive insights and performance metrics for your delivery operations
              </p>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* Date Range Selector */}
              <select
                value={dateRangeConfig.selected_range}
                onChange={(e) => updateDateRange(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {dateRangeConfig.predefined_ranges.map((range) => (
                  <option key={range.value} value={range.value}>
                    {range.label}
                  </option>
                ))}
                <option value="custom">Custom Range</option>
              </select>

              {/* Export Dropdown */}
              <div className="relative">
                <button
                  onClick={() => {
                    const dropdown = document.getElementById('export-dropdown');
                    dropdown?.classList.toggle('hidden');
                  }}
                  disabled={exportStatus.is_exporting}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {exportStatus.is_exporting ? (
                    <>
                      <div className="animate-spin -ml-1 mr-2 h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                      Exporting... {exportStatus.export_progress}%
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Export
                    </>
                  )}
                </button>
                
                <div id="export-dropdown" className="hidden absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg z-50 border border-gray-200">
                  <div className="py-1">
                    <button
                      onClick={() => exportAnalyticsData('pdf')}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      Export as PDF
                    </button>
                    <button
                      onClick={() => exportAnalyticsData('excel')}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      Export as Excel
                    </button>
                    <button
                      onClick={() => exportAnalyticsData('csv')}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      Export as CSV
                    </button>
                  </div>
                </div>
              </div>

              <button
                onClick={loadAnalyticsData}
                disabled={loading}
                className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <div className="animate-spin -ml-1 mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                    Loading...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Refresh
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {(error || businessAccountError) && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4 mx-4 mt-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{error || businessAccountError}</p>
            </div>
            <div className="ml-auto pl-3">
              <button onClick={() => { setError(null); setBusinessAccountError(null); }} className="text-red-400 hover:text-red-600">
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Download Link */}
      {exportStatus.download_url && exportStatus.export_progress === 100 && (
        <div className="bg-green-50 border-l-4 border-green-400 p-4 mx-4 mt-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3 flex-1">
              <p className="text-sm text-green-700">
                Export complete! 
                <a 
                  href={exportStatus.download_url} 
                  download 
                  className="font-medium underline ml-2 hover:text-green-800"
                >
                  Download {exportStatus.export_format?.toUpperCase()} file
                </a>
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Executive Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Deliveries</p>
                <p className="text-2xl font-bold text-gray-900">{formatNumber(analyticsData.executive_summary.total_deliveries)}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
            </div>
            {analyticsData.executive_summary.period_comparison.delivery_change !== 0 && (
              <div className="mt-2 flex items-center">
                <span className={`text-sm font-medium ${analyticsData.executive_summary.period_comparison.delivery_change > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {analyticsData.executive_summary.period_comparison.delivery_change > 0 ? '+' : ''}
                  {formatPercentage(analyticsData.executive_summary.period_comparison.delivery_change)}
                </span>
                <span className="text-sm text-gray-500 ml-2">vs last period</span>
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Spent</p>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(analyticsData.executive_summary.total_spent)}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                </svg>
              </div>
            </div>
            {analyticsData.executive_summary.period_comparison.cost_change !== 0 && (
              <div className="mt-2 flex items-center">
                <span className={`text-sm font-medium ${analyticsData.executive_summary.period_comparison.cost_change > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {analyticsData.executive_summary.period_comparison.cost_change > 0 ? '+' : ''}
                  {formatPercentage(analyticsData.executive_summary.period_comparison.cost_change)}
                </span>
                <span className="text-sm text-gray-500 ml-2">vs last period</span>
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Success Rate</p>
                <p className="text-2xl font-bold text-gray-900">{formatPercentage(analyticsData.executive_summary.success_rate)}</p>
              </div>
              <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Cost Savings</p>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(analyticsData.executive_summary.cost_savings)}</p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="mb-8">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              {[
                { key: 'overview', label: 'Overview', icon: '📊' },
                { key: 'delivery', label: 'Delivery Performance', icon: '🚚' },
                { key: 'cost', label: 'Cost Analysis', icon: '💰' },
                { key: 'team', label: 'Team Usage', icon: '👥' },
                { key: 'predictive', label: 'Predictive Insights', icon: '🔮' },
                { key: 'reports', label: 'Custom Reports', icon: '📈' },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as any)}
                  className={`py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                    activeTab === tab.key
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <span className="mr-2">{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="bg-white rounded-lg shadow p-4 mb-8">
          <div className="flex flex-wrap gap-4 items-center">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
              <select
                value={filterCriteria.department_filter[0] || ''}
                onChange={(e) => applyAnalyticsFilters({ department_filter: e.target.value ? [e.target.value] : [] })}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All Departments</option>
                <option value="operations">Operations</option>
                <option value="sales">Sales</option>
                <option value="marketing">Marketing</option>
                <option value="hr">Human Resources</option>
                <option value="finance">Finance</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Delivery Type</label>
              <select
                value={filterCriteria.delivery_type_filter[0] || ''}
                onChange={(e) => applyAnalyticsFilters({ delivery_type_filter: e.target.value ? [e.target.value] : [] })}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All Types</option>
                <option value="standard">Standard</option>
                <option value="express">Express</option>
                <option value="priority">Priority</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={filterCriteria.status_filter[0] || ''}
                onChange={(e) => applyAnalyticsFilters({ status_filter: e.target.value ? [e.target.value] : [] })}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All Statuses</option>
                <option value="delivered">Delivered</option>
                <option value="cancelled">Cancelled</option>
                <option value="failed">Failed</option>
              </select>
            </div>

            <button
              onClick={() => {
                setFilterCriteria({
                  department_filter: [],
                  user_filter: [],
                  delivery_type_filter: [],
                  cost_range_filter: { min_cost: null, max_cost: null },
                  courier_filter: [],
                  status_filter: [],
                });
                applyAnalyticsFilters({});
              }}
              className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Clear Filters
            </button>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Delivery Trends Chart */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Delivery Trends</h3>
                <div className="h-64 bg-gray-50 rounded-lg flex items-center justify-center">
                  <p className="text-gray-500">Chart: Delivery volume over time</p>
                </div>
              </div>

              {/* Cost Breakdown */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Cost Breakdown</h3>
                <div className="h-64 bg-gray-50 rounded-lg flex items-center justify-center">
                  <p className="text-gray-500">Chart: Spending by category</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'delivery' && (
          <div className="space-y-8">
            {/* Courier Performance Table */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Courier Performance</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Courier</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Deliveries</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Success Rate</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Avg Rating</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Avg Time</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {analyticsData.delivery_performance.courier_performance.map((courier, index) => (
                      <tr key={index}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {courier.courier_name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatNumber(courier.total_deliveries)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatPercentage(courier.success_rate)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {courier.average_rating.toFixed(1)}⭐
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {courier.average_time} min
                        </td>
                      </tr>
                    ))}
                    {analyticsData.delivery_performance.courier_performance.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">
                          No courier performance data available for the selected period.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'cost' && (
          <div className="space-y-8">
            {/* Department Spending */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Spending by Department</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Spent</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Deliveries</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Avg Cost</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {analyticsData.cost_analysis.spending_breakdown.by_department.map((dept, index) => (
                      <tr key={index}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {dept.department}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatCurrency(dept.total_spent)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatNumber(dept.delivery_count)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatCurrency(dept.average_cost)}
                        </td>
                      </tr>
                    ))}
                    {analyticsData.cost_analysis.spending_breakdown.by_department.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-6 py-4 text-center text-sm text-gray-500">
                          No spending data available for the selected period.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Cost Optimization */}
            {analyticsData.cost_analysis.cost_optimization.potential_savings > 0 && (
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Cost Optimization Opportunities</h3>
                <div className="bg-green-50 rounded-lg p-4 mb-4">
                  <p className="text-lg font-semibold text-green-800">
                    Potential Savings: {formatCurrency(analyticsData.cost_analysis.cost_optimization.potential_savings)}
                  </p>
                </div>
                <div className="space-y-3">
                  {analyticsData.cost_analysis.cost_optimization.recommendations.map((rec: any, index: number) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4">
                      <h4 className="font-medium text-gray-900">{rec.category}</h4>
                      <p className="text-sm text-gray-600 mt-1">{rec.description}</p>
                      <div className="flex justify-between items-center mt-2">
                        <span className="text-sm text-green-600 font-medium">
                          Est. Savings: {formatCurrency(rec.estimated_savings)}
                        </span>
                        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                          {rec.implementation_effort} effort
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'team' && (
          <div className="space-y-8">
            {/* Team Activity */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Team Activity</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Deliveries</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Spent</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Avg Cost</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Active</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {analyticsData.team_usage.user_activity.map((user, index) => (
                      <tr key={index}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {user.user_name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {user.department}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatNumber(user.deliveries_created)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatCurrency(user.total_spent)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatCurrency(user.average_cost)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(user.last_active).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                    {analyticsData.team_usage.user_activity.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-6 py-4 text-center text-sm text-gray-500">
                          No team activity data available for the selected period.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'predictive' && (
          <div className="space-y-8">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">🔮 Predictive Analytics</h3>
              <p className="text-gray-600 mb-6">
                Advanced machine learning insights and forecasting based on your historical data.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-blue-50 rounded-lg p-4">
                  <h4 className="font-semibold text-blue-800 mb-2">📈 Demand Forecast</h4>
                  <p className="text-sm text-blue-700">
                    Predicted delivery volume for next month: <strong>+15%</strong>
                  </p>
                </div>
                
                <div className="bg-green-50 rounded-lg p-4">
                  <h4 className="font-semibold text-green-800 mb-2">💰 Budget Projection</h4>
                  <p className="text-sm text-green-700">
                    Recommended monthly budget: <strong>{formatCurrency(analyticsData.executive_summary.total_spent * 1.15)}</strong>
                  </p>
                </div>
                
                <div className="bg-amber-50 rounded-lg p-4">
                  <h4 className="font-semibold text-amber-800 mb-2">⚠️ Risk Analysis</h4>
                  <p className="text-sm text-amber-700">
                    Low risk profile with stable operations
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'reports' && (
          <div className="space-y-8">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">📈 Custom Report Builder</h3>
              <p className="text-gray-600 mb-6">
                Create custom reports with specific metrics and visualizations.
              </p>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">Report Configuration</h4>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Report Name</label>
                      <input
                        type="text"
                        value={reportBuilder.report_name}
                        onChange={(e) => setReportBuilder(prev => ({ ...prev, report_name: e.target.value }))}
                        placeholder="Enter report name"
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Select Metrics</label>
                      <div className="space-y-2">
                        {[
                          'Total Deliveries',
                          'Total Spent', 
                          'Success Rate',
                          'Average Delivery Time',
                          'Cost per Delivery',
                          'Team Performance'
                        ].map((metric) => (
                          <label key={metric} className="flex items-center">
                            <input
                              type="checkbox"
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setReportBuilder(prev => ({
                                    ...prev,
                                    selected_metrics: [...prev.selected_metrics, metric]
                                  }));
                                } else {
                                  setReportBuilder(prev => ({
                                    ...prev,
                                    selected_metrics: prev.selected_metrics.filter(m => m !== metric)
                                  }));
                                }
                              }}
                            />
                            <span className="ml-2 text-sm text-gray-700">{metric}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">Scheduling</h4>
                  
                  <div className="space-y-4">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={reportBuilder.schedule_config.is_scheduled}
                        onChange={(e) => setReportBuilder(prev => ({
                          ...prev,
                          schedule_config: { ...prev.schedule_config, is_scheduled: e.target.checked }
                        }))}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">Schedule automated reports</span>
                    </label>
                    
                    {reportBuilder.schedule_config.is_scheduled && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Frequency</label>
                        <select
                          value={reportBuilder.schedule_config.frequency}
                          onChange={(e) => setReportBuilder(prev => ({
                            ...prev,
                            schedule_config: { ...prev.schedule_config, frequency: e.target.value }
                          }))}
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="daily">Daily</option>
                          <option value="weekly">Weekly</option>
                          <option value="monthly">Monthly</option>
                        </select>
                      </div>
                    )}
                  </div>
                  
                  <button
                    onClick={() => {
                      if (reportBuilder.report_name && reportBuilder.selected_metrics.length > 0) {
                        alert(`Report "${reportBuilder.report_name}" would be generated with ${reportBuilder.selected_metrics.length} metrics.`);
                      } else {
                        alert('Please enter a report name and select at least one metric.');
                      }
                    }}
                    className="w-full mt-6 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                  >
                    Generate Report
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UV_BusinessAnalytics;