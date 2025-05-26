import React, { useState, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { RootState, AppDispatch, load_user_profile, update_user_profile, update_app_settings, update_notification_preferences } from '@/store/main';

interface PersonalInfo {
  uid: string;
  email: string;
  phone: string;
  first_name: string;
  last_name: string;
  profile_photo_url: string;
  preferred_language: string;
  timezone: string;
  date_of_birth: string | null;
  gender: string | null;
}

interface SecuritySettings {
  two_factor_enabled: boolean;
  password_last_changed: string;
  trusted_devices: Array<{
    device_id: string;
    device_name: string;
    last_login: string;
    location: string;
  }>;
  login_history: Array<{
    login_time: string;
    ip_address: string;
    device_info: string;
    location: string;
    success: boolean;
  }>;
}

interface NotificationPreferences {
  email_notifications: boolean;
  sms_notifications: boolean;
  push_notifications: boolean;
  marketing_communications: boolean;
  delivery_updates: string;
  notification_frequency: string;
  do_not_disturb: {
    enabled: boolean;
    start_time: string;
    end_time: string;
  };
}

interface PrivacySettings {
  data_sharing_consent: boolean;
  location_tracking: boolean;
  analytics_consent: boolean;
  profile_visibility: string;
  communication_privacy: string;
}

interface Address {
  uid: string;
  label: string;
  street_address: string;
  apartment_unit: string;
  city: string;
  state_province: string;
  postal_code: string;
  country: string;
  latitude: number;
  longitude: number;
  access_instructions: string;
  is_verified: boolean;
  is_favorite: boolean;
  use_count: number;
  last_used: string;
  created_at: string;
}

interface ProfileData {
  personal_info: PersonalInfo;
  security_settings: SecuritySettings;
  notification_preferences: NotificationPreferences;
  privacy_settings: PrivacySettings;
}

interface EditMode {
  personal_info: boolean;
  security_settings: boolean;
  notification_preferences: boolean;
  privacy_settings: boolean;
  address_editing: string | null;
}

interface AccountVerification {
  email_verification: {
    is_verified: boolean;
    verification_sent: boolean;
    verification_expires: string | null;
  };
  phone_verification: {
    is_verified: boolean;
    verification_sent: boolean;
    verification_code_expires: string | null;
  };
  identity_verification: {
    status: string;
    documents_uploaded: string[];
    verification_notes: string;
  };
}

interface PhotoUploadStatus {
  is_uploading: boolean;
  upload_progress: number;
  preview_url: string | null;
  crop_data: any;
  error_message: string | null;
}

const UV_Profile: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { auth, app_settings, notifications } = useSelector((state: RootState) => state);
  const [searchParams, setSearchParams] = useSearchParams();

  // State variables from the datamap
  const [profileData, setProfileData] = useState<ProfileData>({
    personal_info: {
      uid: '',
      email: '',
      phone: '',
      first_name: '',
      last_name: '',
      profile_photo_url: 'https://picsum.photos/200/200?random=1',
      preferred_language: 'en',
      timezone: 'UTC',
      date_of_birth: null,
      gender: null,
    },
    security_settings: {
      two_factor_enabled: false,
      password_last_changed: '',
      trusted_devices: [],
      login_history: [],
    },
    notification_preferences: {
      email_notifications: true,
      sms_notifications: true,
      push_notifications: true,
      marketing_communications: false,
      delivery_updates: 'all',
      notification_frequency: 'immediate',
      do_not_disturb: {
        enabled: false,
        start_time: '22:00',
        end_time: '07:00',
      },
    },
    privacy_settings: {
      data_sharing_consent: false,
      location_tracking: true,
      analytics_consent: true,
      profile_visibility: 'private',
      communication_privacy: 'contacts_only',
    },
  });

  const [addressBook, setAddressBook] = useState<Address[]>([]);
  const [editMode, setEditMode] = useState<EditMode>({
    personal_info: false,
    security_settings: false,
    notification_preferences: false,
    privacy_settings: false,
    address_editing: null,
  });
  
  const [activeTab, setActiveTab] = useState<string>('personal');
  const [accountVerification, setAccountVerification] = useState<AccountVerification>({
    email_verification: {
      is_verified: false,
      verification_sent: false,
      verification_expires: null,
    },
    phone_verification: {
      is_verified: false,
      verification_sent: false,
      verification_code_expires: null,
    },
    identity_verification: {
      status: 'not_started',
      documents_uploaded: [],
      verification_notes: '',
    },
  });

  const [photoUploadStatus, setPhotoUploadStatus] = useState<PhotoUploadStatus>({
    is_uploading: false,
    upload_progress: 0,
    preview_url: null,
    crop_data: null,
    error_message: null,
  });

  // Form states
  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });
  
  const [addressForm, setAddressForm] = useState({
    label: '',
    street_address: '',
    apartment_unit: '',
    city: '',
    state_province: '',
    postal_code: '',
    country: '',
    access_instructions: '',
    is_favorite: false,
  });

  const [verificationCodes, setVerificationCodes] = useState({
    email: '',
    phone: '',
  });

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize from URL params
  useEffect(() => {
    const tab = searchParams.get('tab') || 'personal';
    const editModeParam = searchParams.get('edit_mode');
    
    setActiveTab(tab);
    if (editModeParam) {
      setEditMode(prev => ({ ...prev, [editModeParam]: true }));
    }
  }, [searchParams]);

  // Load profile data on mount
  useEffect(() => {
    loadProfileData();
  }, []);

  // Action implementations
  const loadProfileData = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/v1/auth/profile');
      const data = response.data;
      
      setProfileData({
        personal_info: data,
        security_settings: {
          two_factor_enabled: data.two_factor_enabled || false,
          password_last_changed: data.password_last_changed || '',
          trusted_devices: [],
          login_history: [],
        },
        notification_preferences: {
          email_notifications: true,
          sms_notifications: true,
          push_notifications: true,
          marketing_communications: false,
          delivery_updates: 'all',
          notification_frequency: 'immediate',
          do_not_disturb: {
            enabled: false,
            start_time: '22:00',
            end_time: '07:00',
          },
        },
        privacy_settings: {
          data_sharing_consent: false,
          location_tracking: true,
          analytics_consent: true,
          profile_visibility: 'private',
          communication_privacy: 'contacts_only',
        },
      });

      setAddressBook(data.addresses || []);
      setAccountVerification(prev => ({
        ...prev,
        email_verification: {
          ...prev.email_verification,
          is_verified: data.is_email_verified || false,
        },
        phone_verification: {
          ...prev.phone_verification,
          is_verified: data.is_phone_verified || false,
        },
      }));
    } catch (error) {
      console.error('Failed to load profile data:', error);
    } finally {
      setLoading(false);
    }
  };

  const updatePersonalInfo = async () => {
    try {
      setLoading(true);
      const response = await axios.put('/api/v1/auth/profile', profileData.personal_info);
      dispatch(update_user_profile(response.data));
      setEditMode(prev => ({ ...prev, personal_info: false }));
    } catch (error) {
      console.error('Failed to update personal info:', error);
    } finally {
      setLoading(false);
    }
  };

  const uploadProfilePhoto = async (file: File) => {
    try {
      setPhotoUploadStatus(prev => ({ ...prev, is_uploading: true, upload_progress: 0 }));
      
      const formData = new FormData();
      formData.append('file', file);
      formData.append('entity_type', 'profile');
      formData.append('entity_uid', profileData.personal_info.uid);
      formData.append('upload_purpose', 'profile_photo');

      const response = await axios.post('/api/v1/files/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const progress = (progressEvent.loaded / progressEvent.total) * 100;
            setPhotoUploadStatus(prev => ({ ...prev, upload_progress: progress }));
          }
        },
      });

      setProfileData(prev => ({
        ...prev,
        personal_info: {
          ...prev.personal_info,
          profile_photo_url: response.data.storage_url,
        },
      }));

      setPhotoUploadStatus({
        is_uploading: false,
        upload_progress: 100,
        preview_url: response.data.storage_url,
        crop_data: null,
        error_message: null,
      });
    } catch (error) {
      setPhotoUploadStatus(prev => ({
        ...prev,
        is_uploading: false,
        error_message: 'Failed to upload photo',
      }));
    }
  };

  const changePassword = async () => {
    try {
      if (passwordForm.new_password !== passwordForm.confirm_password) {
        setErrors({ password: ['Passwords do not match'] });
        return;
      }

      setLoading(true);
      await axios.post('/api/v1/auth/change-password', {
        current_password: passwordForm.current_password,
        new_password: passwordForm.new_password,
      });

      setPasswordForm({ current_password: '', new_password: '', confirm_password: '' });
      setErrors({});
    } catch (error) {
      setErrors({ password: ['Failed to change password'] });
    } finally {
      setLoading(false);
    }
  };

  const toggleTwoFactorAuth = async () => {
    try {
      if (profileData.security_settings.two_factor_enabled) {
        await axios.delete('/api/v1/auth/two-factor');
      } else {
        await axios.post('/api/v1/auth/two-factor/setup');
      }
      
      setProfileData(prev => ({
        ...prev,
        security_settings: {
          ...prev.security_settings,
          two_factor_enabled: !prev.security_settings.two_factor_enabled,
        },
      }));
    } catch (error) {
      console.error('Failed to toggle 2FA:', error);
    }
  };

  const updateNotificationPreferences = async () => {
    try {
      await dispatch(update_notification_preferences(profileData.notification_preferences));
      setEditMode(prev => ({ ...prev, notification_preferences: false }));
    } catch (error) {
      console.error('Failed to update notification preferences:', error);
    }
  };

  const manageAddresses = async (action: 'create' | 'update' | 'delete', addressUid?: string) => {
    try {
      if (action === 'create') {
        const response = await axios.post(`/api/v1/users/${profileData.personal_info.uid}/addresses`, addressForm);
        setAddressBook(prev => [...prev, response.data]);
      } else if (action === 'update' && addressUid) {
        const response = await axios.put(`/api/v1/addresses/${addressUid}`, addressForm);
        setAddressBook(prev => prev.map(addr => addr.uid === addressUid ? response.data : addr));
      } else if (action === 'delete' && addressUid) {
        await axios.delete(`/api/v1/addresses/${addressUid}`);
        setAddressBook(prev => prev.filter(addr => addr.uid !== addressUid));
      }
      
      setAddressForm({
        label: '', street_address: '', apartment_unit: '', city: '',
        state_province: '', postal_code: '', country: '', access_instructions: '', is_favorite: false,
      });
      setEditMode(prev => ({ ...prev, address_editing: null }));
    } catch (error) {
      console.error('Failed to manage address:', error);
    }
  };

  const updatePrivacySettings = async () => {
    try {
      await axios.put('/api/v1/auth/profile', { privacy_settings: profileData.privacy_settings });
      setEditMode(prev => ({ ...prev, privacy_settings: false }));
    } catch (error) {
      console.error('Failed to update privacy settings:', error);
    }
  };

  const verifyEmail = async () => {
    try {
      if (verificationCodes.email) {
        await axios.post('/api/v1/auth/verify-email/confirm', { verification_code: verificationCodes.email });
        setAccountVerification(prev => ({
          ...prev,
          email_verification: { ...prev.email_verification, is_verified: true },
        }));
      } else {
        await axios.post('/api/v1/auth/verify-email');
        setAccountVerification(prev => ({
          ...prev,
          email_verification: { ...prev.email_verification, verification_sent: true },
        }));
      }
    } catch (error) {
      console.error('Failed to verify email:', error);
    }
  };

  const verifyPhone = async () => {
    try {
      if (verificationCodes.phone) {
        await axios.post('/api/v1/auth/verify-phone/confirm', { verification_code: verificationCodes.phone });
        setAccountVerification(prev => ({
          ...prev,
          phone_verification: { ...prev.phone_verification, is_verified: true },
        }));
      } else {
        await axios.post('/api/v1/auth/verify-phone');
        setAccountVerification(prev => ({
          ...prev,
          phone_verification: { ...prev.phone_verification, verification_sent: true },
        }));
      }
    } catch (error) {
      console.error('Failed to verify phone:', error);
    }
  };

  const downloadDataExport = async () => {
    try {
      const response = await axios.post('/api/v1/users/export-data');
      window.open(response.data.download_url, '_blank');
    } catch (error) {
      console.error('Failed to generate data export:', error);
    }
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      uploadProfilePhoto(file);
    }
  };

  return (
    <>
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Profile Management</h1>
            <p className="text-gray-600 mt-2">Manage your account settings and preferences</p>
          </div>

          {/* Tab Navigation */}
          <div className="border-b border-gray-200 mb-8">
            <nav className="-mb-px flex space-x-8">
              {[
                { key: 'personal', label: 'Personal Info', icon: '👤' },
                { key: 'security', label: 'Security', icon: '🔒' },
                { key: 'addresses', label: 'Addresses', icon: '📍' },
                { key: 'notifications', label: 'Notifications', icon: '🔔' },
                { key: 'privacy', label: 'Privacy', icon: '🛡️' },
                ...(auth.user?.user_type === 'business_admin' ? [{ key: 'business', label: 'Business', icon: '🏢' }] : []),
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => handleTabChange(tab.key)}
                  className={`py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                    activeTab === tab.key
                      ? 'border-indigo-500 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <span className="mr-2">{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Tab Content */}
          <div className="bg-white rounded-lg shadow">
            {/* Personal Info Tab */}
            {activeTab === 'personal' && (
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold text-gray-900">Personal Information</h2>
                  <button
                    onClick={() => setEditMode(prev => ({ ...prev, personal_info: !prev.personal_info }))}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                  >
                    {editMode.personal_info ? 'Cancel' : 'Edit'}
                  </button>
                </div>

                {/* Profile Photo Section */}
                <div className="mb-8 text-center">
                  <div className="relative inline-block">
                    <img
                      src={profileData.personal_info.profile_photo_url}
                      alt="Profile"
                      className="w-32 h-32 rounded-full object-cover mx-auto"
                    />
                    {editMode.personal_info && (
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="absolute bottom-0 right-0 bg-indigo-600 text-white p-2 rounded-full hover:bg-indigo-700"
                        disabled={photoUploadStatus.is_uploading}
                      >
                        📷
                      </button>
                    )}
                  </div>
                  
                  {photoUploadStatus.is_uploading && (
                    <div className="mt-4">
                      <div className="bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-indigo-600 h-2 rounded-full transition-all"
                          style={{ width: `${photoUploadStatus.upload_progress}%` }}
                        ></div>
                      </div>
                      <p className="text-sm text-gray-600 mt-2">Uploading... {Math.round(photoUploadStatus.upload_progress)}%</p>
                    </div>
                  )}
                  
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </div>

                {/* Personal Details Form */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">First Name</label>
                    {editMode.personal_info ? (
                      <input
                        type="text"
                        value={profileData.personal_info.first_name}
                        onChange={(e) => setProfileData(prev => ({
                          ...prev,
                          personal_info: { ...prev.personal_info, first_name: e.target.value }
                        }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    ) : (
                      <p className="text-gray-900">{profileData.personal_info.first_name}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Last Name</label>
                    {editMode.personal_info ? (
                      <input
                        type="text"
                        value={profileData.personal_info.last_name}
                        onChange={(e) => setProfileData(prev => ({
                          ...prev,
                          personal_info: { ...prev.personal_info, last_name: e.target.value }
                        }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    ) : (
                      <p className="text-gray-900">{profileData.personal_info.last_name}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                    <div className="flex items-center space-x-2">
                      {editMode.personal_info ? (
                        <input
                          type="email"
                          value={profileData.personal_info.email}
                          onChange={(e) => setProfileData(prev => ({
                            ...prev,
                            personal_info: { ...prev.personal_info, email: e.target.value }
                          }))}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                        />
                      ) : (
                        <p className="text-gray-900 flex-1">{profileData.personal_info.email}</p>
                      )}
                      {accountVerification.email_verification.is_verified ? (
                        <span className="text-green-600 text-sm">✓ Verified</span>
                      ) : (
                        <button
                          onClick={verifyEmail}
                          className="text-indigo-600 text-sm hover:text-indigo-800"
                        >
                          {accountVerification.email_verification.verification_sent ? 'Resend' : 'Verify'}
                        </button>
                      )}
                    </div>
                    {accountVerification.email_verification.verification_sent && !accountVerification.email_verification.is_verified && (
                      <div className="mt-2">
                        <input
                          type="text"
                          placeholder="Enter verification code"
                          value={verificationCodes.email}
                          onChange={(e) => setVerificationCodes(prev => ({ ...prev, email: e.target.value }))}
                          className="w-32 px-2 py-1 border border-gray-300 rounded text-sm"
                        />
                        <button
                          onClick={verifyEmail}
                          className="ml-2 text-indigo-600 text-sm hover:text-indigo-800"
                        >
                          Confirm
                        </button>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
                    <div className="flex items-center space-x-2">
                      {editMode.personal_info ? (
                        <input
                          type="tel"
                          value={profileData.personal_info.phone}
                          onChange={(e) => setProfileData(prev => ({
                            ...prev,
                            personal_info: { ...prev.personal_info, phone: e.target.value }
                          }))}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                        />
                      ) : (
                        <p className="text-gray-900 flex-1">{profileData.personal_info.phone}</p>
                      )}
                      {accountVerification.phone_verification.is_verified ? (
                        <span className="text-green-600 text-sm">✓ Verified</span>
                      ) : (
                        <button
                          onClick={verifyPhone}
                          className="text-indigo-600 text-sm hover:text-indigo-800"
                        >
                          {accountVerification.phone_verification.verification_sent ? 'Resend' : 'Verify'}
                        </button>
                      )}
                    </div>
                    {accountVerification.phone_verification.verification_sent && !accountVerification.phone_verification.is_verified && (
                      <div className="mt-2">
                        <input
                          type="text"
                          placeholder="Enter SMS code"
                          value={verificationCodes.phone}
                          onChange={(e) => setVerificationCodes(prev => ({ ...prev, phone: e.target.value }))}
                          className="w-32 px-2 py-1 border border-gray-300 rounded text-sm"
                        />
                        <button
                          onClick={verifyPhone}
                          className="ml-2 text-indigo-600 text-sm hover:text-indigo-800"
                        >
                          Confirm
                        </button>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Language</label>
                    {editMode.personal_info ? (
                      <select
                        value={profileData.personal_info.preferred_language}
                        onChange={(e) => setProfileData(prev => ({
                          ...prev,
                          personal_info: { ...prev.personal_info, preferred_language: e.target.value }
                        }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                      >
                        <option value="en">English</option>
                        <option value="es">Spanish</option>
                        <option value="fr">French</option>
                        <option value="de">German</option>
                      </select>
                    ) : (
                      <p className="text-gray-900">{profileData.personal_info.preferred_language}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Timezone</label>
                    {editMode.personal_info ? (
                      <select
                        value={profileData.personal_info.timezone}
                        onChange={(e) => setProfileData(prev => ({
                          ...prev,
                          personal_info: { ...prev.personal_info, timezone: e.target.value }
                        }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                      >
                        <option value="UTC">UTC</option>
                        <option value="America/New_York">Eastern Time</option>
                        <option value="America/Chicago">Central Time</option>
                        <option value="America/Denver">Mountain Time</option>
                        <option value="America/Los_Angeles">Pacific Time</option>
                      </select>
                    ) : (
                      <p className="text-gray-900">{profileData.personal_info.timezone}</p>
                    )}
                  </div>
                </div>

                {editMode.personal_info && (
                  <div className="mt-6 flex justify-end space-x-3">
                    <button
                      onClick={() => setEditMode(prev => ({ ...prev, personal_info: false }))}
                      className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={updatePersonalInfo}
                      disabled={loading}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {loading ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Security Tab */}
            {activeTab === 'security' && (
              <div className="p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-6">Security Settings</h2>

                {/* Password Change Section */}
                <div className="mb-8 p-4 border border-gray-200 rounded-lg">
                  <h3 className="text-lg font-medium mb-4">Change Password</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Current Password</label>
                      <input
                        type="password"
                        value={passwordForm.current_password}
                        onChange={(e) => setPasswordForm(prev => ({ ...prev, current_password: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">New Password</label>
                      <input
                        type="password"
                        value={passwordForm.new_password}
                        onChange={(e) => setPasswordForm(prev => ({ ...prev, new_password: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Confirm New Password</label>
                      <input
                        type="password"
                        value={passwordForm.confirm_password}
                        onChange={(e) => setPasswordForm(prev => ({ ...prev, confirm_password: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>
                    {errors.password && (
                      <div className="text-red-600 text-sm">
                        {errors.password.map((error, idx) => <div key={idx}>{error}</div>)}
                      </div>
                    )}
                    <button
                      onClick={changePassword}
                      disabled={loading}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {loading ? 'Changing...' : 'Change Password'}
                    </button>
                  </div>
                </div>

                {/* Two-Factor Authentication */}
                <div className="mb-8 p-4 border border-gray-200 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-medium">Two-Factor Authentication</h3>
                      <p className="text-sm text-gray-600">Add an extra layer of security to your account</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={profileData.security_settings.two_factor_enabled}
                        onChange={toggleTwoFactorAuth}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                  </div>
                </div>

                {/* Login History */}
                <div className="p-4 border border-gray-200 rounded-lg">
                  <h3 className="text-lg font-medium mb-4">Recent Login Activity</h3>
                  <div className="space-y-3">
                    {profileData.security_settings.login_history.length === 0 ? (
                      <p className="text-gray-500">No recent login activity</p>
                    ) : (
                      profileData.security_settings.login_history.slice(0, 5).map((login, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                          <div>
                            <p className="text-sm font-medium">{login.device_info}</p>
                            <p className="text-xs text-gray-500">{login.location}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm">{new Date(login.login_time).toLocaleDateString()}</p>
                            <span className={`text-xs px-2 py-1 rounded ${
                              login.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {login.success ? 'Success' : 'Failed'}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Addresses Tab */}
            {activeTab === 'addresses' && (
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold text-gray-900">Address Book</h2>
                  <button
                    onClick={() => setEditMode(prev => ({ ...prev, address_editing: 'new' }))}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                  >
                    Add Address
                  </button>
                </div>

                {/* Address List */}
                <div className="space-y-4">
                  {addressBook.map((address) => (
                    <div key={address.uid} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <h3 className="font-medium">{address.label}</h3>
                            {address.is_favorite && <span className="text-yellow-500">⭐</span>}
                            {address.is_verified && <span className="text-green-600 text-sm">✓</span>}
                          </div>
                          <p className="text-gray-600 text-sm">
                            {address.street_address}
                            {address.apartment_unit && `, ${address.apartment_unit}`}
                          </p>
                          <p className="text-gray-600 text-sm">
                            {address.city}, {address.state_province} {address.postal_code}
                          </p>
                          {address.access_instructions && (
                            <p className="text-gray-500 text-xs mt-1">Access: {address.access_instructions}</p>
                          )}
                          <p className="text-gray-400 text-xs mt-2">Used {address.use_count} times</p>
                        </div>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => {
                              setAddressForm(address);
                              setEditMode(prev => ({ ...prev, address_editing: address.uid }));
                            }}
                            className="text-indigo-600 hover:text-indigo-800 text-sm"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => manageAddresses('delete', address.uid)}
                            className="text-red-600 hover:text-red-800 text-sm"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Address Form Modal */}
                {editMode.address_editing && (
                  <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 w-full max-w-md">
                      <h3 className="text-lg font-medium mb-4">
                        {editMode.address_editing === 'new' ? 'Add New Address' : 'Edit Address'}
                      </h3>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Label</label>
                          <input
                            type="text"
                            value={addressForm.label}
                            onChange={(e) => setAddressForm(prev => ({ ...prev, label: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                            placeholder="Home, Work, etc."
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Street Address</label>
                          <input
                            type="text"
                            value={addressForm.street_address}
                            onChange={(e) => setAddressForm(prev => ({ ...prev, street_address: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Apartment/Unit</label>
                          <input
                            type="text"
                            value={addressForm.apartment_unit}
                            onChange={(e) => setAddressForm(prev => ({ ...prev, apartment_unit: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                            <input
                              type="text"
                              value={addressForm.city}
                              onChange={(e) => setAddressForm(prev => ({ ...prev, city: e.target.value }))}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                            <input
                              type="text"
                              value={addressForm.state_province}
                              onChange={(e) => setAddressForm(prev => ({ ...prev, state_province: e.target.value }))}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Postal Code</label>
                            <input
                              type="text"
                              value={addressForm.postal_code}
                              onChange={(e) => setAddressForm(prev => ({ ...prev, postal_code: e.target.value }))}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
                            <input
                              type="text"
                              value={addressForm.country}
                              onChange={(e) => setAddressForm(prev => ({ ...prev, country: e.target.value }))}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Access Instructions</label>
                          <textarea
                            value={addressForm.access_instructions}
                            onChange={(e) => setAddressForm(prev => ({ ...prev, access_instructions: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                            rows={2}
                          />
                        </div>
                        <div className="flex items-center">
                          <input
                            type="checkbox"
                            checked={addressForm.is_favorite}
                            onChange={(e) => setAddressForm(prev => ({ ...prev, is_favorite: e.target.checked }))}
                            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded mr-2"
                          />
                          <label className="text-sm text-gray-700">Mark as favorite</label>
                        </div>
                      </div>
                      <div className="mt-6 flex justify-end space-x-3">
                        <button
                          onClick={() => setEditMode(prev => ({ ...prev, address_editing: null }))}
                          className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => manageAddresses(
                            editMode.address_editing === 'new' ? 'create' : 'update',
                            editMode.address_editing !== 'new' ? editMode.address_editing : undefined
                          )}
                          className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                        >
                          {editMode.address_editing === 'new' ? 'Add Address' : 'Update Address'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Notifications Tab */}
            {activeTab === 'notifications' && (
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold text-gray-900">Notification Preferences</h2>
                  <button
                    onClick={() => setEditMode(prev => ({ ...prev, notification_preferences: !prev.notification_preferences }))}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                  >
                    {editMode.notification_preferences ? 'Cancel' : 'Edit'}
                  </button>
                </div>

                <div className="space-y-6">
                  {/* Delivery Updates */}
                  <div className="border-b border-gray-200 pb-6">
                    <h3 className="text-lg font-medium mb-4">Delivery Updates</h3>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">Email Notifications</p>
                          <p className="text-sm text-gray-600">Receive delivery updates via email</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={profileData.notification_preferences.email_notifications}
                            onChange={(e) => setProfileData(prev => ({
                              ...prev,
                              notification_preferences: {
                                ...prev.notification_preferences,
                                email_notifications: e.target.checked
                              }
                            }))}
                            disabled={!editMode.notification_preferences}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600 peer-disabled:opacity-50"></div>
                        </label>
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">SMS Notifications</p>
                          <p className="text-sm text-gray-600">Receive delivery updates via SMS</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={profileData.notification_preferences.sms_notifications}
                            onChange={(e) => setProfileData(prev => ({
                              ...prev,
                              notification_preferences: {
                                ...prev.notification_preferences,
                                sms_notifications: e.target.checked
                              }
                            }))}
                            disabled={!editMode.notification_preferences}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600 peer-disabled:opacity-50"></div>
                        </label>
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">Push Notifications</p>
                          <p className="text-sm text-gray-600">Receive real-time push notifications</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={profileData.notification_preferences.push_notifications}
                            onChange={(e) => setProfileData(prev => ({
                              ...prev,
                              notification_preferences: {
                                ...prev.notification_preferences,
                                push_notifications: e.target.checked
                              }
                            }))}
                            disabled={!editMode.notification_preferences}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600 peer-disabled:opacity-50"></div>
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Do Not Disturb */}
                  <div className="border-b border-gray-200 pb-6">
                    <h3 className="text-lg font-medium mb-4">Do Not Disturb</h3>
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="font-medium">Enable Do Not Disturb</p>
                        <p className="text-sm text-gray-600">Set quiet hours for notifications</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={profileData.notification_preferences.do_not_disturb.enabled}
                          onChange={(e) => setProfileData(prev => ({
                            ...prev,
                            notification_preferences: {
                              ...prev.notification_preferences,
                              do_not_disturb: {
                                ...prev.notification_preferences.do_not_disturb,
                                enabled: e.target.checked
                              }
                            }
                          }))}
                          disabled={!editMode.notification_preferences}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600 peer-disabled:opacity-50"></div>
                      </label>
                    </div>

                    {profileData.notification_preferences.do_not_disturb.enabled && (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Start Time</label>
                          <input
                            type="time"
                            value={profileData.notification_preferences.do_not_disturb.start_time}
                            onChange={(e) => setProfileData(prev => ({
                              ...prev,
                              notification_preferences: {
                                ...prev.notification_preferences,
                                do_not_disturb: {
                                  ...prev.notification_preferences.do_not_disturb,
                                  start_time: e.target.value
                                }
                              }
                            }))}
                            disabled={!editMode.notification_preferences}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">End Time</label>
                          <input
                            type="time"
                            value={profileData.notification_preferences.do_not_disturb.end_time}
                            onChange={(e) => setProfileData(prev => ({
                              ...prev,
                              notification_preferences: {
                                ...prev.notification_preferences,
                                do_not_disturb: {
                                  ...prev.notification_preferences.do_not_disturb,
                                  end_time: e.target.value
                                }
                              }
                            }))}
                            disabled={!editMode.notification_preferences}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Marketing Communications */}
                  <div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Marketing Communications</p>
                        <p className="text-sm text-gray-600">Receive promotional offers and updates</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={profileData.notification_preferences.marketing_communications}
                          onChange={(e) => setProfileData(prev => ({
                            ...prev,
                            notification_preferences: {
                              ...prev.notification_preferences,
                              marketing_communications: e.target.checked
                            }
                          }))}
                          disabled={!editMode.notification_preferences}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600 peer-disabled:opacity-50"></div>
                      </label>
                    </div>
                  </div>
                </div>

                {editMode.notification_preferences && (
                  <div className="mt-6 flex justify-end space-x-3">
                    <button
                      onClick={() => setEditMode(prev => ({ ...prev, notification_preferences: false }))}
                      className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={updateNotificationPreferences}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                    >
                      Save Preferences
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Privacy Tab */}
            {activeTab === 'privacy' && (
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold text-gray-900">Privacy Settings</h2>
                  <button
                    onClick={() => setEditMode(prev => ({ ...prev, privacy_settings: !prev.privacy_settings }))}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                  >
                    {editMode.privacy_settings ? 'Cancel' : 'Edit'}
                  </button>
                </div>

                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Data Sharing Consent</p>
                      <p className="text-sm text-gray-600">Allow sharing data with partners for service improvement</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={profileData.privacy_settings.data_sharing_consent}
                        onChange={(e) => setProfileData(prev => ({
                          ...prev,
                          privacy_settings: {
                            ...prev.privacy_settings,
                            data_sharing_consent: e.target.checked
                          }
                        }))}
                        disabled={!editMode.privacy_settings}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600 peer-disabled:opacity-50"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Location Tracking</p>
                      <p className="text-sm text-gray-600">Allow location tracking for better delivery experience</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={profileData.privacy_settings.location_tracking}
                        onChange={(e) => setProfileData(prev => ({
                          ...prev,
                          privacy_settings: {
                            ...prev.privacy_settings,
                            location_tracking: e.target.checked
                          }
                        }))}
                        disabled={!editMode.privacy_settings}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600 peer-disabled:opacity-50"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Analytics Consent</p>
                      <p className="text-sm text-gray-600">Allow collection of usage analytics to improve our service</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={profileData.privacy_settings.analytics_consent}
                        onChange={(e) => setProfileData(prev => ({
                          ...prev,
                          privacy_settings: {
                            ...prev.privacy_settings,
                            analytics_consent: e.target.checked
                          }
                        }))}
                        disabled={!editMode.privacy_settings}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600 peer-disabled:opacity-50"></div>
                    </label>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Profile Visibility</label>
                    <select
                      value={profileData.privacy_settings.profile_visibility}
                      onChange={(e) => setProfileData(prev => ({
                        ...prev,
                        privacy_settings: {
                          ...prev.privacy_settings,
                          profile_visibility: e.target.value
                        }
                      }))}
                      disabled={!editMode.privacy_settings}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      <option value="private">Private</option>
                      <option value="limited">Limited</option>
                      <option value="public">Public</option>
                    </select>
                  </div>

                  <div className="border-t border-gray-200 pt-6">
                    <h3 className="text-lg font-medium mb-4">Data Export & Deletion</h3>
                    <div className="space-y-4">
                      <div>
                        <button
                          onClick={downloadDataExport}
                          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                        >
                          Download My Data
                        </button>
                        <p className="text-sm text-gray-600 mt-2">Download a copy of your personal data</p>
                      </div>
                      <div>
                        <button className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700">
                          Delete Account
                        </button>
                        <p className="text-sm text-gray-600 mt-2">Permanently delete your account and all associated data</p>
                      </div>
                    </div>
                  </div>
                </div>

                {editMode.privacy_settings && (
                  <div className="mt-6 flex justify-end space-x-3">
                    <button
                      onClick={() => setEditMode(prev => ({ ...prev, privacy_settings: false }))}
                      className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={updatePrivacySettings}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                    >
                      Save Privacy Settings
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Business Tab - Only visible for business admins */}
            {activeTab === 'business' && auth.user?.user_type === 'business_admin' && (
              <div className="p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-6">Business Account Settings</h2>

                <div className="space-y-8">
                  {/* Company Information */}
                  <div className="border border-gray-200 rounded-lg p-4">
                    <h3 className="text-lg font-medium mb-4">Company Information</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Company Name</label>
                        <input
                          type="text"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                          placeholder="Your Company Name"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Business Registration Number</label>
                        <input
                          type="text"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                          placeholder="Registration Number"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Tax ID</label>
                        <input
                          type="text"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                          placeholder="Tax Identification Number"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Industry Type</label>
                        <select className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500">
                          <option value="">Select Industry</option>
                          <option value="retail">Retail</option>
                          <option value="healthcare">Healthcare</option>
                          <option value="technology">Technology</option>
                          <option value="manufacturing">Manufacturing</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Quick Links */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="border border-gray-200 rounded-lg p-4">
                      <h3 className="text-lg font-medium mb-4">Team Management</h3>
                      <p className="text-gray-600 mb-4">Manage team members, roles, and permissions</p>
                      <Link
                        to="/team"
                        className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                      >
                        Manage Team →
                      </Link>
                    </div>

                    <div className="border border-gray-200 rounded-lg p-4">
                      <h3 className="text-lg font-medium mb-4">Analytics & Reports</h3>
                      <p className="text-gray-600 mb-4">View delivery analytics and cost optimization</p>
                      <Link
                        to="/analytics"
                        className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                      >
                        View Analytics →
                      </Link>
                    </div>
                  </div>

                  {/* API Access */}
                  <div className="border border-gray-200 rounded-lg p-4">
                    <h3 className="text-lg font-medium mb-4">API Integration</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">API Key</label>
                        <div className="flex items-center space-x-2">
                          <input
                            type="password"
                            value="qd_live_xxxxxxxxxxxxxxxxxx"
                            readOnly
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
                          />
                          <button className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700">
                            Regenerate
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Webhook URL</label>
                        <input
                          type="url"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                          placeholder="https://your-domain.com/webhook"
                        />
                      </div>
                    </div>
                    <div className="mt-4">
                      <a
                        href="#"
                        className="text-indigo-600 hover:text-indigo-800 text-sm"
                      >
                        View API Documentation →
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default UV_Profile;