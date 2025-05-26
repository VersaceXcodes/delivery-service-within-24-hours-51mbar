import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { RootState } from '@/store';

interface DeliveryInfo {
  uid: string;
  delivery_number: string;
  delivery_date: string;
  pickup_address: string;
  delivery_address: string;
  package_count: number;
  total_cost: number;
  delivery_type: string;
  actual_delivery_time: string;
  estimated_delivery_time: string;
  courier_info: {
    uid: string;
    first_name: string;
    last_name: string;
    profile_photo_url: string;
    vehicle_type: string;
    average_rating: number;
    total_deliveries: number;
  };
  sender_info: {
    uid: string;
    first_name: string;
    last_name: string;
  };
  is_reviewable: boolean;
  existing_review: {
    uid: string;
    overall_rating: number;
    written_review: string;
    created_at: string;
    can_edit: boolean;
  } | null;
}

interface RatingForm {
  overall_rating: number;
  category_ratings: {
    speed_rating: number;
    communication_rating: number;
    care_rating: number;
    professionalism_rating: number;
  };
  written_review: string;
  review_tags: string[];
  is_anonymous: boolean;
  would_recommend: boolean;
  service_improvement_suggestions: string;
  character_count: number;
  is_valid: boolean;
  validation_errors: Array<{ field: string; message: string; }>;
}

interface ReviewPhoto {
  uid: string;
  file_name: string;
  storage_url: string;
  thumbnail_url: string;
  file_size: number;
  upload_timestamp: string;
}

interface ReviewGuidelines {
  rating_criteria: Array<{
    category: string;
    description: string;
    examples: string[];
  }>;
  writing_prompts: Array<{
    category: string;
    questions: string[];
  }>;
  available_tags: Array<{
    tag: string;
    category: string;
    description: string;
  }>;
  community_guidelines: string[];
}

const UV_RatingReview: React.FC = () => {
  const { delivery_uid } = useParams<{ delivery_uid: string }>();
  const navigate = useNavigate();
  const auth_state = useSelector((state: RootState) => state.auth);
  const app_settings = useSelector((state: RootState) => state.app_settings);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [deliveryInfo, setDeliveryInfo] = useState<DeliveryInfo>({
    uid: "",
    delivery_number: "",
    delivery_date: "",
    pickup_address: "",
    delivery_address: "",
    package_count: 0,
    total_cost: 0,
    delivery_type: "",
    actual_delivery_time: "",
    estimated_delivery_time: "",
    courier_info: {
      uid: "",
      first_name: "",
      last_name: "",
      profile_photo_url: "https://picsum.photos/200/200?random=1",
      vehicle_type: "",
      average_rating: 0,
      total_deliveries: 0
    },
    sender_info: {
      uid: "",
      first_name: "",
      last_name: ""
    },
    is_reviewable: false,
    existing_review: null
  });

  const [ratingForm, setRatingForm] = useState<RatingForm>({
    overall_rating: 0,
    category_ratings: {
      speed_rating: 0,
      communication_rating: 0,
      care_rating: 0,
      professionalism_rating: 0
    },
    written_review: "",
    review_tags: [],
    is_anonymous: false,
    would_recommend: true,
    service_improvement_suggestions: "",
    character_count: 0,
    is_valid: false,
    validation_errors: []
  });

  const [reviewPhotos, setReviewPhotos] = useState<{
    uploaded_photos: ReviewPhoto[];
    upload_status: {
      is_uploading: boolean;
      upload_progress: number;
      current_file: string;
      error_message: string;
    };
    max_photos: number;
    allowed_formats: string[];
    max_file_size: number;
  }>({
    uploaded_photos: [],
    upload_status: {
      is_uploading: false,
      upload_progress: 0,
      current_file: "",
      error_message: ""
    },
    max_photos: 5,
    allowed_formats: ["jpg", "jpeg", "png", "heic"],
    max_file_size: 10485760
  });

  const [reviewGuidelines, setReviewGuidelines] = useState<ReviewGuidelines>({
    rating_criteria: [
      {
        category: "Speed",
        description: "How quickly was your delivery completed?",
        examples: ["Arrived faster than expected", "Right on time", "Slightly delayed", "Significantly delayed"]
      },
      {
        category: "Communication",
        description: "How well did the courier communicate?",
        examples: ["Excellent updates", "Good communication", "Basic communication", "Poor communication"]
      },
      {
        category: "Care",
        description: "How carefully was your package handled?",
        examples: ["Exceptional care", "Handled well", "Standard handling", "Rough handling"]
      },
      {
        category: "Professionalism",
        description: "How professional was the courier?",
        examples: ["Very professional", "Professional", "Adequate", "Unprofessional"]
      }
    ],
    writing_prompts: [
      {
        category: "General",
        questions: ["How was your overall experience?", "What stood out about this delivery?", "Would you use this courier again?"]
      },
      {
        category: "Speed",
        questions: ["Was the delivery faster or slower than expected?", "How did the timing meet your needs?"]
      },
      {
        category: "Communication",
        questions: ["Did the courier keep you informed?", "How was the communication quality?"]
      }
    ],
    available_tags: [],
    community_guidelines: [
      "Be honest and constructive",
      "Focus on the delivery experience", 
      "Avoid personal attacks",
      "Include specific details"
    ]
  });

  const [submissionStatus, setSubmissionStatus] = useState({
    is_submitting: false,
    submission_progress: 0,
    has_submitted: false,
    submission_timestamp: "",
    submission_error: "",
    success_message: "",
    can_edit_until: "",
    courier_response: {
      has_responded: false,
      response_text: "",
      response_timestamp: ""
    }
  });

  const [reviewComparison, setReviewComparison] = useState({
    user_review_history: {
      total_reviews: 0,
      average_rating_given: 0,
      most_recent_reviews: []
    },
    service_benchmarks: {
      platform_average_rating: 4.5,
      courier_average_rating: 0,
      similar_deliveries_rating: 0
    },
    improvement_tracking: {
      rating_trend: "stable",
      areas_of_improvement: [],
      positive_feedback_patterns: []
    }
  });

  const [showGuidelines, setShowGuidelines] = useState(false);
  const [activeTab, setActiveTab] = useState<'review' | 'guidelines' | 'comparison'>('review');
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Helper function to handle API errors
  const handleApiError = (error: any, context: string) => {
    console.error(`Error in ${context}:`, error);
    let errorMessage = 'An unexpected error occurred';
    
    if (error instanceof Response) {
      switch (error.status) {
        case 401:
          errorMessage = 'You are not authorized to perform this action';
          navigate('/login');
          break;
        case 403:
          errorMessage = 'You do not have permission to access this resource';
          break;
        case 404:
          errorMessage = 'The requested resource was not found';
          break;
        case 500:
          errorMessage = 'Server error. Please try again later';
          break;
        default:
          errorMessage = `Request failed with status ${error.status}`;
      }
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }
    
    setError(errorMessage);
  };

  // Validate auth state
  const validateAuth = (): boolean => {
    if (!auth_state?.session?.access_token) {
      setError('You must be logged in to review deliveries');
      navigate('/login');
      return false;
    }
    return true;
  };

  // Load delivery details
  const loadDeliveryDetails = async () => {
    if (!delivery_uid || !validateAuth()) return;

    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/v1/deliveries/${delivery_uid}`, {
        headers: {
          'Authorization': `Bearer ${auth_state.session!.access_token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw response;
      }

      const data = await response.json();
      
      // Map backend response to component interface
      const mappedData: DeliveryInfo = {
        uid: data.uid,
        delivery_number: data.delivery_number,
        delivery_date: data.created_at,
        pickup_address: data.pickup_address?.street_address || '',
        delivery_address: data.delivery_address?.street_address || '',
        package_count: data.packages?.length || 0,
        total_cost: data.total_price,
        delivery_type: data.delivery_type,
        actual_delivery_time: data.actual_delivery_time || '',
        estimated_delivery_time: data.estimated_delivery_time || '',
        courier_info: {
          uid: data.courier_info?.uid || '',
          first_name: data.courier_info?.user_info?.first_name || '',
          last_name: data.courier_info?.user_info?.last_name || '',
          profile_photo_url: data.courier_info?.user_info?.profile_photo_url || 'https://picsum.photos/200/200?random=1',
          vehicle_type: data.courier_info?.vehicle_type || '',
          average_rating: data.courier_info?.average_rating || 0,
          total_deliveries: data.courier_info?.total_deliveries || 0
        },
        sender_info: {
          uid: data.sender_info?.uid || '',
          first_name: data.sender_info?.first_name || '',
          last_name: data.sender_info?.last_name || ''
        },
        is_reviewable: data.status === 'delivered',
        existing_review: null // Will be populated by separate API call if exists
      };
      
      setDeliveryInfo(mappedData);

      // Check for existing review
      if (data.status === 'delivered') {
        await loadExistingReview();
      }
    } catch (error) {
      handleApiError(error, 'loadDeliveryDetails');
    } finally {
      setLoading(false);
    }
  };

  // Load existing review if any
  const loadExistingReview = async () => {
    if (!delivery_uid || !validateAuth()) return;

    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/v1/deliveries/${delivery_uid}/reviews`, {
        headers: {
          'Authorization': `Bearer ${auth_state.session!.access_token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const reviews = await response.json();
        const userReview = reviews.find((review: any) => review.reviewer_user_uid === auth_state.user?.uid);
        
        if (userReview) {
          setDeliveryInfo(prev => ({
            ...prev,
            existing_review: {
              uid: userReview.uid,
              overall_rating: userReview.overall_rating,
              written_review: userReview.written_review || '',
              created_at: userReview.created_at,
              can_edit: true // Determine based on business logic
            }
          }));
          
          // Populate form with existing review
          setRatingForm(prev => ({
            ...prev,
            overall_rating: userReview.overall_rating,
            category_ratings: {
              speed_rating: userReview.speed_rating || 0,
              communication_rating: userReview.communication_rating || 0,
              care_rating: userReview.care_rating || 0,
              professionalism_rating: 0 // Not in backend schema
            },
            written_review: userReview.written_review || '',
            character_count: (userReview.written_review || '').length,
            is_anonymous: userReview.is_anonymous || false
          }));
          
          setIsEditing(true);
        }
      }
    } catch (error) {
      // Non-critical error, just log it
      console.warn('Could not load existing review:', error);
    }
  };

  // Load review guidelines
  const loadReviewGuidelines = async () => {
    if (!validateAuth()) return;

    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/v1/reviews/guidelines`, {
        headers: {
          'Authorization': `Bearer ${auth_state.session!.access_token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setReviewGuidelines(data);
      }
    } catch (error) {
      console.warn('Error loading review guidelines:', error);
      // Non-critical, use defaults
    }
  };

  // Load review comparison data
  const loadReviewComparison = async () => {
    if (!delivery_uid || !validateAuth()) return;

    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/v1/reviews/comparison-data?delivery_uid=${delivery_uid}&user_uid=${auth_state.user?.uid}`, {
        headers: {
          'Authorization': `Bearer ${auth_state.session!.access_token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setReviewComparison(data);
      }
    } catch (error) {
      console.warn('Error loading review comparison:', error);
      // Non-critical, use defaults
    }
  };

  // Upload review photos
  const uploadReviewPhotos = async (files: FileList) => {
    if (!delivery_uid || !validateAuth()) return;

    setReviewPhotos(prev => ({
      ...prev,
      upload_status: {
        ...prev.upload_status,
        is_uploading: true,
        upload_progress: 0,
        error_message: ""
      }
    }));

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // Validate file
        const fileExtension = file.name.split('.').pop()?.toLowerCase();
        if (!reviewPhotos.allowed_formats.includes(fileExtension || '')) {
          throw new Error(`File format ${fileExtension} not allowed`);
        }
        
        if (file.size > reviewPhotos.max_file_size) {
          throw new Error(`File size exceeds ${reviewPhotos.max_file_size / 1024 / 1024}MB limit`);
        }

        const formData = new FormData();
        formData.append('file', file);
        formData.append('entity_type', 'review');
        formData.append('entity_uid', delivery_uid);
        formData.append('upload_purpose', 'review_photo');

        setReviewPhotos(prev => ({
          ...prev,
          upload_status: {
            ...prev.upload_status,
            current_file: file.name,
            upload_progress: (i / files.length) * 100
          }
        }));

        const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/v1/files/upload`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${auth_state.session!.access_token}`
          },
          body: formData
        });

        if (!response.ok) {
          throw response;
        }

        const uploadResult = await response.json();
        const newPhoto: ReviewPhoto = {
          uid: uploadResult.file_uid,
          file_name: file.name,
          storage_url: uploadResult.storage_url,
          thumbnail_url: uploadResult.thumbnail_url,
          file_size: file.size,
          upload_timestamp: new Date().toISOString()
        };

        setReviewPhotos(prev => ({
          ...prev,
          uploaded_photos: [...prev.uploaded_photos, newPhoto]
        }));
      }

      setReviewPhotos(prev => ({
        ...prev,
        upload_status: {
          ...prev.upload_status,
          is_uploading: false,
          upload_progress: 100,
          current_file: ""
        }
      }));
    } catch (error) {
      setReviewPhotos(prev => ({
        ...prev,
        upload_status: {
          ...prev.upload_status,
          is_uploading: false,
          error_message: error instanceof Error ? error.message : 'Upload failed'
        }
      }));
    }
  };

  // Submit rating
  const submitRating = async () => {
    if (!delivery_uid || !validateAuth() || !validateReviewForm()) return;

    setSubmissionStatus(prev => ({
      ...prev,
      is_submitting: true,
      submission_error: ""
    }));

    try {
      const reviewData = {
        overall_rating: ratingForm.overall_rating,
        speed_rating: ratingForm.category_ratings.speed_rating,
        communication_rating: ratingForm.category_ratings.communication_rating,
        care_rating: ratingForm.category_ratings.care_rating,
        written_review: ratingForm.written_review,
        photo_uids: reviewPhotos.uploaded_photos.map(photo => photo.uid),
        is_anonymous: ratingForm.is_anonymous
      };

      const url = isEditing && deliveryInfo.existing_review?.uid 
        ? `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/v1/reviews/${deliveryInfo.existing_review.uid}`
        : `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/v1/deliveries/${delivery_uid}/reviews`;
      
      const method = isEditing && deliveryInfo.existing_review?.uid ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${auth_state.session!.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(reviewData)
      });

      if (!response.ok) {
        throw response;
      }

      const result = await response.json();
      setSubmissionStatus(prev => ({
        ...prev,
        is_submitting: false,
        has_submitted: true,
        submission_timestamp: new Date().toISOString(),
        success_message: "Review submitted successfully!"
      }));

      // Redirect after short delay
      setTimeout(() => {
        navigate('/deliveries');
      }, 2000);
    } catch (error) {
      handleApiError(error, 'submitRating');
      setSubmissionStatus(prev => ({
        ...prev,
        is_submitting: false,
        submission_error: error instanceof Error ? error.message : 'Failed to submit review'
      }));
    }
  };

  // Validate review form
  const validateReviewForm = (): boolean => {
    const errors: Array<{ field: string; message: string; }> = [];

    if (ratingForm.overall_rating === 0) {
      errors.push({ field: 'overall_rating', message: 'Overall rating is required' });
    }

    if (ratingForm.written_review.trim().length < 10) {
      errors.push({ field: 'written_review', message: 'Review must be at least 10 characters' });
    }

    setRatingForm(prev => ({
      ...prev,
      validation_errors: errors,
      is_valid: errors.length === 0
    }));

    return errors.length === 0;
  };

  // Handle star rating
  const handleStarRating = (field: string, rating: number) => {
    if (field === 'overall_rating') {
      setRatingForm(prev => ({ ...prev, overall_rating: rating }));
    } else {
      setRatingForm(prev => ({
        ...prev,
        category_ratings: {
          ...prev.category_ratings,
          [field]: rating
        }
      }));
    }
  };

  // Handle text change
  const handleTextChange = (field: string, value: string) => {
    setRatingForm(prev => ({
      ...prev,
      [field]: value,
      character_count: field === 'written_review' ? value.length : prev.character_count
    }));
  };

  // Star rating component
  const StarRating = ({ rating, onRatingChange, size = "w-6 h-6", readonly = false }: { 
    rating: number; 
    onRatingChange: (rating: number) => void; 
    size?: string;
    readonly?: boolean;
  }) => {
    return (
      <div className="flex items-center space-x-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => !readonly && onRatingChange(star)}
            disabled={readonly}
            className={`${size} focus:outline-none transition-colors duration-200 ${readonly ? 'cursor-default' : 'cursor-pointer'}`}
          >
            <svg
              className={`w-full h-full ${
                star <= rating ? 'text-yellow-400' : 'text-gray-300'
              } ${!readonly ? 'hover:text-yellow-400' : ''}`}
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          </button>
        ))}
      </div>
    );
  };

  useEffect(() => {
    if (delivery_uid && auth_state?.session?.access_token) {
      loadDeliveryDetails();
      loadReviewGuidelines();
      loadReviewComparison();
    }
  }, [delivery_uid, auth_state?.session?.access_token]);

  useEffect(() => {
    validateReviewForm();
  }, [ratingForm.overall_rating, ratingForm.written_review]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Error</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <Link to="/deliveries" className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg">
            Return to Deliveries
          </Link>
        </div>
      </div>
    );
  }

  if (!delivery_uid) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Invalid Delivery</h1>
          <p className="text-gray-600 mb-6">No delivery ID provided for review.</p>
          <Link to="/deliveries" className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg">
            Return to Deliveries
          </Link>
        </div>
      </div>
    );
  }

  if (!deliveryInfo.is_reviewable && !deliveryInfo.existing_review) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Review Not Available</h1>
          <p className="text-gray-600 mb-6">This delivery cannot be reviewed at this time.</p>
          <Link to="/deliveries" className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg">
            Return to Deliveries
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-2xl font-bold text-gray-900">
                {deliveryInfo.existing_review ? 'Edit Review' : 'Rate Your Delivery'}
              </h1>
              <Link
                to="/deliveries"
                className="text-gray-500 hover:text-gray-700 flex items-center"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back to Deliveries
              </Link>
            </div>

            {/* Delivery Summary */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Delivery #{deliveryInfo.delivery_number}</h3>
                  <p className="text-sm text-gray-600 mb-1">
                    <span className="font-medium">From:</span> {deliveryInfo.pickup_address}
                  </p>
                  <p className="text-sm text-gray-600 mb-1">
                    <span className="font-medium">To:</span> {deliveryInfo.delivery_address}
                  </p>
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">Date:</span> {new Date(deliveryInfo.delivery_date).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center space-x-3">
                  <img
                    src={deliveryInfo.courier_info.profile_photo_url}
                    alt="Courier"
                    className="w-12 h-12 rounded-full object-cover"
                  />
                  <div>
                    <p className="font-semibold text-gray-900">
                      {deliveryInfo.courier_info.first_name} {deliveryInfo.courier_info.last_name}
                    </p>
                    <p className="text-sm text-gray-600 capitalize">{deliveryInfo.courier_info.vehicle_type}</p>
                    <div className="flex items-center">
                      <StarRating 
                        rating={deliveryInfo.courier_info.average_rating} 
                        onRatingChange={() => {}} 
                        size="w-4 h-4"
                        readonly
                      />
                      <span className="ml-2 text-sm text-gray-600">
                        ({deliveryInfo.courier_info.total_deliveries} deliveries)
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Success Message */}
          {submissionStatus.has_submitted && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
              <div className="flex">
                <svg className="w-5 h-5 text-green-400 mr-3 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <div>
                  <h3 className="text-sm font-medium text-green-800">Review Submitted!</h3>
                  <p className="text-sm text-green-700 mt-1">{submissionStatus.success_message}</p>
                </div>
              </div>
            </div>
          )}

          {/* Error Message */}
          {submissionStatus.submission_error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <div className="flex">
                <svg className="w-5 h-5 text-red-400 mr-3 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <div>
                  <h3 className="text-sm font-medium text-red-800">Submission Error</h3>
                  <p className="text-sm text-red-700 mt-1">{submissionStatus.submission_error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Tabs */}
          <div className="bg-white rounded-lg shadow-sm border mb-6">
            <div className="border-b border-gray-200">
              <nav className="-mb-px flex">
                <button
                  onClick={() => setActiveTab('review')}
                  className={`py-4 px-6 border-b-2 font-medium text-sm ${
                    activeTab === 'review'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Review
                </button>
                <button
                  onClick={() => setActiveTab('guidelines')}
                  className={`py-4 px-6 border-b-2 font-medium text-sm ${
                    activeTab === 'guidelines'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Guidelines
                </button>
                <button
                  onClick={() => setActiveTab('comparison')}
                  className={`py-4 px-6 border-b-2 font-medium text-sm ${
                    activeTab === 'comparison'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Your Rating History
                </button>
              </nav>
            </div>

            <div className="p-6">
              {/* Review Tab */}
              {activeTab === 'review' && (
                <div className="space-y-8">
                  {/* Overall Rating */}
                  <div>
                    <label className="block text-lg font-semibold text-gray-900 mb-4">
                      Overall Rating *
                    </label>
                    <div className="flex items-center space-x-4">
                      <StarRating 
                        rating={ratingForm.overall_rating} 
                        onRatingChange={(rating) => handleStarRating('overall_rating', rating)}
                        size="w-10 h-10"
                      />
                      <span className="text-lg font-medium text-gray-900">
                        {ratingForm.overall_rating > 0 ? `${ratingForm.overall_rating} / 5` : 'Select rating'}
                      </span>
                    </div>
                    {ratingForm.validation_errors.find(e => e.field === 'overall_rating') && (
                      <p className="mt-2 text-sm text-red-600">
                        {ratingForm.validation_errors.find(e => e.field === 'overall_rating')?.message}
                      </p>
                    )}
                  </div>

                  {/* Category Ratings */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Rate by Category</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {reviewGuidelines.rating_criteria.map((criteria) => (
                        <div key={criteria.category} className="space-y-2">
                          <label className="block text-sm font-medium text-gray-900">
                            {criteria.category}
                          </label>
                          <p className="text-sm text-gray-600 mb-2">{criteria.description}</p>
                          <StarRating 
                            rating={ratingForm.category_ratings[`${criteria.category.toLowerCase()}_rating` as keyof typeof ratingForm.category_ratings]} 
                            onRatingChange={(rating) => handleStarRating(`${criteria.category.toLowerCase()}_rating`, rating)}
                            size="w-6 h-6"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Written Review */}
                  <div>
                    <label className="block text-lg font-semibold text-gray-900 mb-2">
                      Written Review *
                    </label>
                    <p className="text-sm text-gray-600 mb-4">
                      Share your experience to help improve our service and assist other users.
                    </p>
                    <textarea
                      value={ratingForm.written_review}
                      onChange={(e) => handleTextChange('written_review', e.target.value)}
                      placeholder="Describe your delivery experience..."
                      rows={6}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      maxLength={1000}
                    />
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-sm text-gray-500">
                        {ratingForm.character_count} / 1000 characters
                      </span>
                      {ratingForm.validation_errors.find(e => e.field === 'written_review') && (
                        <p className="text-sm text-red-600">
                          {ratingForm.validation_errors.find(e => e.field === 'written_review')?.message}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Photo Upload */}
                  <div>
                    <label className="block text-lg font-semibold text-gray-900 mb-2">
                      Add Photos (Optional)
                    </label>
                    <p className="text-sm text-gray-600 mb-4">
                      Share photos to highlight exceptional service or document any issues.
                    </p>
                    
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept=".jpg,.jpeg,.png,.heic"
                        onChange={(e) => e.target.files && uploadReviewPhotos(e.target.files)}
                        className="hidden"
                      />
                      <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                        <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <p className="text-sm text-gray-600 mb-2">
                        Click to upload photos or drag and drop
                      </p>
                      <p className="text-xs text-gray-500">
                        PNG, JPG, HEIC up to 10MB (max {reviewPhotos.max_photos} photos)
                      </p>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={reviewPhotos.upload_status.is_uploading || reviewPhotos.uploaded_photos.length >= reviewPhotos.max_photos}
                        className="mt-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg text-sm"
                      >
                        {reviewPhotos.upload_status.is_uploading ? 'Uploading...' : 'Choose Photos'}
                      </button>
                    </div>

                    {/* Upload Progress */}
                    {reviewPhotos.upload_status.is_uploading && (
                      <div className="mt-4">
                        <div className="flex justify-between text-sm text-gray-600 mb-1">
                          <span>Uploading {reviewPhotos.upload_status.current_file}</span>
                          <span>{Math.round(reviewPhotos.upload_status.upload_progress)}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${reviewPhotos.upload_status.upload_progress}%` }}
                          ></div>
                        </div>
                      </div>
                    )}

                    {/* Upload Error */}
                    {reviewPhotos.upload_status.error_message && (
                      <div className="mt-4 text-sm text-red-600">
                        Error: {reviewPhotos.upload_status.error_message}
                      </div>
                    )}

                    {/* Uploaded Photos */}
                    {reviewPhotos.uploaded_photos.length > 0 && (
                      <div className="mt-4">
                        <h4 className="text-sm font-medium text-gray-900 mb-2">Uploaded Photos</h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          {reviewPhotos.uploaded_photos.map((photo) => (
                            <div key={photo.uid} className="relative group">
                              <img
                                src={photo.thumbnail_url}
                                alt={photo.file_name}
                                className="w-full h-24 object-cover rounded-lg"
                              />
                              <button
                                type="button"
                                onClick={() => setReviewPhotos(prev => ({
                                  ...prev,
                                  uploaded_photos: prev.uploaded_photos.filter(p => p.uid !== photo.uid)
                                }))}
                                className="absolute top-1 right-1 bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                </svg>
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Additional Options */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-gray-900">Additional Options</h3>
                    
                    <div className="flex items-center">
                      <input
                        id="would_recommend"
                        type="checkbox"
                        checked={ratingForm.would_recommend}
                        onChange={(e) => setRatingForm(prev => ({ ...prev, would_recommend: e.target.checked }))}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label htmlFor="would_recommend" className="ml-3 text-sm text-gray-900">
                        I would recommend this courier to others
                      </label>
                    </div>

                    <div className="flex items-center">
                      <input
                        id="is_anonymous"
                        type="checkbox"
                        checked={ratingForm.is_anonymous}
                        onChange={(e) => setRatingForm(prev => ({ ...prev, is_anonymous: e.target.checked }))}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label htmlFor="is_anonymous" className="ml-3 text-sm text-gray-900">
                        Submit this review anonymously
                      </label>
                    </div>
                  </div>

                  {/* Service Improvement Suggestions */}
                  <div>
                    <label className="block text-lg font-semibold text-gray-900 mb-2">
                      Service Improvement Suggestions (Optional)
                    </label>
                    <p className="text-sm text-gray-600 mb-4">
                      Help us improve our service by sharing any suggestions.
                    </p>
                    <textarea
                      value={ratingForm.service_improvement_suggestions}
                      onChange={(e) => handleTextChange('service_improvement_suggestions', e.target.value)}
                      placeholder="What could we do better?"
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      maxLength={500}
                    />
                  </div>

                  {/* Submit Button */}
                  <div className="flex justify-end space-x-4 pt-6 border-t">
                    <Link
                      to="/deliveries"
                      className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                    >
                      Cancel
                    </Link>
                    <button
                      type="button"
                      onClick={submitRating}
                      disabled={submissionStatus.is_submitting || !ratingForm.is_valid}
                      className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg flex items-center"
                    >
                      {submissionStatus.is_submitting ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Submitting...
                        </>
                      ) : (
                        deliveryInfo.existing_review ? 'Update Review' : 'Submit Review'
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Guidelines Tab */}
              {activeTab === 'guidelines' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Rating Guidelines</h3>
                    <div className="space-y-4">
                      {reviewGuidelines.rating_criteria.map((criteria) => (
                        <div key={criteria.category} className="bg-gray-50 rounded-lg p-4">
                          <h4 className="font-medium text-gray-900 mb-2">{criteria.category}</h4>
                          <p className="text-sm text-gray-600 mb-3">{criteria.description}</p>
                          <div className="space-y-1">
                            {criteria.examples.map((example, index) => (
                              <div key={index} className="flex items-center">
                                <StarRating rating={5 - index} onRatingChange={() => {}} size="w-4 h-4" readonly />
                                <span className="ml-2 text-sm text-gray-600">{example}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Writing Prompts</h3>
                    <div className="space-y-4">
                      {reviewGuidelines.writing_prompts.map((prompt) => (
                        <div key={prompt.category} className="bg-gray-50 rounded-lg p-4">
                          <h4 className="font-medium text-gray-900 mb-2">{prompt.category} Questions</h4>
                          <ul className="space-y-1">
                            {prompt.questions.map((question, index) => (
                              <li key={index} className="text-sm text-gray-600 flex items-start">
                                <span className="mr-2">•</span>
                                {question}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Community Guidelines</h3>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <ul className="space-y-2">
                        {reviewGuidelines.community_guidelines.map((guideline, index) => (
                          <li key={index} className="text-sm text-gray-700 flex items-start">
                            <svg className="w-4 h-4 text-green-500 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                            {guideline}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* Comparison Tab */}
              {activeTab === 'comparison' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Your Review History</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-gray-50 rounded-lg p-4 text-center">
                        <div className="text-2xl font-bold text-gray-900">
                          {reviewComparison.user_review_history.total_reviews}
                        </div>
                        <div className="text-sm text-gray-600">Total Reviews</div>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-4 text-center">
                        <div className="text-2xl font-bold text-gray-900">
                          {reviewComparison.user_review_history.average_rating_given.toFixed(1)}
                        </div>
                        <div className="text-sm text-gray-600">Average Rating Given</div>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-4 text-center">
                        <div className="text-2xl font-bold text-gray-900 capitalize">
                          {reviewComparison.improvement_tracking.rating_trend}
                        </div>
                        <div className="text-sm text-gray-600">Rating Trend</div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Service Benchmarks</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Platform Average</span>
                        <div className="flex items-center">
                          <StarRating 
                            rating={reviewComparison.service_benchmarks.platform_average_rating} 
                            onRatingChange={() => {}} 
                            size="w-4 h-4"
                            readonly
                          />
                          <span className="ml-2 text-sm font-medium">
                            {reviewComparison.service_benchmarks.platform_average_rating.toFixed(1)}
                          </span>
                        </div>
                      </div>
                      {deliveryInfo.courier_info.average_rating > 0 && (
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">This Courier's Average</span>
                          <div className="flex items-center">
                            <StarRating 
                              rating={deliveryInfo.courier_info.average_rating} 
                              onRatingChange={() => {}} 
                              size="w-4 h-4"
                              readonly
                            />
                            <span className="ml-2 text-sm font-medium">
                              {deliveryInfo.courier_info.average_rating.toFixed(1)}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {reviewComparison.user_review_history.most_recent_reviews.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Reviews</h3>
                      <div className="space-y-3">
                        {reviewComparison.user_review_history.most_recent_reviews.map((review: any, index: number) => (
                          <div key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                            <span className="text-sm text-gray-600">
                              {new Date(review.delivery_date).toLocaleDateString()}
                            </span>
                            <StarRating 
                              rating={review.overall_rating} 
                              onRatingChange={() => {}} 
                              size="w-4 h-4"
                              readonly
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default UV_RatingReview;