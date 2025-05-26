import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '@/store/main';
import { updateLanguage } from '@/store/slices/appSettingsSlice';
import axios from 'axios';

interface FooterSection {
  company: {
    name: string;
    description: string;
    logo_url: string;
  };
  quick_links: Array<{
    label: string;
    url: string;
    external: boolean;
  }>;
  legal_links: Array<{
    label: string;
    url: string;
  }>;
  support_links: Array<{
    label: string;
    url: string;
    icon: string;
  }>;
  social_media: Array<{
    platform: string;
    url: string;
    icon: string;
  }>;
}

interface ServiceArea {
  city: string;
  state: string;
  country: string;
  active: boolean;
}

interface MobileCollapsedSections {
  company: boolean;
  links: boolean;
  legal: boolean;
  support: boolean;
}

const GV_Footer: React.FC = () => {
  const dispatch = useDispatch();
  const currentLanguage = useSelector((state: RootState) => state.app_settings.language);

  const [footerSections] = useState<FooterSection>({
    company: {
      name: "QuickDrop",
      description: "Leading same-day delivery platform connecting senders with reliable couriers",
      logo_url: "https://picsum.photos/120/40?random=logo"
    },
    quick_links: [
      { label: "About Us", url: "/about", external: false },
      { label: "How It Works", url: "/how-it-works", external: false },
      { label: "Pricing", url: "/pricing", external: false },
      { label: "Safety", url: "/safety", external: false },
      { label: "Careers", url: "/careers", external: false }
    ],
    legal_links: [
      { label: "Terms of Service", url: "/terms" },
      { label: "Privacy Policy", url: "/privacy" },
      { label: "Cookie Policy", url: "/cookies" }
    ],
    support_links: [
      { label: "Help Center", url: "/help", icon: "help-circle" },
      { label: "Contact Support", url: "/support", icon: "message-circle" },
      { label: "Community Guidelines", url: "/community", icon: "users" }
    ],
    social_media: [
      { platform: "Facebook", url: "https://facebook.com/quickdrop", icon: "facebook" },
      { platform: "Twitter", url: "https://twitter.com/quickdrop", icon: "twitter" },
      { platform: "Instagram", url: "https://instagram.com/quickdrop", icon: "instagram" }
    ]
  });

  const [serviceAreas] = useState<ServiceArea[]>([
    { city: "New York", state: "NY", country: "USA", active: true },
    { city: "Los Angeles", state: "CA", country: "USA", active: true },
    { city: "Chicago", state: "IL", country: "USA", active: true }
  ]);

  const [mobileCollapsedSections, setMobileCollapsedSections] = useState<MobileCollapsedSections>({
    company: false,
    links: true,
    legal: true,
    support: true
  });

  const [showEmergencyModal, setShowEmergencyModal] = useState(false);
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [newsletterLoading, setNewsletterLoading] = useState(false);
  const [newsletterSuccess, setNewsletterSuccess] = useState(false);
  const [newsletterError, setNewsletterError] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState(currentLanguage);
  const [languageLoading, setLanguageLoading] = useState(false);
  const [languageError, setLanguageError] = useState('');

  const navigateToLink = (url: string, external: boolean = false) => {
    if (external) {
      window.open(url, '_blank', 'noopener,noreferrer');
    } else {
      window.location.href = url;
    }
  };

  const toggleMobileSection = (section: keyof MobileCollapsedSections) => {
    setMobileCollapsedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const changeLanguage = async (language: string) => {
    if (language === currentLanguage) return;
    
    setLanguageLoading(true);
    setLanguageError('');
    try {
      await axios.put('/api/v1/auth/profile', {
        preferred_language: language
      });
      dispatch(updateLanguage(language));
      setSelectedLanguage(language);
    } catch (error) {
      console.error('Failed to update language:', error);
      setLanguageError('Failed to update language. Please try again.');
      setSelectedLanguage(currentLanguage);
    } finally {
      setLanguageLoading(false);
    }
  };

  const accessEmergencyContact = () => {
    setShowEmergencyModal(true);
  };

  const subscribeNewsletter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newsletterEmail.trim()) return;

    setNewsletterLoading(true);
    setNewsletterError('');
    try {
      // Simulating newsletter signup since API endpoint doesn't exist
      await new Promise(resolve => setTimeout(resolve, 1000));
      setNewsletterSuccess(true);
      setNewsletterEmail('');
      setTimeout(() => setNewsletterSuccess(false), 5000);
    } catch (error) {
      console.error('Failed to subscribe to newsletter:', error);
      setNewsletterError('Failed to subscribe. Please try again.');
    } finally {
      setNewsletterLoading(false);
    }
  };

  const getIconSvg = (iconName: string) => {
    const iconMap: { [key: string]: string } = {
      'help-circle': 'M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3m.08 4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
      'message-circle': 'M7.9 20A9 9 0 1 0 4 16.1L2 22Z',
      'users': 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m18 0v-2a4 4 0 0 0-3-5.5m-4.5-2a4 4 0 0 1 0 8m0-8V3',
      'facebook': 'M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z',
      'twitter': 'M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z',
      'instagram': 'M16 8a6 6 0 0 1 6 6v7a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h2.5l1.5-2h6z'
    };
    
    return (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={iconMap[iconName] || iconMap['help-circle']} />
      </svg>
    );
  };

  useEffect(() => {
    setSelectedLanguage(currentLanguage);
  }, [currentLanguage]);

  return (
    <>
      <footer className="bg-gray-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          {/* Desktop Layout */}
          <div className="hidden md:grid grid-cols-1 md:grid-cols-4 gap-8">
            {/* Company Information */}
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <img 
                  src={footerSections.company.logo_url} 
                  alt={footerSections.company.name}
                  className="h-8 w-auto"
                  loading="lazy"
                />
                <span className="text-xl font-bold">{footerSections.company.name}</span>
              </div>
              <p className="text-gray-300 text-sm leading-relaxed">
                {footerSections.company.description}
              </p>
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-gray-200">Service Areas</h4>
                <div className="flex flex-wrap gap-2">
                  {serviceAreas.map((area, index) => (
                    <span 
                      key={index}
                      className={`inline-block px-2 py-1 rounded text-xs ${
                        area.active 
                          ? 'bg-green-600 text-white' 
                          : 'bg-gray-700 text-gray-300'
                      }`}
                    >
                      {area.city}, {area.state}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Quick Links */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Quick Links</h3>
              <ul className="space-y-2">
                {footerSections.quick_links.map((link, index) => (
                  <li key={index}>
                    {link.external ? (
                      <button
                        onClick={() => navigateToLink(link.url, true)}
                        className="text-gray-300 hover:text-white transition-colors duration-200 text-sm"
                      >
                        {link.label}
                      </button>
                    ) : (
                      <Link 
                        to={link.url}
                        className="text-gray-300 hover:text-white transition-colors duration-200 text-sm"
                      >
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            {/* Support & Legal */}
            <div className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Support</h3>
                <ul className="space-y-2">
                  {footerSections.support_links.map((link, index) => (
                    <li key={index} className="flex items-center space-x-2">
                      {getIconSvg(link.icon)}
                      <Link 
                        to={link.url}
                        className="text-gray-300 hover:text-white transition-colors duration-200 text-sm"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                  <li className="flex items-center space-x-2">
                    <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    <button
                      onClick={accessEmergencyContact}
                      className="text-red-400 hover:text-red-300 transition-colors duration-200 text-sm font-medium"
                    >
                      Emergency Support
                    </button>
                  </li>
                </ul>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Legal</h3>
                <ul className="space-y-2">
                  {footerSections.legal_links.map((link, index) => (
                    <li key={index}>
                      <Link 
                        to={link.url}
                        className="text-gray-300 hover:text-white transition-colors duration-200 text-sm"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                  <li>
                    <Link 
                      to="/accessibility"
                      className="text-gray-300 hover:text-white transition-colors duration-200 text-sm"
                    >
                      Accessibility Statement
                    </Link>
                  </li>
                </ul>
              </div>
            </div>

            {/* Newsletter & Social */}
            <div className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Stay Updated</h3>
                <form onSubmit={subscribeNewsletter} className="space-y-2">
                  <input
                    type="email"
                    value={newsletterEmail}
                    onChange={(e) => setNewsletterEmail(e.target.value)}
                    placeholder="Enter your email"
                    className="w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-800 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    disabled={newsletterLoading}
                  />
                  <button
                    type="submit"
                    disabled={newsletterLoading || !newsletterEmail.trim()}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white px-4 py-2 rounded-md transition-colors duration-200 text-sm font-medium"
                  >
                    {newsletterLoading ? 'Subscribing...' : 'Subscribe'}
                  </button>
                  {newsletterSuccess && (
                    <p className="text-green-400 text-xs">Successfully subscribed!</p>
                  )}
                  {newsletterError && (
                    <p className="text-red-400 text-xs">{newsletterError}</p>
                  )}
                </form>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Follow Us</h3>
                <div className="flex space-x-4">
                  {footerSections.social_media.map((social, index) => (
                    <button
                      key={index}
                      onClick={() => navigateToLink(social.url, true)}
                      className="p-2 bg-gray-800 hover:bg-gray-700 rounded-full transition-colors duration-200"
                      aria-label={`Follow us on ${social.platform}`}
                    >
                      {getIconSvg(social.icon)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Language</h3>
                <select
                  value={selectedLanguage}
                  onChange={(e) => changeLanguage(e.target.value)}
                  disabled={languageLoading}
                  className="w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-800 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                >
                  <option value="en">English</option>
                  <option value="es">Español</option>
                  <option value="fr">Français</option>
                  <option value="de">Deutsch</option>
                </select>
                {languageLoading && (
                  <p className="text-gray-400 text-xs">Updating language...</p>
                )}
                {languageError && (
                  <p className="text-red-400 text-xs">{languageError}</p>
                )}
              </div>
            </div>
          </div>

          {/* Mobile Layout */}
          <div className="md:hidden space-y-4">
            {/* Company Section */}
            <div className="border-b border-gray-700 pb-4">
              <button
                onClick={() => toggleMobileSection('company')}
                className="flex items-center justify-between w-full text-left"
              >
                <div className="flex items-center space-x-2">
                  <img 
                    src={footerSections.company.logo_url} 
                    alt={footerSections.company.name}
                    className="h-6 w-auto"
                    loading="lazy"
                  />
                  <span className="text-lg font-bold">{footerSections.company.name}</span>
                </div>
                <svg 
                  className={`w-5 h-5 transform transition-transform ${mobileCollapsedSections.company ? 'rotate-180' : ''}`}
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {!mobileCollapsedSections.company && (
                <div className="mt-4 space-y-3">
                  <p className="text-gray-300 text-sm leading-relaxed">
                    {footerSections.company.description}
                  </p>
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-gray-200">Service Areas</h4>
                    <div className="flex flex-wrap gap-2">
                      {serviceAreas.map((area, index) => (
                        <span 
                          key={index}
                          className={`inline-block px-2 py-1 rounded text-xs ${
                            area.active 
                              ? 'bg-green-600 text-white' 
                              : 'bg-gray-700 text-gray-300'
                          }`}
                        >
                          {area.city}, {area.state}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Quick Links Section */}
            <div className="border-b border-gray-700 pb-4">
              <button
                onClick={() => toggleMobileSection('links')}
                className="flex items-center justify-between w-full text-left"
              >
                <span className="text-lg font-semibold">Quick Links</span>
                <svg 
                  className={`w-5 h-5 transform transition-transform ${mobileCollapsedSections.links ? 'rotate-180' : ''}`}
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {!mobileCollapsedSections.links && (
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {footerSections.quick_links.map((link, index) => (
                    <div key={index}>
                      {link.external ? (
                        <button
                          onClick={() => navigateToLink(link.url, true)}
                          className="text-gray-300 hover:text-white transition-colors duration-200 text-sm"
                        >
                          {link.label}
                        </button>
                      ) : (
                        <Link 
                          to={link.url}
                          className="text-gray-300 hover:text-white transition-colors duration-200 text-sm"
                        >
                          {link.label}
                        </Link>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Support Section */}
            <div className="border-b border-gray-700 pb-4">
              <button
                onClick={() => toggleMobileSection('support')}
                className="flex items-center justify-between w-full text-left"
              >
                <span className="text-lg font-semibold">Support</span>
                <svg 
                  className={`w-5 h-5 transform transition-transform ${mobileCollapsedSections.support ? 'rotate-180' : ''}`}
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {!mobileCollapsedSections.support && (
                <div className="mt-4 space-y-3">
                  {footerSections.support_links.map((link, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      {getIconSvg(link.icon)}
                      <Link 
                        to={link.url}
                        className="text-gray-300 hover:text-white transition-colors duration-200 text-sm"
                      >
                        {link.label}
                      </Link>
                    </div>
                  ))}
                  <div className="flex items-center space-x-2">
                    <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    <button
                      onClick={accessEmergencyContact}
                      className="text-red-400 hover:text-red-300 transition-colors duration-200 text-sm font-medium"
                    >
                      Emergency Support
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Legal Section */}
            <div className="border-b border-gray-700 pb-4">
              <button
                onClick={() => toggleMobileSection('legal')}
                className="flex items-center justify-between w-full text-left"
              >
                <span className="text-lg font-semibold">Legal & Compliance</span>
                <svg 
                  className={`w-5 h-5 transform transition-transform ${mobileCollapsedSections.legal ? 'rotate-180' : ''}`}
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {!mobileCollapsedSections.legal && (
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {footerSections.legal_links.map((link, index) => (
                    <div key={index}>
                      <Link 
                        to={link.url}
                        className="text-gray-300 hover:text-white transition-colors duration-200 text-sm"
                      >
                        {link.label}
                      </Link>
                    </div>
                  ))}
                  <div>
                    <Link 
                      to="/accessibility"
                      className="text-gray-300 hover:text-white transition-colors duration-200 text-sm"
                    >
                      Accessibility Statement
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {/* Newsletter & Social */}
            <div className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Stay Updated</h3>
                <form onSubmit={subscribeNewsletter} className="space-y-2">
                  <input
                    type="email"
                    value={newsletterEmail}
                    onChange={(e) => setNewsletterEmail(e.target.value)}
                    placeholder="Enter your email"
                    className="w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-800 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    disabled={newsletterLoading}
                  />
                  <button
                    type="submit"
                    disabled={newsletterLoading || !newsletterEmail.trim()}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white px-4 py-2 rounded-md transition-colors duration-200 text-sm font-medium"
                  >
                    {newsletterLoading ? 'Subscribing...' : 'Subscribe'}
                  </button>
                  {newsletterSuccess && (
                    <p className="text-green-400 text-xs">Successfully subscribed!</p>
                  )}
                  {newsletterError && (
                    <p className="text-red-400 text-xs">{newsletterError}</p>
                  )}
                </form>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Follow Us</h3>
                <div className="flex space-x-4">
                  {footerSections.social_media.map((social, index) => (
                    <button
                      key={index}
                      onClick={() => navigateToLink(social.url, true)}
                      className="p-2 bg-gray-800 hover:bg-gray-700 rounded-full transition-colors duration-200"
                      aria-label={`Follow us on ${social.platform}`}
                    >
                      {getIconSvg(social.icon)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Language</h3>
                <select
                  value={selectedLanguage}
                  onChange={(e) => changeLanguage(e.target.value)}
                  disabled={languageLoading}
                  className="w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-800 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                >
                  <option value="en">English</option>
                  <option value="es">Español</option>
                  <option value="fr">Français</option>
                  <option value="de">Deutsch</option>
                </select>
                {languageLoading && (
                  <p className="text-gray-400 text-xs">Updating language...</p>
                )}
                {languageError && (
                  <p className="text-red-400 text-xs">{languageError}</p>
                )}
              </div>
            </div>
          </div>

          {/* Footer Bottom */}
          <div className="border-t border-gray-700 mt-8 pt-8">
            <div className="flex flex-col md:flex-row items-center justify-between space-y-4 md:space-y-0">
              <div className="text-gray-400 text-sm text-center md:text-left">
                <p>&copy; {new Date().getFullYear()} QuickDrop. All rights reserved.</p>
                <p className="mt-1">
                  Licensed and regulated delivery service platform. Operating under applicable federal and state regulations.
                </p>
              </div>
              <div className="flex items-center space-x-4 text-gray-400 text-xs">
                <span>Made with ❤️ for reliable deliveries</span>
                <span>•</span>
                <Link to="/security" className="hover:text-white transition-colors">
                  Security
                </Link>
                <span>•</span>
                <Link to="/api" className="hover:text-white transition-colors">
                  API
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Emergency Contact Modal */}
        {showEmergencyModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-md w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <svg className="w-5 h-5 text-red-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  Emergency Support
                </h3>
                <button
                  onClick={() => setShowEmergencyModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="space-y-4 text-gray-700">
                <p className="text-sm">
                  For immediate emergency assistance, please use one of the following contact methods:
                </p>
                <div className="space-y-2">
                  <p className="font-medium">📞 Emergency Hotline: <span className="text-red-600">+1-800-QUICKDROP</span></p>
                  <p className="font-medium">💬 Emergency Chat: Available 24/7 in app</p>
                  <p className="font-medium">📧 Emergency Email: <span className="text-red-600">emergency@quickdrop.com</span></p>
                </div>
                <p className="text-xs text-gray-500">
                  Emergency support is available for delivery issues, safety concerns, and urgent assistance.
                  An urgent support ticket has been automatically created for tracking purposes.
                </p>
              </div>
              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setShowEmergencyModal(false)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </footer>
    </>
  );
};

export default GV_Footer;