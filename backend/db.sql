-- Create all tables for QuickDrop delivery platform

-- Users table - central user management
CREATE TABLE users (
    uid VARCHAR(255) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    user_type VARCHAR(50) NOT NULL,
    first_name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255) NOT NULL,
    profile_photo_url TEXT,
    is_email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    is_phone_verified BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    preferred_language VARCHAR(10) DEFAULT 'en',
    timezone VARCHAR(100) DEFAULT 'UTC',
    notification_preferences TEXT,
    two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    last_login_at VARCHAR(255),
    created_at VARCHAR(255) NOT NULL,
    updated_at VARCHAR(255) NOT NULL
);

-- Business accounts table
CREATE TABLE business_accounts (
    uid VARCHAR(255) PRIMARY KEY,
    owner_user_uid VARCHAR(255) NOT NULL REFERENCES users(uid),
    company_name VARCHAR(255) NOT NULL,
    business_registration_number VARCHAR(255),
    tax_id VARCHAR(255),
    billing_email VARCHAR(255),
    billing_phone VARCHAR(255),
    company_address TEXT,
    industry_type VARCHAR(100),
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    credit_limit NUMERIC(10,2) DEFAULT 0,
    payment_terms VARCHAR(50) DEFAULT 'immediate',
    created_at VARCHAR(255) NOT NULL,
    updated_at VARCHAR(255) NOT NULL
);

-- Business team members table
CREATE TABLE business_team_members (
    uid VARCHAR(255) PRIMARY KEY,
    business_account_uid VARCHAR(255) NOT NULL REFERENCES business_accounts(uid),
    user_uid VARCHAR(255) NOT NULL REFERENCES users(uid),
    role VARCHAR(50) NOT NULL DEFAULT 'user',
    permissions TEXT,
    invited_by_user_uid VARCHAR(255) REFERENCES users(uid),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    invited_at VARCHAR(255),
    joined_at VARCHAR(255),
    created_at VARCHAR(255) NOT NULL
);

-- Couriers table
CREATE TABLE couriers (
    uid VARCHAR(255) PRIMARY KEY,
    user_uid VARCHAR(255) UNIQUE NOT NULL REFERENCES users(uid),
    vehicle_type VARCHAR(50) NOT NULL,
    vehicle_make VARCHAR(100),
    vehicle_model VARCHAR(100),
    vehicle_year INTEGER,
    license_plate VARCHAR(50),
    insurance_policy_number VARCHAR(100),
    driver_license_number VARCHAR(100),
    max_package_weight NUMERIC(8,2) DEFAULT 30,
    max_package_dimensions TEXT,
    service_radius NUMERIC(8,2) DEFAULT 50,
    base_location_lat NUMERIC(10,6),
    base_location_lng NUMERIC(10,6),
    is_available BOOLEAN NOT NULL DEFAULT FALSE,
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    verification_status VARCHAR(50) NOT NULL DEFAULT 'pending',
    current_capacity INTEGER NOT NULL DEFAULT 0,
    max_concurrent_deliveries INTEGER NOT NULL DEFAULT 3,
    average_rating NUMERIC(3,2) DEFAULT 0,
    total_deliveries INTEGER NOT NULL DEFAULT 0,
    completion_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
    earnings_balance NUMERIC(10,2) NOT NULL DEFAULT 0,
    created_at VARCHAR(255) NOT NULL,
    updated_at VARCHAR(255) NOT NULL
);

-- Courier documents table
CREATE TABLE courier_documents (
    uid VARCHAR(255) PRIMARY KEY,
    courier_uid VARCHAR(255) NOT NULL REFERENCES couriers(uid),
    document_type VARCHAR(100) NOT NULL,
    document_url TEXT NOT NULL,
    document_number VARCHAR(100),
    expiry_date VARCHAR(255),
    verification_status VARCHAR(50) NOT NULL DEFAULT 'pending',
    verified_by_admin_uid VARCHAR(255),
    rejection_reason TEXT,
    uploaded_at VARCHAR(255) NOT NULL,
    verified_at VARCHAR(255),
    created_at VARCHAR(255) NOT NULL
);

-- Courier availability table
CREATE TABLE courier_availability (
    uid VARCHAR(255) PRIMARY KEY,
    courier_uid VARCHAR(255) NOT NULL REFERENCES couriers(uid),
    day_of_week INTEGER NOT NULL,
    start_time VARCHAR(10) NOT NULL,
    end_time VARCHAR(10) NOT NULL,
    is_available BOOLEAN NOT NULL DEFAULT TRUE,
    created_at VARCHAR(255) NOT NULL,
    updated_at VARCHAR(255) NOT NULL
);

-- Addresses table
CREATE TABLE addresses (
    uid VARCHAR(255) PRIMARY KEY,
    user_uid VARCHAR(255) REFERENCES users(uid),
    label VARCHAR(50),
    street_address TEXT NOT NULL,
    apartment_unit VARCHAR(100),
    city VARCHAR(100) NOT NULL,
    state_province VARCHAR(100),
    postal_code VARCHAR(20),
    country VARCHAR(100) NOT NULL,
    latitude NUMERIC(10,6),
    longitude NUMERIC(10,6),
    access_instructions TEXT,
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    use_count INTEGER NOT NULL DEFAULT 0,
    is_favorite BOOLEAN NOT NULL DEFAULT FALSE,
    created_at VARCHAR(255) NOT NULL,
    updated_at VARCHAR(255) NOT NULL
);

-- Deliveries table
CREATE TABLE deliveries (
    uid VARCHAR(255) PRIMARY KEY,
    delivery_number VARCHAR(255) UNIQUE NOT NULL,
    sender_user_uid VARCHAR(255) NOT NULL REFERENCES users(uid),
    courier_uid VARCHAR(255) REFERENCES couriers(uid),
    business_account_uid VARCHAR(255) REFERENCES business_accounts(uid),
    pickup_address_uid VARCHAR(255) NOT NULL REFERENCES addresses(uid),
    delivery_address_uid VARCHAR(255) NOT NULL REFERENCES addresses(uid),
    pickup_contact_name VARCHAR(255),
    pickup_contact_phone VARCHAR(50),
    delivery_contact_name VARCHAR(255) NOT NULL,
    delivery_contact_phone VARCHAR(50) NOT NULL,
    delivery_instructions TEXT,
    pickup_instructions TEXT,
    delivery_type VARCHAR(50) NOT NULL DEFAULT 'standard',
    status VARCHAR(50) NOT NULL DEFAULT 'requested',
    scheduled_pickup_time VARCHAR(255),
    actual_pickup_time VARCHAR(255),
    estimated_delivery_time VARCHAR(255),
    actual_delivery_time VARCHAR(255),
    total_distance NUMERIC(8,2),
    base_price NUMERIC(10,2) NOT NULL DEFAULT 0,
    distance_price NUMERIC(10,2) NOT NULL DEFAULT 0,
    surge_multiplier NUMERIC(5,2) NOT NULL DEFAULT 1,
    total_price NUMERIC(10,2) NOT NULL DEFAULT 0,
    courier_earnings NUMERIC(10,2) NOT NULL DEFAULT 0,
    payment_status VARCHAR(50) NOT NULL DEFAULT 'pending',
    cancellation_reason TEXT,
    failure_reason TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0,
    is_signature_required BOOLEAN NOT NULL DEFAULT FALSE,
    is_photo_proof_required BOOLEAN NOT NULL DEFAULT TRUE,
    priority_level INTEGER NOT NULL DEFAULT 1,
    created_at VARCHAR(255) NOT NULL,
    updated_at VARCHAR(255) NOT NULL
);

-- Packages table
CREATE TABLE packages (
    uid VARCHAR(255) PRIMARY KEY,
    delivery_uid VARCHAR(255) NOT NULL REFERENCES deliveries(uid),
    package_number INTEGER NOT NULL DEFAULT 1,
    description TEXT,
    category VARCHAR(50) DEFAULT 'other',
    size VARCHAR(20) NOT NULL DEFAULT 'medium',
    weight NUMERIC(8,2),
    dimensions TEXT,
    value NUMERIC(10,2) DEFAULT 0,
    is_fragile BOOLEAN NOT NULL DEFAULT FALSE,
    special_instructions TEXT,
    insurance_coverage NUMERIC(10,2) NOT NULL DEFAULT 0,
    package_photo_urls TEXT,
    created_at VARCHAR(255) NOT NULL
);

-- Delivery tracking table
CREATE TABLE delivery_tracking (
    uid VARCHAR(255) PRIMARY KEY,
    delivery_uid VARCHAR(255) NOT NULL REFERENCES deliveries(uid),
    courier_uid VARCHAR(255) REFERENCES couriers(uid),
    status VARCHAR(50) NOT NULL,
    latitude NUMERIC(10,6),
    longitude NUMERIC(10,6),
    notes TEXT,
    photo_url TEXT,
    is_milestone BOOLEAN NOT NULL DEFAULT FALSE,
    estimated_arrival_time VARCHAR(255),
    created_at VARCHAR(255) NOT NULL
);

-- Payment methods table
CREATE TABLE payment_methods (
    uid VARCHAR(255) PRIMARY KEY,
    user_uid VARCHAR(255) NOT NULL REFERENCES users(uid),
    type VARCHAR(50) NOT NULL,
    provider VARCHAR(50) NOT NULL,
    provider_payment_method_id VARCHAR(255) NOT NULL,
    last_four_digits VARCHAR(4),
    expiry_month INTEGER,
    expiry_year INTEGER,
    cardholder_name VARCHAR(255),
    billing_address_uid VARCHAR(255) REFERENCES addresses(uid),
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at VARCHAR(255) NOT NULL,
    updated_at VARCHAR(255) NOT NULL
);

-- Transactions table
CREATE TABLE transactions (
    uid VARCHAR(255) PRIMARY KEY,
    delivery_uid VARCHAR(255) REFERENCES deliveries(uid),
    user_uid VARCHAR(255) NOT NULL REFERENCES users(uid),
    payment_method_uid VARCHAR(255) REFERENCES payment_methods(uid),
    transaction_type VARCHAR(50) NOT NULL,
    amount NUMERIC(10,2) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'USD',
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    provider_transaction_id VARCHAR(255),
    fee_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
    tax_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
    description TEXT,
    failure_reason TEXT,
    processed_at VARCHAR(255),
    created_at VARCHAR(255) NOT NULL
);

-- Promotional codes table
CREATE TABLE promotional_codes (
    uid VARCHAR(255) PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    discount_type VARCHAR(50) NOT NULL,
    discount_value NUMERIC(10,2) NOT NULL,
    minimum_order_value NUMERIC(10,2) NOT NULL DEFAULT 0,
    maximum_discount NUMERIC(10,2),
    usage_limit_per_user INTEGER,
    total_usage_limit INTEGER,
    current_usage_count INTEGER NOT NULL DEFAULT 0,
    valid_from VARCHAR(255) NOT NULL,
    valid_until VARCHAR(255) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by_admin_uid VARCHAR(255),
    created_at VARCHAR(255) NOT NULL
);

-- Promo code usage table
CREATE TABLE promo_code_usage (
    uid VARCHAR(255) PRIMARY KEY,
    promotional_code_uid VARCHAR(255) NOT NULL REFERENCES promotional_codes(uid),
    user_uid VARCHAR(255) NOT NULL REFERENCES users(uid),
    delivery_uid VARCHAR(255) NOT NULL REFERENCES deliveries(uid),
    discount_applied NUMERIC(10,2) NOT NULL,
    used_at VARCHAR(255) NOT NULL
);

-- Messages table
CREATE TABLE messages (
    uid VARCHAR(255) PRIMARY KEY,
    delivery_uid VARCHAR(255) NOT NULL REFERENCES deliveries(uid),
    sender_user_uid VARCHAR(255) NOT NULL REFERENCES users(uid),
    recipient_user_uid VARCHAR(255) NOT NULL REFERENCES users(uid),
    message_type VARCHAR(50) NOT NULL DEFAULT 'text',
    content TEXT,
    photo_url TEXT,
    location_lat NUMERIC(10,6),
    location_lng NUMERIC(10,6),
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    read_at VARCHAR(255),
    created_at VARCHAR(255) NOT NULL
);

-- Notifications table
CREATE TABLE notifications (
    uid VARCHAR(255) PRIMARY KEY,
    user_uid VARCHAR(255) NOT NULL REFERENCES users(uid),
    delivery_uid VARCHAR(255) REFERENCES deliveries(uid),
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    channel VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    priority VARCHAR(20) NOT NULL DEFAULT 'normal',
    metadata TEXT,
    scheduled_for VARCHAR(255),
    sent_at VARCHAR(255),
    read_at VARCHAR(255),
    created_at VARCHAR(255) NOT NULL
);

-- Reviews table
CREATE TABLE reviews (
    uid VARCHAR(255) PRIMARY KEY,
    delivery_uid VARCHAR(255) NOT NULL REFERENCES deliveries(uid),
    reviewer_user_uid VARCHAR(255) NOT NULL REFERENCES users(uid),
    reviewed_user_uid VARCHAR(255) NOT NULL REFERENCES users(uid),
    reviewer_type VARCHAR(50) NOT NULL,
    overall_rating INTEGER NOT NULL,
    speed_rating INTEGER,
    communication_rating INTEGER,
    care_rating INTEGER,
    written_review TEXT,
    photo_urls TEXT,
    is_anonymous BOOLEAN NOT NULL DEFAULT FALSE,
    response_text TEXT,
    response_at VARCHAR(255),
    is_featured BOOLEAN NOT NULL DEFAULT FALSE,
    helpful_votes INTEGER NOT NULL DEFAULT 0,
    created_at VARCHAR(255) NOT NULL,
    updated_at VARCHAR(255) NOT NULL
);

-- Pricing zones table
CREATE TABLE pricing_zones (
    uid VARCHAR(255) PRIMARY KEY,
    zone_name VARCHAR(100) NOT NULL,
    city VARCHAR(100) NOT NULL,
    boundary_coordinates TEXT,
    base_price NUMERIC(10,2) NOT NULL,
    price_per_km NUMERIC(10,2) NOT NULL,
    minimum_price NUMERIC(10,2) NOT NULL,
    maximum_distance NUMERIC(8,2) NOT NULL DEFAULT 50,
    surge_multiplier NUMERIC(5,2) NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at VARCHAR(255) NOT NULL,
    updated_at VARCHAR(255) NOT NULL
);

-- Surge pricing table
CREATE TABLE surge_pricing (
    uid VARCHAR(255) PRIMARY KEY,
    pricing_zone_uid VARCHAR(255) NOT NULL REFERENCES pricing_zones(uid),
    day_of_week INTEGER,
    start_time VARCHAR(10),
    end_time VARCHAR(10),
    multiplier NUMERIC(5,2) NOT NULL,
    reason VARCHAR(100),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    effective_from VARCHAR(255),
    effective_until VARCHAR(255),
    created_at VARCHAR(255) NOT NULL
);

-- Admin users table
CREATE TABLE admin_users (
    uid VARCHAR(255) PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'support_agent',
    permissions TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_login_at VARCHAR(255),
    created_by_admin_uid VARCHAR(255),
    created_at VARCHAR(255) NOT NULL,
    updated_at VARCHAR(255) NOT NULL
);

-- System settings table
CREATE TABLE system_settings (
    uid VARCHAR(255) PRIMARY KEY,
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT NOT NULL,
    setting_type VARCHAR(50) NOT NULL DEFAULT 'string',
    description TEXT,
    is_public BOOLEAN NOT NULL DEFAULT FALSE,
    updated_by_admin_uid VARCHAR(255) REFERENCES admin_users(uid),
    updated_at VARCHAR(255) NOT NULL,
    created_at VARCHAR(255) NOT NULL
);

-- Audit logs table
CREATE TABLE audit_logs (
    uid VARCHAR(255) PRIMARY KEY,
    user_uid VARCHAR(255) REFERENCES users(uid),
    admin_user_uid VARCHAR(255) REFERENCES admin_users(uid),
    entity_type VARCHAR(100) NOT NULL,
    entity_uid VARCHAR(255) NOT NULL,
    action VARCHAR(50) NOT NULL,
    old_values TEXT,
    new_values TEXT,
    ip_address VARCHAR(100),
    user_agent TEXT,
    session_id VARCHAR(255),
    created_at VARCHAR(255) NOT NULL
);

-- Delivery metrics table
CREATE TABLE delivery_metrics (
    uid VARCHAR(255) PRIMARY KEY,
    date VARCHAR(20) NOT NULL,
    hour INTEGER,
    pricing_zone_uid VARCHAR(255) REFERENCES pricing_zones(uid),
    total_deliveries INTEGER NOT NULL DEFAULT 0,
    completed_deliveries INTEGER NOT NULL DEFAULT 0,
    cancelled_deliveries INTEGER NOT NULL DEFAULT 0,
    failed_deliveries INTEGER NOT NULL DEFAULT 0,
    average_delivery_time NUMERIC(8,2),
    average_price NUMERIC(10,2),
    total_revenue NUMERIC(12,2) NOT NULL DEFAULT 0,
    total_courier_earnings NUMERIC(12,2) NOT NULL DEFAULT 0,
    unique_senders INTEGER NOT NULL DEFAULT 0,
    unique_couriers INTEGER NOT NULL DEFAULT 0,
    peak_concurrent_deliveries INTEGER NOT NULL DEFAULT 0,
    average_rating NUMERIC(3,2),
    created_at VARCHAR(255) NOT NULL
);

-- User activity logs table
CREATE TABLE user_activity_logs (
    uid VARCHAR(255) PRIMARY KEY,
    user_uid VARCHAR(255) NOT NULL REFERENCES users(uid),
    activity_type VARCHAR(100) NOT NULL,
    page_url TEXT,
    activity_data TEXT,
    session_id VARCHAR(255),
    ip_address VARCHAR(100),
    user_agent TEXT,
    duration INTEGER,
    created_at VARCHAR(255) NOT NULL
);

-- File uploads table
CREATE TABLE file_uploads (
    uid VARCHAR(255) PRIMARY KEY,
    user_uid VARCHAR(255) NOT NULL REFERENCES users(uid),
    entity_type VARCHAR(100) NOT NULL,
    entity_uid VARCHAR(255) NOT NULL,
    file_type VARCHAR(50) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_size INTEGER NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    storage_url TEXT NOT NULL,
    thumbnail_url TEXT,
    is_public BOOLEAN NOT NULL DEFAULT FALSE,
    upload_purpose VARCHAR(100) NOT NULL,
    metadata TEXT,
    uploaded_at VARCHAR(255) NOT NULL,
    created_at VARCHAR(255) NOT NULL
);

-- API keys table
CREATE TABLE api_keys (
    uid VARCHAR(255) PRIMARY KEY,
    business_account_uid VARCHAR(255) NOT NULL REFERENCES business_accounts(uid),
    key_name VARCHAR(100) NOT NULL,
    api_key VARCHAR(255) UNIQUE NOT NULL,
    api_secret VARCHAR(255) NOT NULL,
    permissions TEXT,
    rate_limit INTEGER NOT NULL DEFAULT 100,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_used_at VARCHAR(255),
    expires_at VARCHAR(255),
    created_at VARCHAR(255) NOT NULL
);

-- Webhooks table
CREATE TABLE webhooks (
    uid VARCHAR(255) PRIMARY KEY,
    business_account_uid VARCHAR(255) NOT NULL REFERENCES business_accounts(uid),
    endpoint_url TEXT NOT NULL,
    event_types TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    secret_token VARCHAR(255) NOT NULL,
    retry_count INTEGER NOT NULL DEFAULT 0,
    last_success_at VARCHAR(255),
    last_failure_at VARCHAR(255),
    created_at VARCHAR(255) NOT NULL,
    updated_at VARCHAR(255) NOT NULL
);

-- Create indexes for optimal performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_users_user_type ON users(user_type);
CREATE INDEX idx_users_is_active ON users(is_active);
CREATE INDEX idx_couriers_user_uid ON couriers(user_uid);
CREATE INDEX idx_couriers_is_available ON couriers(is_available);
CREATE INDEX idx_couriers_verification_status ON couriers(verification_status);
CREATE INDEX idx_addresses_user_uid ON addresses(user_uid);
CREATE INDEX idx_addresses_lat_lng ON addresses(latitude, longitude);
CREATE INDEX idx_deliveries_sender_user_uid ON deliveries(sender_user_uid);
CREATE INDEX idx_deliveries_courier_uid ON deliveries(courier_uid);
CREATE INDEX idx_deliveries_status ON deliveries(status);
CREATE INDEX idx_deliveries_created_at ON deliveries(created_at);
CREATE INDEX idx_delivery_tracking_delivery_uid ON delivery_tracking(delivery_uid);
CREATE INDEX idx_delivery_tracking_created_at ON delivery_tracking(created_at);
CREATE INDEX idx_transactions_user_uid ON transactions(user_uid);
CREATE INDEX idx_transactions_delivery_uid ON transactions(delivery_uid);
CREATE INDEX idx_notifications_user_uid ON notifications(user_uid);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_reviews_delivery_uid ON reviews(delivery_uid);
CREATE INDEX idx_reviews_reviewed_user_uid ON reviews(reviewed_user_uid);
CREATE INDEX idx_user_activity_logs_user_uid ON user_activity_logs(user_uid);

-- Seed data starts here
-- Insert users (senders and couriers)
INSERT INTO users (uid, email, phone, password_hash, user_type, first_name, last_name, profile_photo_url, is_email_verified, is_phone_verified, is_active, preferred_language, timezone, notification_preferences, two_factor_enabled, last_login_at, created_at, updated_at) VALUES
('user_001', 'john.smith@email.com', '+1234567890', '$2b$10$K6gEEfJyGlnPjG3oH7aQSe8HxJ1lOpgDNDfSkDgCiHn5FZDRn/KGi', 'sender', 'John', 'Smith', 'https://picsum.photos/200/200?random=1', TRUE, TRUE, TRUE, 'en', 'UTC', '{"sms": true, "email": true, "push": true}', FALSE, '2024-01-15T10:30:00Z', '2024-01-01T09:00:00Z', '2024-01-15T10:30:00Z'),
('user_002', 'sarah.johnson@email.com', '+1234567891', '$2b$10$K6gEEfJyGlnPjG3oH7aQSe8HxJ1lOpgDNDfSkDgCiHn5FZDRn/KGi', 'courier', 'Sarah', 'Johnson', 'https://picsum.photos/200/200?random=2', TRUE, TRUE, TRUE, 'en', 'America/New_York', '{"sms": true, "email": true, "push": true}', FALSE, '2024-01-15T14:20:00Z', '2024-01-01T09:30:00Z', '2024-01-15T14:20:00Z'),
('user_003', 'mike.davis@email.com', '+1234567892', '$2b$10$K6gEEfJyGlnPjG3oH7aQSe8HxJ1lOpgDNDfSkDgCiHn5FZDRn/KGi', 'sender', 'Mike', 'Davis', 'https://picsum.photos/200/200?random=3', TRUE, TRUE, TRUE, 'en', 'America/Los_Angeles', '{"sms": true, "email": false, "push": true}', TRUE, '2024-01-15T16:45:00Z', '2024-01-01T10:00:00Z', '2024-01-15T16:45:00Z'),
('user_004', 'emily.chen@email.com', '+1234567893', '$2b$10$K6gEEfJyGlnPjG3oH7aQSe8HxJ1lOpgDNDfSkDgCiHn5FZDRn/KGi', 'courier', 'Emily', 'Chen', 'https://picsum.photos/200/200?random=4', TRUE, TRUE, TRUE, 'en', 'America/Chicago', '{"sms": true, "email": true, "push": true}', FALSE, '2024-01-15T18:10:00Z', '2024-01-01T10:30:00Z', '2024-01-15T18:10:00Z'),
('user_005', 'david.wilson@email.com', '+1234567894', '$2b$10$K6gEEfJyGlnPjG3oH7aQSe8HxJ1lOpgDNDfSkDgCiHn5FZDRn/KGi', 'business_admin', 'David', 'Wilson', 'https://picsum.photos/200/200?random=5', TRUE, TRUE, TRUE, 'en', 'UTC', '{"sms": true, "email": true, "push": false}', TRUE, '2024-01-15T12:15:00Z', '2024-01-01T11:00:00Z', '2024-01-15T12:15:00Z'),
('user_006', 'lisa.brown@email.com', '+1234567895', '$2b$10$K6gEEfJyGlnPjG3oH7aQSe8HxJ1lOpgDNDfSkDgCiHn5FZDRn/KGi', 'sender', 'Lisa', 'Brown', 'https://picsum.photos/200/200?random=6', TRUE, FALSE, TRUE, 'es', 'America/Mexico_City', '{"sms": false, "email": true, "push": true}', FALSE, '2024-01-15T08:30:00Z', '2024-01-01T11:30:00Z', '2024-01-15T08:30:00Z'),
('user_007', 'alex.rodriguez@email.com', '+1234567896', '$2b$10$K6gEEfJyGlnPjG3oH7aQSe8HxJ1lOpgDNDfSkDgCiHn5FZDRn/KGi', 'courier', 'Alex', 'Rodriguez', 'https://picsum.photos/200/200?random=7', TRUE, TRUE, TRUE, 'es', 'America/Mexico_City', '{"sms": true, "email": true, "push": true}', FALSE, '2024-01-15T19:45:00Z', '2024-01-01T12:00:00Z', '2024-01-15T19:45:00Z'),
('user_008', 'jennifer.taylor@email.com', '+1234567897', '$2b$10$K6gEEfJyGlnPjG3oH7aQSe8HxJ1lOpgDNDfSkDgCiHn5FZDRn/KGi', 'sender', 'Jennifer', 'Taylor', 'https://picsum.photos/200/200?random=8', FALSE, TRUE, TRUE, 'en', 'America/Denver', '{"sms": true, "email": true, "push": true}', FALSE, NULL, '2024-01-01T12:30:00Z', '2024-01-01T12:30:00Z'),
('user_009', 'carlos.martinez@email.com', '+1234567898', '$2b$10$K6gEEfJyGlnPjG3oH7aQSe8HxJ1lOpgDNDfSkDgCiHn5FZDRn/KGi', 'courier', 'Carlos', 'Martinez', 'https://picsum.photos/200/200?random=9', TRUE, TRUE, TRUE, 'es', 'Europe/Madrid', '{"sms": true, "email": false, "push": true}', FALSE, '2024-01-15T13:20:00Z', '2024-01-01T13:00:00Z', '2024-01-15T13:20:00Z'),
('user_010', 'amanda.white@email.com', '+1234567899', '$2b$10$K6gEEfJyGlnPjG3oH7aQSe8HxJ1lOpgDNDfSkDgCiHn5FZDRn/KGi', 'sender', 'Amanda', 'White', 'https://picsum.photos/200/200?random=10', TRUE, TRUE, TRUE, 'fr', 'Europe/Paris', '{"sms": true, "email": true, "push": true}', TRUE, '2024-01-15T15:40:00Z', '2024-01-01T13:30:00Z', '2024-01-15T15:40:00Z'),
('user_011', 'robert.kim@email.com', '+1234567800', '$2b$10$K6gEEfJyGlnPjG3oH7aQSe8HxJ1lOpgDNDfSkDgCiHn5FZDRn/KGi', 'courier', 'Robert', 'Kim', 'https://picsum.photos/200/200?random=11', TRUE, TRUE, TRUE, 'en', 'Asia/Seoul', '{"sms": true, "email": true, "push": true}', FALSE, '2024-01-15T11:15:00Z', '2024-01-01T14:00:00Z', '2024-01-15T11:15:00Z'),
('user_012', 'maria.garcia@email.com', '+1234567801', '$2b$10$K6gEEfJyGlnPjG3oH7aQSe8HxJ1lOpgDNDfSkDgCiHn5FZDRn/KGi', 'business_admin', 'Maria', 'Garcia', 'https://picsum.photos/200/200?random=12', TRUE, TRUE, TRUE, 'es', 'America/Argentina/Buenos_Aires', '{"sms": true, "email": true, "push": true}', FALSE, '2024-01-15T09:25:00Z', '2024-01-01T14:30:00Z', '2024-01-15T09:25:00Z');

-- Insert business accounts
INSERT INTO business_accounts (uid, owner_user_uid, company_name, business_registration_number, tax_id, billing_email, billing_phone, company_address, industry_type, is_verified, credit_limit, payment_terms, created_at, updated_at) VALUES
('biz_001', 'user_005', 'TechCorp Solutions', 'REG123456789', 'TAX987654321', 'billing@techcorp.com', '+1555000001', '123 Business Ave, Tech City, TC 12345', 'technology', TRUE, 5000.00, 'net_30', '2024-01-02T09:00:00Z', '2024-01-10T15:30:00Z'),
('biz_002', 'user_012', 'RestaurantPro', 'REG987654321', 'TAX123456789', 'billing@restaurantpro.com', '+1555000002', '456 Food Street, Culinary District, CD 67890', 'restaurant', TRUE, 3000.00, 'immediate', '2024-01-03T10:30:00Z', '2024-01-12T11:45:00Z'),
('biz_003', 'user_001', 'QuickMart Express', 'REG456789123', 'TAX456789123', 'billing@quickmart.com', '+1555000003', '789 Retail Blvd, Shopping Center, SC 34567', 'retail', FALSE, 2000.00, 'net_15', '2024-01-05T14:20:00Z', '2024-01-05T14:20:00Z');

-- Insert business team members
INSERT INTO business_team_members (uid, business_account_uid, user_uid, role, permissions, invited_by_user_uid, is_active, invited_at, joined_at, created_at) VALUES
('team_001', 'biz_001', 'user_001', 'manager', '{"delivery_create": true, "delivery_cancel": true, "reports_view": true}', 'user_005', TRUE, '2024-01-02T10:00:00Z', '2024-01-02T10:30:00Z', '2024-01-02T10:00:00Z'),
('team_002', 'biz_001', 'user_003', 'user', '{"delivery_create": true, "delivery_view": true}', 'user_005', TRUE, '2024-01-03T11:00:00Z', '2024-01-03T11:45:00Z', '2024-01-03T11:00:00Z'),
('team_003', 'biz_002', 'user_006', 'admin', '{"delivery_create": true, "delivery_cancel": true, "reports_view": true, "team_manage": true}', 'user_012', TRUE, '2024-01-04T09:30:00Z', '2024-01-04T10:00:00Z', '2024-01-04T09:30:00Z');

-- Insert courier profiles
INSERT INTO couriers (uid, user_uid, vehicle_type, vehicle_make, vehicle_model, vehicle_year, license_plate, insurance_policy_number, driver_license_number, max_package_weight, max_package_dimensions, service_radius, base_location_lat, base_location_lng, is_available, is_verified, verification_status, current_capacity, max_concurrent_deliveries, average_rating, total_deliveries, completion_rate, earnings_balance, created_at, updated_at) VALUES
('courier_001', 'user_002', 'bicycle', 'Trek', 'FX 3', 2023, 'N/A', 'INS123456', 'DL987654321', 15.00, '{"length": 50, "width": 40, "height": 30}', 25.0, 40.7589, -73.9851, TRUE, TRUE, 'approved', 1, 3, 4.8, 127, 98.5, 285.50, '2024-01-01T09:30:00Z', '2024-01-15T14:20:00Z'),
('courier_002', 'user_004', 'motorcycle', 'Honda', 'CBR300R', 2022, 'BIKE123', 'INS789012', 'DL123456789', 25.00, '{"length": 60, "width": 50, "height": 40}', 40.0, 34.0522, -118.2437, TRUE, TRUE, 'approved', 0, 4, 4.9, 203, 99.2, 542.75, '2024-01-01T10:30:00Z', '2024-01-15T18:10:00Z'),
('courier_003', 'user_007', 'car', 'Toyota', 'Camry', 2021, 'CAR456', 'INS345678', 'DL456789012', 40.00, '{"length": 100, "width": 80, "height": 60}', 60.0, 41.8781, -87.6298, FALSE, TRUE, 'approved', 2, 5, 4.7, 89, 95.5, 198.25, '2024-01-01T12:00:00Z', '2024-01-15T19:45:00Z'),
('courier_004', 'user_009', 'bicycle', 'Specialized', 'Sirrus X', 2023, 'N/A', 'INS901234', 'DL789012345', 18.00, '{"length": 55, "width": 45, "height": 35}', 20.0, 40.4168, -3.7038, TRUE, TRUE, 'approved', 0, 2, 4.6, 56, 94.8, 165.80, '2024-01-01T13:00:00Z', '2024-01-15T13:20:00Z'),
('courier_005', 'user_011', 'van', 'Ford', 'Transit', 2022, 'VAN789', 'INS567890', 'DL012345678', 100.00, '{"length": 200, "width": 150, "height": 120}', 80.0, 37.5665, 126.9780, TRUE, FALSE, 'pending', 0, 6, 0.0, 0, 0.0, 0.00, '2024-01-01T14:00:00Z', '2024-01-01T14:00:00Z');

-- Insert courier documents
INSERT INTO courier_documents (uid, courier_uid, document_type, document_url, document_number, expiry_date, verification_status, verified_by_admin_uid, rejection_reason, uploaded_at, verified_at, created_at) VALUES
('doc_001', 'courier_001', 'drivers_license', 'https://picsum.photos/800/600?random=101', 'DL987654321', '2026-12-31', 'approved', 'admin_001', NULL, '2024-01-01T10:00:00Z', '2024-01-02T09:30:00Z', '2024-01-01T10:00:00Z'),
('doc_002', 'courier_001', 'insurance', 'https://picsum.photos/800/600?random=102', 'INS123456', '2024-12-31', 'approved', 'admin_001', NULL, '2024-01-01T10:15:00Z', '2024-01-02T09:45:00Z', '2024-01-01T10:15:00Z'),
('doc_003', 'courier_002', 'drivers_license', 'https://picsum.photos/800/600?random=103', 'DL123456789', '2027-06-15', 'approved', 'admin_001', NULL, '2024-01-01T11:00:00Z', '2024-01-02T10:00:00Z', '2024-01-01T11:00:00Z'),
('doc_004', 'courier_002', 'vehicle_registration', 'https://picsum.photos/800/600?random=104', 'REG789012', '2025-03-20', 'approved', 'admin_001', NULL, '2024-01-01T11:15:00Z', '2024-01-02T10:15:00Z', '2024-01-01T11:15:00Z'),
('doc_005', 'courier_003', 'drivers_license', 'https://picsum.photos/800/600?random=105', 'DL456789012', '2025-11-10', 'approved', 'admin_002', NULL, '2024-01-01T12:30:00Z', '2024-01-02T14:20:00Z', '2024-01-01T12:30:00Z'),
('doc_006', 'courier_005', 'drivers_license', 'https://picsum.photos/800/600?random=106', 'DL012345678', '2026-08-25', 'pending', NULL, NULL, '2024-01-01T14:30:00Z', NULL, '2024-01-01T14:30:00Z');

-- Insert courier availability
INSERT INTO courier_availability (uid, courier_uid, day_of_week, start_time, end_time, is_available, created_at, updated_at) VALUES
('avail_001', 'courier_001', 1, '08:00', '18:00', TRUE, '2024-01-01T09:30:00Z', '2024-01-01T09:30:00Z'),
('avail_002', 'courier_001', 2, '08:00', '18:00', TRUE, '2024-01-01T09:30:00Z', '2024-01-01T09:30:00Z'),
('avail_003', 'courier_001', 3, '08:00', '18:00', TRUE, '2024-01-01T09:30:00Z', '2024-01-01T09:30:00Z'),
('avail_004', 'courier_001', 4, '08:00', '18:00', TRUE, '2024-01-01T09:30:00Z', '2024-01-01T09:30:00Z'),
('avail_005', 'courier_001', 5, '08:00', '20:00', TRUE, '2024-01-01T09:30:00Z', '2024-01-01T09:30:00Z'),
('avail_006', 'courier_002', 1, '07:00', '19:00', TRUE, '2024-01-01T10:30:00Z', '2024-01-01T10:30:00Z'),
('avail_007', 'courier_002', 2, '07:00', '19:00', TRUE, '2024-01-01T10:30:00Z', '2024-01-01T10:30:00Z'),
('avail_008', 'courier_002', 3, '07:00', '19:00', TRUE, '2024-01-01T10:30:00Z', '2024-01-01T10:30:00Z'),
('avail_009', 'courier_002', 4, '07:00', '19:00', TRUE, '2024-01-01T10:30:00Z', '2024-01-01T10:30:00Z'),
('avail_010', 'courier_002', 5, '07:00', '21:00', TRUE, '2024-01-01T10:30:00Z', '2024-01-01T10:30:00Z'),
('avail_011', 'courier_002', 6, '09:00', '21:00', TRUE, '2024-01-01T10:30:00Z', '2024-01-01T10:30:00Z'),
('avail_012', 'courier_003', 1, '09:00', '17:00', TRUE, '2024-01-01T12:00:00Z', '2024-01-01T12:00:00Z'),
('avail_013', 'courier_003', 2, '09:00', '17:00', TRUE, '2024-01-01T12:00:00Z', '2024-01-01T12:00:00Z'),
('avail_014', 'courier_003', 3, '09:00', '17:00', TRUE, '2024-01-01T12:00:00Z', '2024-01-01T12:00:00Z'),
('avail_015', 'courier_004', 1, '06:00', '14:00', TRUE, '2024-01-01T13:00:00Z', '2024-01-01T13:00:00Z'),
('avail_016', 'courier_004', 2, '06:00', '14:00', TRUE, '2024-01-01T13:00:00Z', '2024-01-01T13:00:00Z'),
('avail_017', 'courier_004', 3, '06:00', '14:00', TRUE, '2024-01-01T13:00:00Z', '2024-01-01T13:00:00Z'),
('avail_018', 'courier_004', 4, '06:00', '14:00', TRUE, '2024-01-01T13:00:00Z', '2024-01-01T13:00:00Z'),
('avail_019', 'courier_004', 5, '06:00', '16:00', TRUE, '2024-01-01T13:00:00Z', '2024-01-01T13:00:00Z');

-- Insert addresses
INSERT INTO addresses (uid, user_uid, label, street_address, apartment_unit, city, state_province, postal_code, country, latitude, longitude, access_instructions, is_verified, use_count, is_favorite, created_at, updated_at) VALUES
('addr_001', 'user_001', 'home', '123 Main Street', 'Apt 4B', 'New York', 'NY', '10001', 'USA', 40.7505, -73.9934, 'Ring buzzer for apartment 4B', TRUE, 5, TRUE, '2024-01-01T09:00:00Z', '2024-01-10T14:30:00Z'),
('addr_002', 'user_001', 'work', '456 Business Ave', 'Suite 200', 'New York', 'NY', '10002', 'USA', 40.7589, -73.9851, 'Enter through main lobby, security desk', TRUE, 3, FALSE, '2024-01-01T09:15:00Z', '2024-01-08T16:45:00Z'),
('addr_003', 'user_003', 'home', '789 Oak Drive', NULL, 'Los Angeles', 'CA', '90210', 'USA', 34.0522, -118.2437, 'Leave at front door', TRUE, 2, TRUE, '2024-01-01T10:00:00Z', '2024-01-12T12:20:00Z'),
('addr_004', 'user_006', 'home', '321 Elm Street', 'Unit 15', 'Chicago', 'IL', '60601', 'USA', 41.8781, -87.6298, 'Call when arrived', TRUE, 7, TRUE, '2024-01-01T11:30:00Z', '2024-01-14T18:10:00Z'),
('addr_005', 'user_008', 'home', '654 Pine Ave', NULL, 'Denver', 'CO', '80202', 'USA', 39.7392, -104.9903, 'Ring doorbell twice', FALSE, 1, FALSE, '2024-01-01T12:30:00Z', '2024-01-01T12:30:00Z'),
('addr_006', 'user_010', 'work', '987 Corporate Blvd', 'Floor 5', 'San Francisco', 'CA', '94102', 'USA', 37.7749, -122.4194, 'Reception on 5th floor', TRUE, 4, TRUE, '2024-01-01T13:30:00Z', '2024-01-11T09:45:00Z'),
('addr_007', NULL, NULL, '111 Restaurant Row', NULL, 'Boston', 'MA', '02101', 'USA', 42.3601, -71.0589, 'Staff entrance on side', TRUE, 12, FALSE, '2024-01-01T14:00:00Z', '2024-01-15T20:15:00Z'),
('addr_008', NULL, NULL, '222 Shopping Center', NULL, 'Miami', 'FL', '33101', 'USA', 25.7617, -80.1918, 'Loading dock area', TRUE, 8, FALSE, '2024-01-01T15:00:00Z', '2024-01-13T11:30:00Z'),
('addr_009', 'user_012', 'home', '333 Residential St', 'Apt 2A', 'Seattle', 'WA', '98101', 'USA', 47.6062, -122.3321, 'Intercom code: 1234', TRUE, 3, TRUE, '2024-01-01T14:30:00Z', '2024-01-09T15:20:00Z'),
('addr_010', NULL, NULL, '444 Medical Plaza', 'Suite 301', 'Phoenix', 'AZ', '85001', 'USA', 33.4484, -112.0740, 'Third floor reception', TRUE, 6, FALSE, '2024-01-01T16:00:00Z', '2024-01-12T13:45:00Z');

-- Insert pricing zones
INSERT INTO pricing_zones (uid, zone_name, city, boundary_coordinates, base_price, price_per_km, minimum_price, maximum_distance, surge_multiplier, is_active, created_at, updated_at) VALUES
('zone_001', 'Downtown Manhattan', 'New York', '{"coordinates": [[40.7505, -73.9934], [40.7589, -73.9851], [40.7614, -73.9776]]}', 5.00, 2.50, 8.00, 25.0, 1.2, TRUE, '2024-01-01T08:00:00Z', '2024-01-10T10:00:00Z'),
('zone_002', 'Hollywood District', 'Los Angeles', '{"coordinates": [[34.0522, -118.2437], [34.0928, -118.3287], [34.0194, -118.4912]]}', 4.50, 2.00, 7.50, 30.0, 1.0, TRUE, '2024-01-01T08:30:00Z', '2024-01-08T14:30:00Z'),
('zone_003', 'Downtown Chicago', 'Chicago', '{"coordinates": [[41.8781, -87.6298], [41.8838, -87.6235], [41.8708, -87.6567]]}', 4.00, 1.80, 7.00, 35.0, 1.1, TRUE, '2024-01-01T09:00:00Z', '2024-01-12T16:20:00Z'),
('zone_004', 'Financial District', 'San Francisco', '{"coordinates": [[37.7749, -122.4194], [37.7849, -122.4094], [37.7649, -122.4294]]}', 6.00, 3.00, 9.00, 20.0, 1.5, TRUE, '2024-01-01T09:30:00Z', '2024-01-15T11:45:00Z');

-- Insert surge pricing
INSERT INTO surge_pricing (uid, pricing_zone_uid, day_of_week, start_time, end_time, multiplier, reason, is_active, effective_from, effective_until, created_at) VALUES
('surge_001', 'zone_001', 1, '17:00', '19:00', 1.5, 'peak_hours', TRUE, '2024-01-01T00:00:00Z', '2024-12-31T23:59:59Z', '2024-01-01T08:00:00Z'),
('surge_002', 'zone_001', 2, '17:00', '19:00', 1.5, 'peak_hours', TRUE, '2024-01-01T00:00:00Z', '2024-12-31T23:59:59Z', '2024-01-01T08:00:00Z'),
('surge_003', 'zone_001', 5, '17:00', '20:00', 2.0, 'peak_hours', TRUE, '2024-01-01T00:00:00Z', '2024-12-31T23:59:59Z', '2024-01-01T08:00:00Z'),
('surge_004', 'zone_002', 6, '19:00', '02:00', 1.8, 'nightlife', TRUE, '2024-01-01T00:00:00Z', '2024-12-31T23:59:59Z', '2024-01-01T08:30:00Z'),
('surge_005', 'zone_004', NULL, NULL, NULL, 2.5, 'weather', TRUE, '2024-01-15T00:00:00Z', '2024-01-17T23:59:59Z', '2024-01-15T06:00:00Z');

-- Insert deliveries
INSERT INTO deliveries (uid, delivery_number, sender_user_uid, courier_uid, business_account_uid, pickup_address_uid, delivery_address_uid, pickup_contact_name, pickup_contact_phone, delivery_contact_name, delivery_contact_phone, delivery_instructions, pickup_instructions, delivery_type, status, scheduled_pickup_time, actual_pickup_time, estimated_delivery_time, actual_delivery_time, total_distance, base_price, distance_price, surge_multiplier, total_price, courier_earnings, payment_status, cancellation_reason, failure_reason, retry_count, is_signature_required, is_photo_proof_required, priority_level, created_at, updated_at) VALUES
('delivery_001', 'QD202401001', 'user_001', 'courier_001', NULL, 'addr_001', 'addr_002', 'John Smith', '+1234567890', 'Office Reception', '+15551234567', 'Deliver to reception desk', 'Call when arriving', 'express', 'delivered', '2024-01-15T10:00:00Z', '2024-01-15T10:15:00Z', '2024-01-15T11:00:00Z', '2024-01-15T10:45:00Z', 2.5, 5.00, 5.00, 1.2, 12.00, 6.00, 'paid', NULL, NULL, 0, FALSE, TRUE, 2, '2024-01-15T09:30:00Z', '2024-01-15T10:45:00Z'),
('delivery_002', 'QD202401002', 'user_003', 'courier_002', NULL, 'addr_003', 'addr_006', 'Mike Davis', '+1234567892', 'Corporate Office', '+15559876543', 'Leave at reception if no answer', 'Ring doorbell', 'standard', 'en_route_delivery', '2024-01-15T14:00:00Z', '2024-01-15T14:20:00Z', '2024-01-15T16:30:00Z', NULL, 8.7, 4.50, 17.40, 1.0, 21.90, 10.95, 'paid', NULL, NULL, 0, TRUE, TRUE, 1, '2024-01-15T13:45:00Z', '2024-01-15T14:20:00Z'),
('delivery_003', 'QD202401003', 'user_006', NULL, NULL, 'addr_004', 'addr_007', 'Lisa Brown', '+1234567895', 'Restaurant Manager', '+15557654321', 'Deliver to kitchen entrance', 'Call from parking lot', 'priority', 'courier_assigned', '2024-01-15T18:00:00Z', NULL, '2024-01-15T19:15:00Z', NULL, 12.3, 4.00, 22.14, 1.0, 26.14, 13.07, 'pending', NULL, NULL, 0, FALSE, TRUE, 3, '2024-01-15T17:30:00Z', '2024-01-15T17:45:00Z'),
('delivery_004', 'QD202401004', 'user_001', 'courier_003', 'biz_001', 'addr_002', 'addr_008', 'Business Assistant', '+15551234567', 'Store Manager', '+15558765432', 'Fragile items - handle with care', 'Loading dock entrance', 'standard', 'picked_up', '2024-01-15T11:00:00Z', '2024-01-15T11:30:00Z', '2024-01-15T13:45:00Z', NULL, 15.6, 6.00, 31.20, 1.5, 56.70, 28.35, 'paid', NULL, NULL, 0, TRUE, TRUE, 2, '2024-01-15T10:45:00Z', '2024-01-15T11:30:00Z'),
('delivery_005', 'QD202401005', 'user_008', NULL, NULL, 'addr_005', 'addr_009', 'Jennifer Taylor', '+1234567897', 'Maria Garcia', '+1234567801', 'Apartment buzzer code 1234', 'Front door pickup', 'standard', 'requested', '2024-01-16T09:00:00Z', NULL, NULL, NULL, NULL, 4.00, 0.00, 1.0, 8.00, 4.00, 'pending', NULL, NULL, 0, FALSE, TRUE, 1, '2024-01-15T20:15:00Z', '2024-01-15T20:15:00Z'),
('delivery_006', 'QD202401006', 'user_010', 'courier_004', NULL, 'addr_006', 'addr_010', 'Amanda White', '+1234567899', 'Medical Receptionist', '+15552468135', 'Medical supplies - urgent', 'Office building main entrance', 'express', 'en_route_pickup', '2024-01-15T16:30:00Z', NULL, '2024-01-15T18:00:00Z', NULL, 22.8, 6.00, 68.40, 2.0, 148.80, 74.40, 'paid', NULL, NULL, 0, TRUE, TRUE, 3, '2024-01-15T16:00:00Z', '2024-01-15T16:15:00Z'),
('delivery_007', 'QD202401007', 'user_012', 'courier_001', 'biz_002', 'addr_009', 'addr_001', 'Maria Garcia', '+1234567801', 'John Smith', '+1234567890', 'Food delivery - keep warm', 'Restaurant pickup window', 'express', 'delivered', '2024-01-14T19:00:00Z', '2024-01-14T19:10:00Z', '2024-01-14T19:45:00Z', '2024-01-14T19:35:00Z', 5.4, 5.00, 10.80, 1.8, 28.44, 14.22, 'paid', NULL, NULL, 0, FALSE, TRUE, 2, '2024-01-14T18:45:00Z', '2024-01-14T19:35:00Z'),
('delivery_008', 'QD202401008', 'user_003', 'courier_002', NULL, 'addr_003', 'addr_004', 'Mike Davis', '+1234567892', 'Lisa Brown', '+1234567895', 'Birthday gift - handle carefully', 'Ring doorbell twice', 'standard', 'cancelled', '2024-01-13T15:00:00Z', NULL, NULL, NULL, NULL, 4.50, 0.00, 1.0, 7.50, 0.00, 'refunded', 'Sender requested cancellation', NULL, 0, FALSE, FALSE, 1, '2024-01-13T14:30:00Z', '2024-01-13T14:55:00Z');

-- Insert packages
INSERT INTO packages (uid, delivery_uid, package_number, description, category, size, weight, dimensions, value, is_fragile, special_instructions, insurance_coverage, package_photo_urls, created_at) VALUES
('package_001', 'delivery_001', 1, 'Important legal documents', 'documents', 'small', 0.5, '{"length": 30, "width": 25, "height": 5}', 0.00, FALSE, 'Keep dry and flat', 0.00, '["https://picsum.photos/400/300?random=201"]', '2024-01-15T09:30:00Z'),
('package_002', 'delivery_002', 1, 'Electronic tablet and accessories', 'electronics', 'medium', 1.2, '{"length": 35, "width": 25, "height": 8}', 599.99, TRUE, 'Handle with extreme care - fragile electronics', 600.00, '["https://picsum.photos/400/300?random=202", "https://picsum.photos/400/300?random=203"]', '2024-01-15T13:45:00Z'),
('package_003', 'delivery_003', 1, 'Fresh organic produce order', 'food', 'large', 3.5, '{"length": 40, "width": 30, "height": 25}', 85.50, FALSE, 'Keep refrigerated if possible', 0.00, '["https://picsum.photos/400/300?random=204"]', '2024-01-15T17:30:00Z'),
('package_004', 'delivery_004', 1, 'Ceramic art pieces', 'other', 'large', 4.8, '{"length": 45, "width": 35, "height": 30}', 1200.00, TRUE, 'EXTREMELY FRAGILE - ceramic artwork', 1200.00, '["https://picsum.photos/400/300?random=205", "https://picsum.photos/400/300?random=206"]', '2024-01-15T10:45:00Z'),
('package_005', 'delivery_004', 2, 'Protective packaging materials', 'other', 'medium', 1.0, '{"length": 30, "width": 30, "height": 20}', 25.00, FALSE, 'Bubble wrap and foam inserts', 0.00, '["https://picsum.photos/400/300?random=207"]', '2024-01-15T10:45:00Z'),
('package_006', 'delivery_005', 1, 'Personal clothing items', 'clothing', 'medium', 2.1, '{"length": 35, "width": 25, "height": 15}', 150.00, FALSE, 'New clothes - keep clean and dry', 150.00, '["https://picsum.photos/400/300?random=208"]', '2024-01-15T20:15:00Z'),
('package_007', 'delivery_006', 1, 'Medical prescription and supplies', 'other', 'small', 0.8, '{"length": 25, "width": 20, "height": 10}', 200.00, FALSE, 'Temperature sensitive medication', 200.00, '["https://picsum.photos/400/300?random=209"]', '2024-01-15T16:00:00Z'),
('package_008', 'delivery_007', 1, 'Restaurant meal order', 'food', 'large', 2.3, '{"length": 35, "width": 35, "height": 18}', 45.75, FALSE, 'Keep hot - insulated bag required', 0.00, '["https://picsum.photos/400/300?random=210"]', '2024-01-14T18:45:00Z');

-- Insert delivery tracking
INSERT INTO delivery_tracking (uid, delivery_uid, courier_uid, status, latitude, longitude, notes, photo_url, is_milestone, estimated_arrival_time, created_at) VALUES
('track_001', 'delivery_001', 'courier_001', 'courier_assigned', NULL, NULL, 'Courier assigned to delivery', NULL, TRUE, NULL, '2024-01-15T09:45:00Z'),
('track_002', 'delivery_001', 'courier_001', 'en_route_pickup', 40.7505, -73.9934, 'En route to pickup location', NULL, TRUE, '2024-01-15T10:00:00Z', '2024-01-15T10:00:00Z'),
('track_003', 'delivery_001', 'courier_001', 'picked_up', 40.7505, -73.9934, 'Package collected successfully', 'https://picsum.photos/600/400?random=301', TRUE, '2024-01-15T11:00:00Z', '2024-01-15T10:15:00Z'),
('track_004', 'delivery_001', 'courier_001', 'en_route_delivery', 40.7545, -73.9890, 'On the way to delivery address', NULL, TRUE, '2024-01-15T10:50:00Z', '2024-01-15T10:30:00Z'),
('track_005', 'delivery_001', 'courier_001', 'delivered', 40.7589, -73.9851, 'Package delivered successfully to reception', 'https://picsum.photos/600/400?random=302', TRUE, NULL, '2024-01-15T10:45:00Z'),
('track_006', 'delivery_002', 'courier_002', 'courier_assigned', NULL, NULL, 'Courier assigned and notified', NULL, TRUE, NULL, '2024-01-15T14:00:00Z'),
('track_007', 'delivery_002', 'courier_002', 'picked_up', 34.0522, -118.2437, 'Electronics package secured', 'https://picsum.photos/600/400?random=303', TRUE, '2024-01-15T16:30:00Z', '2024-01-15T14:20:00Z'),
('track_008', 'delivery_002', 'courier_002', 'en_route_delivery', 35.6895, -118.7878, 'Making good progress, traffic light', NULL, FALSE, '2024-01-15T16:00:00Z', '2024-01-15T15:15:00Z'),
('track_009', 'delivery_003', NULL, 'requested', NULL, NULL, 'Delivery requested, finding courier', NULL, TRUE, NULL, '2024-01-15T17:30:00Z'),
('track_010', 'delivery_003', 'courier_004', 'courier_assigned', NULL, NULL, 'Courier Carlos assigned', NULL, TRUE, NULL, '2024-01-15T17:45:00Z'),
('track_011', 'delivery_004', 'courier_003', 'courier_assigned', NULL, NULL, 'Business delivery assigned to Alex', NULL, TRUE, NULL, '2024-01-15T10:50:00Z'),
('track_012', 'delivery_004', 'courier_003', 'picked_up', 40.7589, -73.9851, 'Fragile artwork collected with extra care', 'https://picsum.photos/600/400?random=304', TRUE, '2024-01-15T13:45:00Z', '2024-01-15T11:30:00Z'),
('track_013', 'delivery_006', 'courier_004', 'courier_assigned', NULL, NULL, 'Express medical delivery assigned', NULL, TRUE, NULL, '2024-01-15T16:15:00Z'),
('track_014', 'delivery_007', 'courier_001', 'delivered', 40.7505, -73.9934, 'Food delivery completed on time', 'https://picsum.photos/600/400?random=305', TRUE, NULL, '2024-01-14T19:35:00Z'),
('track_015', 'delivery_008', NULL, 'cancelled', NULL, NULL, 'Delivery cancelled by sender before courier assignment', NULL, TRUE, NULL, '2024-01-13T14:55:00Z');

-- Insert payment methods
INSERT INTO payment_methods (uid, user_uid, type, provider, provider_payment_method_id, last_four_digits, expiry_month, expiry_year, cardholder_name, billing_address_uid, is_default, is_active, created_at, updated_at) VALUES
('payment_001', 'user_001', 'credit_card', 'stripe', 'pm_1234567890abcdef', '4242', 12, 2026, 'John Smith', 'addr_001', TRUE, TRUE, '2024-01-01T09:00:00Z', '2024-01-05T14:20:00Z'),
('payment_002', 'user_001', 'paypal', 'paypal', 'paypal_john_smith_001', NULL, NULL, NULL, 'John Smith', NULL, FALSE, TRUE, '2024-01-03T10:30:00Z', '2024-01-03T10:30:00Z'),
('payment_003', 'user_003', 'credit_card', 'stripe', 'pm_abcdef1234567890', '1234', 8, 2027, 'Mike Davis', 'addr_003', TRUE, TRUE, '2024-01-01T10:00:00Z', '2024-01-01T10:00:00Z'),
('payment_004', 'user_006', 'debit_card', 'stripe', 'pm_fedcba0987654321', '5678', 3, 2025, 'Lisa Brown', 'addr_004', TRUE, TRUE, '2024-01-01T11:30:00Z', '2024-01-08T16:45:00Z'),
('payment_005', 'user_008', 'apple_pay', 'stripe', 'pm_apple_pay_jennifer', NULL, NULL, NULL, 'Jennifer Taylor', NULL, TRUE, TRUE, '2024-01-01T12:30:00Z', '2024-01-01T12:30:00Z'),
('payment_006', 'user_010', 'credit_card', 'stripe', 'pm_9876543210fedcba', '9999', 11, 2028, 'Amanda White', 'addr_006', TRUE, TRUE, '2024-01-01T13:30:00Z', '2024-01-01T13:30:00Z'),
('payment_007', 'user_012', 'credit_card', 'stripe', 'pm_business_garcia_01', '7777', 6, 2029, 'Maria Garcia', 'addr_009', TRUE, TRUE, '2024-01-01T14:30:00Z', '2024-01-01T14:30:00Z');

-- Insert transactions
INSERT INTO transactions (uid, delivery_uid, user_uid, payment_method_uid, transaction_type, amount, currency, status, provider_transaction_id, fee_amount, tax_amount, description, failure_reason, processed_at, created_at) VALUES
('trans_001', 'delivery_001', 'user_001', 'payment_001', 'payment', 12.00, 'USD', 'completed', 'stripe_txn_001', 0.35, 0.65, 'Express delivery payment', NULL, '2024-01-15T09:35:00Z', '2024-01-15T09:30:00Z'),
('trans_002', 'delivery_002', 'user_003', 'payment_003', 'payment', 21.90, 'USD', 'completed', 'stripe_txn_002', 0.65, 1.00, 'Standard delivery payment', NULL, '2024-01-15T13:50:00Z', '2024-01-15T13:45:00Z'),
('trans_003', 'delivery_004', 'user_001', 'payment_001', 'payment', 56.70, 'USD', 'completed', 'stripe_txn_003', 1.65, 2.35, 'Business delivery - fragile items', NULL, '2024-01-15T10:50:00Z', '2024-01-15T10:45:00Z'),
('trans_004', 'delivery_006', 'user_010', 'payment_006', 'payment', 148.80, 'USD', 'completed', 'stripe_txn_004', 4.35, 6.15, 'Express medical delivery', NULL, '2024-01-15T16:05:00Z', '2024-01-15T16:00:00Z'),
('trans_005', 'delivery_007', 'user_012', 'payment_007', 'payment', 28.44, 'USD', 'completed', 'stripe_txn_005', 0.85, 1.20, 'Restaurant food delivery', NULL, '2024-01-14T18:50:00Z', '2024-01-14T18:45:00Z'),
('trans_006', 'delivery_008', 'user_003', 'payment_003', 'refund', 7.50, 'USD', 'completed', 'stripe_refund_001', 0.00, 0.00, 'Refund for cancelled delivery', NULL, '2024-01-13T15:10:00Z', '2024-01-13T15:00:00Z'),
('trans_007', NULL, 'user_002', NULL, 'courier_payout', 6.00, 'USD', 'completed', 'payout_courier_001_001', 0.18, 0.00, 'Courier earnings payout', NULL, '2024-01-15T23:00:00Z', '2024-01-15T22:45:00Z'),
('trans_008', NULL, 'user_004', NULL, 'courier_payout', 10.95, 'USD', 'pending', NULL, 0.33, 0.00, 'Courier earnings payout', NULL, NULL, '2024-01-15T23:15:00Z');

-- Insert promotional codes
INSERT INTO promotional_codes (uid, code, description, discount_type, discount_value, minimum_order_value, maximum_discount, usage_limit_per_user, total_usage_limit, current_usage_count, valid_from, valid_until, is_active, created_by_admin_uid, created_at) VALUES
('promo_001', 'WELCOME20', 'New user 20% discount', 'percentage', 20.00, 10.00, 15.00, 1, 1000, 124, '2024-01-01T00:00:00Z', '2024-03-31T23:59:59Z', TRUE, 'admin_001', '2024-01-01T08:00:00Z'),
('promo_002', 'SAVE5NOW', '$5 off any delivery', 'fixed_amount', 5.00, 15.00, 5.00, 3, 500, 89, '2024-01-01T00:00:00Z', '2024-02-29T23:59:59Z', TRUE, 'admin_001', '2024-01-01T08:30:00Z'),
('promo_003', 'FREEDEL', 'Free delivery promotion', 'free_delivery', 0.00, 25.00, 20.00, 2, 200, 67, '2024-01-15T00:00:00Z', '2024-01-31T23:59:59Z', TRUE, 'admin_002', '2024-01-15T09:00:00Z'),
('promo_004', 'BUSINESS10', 'Business account 10% discount', 'percentage', 10.00, 50.00, 25.00, 5, 100, 12, '2024-01-01T00:00:00Z', '2024-06-30T23:59:59Z', TRUE, 'admin_001', '2024-01-01T09:00:00Z'),
('promo_005', 'EXPIRED50', 'Expired 50% discount', 'percentage', 50.00, 20.00, 50.00, 1, 50, 45, '2023-12-01T00:00:00Z', '2023-12-31T23:59:59Z', FALSE, 'admin_001', '2023-12-01T10:00:00Z');

-- Insert promo code usage
INSERT INTO promo_code_usage (uid, promotional_code_uid, user_uid, delivery_uid, discount_applied, used_at) VALUES
('promo_use_001', 'promo_001', 'user_008', 'delivery_005', 1.60, '2024-01-15T20:15:00Z'),
('promo_use_002', 'promo_002', 'user_006', 'delivery_003', 5.00, '2024-01-15T17:30:00Z'),
('promo_use_003', 'promo_003', 'user_010', 'delivery_006', 20.00, '2024-01-15T16:00:00Z'),
('promo_use_004', 'promo_001', 'user_003', 'delivery_008', 1.50, '2024-01-13T14:30:00Z'),
('promo_use_005', 'promo_004', 'user_001', 'delivery_004', 5.67, '2024-01-15T10:45:00Z');

-- Insert messages
INSERT INTO messages (uid, delivery_uid, sender_user_uid, recipient_user_uid, message_type, content, photo_url, location_lat, location_lng, is_read, read_at, created_at) VALUES
('msg_001', 'delivery_001', 'user_001', 'user_002', 'text', 'Hi Sarah, I''m the sender for delivery QD202401001. Just wanted to confirm the pickup address.', NULL, NULL, NULL, TRUE, '2024-01-15T09:48:00Z', '2024-01-15T09:45:00Z'),
('msg_002', 'delivery_001', 'user_002', 'user_001', 'text', 'Hi John! Yes, I have the address. I''m about 5 minutes away from pickup.', NULL, NULL, NULL, TRUE, '2024-01-15T09:52:00Z', '2024-01-15T09:50:00Z'),
('msg_003', 'delivery_001', 'user_002', 'user_001', 'photo', 'Package collected successfully!', 'https://picsum.photos/600/400?random=401', 40.7505, -73.9934, TRUE, '2024-01-15T10:18:00Z', '2024-01-15T10:15:00Z'),
('msg_004', 'delivery_002', 'user_004', 'user_003', 'text', 'Hi Mike, I''m Emily, your courier. The package looks secure and I''m heading to San Francisco now.', NULL, NULL, NULL, TRUE, '2024-01-15T14:25:00Z', '2024-01-15T14:22:00Z'),
('msg_005', 'delivery_002', 'user_003', 'user_004', 'text', 'Great! Thanks for the update. Please be extra careful with the tablet.', NULL, NULL, NULL, TRUE, '2024-01-15T14:28:00Z', '2024-01-15T14:26:00Z'),
('msg_006', 'delivery_004', 'user_003', 'user_007', 'text', 'Hi Alex, this delivery contains fragile ceramic art. Please handle with extreme care.', NULL, NULL, NULL, TRUE, '2024-01-15T11:05:00Z', '2024-01-15T11:02:00Z'),
('msg_007', 'delivery_004', 'user_007', 'user_003', 'text', 'Understood! I''ve secured the artwork with extra padding. On my way to Miami now.', NULL, NULL, NULL, TRUE, '2024-01-15T11:35:00Z', '2024-01-15T11:32:00Z'),
('msg_008', 'delivery_006', 'user_010', 'user_009', 'text', 'This is urgent medical supplies. Patient is waiting.', NULL, NULL, NULL, FALSE, NULL, '2024-01-15T16:18:00Z'),
('msg_009', 'delivery_007', 'user_002', 'user_001', 'location', 'I''m here for your food delivery!', NULL, 40.7505, -73.9934, TRUE, '2024-01-14T19:32:00Z', '2024-01-14T19:30:00Z');

-- Insert notifications
INSERT INTO notifications (uid, user_uid, delivery_uid, type, title, message, channel, status, is_read, priority, metadata, scheduled_for, sent_at, read_at, created_at) VALUES
('notif_001', 'user_001', 'delivery_001', 'delivery_status', 'Delivery Completed', 'Your package has been delivered successfully to 456 Business Ave.', 'push', 'delivered', TRUE, 'normal', '{"delivery_photo": "https://picsum.photos/600/400?random=302"}', NULL, '2024-01-15T10:45:00Z', '2024-01-15T10:47:00Z', '2024-01-15T10:45:00Z'),
('notif_002', 'user_002', 'delivery_001', 'delivery_status', 'Delivery Completed', 'You completed delivery QD202401001. Earnings: $6.00', 'push', 'delivered', TRUE, 'normal', '{"earnings": 6.00}', NULL, '2024-01-15T10:45:00Z', '2024-01-15T10:46:00Z', '2024-01-15T10:45:00Z'),
('notif_003', 'user_003', 'delivery_002', 'delivery_status', 'Package Picked Up', 'Emily has collected your package and is en route to delivery.', 'sms', 'delivered', TRUE, 'normal', '{"courier_name": "Emily", "eta": "2024-01-15T16:30:00Z"}', NULL, '2024-01-15T14:20:00Z', '2024-01-15T14:25:00Z', '2024-01-15T14:20:00Z'),
('notif_004', 'user_006', 'delivery_003', 'delivery_status', 'Courier Assigned', 'Carlos has been assigned to your delivery. ETA for pickup: 6:00 PM', 'email', 'delivered', FALSE, 'high', '{"courier_name": "Carlos", "pickup_eta": "2024-01-15T18:00:00Z"}', NULL, '2024-01-15T17:45:00Z', NULL, '2024-01-15T17:45:00Z'),
('notif_005', 'user_007', 'delivery_004', 'delivery_status', 'New Delivery Assignment', 'You have been assigned delivery QD202401004. Pickup at 456 Business Ave.', 'push', 'delivered', TRUE, 'high', '{"pickup_address": "456 Business Ave", "special_notes": "Fragile items"}', NULL, '2024-01-15T10:50:00Z', '2024-01-15T10:52:00Z', '2024-01-15T10:50:00Z'),
('notif_006', 'user_008', 'delivery_005', 'delivery_status', 'Finding Courier', 'We''re finding the best courier for your delivery. You''ll be notified soon!', 'in_app', 'delivered', FALSE, 'normal', '{"estimated_assignment": "2024-01-16T09:30:00Z"}', NULL, '2024-01-15T20:16:00Z', NULL, '2024-01-15T20:16:00Z'),
('notif_007', 'user_010', 'delivery_006', 'payment', 'Payment Processed', 'Your payment of $148.80 has been processed successfully.', 'email', 'delivered', TRUE, 'normal', '{"amount": 148.80, "method": "Credit Card ending in 9999"}', NULL, '2024-01-15T16:05:00Z', '2024-01-15T16:10:00Z', '2024-01-15T16:05:00Z'),
('notif_008', 'user_003', 'delivery_008', 'delivery_status', 'Delivery Cancelled', 'Your delivery QD202401008 has been cancelled. Refund of $7.50 processed.', 'push', 'delivered', TRUE, 'normal', '{"refund_amount": 7.50}', NULL, '2024-01-13T15:00:00Z', '2024-01-13T15:02:00Z', '2024-01-13T15:00:00Z'),
('notif_009', 'user_001', NULL, 'promotion', 'Welcome Bonus!', 'Use code WELCOME20 for 20% off your next delivery!', 'email', 'delivered', FALSE, 'low', '{"promo_code": "WELCOME20", "discount": "20%"}', NULL, '2024-01-01T09:30:00Z', NULL, '2024-01-01T09:30:00Z'),
('notif_010', 'user_004', NULL, 'system', 'Weekly Earnings Summary', 'Great week Emily! You earned $125.50 from 8 completed deliveries.', 'push', 'delivered', TRUE, 'normal', '{"weekly_earnings": 125.50, "deliveries_count": 8}', NULL, '2024-01-15T18:00:00Z', '2024-01-15T18:15:00Z', '2024-01-15T18:00:00Z');

-- Insert reviews
INSERT INTO reviews (uid, delivery_uid, reviewer_user_uid, reviewed_user_uid, reviewer_type, overall_rating, speed_rating, communication_rating, care_rating, written_review, photo_urls, is_anonymous, response_text, response_at, is_featured, helpful_votes, created_at, updated_at) VALUES
('review_001', 'delivery_001', 'user_001', 'user_002', 'sender', 5, 5, 5, 5, 'Sarah was absolutely fantastic! Super fast delivery and great communication throughout. Highly recommend!', '["https://picsum.photos/400/300?random=501"]', FALSE, 'Thank you John! It was my pleasure to help with your delivery.', '2024-01-15T11:30:00Z', TRUE, 3, '2024-01-15T11:00:00Z', '2024-01-15T11:30:00Z'),
('review_002', 'delivery_001', 'user_002', 'user_001', 'courier', 5, NULL, 5, NULL, 'John was very clear with instructions and polite. Great customer!', NULL, FALSE, NULL, NULL, FALSE, 1, '2024-01-15T11:15:00Z', '2024-01-15T11:15:00Z'),
('review_003', 'delivery_007', 'user_001', 'user_002', 'sender', 4, 5, 4, 5, 'Food arrived hot and on time. Sarah is always reliable!', NULL, FALSE, 'Thanks for your continued trust in my service!', '2024-01-14T20:15:00Z', FALSE, 2, '2024-01-14T20:00:00Z', '2024-01-14T20:15:00Z'),
('review_004', 'delivery_007', 'user_002', 'user_012', 'courier', 5, NULL, 5, NULL, 'Restaurant had everything ready on time. Smooth pickup!', NULL, FALSE, NULL, NULL, FALSE, 0, '2024-01-14T20:10:00Z', '2024-01-14T20:10:00Z'),
('review_005', 'delivery_002', 'user_003', 'user_004', 'sender', 5, 4, 5, 5, 'Emily took excellent care of my electronics. Great communication and careful handling. Will definitely use again!', '["https://picsum.photos/400/300?random=502", "https://picsum.photos/400/300?random=503"]', FALSE, 'Thank you Mike! I always take extra care with electronics. Happy to help anytime!', '2024-01-15T17:45:00Z', TRUE, 8, '2024-01-15T17:30:00Z', '2024-01-15T17:45:00Z'),
('review_006', 'delivery_004', 'user_001', 'user_007', 'sender', 4, 3, 4, 5, 'Alex handled the fragile artwork perfectly. Delivery took longer than expected but the care was worth it.', NULL, FALSE, 'Thanks for understanding! Fragile items always get my full attention for safe delivery.', '2024-01-15T19:20:00Z', FALSE, 1, '2024-01-15T19:00:00Z', '2024-01-15T19:20:00Z'),
('review_007', 'delivery_003', 'user_006', 'user_009', 'sender', 3, 2, 3, 4, 'Food was delivered but took longer than expected. Carlos communicated well though.', NULL, TRUE, NULL, NULL, FALSE, 0, '2024-01-15T20:30:00Z', '2024-01-15T20:30:00Z');

-- Insert admin users
INSERT INTO admin_users (uid, username, email, password_hash, role, permissions, is_active, last_login_at, created_by_admin_uid, created_at, updated_at) VALUES
('admin_001', 'admin_master', 'admin@quickdrop.com', '$2b$10$SuperSecureAdminHashForMasterAccount12345', 'super_admin', '{"all_permissions": true}', TRUE, '2024-01-15T08:00:00Z', NULL, '2024-01-01T00:00:00Z', '2024-01-15T08:00:00Z'),
('admin_002', 'support_sarah', 'support@quickdrop.com', '$2b$10$SecureHashForSupportAgentAccount54321', 'support_agent', '{"user_support": true, "delivery_support": true, "courier_verification": true}', TRUE, '2024-01-15T09:30:00Z', 'admin_001', '2024-01-01T08:00:00Z', '2024-01-15T09:30:00Z'),
('admin_003', 'ops_manager', 'operations@quickdrop.com', '$2b$10$OperationsManagerSecureHash98765', 'operations_manager', '{"delivery_metrics": true, "courier_management": true, "pricing_management": true}', TRUE, '2024-01-15T07:45:00Z', 'admin_001', '2024-01-01T08:30:00Z', '2024-01-15T07:45:00Z');

-- Insert system settings
INSERT INTO system_settings (uid, setting_key, setting_value, setting_type, description, is_public, updated_by_admin_uid, updated_at, created_at) VALUES
('setting_001', 'max_delivery_distance', '100', 'number', 'Maximum delivery distance in kilometers', FALSE, 'admin_001', '2024-01-15T10:00:00Z', '2024-01-01T08:00:00Z'),
('setting_002', 'surge_threshold_multiplier', '1.5', 'number', 'Minimum surge pricing multiplier for peak hours', FALSE, 'admin_003', '2024-01-10T14:30:00Z', '2024-01-01T08:00:00Z'),
('setting_003', 'default_pickup_time_window', '60', 'number', 'Default pickup time window in minutes', FALSE, 'admin_001', '2024-01-05T12:15:00Z', '2024-01-01T08:00:00Z'),
('setting_004', 'platform_commission_rate', '0.15', 'number', 'Platform commission rate (15%)', FALSE, 'admin_001', '2024-01-01T08:00:00Z', '2024-01-01T08:00:00Z'),
('setting_005', 'support_email', 'support@quickdrop.com', 'string', 'Customer support email address', TRUE, 'admin_002', '2024-01-01T08:30:00Z', '2024-01-01T08:00:00Z'),
('setting_006', 'maintenance_mode', 'false', 'boolean', 'Platform maintenance mode status', TRUE, 'admin_001', '2024-01-15T06:00:00Z', '2024-01-01T08:00:00Z');

-- Insert file uploads
INSERT INTO file_uploads (uid, user_uid, entity_type, entity_uid, file_type, file_name, file_size, mime_type, storage_url, thumbnail_url, is_public, upload_purpose, metadata, uploaded_at, created_at) VALUES
('file_001', 'user_001', 'profile', 'user_001', 'image', 'profile_photo.jpg', 245760, 'image/jpeg', 'https://picsum.photos/200/200?random=1', 'https://picsum.photos/100/100?random=1', TRUE, 'profile_photo', '{"width": 200, "height": 200}', '2024-01-01T09:15:00Z', '2024-01-01T09:15:00Z'),
('file_002', 'user_002', 'delivery', 'delivery_001', 'image', 'pickup_proof.jpg', 512000, 'image/jpeg', 'https://picsum.photos/600/400?random=301', 'https://picsum.photos/150/100?random=301', FALSE, 'proof_of_pickup', '{"width": 600, "height": 400, "location": "pickup"}', '2024-01-15T10:15:00Z', '2024-01-15T10:15:00Z'),
('file_003', 'user_002', 'delivery', 'delivery_001', 'image', 'delivery_proof.jpg', 487936, 'image/jpeg', 'https://picsum.photos/600/400?random=302', 'https://picsum.photos/150/100?random=302', FALSE, 'proof_of_delivery', '{"width": 600, "height": 400, "location": "delivery"}', '2024-01-15T10:45:00Z', '2024-01-15T10:45:00Z'),
('file_004', 'user_001', 'package', 'package_001', 'image', 'package_contents.jpg', 324000, 'image/jpeg', 'https://picsum.photos/400/300?random=201', 'https://picsum.photos/100/75?random=201', FALSE, 'package_photo', '{"width": 400, "height": 300, "contents": "documents"}', '2024-01-15T09:30:00Z', '2024-01-15T09:30:00Z'),
('file_005', 'user_002', 'courier_document', 'doc_001', 'document', 'drivers_license.pdf', 1048576, 'application/pdf', 'https://picsum.photos/800/600?random=101', NULL, FALSE, 'drivers_license', '{"document_type": "government_id", "expiry_date": "2026-12-31"}', '2024-01-01T10:00:00Z', '2024-01-01T10:00:00Z'),
('file_006', 'user_003', 'review', 'review_005', 'image', 'delivery_review.jpg', 376832, 'image/jpeg', 'https://picsum.photos/400/300?random=502', 'https://picsum.photos/100/75?random=502', TRUE, 'review_photo', '{"width": 400, "height": 300, "rating": 5}', '2024-01-15T17:30:00Z', '2024-01-15T17:30:00Z');

-- Insert API keys
INSERT INTO api_keys (uid, business_account_uid, key_name, api_key, api_secret, permissions, rate_limit, is_active, last_used_at, expires_at, created_at) VALUES
('api_001', 'biz_001', 'TechCorp Production', 'qd_live_sk_1234567890abcdef1234567890abcdef', 'sk_secret_9876543210fedcba9876543210fedcba', '{"delivery_create": true, "delivery_read": true, "webhook_manage": true}', 1000, TRUE, '2024-01-15T14:30:00Z', '2025-01-01T00:00:00Z', '2024-01-02T10:00:00Z'),
('api_002', 'biz_001', 'TechCorp Development', 'qd_test_sk_abcdef1234567890abcdef1234567890', 'sk_secret_fedcba9876543210fedcba9876543210', '{"delivery_create": true, "delivery_read": true}', 100, TRUE, '2024-01-14T16:45:00Z', '2024-06-01T00:00:00Z', '2024-01-02T10:30:00Z'),
('api_003', 'biz_002', 'RestaurantPro Live', 'qd_live_sk_restaurant567890123456abcd', 'sk_secret_restaurant123456789abcdef01', '{"delivery_create": true, "delivery_read": true, "delivery_update": true}', 500, TRUE, '2024-01-15T19:20:00Z', '2025-01-03T00:00:00Z', '2024-01-03T11:00:00Z');

-- Insert webhooks
INSERT INTO webhooks (uid, business_account_uid, endpoint_url, event_types, is_active, secret_token, retry_count, last_success_at, last_failure_at, created_at, updated_at) VALUES
('webhook_001', 'biz_001', 'https://techcorp.com/webhooks/quickdrop', '["delivery.status_changed", "delivery.completed", "payment.processed"]', TRUE, 'whsec_techcorp_1234567890abcdef', 0, '2024-01-15T10:45:00Z', NULL, '2024-01-02T10:15:00Z', '2024-01-15T10:45:00Z'),
('webhook_002', 'biz_002', 'https://api.restaurantpro.com/deliveries/webhook', '["delivery.picked_up", "delivery.delivered", "delivery.cancelled"]', TRUE, 'whsec_restaurant_abcdef1234567890', 2, '2024-01-14T19:35:00Z', '2024-01-13T20:15:00Z', '2024-01-03T11:15:00Z', '2024-01-14T19:35:00Z'),
('webhook_003', 'biz_003', 'https://quickmart.com/api/delivery-updates', '["delivery.status_changed"]', FALSE, 'whsec_quickmart_fedcba0987654321', 5, '2024-01-05T16:30:00Z', '2024-01-10T14:20:00Z', '2024-01-05T14:30:00Z', '2024-01-10T14:20:00Z');

-- Insert delivery metrics
INSERT INTO delivery_metrics (uid, date, hour, pricing_zone_uid, total_deliveries, completed_deliveries, cancelled_deliveries, failed_deliveries, average_delivery_time, average_price, total_revenue, total_courier_earnings, unique_senders, unique_couriers, peak_concurrent_deliveries, average_rating, created_at) VALUES
('metrics_001', '2024-01-15', 10, 'zone_001', 2, 1, 0, 0, 30.0, 12.00, 12.00, 6.00, 1, 1, 1, 5.0, '2024-01-15T11:00:00Z'),
('metrics_002', '2024-01-15', 14, 'zone_002', 1, 0, 0, 0, NULL, 21.90, 21.90, 10.95, 1, 1, 1, NULL, '2024-01-15T15:00:00Z'),
('metrics_003', '2024-01-15', 17, 'zone_003', 1, 0, 0, 0, NULL, 26.14, 26.14, 13.07, 1, 1, 1, NULL, '2024-01-15T18:00:00Z'),
('metrics_004', '2024-01-15', 11, 'zone_001', 1, 0, 0, 0, NULL, 56.70, 56.70, 28.35, 1, 1, 1, NULL, '2024-01-15T12:00:00Z'),
('metrics_005', '2024-01-14', 19, 'zone_004', 1, 1, 0, 0, 25.0, 28.44, 28.44, 14.22, 1, 1, 1, 4.0, '2024-01-14T20:00:00Z'),
('metrics_006', '2024-01-13', 14, 'zone_002', 1, 0, 1, 0, NULL, 0.00, 0.00, 0.00, 1, 0, 0, NULL, '2024-01-13T15:00:00Z'),
('metrics_007', '2024-01-15', NULL, NULL, 6, 2, 1, 0, 27.5, 27.86, 145.18, 72.59, 5, 4, 2, 4.5, '2024-01-15T23:00:00Z'),
('metrics_008', '2024-01-14', NULL, NULL, 1, 1, 0, 0, 25.0, 28.44, 28.44, 14.22, 1, 1, 1, 4.0, '2024-01-14T23:00:00Z');

-- Insert user activity logs
INSERT INTO user_activity_logs (uid, user_uid, activity_type, page_url, activity_data, session_id, ip_address, user_agent, duration, created_at) VALUES
('activity_001', 'user_001', 'login', '/login', '{"login_method": "email", "success": true}', 'sess_john_001', '192.168.1.100', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', NULL, '2024-01-15T09:28:00Z'),
('activity_002', 'user_001', 'delivery_request', '/send-package', '{"pickup_address": "addr_001", "delivery_address": "addr_002", "delivery_type": "express"}', 'sess_john_001', '192.168.1.100', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 120, '2024-01-15T09:30:00Z'),
('activity_003', 'user_002', 'login', '/courier/login', '{"login_method": "phone", "success": true}', 'sess_sarah_001', '10.0.0.15', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', NULL, '2024-01-15T09:35:00Z'),
('activity_004', 'user_002', 'delivery_accept', '/courier/deliveries/delivery_001', '{"delivery_id": "delivery_001", "accepted": true}', 'sess_sarah_001', '10.0.0.15', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', 30, '2024-01-15T09:45:00Z'),
('activity_005', 'user_003', 'profile_update', '/profile', '{"updated_fields": ["phone", "notification_preferences"]}', 'sess_mike_001', '203.0.113.50', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 180, '2024-01-15T13:40:00Z'),
('activity_006', 'user_006', 'delivery_request', '/send-package', '{"pickup_address": "addr_004", "delivery_address": "addr_007", "delivery_type": "priority"}', 'sess_lisa_001', '198.51.100.25', 'Mozilla/5.0 (Android 13; Mobile)', 90, '2024-01-15T17:30:00Z'),
('activity_007', 'user_010', 'payment', '/payment', '{"payment_method": "payment_006", "amount": 148.80, "success": true}', 'sess_amanda_001', '172.16.0.100', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 45, '2024-01-15T16:00:00Z'),
('activity_008', 'user_001', 'review_submit', '/deliveries/delivery_001/review', '{"rating": 5, "review_text": "Sarah was absolutely fantastic!"}', 'sess_john_002', '192.168.1.100', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 300, '2024-01-15T11:00:00Z');

-- Insert audit logs
INSERT INTO audit_logs (uid, user_uid, admin_user_uid, entity_type, entity_uid, action, old_values, new_values, ip_address, user_agent, session_id, created_at) VALUES
('audit_001', NULL, 'admin_001', 'courier', 'courier_001', 'status_change', '{"verification_status": "pending"}', '{"verification_status": "approved"}', '10.0.1.5', 'Mozilla/5.0 (Windows NT 10.0; Admin)', 'admin_sess_001', '2024-01-02T09:30:00Z'),
('audit_002', 'user_001', NULL, 'delivery', 'delivery_001', 'create', NULL, '{"sender_user_uid": "user_001", "pickup_address_uid": "addr_001", "delivery_address_uid": "addr_002"}', '192.168.1.100', 'Mozilla/5.0 (Windows NT 10.0)', 'sess_john_001', '2024-01-15T09:30:00Z'),
('audit_003', 'user_002', NULL, 'delivery', 'delivery_001', 'status_change', '{"status": "courier_assigned"}', '{"status": "picked_up"}', '10.0.0.15', 'Mozilla/5.0 (iPhone)', 'sess_sarah_001', '2024-01-15T10:15:00Z'),
('audit_004', NULL, 'admin_002', 'promotional_code', 'promo_003', 'create', NULL, '{"code": "FREEDEL", "discount_type": "free_delivery", "discount_value": 0.00}', '10.0.1.8', 'Mozilla/5.0 (Windows NT 10.0; Admin)', 'admin_sess_002', '2024-01-15T09:00:00Z'),
('audit_005', 'user_003', NULL, 'delivery', 'delivery_008', 'cancel', '{"status": "requested"}', '{"status": "cancelled", "cancellation_reason": "Sender requested cancellation"}', '203.0.113.50', 'Mozilla/5.0 (Macintosh)', 'sess_mike_002', '2024-01-13T14:55:00Z'),
('audit_006', NULL, 'admin_003', 'pricing_zone', 'zone_001', 'update', '{"surge_multiplier": 1.0}', '{"surge_multiplier": 1.2}', '10.0.1.10', 'Mozilla/5.0 (Windows NT 10.0; Admin)', 'admin_sess_003', '2024-01-10T10:00:00Z');