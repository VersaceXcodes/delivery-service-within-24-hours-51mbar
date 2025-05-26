import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';

interface FormData {
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  firstName: string;
  lastName: string;
  accountType: 'sender' | 'courier' | 'business_admin';
  preferredLanguage: string;
  timezone: string;
  businessInfo: {
    companyName: string;
    businessRegistrationNumber: string;
    taxId: string;
    industryType: string;
  };
  courierInfo: {
    vehicleType: 'bicycle' | 'motorcycle' | 'car' | 'van';
    driverLicenseNumber: string;
    vehicleMake: string;
    vehicleModel: string;
  };
}

interface VerificationStatus {
  emailSent: boolean;
  emailVerified: boolean;
  smsSent: boolean;
  smsVerified: boolean;
  emailCode: string;
  smsCode: string;
}

interface ValidationErrors {
  email: string[];
  phone: string[];
  password: string[];
  general: string[];
}

interface SocialAuthState {
  provider: string;
  inProgress: boolean;
  error: string;
  userData: any;
}

interface ReferralInfo {
  referralCode: string;
  isValid: boolean;
  referrerName: string;
  rewardAmount: number;
}

const UV_Registration: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // State variables based on datamap
  const [registrationStep, setRegistrationStep] = useState<number>(1);
  const [formData, setFormData] = useState<FormData>({
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    accountType: (searchParams.get('account_type') as any) || 'sender',
    preferredLanguage: 'en',
    timezone: 'UTC',
    businessInfo: {
      companyName: '',
      businessRegistrationNumber: '',
      taxId: '',
      industryType: '',
    },
    courierInfo: {
      vehicleType: 'bicycle',
      driverLicenseNumber: '',
      vehicleMake: '',
      vehicleModel: '',
    },
  });

  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus>({
    emailSent: false,
    emailVerified: false,
    smsSent: false,
    smsVerified: false,
    emailCode: '',
    smsCode: '',
  });

  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({
    email: [],
    phone: [],
    password: [],
    general: [],
  });

  const [socialAuthState, setSocialAuthState] = useState<SocialAuthState>({
    provider: '',
    inProgress: false,
    error: '',
    userData: {},
  });

  const [referralInfo, setReferralInfo] = useState<ReferralInfo>({
    referralCode: searchParams.get('referral_code') || '',
    isValid: false,
    referrerName: '',
    rewardAmount: 0,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [emailChecking, setEmailChecking] = useState(false);
  const [phoneChecking, setPhoneChecking] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [uploadedDocuments, setUploadedDocuments] = useState<any[]>([]);

  // Backend API functions
  const validateEmailAvailability = async (email: string) => {
    if (!email || !email.includes('@')) return;
    
    setEmailChecking(true);
    try {
      const response = await axios.post(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/v1/auth/validate-email`, { email });
      
      if (response.data.available) {
        setValidationErrors(prev => ({ ...prev, email: [] }));
      } else {
        setValidationErrors(prev => ({ ...prev, email: ['Email address is already registered'] }));
      }
    } catch (error: any) {
      setValidationErrors(prev => ({ ...prev, email: ['Error validating email'] }));
    } finally {
      setEmailChecking(false);
    }
  };

  const validatePhoneNumber = async (phone: string) => {
    if (!phone) return;
    
    setPhoneChecking(true);
    try {
      const response = await axios.post(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/v1/auth/validate-phone`, { 
        phone,
        country_code: '+1' 
      });
      
      if (response.data.valid) {
        setValidationErrors(prev => ({ ...prev, phone: [] }));
      } else {
        setValidationErrors(prev => ({ ...prev, phone: ['Invalid phone number format'] }));
      }
    } catch (error: any) {
      setValidationErrors(prev => ({ ...prev, phone: ['Error validating phone number'] }));
    } finally {
      setPhoneChecking(false);
    }
  };

  const sendVerificationEmail = async () => {
    try {
      const response = await axios.post(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/v1/auth/send-email-verification`, {
        email: formData.email
      });
      
      setVerificationStatus(prev => ({ ...prev, emailSent: true }));
    } catch (error: any) {
      setValidationErrors(prev => ({ ...prev, general: ['Failed to send verification email'] }));
    }
  };

  const sendVerificationSms = async () => {
    try {
      const response = await axios.post(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/v1/auth/send-sms-verification`, {
        phone: formData.phone
      });
      
      setVerificationStatus(prev => ({ ...prev, smsSent: true }));
    } catch (error: any) {
      setValidationErrors(prev => ({ ...prev, general: ['Failed to send verification SMS'] }));
    }
  };

  const verifyEmailCode = async (code: string) => {
    try {
      const response = await axios.post(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/v1/auth/verify-email`, {
        email: formData.email,
        verification_code: code
      });
      
      if (response.data.verified) {
        setVerificationStatus(prev => ({ ...prev, emailVerified: true }));
      } else {
        setValidationErrors(prev => ({ ...prev, general: ['Invalid email verification code'] }));
      }
    } catch (error: any) {
      setValidationErrors(prev => ({ ...prev, general: ['Error verifying email code'] }));
    }
  };

  const verifySmsCode = async (code: string) => {
    try {
      const response = await axios.post(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/v1/auth/verify-sms`, {
        phone: formData.phone,
        verification_code: code
      });
      
      if (response.data.verified) {
        setVerificationStatus(prev => ({ ...prev, smsVerified: true }));
      } else {
        setValidationErrors(prev => ({ ...prev, general: ['Invalid SMS verification code'] }));
      }
    } catch (error: any) {
      setValidationErrors(prev => ({ ...prev, general: ['Error verifying SMS code'] }));
    }
  };

  const uploadCourierDocument = async (file: File, documentType: string) => {
    try {
      const formDataUpload = new FormData();
      formDataUpload.append('file', file);
      formDataUpload.append('entity_type', 'courier_document');
      formDataUpload.append('entity_uid', 'temp');
      formDataUpload.append('upload_purpose', documentType);

      const response = await axios.post(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/v1/files/upload`, formDataUpload, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setUploadedDocuments(prev => [...prev, response.data]);
      return response.data;
    } catch (error: any) {
      setValidationErrors(prev => ({ ...prev, general: ['Failed to upload document'] }));
    }
  };

  const validateReferralCode = async (code: string) => {
    if (!code) return;
    
    try {
      const response = await axios.get(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/v1/referrals/validate?referral_code=${code}`);
      
      setReferralInfo({
        referralCode: code,
        isValid: response.data.valid,
        referrerName: response.data.referrer_name || '',
        rewardAmount: response.data.reward_amount || 0,
      });
    } catch (error: any) {
      setReferralInfo(prev => ({ ...prev, isValid: false }));
    }
  };

  const submitRegistration = async () => {
    setIsSubmitting(true);
    try {
      const registrationData = {
        email: formData.email,
        phone: formData.phone,
        password: formData.password,
        user_type: formData.accountType,
        first_name: formData.firstName,
        last_name: formData.lastName,
        preferred_language: formData.preferredLanguage,
        timezone: formData.timezone,
        business_info: formData.accountType === 'business_admin' ? formData.businessInfo : undefined,
      };

      const response = await axios.post(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/v1/auth/register`, registrationData);
      
      if (response.data.success) {
        // Navigate based on account type
        if (formData.accountType === 'courier') {
          navigate('/courier-dashboard');
        } else {
          navigate('/dashboard');
        }
      }
    } catch (error: any) {
      setValidationErrors(prev => ({ ...prev, general: [error.response?.data?.error || 'Registration failed'] }));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Password strength calculation
  const calculatePasswordStrength = (password: string) => {
    let score = 0;
    const requirements = {
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      numbers: /\d/.test(password),
      symbols: /[^A-Za-z0-9]/.test(password),
    };

    Object.values(requirements).forEach(met => met && score++);
    
    return { score: (score / 5) * 100, requirements };
  };

  // Debounced validation
  useEffect(() => {
    const timer = setTimeout(() => {
      if (formData.email) validateEmailAvailability(formData.email);
    }, 500);
    return () => clearTimeout(timer);
  }, [formData.email]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (formData.phone) validatePhoneNumber(formData.phone);
    }, 500);
    return () => clearTimeout(timer);
  }, [formData.phone]);

  useEffect(() => {
    if (referralInfo.referralCode) {
      validateReferralCode(referralInfo.referralCode);
    }
  }, [referralInfo.referralCode]);

  // Auto-send verification codes when step 2 is reached
  useEffect(() => {
    if (registrationStep === 2 && !verificationStatus.emailSent) {
      sendVerificationEmail();
    }
    if (registrationStep === 2 && !verificationStatus.smsSent) {
      sendVerificationSms();
    }
  }, [registrationStep]);

  // Step validation
  const isStepValid = (step: number) => {
    switch (step) {
      case 1:
        return (
          formData.firstName &&
          formData.lastName &&
          formData.email &&
          formData.phone &&
          formData.password &&
          formData.confirmPassword &&
          formData.password === formData.confirmPassword &&
          validationErrors.email.length === 0 &&
          validationErrors.phone.length === 0
        );
      case 2:
        return verificationStatus.emailVerified && verificationStatus.smsVerified;
      case 3:
        if (formData.accountType === 'business_admin') {
          return formData.businessInfo.companyName && formData.businessInfo.industryType;
        }
        if (formData.accountType === 'courier') {
          return formData.courierInfo.vehicleType && formData.courierInfo.driverLicenseNumber;
        }
        return true;
      case 4:
        return true;
      default:
        return false;
    }
  };

  const nextStep = () => {
    if (isStepValid(registrationStep)) {
      setRegistrationStep(prev => Math.min(prev + 1, 4));
    }
  };

  const prevStep = () => {
    setRegistrationStep(prev => Math.max(prev - 1, 1));
  };

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          {/* Header */}
          <div className="text-center">
            <Link to="/" className="flex justify-center">
              <img
                className="h-12 w-auto"
                src="https://picsum.photos/120/40?random=logo"
                alt="QuickDrop"
              />
            </Link>
            <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
              Create your account
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              Join thousands of users who trust QuickDrop for their delivery needs
            </p>
          </div>

          {/* Progress Indicator */}
          <div className="flex items-center justify-center">
            <div className="flex items-center space-x-4">
              {[1, 2, 3, 4].map((step) => (
                <div key={step} className="flex items-center">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                      step <= registrationStep
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-200 text-gray-500'
                    }`}
                  >
                    {step}
                  </div>
                  {step < 4 && (
                    <div
                      className={`w-12 h-0.5 ${
                        step < registrationStep ? 'bg-indigo-600' : 'bg-gray-200'
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-xl p-6 space-y-6">
            {/* Error Messages */}
            {validationErrors.general.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-md p-4">
                <div className="flex">
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">
                      Registration Error
                    </h3>
                    <div className="mt-2 text-sm text-red-700">
                      <ul className="list-disc pl-5 space-y-1">
                        {validationErrors.general.map((error, index) => (
                          <li key={index}>{error}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Referral Info Display */}
            {referralInfo.referralCode && referralInfo.isValid && (
              <div className="bg-green-50 border border-green-200 rounded-md p-4">
                <div className="flex">
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-green-800">
                      Referral Code Applied
                    </h3>
                    <div className="mt-2 text-sm text-green-700">
                      You'll receive ${referralInfo.rewardAmount} credit from {referralInfo.referrerName}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 1: Basic Information */}
            {registrationStep === 1 && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">
                    Basic Information
                  </h3>

                  {/* Account Type Selection */}
                  <div className="space-y-3 mb-6">
                    <label className="text-sm font-medium text-gray-700">
                      I want to:
                    </label>
                    <div className="grid grid-cols-1 gap-3">
                      {[
                        { value: 'sender', label: 'Send packages', desc: 'I need to send deliveries' },
                        { value: 'courier', label: 'Deliver packages', desc: 'I want to earn money as a courier' },
                        { value: 'business_admin', label: 'Manage business deliveries', desc: 'For my company or team' },
                      ].map(({ value, label, desc }) => (
                        <label
                          key={value}
                          className={`relative flex cursor-pointer rounded-lg border p-4 focus:outline-none ${
                            formData.accountType === value
                              ? 'border-indigo-600 ring-2 ring-indigo-600'
                              : 'border-gray-300'
                          }`}
                        >
                          <input
                            type="radio"
                            name="accountType"
                            value={value}
                            checked={formData.accountType === value}
                            onChange={(e) =>
                              setFormData(prev => ({ ...prev, accountType: e.target.value as any }))
                            }
                            className="sr-only"
                          />
                          <span className="flex flex-1">
                            <span className="flex flex-col">
                              <span className="block text-sm font-medium text-gray-900">
                                {label}
                              </span>
                              <span className="block text-sm text-gray-500">
                                {desc}
                              </span>
                            </span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Name Fields */}
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        First Name
                      </label>
                      <input
                        type="text"
                        value={formData.firstName}
                        onChange={(e) =>
                          setFormData(prev => ({ ...prev, firstName: e.target.value }))
                        }
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Last Name
                      </label>
                      <input
                        type="text"
                        value={formData.lastName}
                        onChange={(e) =>
                          setFormData(prev => ({ ...prev, lastName: e.target.value }))
                        }
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                        required
                      />
                    </div>
                  </div>

                  {/* Email */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700">
                      Email Address
                    </label>
                    <div className="relative">
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) =>
                          setFormData(prev => ({ ...prev, email: e.target.value }))
                        }
                        className={`mt-1 block w-full border rounded-md shadow-sm focus:ring-indigo-500 pr-10 ${
                          validationErrors.email.length > 0
                            ? 'border-red-300 focus:border-red-500'
                            : 'border-gray-300 focus:border-indigo-500'
                        }`}
                        required
                      />
                      {emailChecking && (
                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                          <svg className="animate-spin h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                        </div>
                      )}
                    </div>
                    {validationErrors.email.length > 0 && (
                      <p className="mt-1 text-sm text-red-600">
                        {validationErrors.email[0]}
                      </p>
                    )}
                  </div>

                  {/* Phone */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700">
                      Phone Number
                    </label>
                    <div className="relative">
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) =>
                          setFormData(prev => ({ ...prev, phone: e.target.value }))
                        }
                        className={`mt-1 block w-full border rounded-md shadow-sm focus:ring-indigo-500 pr-10 ${
                          validationErrors.phone.length > 0
                            ? 'border-red-300 focus:border-red-500'
                            : 'border-gray-300 focus:border-indigo-500'
                        }`}
                        placeholder="+1 (555) 123-4567"
                        required
                      />
                      {phoneChecking && (
                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                          <svg className="animate-spin h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                        </div>
                      )}
                    </div>
                    {validationErrors.phone.length > 0 && (
                      <p className="mt-1 text-sm text-red-600">
                        {validationErrors.phone[0]}
                      </p>
                    )}
                  </div>

                  {/* Password */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700">
                      Password
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={formData.password}
                        onChange={(e) =>
                          setFormData(prev => ({ ...prev, password: e.target.value }))
                        }
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500 pr-10"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      >
                        {showPassword ? (
                          <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                          </svg>
                        ) : (
                          <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        )}
                      </button>
                    </div>
                    
                    {/* Password Strength Meter */}
                    {formData.password && (
                      <div className="mt-2">
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500">Password strength</span>
                          <span className={`${
                            calculatePasswordStrength(formData.password).score >= 80
                              ? 'text-green-600'
                              : calculatePasswordStrength(formData.password).score >= 60
                                ? 'text-yellow-600'
                                : 'text-red-600'
                          }`}>
                            {calculatePasswordStrength(formData.password).score >= 80
                              ? 'Strong'
                              : calculatePasswordStrength(formData.password).score >= 60
                                ? 'Medium'
                                : 'Weak'}
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all duration-300 ${
                              calculatePasswordStrength(formData.password).score >= 80
                                ? 'bg-green-500'
                                : calculatePasswordStrength(formData.password).score >= 60
                                  ? 'bg-yellow-500'
                                  : 'bg-red-500'
                            }`}
                            style={{ width: `${calculatePasswordStrength(formData.password).score}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Confirm Password */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700">
                      Confirm Password
                    </label>
                    <input
                      type="password"
                      value={formData.confirmPassword}
                      onChange={(e) =>
                        setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))
                      }
                      className={`mt-1 block w-full border rounded-md shadow-sm focus:ring-indigo-500 ${
                        formData.password && formData.confirmPassword && formData.password !== formData.confirmPassword
                          ? 'border-red-300 focus:border-red-500'
                          : 'border-gray-300 focus:border-indigo-500'
                      }`}
                      required
                    />
                    {formData.password && formData.confirmPassword && formData.password !== formData.confirmPassword && (
                      <p className="mt-1 text-sm text-red-600">
                        Passwords do not match
                      </p>
                    )}
                  </div>

                  {/* Referral Code */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700">
                      Referral Code (Optional)
                    </label>
                    <input
                      type="text"
                      value={referralInfo.referralCode}
                      onChange={(e) =>
                        setReferralInfo(prev => ({ ...prev, referralCode: e.target.value }))
                      }
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                      placeholder="Enter referral code"
                    />
                  </div>

                  {/* Social Login Options */}
                  <div className="space-y-3">
                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-gray-300" />
                      </div>
                      <div className="relative flex justify-center text-sm">
                        <span className="px-2 bg-white text-gray-500">Or continue with</span>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-3">
                      <button
                        type="button"
                        className="w-full inline-flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
                        onClick={() => {
                          setSocialAuthState(prev => ({ ...prev, provider: 'google', inProgress: true }));
                          // Implement Google OAuth
                        }}
                      >
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                          <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                          <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                          <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                          <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                        </svg>
                      </button>
                      
                      <button
                        type="button"
                        className="w-full inline-flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
                        onClick={() => {
                          setSocialAuthState(prev => ({ ...prev, provider: 'facebook', inProgress: true }));
                          // Implement Facebook OAuth
                        }}
                      >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                        </svg>
                      </button>
                      
                      <button
                        type="button"
                        className="w-full inline-flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
                        onClick={() => {
                          setSocialAuthState(prev => ({ ...prev, provider: 'apple', inProgress: true }));
                          // Implement Apple Sign-In
                        }}
                      >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Verification */}
            {registrationStep === 2 && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">
                    Verify Your Account
                  </h3>
                  <p className="text-sm text-gray-600 mb-6">
                    We've sent verification codes to your email and phone number to ensure account security.
                  </p>

                  {/* Email Verification */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email Verification Code
                    </label>
                    <div className="flex items-center space-x-2">
                      <input
                        type="text"
                        value={verificationStatus.emailCode}
                        onChange={(e) => {
                          const code = e.target.value;
                          setVerificationStatus(prev => ({ ...prev, emailCode: code }));
                          if (code.length === 6) {
                            verifyEmailCode(code);
                          }
                        }}
                        className="flex-1 border-gray-300 rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                        placeholder="Enter 6-digit code"
                        maxLength={6}
                      />
                      {verificationStatus.emailVerified && (
                        <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      Sent to {formData.email.replace(/(.{2})(.*)(@.*)/, '$1***$3')}
                    </p>
                    <button
                      type="button"
                      onClick={sendVerificationEmail}
                      className="mt-2 text-sm text-indigo-600 hover:text-indigo-500"
                    >
                      Resend email code
                    </button>
                  </div>

                  {/* SMS Verification */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      SMS Verification Code
                    </label>
                    <div className="flex items-center space-x-2">
                      <input
                        type="text"
                        value={verificationStatus.smsCode}
                        onChange={(e) => {
                          const code = e.target.value;
                          setVerificationStatus(prev => ({ ...prev, smsCode: code }));
                          if (code.length === 6) {
                            verifySmsCode(code);
                          }
                        }}
                        className="flex-1 border-gray-300 rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                        placeholder="Enter 6-digit code"
                        maxLength={6}
                      />
                      {verificationStatus.smsVerified && (
                        <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      Sent to {formData.phone.replace(/(.{3})(.*)(.{4})/, '$1***$3')}
                    </p>
                    <button
                      type="button"
                      onClick={sendVerificationSms}
                      className="mt-2 text-sm text-indigo-600 hover:text-indigo-500"
                    >
                      Resend SMS code
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Account-Specific Details */}
            {registrationStep === 3 && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">
                    {formData.accountType === 'business_admin' && 'Business Information'}
                    {formData.accountType === 'courier' && 'Courier Details'}
                    {formData.accountType === 'sender' && 'Profile Setup'}
                  </h3>

                  {/* Business Account Fields */}
                  {formData.accountType === 'business_admin' && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Company Name
                        </label>
                        <input
                          type="text"
                          value={formData.businessInfo.companyName}
                          onChange={(e) =>
                            setFormData(prev => ({
                              ...prev,
                              businessInfo: { ...prev.businessInfo, companyName: e.target.value }
                            }))
                          }
                          className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Business Registration Number
                        </label>
                        <input
                          type="text"
                          value={formData.businessInfo.businessRegistrationNumber}
                          onChange={(e) =>
                            setFormData(prev => ({
                              ...prev,
                              businessInfo: { ...prev.businessInfo, businessRegistrationNumber: e.target.value }
                            }))
                          }
                          className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Tax ID
                        </label>
                        <input
                          type="text"
                          value={formData.businessInfo.taxId}
                          onChange={(e) =>
                            setFormData(prev => ({
                              ...prev,
                              businessInfo: { ...prev.businessInfo, taxId: e.target.value }
                            }))
                          }
                          className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Industry Type
                        </label>
                        <select
                          value={formData.businessInfo.industryType}
                          onChange={(e) =>
                            setFormData(prev => ({
                              ...prev,
                              businessInfo: { ...prev.businessInfo, industryType: e.target.value }
                            }))
                          }
                          className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                          required
                        >
                          <option value="">Select Industry</option>
                          <option value="retail">Retail</option>
                          <option value="food">Food & Beverage</option>
                          <option value="healthcare">Healthcare</option>
                          <option value="technology">Technology</option>
                          <option value="professional_services">Professional Services</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                    </div>
                  )}

                  {/* Courier Account Fields */}
                  {formData.accountType === 'courier' && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Vehicle Type
                        </label>
                        <select
                          value={formData.courierInfo.vehicleType}
                          onChange={(e) =>
                            setFormData(prev => ({
                              ...prev,
                              courierInfo: { ...prev.courierInfo, vehicleType: e.target.value as any }
                            }))
                          }
                          className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                          required
                        >
                          <option value="bicycle">Bicycle</option>
                          <option value="motorcycle">Motorcycle</option>
                          <option value="car">Car</option>
                          <option value="van">Van</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Driver's License Number
                        </label>
                        <input
                          type="text"
                          value={formData.courierInfo.driverLicenseNumber}
                          onChange={(e) =>
                            setFormData(prev => ({
                              ...prev,
                              courierInfo: { ...prev.courierInfo, driverLicenseNumber: e.target.value }
                            }))
                          }
                          className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                          required
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700">
                            Vehicle Make
                          </label>
                          <input
                            type="text"
                            value={formData.courierInfo.vehicleMake}
                            onChange={(e) =>
                              setFormData(prev => ({
                                ...prev,
                                courierInfo: { ...prev.courierInfo, vehicleMake: e.target.value }
                              }))
                            }
                            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                            placeholder="Toyota, Honda, etc."
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700">
                            Vehicle Model
                          </label>
                          <input
                            type="text"
                            value={formData.courierInfo.vehicleModel}
                            onChange={(e) =>
                              setFormData(prev => ({
                                ...prev,
                                courierInfo: { ...prev.courierInfo, vehicleModel: e.target.value }
                              }))
                            }
                            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                            placeholder="Camry, Civic, etc."
                          />
                        </div>
                      </div>

                      {/* Document Upload */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Upload Required Documents
                        </label>
                        <div className="space-y-3">
                          {['drivers_license', 'vehicle_registration', 'insurance'].map((docType) => (
                            <div key={docType} className="border-2 border-dashed border-gray-300 rounded-lg p-4">
                              <div className="text-center">
                                <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                                  <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                                <div className="mt-4">
                                  <label className="cursor-pointer">
                                    <span className="mt-2 block text-sm font-medium text-gray-900">
                                      {docType.replace('_', ' ').toUpperCase()}
                                    </span>
                                    <input
                                      type="file"
                                      className="sr-only"
                                      accept="image/*,.pdf"
                                      onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                          uploadCourierDocument(file, docType);
                                        }
                                      }}
                                    />
                                    <span className="mt-2 block text-sm text-gray-600">
                                      Upload {docType.replace('_', ' ')}
                                    </span>
                                  </label>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Sender Account (minimal additional fields) */}
                  {formData.accountType === 'sender' && (
                    <div className="text-center py-8">
                      <svg className="mx-auto h-12 w-12 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <h3 className="mt-2 text-sm font-medium text-gray-900">Profile Complete</h3>
                      <p className="mt-1 text-sm text-gray-500">
                        Your sender profile is ready to go. You can start sending packages right away!
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Step 4: Terms and Completion */}
            {registrationStep === 4 && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">
                    Terms and Conditions
                  </h3>

                  <div className="bg-gray-50 rounded-lg p-4 mb-6 max-h-64 overflow-y-auto">
                    <h4 className="font-medium text-gray-900 mb-2">QuickDrop Terms of Service</h4>
                    <div className="text-sm text-gray-700 space-y-2">
                      <p>
                        By creating an account with QuickDrop, you agree to our terms of service and privacy policy.
                        This includes your agreement to use our platform responsibly and in accordance with all applicable laws.
                      </p>
                      <p>
                        For {formData.accountType} accounts, additional terms may apply regarding service usage,
                        payments, and responsibilities.
                      </p>
                      <p>
                        We are committed to protecting your privacy and personal information in accordance with
                        applicable data protection laws.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-start">
                      <input
                        id="terms"
                        type="checkbox"
                        className="mt-1 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                        required
                      />
                      <div className="ml-3 text-sm">
                        <label htmlFor="terms" className="text-gray-700">
                          I agree to the{' '}
                          <Link to="/terms" className="text-indigo-600 hover:text-indigo-500">
                            Terms of Service
                          </Link>{' '}
                          and{' '}
                          <Link to="/privacy" className="text-indigo-600 hover:text-indigo-500">
                            Privacy Policy
                          </Link>
                        </label>
                      </div>
                    </div>

                    <div className="flex items-start">
                      <input
                        id="marketing"
                        type="checkbox"
                        className="mt-1 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                      />
                      <div className="ml-3 text-sm">
                        <label htmlFor="marketing" className="text-gray-700">
                          I would like to receive marketing communications and updates about QuickDrop services
                        </label>
                      </div>
                    </div>

                    {formData.accountType === 'courier' && (
                      <div className="flex items-start">
                        <input
                          id="background-check"
                          type="checkbox"
                          className="mt-1 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                          required
                        />
                        <div className="ml-3 text-sm">
                          <label htmlFor="background-check" className="text-gray-700">
                            I consent to background check and verification processes required for courier services
                          </label>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex justify-between">
              {registrationStep > 1 && (
                <button
                  type="button"
                  onClick={prevStep}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  Previous
                </button>
              )}

              <div className="ml-auto">
                {registrationStep < 4 ? (
                  <button
                    type="button"
                    onClick={nextStep}
                    disabled={!isStepValid(registrationStep)}
                    className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${
                      isStepValid(registrationStep)
                        ? 'bg-indigo-600 hover:bg-indigo-700'
                        : 'bg-gray-300 cursor-not-allowed'
                    }`}
                  >
                    Next
                    <svg className="ml-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={submitRegistration}
                    disabled={isSubmitting}
                    className={`inline-flex items-center px-6 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${
                      isSubmitting
                        ? 'bg-gray-300 cursor-not-allowed'
                        : 'bg-indigo-600 hover:bg-indigo-700'
                    }`}
                  >
                    {isSubmitting ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Creating Account...
                      </>
                    ) : (
                      'Create Account'
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Login Link */}
          <div className="text-center">
            <p className="text-sm text-gray-600">
              Already have an account?{' '}
              <Link to="/login" className="font-medium text-indigo-600 hover:text-indigo-500">
                Sign in here
              </Link>
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default UV_Registration;