import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Link, useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { RootState } from '@/store/main';
import { 
  add_global_error, 
  add_view_error, 
  clear_view_errors,
  add_toast_notification 
} from '@/store/main';

interface RouteParams {
  template_id?: string;
}

interface PackageDetail {
  package_number: number;
  description: string;
  category: string;
  size: string;
  weight: number;
  dimensions: string;
  value: number;
  is_fragile: boolean;
  special_instructions: string;
  insurance_coverage: number;
  package_photo_urls: string; // Backend expects comma-separated string
}

interface AddressData {
  uid?: string;
  address_uid?: string;
  street_address: string;
  apartment_unit?: string;
  city: string;
  state_province?: string;
  postal_code?: string;
  country: string;
  latitude?: number;
  longitude?: number;
  access_instructions?: string;
  contact_person?: string;
  contact_phone?: string;
  is_verified?: boolean;
}

interface PricingEstimate {
  base_price: number;
  distance_price: number;
  package_price: number;
  surge_multiplier: number;
  priority_surcharge: number;
  insurance_cost: number;
  tax_amount: number;
  discount_amount: number;
  total_price: number;
  currency: string;
}

interface FormValidation {
  pickup_errors: string[];
  delivery_errors: string[];
  package_errors: string[];
  payment_errors: string[];
  is_valid: boolean;
}

const UV_DeliveryRequest: React.FC = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { template_id } = useParams<RouteParams>();
  const [searchParams] = useSearchParams();
  
  // Global state access
  const authState = useSelector((state: RootState) => state.auth);
  const appSettings = useSelector((state: RootState) => state.app_settings);
  const errorState = useSelector((state: RootState) => state.error);

  // URL parameters
  const quickSend = searchParams.get('quick_send') === 'true';
  const addressId = searchParams.get('address_id');
  const recipientId = searchParams.get('recipient_id');
  const businessAccount = searchParams.get('business_account') === 'true';

  // State variables as defined in the architecture
  const [requestStep, setRequestStep] = useState<number>(1);
  const [pickupLocation, setPickupLocation] = useState<AddressData | null>(null);
  const [deliveryLocation, setDeliveryLocation] = useState<AddressData | null>(null);
  const [packageDetails, setPackageDetails] = useState<PackageDetail[]>([{
    package_number: 1,
    description: "",
    category: "other",
    size: "medium",
    weight: 0,
    dimensions: "",
    value: 0,
    is_fragile: false,
    special_instructions: "",
    insurance_coverage: 0,
    package_photo_urls: "" // String as per backend schema
  }]);
  const [schedulingPreferences, setSchedulingPreferences] = useState<any>({
    delivery_type: "standard",
    scheduled_pickup_time: null,
    delivery_time_window: null,
    priority_level: 1,
    recurring_schedule: null,
    special_requirements: []
  });
  const [pricingEstimate, setPricingEstimate] = useState<PricingEstimate>({
    base_price: 0,
    distance_price: 0,
    package_price: 0,
    surge_multiplier: 1,
    priority_surcharge: 0,
    insurance_cost: 0,
    tax_amount: 0,
    discount_amount: 0,
    total_price: 0,
    currency: "USD"
  });
  const [paymentMethod, setPaymentMethod] = useState<any>(null);
  const [courierMatching, setCourierMatching] = useState<any>({
    available_couriers: [],
    estimated_pickup_time: null,
    matching_in_progress: false,
    assignment_timeout: 300
  });
  const [formValidation, setFormValidation] = useState<FormValidation>({
    pickup_errors: [],
    delivery_errors: [],
    package_errors: [],
    payment_errors: [],
    is_valid: false
  });

  // Additional state for UI management
  const [loading, setLoading] = useState<boolean>(false);
  const [savedAddresses, setSavedAddresses] = useState<AddressData[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [uploadingPhotos, setUploadingPhotos] = useState<boolean>(false);
  const [promotionalCode, setPromotionalCode] = useState<string>("");
  const [recipientInfo, setRecipientInfo] = useState<any>({
    name: "",
    phone: "",
    email: "",
    special_instructions: ""
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle API errors consistently
  const handleApiError = useCallback((error: any, operation: string) => {
    console.error(`${operation} failed:`, error);
    dispatch(add_view_error({
      view_id: 'UV_DeliveryRequest',
      error: {
        error_id: `${operation.toLowerCase()}_${Date.now()}`,
        type: 'network',
        message: `Failed to ${operation.toLowerCase()}`,
        technical_details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        user_action_required: true,
        retry_available: true,
        escalation_needed: false
      }
    }));
  }, [dispatch]);

  // API call functions
  const fetchSavedAddresses = useCallback(async () => {
    try {
      if (!authState.user?.uid || !authState.session?.access_token) return;
      
      const response = await fetch(`/api/v1/users/${authState.user.uid}/addresses`, {
        headers: {
          'Authorization': `Bearer ${authState.session.access_token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setSavedAddresses(data);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch addresses');
      }
    } catch (error) {
      handleApiError(error, 'Fetch saved addresses');
    }
  }, [authState.user?.uid, authState.session?.access_token, handleApiError]);

  const fetchPaymentMethods = useCallback(async () => {
    try {
      if (!authState.session?.access_token) return;

      const response = await fetch('/api/v1/payment-methods', {
        headers: {
          'Authorization': `Bearer ${authState.session.access_token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setPaymentMethods(data);
        if (data.length > 0) {
          const defaultMethod = data.find((method: any) => method.is_default) || data[0];
          setPaymentMethod(defaultMethod);
        }
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch payment methods');
      }
    } catch (error) {
      handleApiError(error, 'Fetch payment methods');
    }
  }, [authState.session?.access_token, handleApiError]);

  const loadDeliveryTemplate = useCallback(async (templateId: string) => {
    try {
      if (!authState.session?.access_token) return;

      // This would be the actual template loading logic
      console.log('Loading template:', templateId);
      // TODO: Implement template loading API call when available
    } catch (error) {
      handleApiError(error, 'Load delivery template');
    }
  }, [authState.session?.access_token, handleApiError]);

  const geocodeAddress = useCallback(async (address: Partial<AddressData>): Promise<{ success: boolean; latitude?: number; longitude?: number; is_valid: boolean; formatted_address?: string }> => {
    try {
      const addressString = `${address.street_address}, ${address.city}, ${address.state_province || ''} ${address.postal_code || ''}`.trim();
      
      // TODO: Integrate with actual Google Maps Geocoding API
      // For now, mock the response
      const mockResponse = {
        success: true,
        latitude: 40.7589 + (Math.random() - 0.5) * 0.1,
        longitude: -73.9851 + (Math.random() - 0.5) * 0.1,
        formatted_address: addressString,
        is_valid: Boolean(address.street_address && address.city)
      };
      
      return mockResponse;
    } catch (error) {
      console.error('Geocoding failed:', error);
      return { success: false, is_valid: false };
    }
  }, []);

  const calculatePricing = useCallback(async () => {
    if (!pickupLocation || !deliveryLocation || !authState.session?.access_token) return;

    try {
      setLoading(true);
      
      const requestData = {
        pickup_location: {
          latitude: pickupLocation.latitude,
          longitude: pickupLocation.longitude
        },
        delivery_location: {
          latitude: deliveryLocation.latitude,
          longitude: deliveryLocation.longitude
        },
        packages: packageDetails.map(pkg => ({
          size: pkg.size,
          weight: pkg.weight
        })),
        delivery_type: schedulingPreferences.delivery_type,
        scheduled_pickup_time: schedulingPreferences.scheduled_pickup_time
      };

      const response = await fetch('/api/v1/pricing/estimate', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authState.session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData)
      });

      if (response.ok) {
        const data = await response.json();
        setPricingEstimate({
          base_price: data.base_price || 5.0,
          distance_price: data.distance_price || Math.random() * 20 + 5,
          package_price: packageDetails.length * 2.5,
          surge_multiplier: data.surge_multiplier || 1.0,
          priority_surcharge: schedulingPreferences.priority_level > 1 ? 10 : 0,
          insurance_cost: packageDetails.reduce((sum, pkg) => sum + (pkg.insurance_coverage || 0), 0) * 0.01,
          tax_amount: 0,
          discount_amount: 0,
          total_price: data.total_price || 25.50,
          currency: appSettings.currency || "USD"
        });
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Pricing calculation failed');
      }
    } catch (error) {
      handleApiError(error, 'Calculate pricing');
    } finally {
      setLoading(false);
    }
  }, [pickupLocation, deliveryLocation, packageDetails, schedulingPreferences, authState.session?.access_token, appSettings.currency, handleApiError]);

  const uploadPackagePhoto = useCallback(async (file: File, packageIndex: number) => {
    try {
      if (!authState.session?.access_token) return;

      setUploadingPhotos(true);
      
      const formData = new FormData();
      formData.append('file', file);
      formData.append('entity_type', 'package');
      formData.append('entity_uid', `package_${packageIndex}`);
      formData.append('upload_purpose', 'package_photo');

      const response = await fetch('/api/v1/files/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authState.session.access_token}`,
        },
        body: formData
      });

      if (response.ok) {
        const data = await response.json();
        const updatedPackages = [...packageDetails];
        const existingUrls = updatedPackages[packageIndex].package_photo_urls;
        const newUrls = existingUrls ? `${existingUrls},${data.storage_url}` : data.storage_url;
        updatedPackages[packageIndex].package_photo_urls = newUrls;
        setPackageDetails(updatedPackages);
        
        dispatch(add_toast_notification({
          uid: `photo_upload_${Date.now()}`,
          type: 'system',
          title: 'Photo Uploaded',
          message: 'Package photo uploaded successfully',
          priority: 'normal',
          is_read: false,
          created_at: new Date().toISOString()
        }));
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Photo upload failed');
      }
    } catch (error) {
      handleApiError(error, 'Upload package photo');
    } finally {
      setUploadingPhotos(false);
    }
  }, [authState.session?.access_token, packageDetails, dispatch, handleApiError]);

  const validateAndApplyPromotionalCode = useCallback(async () => {
    if (!promotionalCode || !authState.session?.access_token) return;

    try {
      const response = await fetch('/api/v1/promotional-codes/validate', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authState.session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          code: promotionalCode,
          delivery_total: pricingEstimate.total_price
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.valid) {
          setPricingEstimate(prev => ({
            ...prev,
            discount_amount: data.discount_amount,
            total_price: data.final_amount
          }));
          
          dispatch(add_toast_notification({
            uid: `promo_${Date.now()}`,
            type: 'system',
            title: 'Promotional Code Applied',
            message: `Saved $${data.discount_amount.toFixed(2)}`,
            priority: 'normal',
            is_read: false,
            created_at: new Date().toISOString()
          }));
        } else {
          throw new Error(data.error_message || 'Invalid promotional code');
        }
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Promotional code validation failed');
      }
    } catch (error) {
      handleApiError(error, 'Validate promotional code');
    }
  }, [promotionalCode, pricingEstimate.total_price, authState.session?.access_token, dispatch, handleApiError]);

  const createDeliveryRequest = useCallback(async () => {
    try {
      if (!authState.session?.access_token || !authState.user) return;

      setLoading(true);
      setCourierMatching(prev => ({ ...prev, matching_in_progress: true }));

      const deliveryData = {
        pickup_address: pickupLocation?.address_uid ? { address_uid: pickupLocation.address_uid } : pickupLocation,
        delivery_address: deliveryLocation?.address_uid ? { address_uid: deliveryLocation.address_uid } : deliveryLocation,
        packages: packageDetails,
        pickup_contact_name: `${authState.user.first_name} ${authState.user.last_name}`,
        pickup_contact_phone: authState.user.phone || '',
        delivery_contact_name: recipientInfo.name,
        delivery_contact_phone: recipientInfo.phone,
        delivery_instructions: recipientInfo.special_instructions,
        pickup_instructions: pickupLocation?.access_instructions || '',
        delivery_type: schedulingPreferences.delivery_type,
        scheduled_pickup_time: schedulingPreferences.scheduled_pickup_time,
        is_signature_required: false,
        is_photo_proof_required: true,
        priority_level: schedulingPreferences.priority_level,
        payment_method_uid: paymentMethod?.uid,
        promotional_code: promotionalCode
      };

      const response = await fetch('/api/v1/deliveries', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authState.session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(deliveryData)
      });

      if (response.ok) {
        const data = await response.json();
        
        dispatch(add_toast_notification({
          uid: `delivery_created_${Date.now()}`,
          type: 'delivery_status',
          title: 'Delivery Created',
          message: `Delivery ${data.delivery_number} created successfully`,
          priority: 'normal',
          is_read: false,
          created_at: new Date().toISOString(),
          action_url: `/track/${data.uid}`
        }));

        // Navigate to tracking page
        navigate(`/track/${data.uid}`);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create delivery');
      }
    } catch (error) {
      handleApiError(error, 'Create delivery request');
    } finally {
      setLoading(false);
      setCourierMatching(prev => ({ ...prev, matching_in_progress: false }));
    }
  }, [authState, pickupLocation, deliveryLocation, packageDetails, recipientInfo, schedulingPreferences, paymentMethod, promotionalCode, dispatch, navigate, handleApiError]);

  const validateCurrentStep = useCallback(() => {
    const errors: FormValidation = { pickup_errors: [], delivery_errors: [], package_errors: [], payment_errors: [], is_valid: true };
    let isValid = true;

    switch (requestStep) {
      case 1:
        if (!pickupLocation || !pickupLocation.street_address) {
          errors.pickup_errors.push('Pickup location is required');
          isValid = false;
        }
        if (pickupLocation && !pickupLocation.is_verified) {
          errors.pickup_errors.push('Pickup address could not be verified');
          isValid = false;
        }
        if (!deliveryLocation || !deliveryLocation.street_address) {
          errors.delivery_errors.push('Delivery location is required');
          isValid = false;
        }
        if (deliveryLocation && !deliveryLocation.is_verified) {
          errors.delivery_errors.push('Delivery address could not be verified');
          isValid = false;
        }
        break;
      case 2:
        packageDetails.forEach((pkg, index) => {
          if (!pkg.description) {
            errors.package_errors.push(`Package ${index + 1} description is required`);
            isValid = false;
          }
          if (pkg.weight <= 0) {
            errors.package_errors.push(`Package ${index + 1} weight must be greater than 0`);
            isValid = false;
          }
        });
        break;
      case 3:
        if (!recipientInfo.name) {
          errors.delivery_errors.push('Recipient name is required');
          isValid = false;
        }
        if (!recipientInfo.phone) {
          errors.delivery_errors.push('Recipient phone is required');
          isValid = false;
        }
        break;
      case 4:
        if (!paymentMethod) {
          errors.payment_errors.push('Payment method is required');
          isValid = false;
        }
        break;
    }

    errors.is_valid = isValid;
    setFormValidation(errors);
    return isValid;
  }, [requestStep, pickupLocation, deliveryLocation, packageDetails, recipientInfo, paymentMethod]);

  const handleNextStep = useCallback(() => {
    if (validateCurrentStep()) {
      if (requestStep < 5) {
        setRequestStep(requestStep + 1);
        if (requestStep === 1) {
          calculatePricing();
        }
      }
    }
  }, [validateCurrentStep, requestStep, calculatePricing]);

  const handlePreviousStep = useCallback(() => {
    if (requestStep > 1) {
      setRequestStep(requestStep - 1);
    }
  }, [requestStep]);

  const handleAddressSelect = useCallback(async (address: AddressData, type: 'pickup' | 'delivery') => {
    const geocoded = await geocodeAddress(address);
    const locationData: AddressData = {
      ...address,
      latitude: geocoded.latitude,
      longitude: geocoded.longitude,
      is_verified: geocoded.is_valid
    };

    if (type === 'pickup') {
      setPickupLocation(locationData);
    } else {
      setDeliveryLocation(locationData);
    }
  }, [geocodeAddress]);

  const handleAddPackage = useCallback(() => {
    setPackageDetails(prev => [...prev, {
      package_number: prev.length + 1,
      description: "",
      category: "other",
      size: "medium",
      weight: 0,
      dimensions: "",
      value: 0,
      is_fragile: false,
      special_instructions: "",
      insurance_coverage: 0,
      package_photo_urls: ""
    }]);
  }, []);

  const updatePackageDetails = useCallback((index: number, field: keyof PackageDetail, value: any) => {
    const updatedPackages = [...packageDetails];
    (updatedPackages[index] as any)[field] = value;
    setPackageDetails(updatedPackages);
  }, [packageDetails]);

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>, packageIndex: number) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      Array.from(files).forEach(file => {
        uploadPackagePhoto(file, packageIndex);
      });
    }
  }, [uploadPackagePhoto]);

  // Initialize component
  useEffect(() => {
    dispatch(clear_view_errors('UV_DeliveryRequest'));
  }, [dispatch]);

  useEffect(() => {
    fetchSavedAddresses();
    fetchPaymentMethods();
  }, [fetchSavedAddresses, fetchPaymentMethods]);

  useEffect(() => {
    if (template_id) {
      loadDeliveryTemplate(template_id);
    }
  }, [template_id, loadDeliveryTemplate]);

  useEffect(() => {
    if (addressId && savedAddresses.length > 0) {
      const address = savedAddresses.find(addr => addr.uid === addressId);
      if (address) {
        handleAddressSelect(address, 'pickup');
      }
    }
  }, [addressId, savedAddresses, handleAddressSelect]);

  useEffect(() => {
    if (quickSend) {
      setSchedulingPreferences(prev => ({ ...prev, delivery_type: 'express' }));
    }
  }, [quickSend]);

  // Progress bar component
  const ProgressBar = () => (
    <div className="w-full bg-gray-200 rounded-full h-2 mb-8">
      <div 
        className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-in-out"
        style={{ width: `${(requestStep / 5) * 100}%` }}
      ></div>
    </div>
  );

  return (
    <>
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Create Delivery Request</h1>
            <p className="mt-2 text-gray-600">
              {quickSend ? 'Quick Send - Express Delivery' : 'Complete the form below to request your delivery'}
            </p>
          </div>

          {/* Progress Indicator */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              {[1, 2, 3, 4, 5].map((step) => (
                <div key={step} className="flex flex-col items-center">
                  <div 
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold ${
                      requestStep >= step 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-gray-200 text-gray-500'
                    }`}
                  >
                    {step}
                  </div>
                  <span className="text-xs text-gray-500 mt-2">
                    {step === 1 && 'Locations'}
                    {step === 2 && 'Packages'}
                    {step === 3 && 'Schedule'}
                    {step === 4 && 'Payment'}
                    {step === 5 && 'Confirm'}
                  </span>
                </div>
              ))}
            </div>
            <ProgressBar />
          </div>

          {/* Error Display */}
          {errorState.view_specific_errors?.['UV_DeliveryRequest']?.length > 0 && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
              <div className="flex">
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">
                    Please fix the following errors:
                  </h3>
                  <div className="mt-2 text-sm text-red-700">
                    <ul className="list-disc pl-5 space-y-1">
                      {errorState.view_specific_errors['UV_DeliveryRequest'].map((error, index) => (
                        <li key={index}>{error.message}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Main Content */}
          <div className="bg-white shadow-lg rounded-lg p-6">
            {/* Step 1: Pickup and Delivery Locations */}
            {requestStep === 1 && (
              <div className="space-y-8">
                <h2 className="text-2xl font-semibold text-gray-900">Pickup & Delivery Locations</h2>
                
                {/* Pickup Location */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-gray-900">Pickup Location</h3>
                  
                  {/* Saved Addresses */}
                  {savedAddresses.length > 0 && (
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Choose from saved addresses
                      </label>
                      <select
                        onChange={(e) => {
                          if (e.target.value) {
                            const address = savedAddresses.find(addr => addr.uid === e.target.value);
                            if (address) handleAddressSelect(address, 'pickup');
                          }
                        }}
                        className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">Select a saved address...</option>
                        {savedAddresses.map((address) => (
                          <option key={address.uid} value={address.uid}>
                            {address.street_address}, {address.city}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Manual Address Entry */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Street Address
                      </label>
                      <input
                        type="text"
                        value={pickupLocation?.street_address || ''}
                        onChange={async (e) => {
                          const updatedLocation = { ...pickupLocation, street_address: e.target.value } as AddressData;
                          setPickupLocation(updatedLocation);
                          if (updatedLocation.street_address && updatedLocation.city) {
                            const geocoded = await geocodeAddress(updatedLocation);
                            setPickupLocation(prev => prev ? {
                              ...prev,
                              latitude: geocoded.latitude,
                              longitude: geocoded.longitude,
                              is_verified: geocoded.is_valid
                            } : null);
                          }
                        }}
                        className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="123 Main Street"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Apartment/Unit (Optional)
                      </label>
                      <input
                        type="text"
                        value={pickupLocation?.apartment_unit || ''}
                        onChange={(e) => setPickupLocation(prev => prev ? { ...prev, apartment_unit: e.target.value } : null)}
                        className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Apt 4B"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        City
                      </label>
                      <input
                        type="text"
                        value={pickupLocation?.city || ''}
                        onChange={async (e) => {
                          const updatedLocation = { ...pickupLocation, city: e.target.value } as AddressData;
                          setPickupLocation(updatedLocation);
                          if (updatedLocation.street_address && updatedLocation.city) {
                            const geocoded = await geocodeAddress(updatedLocation);
                            setPickupLocation(prev => prev ? {
                              ...prev,
                              latitude: geocoded.latitude,
                              longitude: geocoded.longitude,
                              is_verified: geocoded.is_valid
                            } : null);
                          }
                        }}
                        className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="New York"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Postal Code
                      </label>
                      <input
                        type="text"
                        value={pickupLocation?.postal_code || ''}
                        onChange={(e) => setPickupLocation(prev => prev ? { ...prev, postal_code: e.target.value } : null)}
                        className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="10001"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Special Instructions (Optional)
                    </label>
                    <textarea
                      value={pickupLocation?.access_instructions || ''}
                      onChange={(e) => setPickupLocation(prev => prev ? { ...prev, access_instructions: e.target.value } : null)}
                      rows={3}
                      className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Gate code, building instructions, etc."
                    />
                  </div>

                  {formValidation.pickup_errors.length > 0 && (
                    <div className="text-red-600 text-sm">
                      {formValidation.pickup_errors.map((error: string, index: number) => (
                        <div key={index}>{error}</div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Delivery Location */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-gray-900">Delivery Location</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Street Address
                      </label>
                      <input
                        type="text"
                        value={deliveryLocation?.street_address || ''}
                        onChange={async (e) => {
                          const updatedLocation = { ...deliveryLocation, street_address: e.target.value } as AddressData;
                          setDeliveryLocation(updatedLocation);
                          if (updatedLocation.street_address && updatedLocation.city) {
                            const geocoded = await geocodeAddress(updatedLocation);
                            setDeliveryLocation(prev => prev ? {
                              ...prev,
                              latitude: geocoded.latitude,
                              longitude: geocoded.longitude,
                              is_verified: geocoded.is_valid
                            } : null);
                          }
                        }}
                        className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="456 Business Ave"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Apartment/Unit (Optional)
                      </label>
                      <input
                        type="text"
                        value={deliveryLocation?.apartment_unit || ''}
                        onChange={(e) => setDeliveryLocation(prev => prev ? { ...prev, apartment_unit: e.target.value } : null)}
                        className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Suite 200"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        City
                      </label>
                      <input
                        type="text"
                        value={deliveryLocation?.city || ''}
                        onChange={async (e) => {
                          const updatedLocation = { ...deliveryLocation, city: e.target.value } as AddressData;
                          setDeliveryLocation(updatedLocation);
                          if (updatedLocation.street_address && updatedLocation.city) {
                            const geocoded = await geocodeAddress(updatedLocation);
                            setDeliveryLocation(prev => prev ? {
                              ...prev,
                              latitude: geocoded.latitude,
                              longitude: geocoded.longitude,
                              is_verified: geocoded.is_valid
                            } : null);
                          }
                        }}
                        className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="New York"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Postal Code
                      </label>
                      <input
                        type="text"
                        value={deliveryLocation?.postal_code || ''}
                        onChange={(e) => setDeliveryLocation(prev => prev ? { ...prev, postal_code: e.target.value } : null)}
                        className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="10002"
                      />
                    </div>
                  </div>

                  {formValidation.delivery_errors.length > 0 && (
                    <div className="text-red-600 text-sm">
                      {formValidation.delivery_errors.map((error: string, index: number) => (
                        <div key={index}>{error}</div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Step 2: Package Details */}
            {requestStep === 2 && (
              <div className="space-y-8">
                <h2 className="text-2xl font-semibold text-gray-900">Package Details</h2>
                
                {packageDetails.map((pkg, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-6 space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="text-lg font-medium text-gray-900">Package {index + 1}</h3>
                      {packageDetails.length > 1 && (
                        <button
                          onClick={() => {
                            const filtered = packageDetails.filter((_, i) => i !== index);
                            setPackageDetails(filtered);
                          }}
                          className="text-red-600 hover:text-red-800 text-sm"
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Description
                        </label>
                        <input
                          type="text"
                          value={pkg.description}
                          onChange={(e) => updatePackageDetails(index, 'description', e.target.value)}
                          className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="Important documents"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Category
                        </label>
                        <select
                          value={pkg.category}
                          onChange={(e) => updatePackageDetails(index, 'category', e.target.value)}
                          className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="documents">Documents</option>
                          <option value="food">Food</option>
                          <option value="electronics">Electronics</option>
                          <option value="clothing">Clothing</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Size
                        </label>
                        <select
                          value={pkg.size}
                          onChange={(e) => updatePackageDetails(index, 'size', e.target.value)}
                          className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="small">Small (shoebox)</option>
                          <option value="medium">Medium (backpack)</option>
                          <option value="large">Large (suitcase)</option>
                          <option value="extra_large">Extra Large</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Weight (lbs)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.1"
                          value={pkg.weight}
                          onChange={(e) => updatePackageDetails(index, 'weight', parseFloat(e.target.value) || 0)}
                          className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="2.5"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Value ($)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={pkg.value}
                          onChange={(e) => updatePackageDetails(index, 'value', parseFloat(e.target.value) || 0)}
                          className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="50.00"
                        />
                      </div>
                    </div>

                    <div className="flex items-center space-x-4">
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={pkg.is_fragile}
                          onChange={(e) => updatePackageDetails(index, 'is_fragile', e.target.checked)}
                          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="ml-2 text-sm text-gray-700">Fragile</span>
                      </label>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Special Instructions
                      </label>
                      <textarea
                        value={pkg.special_instructions}
                        onChange={(e) => updatePackageDetails(index, 'special_instructions', e.target.value)}
                        rows={2}
                        className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Handle with care, keep upright, etc."
                      />
                    </div>

                    {/* Photo Upload */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Package Photos (Optional)
                      </label>
                      <div className="flex items-center space-x-4">
                        <input
                          ref={fileInputRef}
                          type="file"
                          multiple
                          accept="image/*"
                          onChange={(e) => handleFileUpload(e, index)}
                          className="hidden"
                        />
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploadingPhotos}
                          className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
                        >
                          {uploadingPhotos ? 'Uploading...' : 'Add Photos'}
                        </button>
                        {pkg.package_photo_urls && (
                          <span className="text-sm text-gray-600">
                            {pkg.package_photo_urls.split(',').filter(url => url.trim()).length} photo(s) uploaded
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                <button
                  onClick={handleAddPackage}
                  className="w-full border-2 border-dashed border-gray-300 rounded-lg p-6 text-center text-gray-600 hover:border-gray-400 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  + Add Another Package
                </button>

                {formValidation.package_errors.length > 0 && (
                  <div className="text-red-600 text-sm space-y-1">
                    {formValidation.package_errors.map((error: string, index: number) => (
                      <div key={index}>{error}</div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Scheduling & Recipient */}
            {requestStep === 3 && (
              <div className="space-y-8">
                <h2 className="text-2xl font-semibold text-gray-900">Scheduling & Recipient</h2>
                
                {/* Delivery Type */}
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Delivery Type</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[
                      { value: 'standard', label: 'Standard', time: '2-6 hours', price: '$' },
                      { value: 'express', label: 'Express', time: '1-2 hours', price: '$$' },
                      { value: 'priority', label: 'Priority', time: '30-60 min', price: '$$$' }
                    ].map((option) => (
                      <div
                        key={option.value}
                        onClick={() => setSchedulingPreferences(prev => ({ ...prev, delivery_type: option.value }))}
                        className={`relative rounded-lg border p-4 cursor-pointer focus:outline-none ${
                          schedulingPreferences.delivery_type === option.value
                            ? 'border-blue-600 ring-2 ring-blue-600'
                            : 'border-gray-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="text-lg font-medium text-gray-900">{option.label}</h4>
                            <p className="text-sm text-gray-500">{option.time}</p>
                          </div>
                          <div className="text-lg font-bold text-blue-600">{option.price}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Scheduled Pickup */}
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Pickup Time</h3>
                  <div className="space-y-4">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="pickup_timing"
                        value="immediate"
                        checked={!schedulingPreferences.scheduled_pickup_time}
                        onChange={() => setSchedulingPreferences(prev => ({ ...prev, scheduled_pickup_time: null }))}
                        className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                      />
                      <span className="ml-2 text-sm text-gray-900">Immediate Pickup</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="pickup_timing"
                        value="scheduled"
                        checked={!!schedulingPreferences.scheduled_pickup_time}
                        onChange={() => setSchedulingPreferences(prev => ({ 
                          ...prev, 
                          scheduled_pickup_time: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString().slice(0, 16)
                        }))}
                        className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                      />
                      <span className="ml-2 text-sm text-gray-900">Schedule for later</span>
                    </label>
                    {schedulingPreferences.scheduled_pickup_time && (
                      <div className="ml-6">
                        <input
                          type="datetime-local"
                          value={schedulingPreferences.scheduled_pickup_time?.slice(0, 16) || ''}
                          onChange={(e) => setSchedulingPreferences(prev => ({ 
                            ...prev, 
                            scheduled_pickup_time: e.target.value 
                          }))}
                          min={new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 16)}
                          className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Recipient Information */}
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Recipient Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Full Name
                      </label>
                      <input
                        type="text"
                        value={recipientInfo.name}
                        onChange={(e) => setRecipientInfo(prev => ({ ...prev, name: e.target.value }))}
                        className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="John Doe"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Phone Number
                      </label>
                      <input
                        type="tel"
                        value={recipientInfo.phone}
                        onChange={(e) => setRecipientInfo(prev => ({ ...prev, phone: e.target.value }))}
                        className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="+1 (555) 123-4567"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Email (Optional)
                      </label>
                      <input
                        type="email"
                        value={recipientInfo.email}
                        onChange={(e) => setRecipientInfo(prev => ({ ...prev, email: e.target.value }))}
                        className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="john@example.com"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Delivery Instructions
                      </label>
                      <textarea
                        value={recipientInfo.special_instructions}
                        onChange={(e) => setRecipientInfo(prev => ({ ...prev, special_instructions: e.target.value }))}
                        rows={3}
                        className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Ring doorbell twice, leave with concierge, etc."
                      />
                    </div>
                  </div>

                  {formValidation.delivery_errors.length > 0 && (
                    <div className="mt-2 text-red-600 text-sm space-y-1">
                      {formValidation.delivery_errors.map((error: string, index: number) => (
                        <div key={index}>{error}</div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Step 4: Payment */}
            {requestStep === 4 && (
              <div className="space-y-8">
                <h2 className="text-2xl font-semibold text-gray-900">Payment & Pricing</h2>
                
                {/* Pricing Breakdown */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Pricing Breakdown</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>Base delivery fee</span>
                      <span>${pricingEstimate.base_price.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>Distance-based pricing</span>
                      <span>${pricingEstimate.distance_price.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>Package handling</span>
                      <span>${pricingEstimate.package_price.toFixed(2)}</span>
                    </div>
                    {pricingEstimate.priority_surcharge > 0 && (
                      <div className="flex justify-between text-sm text-gray-600">
                        <span>Priority surcharge</span>
                        <span>${pricingEstimate.priority_surcharge.toFixed(2)}</span>
                      </div>
                    )}
                    {pricingEstimate.surge_multiplier > 1 && (
                      <div className="flex justify-between text-sm text-orange-600">
                        <span>Peak time surcharge ({Math.round((pricingEstimate.surge_multiplier - 1) * 100)}%)</span>
                        <span>${((pricingEstimate.base_price + pricingEstimate.distance_price) * (pricingEstimate.surge_multiplier - 1)).toFixed(2)}</span>
                      </div>
                    )}
                    {pricingEstimate.discount_amount > 0 && (
                      <div className="flex justify-between text-sm text-green-600">
                        <span>Promotional discount</span>
                        <span>-${pricingEstimate.discount_amount.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="border-t pt-3">
                      <div className="flex justify-between text-lg font-semibold text-gray-900">
                        <span>Total</span>
                        <span>${pricingEstimate.total_price.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Promotional Code */}
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Promotional Code</h3>
                  <div className="flex space-x-4">
                    <input
                      type="text"
                      value={promotionalCode}
                      onChange={(e) => setPromotionalCode(e.target.value.toUpperCase())}
                      className="flex-1 p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter promotional code"
                    />
                    <button
                      onClick={validateAndApplyPromotionalCode}
                      className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      Apply
                    </button>
                  </div>
                </div>

                {/* Payment Method Selection */}
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Payment Method</h3>
                  {paymentMethods.length > 0 ? (
                    <div className="space-y-3">
                      {paymentMethods.map((method) => (
                        <div
                          key={method.uid}
                          onClick={() => setPaymentMethod(method)}
                          className={`border rounded-lg p-4 cursor-pointer ${
                            paymentMethod?.uid === method.uid
                              ? 'border-blue-600 ring-2 ring-blue-600'
                              : 'border-gray-300'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center">
                              <div className="w-8 h-8 bg-gray-200 rounded mr-3 flex items-center justify-center text-xs font-semibold">
                                {method.type === 'credit_card' ? 'CC' : method.type === 'debit_card' ? 'DC' : 'PP'}
                              </div>
                              <div>
                                <div className="font-medium text-gray-900">
                                  {method.type.replace('_', ' ').toUpperCase()} •••• {method.last_four_digits}
                                </div>
                                <div className="text-sm text-gray-500">{method.cardholder_name}</div>
                              </div>
                            </div>
                            {method.is_default && (
                              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">Default</span>
                            )}
                          </div>
                        </div>
                      ))}
                      <div className="text-center">
                        <Link
                          to="/payment-methods?add_method=true"
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                        >
                          + Add New Payment Method
                        </Link>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-gray-600 mb-4">No payment methods found</p>
                      <Link
                        to="/payment-methods?add_method=true"
                        className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        Add Payment Method
                      </Link>
                    </div>
                  )}

                  {formValidation.payment_errors.length > 0 && (
                    <div className="mt-2 text-red-600 text-sm space-y-1">
                      {formValidation.payment_errors.map((error: string, index: number) => (
                        <div key={index}>{error}</div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Step 5: Confirmation */}
            {requestStep === 5 && (
              <div className="space-y-8">
                <h2 className="text-2xl font-semibold text-gray-900">Confirm Your Delivery</h2>
                
                {/* Order Summary */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Delivery Summary</h3>
                  
                  {/* Route */}
                  <div className="mb-6">
                    <div className="flex items-center space-x-4">
                      <div className="flex flex-col items-center">
                        <div className="w-3 h-3 bg-blue-600 rounded-full"></div>
                        <div className="w-0.5 h-8 bg-gray-300 my-1"></div>
                        <div className="w-3 h-3 bg-green-600 rounded-full"></div>
                      </div>
                      <div className="flex-1">
                        <div className="pb-4">
                          <div className="font-medium text-gray-900">Pickup</div>
                          <div className="text-sm text-gray-600">
                            {pickupLocation?.street_address}, {pickupLocation?.city}
                          </div>
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">Delivery</div>
                          <div className="text-sm text-gray-600">
                            {deliveryLocation?.street_address}, {deliveryLocation?.city}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Package Count */}
                  <div className="mb-4">
                    <span className="font-medium text-gray-900">Packages: </span>
                    <span className="text-gray-600">{packageDetails.length} package(s)</span>
                  </div>

                  {/* Delivery Type */}
                  <div className="mb-4">
                    <span className="font-medium text-gray-900">Delivery Type: </span>
                    <span className="text-gray-600 capitalize">{schedulingPreferences.delivery_type}</span>
                  </div>

                  {/* Recipient */}
                  <div className="mb-4">
                    <span className="font-medium text-gray-900">Recipient: </span>
                    <span className="text-gray-600">{recipientInfo.name} ({recipientInfo.phone})</span>
                  </div>

                  {/* Total */}
                  <div className="border-t pt-4">
                    <div className="flex justify-between text-lg font-semibold text-gray-900">
                      <span>Total Cost</span>
                      <span>${pricingEstimate.total_price.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* Courier Matching Status */}
                {courierMatching.matching_in_progress && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                    <div className="flex items-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-3"></div>
                      <div>
                        <div className="font-medium text-blue-900">Finding Available Courier</div>
                        <div className="text-sm text-blue-700">
                          We're matching you with the best available courier in your area...
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Terms and Conditions */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-gray-900">Terms & Conditions</h3>
                  <div className="bg-white border border-gray-200 rounded-lg p-4 max-h-40 overflow-y-auto text-sm text-gray-600">
                    <p className="mb-2">
                      By confirming this delivery, you agree to our Terms of Service and acknowledge that:
                    </p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>Delivery fees are non-refundable once a courier is assigned</li>
                      <li>Package value declaration affects insurance coverage</li>
                      <li>Prohibited items include hazardous materials, illegal substances, and fragile items without proper packaging</li>
                      <li>Delivery times are estimates and may vary due to traffic and weather conditions</li>
                      <li>Photo proof of delivery will be required for completion</li>
                    </ul>
                  </div>
                  
                  <label className="flex items-start">
                    <input
                      type="checkbox"
                      required
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 mt-0.5"
                    />
                    <span className="ml-3 text-sm text-gray-700">
                      I acknowledge and agree to the terms and conditions, cancellation policy, and estimated delivery timeframe.
                    </span>
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Navigation Buttons */}
          <div className="mt-8 flex justify-between">
            <div>
              {requestStep > 1 && (
                <button
                  onClick={handlePreviousStep}
                  disabled={loading}
                  className="inline-flex items-center px-6 py-3 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
                >
                  Previous
                </button>
              )}
            </div>
            <div className="flex space-x-4">
              <Link
                to="/dashboard"
                className="inline-flex items-center px-6 py-3 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                Cancel
              </Link>
              {requestStep < 5 ? (
                <button
                  onClick={handleNextStep}
                  disabled={loading}
                  className="inline-flex items-center px-6 py-3 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  {loading ? 'Processing...' : 'Continue'}
                </button>
              ) : (
                <button
                  onClick={createDeliveryRequest}
                  disabled={loading || courierMatching.matching_in_progress}
                  className="inline-flex items-center px-8 py-3 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50"
                >
                  {loading || courierMatching.matching_in_progress ? 'Creating Delivery...' : 'Confirm & Create Delivery'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default UV_DeliveryRequest;