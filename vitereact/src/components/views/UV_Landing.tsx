import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { RootState } from '../store/main';

// Type definitions for component state
interface HeroStats {
  totalDeliveries: number;
  activeUsers: number;
  averageDeliveryTime: number;
  successRate: number;
  coverageCities: number;
}

interface Testimonial {
  customerName: string;
  rating: number;
  review: string;
  photoUrl: string;
  deliveryType: string;
}

interface CoverageArea {
  cityName: string;
  isActive: boolean;
  averageDeliveryTime: number;
  courierCount: number;
}

interface PricingTier {
  basePrice: number;
  perKmRate: number;
  estimatedTotal: number;
}

interface PricingPreview {
  standardDelivery: PricingTier;
  expressDelivery: PricingTier;
  priorityDelivery: PricingTier;
}

interface UserLocation {
  latitude: number | null;
  longitude: number | null;
  city: string;
  detected: boolean;
}

const UV_Landing: React.FC = () => {
  const navigate = useNavigate();
  const authState = useSelector((state: RootState) => state.auth);

  // State variables as defined in the datamap
  const [heroStats, setHeroStats] = useState<HeroStats>({
    totalDeliveries: 15420,
    activeUsers: 2340,
    averageDeliveryTime: 45,
    successRate: 98.5,
    coverageCities: 12,
  });

  const [testimonials, setTestimonials] = useState<Testimonial[]>([
    {
      customerName: 'Sarah Chen',
      rating: 5,
      review: 'Incredibly fast delivery! My package arrived 20 minutes earlier than expected. The courier was professional and kept me updated throughout.',
      photoUrl: 'https://picsum.photos/200/200?random=1',
      deliveryType: 'express',
    },
    {
      customerName: 'Marcus Rodriguez',
      rating: 5,
      review: 'Perfect for my business needs. Same-day delivery helped me save a crucial client meeting. Highly recommended!',
      photoUrl: 'https://picsum.photos/200/200?random=2',
      deliveryType: 'priority',
    },
    {
      customerName: 'Emily Johnson',
      rating: 4,
      review: 'Great service and reasonable pricing. The real-time tracking gave me peace of mind knowing exactly where my package was.',
      photoUrl: 'https://picsum.photos/200/200?random=3',
      deliveryType: 'standard',
    },
  ]);

  const [coverageAreas, setCoverageAreas] = useState<CoverageArea[]>([
    { cityName: 'New York', isActive: true, averageDeliveryTime: 45, courierCount: 150 },
    { cityName: 'Los Angeles', isActive: true, averageDeliveryTime: 52, courierCount: 120 },
    { cityName: 'Chicago', isActive: true, averageDeliveryTime: 48, courierCount: 95 },
    { cityName: 'Houston', isActive: true, averageDeliveryTime: 50, courierCount: 85 },
    { cityName: 'Phoenix', isActive: false, averageDeliveryTime: 0, courierCount: 0 },
  ]);

  const [pricingPreview, setPricingPreview] = useState<PricingPreview>({
    standardDelivery: { basePrice: 5, perKmRate: 2.5, estimatedTotal: 12.5 },
    expressDelivery: { basePrice: 8, perKmRate: 3.5, estimatedTotal: 18.5 },
    priorityDelivery: { basePrice: 12, perKmRate: 4.5, estimatedTotal: 25 },
  });

  const [userLocation, setUserLocation] = useState<UserLocation>({
    latitude: null,
    longitude: null,
    city: '',
    detected: false,
  });

  const [currentTestimonialIndex, setCurrentTestimonialIndex] = useState(0);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // API base URL with fallback
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3000';

  // Redirect authenticated users to appropriate dashboard
  useEffect(() => {
    if (authState.session?.is_authenticated && authState.user) {
      const userType = authState.user.user_type;
      if (userType === 'courier') {
        navigate('/courier-dashboard');
      } else {
        navigate('/dashboard');
      }
    }
  }, [authState.session, authState.user, navigate]);

  // Mock fetch real-time statistics (until backend endpoint is implemented)
  const fetchRealTimeStats = async () => {
    try {
      setIsLoadingStats(true);
      setApiError(null);
      
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Update with slightly randomized mock data to simulate real-time updates
      setHeroStats({
        totalDeliveries: 15420 + Math.floor(Math.random() * 100),
        activeUsers: 2340 + Math.floor(Math.random() * 50),
        averageDeliveryTime: 45 + Math.floor(Math.random() * 10) - 5,
        successRate: 98.5 + (Math.random() * 1 - 0.5),
        coverageCities: 12,
      });
    } catch (error) {
      console.error('Failed to fetch stats:', error);
      setApiError('Unable to load real-time statistics');
    } finally {
      setIsLoadingStats(false);
    }
  };

  // Mock load testimonials (until backend endpoint is implemented)
  const loadTestimonials = async () => {
    try {
      setApiError(null);
      // Using predefined testimonials data
      console.log('Testimonials loaded from mock data');
    } catch (error) {
      console.error('Failed to fetch testimonials:', error);
      setApiError('Unable to load customer testimonials');
    }
  };

  // Mock load coverage areas (until backend endpoint is implemented)
  const loadCoverageAreas = async () => {
    try {
      setApiError(null);
      // Using predefined coverage areas data
      console.log('Coverage areas loaded from mock data');
    } catch (error) {
      console.error('Failed to fetch coverage areas:', error);
      setApiError('Unable to load coverage information');
    }
  };

  // Mock detect user location (until backend endpoint is implemented)
  const detectUserLocation = async () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          
          try {
            setUserLocation({
              latitude,
              longitude,
              city: 'Your City', // Mock city name
              detected: true,
            });
            
            console.log('Location detected:', { latitude, longitude });
          } catch (error) {
            console.error('Failed to get location info:', error);
            setUserLocation({
              latitude,
              longitude,
              city: 'Unknown',
              detected: true,
            });
          }
        },
        (error) => {
          console.error('Geolocation error:', error);
        }
      );
    }
  };

  // Mock track conversion events (until backend endpoint is implemented)
  const trackConversionEvents = async (eventType: string, metadata: any = {}) => {
    try {
      console.log('Conversion event tracked:', {
        event_type: eventType,
        page: 'landing',
        metadata,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Failed to track conversion event:', error);
    }
  };

  // Navigation functions
  const navigateToRegistration = (accountType: string) => {
    trackConversionEvents('cta_click', { account_type: accountType });
    navigate(`/register?account_type=${accountType}`);
  };

  const navigateToLogin = () => {
    trackConversionEvents('login_click');
    navigate('/login');
  };

  // Initialize data on component mount
  useEffect(() => {
    fetchRealTimeStats();
    loadTestimonials();
    loadCoverageAreas();
    detectUserLocation();

    // Set up intervals for real-time updates
    const statsInterval = setInterval(fetchRealTimeStats, 30000); // Every 30 seconds

    return () => {
      clearInterval(statsInterval);
    };
  }, []);

  // Testimonial rotation
  useEffect(() => {
    if (testimonials.length > 0) {
      const interval = setInterval(() => {
        setCurrentTestimonialIndex((prev) => (prev + 1) % testimonials.length);
      }, 8000); // Rotate every 8 seconds

      return () => clearInterval(interval);
    }
  }, [testimonials]);

  return (
    <>
      {/* Error Banner */}
      {apiError && (
        <div className="bg-yellow-50 border border-yellow-200 px-4 py-3 text-yellow-800 text-sm">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <span>{apiError}</span>
            <button
              onClick={() => setApiError(null)}
              className="text-yellow-600 hover:text-yellow-800"
              aria-label="Dismiss error"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Navigation Header */}
      <nav className="bg-white shadow-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link to="/" className="flex items-center">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center mr-3">
                  <span className="text-white font-bold text-lg">Q</span>
                </div>
                <span className="text-2xl font-bold text-gray-900">QuickDrop</span>
              </Link>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-8">
              <a href="#how-it-works" className="text-gray-700 hover:text-blue-600 transition-colors">How It Works</a>
              <a href="#pricing" className="text-gray-700 hover:text-blue-600 transition-colors">Pricing</a>
              <a href="#coverage" className="text-gray-700 hover:text-blue-600 transition-colors">Coverage</a>
              <button
                onClick={navigateToLogin}
                className="text-gray-700 hover:text-blue-600 transition-colors"
              >
                Login
              </button>
              <button
                onClick={() => navigateToRegistration('sender')}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Sign Up
              </button>
            </div>

            {/* Mobile menu button */}
            <div className="md:hidden flex items-center">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="text-gray-700 hover:text-blue-600"
                aria-label="Toggle mobile menu"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
          </div>

          {/* Mobile Navigation */}
          {mobileMenuOpen && (
            <div className="md:hidden bg-white border-t border-gray-200">
              <div className="px-2 pt-2 pb-3 space-y-1">
                <a href="#how-it-works" className="block px-3 py-2 text-gray-700 hover:text-blue-600">How It Works</a>
                <a href="#pricing" className="block px-3 py-2 text-gray-700 hover:text-blue-600">Pricing</a>
                <a href="#coverage" className="block px-3 py-2 text-gray-700 hover:text-blue-600">Coverage</a>
                <button
                  onClick={navigateToLogin}
                  className="block px-3 py-2 text-gray-700 hover:text-blue-600 w-full text-left"
                >
                  Login
                </button>
                <button
                  onClick={() => navigateToRegistration('sender')}
                  className="block px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 w-full text-left"
                >
                  Sign Up
                </button>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-blue-50 to-indigo-100 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
              Same-Day Delivery
              <span className="text-blue-600"> Made Simple</span>
            </h1>
            <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
              Connect with reliable couriers for urgent package deliveries. Fast, secure, and trustworthy 
              delivery service available 24/7 in your city.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
              <button
                onClick={() => navigateToRegistration('sender')}
                className="bg-blue-600 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-blue-700 transition-colors shadow-lg"
              >
                Send a Package
              </button>
              <button
                onClick={() => navigateToRegistration('courier')}
                className="bg-white text-blue-600 px-8 py-4 rounded-lg text-lg font-semibold border-2 border-blue-600 hover:bg-blue-50 transition-colors"
              >
                Become a Courier
              </button>
            </div>

            {/* Trust Indicators */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
              <div>
                <div className="text-3xl font-bold text-blue-600">
                  {isLoadingStats ? '...' : heroStats.totalDeliveries.toLocaleString()}
                </div>
                <div className="text-gray-600">Deliveries Completed</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-blue-600">
                  {isLoadingStats ? '...' : `${heroStats.successRate.toFixed(1)}%`}
                </div>
                <div className="text-gray-600">Success Rate</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-blue-600">
                  {isLoadingStats ? '...' : `${heroStats.averageDeliveryTime}min`}
                </div>
                <div className="text-gray-600">Average Delivery</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-blue-600">
                  {isLoadingStats ? '...' : heroStats.coverageCities}
                </div>
                <div className="text-gray-600">Cities Covered</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">How QuickDrop Works</h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Get your packages delivered in just a few simple steps
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-blue-600">1</span>
              </div>
              <h3 className="text-xl font-semibold mb-2">Request Delivery</h3>
              <p className="text-gray-600">Enter pickup and delivery addresses with package details</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-blue-600">2</span>
              </div>
              <h3 className="text-xl font-semibold mb-2">Get Matched</h3>
              <p className="text-gray-600">We find the best available courier near your location</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-blue-600">3</span>
              </div>
              <h3 className="text-xl font-semibold mb-2">Track Live</h3>
              <p className="text-gray-600">Follow your package in real-time with GPS tracking</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-blue-600">4</span>
              </div>
              <h3 className="text-xl font-semibold mb-2">Delivered</h3>
              <p className="text-gray-600">Receive confirmation with photo proof of delivery</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Why Choose QuickDrop?</h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Professional service with the features you need
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white p-8 rounded-xl shadow-sm">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-3">Lightning Fast</h3>
              <p className="text-gray-600">Average delivery time of just 45 minutes. Perfect for urgent packages and last-minute needs.</p>
            </div>

            <div className="bg-white p-8 rounded-xl shadow-sm">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-3">Verified Couriers</h3>
              <p className="text-gray-600">All couriers are background-checked and verified for your peace of mind and package security.</p>
            </div>

            <div className="bg-white p-8 rounded-xl shadow-sm">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-3">Real-Time Tracking</h3>
              <p className="text-gray-600">Track your package every step of the way with live GPS updates and notifications.</p>
            </div>

            <div className="bg-white p-8 rounded-xl shadow-sm">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-3">Secure Payments</h3>
              <p className="text-gray-600">Safe and encrypted payment processing with multiple payment options and fraud protection.</p>
            </div>

            <div className="bg-white p-8 rounded-xl shadow-sm">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-3">24/7 Availability</h3>
              <p className="text-gray-600">Round-the-clock service for your urgent delivery needs, any day of the week.</p>
            </div>

            <div className="bg-white p-8 rounded-xl shadow-sm">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-3">Live Support</h3>
              <p className="text-gray-600">Get help when you need it with our responsive customer support team.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Target Audiences Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Perfect For Everyone</h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Whatever your delivery needs, we've got you covered
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-10 h-10 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2-2v2m8 0H8m8 0v2a2 2 0 01-2 2H10a2 2 0 01-2-2V6" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">Urban Professionals</h3>
              <p className="text-gray-600">Forgotten documents, last-minute gifts, or important packages - we handle your urgent delivery needs.</p>
            </div>

            <div className="text-center">
              <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-10 h-10 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">Small Businesses</h3>
              <p className="text-gray-600">Emergency supply runs, customer deliveries, and document transfers for your business operations.</p>
            </div>

            <div className="text-center">
              <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-10 h-10 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">E-commerce Sellers</h3>
              <p className="text-gray-600">Same-day delivery promises to your customers for competitive advantage and satisfaction.</p>
            </div>

            <div className="text-center">
              <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-10 h-10 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">Students</h3>
              <p className="text-gray-600">Affordable delivery for sending items to family, emergency supplies, and textbook exchanges.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      {testimonials.length > 0 && (
        <section className="py-20 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">What Our Customers Say</h2>
              <p className="text-xl text-gray-600 max-w-2xl mx-auto">
                Real feedback from real customers
              </p>
            </div>

            <div className="max-w-4xl mx-auto">
              <div className="bg-white rounded-2xl shadow-lg p-8 md:p-12">
                <div className="flex items-center mb-6">
                  <img
                    src={testimonials[currentTestimonialIndex]?.photoUrl}
                    alt={testimonials[currentTestimonialIndex]?.customerName}
                    className="w-16 h-16 rounded-full mr-4"
                  />
                  <div>
                    <h4 className="text-xl font-semibold">{testimonials[currentTestimonialIndex]?.customerName}</h4>
                    <div className="flex items-center">
                      {[...Array(5)].map((_, i) => (
                        <svg
                          key={i}
                          className={`w-5 h-5 ${
                            i < testimonials[currentTestimonialIndex]?.rating ? 'text-yellow-400' : 'text-gray-300'
                          }`}
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      ))}
                    </div>
                  </div>
                </div>
                <blockquote className="text-xl text-gray-700 italic">
                  "{testimonials[currentTestimonialIndex]?.review}"
                </blockquote>
                <div className="mt-4 text-sm text-gray-500 capitalize">
                  {testimonials[currentTestimonialIndex]?.deliveryType} delivery
                </div>
              </div>

              {/* Testimonial indicators */}
              <div className="flex justify-center mt-8 space-x-2">
                {testimonials.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentTestimonialIndex(index)}
                    className={`w-3 h-3 rounded-full ${
                      index === currentTestimonialIndex ? 'bg-blue-600' : 'bg-gray-300'
                    }`}
                    aria-label={`View testimonial ${index + 1}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Pricing Section */}
      <section id="pricing" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Transparent Pricing</h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              No hidden fees. Pay only for what you need.
              {userLocation.detected && userLocation.city && (
                <span className="block mt-2 text-blue-600">
                  Pricing for {userLocation.city}
                </span>
              )}
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Standard Delivery */}
            <div className="bg-white border-2 border-gray-200 rounded-xl p-8 text-center">
              <h3 className="text-2xl font-bold mb-4">Standard</h3>
              <div className="mb-4">
                <span className="text-4xl font-bold text-blue-600">${pricingPreview.standardDelivery.basePrice}</span>
                <span className="text-gray-600"> + ${pricingPreview.standardDelivery.perKmRate}/km</span>
              </div>
              <div className="text-gray-600 mb-6">Delivery within 2-6 hours</div>
              <ul className="text-left space-y-3 mb-8">
                <li className="flex items-center">
                  <svg className="w-5 h-5 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Real-time tracking
                </li>
                <li className="flex items-center">
                  <svg className="w-5 h-5 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  SMS notifications
                </li>
                <li className="flex items-center">
                  <svg className="w-5 h-5 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Photo proof
                </li>
              </ul>
              <div className="text-sm text-gray-500 mb-4">
                Example: ${pricingPreview.standardDelivery.estimatedTotal} for 5km delivery
              </div>
              <button
                onClick={() => navigateToRegistration('sender')}
                className="w-full bg-gray-100 text-gray-900 py-3 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
              >
                Get Started
              </button>
            </div>

            {/* Express Delivery */}
            <div className="bg-white border-2 border-blue-500 rounded-xl p-8 text-center relative">
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                <span className="bg-blue-500 text-white px-4 py-1 rounded-full text-sm font-semibold">Most Popular</span>
              </div>
              <h3 className="text-2xl font-bold mb-4">Express</h3>
              <div className="mb-4">
                <span className="text-4xl font-bold text-blue-600">${pricingPreview.expressDelivery.basePrice}</span>
                <span className="text-gray-600"> + ${pricingPreview.expressDelivery.perKmRate}/km</span>
              </div>
              <div className="text-gray-600 mb-6">Delivery within 1-2 hours</div>
              <ul className="text-left space-y-3 mb-8">
                <li className="flex items-center">
                  <svg className="w-5 h-5 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Priority matching
                </li>
                <li className="flex items-center">
                  <svg className="w-5 h-5 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Live chat support
                </li>
                <li className="flex items-center">
                  <svg className="w-5 h-5 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  All Standard features
                </li>
              </ul>
              <div className="text-sm text-gray-500 mb-4">
                Example: ${pricingPreview.expressDelivery.estimatedTotal} for 5km delivery
              </div>
              <button
                onClick={() => navigateToRegistration('sender')}
                className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
              >
                Get Started
              </button>
            </div>

            {/* Priority Delivery */}
            <div className="bg-white border-2 border-gray-200 rounded-xl p-8 text-center">
              <h3 className="text-2xl font-bold mb-4">Priority</h3>
              <div className="mb-4">
                <span className="text-4xl font-bold text-blue-600">${pricingPreview.priorityDelivery.basePrice}</span>
                <span className="text-gray-600"> + ${pricingPreview.priorityDelivery.perKmRate}/km</span>
              </div>
              <div className="text-gray-600 mb-6">Delivery within 30-60 minutes</div>
              <ul className="text-left space-y-3 mb-8">
                <li className="flex items-center">
                  <svg className="w-5 h-5 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Emergency priority
                </li>
                <li className="flex items-center">
                  <svg className="w-5 h-5 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Dedicated support
                </li>
                <li className="flex items-center">
                  <svg className="w-5 h-5 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  All Express features
                </li>
              </ul>
              <div className="text-sm text-gray-500 mb-4">
                Example: ${pricingPreview.priorityDelivery.estimatedTotal} for 5km delivery
              </div>
              <button
                onClick={() => navigateToRegistration('sender')}
                className="w-full bg-gray-100 text-gray-900 py-3 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
              >
                Get Started
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Coverage Area Section */}
      <section id="coverage" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Service Coverage</h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              We're expanding rapidly. Check if we deliver in your city.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {coverageAreas.map((area, index) => (
              <div
                key={index}
                className={`p-6 rounded-xl border-2 ${
                  area.isActive 
                    ? 'border-green-200 bg-green-50' 
                    : 'border-gray-200 bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold">{area.cityName}</h3>
                  <div className={`w-3 h-3 rounded-full ${
                    area.isActive ? 'bg-green-500' : 'bg-gray-400'
                  }`} />
                </div>
                {area.isActive ? (
                  <div className="space-y-2 text-sm text-gray-600">
                    <div>Avg. delivery: {area.averageDeliveryTime} min</div>
                    <div>{area.courierCount} active couriers</div>
                    <div className="text-green-600 font-medium">✓ Available now</div>
                  </div>
                ) : (
                  <div className="text-sm text-gray-500">
                    Coming soon
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Frequently Asked Questions</h2>
            <p className="text-xl text-gray-600">
              Everything you need to know about QuickDrop
            </p>
          </div>

          <div className="space-y-6">
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-2">How fast is same-day delivery?</h3>
              <p className="text-gray-600">Most deliveries are completed within 45 minutes to 2 hours, depending on distance and delivery type. Our Priority service can deliver within 30-60 minutes.</p>
            </div>

            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-2">What areas do you cover?</h3>
              <p className="text-gray-600">We currently serve {coverageAreas.filter(area => area.isActive).length} major cities and are expanding rapidly. Check our coverage map to see if we deliver in your area.</p>
            </div>

            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-2">How much does delivery cost?</h3>
              <p className="text-gray-600">Pricing starts at $5 plus distance charges. The exact cost depends on package size, delivery type, and distance. You'll see the total price before booking.</p>
            </div>

            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-2">Are your couriers verified?</h3>
              <p className="text-gray-600">Yes, all couriers undergo background checks, document verification, and vehicle inspections. We also track performance and customer ratings.</p>
            </div>

            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-2">What if my package is damaged or lost?</h3>
              <p className="text-gray-600">We provide insurance coverage and have a comprehensive claims process. Contact our support team immediately if you experience any issues.</p>
            </div>

            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-2">Can I track my delivery in real-time?</h3>
              <p className="text-gray-600">Absolutely! You can track your courier's location on a live map, receive notifications, and communicate directly with your courier through our app.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-20 bg-blue-600">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
            Ready to Send Your First Package?
          </h2>
          <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
            Join thousands of satisfied customers who trust QuickDrop for their delivery needs.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => navigateToRegistration('sender')}
              className="bg-white text-blue-600 px-8 py-4 rounded-lg text-lg font-semibold hover:bg-gray-100 transition-colors"
            >
              Send Package Now
            </button>
            <button
              onClick={() => navigateToRegistration('courier')}
              className="bg-transparent text-white px-8 py-4 rounded-lg text-lg font-semibold border-2 border-white hover:bg-white hover:text-blue-600 transition-colors"
            >
              Become a Courier
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center mb-4">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center mr-3">
                  <span className="text-white font-bold text-lg">Q</span>
                </div>
                <span className="text-2xl font-bold">QuickDrop</span>
              </div>
              <p className="text-gray-400 mb-4">
                Leading same-day delivery platform connecting senders with reliable couriers.
              </p>
              <div className="flex space-x-4">
                <a href="#" className="text-gray-400 hover:text-white" aria-label="Twitter">
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z"/>
                  </svg>
                </a>
                <a href="#" className="text-gray-400 hover:text-white" aria-label="Facebook">
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M22.46 6c-.77.35-1.6.58-2.46.69.88-.53 1.56-1.37 1.88-2.38-.83.5-1.75.85-2.72 1.05C18.37 4.5 17.26 4 16 4c-2.35 0-4.27 1.92-4.27 4.29 0 .34.04.67.11.98C8.28 9.09 5.11 7.38 3 4.79c-.37.63-.58 1.37-.58 2.15 0 1.49.75 2.81 1.91 3.56-.71 0-1.37-.2-1.95-.5v.03c0 2.08 1.48 3.82 3.44 4.21a4.22 4.22 0 0 1-1.93.07 4.28 4.28 0 0 0 4 2.98 8.521 8.521 0 0 1-5.33 1.84c-.34 0-.68-.02-1.02-.06C3.44 20.29 5.7 21 8.12 21 16 21 20.33 14.46 20.33 8.79c0-.19 0-.37-.01-.56.84-.6 1.56-1.36 2.14-2.23z"/>
                  </svg>
                </a>
                <a href="#" className="text-gray-400 hover:text-white" aria-label="Instagram">
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.174-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.663.967-2.911 2.168-2.911 1.024 0 1.518.769 1.518 1.688 0 1.029-.653 2.567-.992 3.992-.285 1.193.6 2.165 1.775 2.165 2.128 0 3.768-2.245 3.768-5.487 0-2.861-2.063-4.869-5.008-4.869-3.41 0-5.409 2.562-5.409 5.199 0 1.033.394 2.143.889 2.741.099.12.112.225.085.347-.09.375-.293 1.199-.334 1.363-.053.225-.172.271-.402.165-1.495-.69-2.433-2.878-2.433-4.646 0-3.776 2.748-7.252 7.92-7.252 4.158 0 7.392 2.967 7.392 6.923 0 4.135-2.607 7.462-6.233 7.462-1.214 0-2.357-.629-2.746-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24.009 12.017 24.009c6.624 0 11.99-5.367 11.99-11.988C24.007 5.367 18.641.001.012.001z"/>
                  </svg>
                </a>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-4">Company</h3>
              <ul className="space-y-2">
                <li><a href="#" className="text-gray-400 hover:text-white">About Us</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white">Careers</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white">Press</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white">Blog</a></li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-4">Support</h3>
              <ul className="space-y-2">
                <li><Link to="/help" className="text-gray-400 hover:text-white">Help Center</Link></li>
                <li><a href="#" className="text-gray-400 hover:text-white">Safety</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white">Contact Us</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white">Community Guidelines</a></li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-4">Legal</h3>
              <ul className="space-y-2">
                <li><a href="#" className="text-gray-400 hover:text-white">Terms of Service</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white">Privacy Policy</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white">Cookie Policy</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white">Accessibility</a></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-800 mt-12 pt-8 text-center text-gray-400">
            <p>&copy; 2024 QuickDrop. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </>
  );
};

export default UV_Landing;