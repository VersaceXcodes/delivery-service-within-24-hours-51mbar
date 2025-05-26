import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { RootState } from '@/store/main';

interface HelpCategory {
  category_id: string;
  category_name: string;
  icon_url: string;
  article_count: number;
  is_popular: boolean;
}

interface SearchResult {
  article_id: string;
  title: string;
  excerpt: string;
  category: string;
  relevance_score: number;
  view_count: number;
  last_updated: string;
}

interface PopularArticle {
  article_id: string;
  title: string;
  category: string;
  view_count: number;
  helpful_votes: number;
  thumbnail_url: string;
}

interface HelpArticle {
  article_id: string;
  title: string;
  content: string;
  category: string;
  screenshots: Array<{
    image_url: string;
    caption: string;
    step_number: number;
  }>;
  video_url: string;
  related_articles: Array<{
    article_id: string;
    title: string;
  }>;
  downloadable_resources: Array<{
    resource_name: string;
    download_url: string;
    file_type: string;
  }>;
  user_rating: number;
  total_votes: number;
  last_updated: string;
}

interface FAQ {
  faq_id: string;
  question: string;
  answer: string;
  category: string;
  is_frequently_searched: boolean;
  helpful_votes: number;
  last_updated: string;
}

interface ContactMethod {
  method: string;
  is_available: boolean;
  estimated_response_time: string;
  description: string;
  contact_info: string;
}

interface ErrorState {
  message: string;
  type: 'error' | 'warning' | 'info';
  show: boolean;
}

const UV_Help: React.FC = () => {
  const dispatch = useDispatch();
  const auth_state = useSelector((state: RootState) => state.auth);
  const app_settings = useSelector((state: RootState) => state.app_settings);
  
  // URL parameters with refs to avoid dependency issues
  const urlParamsRef = useRef(new URLSearchParams(window.location.search));
  const initialCategory = urlParamsRef.current.get('category') || '';
  const initialSearch = urlParamsRef.current.get('search') || '';

  // State variables
  const [helpCategories, setHelpCategories] = useState<HelpCategory[]>([
    {
      category_id: '1',
      category_name: 'Getting Started',
      icon_url: 'https://picsum.photos/40/40?random=1',
      article_count: 12,
      is_popular: true
    },
    {
      category_id: '2',
      category_name: 'Delivery Issues',
      icon_url: 'https://picsum.photos/40/40?random=2',
      article_count: 8,
      is_popular: true
    },
    {
      category_id: '3',
      category_name: 'Payment & Billing',
      icon_url: 'https://picsum.photos/40/40?random=3',
      article_count: 15,
      is_popular: false
    }
  ]);
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [popularArticles, setPopularArticles] = useState<PopularArticle[]>([
    {
      article_id: '1',
      title: 'How to Create Your First Delivery',
      category: 'Getting Started',
      view_count: 1250,
      helpful_votes: 98,
      thumbnail_url: 'https://picsum.photos/300/200?random=1'
    },
    {
      article_id: '2',
      title: 'Understanding Delivery Pricing',
      category: 'Payment & Billing',
      view_count: 950,
      helpful_votes: 76,
      thumbnail_url: 'https://picsum.photos/300/200?random=2'
    },
    {
      article_id: '3',
      title: 'Tracking Your Delivery',
      category: 'Delivery Issues',
      view_count: 800,
      helpful_votes: 65,
      thumbnail_url: 'https://picsum.photos/300/200?random=3'
    }
  ]);
  const [selectedArticle, setSelectedArticle] = useState<HelpArticle | null>(null);
  const [recentlyViewedArticles, setRecentlyViewedArticles] = useState<Array<{
    article_id: string;
    title: string;
    viewed_at: string;
    category: string;
  }>>([]);
  const [troubleshootingWizard, setTroubleshootingWizard] = useState<any>(null);
  const [faqData, setFaqData] = useState<{
    categories: Array<{ category_name: string; faq_count: number }>;
    questions: FAQ[];
  }>({
    categories: [
      { category_name: 'General', faq_count: 10 },
      { category_name: 'Delivery', faq_count: 8 },
      { category_name: 'Payment', faq_count: 6 }
    ],
    questions: [
      {
        faq_id: '1',
        question: 'How long does delivery usually take?',
        answer: 'Most deliveries are completed within 1-2 hours, depending on distance and traffic conditions.',
        category: 'Delivery',
        is_frequently_searched: true,
        helpful_votes: 156,
        last_updated: new Date().toISOString()
      },
      {
        faq_id: '2',
        question: 'What payment methods do you accept?',
        answer: 'We accept all major credit cards, PayPal, Apple Pay, and Google Pay.',
        category: 'Payment',
        is_frequently_searched: true,
        helpful_votes: 124,
        last_updated: new Date().toISOString()
      }
    ]
  });
  const [supportTicketForm, setSupportTicketForm] = useState({
    is_visible: false,
    form_data: {
      issue_category: '',
      priority: 'normal',
      subject: '',
      description: '',
      attachments: []
    },
    validation_errors: {},
    submission_status: 'idle'
  });
  const [contactMethods] = useState<ContactMethod[]>([
    {
      method: 'live_chat',
      is_available: true,
      estimated_response_time: '< 2 minutes',
      description: 'Real-time chat with support agents',
      contact_info: ''
    },
    {
      method: 'email',
      is_available: true,
      estimated_response_time: '2-4 hours',
      description: 'Email support for detailed inquiries',
      contact_info: 'support@quickdrop.com'
    },
    {
      method: 'phone',
      is_available: true,
      estimated_response_time: '< 1 minute',
      description: 'Direct phone support',
      contact_info: '+1-800-QUICKDROP'
    }
  ]);
  const [communityForum, setCommunityForum] = useState({
    recent_discussions: [],
    expert_contributors: []
  });
  const [userFeedback, setUserFeedback] = useState({
    current_rating: 0,
    feedback_text: '',
    is_helpful_vote: null,
    submission_status: 'idle'
  });
  const [error, setError] = useState<ErrorState>({ message: '', type: 'error', show: false });

  // Loading states
  const [loading, setLoading] = useState({
    categories: false,
    search: false,
    article: false,
    faq: false,
    wizard: false
  });

  // UI states
  const [activeTab, setActiveTab] = useState('help');
  const [selectedCategory, setSelectedCategory] = useState(initialCategory);
  const [showArticleModal, setShowArticleModal] = useState(false);
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [showWizardModal, setShowWizardModal] = useState(false);

  // Refs for modal management
  const articleModalRef = useRef<HTMLDivElement>(null);
  const supportModalRef = useRef<HTMLDivElement>(null);
  const wizardModalRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Error handling helper
  const showError = useCallback((message: string, type: 'error' | 'warning' | 'info' = 'error') => {
    setError({ message, type, show: true });
    setTimeout(() => {
      setError(prev => ({ ...prev, show: false }));
    }, 5000);
  }, []);

  // Load initial data
  useEffect(() => {
    loadHelpCategories();
    loadPopularArticles();
    loadFAQContent();
    if (auth_state.user) {
      loadRecentlyViewed();
    }
  }, [auth_state.user]);

  // Handle URL parameters
  useEffect(() => {
    if (initialCategory) {
      loadHelpCategory(initialCategory);
    }
    if (initialSearch) {
      searchHelpContent(initialSearch);
    }
  }, []);

  // Cleanup search timeout
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  // API Functions with proper error handling
  const loadHelpCategories = async () => {
    setLoading(prev => ({ ...prev, categories: true }));
    try {
      // Using mock data since help endpoints don't exist in API spec
      // Replace with actual API call when endpoints are implemented
      // const response = await axios.get('/api/v1/help/categories');
      // setHelpCategories(response.data.categories || []);
      setLoading(prev => ({ ...prev, categories: false }));
    } catch (error) {
      console.error('Failed to load help categories:', error);
      showError('Failed to load help categories. Please try again.');
      setLoading(prev => ({ ...prev, categories: false }));
    }
  };

  const loadPopularArticles = async () => {
    try {
      // Using mock data since help endpoints don't exist in API spec
      // const response = await axios.get('/api/v1/help/popular');
      // setPopularArticles(response.data.articles || []);
    } catch (error) {
      console.error('Failed to load popular articles:', error);
      showError('Failed to load popular articles.');
    }
  };

  const loadFAQContent = async () => {
    setLoading(prev => ({ ...prev, faq: true }));
    try {
      // Using mock data since help endpoints don't exist in API spec
      // const response = await axios.get('/api/v1/help/faq');
      // setFaqData(response.data);
      setLoading(prev => ({ ...prev, faq: false }));
    } catch (error) {
      console.error('Failed to load FAQ content:', error);
      showError('Failed to load FAQ content.');
      setLoading(prev => ({ ...prev, faq: false }));
    }
  };

  const loadRecentlyViewed = async () => {
    try {
      // Mock recently viewed articles
      if (auth_state.user) {
        setRecentlyViewedArticles([
          {
            article_id: '1',
            title: 'How to Create Your First Delivery',
            viewed_at: new Date().toISOString(),
            category: 'Getting Started'
          }
        ]);
      }
    } catch (error) {
      console.error('Failed to load recently viewed articles:', error);
    }
  };

  const searchHelpContent = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setLoading(prev => ({ ...prev, search: true }));
    try {
      // Mock search results
      const mockResults: SearchResult[] = [
        {
          article_id: '1',
          title: `Search result for "${query}"`,
          excerpt: 'This is a mock search result that matches your query.',
          category: 'General',
          relevance_score: 0.95,
          view_count: 150,
          last_updated: new Date().toISOString()
        }
      ];
      setSearchResults(mockResults);
    } catch (error) {
      console.error('Failed to search help content:', error);
      showError('Search failed. Please try again.');
    }
    setLoading(prev => ({ ...prev, search: false }));
  };

  const loadHelpCategory = async (categoryId: string) => {
    setSelectedCategory(categoryId);
    try {
      // Mock category articles
      const mockArticles: SearchResult[] = [
        {
          article_id: '1',
          title: 'Category Article Example',
          excerpt: 'This is an example article from the selected category.',
          category: helpCategories.find(cat => cat.category_id === categoryId)?.category_name || 'Unknown',
          relevance_score: 1.0,
          view_count: 200,
          last_updated: new Date().toISOString()
        }
      ];
      setSearchResults(mockArticles);
    } catch (error) {
      console.error('Failed to load category articles:', error);
      showError('Failed to load category articles.');
    }
  };

  const viewHelpArticle = async (articleId: string) => {
    setLoading(prev => ({ ...prev, article: true }));
    try {
      // Mock article data
      const mockArticle: HelpArticle = {
        article_id: articleId,
        title: 'Sample Help Article',
        content: '<h2>Welcome to QuickDrop Help</h2><p>This is a sample help article with detailed information about using our service.</p><p>Here you will find step-by-step instructions and helpful tips.</p>',
        category: 'Getting Started',
        screenshots: [
          {
            image_url: 'https://picsum.photos/600/400?random=1',
            caption: 'Step 1: Navigate to the delivery page',
            step_number: 1
          }
        ],
        video_url: '',
        related_articles: [
          { article_id: '2', title: 'Related Article 1' },
          { article_id: '3', title: 'Related Article 2' }
        ],
        downloadable_resources: [
          {
            resource_name: 'Quick Start Guide',
            download_url: '#',
            file_type: 'PDF'
          }
        ],
        user_rating: 4.5,
        total_votes: 120,
        last_updated: new Date().toISOString()
      };
      setSelectedArticle(mockArticle);
      setShowArticleModal(true);

      // Track article usage
      if (auth_state.user) {
        trackArticleUsage(articleId);
      }
    } catch (error) {
      console.error('Failed to load article:', error);
      showError('Failed to load article.');
    }
    setLoading(prev => ({ ...prev, article: false }));
  };

  const trackArticleUsage = async (articleId: string) => {
    try {
      // Mock tracking call
      console.log('Tracking article usage:', articleId);
    } catch (error) {
      console.error('Failed to track article usage:', error);
    }
  };

  const startTroubleshootingWizard = async (issueCategory: string) => {
    setLoading(prev => ({ ...prev, wizard: true }));
    try {
      // Mock wizard data
      const mockWizard = {
        wizard_id: 'wizard_1',
        current_step: 1,
        total_steps: 3,
        current_question: {
          question_text: 'What type of issue are you experiencing?',
          question_type: 'multiple_choice',
          options: [
            { option_id: '1', option_text: 'Delivery is late', next_step: 2 },
            { option_id: '2', option_text: 'Package is damaged', next_step: 2 },
            { option_id: '3', option_text: 'Cannot track delivery', next_step: 2 }
          ]
        },
        user_responses: [],
        suggested_solutions: []
      };
      setTroubleshootingWizard(mockWizard);
      setShowWizardModal(true);
    } catch (error) {
      console.error('Failed to start troubleshooting wizard:', error);
      showError('Failed to start troubleshooting wizard.');
    }
    setLoading(prev => ({ ...prev, wizard: false }));
  };

  const submitWizardResponse = async (response: string) => {
    if (!troubleshootingWizard) return;

    try {
      // Mock wizard progression
      const updatedWizard = {
        ...troubleshootingWizard,
        current_step: troubleshootingWizard.current_step + 1,
        user_responses: [...troubleshootingWizard.user_responses, { step: troubleshootingWizard.current_step, response }],
        suggested_solutions: [
          {
            solution_title: 'Contact the courier directly',
            solution_steps: [
              'Check your tracking information for courier contact details',
              'Call or message the courier about your delivery',
              'If no response, contact our support team'
            ],
            success_rate: 85
          }
        ]
      };
      setTroubleshootingWizard(updatedWizard);
    } catch (error) {
      console.error('Failed to submit wizard response:', error);
      showError('Failed to submit response.');
    }
  };

  const rateHelpArticle = async (articleId: string, rating: number, feedback?: string) => {
    try {
      // Mock rating submission
      console.log('Rating article:', { articleId, rating, feedback });
      setUserFeedback(prev => ({ ...prev, submission_status: 'success' }));
      showError('Thank you for your feedback!', 'info');
    } catch (error) {
      console.error('Failed to rate article:', error);
      setUserFeedback(prev => ({ ...prev, submission_status: 'error' }));
      showError('Failed to submit rating.');
    }
  };

  const createSupportTicket = async () => {
    setSupportTicketForm(prev => ({ ...prev, submission_status: 'submitting' }));
    
    try {
      // Mock ticket creation
      console.log('Creating support ticket:', supportTicketForm.form_data);
      
      setSupportTicketForm(prev => ({ 
        ...prev, 
        submission_status: 'success',
        is_visible: false
      }));
      setShowSupportModal(false);
      showError('Support ticket created successfully!', 'info');
    } catch (error) {
      console.error('Failed to create support ticket:', error);
      setSupportTicketForm(prev => ({ ...prev, submission_status: 'error' }));
      showError('Failed to create support ticket.');
    }
  };

  const escalateToLiveSupport = () => {
    // This would integrate with live chat system
    window.dispatchEvent(new CustomEvent('openLiveChat', { 
      detail: { context: 'help_escalation' }
    }));
    showError('Connecting to live chat...', 'info');
  };

  // Event handlers with proper debouncing
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    
    // Clear existing timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    // Set new timeout for debounced search
    searchTimeoutRef.current = setTimeout(() => {
      searchHelpContent(value);
    }, 300);
  }, []);

  const handleCategoryClick = (categoryId: string) => {
    loadHelpCategory(categoryId);
    setActiveTab('help');
  };

  const handleArticleClick = (articleId: string) => {
    viewHelpArticle(articleId);
  };

  // Modal accessibility handlers
  const handleModalKeyDown = (e: React.KeyboardEvent, closeModal: () => void) => {
    if (e.key === 'Escape') {
      closeModal();
    }
  };

  const handleModalClose = (modalType: 'article' | 'support' | 'wizard') => {
    switch (modalType) {
      case 'article':
        setShowArticleModal(false);
        break;
      case 'support':
        setShowSupportModal(false);
        break;
      case 'wizard':
        setShowWizardModal(false);
        break;
    }
  };

  return (
    <>
      <div className="min-h-screen bg-gray-50">
        {/* Error Toast */}
        {error.show && (
          <div className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg ${error.type === 'error' ? 'bg-red-100 text-red-800 border border-red-200' : error.type === 'warning' ? 'bg-yellow-100 text-yellow-800 border border-yellow-200' : 'bg-blue-100 text-blue-800 border border-blue-200'}`}>
            <div className="flex items-center justify-between">
              <span>{error.message}</span>
              <button
                onClick={() => setError(prev => ({ ...prev, show: false }))}
                className="ml-4 text-current hover:opacity-75"
                aria-label="Close notification"
              >
                ×
              </button>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="py-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">Help Center</h1>
                  <p className="mt-2 text-gray-600">Find answers, get support, and learn how to use QuickDrop</p>
                </div>
                <div className="flex items-center space-x-4">
                  {auth_state.user && (
                    <span className="text-sm text-gray-500">
                      Welcome back, {auth_state.user.first_name}
                    </span>
                  )}
                  <button
                    onClick={() => setShowSupportModal(true)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  >
                    Contact Support
                  </button>
                </div>
              </div>

              {/* Search Bar */}
              <div className="mt-6">
                <div className="relative max-w-2xl">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={handleSearchChange}
                    placeholder="Search for help articles, FAQs, or guides..."
                    className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    aria-label="Search help content"
                  />
                  {loading.search && (
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                      <svg className="animate-spin h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    </div>
                  )}
                </div>
              </div>

              {/* Tab Navigation */}
              <div className="mt-6">
                <div className="border-b border-gray-200">
                  <nav className="-mb-px flex space-x-8" role="tablist">
                    {['help', 'faq', 'community'].map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        role="tab"
                        aria-selected={activeTab === tab}
                        className={`py-2 px-1 border-b-2 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                          activeTab === tab
                            ? 'border-blue-500 text-blue-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}
                      >
                        {tab.charAt(0).toUpperCase() + tab.slice(1)}
                      </button>
                    ))}
                  </nav>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Search Results */}
          {searchQuery && searchResults.length > 0 && (
            <div className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Search Results for "{searchQuery}"
              </h2>
              <div className="bg-white rounded-lg shadow">
                {searchResults.map((result) => (
                  <div
                    key={result.article_id}
                    className="p-4 border-b border-gray-200 last:border-b-0 hover:bg-gray-50 cursor-pointer focus:bg-gray-50 focus:outline-none"
                    onClick={() => handleArticleClick(result.article_id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleArticleClick(result.article_id);
                      }
                    }}
                    tabIndex={0}
                    role="button"
                    aria-label={`Read article: ${result.title}`}
                  >
                    <h3 className="font-medium text-gray-900">{result.title}</h3>
                    <p className="text-sm text-gray-600 mt-1">{result.excerpt}</p>
                    <div className="flex items-center mt-2 text-xs text-gray-500">
                      <span className="bg-gray-100 px-2 py-1 rounded">{result.category}</span>
                      <span className="ml-2">{result.view_count} views</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Help Tab Content */}
          {activeTab === 'help' && (
            <div className="space-y-8">
              {/* Categories Grid */}
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Help Categories</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {helpCategories.map((category) => (
                    <div
                      key={category.category_id}
                      onClick={() => handleCategoryClick(category.category_id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleCategoryClick(category.category_id);
                        }
                      }}
                      className="bg-white p-6 rounded-lg shadow hover:shadow-md transition-shadow cursor-pointer border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                      tabIndex={0}
                      role="button"
                      aria-label={`Browse ${category.category_name} category with ${category.article_count} articles`}
                    >
                      <div className="flex items-center mb-3">
                        <img
                          src={category.icon_url || `https://picsum.photos/40/40?random=${category.category_id}`}
                          alt=""
                          className="w-10 h-10 rounded"
                        />
                        <div className="ml-3">
                          <h3 className="font-medium text-gray-900">{category.category_name}</h3>
                          <p className="text-sm text-gray-500">{category.article_count} articles</p>
                        </div>
                      </div>
                      {category.is_popular && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          Popular
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Popular Articles */}
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Popular Articles</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {popularArticles.map((article) => (
                    <div
                      key={article.article_id}
                      onClick={() => handleArticleClick(article.article_id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleArticleClick(article.article_id);
                        }
                      }}
                      className="bg-white rounded-lg shadow hover:shadow-md transition-shadow cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                      tabIndex={0}
                      role="button"
                      aria-label={`Read article: ${article.title}`}
                    >
                      <img
                        src={article.thumbnail_url || `https://picsum.photos/300/200?random=${article.article_id}`}
                        alt=""
                        className="w-full h-32 object-cover rounded-t-lg"
                      />
                      <div className="p-4">
                        <h3 className="font-medium text-gray-900 mb-2">{article.title}</h3>
                        <div className="flex items-center justify-between text-sm text-gray-500">
                          <span className="bg-gray-100 px-2 py-1 rounded">{article.category}</span>
                          <span>{article.view_count} views</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recently Viewed (for authenticated users) */}
              {auth_state.user && recentlyViewedArticles.length > 0 && (
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">Recently Viewed</h2>
                  <div className="bg-white rounded-lg shadow">
                    {recentlyViewedArticles.map((article) => (
                      <div
                        key={article.article_id}
                        onClick={() => handleArticleClick(article.article_id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleArticleClick(article.article_id);
                          }
                        }}
                        className="p-4 border-b border-gray-200 last:border-b-0 hover:bg-gray-50 cursor-pointer flex items-center justify-between focus:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                        tabIndex={0}
                        role="button"
                        aria-label={`Read article: ${article.title}`}
                      >
                        <div>
                          <h3 className="font-medium text-gray-900">{article.title}</h3>
                          <p className="text-sm text-gray-500">{article.category}</p>
                        </div>
                        <span className="text-xs text-gray-400">
                          {new Date(article.viewed_at).toLocaleDateString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Troubleshooting */}
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Need Help? Try Our Troubleshooter</h2>
                <div className="bg-white p-6 rounded-lg shadow">
                  <p className="text-gray-600 mb-4">
                    Get personalized help with our step-by-step troubleshooting guide.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {['Delivery Issues', 'Payment Problems', 'Account Questions'].map((category) => (
                      <button
                        key={category}
                        onClick={() => startTroubleshootingWizard(category.toLowerCase().replace(' ', '_'))}
                        className="p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                        aria-label={`Start troubleshooting for ${category}`}
                      >
                        <h3 className="font-medium text-gray-900">{category}</h3>
                        <p className="text-sm text-gray-500 mt-1">Get guided help</p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* FAQ Tab Content */}
          {activeTab === 'faq' && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-900">Frequently Asked Questions</h2>
              
              {/* FAQ Categories */}
              <div className="flex flex-wrap gap-2 mb-6">
                {faqData.categories.map((category) => (
                  <button
                    key={category.category_name}
                    className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    aria-label={`Filter by ${category.category_name} with ${category.faq_count} questions`}
                  >
                    {category.category_name} ({category.faq_count})
                  </button>
                ))}
              </div>

              {/* FAQ List */}
              <div className="space-y-4">
                {faqData.questions.map((faq) => (
                  <div key={faq.faq_id} className="bg-white rounded-lg shadow">
                    <details className="p-4">
                      <summary className="font-medium text-gray-900 cursor-pointer flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
                        <span>{faq.question}</span>
                        <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </summary>
                      <div className="mt-3 text-gray-600">
                        <p>{faq.answer}</p>
                        <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
                          <div className="flex items-center space-x-2 text-sm text-gray-500">
                            <button 
                              className="hover:text-green-600 focus:outline-none focus:text-green-600"
                              aria-label="Mark as helpful"
                            >
                              👍 Helpful
                            </button>
                            <button 
                              className="hover:text-red-600 focus:outline-none focus:text-red-600"
                              aria-label="Mark as not helpful"
                            >
                              👎 Not helpful
                            </button>
                          </div>
                          <span className="text-xs text-gray-400">
                            {faq.helpful_votes} people found this helpful
                          </span>
                        </div>
                      </div>
                    </details>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Community Tab Content */}
          {activeTab === 'community' && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-900">Community Forum</h2>
              
              <div className="bg-white p-6 rounded-lg shadow">
                <p className="text-gray-600">
                  Connect with other QuickDrop users, share experiences, and get answers from the community.
                </p>
                <button className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
                  Join the Discussion
                </button>
              </div>
            </div>
          )}

          {/* Contact Methods */}
          <div className="mt-12">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Still Need Help?</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {contactMethods.map((method) => (
                <div key={method.method} className="bg-white p-6 rounded-lg shadow">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-medium text-gray-900">{method.method.replace('_', ' ').toUpperCase()}</h3>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      method.is_available ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {method.is_available ? 'Available' : 'Offline'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">{method.description}</p>
                  <p className="text-sm text-blue-600 font-medium">{method.estimated_response_time}</p>
                  {method.contact_info && (
                    <p className="text-sm text-gray-500 mt-2">{method.contact_info}</p>
                  )}
                  <button 
                    onClick={() => method.method === 'live_chat' ? escalateToLiveSupport() : setShowSupportModal(true)}
                    className="mt-3 w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    aria-label={`Contact support via ${method.method}`}
                  >
                    Contact {method.method === 'live_chat' ? 'Chat' : 'Support'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Article Modal */}
        {showArticleModal && selectedArticle && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                handleModalClose('article');
              }
            }}
          >
            <div 
              ref={articleModalRef}
              className="bg-white rounded-lg max-w-4xl w-full max-h-screen overflow-y-auto"
              role="dialog"
              aria-modal="true"
              aria-labelledby="article-modal-title"
              onKeyDown={(e) => handleModalKeyDown(e, () => handleModalClose('article'))}
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 id="article-modal-title" className="text-2xl font-bold text-gray-900">{selectedArticle.title}</h2>
                  <button
                    onClick={() => handleModalClose('article')}
                    className="text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    aria-label="Close article"
                  >
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                
                <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: selectedArticle.content }} />
                
                {selectedArticle.screenshots.length > 0 && (
                  <div className="mt-6">
                    <h3 className="text-lg font-semibold mb-3">Screenshots</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {selectedArticle.screenshots.map((screenshot, index) => (
                        <div key={index}>
                          <img src={screenshot.image_url} alt={screenshot.caption} className="w-full rounded-lg" />
                          <p className="text-sm text-gray-600 mt-2">{screenshot.caption}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedArticle.video_url && (
                  <div className="mt-6">
                    <h3 className="text-lg font-semibold mb-3">Video Guide</h3>
                    <video controls className="w-full rounded-lg">
                      <source src={selectedArticle.video_url} />
                      Your browser does not support the video tag.
                    </video>
                  </div>
                )}

                {/* Article Rating */}
                <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                  <h3 className="text-lg font-semibold mb-3">Was this article helpful?</h3>
                  <div className="flex items-center space-x-4">
                    <div className="flex space-x-1" role="radiogroup" aria-label="Rate this article">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          onClick={() => setUserFeedback(prev => ({ ...prev, current_rating: star }))}
                          className={`text-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                            star <= userFeedback.current_rating ? 'text-yellow-400' : 'text-gray-300'
                          }`}
                          role="radio"
                          aria-checked={star === userFeedback.current_rating}
                          aria-label={`Rate ${star} out of 5 stars`}
                        >
                          ★
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={() => rateHelpArticle(selectedArticle.article_id, userFeedback.current_rating)}
                      className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                      disabled={userFeedback.current_rating === 0}
                    >
                      Submit Rating
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Support Ticket Modal */}
        {showSupportModal && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                handleModalClose('support');
              }
            }}
          >
            <div 
              ref={supportModalRef}
              className="bg-white rounded-lg max-w-2xl w-full"
              role="dialog"
              aria-modal="true"
              aria-labelledby="support-modal-title"
              onKeyDown={(e) => handleModalKeyDown(e, () => handleModalClose('support'))}
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 id="support-modal-title" className="text-2xl font-bold text-gray-900">Contact Support</h2>
                  <button
                    onClick={() => handleModalClose('support')}
                    className="text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    aria-label="Close support form"
                  >
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                
                <form onSubmit={(e) => { e.preventDefault(); createSupportTicket(); }}>
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="issue-category" className="block text-sm font-medium text-gray-700 mb-2">Issue Category</label>
                      <select
                        id="issue-category"
                        value={supportTicketForm.form_data.issue_category}
                        onChange={(e) => setSupportTicketForm(prev => ({
                          ...prev,
                          form_data: { ...prev.form_data, issue_category: e.target.value }
                        }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        required
                      >
                        <option value="">Select a category</option>
                        <option value="delivery">Delivery Issues</option>
                        <option value="payment">Payment Problems</option>
                        <option value="account">Account Questions</option>
                        <option value="technical">Technical Issues</option>
                        <option value="other">Other</option>
                      </select>
                    </div>

                    <div>
                      <label htmlFor="priority" className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
                      <select
                        id="priority"
                        value={supportTicketForm.form_data.priority}
                        onChange={(e) => setSupportTicketForm(prev => ({
                          ...prev,
                          form_data: { ...prev.form_data, priority: e.target.value }
                        }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="low">Low</option>
                        <option value="normal">Normal</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                      </select>
                    </div>

                    <div>
                      <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-2">Subject</label>
                      <input
                        id="subject"
                        type="text"
                        value={supportTicketForm.form_data.subject}
                        onChange={(e) => setSupportTicketForm(prev => ({
                          ...prev,
                          form_data: { ...prev.form_data, subject: e.target.value }
                        }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        required
                      />
                    </div>

                    <div>
                      <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                      <textarea
                        id="description"
                        value={supportTicketForm.form_data.description}
                        onChange={(e) => setSupportTicketForm(prev => ({
                          ...prev,
                          form_data: { ...prev.form_data, description: e.target.value }
                        }))}
                        rows={4}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        required
                      />
                    </div>

                    <div className="flex justify-end space-x-3">
                      <button
                        type="button"
                        onClick={() => handleModalClose('support')}
                        className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={supportTicketForm.submission_status === 'submitting'}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                      >
                        {supportTicketForm.submission_status === 'submitting' ? 'Submitting...' : 'Submit Ticket'}
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Troubleshooting Wizard Modal */}
        {showWizardModal && troubleshootingWizard && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                handleModalClose('wizard');
              }
            }}
          >
            <div 
              ref={wizardModalRef}
              className="bg-white rounded-lg max-w-2xl w-full"
              role="dialog"
              aria-modal="true"
              aria-labelledby="wizard-modal-title"
              onKeyDown={(e) => handleModalKeyDown(e, () => handleModalClose('wizard'))}
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 id="wizard-modal-title" className="text-2xl font-bold text-gray-900">Troubleshooting Wizard</h2>
                  <button
                    onClick={() => handleModalClose('wizard')}
                    className="text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    aria-label="Close troubleshooting wizard"
                  >
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                
                <div className="mb-4">
                  <div className="flex items-center justify-between text-sm text-gray-500">
                    <span>Step {troubleshootingWizard.current_step} of {troubleshootingWizard.total_steps}</span>
                    <span>{Math.round((troubleshootingWizard.current_step / troubleshootingWizard.total_steps) * 100)}% Complete</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${(troubleshootingWizard.current_step / troubleshootingWizard.total_steps) * 100}%` }}
                    />
                  </div>
                </div>

                {troubleshootingWizard.current_question && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">{troubleshootingWizard.current_question.question_text}</h3>
                    
                    <div className="space-y-2">
                      {troubleshootingWizard.current_question.options.map((option: any) => (
                        <button
                          key={option.option_id}
                          onClick={() => submitWizardResponse(option.option_id)}
                          className="w-full text-left p-3 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                          aria-label={`Select option: ${option.option_text}`}
                        >
                          {option.option_text}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {troubleshootingWizard.suggested_solutions && troubleshootingWizard.suggested_solutions.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Recommended Solutions</h3>
                    {troubleshootingWizard.suggested_solutions.map((solution: any, index: number) => (
                      <div key={index} className="p-4 bg-green-50 border border-green-200 rounded-lg">
                        <h4 className="font-medium text-green-900">{solution.solution_title}</h4>
                        <div className="mt-2 space-y-1">
                          {solution.solution_steps.map((step: string, stepIndex: number) => (
                            <p key={stepIndex} className="text-sm text-green-800">
                              {stepIndex + 1}. {step}
                            </p>
                          ))}
                        </div>
                        <p className="text-xs text-green-600 mt-2">
                          Success rate: {solution.success_rate}%
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default UV_Help;