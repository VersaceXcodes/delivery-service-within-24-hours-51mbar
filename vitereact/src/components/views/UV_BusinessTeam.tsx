import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '@/store/main';
import axios from 'axios';

interface TeamMember {
  uid: string;
  user_uid: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  permissions: string[];
  status: string;
  last_login: string;
  deliveries_created: number;
  total_spent: number;
  joined_at: string;
  invited_by: string;
  profile_photo_url: string;
}

interface PendingInvitation {
  uid: string;
  email: string;
  role: string;
  invited_at: string;
  invited_by: string;
  expires_at: string;
  invitation_token: string;
}

interface Role {
  role_name: string;
  display_name: string;
  description: string;
  permissions: string[];
  is_custom: boolean;
}

interface Permission {
  permission_key: string;
  display_name: string;
  description: string;
  category: string;
}

interface TeamMembersResponse {
  active_members: TeamMember[];
  pending_invitations: PendingInvitation[];
  pagination: {
    current_page: number;
    total_pages: number;
    total_count: number;
  };
}

const UV_BusinessTeam: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const params = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const { user, session, business_account } = useSelector((state: RootState) => state.auth);
  const { language, timezone } = useSelector((state: RootState) => state.app_settings);

  // URL Parameters from React Router
  const userUid = params.user_uid;
  const roleFilter = searchParams.get('role') || '';
  const statusFilter = searchParams.get('status') || '';
  const invitePendingFilter = searchParams.get('invite_pending') === 'true';
  const currentPage = parseInt(searchParams.get('page') || '1', 10);
  const searchQuery = searchParams.get('search') || '';

  // State Variables
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [teamMembers, setTeamMembers] = useState<TeamMembersResponse>({
    active_members: [],
    pending_invitations: [],
    pagination: { current_page: 1, total_pages: 0, total_count: 0 }
  });

  const [rolePermissions, setRolePermissions] = useState<{
    available_roles: Role[];
    available_permissions: Permission[];
    permission_matrix: Record<string, any>;
  }>({
    available_roles: [
      {
        role_name: 'admin',
        display_name: 'Administrator',
        description: 'Full access to all features and team management',
        permissions: ['all'],
        is_custom: false
      },
      {
        role_name: 'manager',
        display_name: 'Manager',
        description: 'Can manage deliveries and view analytics',
        permissions: ['create_delivery', 'view_analytics', 'manage_addresses'],
        is_custom: false
      },
      {
        role_name: 'user',
        display_name: 'User',
        description: 'Can create deliveries and view own history',
        permissions: ['create_delivery', 'view_own_deliveries'],
        is_custom: false
      },
      {
        role_name: 'viewer',
        display_name: 'Viewer',
        description: 'Read-only access to delivery history',
        permissions: ['view_deliveries'],
        is_custom: false
      }
    ],
    available_permissions: [],
    permission_matrix: {}
  });

  const [memberActivity, setMemberActivity] = useState<{
    activity_summary: {
      total_users: number;
      active_users_30d: number;
      pending_invitations: number;
      total_deliveries: number;
      total_spent: number;
    };
    member_analytics: any[];
    usage_trends: any[];
  }>({
    activity_summary: {
      total_users: 0,
      active_users_30d: 0,
      pending_invitations: 0,
      total_deliveries: 0,
      total_spent: 0
    },
    member_analytics: [],
    usage_trends: []
  });

  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [invitationForm, setInvitationForm] = useState<{
    email: string;
    role: string;
    permissions: string[];
    custom_message: string;
    cost_center: string;
    spending_limit: number | null;
    access_expiration: string | null;
    send_welcome_email: boolean;
  }>({
    email: '',
    role: 'user',
    permissions: [],
    custom_message: '',
    cost_center: '',
    spending_limit: null,
    access_expiration: null,
    send_welcome_email: true
  });

  const [bulkOperationStatus, setBulkOperationStatus] = useState<{
    operation_type: string | null;
    is_processing: boolean;
    progress: number;
    success_count: number;
    error_count: number;
    errors: Array<{ user_uid: string; error_message: string; }>;
  }>({
    operation_type: null,
    is_processing: false,
    progress: 0,
    success_count: 0,
    error_count: 0,
    errors: []
  });

  // Modal states
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showBulkModal, setBulkModal] = useState(false);
  const [showMemberDetailModal, setShowMemberDetailModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get business account UID from auth state
  const businessAccountUid = business_account?.uid || user?.business_account?.uid;

  // Validate required data
  const hasRequiredAuth = user && session?.access_token && businessAccountUid;

  // Load team members function
  const loadTeamMembers = useCallback(async () => {
    if (!hasRequiredAuth) return;

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '20'
      });

      if (roleFilter) params.append('role', roleFilter);
      if (statusFilter) params.append('status', statusFilter);
      if (searchQuery) params.append('search', searchQuery);
      if (invitePendingFilter) params.append('invite_pending', 'true');

      const response = await axios.get(
        `/api/v1/business-accounts/${businessAccountUid}/team-members?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`
          }
        }
      );

      // Validate response structure
      const data = response.data as TeamMembersResponse;
      setTeamMembers({
        active_members: data.active_members || [],
        pending_invitations: data.pending_invitations || [],
        pagination: data.pagination || { current_page: 1, total_pages: 0, total_count: 0 }
      });
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load team members');
      console.error('Load team members error:', err);
    } finally {
      setLoading(false);
    }
  }, [hasRequiredAuth, businessAccountUid, session, roleFilter, statusFilter, searchQuery, invitePendingFilter, currentPage]);

  // Load member activity
  const loadMemberActivity = useCallback(async () => {
    if (!hasRequiredAuth) return;

    try {
      const response = await axios.get(
        `/api/v1/business-accounts/${businessAccountUid}/team-analytics`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`
          }
        }
      );
      
      const data = response.data;
      setMemberActivity({
        activity_summary: data.activity_summary || {
          total_users: 0,
          active_users_30d: 0,
          pending_invitations: 0,
          total_deliveries: 0,
          total_spent: 0
        },
        member_analytics: data.member_analytics || [],
        usage_trends: data.usage_trends || []
      });
    } catch (err: any) {
      console.error('Failed to load member activity:', err);
    }
  }, [hasRequiredAuth, businessAccountUid, session]);

  // Invite team member
  const inviteTeamMember = async () => {
    if (!hasRequiredAuth) return;

    setLoading(true);
    try {
      await axios.post(
        `/api/v1/business-accounts/${businessAccountUid}/team-members`,
        invitationForm,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`
          }
        }
      );

      setShowInviteModal(false);
      setInvitationForm({
        email: '',
        role: 'user',
        permissions: [],
        custom_message: '',
        cost_center: '',
        spending_limit: null,
        access_expiration: null,
        send_welcome_email: true
      });
      await loadTeamMembers();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to invite team member');
    } finally {
      setLoading(false);
    }
  };

  // Update member role
  const updateMemberRole = async (memberUid: string, newRole: string) => {
    if (!session?.access_token) return;

    try {
      await axios.put(
        `/api/v1/business-team-members/${memberUid}`,
        {
          role: newRole,
          permissions: rolePermissions.available_roles.find(r => r.role_name === newRole)?.permissions || []
        },
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`
          }
        }
      );
      await loadTeamMembers();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update member role');
    }
  };

  // Remove member from team
  const removeMemberFromTeam = async (memberUid: string) => {
    if (!session?.access_token) return;

    if (!window.confirm('Are you sure you want to remove this team member? This action cannot be undone.')) {
      return;
    }

    try {
      await axios.delete(
        `/api/v1/business-team-members/${memberUid}`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`
          }
        }
      );
      await loadTeamMembers();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to remove team member');
    }
  };

  // Bulk update permissions
  const bulkUpdatePermissions = async (operation: string) => {
    if (!session?.access_token || selectedMembers.length === 0) return;

    setBulkOperationStatus({
      operation_type: operation,
      is_processing: true,
      progress: 0,
      success_count: 0,
      error_count: 0,
      errors: []
    });

    try {
      const response = await axios.put('/api/v1/business-team-members/bulk-update', {
        member_uids: selectedMembers,
        operation: operation,
        data: operation === 'role_change' ? { role: 'user' } : {}
      }, {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      setBulkOperationStatus(prev => ({
        ...prev,
        is_processing: false,
        progress: 100,
        success_count: response.data.success_count || 0,
        error_count: response.data.error_count || 0,
        errors: response.data.errors || []
      }));

      await loadTeamMembers();
      setSelectedMembers([]);
    } catch (err: any) {
      setBulkOperationStatus(prev => ({
        ...prev,
        is_processing: false,
        errors: [{ user_uid: 'bulk', error_message: err.response?.data?.message || 'Bulk operation failed' }]
      }));
    }
  };

  // Resend invitation
  const resendInvitation = async (invitationUid: string) => {
    if (!session?.access_token) return;

    try {
      await axios.post(
        `/api/v1/business-invitations/${invitationUid}/resend`,
        {},
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`
          }
        }
      );
      await loadTeamMembers();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to resend invitation');
    }
  };

  // Handle filter changes
  const updateFilter = useCallback((key: string, value: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (value) {
      newParams.set(key, value);
    } else {
      newParams.delete(key);
    }
    newParams.set('page', '1'); // Reset to first page
    setSearchParams(newParams);
  }, [searchParams, setSearchParams]);

  // Handle pagination
  const handlePageChange = useCallback((page: number) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set('page', page.toString());
    setSearchParams(newParams);
  }, [searchParams, setSearchParams]);

  // Effects
  useEffect(() => {
    if (hasRequiredAuth) {
      loadTeamMembers();
      loadMemberActivity();
    }
  }, [loadTeamMembers, loadMemberActivity, hasRequiredAuth]);

  // Navigate to member details
  useEffect(() => {
    if (userUid && teamMembers.active_members.length > 0) {
      const member = teamMembers.active_members.find(m => m.user_uid === userUid);
      if (member) {
        setSelectedMember(member);
        setShowMemberDetailModal(true);
      }
    }
  }, [userUid, teamMembers.active_members]);

  // Computed values
  const filteredMembers = useMemo(() => {
    return teamMembers.active_members.filter(member => {
      const matchesRole = !roleFilter || member.role === roleFilter;
      const matchesStatus = !statusFilter || member.status === statusFilter;
      const matchesSearch = !searchQuery || 
        member.first_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        member.last_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        member.email.toLowerCase().includes(searchQuery.toLowerCase());
      
      return matchesRole && matchesStatus && matchesSearch;
    });
  }, [teamMembers.active_members, roleFilter, statusFilter, searchQuery]);

  // Format date helper
  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString(language || 'en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return dateString;
    }
  };

  // Format currency helper
  const formatCurrency = (amount: number) => {
    try {
      return new Intl.NumberFormat(language || 'en-US', {
        style: 'currency',
        currency: 'USD'
      }).format(amount);
    } catch {
      return `$${amount.toFixed(2)}`;
    }
  };

  // Show loading if no auth data
  if (!hasRequiredAuth) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-500">Loading team data...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="py-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Team Management</h1>
                  <p className="mt-1 text-sm text-gray-500">
                    Manage your business account team members, roles, and permissions
                  </p>
                </div>
                <div className="flex space-x-3">
                  <button
                    onClick={() => setShowInviteModal(true)}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Invite Member
                  </button>
                  {selectedMembers.length > 0 && (
                    <button
                      onClick={() => setBulkModal(true)}
                      className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                    >
                      Bulk Actions ({selectedMembers.length})
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <div className="flex">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" />
                </svg>
                <div className="ml-3">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
                <button
                  onClick={() => setError(null)}
                  className="ml-auto pl-3"
                >
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10 4.293 5.707a1 1 0 010-1.414z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Navigation Tabs */}
          <div className="border-b border-gray-200 mb-8">
            <nav className="-mb-px flex space-x-8">
              {[
                { id: 'overview', label: 'Overview' },
                { id: 'members', label: 'Team Members' },
                { id: 'analytics', label: 'Analytics' },
                { id: 'roles', label: 'Roles & Permissions' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white overflow-hidden shadow rounded-lg">
                  <div className="p-5">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <svg className="h-6 w-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 truncate">Total Members</dt>
                          <dd className="text-lg font-medium text-gray-900">{memberActivity.activity_summary.total_users}</dd>
                        </dl>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white overflow-hidden shadow rounded-lg">
                  <div className="p-5">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <svg className="h-6 w-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 truncate">Active (30d)</dt>
                          <dd className="text-lg font-medium text-gray-900">{memberActivity.activity_summary.active_users_30d}</dd>
                        </dl>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white overflow-hidden shadow rounded-lg">
                  <div className="p-5">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <svg className="h-6 w-6 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 truncate">Pending Invites</dt>
                          <dd className="text-lg font-medium text-gray-900">{memberActivity.activity_summary.pending_invitations}</dd>
                        </dl>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white overflow-hidden shadow rounded-lg">
                  <div className="p-5">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <svg className="h-6 w-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                        </svg>
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 truncate">Total Spent</dt>
                          <dd className="text-lg font-medium text-gray-900">{formatCurrency(memberActivity.activity_summary.total_spent)}</dd>
                        </dl>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Pending Invitations */}
              {teamMembers.pending_invitations.length > 0 && (
                <div className="bg-white shadow rounded-lg">
                  <div className="px-4 py-5 sm:p-6">
                    <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Pending Invitations</h3>
                    <div className="space-y-3">
                      {teamMembers.pending_invitations.map((invitation) => (
                        <div key={invitation.uid} className="flex items-center justify-between p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                          <div className="flex items-center">
                            <div className="flex-shrink-0">
                              <div className="h-8 w-8 rounded-full bg-yellow-100 flex items-center justify-center">
                                <svg className="h-4 w-4 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                                </svg>
                              </div>
                            </div>
                            <div className="ml-3">
                              <p className="text-sm font-medium text-gray-900">{invitation.email}</p>
                              <p className="text-xs text-gray-500">
                                Invited as {rolePermissions.available_roles.find(r => r.role_name === invitation.role)?.display_name} 
                                on {formatDate(invitation.invited_at)}
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => resendInvitation(invitation.uid)}
                            className="ml-3 text-sm text-blue-600 hover:text-blue-500"
                          >
                            Resend
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Team Members Tab */}
          {activeTab === 'members' && (
            <div>
              {/* Filters */}
              <div className="bg-white shadow rounded-lg mb-6">
                <div className="px-4 py-5 sm:p-6">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
                      <input
                        type="text"
                        placeholder="Search by name or email..."
                        value={searchQuery}
                        className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        onChange={(e) => updateFilter('search', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                      <select
                        value={roleFilter}
                        className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        onChange={(e) => updateFilter('role', e.target.value)}
                      >
                        <option value="">All Roles</option>
                        {rolePermissions.available_roles.map(role => (
                          <option key={role.role_name} value={role.role_name}>{role.display_name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                      <select
                        value={statusFilter}
                        className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        onChange={(e) => updateFilter('status', e.target.value)}
                      >
                        <option value="">All Status</option>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                        <option value="pending">Pending</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">&nbsp;</label>
                      <button
                        onClick={loadTeamMembers}
                        className="w-full inline-flex justify-center items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                      >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Refresh
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Team Members List */}
              <div className="bg-white shadow rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                  {loading ? (
                    <div className="flex justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    </div>
                  ) : filteredMembers.length === 0 ? (
                    <div className="text-center py-8">
                      <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      <h3 className="mt-2 text-sm font-medium text-gray-900">No team members</h3>
                      <p className="mt-1 text-sm text-gray-500">Get started by inviting your first team member.</p>
                      <div className="mt-6">
                        <button
                          onClick={() => setShowInviteModal(true)}
                          className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                        >
                          Invite Member
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {filteredMembers.map((member) => (
                        <div key={member.uid} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                          <div className="flex items-center">
                            <input
                              type="checkbox"
                              checked={selectedMembers.includes(member.uid)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedMembers([...selectedMembers, member.uid]);
                                } else {
                                  setSelectedMembers(selectedMembers.filter(id => id !== member.uid));
                                }
                              }}
                              className="mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            />
                            <img
                              src={member.profile_photo_url || `https://picsum.photos/200/200?random=${member.uid}`}
                              alt={`${member.first_name} ${member.last_name}`}
                              className="h-10 w-10 rounded-full"
                            />
                            <div className="ml-3">
                              <p className="text-sm font-medium text-gray-900">
                                {member.first_name} {member.last_name}
                              </p>
                              <p className="text-xs text-gray-500">{member.email}</p>
                              <div className="flex items-center mt-1">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                  member.status === 'active' 
                                    ? 'bg-green-100 text-green-800'
                                    : member.status === 'inactive'
                                    ? 'bg-red-100 text-red-800'
                                    : 'bg-yellow-100 text-yellow-800'
                                }`}>
                                  {member.status}
                                </span>
                                <span className="ml-2 text-xs text-gray-500">
                                  {rolePermissions.available_roles.find(r => r.role_name === member.role)?.display_name}
                                </span>
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center space-x-6 text-sm text-gray-500">
                            <div className="text-center">
                              <p className="font-medium text-gray-900">{member.deliveries_created}</p>
                              <p className="text-xs">Deliveries</p>
                            </div>
                            <div className="text-center">
                              <p className="font-medium text-gray-900">{formatCurrency(member.total_spent)}</p>
                              <p className="text-xs">Spent</p>
                            </div>
                            <div className="text-center">
                              <p className="font-medium text-gray-900">{member.last_login ? formatDate(member.last_login) : 'Never'}</p>
                              <p className="text-xs">Last Login</p>
                            </div>
                            
                            <div className="flex items-center space-x-2">
                              <select
                                value={member.role}
                                onChange={(e) => updateMemberRole(member.uid, e.target.value)}
                                className="text-xs border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                              >
                                {rolePermissions.available_roles.map(role => (
                                  <option key={role.role_name} value={role.role_name}>{role.display_name}</option>
                                ))}
                              </select>
                              
                              <Link
                                to={`/business/team/${member.user_uid}`}
                                className="text-blue-600 hover:text-blue-500"
                              >
                                View
                              </Link>
                              
                              <button
                                onClick={() => removeMemberFromTeam(member.uid)}
                                className="text-red-600 hover:text-red-500"
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Pagination */}
                  {teamMembers.pagination.total_pages > 1 && (
                    <div className="mt-6 flex items-center justify-between">
                      <div className="text-sm text-gray-700">
                        Showing page {teamMembers.pagination.current_page} of {teamMembers.pagination.total_pages}
                      </div>
                      <div className="flex space-x-2">
                        <button
                          disabled={teamMembers.pagination.current_page === 1}
                          onClick={() => handlePageChange(teamMembers.pagination.current_page - 1)}
                          className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
                        >
                          Previous
                        </button>
                        <button
                          disabled={teamMembers.pagination.current_page === teamMembers.pagination.total_pages}
                          onClick={() => handlePageChange(teamMembers.pagination.current_page + 1)}
                          className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Analytics Tab */}
          {activeTab === 'analytics' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Team Activity Chart */}
                <div className="bg-white shadow rounded-lg p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Team Activity Trends</h3>
                  <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
                    <p className="text-gray-500">Activity chart would be displayed here</p>
                  </div>
                </div>

                {/* Cost Analysis */}
                <div className="bg-white shadow rounded-lg p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Cost Analysis</h3>
                  <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
                    <p className="text-gray-500">Cost analysis chart would be displayed here</p>
                  </div>
                </div>
              </div>

              {/* Top Performers */}
              <div className="bg-white shadow rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                  <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Top Performers</h3>
                  <div className="space-y-3">
                    {filteredMembers
                      .sort((a, b) => b.deliveries_created - a.deliveries_created)
                      .slice(0, 5)
                      .map((member, index) => (
                        <div key={member.uid} className="flex items-center justify-between">
                          <div className="flex items-center">
                            <span className="text-sm font-medium text-gray-500 mr-3">#{index + 1}</span>
                            <img
                              src={member.profile_photo_url || `https://picsum.photos/200/200?random=${member.uid}`}
                              alt={`${member.first_name} ${member.last_name}`}
                              className="h-8 w-8 rounded-full"
                            />
                            <div className="ml-3">
                              <p className="text-sm font-medium text-gray-900">
                                {member.first_name} {member.last_name}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium text-gray-900">{member.deliveries_created} deliveries</p>
                            <p className="text-sm text-gray-500">{formatCurrency(member.total_spent)} spent</p>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Roles & Permissions Tab */}
          {activeTab === 'roles' && (
            <div className="space-y-6">
              <div className="bg-white shadow rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                  <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Role Definitions</h3>
                  <div className="space-y-4">
                    {rolePermissions.available_roles.map((role) => (
                      <div key={role.role_name} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="text-base font-medium text-gray-900">{role.display_name}</h4>
                            <p className="text-sm text-gray-500 mt-1">{role.description}</p>
                            <div className="mt-2">
                              <p className="text-xs text-gray-400">Permissions:</p>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {role.permissions.map((permission) => (
                                  <span
                                    key={permission}
                                    className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800"
                                  >
                                    {permission}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                          {role.is_custom && (
                            <button className="text-sm text-blue-600 hover:text-blue-500">
                              Edit
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Invite Member Modal */}
        {showInviteModal && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-full max-w-md shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">Invite Team Member</h3>
                  <button
                    onClick={() => setShowInviteModal(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <form onSubmit={(e) => { e.preventDefault(); inviteTeamMember(); }} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                    <input
                      type="email"
                      required
                      value={invitationForm.email}
                      onChange={(e) => setInvitationForm({...invitationForm, email: e.target.value})}
                      className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      placeholder="colleague@company.com"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                    <select
                      value={invitationForm.role}
                      onChange={(e) => setInvitationForm({...invitationForm, role: e.target.value})}
                      className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    >
                      {rolePermissions.available_roles.map(role => (
                        <option key={role.role_name} value={role.role_name}>
                          {role.display_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Custom Message (Optional)</label>
                    <textarea
                      rows={3}
                      value={invitationForm.custom_message}
                      onChange={(e) => setInvitationForm({...invitationForm, custom_message: e.target.value})}
                      className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      placeholder="Welcome to our team!"
                    />
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      checked={invitationForm.send_welcome_email}
                      onChange={(e) => setInvitationForm({...invitationForm, send_welcome_email: e.target.checked})}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label className="ml-2 block text-sm text-gray-900">
                      Send welcome email
                    </label>
                  </div>

                  <div className="flex justify-end space-x-3 pt-4">
                    <button
                      type="button"
                      onClick={() => setShowInviteModal(false)}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50"
                    >
                      {loading ? 'Sending...' : 'Send Invitation'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Bulk Operations Modal */}
        {showBulkModal && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-full max-w-md shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">Bulk Actions</h3>
                  <button
                    onClick={() => setBulkModal(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="space-y-4">
                  <p className="text-sm text-gray-600">
                    Selected {selectedMembers.length} team member{selectedMembers.length !== 1 ? 's' : ''}
                  </p>

                  {bulkOperationStatus.is_processing ? (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700">Processing...</span>
                        <span className="text-sm text-gray-500">{bulkOperationStatus.progress}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${bulkOperationStatus.progress}%` }}
                        ></div>
                      </div>
                    </div>
                  ) : bulkOperationStatus.success_count > 0 || bulkOperationStatus.error_count > 0 ? (
                    <div className="space-y-2">
                      {bulkOperationStatus.success_count > 0 && (
                        <p className="text-sm text-green-600">
                          ✓ {bulkOperationStatus.success_count} operations completed successfully
                        </p>
                      )}
                      {bulkOperationStatus.error_count > 0 && (
                        <p className="text-sm text-red-600">
                          ✗ {bulkOperationStatus.error_count} operations failed
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <button
                        onClick={() => bulkUpdatePermissions('role_change')}
                        className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded"
                      >
                        Change Role
                      </button>
                      <button
                        onClick={() => bulkUpdatePermissions('deactivate')}
                        className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded"
                      >
                        Deactivate Members
                      </button>
                      <button
                        onClick={() => bulkUpdatePermissions('export')}
                        className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded"
                      >
                        Export Selected
                      </button>
                    </div>
                  )}

                  <div className="flex justify-end space-x-3 pt-4">
                    <button
                      onClick={() => {
                        setBulkModal(false);
                        setSelectedMembers([]);
                        setBulkOperationStatus({
                          operation_type: null,
                          is_processing: false,
                          progress: 0,
                          success_count: 0,
                          error_count: 0,
                          errors: []
                        });
                      }}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Member Detail Modal */}
        {showMemberDetailModal && selectedMember && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">Member Details</h3>
                  <button
                    onClick={() => {
                      setShowMemberDetailModal(false);
                      setSelectedMember(null);
                      // Navigate back to main team view if we came from a direct link
                      if (userUid) {
                        navigate('/business/team');
                      }
                    }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="space-y-6">
                  <div className="flex items-center">
                    <img
                      src={selectedMember.profile_photo_url || `https://picsum.photos/200/200?random=${selectedMember.uid}`}
                      alt={`${selectedMember.first_name} ${selectedMember.last_name}`}
                      className="h-16 w-16 rounded-full"
                    />
                    <div className="ml-4">
                      <h4 className="text-xl font-medium text-gray-900">
                        {selectedMember.first_name} {selectedMember.last_name}
                      </h4>
                      <p className="text-sm text-gray-500">{selectedMember.email}</p>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        selectedMember.status === 'active' 
                          ? 'bg-green-100 text-green-800'
                          : selectedMember.status === 'inactive'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {selectedMember.status}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Role</dt>
                      <dd className="mt-1 text-sm text-gray-900">
                        {rolePermissions.available_roles.find(r => r.role_name === selectedMember.role)?.display_name}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Joined</dt>
                      <dd className="mt-1 text-sm text-gray-900">{formatDate(selectedMember.joined_at)}</dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Last Login</dt>
                      <dd className="mt-1 text-sm text-gray-900">
                        {selectedMember.last_login ? formatDate(selectedMember.last_login) : 'Never'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Invited By</dt>
                      <dd className="mt-1 text-sm text-gray-900">{selectedMember.invited_by || 'System'}</dd>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Deliveries Created</dt>
                      <dd className="mt-1 text-2xl font-semibold text-gray-900">{selectedMember.deliveries_created}</dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Total Spent</dt>
                      <dd className="mt-1 text-2xl font-semibold text-gray-900">{formatCurrency(selectedMember.total_spent)}</dd>
                    </div>
                  </div>

                  <div>
                    <dt className="text-sm font-medium text-gray-500 mb-2">Permissions</dt>
                    <div className="flex flex-wrap gap-2">
                      {selectedMember.permissions.map((permission) => (
                        <span
                          key={permission}
                          className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800"
                        >
                          {permission}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default UV_BusinessTeam;