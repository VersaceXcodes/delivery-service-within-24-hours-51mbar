import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import axios from 'axios';

const UV_PasswordReset: React.FC = () => {
  const { '*': urlPath } = useParams();
  const [searchParams] = useSearchParams();
  const emailParam = searchParams.get('email');

  // Simplified state based on actual backend API capabilities
  const [resetStep, setResetStep] = useState<'request' | 'reset' | 'success'>(token ? 'reset' : 'request');
  const [resetForm, setResetForm] = useState({
    email: emailParam || '',
    newPassword: '',
    confirmNewPassword: ''
  });
  const [passwordStrength, setPasswordStrength] = useState({
    score: 0,
    requirements: {
      length: false,
      uppercase: false,
      lowercase: false,
      numbers: false,
      symbols: false
    },
    suggestions: [] as string[]
  });

  // Local state for UI
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Password strength checker
  const checkPasswordStrength = useCallback((password: string) => {
    const requirements = {
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      numbers: /\d/.test(password),
      symbols: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)
    };

    const score = Object.values(requirements).filter(Boolean).length * 20;
    const suggestions = [];

    if (!requirements.length) suggestions.push('Use at least 8 characters');
    if (!requirements.uppercase) suggestions.push('Add uppercase letters');
    if (!requirements.lowercase) suggestions.push('Add lowercase letters');
    if (!requirements.numbers) suggestions.push('Add numbers');
    if (!requirements.symbols) suggestions.push('Add special characters');

    setPasswordStrength({
      score,
      requirements,
      suggestions
    });
  }, []);

  // Request password reset (forgot password)
  const requestPasswordReset = async () => {
    if (!resetForm.email) {
      setError('Email address is required');
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      const response = await axios.post('/api/v1/auth/forgot-password', {
        email: resetForm.email
      });

      if (response.data.success) {
        setSuccess('Password reset link sent to your email address. Please check your inbox.');
      } else {
        setError(response.data.message || 'Failed to send password reset email');
      }
    } catch (error: any) {
      if (error.response?.data) {
        setError(error.response.data.message || error.response.data.error || 'Failed to process password reset request');
      } else {
        setError('Network error. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Reset password with token
  const resetPassword = async () => {
    if (!resetForm.newPassword || !resetForm.confirmNewPassword) {
      setError('Both password fields are required');
      return;
    }

    if (resetForm.newPassword !== resetForm.confirmNewPassword) {
      setError('Passwords do not match');
      return;
    }

    if (passwordStrength.score < 60) {
      setError('Password does not meet security requirements');
      return;
    }

    if (!token) {
      setError('Invalid reset token');
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      const response = await axios.post('/api/v1/auth/reset-password', {
        token,
        new_password: resetForm.newPassword
      });

      if (response.data.success) {
        setResetStep('success');
        setSuccess('Password reset successfully');
      } else {
        setError(response.data.message || 'Failed to reset password');
      }
    } catch (error: any) {
      if (error.response?.data) {
        setError(error.response.data.message || error.response.data.error || 'Failed to reset password');
      } else {
        setError('Network error. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Handle form submissions
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    switch (resetStep) {
      case 'request':
        requestPasswordReset();
        break;
      case 'reset':
        resetPassword();
        break;
      default:
        break;
    }
  };

  // Update password strength when password changes
  useEffect(() => {
    if (resetForm.newPassword) {
      checkPasswordStrength(resetForm.newPassword);
    }
  }, [resetForm.newPassword, checkPasswordStrength]);

  return (
    <>
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="flex justify-center">
            <Link to="/">
              <img 
                className="h-12 w-auto" 
                src="https://picsum.photos/200/60?random=quickdrop-logo" 
                alt="QuickDrop" 
              />
            </Link>
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Reset Your Password
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            {resetStep === 'request' && 'Enter your email address to receive a password reset link'}
            {resetStep === 'reset' && 'Create a new secure password'}
            {resetStep === 'success' && 'Your password has been successfully reset'}
          </p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
            
            {/* Error/Success Messages */}
            {error && (
              <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">Error</h3>
                    <div className="mt-2 text-sm text-red-700">{error}</div>
                  </div>
                </div>
              </div>
            )}

            {success && (
              <div className="mb-6 bg-green-50 border border-green-200 rounded-md p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-green-800">Success</h3>
                    <div className="mt-2 text-sm text-green-700">{success}</div>
                  </div>
                </div>
              </div>
            )}

            <form className="space-y-6" onSubmit={handleSubmit}>
              
              {/* Step 1: Request Password Reset */}
              {resetStep === 'request' && (
                <>
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                      Email address
                    </label>
                    <div className="mt-1">
                      <input
                        id="email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        required
                        value={resetForm.email}
                        onChange={(e) => setResetForm(prev => ({ ...prev, email: e.target.value }))}
                        className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        placeholder="Enter your email address"
                      />
                    </div>
                  </div>

                  <div>
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? 'Sending...' : 'Send Reset Link'}
                    </button>
                  </div>
                </>
              )}

              {/* Step 2: Reset Password */}
              {resetStep === 'reset' && (
                <>
                  <div>
                    <label htmlFor="new_password" className="block text-sm font-medium text-gray-700">
                      New Password
                    </label>
                    <div className="mt-1">
                      <input
                        id="new_password"
                        name="new_password"
                        type="password"
                        required
                        value={resetForm.newPassword}
                        onChange={(e) => setResetForm(prev => ({ ...prev, newPassword: e.target.value }))}
                        className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        placeholder="Enter new password"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="confirm_password" className="block text-sm font-medium text-gray-700">
                      Confirm Password
                    </label>
                    <div className="mt-1">
                      <input
                        id="confirm_password"
                        name="confirm_password"
                        type="password"
                        required
                        value={resetForm.confirmNewPassword}
                        onChange={(e) => setResetForm(prev => ({ ...prev, confirmNewPassword: e.target.value }))}
                        className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        placeholder="Confirm new password"
                      />
                    </div>
                  </div>

                  {/* Password Strength Indicator */}
                  {resetForm.newPassword && (
                    <div className="mt-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700">Password Strength</span>
                        <span className={`text-sm font-medium ${
                          passwordStrength.score >= 80 ? 'text-green-600' :
                          passwordStrength.score >= 60 ? 'text-yellow-600' :
                          'text-red-600'
                        }`}>
                          {passwordStrength.score >= 80 ? 'Strong' :
                           passwordStrength.score >= 60 ? 'Good' :
                           passwordStrength.score >= 40 ? 'Fair' : 'Weak'}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full transition-all duration-300 ${
                            passwordStrength.score >= 80 ? 'bg-green-600' :
                            passwordStrength.score >= 60 ? 'bg-yellow-600' :
                            'bg-red-600'
                          }`}
                          style={{ width: `${passwordStrength.score}%` }}
                        />
                      </div>
                      
                      {/* Password Requirements */}
                      <div className="mt-3 space-y-1">
                        {Object.entries(passwordStrength.requirements).map(([key, met]) => (
                          <div key={key} className="flex items-center text-sm">
                            <div className={`mr-2 ${met ? 'text-green-600' : 'text-gray-400'}`}>
                              {met ? '✓' : '○'}
                            </div>
                            <span className={met ? 'text-green-600' : 'text-gray-500'}>
                              {key === 'length' && '8+ characters'}
                              {key === 'uppercase' && 'Uppercase letter'}
                              {key === 'lowercase' && 'Lowercase letter'}
                              {key === 'numbers' && 'Number'}
                              {key === 'symbols' && 'Special character'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Password Match Indicator */}
                  {resetForm.confirmNewPassword && (
                    <div className="flex items-center mt-2">
                      <div className={`mr-2 ${
                        resetForm.newPassword === resetForm.confirmNewPassword ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {resetForm.newPassword === resetForm.confirmNewPassword ? '✓' : '✗'}
                      </div>
                      <span className={`text-sm ${
                        resetForm.newPassword === resetForm.confirmNewPassword ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {resetForm.newPassword === resetForm.confirmNewPassword ? 'Passwords match' : 'Passwords do not match'}
                      </span>
                    </div>
                  )}

                  <div>
                    <button
                      type="submit"
                      disabled={loading || passwordStrength.score < 60 || resetForm.newPassword !== resetForm.confirmNewPassword}
                      className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? 'Updating Password...' : 'Update Password'}
                    </button>
                  </div>
                </>
              )}

              {/* Step 3: Success */}
              {resetStep === 'success' && (
                <div className="text-center">
                  <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100">
                    <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h3 className="mt-4 text-lg font-medium text-gray-900">Password Reset Complete</h3>
                  <p className="mt-2 text-sm text-gray-600">
                    Your password has been successfully updated. You can now log in with your new password.
                  </p>
                  <div className="mt-6 space-y-3">
                    <Link
                      to="/login"
                      className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      Go to Login
                    </Link>
                    <p className="text-xs text-gray-500">
                      For security, all other sessions have been logged out.
                    </p>
                  </div>
                </div>
              )}
            </form>

            {/* Back to Login Link */}
            {resetStep !== 'success' && (
              <div className="mt-6 text-center">
                <Link
                  to="/login"
                  className="text-sm font-medium text-blue-600 hover:text-blue-500"
                >
                  ← Back to Login
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-xs text-gray-500">
            Having trouble? <a href="/help" className="font-medium text-blue-600 hover:text-blue-500">Contact Support</a>
          </p>
        </div>
      </div>
    </>
  );
};

export default UV_PasswordReset;