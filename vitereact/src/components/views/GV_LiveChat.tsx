import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '@/store/main';

interface ChatMessage {
  message_id: string;
  sender_type: 'user' | 'agent' | 'bot';
  sender_name: string;
  content: string;
  message_type: 'text' | 'image' | 'file';
  attachment_url?: string;
  timestamp: string;
  is_read: boolean;
  is_typing?: boolean;
}

interface QuickResponse {
  id: string;
  category: string;
  text: string;
  keywords: string[];
}

interface FAQSuggestion {
  question: string;
  answer: string;
  category: string;
  helpful_count: number;
  url: string;
}

interface AgentInfo {
  name: string;
  avatar_url: string;
  status: 'online' | 'away' | 'offline';
  response_time: string;
}

const GV_LiveChat: React.FC = () => {
  const dispatch = useDispatch();

  // Global state
  const auth_state = useSelector((state: RootState) => state.auth);
  const app_settings_state = useSelector((state: RootState) => state.app_settings);
  const error_state = useSelector((state: RootState) => state.error);
  const notifications_state = useSelector((state: RootState) => state.notifications);

  // Widget state
  const [chatWidgetState, setChatWidgetState] = useState({
    is_open: false,
    is_minimized: false,
    is_fullscreen: false,
    widget_position: 'bottom-right'
  });

  // Chat session state
  const [chatSession, setChatSession] = useState({
    session_id: '',
    is_active: false,
    agent_assigned: false,
    agent_info: {
      name: '',
      avatar_url: 'https://picsum.photos/40/40?random=agent',
      status: 'offline' as const,
      response_time: '< 2 minutes'
    },
    queue_position: 0,
    estimated_wait_time: 0,
    session_started_at: ''
  });

  // Messages state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [agentTyping, setAgentTyping] = useState(false);
  const [apiError, setApiError] = useState('');

  // Quick responses
  const [quickResponses] = useState<QuickResponse[]>([
    {
      id: 'delivery_status',
      category: 'delivery',
      text: 'I need help with my delivery status',
      keywords: ['delivery', 'status', 'tracking']
    },
    {
      id: 'payment_issue',
      category: 'payment',
      text: "I'm having a payment problem",
      keywords: ['payment', 'billing', 'charge']
    },
    {
      id: 'account_help',
      category: 'account',
      text: 'I need help with my account',
      keywords: ['account', 'profile', 'login']
    },
    {
      id: 'general_question',
      category: 'general',
      text: 'I have a general question',
      keywords: ['question', 'help', 'support']
    }
  ]);

  // FAQ suggestions
  const [faqSuggestions, setFaqSuggestions] = useState<FAQSuggestion[]>([]);
  const [faqSearchQuery, setFaqSearchQuery] = useState('');

  // Pre-chat form for unauthenticated users
  const [preChatForm, setPreChatForm] = useState({
    is_visible: false,
    form_data: {
      name: '',
      email: '',
      issue_category: '',
      message: ''
    },
    validation_errors: {} as Record<string, string>,
    is_submitting: false
  });

  // Chatbot state
  const [chatbotState, setChatbotState] = useState({
    is_active: true,
    current_flow: 'greeting',
    collected_data: {} as Record<string, any>,
    suggested_actions: [] as string[],
    escalation_triggered: false
  });

  // File upload state
  const [fileUploadStatus, setFileUploadStatus] = useState({
    is_uploading: false,
    upload_progress: 0,
    error_message: ''
  });

  // Rating state
  const [showRatingForm, setShowRatingForm] = useState(false);
  const [chatRating, setChatRating] = useState(0);
  const [feedbackText, setFeedbackText] = useState('');

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();
  const websocketRef = useRef<WebSocket | null>(null);

  // Scroll to bottom of messages
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Toggle chat widget
  const toggleChatWidget = useCallback(() => {
    setChatWidgetState(prev => ({
      ...prev,
      is_open: !prev.is_open,
      is_minimized: false
    }));
  }, []);

  // Minimize/maximize widget
  const minimizeWidget = useCallback(() => {
    setChatWidgetState(prev => ({
      ...prev,
      is_minimized: !prev.is_minimized
    }));
  }, []);

  // Toggle fullscreen
  const toggleFullscreen = useCallback(() => {
    setChatWidgetState(prev => ({
      ...prev,
      is_fullscreen: !prev.is_fullscreen
    }));
  }, []);

  // Initialize WebSocket connection
  const initializeWebSocket = useCallback(() => {
    if (websocketRef.current?.readyState === WebSocket.OPEN) return;

    const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
    const wsUrl = `${baseUrl.replace('http', 'ws')}/chat`;

    try {
      websocketRef.current = new WebSocket(wsUrl);

      websocketRef.current.onopen = () => {
        console.log('Chat WebSocket connected');
        if (auth_state.session?.access_token) {
          websocketRef.current?.send(JSON.stringify({
            type: 'authenticate',
            token: auth_state.session.access_token
          }));
        }
      };

      websocketRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          switch (data.type) {
            case 'message':
              setChatMessages(prev => [...prev, {
                message_id: data.message_id,
                sender_type: data.sender_type,
                sender_name: data.sender_name,
                content: data.content,
                message_type: data.message_type,
                attachment_url: data.attachment_url,
                timestamp: data.timestamp,
                is_read: false
              }]);
              break;
            case 'agent_assigned':
              setChatSession(prev => ({
                ...prev,
                agent_assigned: true,
                agent_info: data.agent_info
              }));
              setChatbotState(prev => ({ ...prev, is_active: false }));
              break;
            case 'typing':
              setAgentTyping(data.is_typing);
              break;
            case 'queue_update':
              setChatSession(prev => ({
                ...prev,
                queue_position: data.position,
                estimated_wait_time: data.wait_time
              }));
              break;
            default:
              break;
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      websocketRef.current.onclose = () => {
        console.log('Chat WebSocket disconnected');
        // Attempt reconnection after 3 seconds
        setTimeout(initializeWebSocket, 3000);
      };

      websocketRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        setApiError('Connection error. Please try again.');
      };
    } catch (error) {
      console.error('Failed to initialize WebSocket:', error);
      setApiError('Failed to connect to chat service.');
    }
  }, [auth_state.session?.access_token]);

  // Initialize chat session using existing message endpoints
  const initializeChatSession = useCallback(async () => {
    try {
      setApiError('');
      setPreChatForm(prev => ({ ...prev, is_submitting: true }));

      // Create a delivery-related message to simulate chat initialization
      const messageData = {
        recipient_user_uid: 'support_agent', // This would be handled by backend
        message_type: 'text',
        content: `Chat initiated: ${preChatForm.form_data.message || 'User started chat session'}`
      };

      const response = await fetch('/api/v1/deliveries/support/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(auth_state.session?.access_token && {
            'Authorization': `Bearer ${auth_state.session.access_token}`
          })
        },
        body: JSON.stringify(messageData)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      setChatSession(prev => ({
        ...prev,
        session_id: data.uid || `session_${Date.now()}`,
        is_active: true,
        session_started_at: new Date().toISOString()
      }));

      // Initialize WebSocket connection
      initializeWebSocket();

      // Add welcome message
      setChatMessages([{
        message_id: 'welcome',
        sender_type: 'bot',
        sender_name: 'QuickDrop Assistant',
        content: "Hello! I'm here to help you. How can I assist you today?",
        message_type: 'text',
        timestamp: new Date().toISOString(),
        is_read: false
      }]);

      // Hide pre-chat form
      setPreChatForm(prev => ({ ...prev, is_visible: false, is_submitting: false }));
    } catch (error) {
      console.error('Failed to initialize chat session:', error);
      setApiError('Failed to start chat session. Please try again.');
      setPreChatForm(prev => ({ ...prev, is_submitting: false }));
    }
  }, [auth_state.session?.access_token, preChatForm.form_data.message, initializeWebSocket]);

  // Send chat message using existing message endpoints
  const sendChatMessage = useCallback(async (message: string = currentMessage, messageType: string = 'text') => {
    if (!message.trim() && messageType === 'text') return;

    const newMessage: ChatMessage = {
      message_id: `msg_${Date.now()}`,
      sender_type: 'user',
      sender_name: auth_state.user?.first_name || 'You',
      content: message,
      message_type: messageType as any,
      timestamp: new Date().toISOString(),
      is_read: true
    };

    setChatMessages(prev => [...prev, newMessage]);
    setCurrentMessage('');
    setApiError('');

    try {
      // Send via WebSocket if connected
      if (websocketRef.current?.readyState === WebSocket.OPEN) {
        websocketRef.current.send(JSON.stringify({
          type: 'message',
          session_id: chatSession.session_id,
          content: message,
          message_type: messageType
        }));
      }

      // If chatbot is active, process with chatbot
      if (chatbotState.is_active) {
        setTimeout(() => processChatbotResponse(message), 1000);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      setApiError('Failed to send message. Please try again.');
    }
  }, [currentMessage, auth_state.user, chatSession.session_id, chatbotState.is_active]);

  // Process chatbot response
  const processChatbotResponse = useCallback((userMessage: string) => {
    const lowerMessage = userMessage.toLowerCase();
    let response = '';
    let shouldEscalate = false;

    // Simple keyword-based responses
    if (lowerMessage.includes('delivery') || lowerMessage.includes('tracking')) {
      response = 'I can help you track your delivery. Could you please provide your delivery number or order details?';
    } else if (lowerMessage.includes('payment') || lowerMessage.includes('billing')) {
      response = "I understand you're having payment issues. Let me connect you with a specialist who can help resolve this.";
      shouldEscalate = true;
    } else if (lowerMessage.includes('account') || lowerMessage.includes('login')) {
      response = "For account-related issues, I'll connect you with our support team who can verify your account and assist you properly.";
      shouldEscalate = true;
    } else if (lowerMessage.includes('urgent') || lowerMessage.includes('emergency')) {
      response = "I understand this is urgent. Let me immediately connect you with a live agent.";
      shouldEscalate = true;
    } else {
      response = "I want to make sure you get the best help possible. Let me connect you with one of our support specialists.";
      shouldEscalate = true;
    }

    // Add bot response
    setChatMessages(prev => [...prev, {
      message_id: `bot_${Date.now()}`,
      sender_type: 'bot',
      sender_name: 'QuickDrop Assistant',
      content: response,
      message_type: 'text',
      timestamp: new Date().toISOString(),
      is_read: false
    }]);

    if (shouldEscalate) {
      setTimeout(() => escalateToHumanAgent(), 2000);
    }
  }, []);

  // Escalate to human agent
  const escalateToHumanAgent = useCallback(async () => {
    try {
      setApiError('');
      setChatbotState(prev => ({
        ...prev,
        is_active: false,
        escalation_triggered: true
      }));

      setChatMessages(prev => [...prev, {
        message_id: `escalation_${Date.now()}`,
        sender_type: 'bot',
        sender_name: 'System',
        content: "I'm connecting you with a live agent. Please hold on...",
        message_type: 'text',
        timestamp: new Date().toISOString(),
        is_read: false
      }]);

      // Simulate agent assignment after delay
      setTimeout(() => {
        setChatSession(prev => ({
          ...prev,
          agent_assigned: true,
          agent_info: {
            name: 'Support Agent',
            avatar_url: 'https://picsum.photos/40/40?random=agent',
            status: 'online',
            response_time: '< 1 minute'
          }
        }));
      }, 3000);
    } catch (error) {
      console.error('Failed to escalate to human agent:', error);
      setApiError('Failed to connect with agent. Please try again.');
    }
  }, []);

  // Upload file attachment
  const uploadChatAttachment = useCallback(async (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      setFileUploadStatus(prev => ({
        ...prev,
        error_message: 'File size must be less than 10MB'
      }));
      return;
    }

    setFileUploadStatus(prev => ({
      ...prev,
      is_uploading: true,
      upload_progress: 0,
      error_message: ''
    }));

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('entity_type', 'delivery');
      formData.append('entity_uid', chatSession.session_id);
      formData.append('upload_purpose', 'chat_attachment');

      const response = await fetch('/api/v1/files/upload', {
        method: 'POST',
        headers: {
          ...(auth_state.session?.access_token && {
            'Authorization': `Bearer ${auth_state.session.access_token}`
          })
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      // Send message with attachment
      const attachmentMessage: ChatMessage = {
        message_id: `att_${Date.now()}`,
        sender_type: 'user',
        sender_name: auth_state.user?.first_name || 'You',
        content: file.name,
        message_type: file.type.startsWith('image/') ? 'image' : 'file',
        attachment_url: data.storage_url,
        timestamp: new Date().toISOString(),
        is_read: true
      };

      setChatMessages(prev => [...prev, attachmentMessage]);

      // Send via WebSocket
      if (websocketRef.current?.readyState === WebSocket.OPEN) {
        websocketRef.current.send(JSON.stringify({
          type: 'message',
          session_id: chatSession.session_id,
          content: file.name,
          message_type: attachmentMessage.message_type,
          attachment_url: data.storage_url
        }));
      }
    } catch (error) {
      console.error('File upload failed:', error);
      setFileUploadStatus(prev => ({
        ...prev,
        error_message: 'Failed to upload file. Please try again.'
      }));
    } finally {
      setFileUploadStatus(prev => ({
        ...prev,
        is_uploading: false,
        upload_progress: 0
      }));
    }
  }, [chatSession.session_id, auth_state]);

  // Search FAQ - simplified to avoid non-existent endpoint
  const searchFAQ = useCallback(async (query: string) => {
    if (!query.trim()) {
      setFaqSuggestions([]);
      return;
    }

    // Simulate FAQ suggestions based on keywords
    const mockFAQs: FAQSuggestion[] = [
      {
        question: 'How do I track my delivery?',
        answer: 'You can track your delivery using your tracking number...',
        category: 'delivery',
        helpful_count: 15,
        url: '/help/tracking'
      },
      {
        question: 'Payment issues and refunds',
        answer: 'For payment problems, please contact our support team...',
        category: 'payment',
        helpful_count: 8,
        url: '/help/payment'
      }
    ];

    const filtered = mockFAQs.filter(faq => 
      faq.question.toLowerCase().includes(query.toLowerCase()) ||
      faq.category.toLowerCase().includes(query.toLowerCase())
    );

    setFaqSuggestions(filtered);
  }, []);

  // Handle typing indicators
  const handleTyping = useCallback(() => {
    if (!isTyping) {
      setIsTyping(true);
      if (websocketRef.current?.readyState === WebSocket.OPEN) {
        websocketRef.current.send(JSON.stringify({
          type: 'typing',
          session_id: chatSession.session_id,
          is_typing: true
        }));
      }
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      if (websocketRef.current?.readyState === WebSocket.OPEN) {
        websocketRef.current.send(JSON.stringify({
          type: 'typing',
          session_id: chatSession.session_id,
          is_typing: false
        }));
      }
    }, 1000);
  }, [isTyping, chatSession.session_id]);

  // Submit rating
  const submitRating = useCallback(async () => {
    try {
      setApiError('');
      // Since rating endpoint doesn't exist, simulate success
      console.log('Rating submitted:', { rating: chatRating, feedback: feedbackText });
      
      setShowRatingForm(false);
      setChatRating(0);
      setFeedbackText('');
    } catch (error) {
      console.error('Failed to submit rating:', error);
      setApiError('Failed to submit rating. Please try again.');
    }
  }, [chatRating, feedbackText]);

  // Load chat history for authenticated users
  useEffect(() => {
    if (auth_state.user && chatWidgetState.is_open && !chatSession.is_active) {
      const loadChatHistory = async () => {
        try {
          setApiError('');
          // Since chat history endpoint doesn't exist, simulate with notifications
          const response = await fetch('/api/v1/notifications?unread_only=false&limit=10', {
            headers: {
              ...(auth_state.session?.access_token && {
                'Authorization': `Bearer ${auth_state.session.access_token}`
              })
            }
          });

          if (response.ok) {
            const data = await response.json();
            // Convert notifications to chat messages if needed
            if (data.notifications && data.notifications.length > 0) {
              const historyMessages = data.notifications
                .filter((notif: any) => notif.type === 'chat_message')
                .map((notif: any) => ({
                  message_id: notif.uid,
                  sender_type: 'agent',
                  sender_name: 'Support',
                  content: notif.message,
                  message_type: 'text',
                  timestamp: notif.created_at,
                  is_read: notif.is_read
                }));
              
              if (historyMessages.length > 0) {
                setChatMessages(historyMessages);
              }
            }
          }
        } catch (error) {
          console.error('Failed to load chat history:', error);
          setApiError('Failed to load chat history.');
        }
      };

      loadChatHistory();
    }
  }, [auth_state.user, chatWidgetState.is_open, chatSession.is_active, auth_state.session?.access_token]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    scrollToBottom();
  }, [chatMessages, scrollToBottom]);

  // Show pre-chat form for unauthenticated users
  useEffect(() => {
    if (!auth_state.user && chatWidgetState.is_open && !chatSession.is_active) {
      setPreChatForm(prev => ({ ...prev, is_visible: true }));
    }
  }, [auth_state.user, chatWidgetState.is_open, chatSession.is_active]);

  // Cleanup WebSocket on unmount
  useEffect(() => {
    return () => {
      if (websocketRef.current) {
        websocketRef.current.close();
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  return (
    <>
      {/* Chat Widget Trigger Button */}
      {!chatWidgetState.is_open && (
        <button
          onClick={toggleChatWidget}
          className="fixed bottom-6 right-6 bg-blue-600 hover:bg-blue-700 text-white rounded-full p-4 shadow-lg transition-all duration-300 z-50 group"
          aria-label="Open chat support"
          type="button"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-4l-4 4z" />
          </svg>
          {/* Unread indicator */}
          {notifications_state?.unread_count > 0 && (
            <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {notifications_state.unread_count > 9 ? '9+' : notifications_state.unread_count}
            </div>
          )}
        </button>
      )}

      {/* Chat Widget */}
      {chatWidgetState.is_open && (
        <div className={`fixed z-50 transition-all duration-300 ${
          chatWidgetState.is_fullscreen 
            ? 'inset-0 bg-white' 
            : 'bottom-6 right-6 w-96 h-[32rem]'
        } ${
          chatWidgetState.is_minimized ? 'h-14' : ''
        }`}>
          {/* Chat Header */}
          <div className="bg-blue-600 text-white px-4 py-3 rounded-t-lg flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {chatSession.agent_assigned ? (
                <>
                  <img 
                    src={chatSession.agent_info.avatar_url} 
                    alt="Agent" 
                    className="w-8 h-8 rounded-full"
                  />
                  <div>
                    <div className="font-semibold text-sm">{chatSession.agent_info.name}</div>
                    <div className="text-xs opacity-90">
                      {chatSession.agent_info.status === 'online' ? 'Online' : 'Away'} • {chatSession.agent_info.response_time}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div>
                    <div className="font-semibold text-sm">QuickDrop Support</div>
                    <div className="text-xs opacity-90">
                      {chatSession.queue_position > 0 
                        ? `Position ${chatSession.queue_position} in queue` 
                        : "We're here to help"}
                    </div>
                  </div>
                </>
              )}
            </div>
            
            <div className="flex items-center space-x-2">
              {/* Fullscreen toggle */}
              <button
                onClick={toggleFullscreen}
                className="p-1 hover:bg-blue-700 rounded transition-colors"
                aria-label={chatWidgetState.is_fullscreen ? "Exit fullscreen" : "Enter fullscreen"}
                type="button"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {chatWidgetState.is_fullscreen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M15 9h4.5M15 9V4.5M15 9l5.25-5.25M9 15H4.5M9 15v4.5M9 15l-5.25 5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                  )}
                </svg>
              </button>
              
              {/* Minimize toggle */}
              <button
                onClick={minimizeWidget}
                className="p-1 hover:bg-blue-700 rounded transition-colors"
                aria-label={chatWidgetState.is_minimized ? "Maximize" : "Minimize"}
                type="button"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.5 12h-15" />
                </svg>
              </button>
              
              {/* Close button */}
              <button
                onClick={toggleChatWidget}
                className="p-1 hover:bg-blue-700 rounded transition-colors"
                aria-label="Close chat"
                type="button"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Error Message */}
          {apiError && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 text-sm">
              {apiError}
            </div>
          )}

          {/* Chat Content */}
          {!chatWidgetState.is_minimized && (
            <div className="flex flex-col h-full bg-white rounded-b-lg shadow-lg">
              {/* Pre-chat Form */}
              {preChatForm.is_visible && (
                <div className="p-4 border-b bg-gray-50">
                  <h3 className="font-semibold text-gray-900 mb-3">Start a conversation</h3>
                  <div className="space-y-3">
                    <div>
                      <input
                        type="text"
                        placeholder="Your name"
                        value={preChatForm.form_data.name}
                        onChange={(e) => setPreChatForm(prev => ({
                          ...prev,
                          form_data: { ...prev.form_data, name: e.target.value }
                        }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <input
                        type="email"
                        placeholder="Your email"
                        value={preChatForm.form_data.email}
                        onChange={(e) => setPreChatForm(prev => ({
                          ...prev,
                          form_data: { ...prev.form_data, email: e.target.value }
                        }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <select
                        value={preChatForm.form_data.issue_category}
                        onChange={(e) => setPreChatForm(prev => ({
                          ...prev,
                          form_data: { ...prev.form_data, issue_category: e.target.value }
                        }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select issue type</option>
                        <option value="delivery">Delivery Issue</option>
                        <option value="payment">Payment Problem</option>
                        <option value="account">Account Help</option>
                        <option value="general">General Question</option>
                      </select>
                    </div>
                    <div>
                      <textarea
                        placeholder="How can we help you?"
                        value={preChatForm.form_data.message}
                        onChange={(e) => setPreChatForm(prev => ({
                          ...prev,
                          form_data: { ...prev.form_data, message: e.target.value }
                        }))}
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <button
                      onClick={initializeChatSession}
                      disabled={!preChatForm.form_data.name || !preChatForm.form_data.email || preChatForm.is_submitting}
                      className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white py-2 px-4 rounded-md transition-colors"
                      type="button"
                    >
                      {preChatForm.is_submitting ? 'Starting...' : 'Start Chat'}
                    </button>
                  </div>
                </div>
              )}

              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 max-h-80">
                {chatMessages.map((message) => (
                  <div
                    key={message.message_id}
                    className={`flex ${message.sender_type === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                      message.sender_type === 'user'
                        ? 'bg-blue-600 text-white'
                        : message.sender_type === 'bot'
                        ? 'bg-gray-100 text-gray-900'
                        : 'bg-green-100 text-green-900'
                    }`}>
                      {message.sender_type !== 'user' && (
                        <div className="text-xs font-semibold mb-1">{message.sender_name}</div>
                      )}
                      
                      {message.message_type === 'image' && message.attachment_url ? (
                        <div>
                          <img
                            src={message.attachment_url}
                            alt="Shared image"
                            className="max-w-full rounded mb-2"
                          />
                          <div className="text-sm">{message.content}</div>
                        </div>
                      ) : message.message_type === 'file' && message.attachment_url ? (
                        <div className="flex items-center space-x-2">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                          </svg>
                          <a
                            href={message.attachment_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm underline hover:no-underline"
                          >
                            {message.content}
                          </a>
                        </div>
                      ) : (
                        <div className="text-sm">{message.content}</div>
                      )}
                      
                      <div className="text-xs opacity-75 mt-1">
                        {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                ))}

                {/* Typing indicator */}
                {agentTyping && (
                  <div className="flex justify-start">
                    <div className="bg-gray-100 text-gray-900 px-4 py-2 rounded-lg">
                      <div className="flex items-center space-x-1">
                        <div className="flex space-x-1">
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                        </div>
                        <span className="text-xs text-gray-600 ml-2">Agent is typing...</span>
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Quick Responses */}
              {chatbotState.is_active && chatMessages.length <= 1 && (
                <div className="px-4 py-2 border-t bg-gray-50">
                  <div className="text-xs text-gray-600 mb-2">Quick responses:</div>
                  <div className="flex flex-wrap gap-2">
                    {quickResponses.map((response) => (
                      <button
                        key={response.id}
                        onClick={() => sendChatMessage(response.text)}
                        className="px-3 py-1 bg-white border border-gray-300 rounded-full text-sm hover:bg-gray-100 transition-colors"
                        type="button"
                      >
                        {response.text}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* FAQ Suggestions */}
              {faqSuggestions.length > 0 && (
                <div className="px-4 py-2 border-t bg-blue-50">
                  <div className="text-xs text-blue-800 mb-2">Helpful articles:</div>
                  <div className="space-y-1">
                    {faqSuggestions.slice(0, 3).map((faq, index) => (
                      <button
                        key={index}
                        onClick={() => sendChatMessage(`I found this helpful: ${faq.question}`)}
                        className="block text-left text-sm text-blue-700 hover:text-blue-900 transition-colors"
                        type="button"
                      >
                        {faq.question}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Message Input */}
              {chatSession.is_active && (
                <div className="border-t p-4">
                  <div className="flex items-end space-x-2">
                    {/* File upload */}
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={fileUploadStatus.is_uploading}
                      className="p-2 text-gray-500 hover:text-gray-700 transition-colors disabled:opacity-50"
                      aria-label="Attach file"
                      type="button"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                      </svg>
                    </button>

                    {/* Message input */}
                    <div className="flex-1">
                      <textarea
                        value={currentMessage}
                        onChange={(e) => {
                          setCurrentMessage(e.target.value);
                          handleTyping();
                          searchFAQ(e.target.value);
                        }}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            sendChatMessage();
                          }
                        }}
                        placeholder="Type your message..."
                        rows={1}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                      />
                    </div>

                    {/* Send button */}
                    <button
                      onClick={() => sendChatMessage()}
                      disabled={!currentMessage.trim()}
                      className="p-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-md transition-colors"
                      aria-label="Send message"
                      type="button"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                    </button>
                  </div>

                  {/* File upload status */}
                  {fileUploadStatus.is_uploading && (
                    <div className="mt-2 text-sm text-gray-600">
                      Uploading... {fileUploadStatus.upload_progress}%
                    </div>
                  )}

                  {fileUploadStatus.error_message && (
                    <div className="mt-2 text-sm text-red-600">
                      {fileUploadStatus.error_message}
                    </div>
                  )}
                </div>
              )}

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept="image/*,.pdf,.doc,.docx,.txt"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    uploadChatAttachment(file);
                  }
                }}
              />
            </div>
          )}

          {/* Rating Form Modal */}
          {showRatingForm && (
            <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-lg p-6 w-full max-w-md">
                <h3 className="text-lg font-semibold mb-4">Rate your chat experience</h3>
                
                <div className="flex justify-center space-x-2 mb-4">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => setChatRating(star)}
                      className={`text-2xl ${star <= chatRating ? 'text-yellow-400' : 'text-gray-300'}`}
                      type="button"
                      aria-label={`Rate ${star} stars`}
                    >
                      ★
                    </button>
                  ))}
                </div>

                <textarea
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  placeholder="Tell us about your experience (optional)"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
                />

                <div className="flex space-x-3">
                  <button
                    onClick={submitRating}
                    disabled={chatRating === 0}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white py-2 px-4 rounded-md transition-colors"
                    type="button"
                  >
                    Submit
                  </button>
                  <button
                    onClick={() => setShowRatingForm(false)}
                    className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 py-2 px-4 rounded-md transition-colors"
                    type="button"
                  >
                    Skip
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default GV_LiveChat;