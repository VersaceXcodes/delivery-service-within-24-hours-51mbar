import React, { useState, useEffect, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { RootState, AppDispatch, add_global_error, update_last_activity } from '@/store/main';

interface PaymentMethod {
  uid: string;
  type: string;
  provider: string;
  last_four_digits: string;
  expiry_month: number;
  expiry_year: number;
  cardholder_name: string;
  billing_address_uid: string;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
}

interface BillingAddress {
  uid: string;
  label: string;
  street_address: string;
  city: string;
  state_province: string;
  postal_code: string;
  country: string;
  is_default: boolean;
}

interface AddPaymentForm {
  payment_type: string;
  card_number: string;
  expiry_month: string;
  expiry_year: string;
  cvv: string;
  cardholder_name: string;
  billing_address_uid: string | null;
  save_for_future: boolean;
  set_as_default: boolean;
  validation_errors: Record<string, string>;
  is_processing: boolean;
}

interface VerificationStatus {
  pending_verifications: string[];
  failed_verifications: string[];
  verification_in_progress: boolean;
  three_d_secure_required: boolean;
  verification_attempts: number;
}

interface SecuritySettings {
  fraud_protection_enabled: boolean;
  transaction_alerts: boolean;
  spending_limits: Record<string, number>;
  trusted_devices: string[];
  two_factor_enabled: boolean;
}

const UV_PaymentMethods: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { user, session } = useSelector((state: RootState) => state.auth);
  const { currency } = useSelector((state: RootState) => state.app_settings);
  const { global_errors } = useSelector((state: RootState) => state.error);

  // Local State
  const [payment_methods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [default_payment_method, setDefaultPaymentMethod] = useState<PaymentMethod | null>(null);
  const [billing_addresses, setBillingAddresses] = useState<BillingAddress[]>([]);
  const [security_settings, setSecuritySettings] = useState<SecuritySettings>({
    fraud_protection_enabled: true,
    transaction_alerts: true,
    spending_limits: {},
    trusted_devices: [],
    two_factor_enabled: false
  });
  const [verification_status, setVerificationStatus] = useState<VerificationStatus>({
    pending_verifications: [],
    failed_verifications: [],
    verification_in_progress: false,
    three_d_secure_required: false,
    verification_attempts: 0
  });

  const [add_payment_form, setAddPaymentForm] = useState<AddPaymentForm>({
    payment_type: 'credit_card',
    card_number: '',
    expiry_month: '',
    expiry_year: '',
    cvv: '',
    cardholder_name: '',
    billing_address_uid: null,
    save_for_future: true,
    set_as_default: false,
    validation_errors: {},
    is_processing: false
  });

  // UI State
  const [activeTab, setActiveTab] = useState<'methods' | 'security' | 'billing' | 'history'>('methods');
  const [showAddForm, setShowAddForm] = useState(false);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string | null>(null);
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);

  // URL Parameters
  const urlParams = new URLSearchParams(window.location.search);
  const addMethodParam = urlParams.get('add_method');
  const editMethodParam = urlParams.get('edit_method');
  const setDefaultParam = urlParams.get('set_default');

  // API Functions
  const loadPaymentMethods = useCallback(async () => {
    if (!session?.access_token) return;
    
    try {
      setLoading(true);
      const response = await axios.get('/api/v1/payment-methods', {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });
      setPaymentMethods(response.data || []);
      
      const defaultMethod = response.data?.find((method: PaymentMethod) => method.is_default);
      setDefaultPaymentMethod(defaultMethod || null);
      
      dispatch(update_last_activity());
    } catch (error: any) {
      dispatch(add_global_error({
        error_id: `payment_methods_load_${Date.now()}`,
        type: 'server',
        message: 'Failed to load payment methods',
        technical_details: error.message,
        timestamp: new Date().toISOString(),
        user_action_required: false,
        retry_available: true,
        escalation_needed: false
      }));
    } finally {
      setLoading(false);
    }
  }, [dispatch, session?.access_token]);

  const loadBillingAddresses = useCallback(async () => {
    if (!user?.uid || !session?.access_token) return;
    
    try {
      const response = await axios.get(`/api/v1/users/${user.uid}/addresses`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });
      setBillingAddresses(response.data || []);
    } catch (error: any) {
      console.error('Failed to load billing addresses:', error);
    }
  }, [user?.uid, session?.access_token]);

  const loadRecentTransactions = useCallback(async () => {
    if (!session?.access_token) return;
    
    try {
      const response = await axios.get('/api/v1/transactions', { 
        params: { limit: 10, page: 1 },
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });
      setRecentTransactions(response.data.transactions || []);
    } catch (error: any) {
      console.error('Failed to load transactions:', error);
    }
  }, [session?.access_token]);

  const validateCardDetails = (field: string, value: string): string => {
    switch (field) {
      case 'card_number':
        const cleaned = value.replace(/\D/g, '');
        if (cleaned.length < 13) return 'Card number must be at least 13 digits';
        if (cleaned.length > 19) return 'Card number cannot exceed 19 digits';
        return '';
      case 'expiry_month':
        const month = parseInt(value, 10);
        if (month < 1 || month > 12) return 'Invalid month';
        return '';
      case 'expiry_year':
        const year = parseInt(value, 10);
        const currentYear = new Date().getFullYear();
        if (year < currentYear) return 'Card is expired';
        if (year > currentYear + 20) return 'Invalid expiry year';
        return '';
      case 'cvv':
        if (value.length < 3 || value.length > 4) return 'CVV must be 3-4 digits';
        return '';
      case 'cardholder_name':
        if (value.length < 2) return 'Cardholder name is required';
        return '';
      default:
        return '';
    }
  };

  const addPaymentMethod = async (formData: AddPaymentForm) => {
    if (!session?.access_token) return;
    
    try {
      setAddPaymentForm(prev => ({ ...prev, is_processing: true, validation_errors: {} }));
      
      // Validate all fields
      const errors: Record<string, string> = {};
      const fieldsToValidate = ['card_number', 'expiry_month', 'expiry_year', 'cvv', 'cardholder_name'];
      
      fieldsToValidate.forEach(field => {
        const error = validateCardDetails(field, (formData as any)[field]);
        if (error) errors[field] = error;
      });
      
      if (Object.keys(errors).length > 0) {
        setAddPaymentForm(prev => ({ ...prev, validation_errors: errors, is_processing: false }));
        return;
      }
      
      // Simulate tokenization (in real implementation, this would use Stripe.js)
      const response = await axios.post('/api/v1/payment-methods', {
        type: formData.payment_type,
        provider: 'stripe',
        provider_payment_method_id: `pm_${Date.now()}`, // Mock token
        last_four_digits: formData.card_number.slice(-4),
        expiry_month: parseInt(formData.expiry_month, 10),
        expiry_year: parseInt(formData.expiry_year, 10),
        cardholder_name: formData.cardholder_name,
        billing_address_uid: formData.billing_address_uid,
        is_default: formData.set_as_default
      }, {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      await loadPaymentMethods();
      setShowAddForm(false);
      setAddPaymentForm({
        payment_type: 'credit_card',
        card_number: '',
        expiry_month: '',
        expiry_year: '',
        cvv: '',
        cardholder_name: '',
        billing_address_uid: null,
        save_for_future: true,
        set_as_default: false,
        validation_errors: {},
        is_processing: false
      });
    } catch (error: any) {
      dispatch(add_global_error({
        error_id: `payment_method_add_${Date.now()}`,
        type: 'server',
        message: 'Failed to add payment method',
        technical_details: error.message,
        timestamp: new Date().toISOString(),
        user_action_required: true,
        retry_available: true,
        escalation_needed: false
      }));
    } finally {
      setAddPaymentForm(prev => ({ ...prev, is_processing: false }));
    }
  };

  const setDefaultPaymentMethodHandler = async (paymentMethodUid: string) => {
    if (!session?.access_token) return;
    
    try {
      await axios.put(`/api/v1/payment-methods/${paymentMethodUid}`, {
        is_default: true
      }, {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });
      await loadPaymentMethods();
    } catch (error: any) {
      dispatch(add_global_error({
        error_id: `payment_method_default_${Date.now()}`,
        type: 'server',
        message: 'Failed to set default payment method',
        technical_details: error.message,
        timestamp: new Date().toISOString(),
        user_action_required: false,
        retry_available: true,
        escalation_needed: false
      }));
    }
  };

  const removePaymentMethod = async (paymentMethodUid: string) => {
    if (!confirm('Are you sure you want to remove this payment method?')) return;
    if (!session?.access_token) return;
    
    try {
      await axios.delete(`/api/v1/payment-methods/${paymentMethodUid}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });
      await loadPaymentMethods();
    } catch (error: any) {
      dispatch(add_global_error({
        error_id: `payment_method_remove_${Date.now()}`,
        type: 'server',
        message: 'Failed to remove payment method',
        technical_details: error.message,
        timestamp: new Date().toISOString(),
        user_action_required: false,
        retry_available: true,
        escalation_needed: false
      }));
    }
  };

  // Effects
  useEffect(() => {
    if (session?.access_token) {
      loadPaymentMethods();
      loadBillingAddresses();
      loadRecentTransactions();
    }
  }, [session?.access_token, loadPaymentMethods, loadBillingAddresses, loadRecentTransactions]);

  useEffect(() => {
    if (addMethodParam === 'true') {
      setShowAddForm(true);
    }
    if (editMethodParam) {
      setSelectedPaymentMethod(editMethodParam);
      // TODO: Implement edit functionality
    }
    if (setDefaultParam) {
      setDefaultPaymentMethodHandler(setDefaultParam);
    }
  }, [addMethodParam, editMethodParam, setDefaultParam]);

  // Helper Functions
  const formatCardNumber = (number: string) => {
    const cleaned = number.replace(/\D/g, '');
    return cleaned.replace(/(\d{4})(?=\\d)/g, '$1 ');
  };

  const getCardBrand = (number: string) => {
    const cleaned = number.replace(/\D/g, '');
    if (cleaned.startsWith('4')) return 'Visa';
    if (cleaned.startsWith('5') || cleaned.startsWith('2')) return 'Mastercard';
    if (cleaned.startsWith('3')) return 'American Express';
    return 'Card';
  };

  const formatExpiryDate = (month: string, year: string) => {
    return `${month.padStart(2, '0')}/${year.slice(-2)}`;
  };

  return (
    <>
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Payment Methods</h1>
                <p className="mt-2 text-gray-600">Manage your payment methods and billing information</p>
              </div>
              <div className="flex space-x-4">
                <button
                  onClick={() => setShowAddForm(true)}
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Add Payment Method
                </button>
              </div>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="border-b border-gray-200 mb-8">
            <nav className="-mb-px flex space-x-8">
              {[
                { id: 'methods', label: 'Payment Methods', icon: '💳' },
                { id: 'security', label: 'Security', icon: '🔒' },
                { id: 'billing', label: 'Billing', icon: '📋' },
                { id: 'history', label: 'Transaction History', icon: '📊' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
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

          {/* Loading State */}
          {loading && (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-gray-600">Loading payment methods...</span>
            </div>
          )}

          {/* Payment Methods Tab */}
          {activeTab === 'methods' && !loading && (
            <div className="space-y-6">
              {/* Default Payment Method */}
              {default_payment_method && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                  <h3 className="text-lg font-medium text-blue-900 mb-4">Default Payment Method</h3>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded text-white text-xs flex items-center justify-center font-bold">
                        {getCardBrand(default_payment_method.last_four_digits)}
                      </div>
                      <div>
                        <p className="font-medium">**** **** **** {default_payment_method.last_four_digits}</p>
                        <p className="text-sm text-gray-600">
                          {default_payment_method.cardholder_name} • Expires {formatExpiryDate(default_payment_method.expiry_month.toString(), default_payment_method.expiry_year.toString())}
                        </p>
                      </div>
                    </div>
                    <span className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded">
                      ✓ Verified
                    </span>
                  </div>
                </div>
              )}

              {/* Payment Methods List */}
              <div className="bg-white rounded-lg shadow">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">Saved Payment Methods</h3>
                </div>
                <div className="divide-y divide-gray-200">
                  {payment_methods.length === 0 ? (
                    <div className="px-6 py-12 text-center">
                      <div className="text-gray-400 text-6xl mb-4">💳</div>
                      <h3 className="text-lg font-medium text-gray-900 mb-2">No payment methods found</h3>
                      <p className="text-gray-600 mb-6">Add a payment method to start making deliveries</p>
                      <button
                        onClick={() => setShowAddForm(true)}
                        className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        Add Your First Payment Method
                      </button>
                    </div>
                  ) : (
                    payment_methods.map((method) => (
                      <div key={method.uid} className="px-6 py-4 flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div className="w-12 h-8 bg-gradient-to-r from-gray-600 to-gray-800 rounded text-white text-xs flex items-center justify-center font-bold">
                            {getCardBrand(method.last_four_digits).slice(0, 4)}
                          </div>
                          <div>
                            <p className="font-medium">**** **** **** {method.last_four_digits}</p>
                            <p className="text-sm text-gray-600">
                              {method.cardholder_name} • Expires {formatExpiryDate(method.expiry_month.toString(), method.expiry_year.toString())}
                            </p>
                          </div>
                          {method.is_default && (
                            <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded">
                              Default
                            </span>
                          )}
                        </div>
                        <div className="flex items-center space-x-2">
                          {!method.is_default && (
                            <button
                              onClick={() => setDefaultPaymentMethodHandler(method.uid)}
                              className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                            >
                              Set Default
                            </button>
                          )}
                          <button
                            onClick={() => removePaymentMethod(method.uid)}
                            className="text-red-600 hover:text-red-700 text-sm font-medium"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Digital Wallets */}
              <div className="bg-white rounded-lg shadow">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">Digital Wallets</h3>
                </div>
                <div className="p-6 space-y-4">
                  {[
                    { name: 'PayPal', icon: '🏦', status: 'Not Connected', color: 'gray' },
                    { name: 'Apple Pay', icon: '🍎', status: 'Not Connected', color: 'gray' },
                    { name: 'Google Pay', icon: '🎯', status: 'Not Connected', color: 'gray' }
                  ].map((wallet) => (
                    <div key={wallet.name} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <span className="text-2xl">{wallet.icon}</span>
                        <div>
                          <p className="font-medium">{wallet.name}</p>
                          <p className="text-sm text-gray-600">{wallet.status}</p>
                        </div>
                      </div>
                      <button className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors">
                        Connect
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Security Tab */}
          {activeTab === 'security' && (
            <div className="space-y-6">
              {/* Security Overview */}
              <div className="bg-white rounded-lg shadow">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">Security Settings</h3>
                </div>
                <div className="p-6 space-y-6">
                  {/* Fraud Protection */}
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-gray-900">Fraud Protection</h4>
                      <p className="text-sm text-gray-600">Advanced fraud detection and monitoring</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={security_settings.fraud_protection_enabled}
                        onChange={(e) => setSecuritySettings(prev => ({ ...prev, fraud_protection_enabled: e.target.checked }))}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>

                  {/* Transaction Alerts */}
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-gray-900">Transaction Alerts</h4>
                      <p className="text-sm text-gray-600">Get notified of payment activity</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={security_settings.transaction_alerts}
                        onChange={(e) => setSecuritySettings(prev => ({ ...prev, transaction_alerts: e.target.checked }))}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>

                  {/* Two-Factor Authentication */}
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-gray-900">Two-Factor Authentication</h4>
                      <p className="text-sm text-gray-600">Add extra security to payment actions</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={security_settings.two_factor_enabled}
                        onChange={(e) => setSecuritySettings(prev => ({ ...prev, two_factor_enabled: e.target.checked }))}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                </div>
              </div>

              {/* Security Badges */}
              <div className="bg-white rounded-lg shadow">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">Security Certifications</h3>
                </div>
                <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                  {[
                    { name: 'PCI DSS Compliant', icon: '🛡️', description: 'Payment card industry data security standard' },
                    { name: 'SSL Encrypted', icon: '🔒', description: '256-bit SSL encryption for all transactions' },
                    { name: 'Fraud Protected', icon: '🛡️', description: 'Advanced fraud detection and prevention' }
                  ].map((badge) => (
                    <div key={badge.name} className="text-center p-4 border border-gray-200 rounded-lg">
                      <div className="text-3xl mb-2">{badge.icon}</div>
                      <h4 className="font-medium text-gray-900 mb-1">{badge.name}</h4>
                      <p className="text-sm text-gray-600">{badge.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Billing Tab */}
          {activeTab === 'billing' && (
            <div className="space-y-6">
              {/* Billing Addresses */}
              <div className="bg-white rounded-lg shadow">
                <div className="px-6 py-4 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium text-gray-900">Billing Addresses</h3>
                    <button
                      onClick={() => setShowAddressForm(true)}
                      className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Add Address
                    </button>
                  </div>
                </div>
                <div className="divide-y divide-gray-200">
                  {billing_addresses.length === 0 ? (
                    <div className="px-6 py-8 text-center">
                      <p className="text-gray-600">No billing addresses found</p>
                    </div>
                  ) : (
                    billing_addresses.map((address) => (
                      <div key={address.uid} className="px-6 py-4 flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900">{address.label}</p>
                          <p className="text-sm text-gray-600">
                            {address.street_address}, {address.city}, {address.state_province} {address.postal_code}
                          </p>
                        </div>
                        {address.is_default && (
                          <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded">
                            Default
                          </span>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Business Settings */}
              {user?.user_type === 'business_admin' && (
                <div className="bg-white rounded-lg shadow">
                  <div className="px-6 py-4 border-b border-gray-200">
                    <h3 className="text-lg font-medium text-gray-900">Business Settings</h3>
                  </div>
                  <div className="p-6 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Tax ID</label>
                      <input
                        type="text"
                        placeholder="Enter business tax ID"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Delivery</label>
                      <select className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="email">Email</option>
                        <option value="mail">Mail</option>
                        <option value="both">Both</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Transaction History Tab */}
          {activeTab === 'history' && (
            <div className="space-y-6">
              <div className="bg-white rounded-lg shadow">
                <div className="px-6 py-4 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium text-gray-900">Recent Transactions</h3>
                    <Link
                      to="/billing"
                      className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                    >
                      View All Transactions →
                    </Link>
                  </div>
                </div>
                <div className="divide-y divide-gray-200">
                  {recentTransactions.length === 0 ? (
                    <div className="px-6 py-8 text-center">
                      <p className="text-gray-600">No recent transactions found</p>
                    </div>
                  ) : (
                    recentTransactions.slice(0, 5).map((transaction, index) => (
                      <div key={index} className="px-6 py-4 flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900">
                            Delivery Payment #{`QD${Date.now().toString().slice(-6)}`}
                          </p>
                          <p className="text-sm text-gray-600">
                            {new Date().toLocaleDateString()} • Card ending in 4242
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-gray-900">{currency}{(Math.random() * 50 + 10).toFixed(2)}</p>
                          <span className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded">
                            Completed
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add Payment Method Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full max-h-screen overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-medium text-gray-900">Add Payment Method</h3>
                <button
                  onClick={() => setShowAddForm(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={(e) => {
                e.preventDefault();
                addPaymentMethod(add_payment_form);
              }} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Card Number</label>
                  <input
                    type="text"
                    value={formatCardNumber(add_payment_form.card_number)}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '');
                      setAddPaymentForm(prev => ({ ...prev, card_number: value }));
                    }}
                    placeholder="1234 5678 9012 3456"
                    className={`w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      add_payment_form.validation_errors.card_number ? 'border-red-300' : 'border-gray-300'
                    }`}
                  />
                  {add_payment_form.validation_errors.card_number && (
                    <p className="text-red-600 text-xs mt-1">{add_payment_form.validation_errors.card_number}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Expiry Month</label>
                    <select
                      value={add_payment_form.expiry_month}
                      onChange={(e) => setAddPaymentForm(prev => ({ ...prev, expiry_month: e.target.value }))}
                      className={`w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        add_payment_form.validation_errors.expiry_month ? 'border-red-300' : 'border-gray-300'
                      }`}
                    >
                      <option value="">Month</option>
                      {Array.from({ length: 12 }, (_, i) => (
                        <option key={i + 1} value={i + 1}>{(i + 1).toString().padStart(2, '0')}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Expiry Year</label>
                    <select
                      value={add_payment_form.expiry_year}
                      onChange={(e) => setAddPaymentForm(prev => ({ ...prev, expiry_year: e.target.value }))}
                      className={`w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        add_payment_form.validation_errors.expiry_year ? 'border-red-300' : 'border-gray-300'
                      }`}
                    >
                      <option value="">Year</option>
                      {Array.from({ length: 20 }, (_, i) => {
                        const year = new Date().getFullYear() + i;
                        return <option key={year} value={year}>{year}</option>;
                      })}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">CVV</label>
                  <input
                    type="text"
                    value={add_payment_form.cvv}
                    onChange={(e) => setAddPaymentForm(prev => ({ ...prev, cvv: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
                    placeholder="123"
                    className={`w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      add_payment_form.validation_errors.cvv ? 'border-red-300' : 'border-gray-300'
                    }`}
                  />
                  {add_payment_form.validation_errors.cvv && (
                    <p className="text-red-600 text-xs mt-1">{add_payment_form.validation_errors.cvv}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cardholder Name</label>
                  <input
                    type="text"
                    value={add_payment_form.cardholder_name}
                    onChange={(e) => setAddPaymentForm(prev => ({ ...prev, cardholder_name: e.target.value }))}
                    placeholder="John Doe"
                    className={`w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      add_payment_form.validation_errors.cardholder_name ? 'border-red-300' : 'border-gray-300'
                    }`}
                  />
                  {add_payment_form.validation_errors.cardholder_name && (
                    <p className="text-red-600 text-xs mt-1">{add_payment_form.validation_errors.cardholder_name}</p>
                  )}
                </div>

                <div className="flex items-center space-x-4">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={add_payment_form.set_as_default}
                      onChange={(e) => setAddPaymentForm(prev => ({ ...prev, set_as_default: e.target.checked }))}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">Set as default</span>
                  </label>
                </div>

                <div className="flex space-x-4 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={add_payment_form.is_processing}
                    className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {add_payment_form.is_processing ? 'Adding...' : 'Add Payment Method'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default UV_PaymentMethods;