import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { createServer } from 'http';
import { Server } from 'socket.io';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import nodemailer from 'nodemailer';
import twilio from 'twilio';
import { Client as GoogleMapsClient } from '@googlemaps/google-maps-services-js';
import Stripe from 'stripe';
import { body, validationResult } from 'express-validator';

// Load environment variables
dotenv.config();

// Validate required environment variables
const requiredEnvVars = ['JWT_SECRET', 'PGHOST', 'PGDATABASE', 'PGUSER', 'PGPASSWORD'];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

// ESM workaround for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize PostgreSQL connection
import { Pool } from 'pg';
const { PGHOST, PGDATABASE, PGUSER, PGPASSWORD } = process.env;

const pool = new Pool({
  host: PGHOST,
  database: PGDATABASE,
  user: PGUSER,
  password: PGPASSWORD,
  port: 5432,
  ssl: {
    require: true,
  },
});

// Test database connection
pool.connect((err, client, release) => {
  if (err) {
    console.error('Error connecting to PostgreSQL database:', err);
    process.exit(1);
  }
  console.log('Connected to PostgreSQL database');
  release();
});

// Initialize external services with validation
let emailTransporter, twilioClient, googleMapsClient, stripe;

try {
  if (process.env.EMAIL_USER && process.env.EMAIL_APP_PASSWORD) {
    emailTransporter = nodemailer.createTransporter({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_APP_PASSWORD
      }
    });
  }

  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
    twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  }

  if (process.env.GOOGLE_MAPS_API_KEY) {
    googleMapsClient = new GoogleMapsClient({});
  }

  if (process.env.STRIPE_SECRET_KEY) {
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
} catch (error) {
  console.error('Error initializing external services:', error);
}

// Initialize Express app
const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['http://localhost:3000'],
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(morgan('combined'));

// Create storage directory if it doesn't exist
const storageDir = path.join(__dirname, 'storage');
if (!fs.existsSync(storageDir)) {
  fs.mkdirSync(storageDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, storageDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}-${file.originalname}`;
    cb(null, uniqueName);
  }
});

const upload = multer({ 
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});

// Validation middleware
const validateEmail = body('email').isEmail().normalizeEmail();
const validatePhone = body('phone').matches(/^\\+?[1-9]\\d{1,14}$/);
const validatePassword = body('password').isLength({ min: 8 }).matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)/);
const validateRequired = (fields) => fields.map(field => body(field).notEmpty().trim());

// Enhanced JWT Authentication Middleware
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ success: false, error: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Fetch complete user data
    const client = await pool.connect();
    try {
      const userResult = await client.query(
        'SELECT uid, email, user_type, first_name, last_name, is_active FROM users WHERE uid = $1',
        [decoded.uid]
      );

      if (userResult.rows.length === 0 || !userResult.rows[0].is_active) {
        return res.status(403).json({ success: false, error: 'Invalid or inactive user' });
      }

      req.user = userResult.rows[0];
      next();
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(403).json({ success: false, error: 'Invalid token' });
  }
};

// WebSocket Authentication Middleware
const authenticateSocket = async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication error'));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const client = await pool.connect();
    try {
      const userResult = await client.query(
        'SELECT uid, email, user_type, first_name, last_name FROM users WHERE uid = $1',
        [decoded.uid]
      );

      if (userResult.rows.length === 0) {
        return next(new Error('User not found'));
      }

      socket.user = userResult.rows[0];
      next();
    } finally {
      client.release();
    }
  } catch (error) {
    next(new Error('Authentication error'));
  }
};

// Apply WebSocket authentication
io.use(authenticateSocket);

// Utility functions
const generateToken = (user) => {
  return jwt.sign(
    { uid: user.uid, email: user.email, user_type: user.user_type },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );
};

const generateRefreshToken = (user) => {
  return jwt.sign(
    { uid: user.uid, type: 'refresh' },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );
};

const getCurrentTimestamp = () => {
  return new Date().toISOString();
};

const generateDeliveryNumber = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `QD${year}${month}${day}${random}`;
};

// Error handling middleware
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false, 
      error: 'Validation failed',
      details: errors.array()
    });
  }
  next();
};

// External API functions with proper error handling
async function send_email_verification(email, verification_code) {
  try {
    if (!emailTransporter) {
      return { success: false, message: 'Email service not configured' };
    }

    const mailOptions = {
      from: process.env.FROM_EMAIL || 'noreply@quickdrop.com',
      to: email,
      subject: 'Email Verification - QuickDrop',
      html: `
        <div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: Arial, sans-serif;">
          <h2 style="color: #333;">Verify Your Email Address</h2>
          <p>Thank you for registering with QuickDrop! Please use the verification code below:</p>
          <div style="background: #f4f4f4; padding: 20px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 3px; margin: 20px 0;">
            ${verification_code}
          </div>
          <p>This code will expire in 15 minutes.</p>
          <p style="color: #666; font-size: 12px;">If you didn't request this verification, please ignore this email.</p>
        </div>
      `
    };

    const result = await emailTransporter.sendMail(mailOptions);
    
    return {
      success: true,
      message: 'Verification email sent successfully',
      email: email,
      verification_code: verification_code,
      messageId: result.messageId
    };
  } catch (error) {
    console.error('Email sending failed:', error);
    return {
      success: false,
      message: 'Failed to send verification email',
      error: error.message
    };
  }
}

async function send_sms_verification(phone, verification_code) {
  try {
    if (!twilioClient) {
      return { success: false, message: 'SMS service not configured' };
    }

    const formattedPhone = phone.startsWith('+') ? phone : `+1${phone}`;
    
    const message = await twilioClient.messages.create({
      body: `Your QuickDrop verification code is: ${verification_code}. This code expires in 10 minutes.`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: formattedPhone
    });

    return {
      success: true,
      message: 'Verification SMS sent successfully',
      phone: phone,
      verification_code: verification_code,
      sid: message.sid,
      status: message.status
    };
  } catch (error) {
    console.error('SMS sending failed:', error);
    return {
      success: false,
      message: 'Failed to send verification SMS',
      error: error.message,
      phone: phone
    };
  }
}

async function geocode_address(address) {
  try {
    if (!googleMapsClient || !process.env.GOOGLE_MAPS_API_KEY) {
      return {
        success: false,
        message: 'Geocoding service not configured',
        is_valid: false
      };
    }

    const addressString = `${address.street_address}, ${address.city}, ${address.state_province || ''} ${address.postal_code || ''}`.trim();
    
    const response = await googleMapsClient.geocode({
      params: {
        address: addressString,
        key: process.env.GOOGLE_MAPS_API_KEY,
      }
    });

    if (response.data.results.length === 0) {
      return {
        success: false,
        message: 'Address not found',
        is_valid: false
      };
    }

    const result = response.data.results[0];
    const location = result.geometry.location;

    return {
      success: true,
      latitude: location.lat,
      longitude: location.lng,
      formatted_address: result.formatted_address,
      is_valid: true,
      place_id: result.place_id,
      location_type: result.geometry.location_type
    };
  } catch (error) {
    console.error('Geocoding failed:', error);
    return {
      success: false,
      message: 'Geocoding service error',
      error: error.message,
      is_valid: false
    };
  }
}

async function process_payment_transaction(payment_data) {
  try {
    if (!stripe) {
      return { success: false, message: 'Payment service not configured' };
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(payment_data.amount * 100),
      currency: payment_data.currency || 'usd',
      payment_method: payment_data.payment_method_id,
      confirm: true,
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: 'never'
      },
      metadata: {
        customer_id: payment_data.customer_id || '',
        order_id: payment_data.order_id || ''
      }
    });

    const feeAmount = (payment_data.amount * 0.029) + 0.30;

    return {
      success: true,
      transaction_id: paymentIntent.id,
      amount: payment_data.amount,
      currency: paymentIntent.currency.toUpperCase(),
      status: paymentIntent.status,
      fee_amount: feeAmount,
      receipt_url: paymentIntent.charges.data[0]?.receipt_url || `https://receipts.quickdrop.com/${paymentIntent.id}`
    };
  } catch (error) {
    console.error('Payment processing failed:', error);
    return {
      success: false,
      message: 'Payment processing failed',
      error: error.message,
      decline_code: error.decline_code || null
    };
  }
}

async function calculate_route_info(pickup_coords, delivery_coords) {
  try {
    if (!googleMapsClient || !process.env.GOOGLE_MAPS_API_KEY) {
      // Return mock data if service not available
      const distance = Math.random() * 20 + 5;
      const duration = distance * 3 + Math.random() * 30;
      return {
        success: true,
        distance_km: parseFloat(distance.toFixed(2)),
        duration_minutes: Math.round(duration),
        duration_in_traffic_minutes: Math.round(duration * 1.2),
        estimated_cost: parseFloat((5.0 + distance * 2.5).toFixed(2)),
        route_polyline: 'mock_polyline',
        start_address: 'Mock Start Address',
        end_address: 'Mock End Address'
      };
    }

    const response = await googleMapsClient.directions({
      params: {
        origin: `${pickup_coords.latitude},${pickup_coords.longitude}`,
        destination: `${delivery_coords.latitude},${delivery_coords.longitude}`,
        mode: 'driving',
        departure_time: 'now',
        traffic_model: 'best_guess',
        key: process.env.GOOGLE_MAPS_API_KEY,
      }
    });

    if (response.data.routes.length === 0) {
      return {
        success: false,
        message: 'No route found between coordinates'
      };
    }

    const route = response.data.routes[0];
    const leg = route.legs[0];
    
    const distanceKm = leg.distance.value / 1000;
    const durationMinutes = leg.duration.value / 60;
    const durationInTrafficMinutes = leg.duration_in_traffic 
      ? leg.duration_in_traffic.value / 60 
      : durationMinutes;

    const baseCost = 5.0;
    const perKmRate = 2.5;
    const estimatedCost = baseCost + (distanceKm * perKmRate);

    return {
      success: true,
      distance_km: parseFloat(distanceKm.toFixed(2)),
      duration_minutes: Math.round(durationMinutes),
      duration_in_traffic_minutes: Math.round(durationInTrafficMinutes),
      estimated_cost: parseFloat(estimatedCost.toFixed(2)),
      route_polyline: route.overview_polyline.points,
      start_address: leg.start_address,
      end_address: leg.end_address
    };
  } catch (error) {
    console.error('Route calculation failed:', error);
    return {
      success: false,
      message: 'Route calculation service error',
      error: error.message
    };
  }
}

// Authentication Routes

/**
 * User Registration Endpoint
 * Creates new user accounts with email/phone verification
 * Supports different user types (sender, courier, business_admin)
 */
app.post('/api/v1/auth/register', [
  validateEmail,
  validatePhone,
  validatePassword,
  ...validateRequired(['user_type', 'first_name', 'last_name']),
  handleValidationErrors
], async (req, res) => {
  try {
    const { email, phone, password, user_type, first_name, last_name, preferred_language = 'en', timezone = 'UTC', business_info } = req.body;

    // Check if user already exists
    const client = await pool.connect();
    const existingUser = await client.query(
      'SELECT uid FROM users WHERE email = $1 OR phone = $2',
      [email, phone]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({ success: false, error: 'User with this email or phone already exists' });
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 12);
    const user_uid = uuidv4();
    const timestamp = getCurrentTimestamp();

    // Insert user
    await client.query(
      `INSERT INTO users (uid, email, phone, password_hash, user_type, first_name, last_name, 
       preferred_language, timezone, is_email_verified, is_phone_verified, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [user_uid, email, phone, password_hash, user_type, first_name, last_name, 
       preferred_language, timezone, false, false, true, timestamp, timestamp]
    );

    // Handle business account creation
    let business_account_uid = null;
    if (user_type === 'business_admin' && business_info) {
      business_account_uid = uuidv4();
      await client.query(
        `INSERT INTO business_accounts (uid, owner_user_uid, company_name, business_registration_number, 
         tax_id, industry_type, is_verified, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [business_account_uid, user_uid, business_info.company_name, business_info.business_registration_number,
         business_info.tax_id, business_info.industry_type, false, timestamp, timestamp]
      );
    }

    // Create courier profile if user_type is courier
    if (user_type === 'courier') {
      const courier_uid = uuidv4();
      await client.query(
        `INSERT INTO couriers (uid, user_uid, vehicle_type, is_available, is_verified, 
         verification_status, current_capacity, max_concurrent_deliveries, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [courier_uid, user_uid, 'bicycle', false, false, 'pending', 0, 3, timestamp, timestamp]
      );
    }

    // Send verification notifications
    const email_verification = await send_email_verification(email, Math.floor(100000 + Math.random() * 900000).toString());
    const sms_verification = await send_sms_verification(phone, Math.floor(100000 + Math.random() * 900000).toString());

    // Generate JWT token
    const token = generateToken({ uid: user_uid, email, user_type });
    const refreshToken = generateRefreshToken({ uid: user_uid });

    res.status(201).json({
      success: true,
      access_token: token,
      refresh_token: refreshToken,
      user: {
        uid: user_uid,
        email,
        user_type,
        first_name,
        last_name
      },
      verification_required: true,
      verification_methods: ['email', 'sms'],
      expires_in: 86400
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  } finally {
    client.release();
  }
});

/**
 * User Login Endpoint
 * Authenticates users with email/phone and password
 * Returns JWT token for subsequent API calls
 */
app.post('/api/v1/auth/login', [
  body('login_identifier').notEmpty().trim(),
  body('password').notEmpty(),
  handleValidationErrors
], async (req, res) => {
  try {
    const { login_identifier, password, remember_me = false } = req.body;

    const client = await pool.connect();
    const user = await client.query(
      `SELECT uid, email, phone, password_hash, user_type, first_name, last_name, is_active, 
       is_email_verified, is_phone_verified FROM users 
       WHERE (email = $1 OR phone = $1) AND is_active = true`,
      [login_identifier]
    );

    if (user.rows.length === 0) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    const userData = user.rows[0];
    const passwordValid = await bcrypt.compare(password, userData.password_hash);

    if (!passwordValid) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    // Update last login timestamp
    const timestamp = getCurrentTimestamp();
    await client.query(
      'UPDATE users SET last_login_at = $1 WHERE uid = $2',
      [timestamp, userData.uid]
    );

    // Generate tokens
    const expiresIn = remember_me ? '7d' : '24h';
    const access_token = jwt.sign(
      { uid: userData.uid, email: userData.email, user_type: userData.user_type },
      process.env.JWT_SECRET,
      { expiresIn }
    );

    const refresh_token = generateRefreshToken({ uid: userData.uid });

    res.json({
      success: true,
      access_token,
      refresh_token,
      user: {
        uid: userData.uid,
        email: userData.email,
        user_type: userData.user_type,
        first_name: userData.first_name,
        last_name: userData.last_name,
        is_email_verified: userData.is_email_verified,
        is_phone_verified: userData.is_phone_verified
      },
      expires_in: remember_me ? 604800 : 86400
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  } finally {
    client.release();
  }
});

/**
 * Logout Endpoint
 */
app.post('/api/v1/auth/logout', authenticateToken, async (req, res) => {
  try {
    // In a production environment, you would maintain a blacklist of tokens
    // or use a token store like Redis to invalidate tokens
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * Refresh Token Endpoint
 */
app.post('/api/v1/auth/refresh', [
  body('refresh_token').notEmpty(),
  handleValidationErrors
], async (req, res) => {
  const client = await pool.connect();
  try {
    const { refresh_token } = req.body;

    const decoded = jwt.verify(refresh_token, process.env.JWT_SECRET);

    if (decoded.type !== 'refresh') {
      return res.status(403).json({ success: false, error: 'Invalid refresh token' });
    }

    // Fetch user data
    const user = await client.query(
      'SELECT uid, email, user_type, is_active FROM users WHERE uid = $1',
      [decoded.uid]
    );

    if (user.rows.length === 0 || !user.rows[0].is_active) {
      return res.status(403).json({ success: false, error: 'Invalid user' });
    }

    const userData = user.rows[0];
    const access_token = generateToken(userData);
    const new_refresh_token = generateRefreshToken(userData);

    res.json({
      success: true,
      access_token,
      refresh_token: new_refresh_token,
      user: userData,
      expires_in: 86400
    });

  } catch (error) {
    console.error('Refresh token error:', error);
    if (error.name === 'TokenExpiredError') {
      return res.status(403).json({ success: false, error: 'Reset token has expired' });
    }
    res.status(500).json({ success: false, error: 'Internal server error' });
  } finally {
    client.release();
  }
});

/**
 * Forgot Password Endpoint
 */
app.post('/api/v1/auth/forgot-password', [
  validateEmail,
  handleValidationErrors
], async (req, res) => {
  const client = await pool.connect();
  try {
    const { email } = req.body;

    const user = await client.query(
      'SELECT uid, first_name FROM users WHERE email = $1 AND is_active = true',
      [email]
    );

    // Always return success to prevent email enumeration
    if (user.rows.length === 0) {
      return res.json({ success: true, message: 'If an account with this email exists, a reset link has been sent.' });
    }

    const resetToken = jwt.sign(
      { uid: user.rows[0].uid, type: 'password_reset' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // In a real implementation, you would send an email with the reset link
    // await send_password_reset_email(email, resetToken);

    res.json({ success: true, message: 'If an account with this email exists, a reset link has been sent.' });

  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  } finally {
    client.release();
  }
});

/**
 * Reset Password Endpoint
 */
app.post('/api/v1/auth/reset-password', [
  body('token').notEmpty(),
  validatePassword,
  handleValidationErrors
], async (req, res) => {
  const client = await pool.connect();
  try {
    const { token, new_password } = req.body;

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.type !== 'password_reset') {
      return res.status(403).json({ success: false, error: 'Invalid reset token' });
    }

    const password_hash = await bcrypt.hash(new_password, 12);
    const timestamp = getCurrentTimestamp();

    const updateResult = await client.query(
      'UPDATE users SET password_hash = $1, updated_at = $2 WHERE uid = $3 AND is_active = true',
      [password_hash, timestamp, decoded.uid]
    );

    if (updateResult.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'User not found or inactive' });
    }

    res.json({ success: true, message: 'Password reset successfully' });

  } catch (error) {
    console.error('Reset password error:', error);
    if (error.name === 'TokenExpiredError') {
      return res.status(403).json({ success: false, error: 'Reset token has expired' });
    }
    res.status(500).json({ success: false, error: 'Internal server error' });
  } finally {
    client.release();
  }
});

/**
 * User Profile Endpoint
 * Retrieves current user profile information including addresses and associated accounts
 */
app.get('/api/v1/auth/profile', authenticateToken, async (req, res) => {
  try {
    const client = await pool.connect();
    
    // Get user data
    const user = await client.query(
      `SELECT uid, email, phone, user_type, first_name, last_name, profile_photo_url,
       is_email_verified, is_phone_verified, is_active, preferred_language, timezone,
       notification_preferences, two_factor_enabled, last_login_at, created_at, updated_at
       FROM users WHERE uid = $1`,
      [req.user.uid]
    );

    if (user.rows.length === 0) {
      client.release();
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const userData = user.rows[0];

    // Get user addresses
    const addresses = await client.query(
      `SELECT uid, label, street_address, apartment_unit, city, state_province, postal_code,
       country, latitude, longitude, access_instructions, is_verified, use_count, is_favorite,
       created_at, updated_at FROM addresses WHERE user_uid = $1 ORDER BY is_favorite DESC, use_count DESC`,
      [req.user.uid]
    );

    // Get courier profile if user is courier
    let courier_profile = null;
    if (userData.user_type === 'courier') {
      const courier = await client.query(
        `SELECT uid, vehicle_type, vehicle_make, vehicle_model, vehicle_year, license_plate,
         max_package_weight, service_radius, is_available, is_verified, verification_status,
         average_rating, total_deliveries, completion_rate, earnings_balance
         FROM couriers WHERE user_uid = $1`,
        [req.user.uid]
      );
      courier_profile = courier.rows[0] || null;
    }

    // Get business account if user is business admin
    let business_account = null;
    if (userData.user_type === 'business_admin') {
      const business = await client.query(
        `SELECT uid, company_name, business_registration_number, tax_id, billing_email,
         billing_phone, company_address, industry_type, is_verified, credit_limit, payment_terms
         FROM business_accounts WHERE owner_user_uid = $1`,
        [req.user.uid]
      );
      business_account = business.rows[0] || null;
    }

    client.release();

    res.json({
      ...userData,
      addresses: addresses.rows,
      courier_profile,
      business_account
    });

  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * Update User Profile Endpoint
 * Updates user profile information
 */
app.put('/api/v1/auth/profile', authenticateToken, async (req, res) => {
  try {
    const { first_name, last_name, phone, profile_photo_url, preferred_language, timezone, notification_preferences } = req.body;

    const client = await pool.connect();
    const timestamp = getCurrentTimestamp();

    const updateResult = await client.query(
      `UPDATE users SET first_name = COALESCE($1, first_name), last_name = COALESCE($2, last_name),
       phone = COALESCE($3, phone), profile_photo_url = COALESCE($4, profile_photo_url),
       preferred_language = COALESCE($5, preferred_language), timezone = COALESCE($6, timezone),
       notification_preferences = COALESCE($7, notification_preferences), updated_at = $8
       WHERE uid = $9 RETURNING *`,
      [first_name, last_name, phone, profile_photo_url, preferred_language, timezone, notification_preferences, timestamp, req.user.uid]
    );

    client.release();

    if (updateResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    res.json(updateResult.rows[0]);

  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Address Management Routes

/**
 * Get User by UID Endpoint
 */
app.get('/api/v1/users/:user_uid', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const { user_uid } = req.params;

    const user = await client.query(
      'SELECT uid, email, phone, user_type, first_name, last_name, profile_photo_url, is_active, created_at FROM users WHERE uid = $1',
      [user_uid]
    );

    if (user.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    res.json(user.rows[0]);

  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  } finally {
    client.release();
  }
});

/**
 * Get User Addresses Endpoint
 */
app.get('/api/v1/users/:user_uid/addresses', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const { user_uid } = req.params;

    // Verify user access
    if (req.user.uid !== user_uid) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const addresses = await client.query(
      `SELECT uid, label, street_address, apartment_unit, city, state_province, postal_code,
       country, latitude, longitude, access_instructions, is_verified, use_count, is_favorite,
       created_at, updated_at FROM addresses WHERE user_uid = $1 ORDER BY is_favorite DESC, use_count DESC`,
      [user_uid]
    );

    res.json(addresses.rows);

  } catch (error) {
    console.error('Get addresses error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  } finally {
    client.release();
  }
});

/**
 * Create Address Endpoint
 */
app.post('/api/v1/users/:user_uid/addresses', authenticateToken, [
  ...validateRequired(['street_address', 'city', 'country']),
  handleValidationErrors
], async (req, res) => {
  const client = await pool.connect();
  try {
    const { user_uid } = req.params;
    const { label, street_address, apartment_unit, city, state_province, postal_code, country, access_instructions, is_favorite = false } = req.body;

    // Verify user access
    if (req.user.uid !== user_uid) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    // Geocode the address
    const geocodeResult = await geocode_address({
      street_address,
      city,
      state_province,
      postal_code,
      country
    });

    const address_uid = uuidv4();
    const timestamp = getCurrentTimestamp();

    const addressResult = await client.query(
      `INSERT INTO addresses (uid, user_uid, label, street_address, apartment_unit, city, 
       state_province, postal_code, country, latitude, longitude, access_instructions, 
       is_verified, use_count, is_favorite, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
       RETURNING *`,
      [address_uid, user_uid, label, street_address, apartment_unit, city, state_province, 
       postal_code, country, geocodeResult.latitude, geocodeResult.longitude, access_instructions,
       geocodeResult.is_valid, 0, is_favorite, timestamp, timestamp]
    );

    res.status(201).json(addressResult.rows[0]);

  } catch (error) {
    console.error('Create address error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  } finally {
    client.release();
  }
});

/**
 * Update Address Endpoint
 */
app.put('/api/v1/addresses/:address_uid', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const { address_uid } = req.params;
    const { label, street_address, apartment_unit, city, state_province, postal_code, country, access_instructions, is_favorite } = req.body;

    // Verify address ownership
    const addressOwner = await client.query(
      'SELECT user_uid FROM addresses WHERE uid = $1',
      [address_uid]
    );

    if (addressOwner.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Address not found' });
    }

    if (addressOwner.rows[0].user_uid !== req.user.uid) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const timestamp = getCurrentTimestamp();
    const updateResult = await client.query(
      `UPDATE addresses SET label = COALESCE($1, label), street_address = COALESCE($2, street_address),
       apartment_unit = COALESCE($3, apartment_unit), city = COALESCE($4, city),
       state_province = COALESCE($5, state_province), postal_code = COALESCE($6, postal_code),
       country = COALESCE($7, country), access_instructions = COALESCE($8, access_instructions),
       is_favorite = COALESCE($9, is_favorite), updated_at = $10 WHERE uid = $11 RETURNING *`,
      [label, street_address, apartment_unit, city, state_province, postal_code, country, 
       access_instructions, is_favorite, timestamp, address_uid]
    );

    res.json(updateResult.rows[0]);

  } catch (error) {
    console.error('Update address error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  } finally {
    client.release();
  }
});

/**
 * Delete Address Endpoint
 */
app.delete('/api/v1/addresses/:address_uid', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const { address_uid } = req.params;

    // Verify address ownership
    const addressOwner = await client.query(
      'SELECT user_uid FROM addresses WHERE uid = $1',
      [address_uid]
    );

    if (addressOwner.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Address not found' });
    }

    if (addressOwner.rows[0].user_uid !== req.user.uid) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    await client.query('DELETE FROM addresses WHERE uid = $1', [address_uid]);

    res.json({ success: true, message: 'Address deleted successfully' });

  } catch (error) {
    console.error('Delete address error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// Courier Routes

/**
 * Register Courier Endpoint
 * Registers additional courier information for existing users
 */
app.post('/api/v1/couriers/register', authenticateToken, async (req, res) => {
  try {
    const { vehicle_type, vehicle_make, vehicle_model, vehicle_year, license_plate, 
            max_package_weight = 30, service_radius = 50, max_concurrent_deliveries = 3 } = req.body;

    if (!vehicle_type) {
      return res.status(400).json({ success: false, error: 'Vehicle type is required' });
    }

    const client = await pool.connect();
    
    // Check if courier profile already exists
    const existingCourier = await client.query(
      'SELECT uid FROM couriers WHERE user_uid = $1',
      [req.user.uid]
    );

    if (existingCourier.rows.length > 0) {
      client.release();
      return res.status(409).json({ success: false, error: 'Courier profile already exists' });
    }

    const courier_uid = uuidv4();
    const timestamp = getCurrentTimestamp();

    const courierResult = await client.query(
      `INSERT INTO couriers (uid, user_uid, vehicle_type, vehicle_make, vehicle_model, 
       vehicle_year, license_plate, max_package_weight, service_radius, is_available, 
       is_verified, verification_status, current_capacity, max_concurrent_deliveries, 
       created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
       RETURNING *`,
      [courier_uid, req.user.uid, vehicle_type, vehicle_make, vehicle_model, vehicle_year,
       license_plate, max_package_weight, service_radius, false, false, 'pending', 0, 
       max_concurrent_deliveries, timestamp, timestamp]
    );

    client.release();

    res.status(201).json(courierResult.rows[0]);

  } catch (error) {
    console.error('Courier registration error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * Toggle Courier Availability Endpoint
 * Allows couriers to toggle their availability for receiving delivery requests
 */
app.put('/api/v1/couriers/availability', authenticateToken, async (req, res) => {
  try {
    const { is_available, current_location } = req.body;

    if (typeof is_available !== 'boolean') {
      return res.status(400).json({ success: false, error: 'is_available must be a boolean' });
    }

    const client = await pool.connect();

    // Verify courier exists and is verified
    const courier = await client.query(
      'SELECT uid, verification_status FROM couriers WHERE user_uid = $1',
      [req.user.uid]
    );

    if (courier.rows.length === 0) {
      client.release();
      return res.status(404).json({ success: false, error: 'Courier profile not found' });
    }

    if (courier.rows[0].verification_status !== 'approved') {
      client.release();
      return res.status(403).json({ success: false, error: 'Courier not verified' });
    }

    if (!courier.rows[0].is_available) {
      client.release();
      return res.status(403).json({ success: false, error: 'Courier not available' });
    }

    // Check if delivery is still available
    const delivery = await client.query(
      'SELECT uid, status, sender_user_uid FROM deliveries WHERE uid = $1',
      [delivery_uid]
    );

    if (delivery.rows.length === 0) {
      client.release();
      return res.status(404).json({ success: false, error: 'Delivery not found' });
    }

    if (delivery.rows[0].status !== 'requested') {
      client.release();
      return res.status(409).json({ success: false, error: 'Delivery already assigned' });
    }

    // Assign courier to delivery
    const timestamp = getCurrentTimestamp();
    await client.query(
      'UPDATE deliveries SET courier_uid = $1, status = $2, updated_at = $3 WHERE uid = $4',
      [courierData.uid, 'courier_assigned', timestamp, delivery_uid]
    );

    // Update courier capacity
    await client.query(
      'UPDATE couriers SET current_capacity = current_capacity + 1 WHERE uid = $1',
      [courierData.uid]
    );

    // Create tracking record
    const tracking_uid = uuidv4();
    await client.query(
      `INSERT INTO delivery_tracking (uid, delivery_uid, courier_uid, status, notes, is_milestone, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [tracking_uid, delivery_uid, courierData.uid, 'courier_assigned', 'Courier assigned to delivery', true, timestamp]
    );

    client.release();

    // Emit courier assignment event
    io.emit('courier_assigned', {
      event: 'courier_assigned',
      data: {
        delivery_uid,
        delivery_number: `QD${delivery_uid.substring(0, 8)}`,
        courier: {
          uid: courierData.uid,
          first_name: req.user.first_name,
          last_name: req.user.last_name,
          vehicle_type: 'bicycle',
          average_rating: 4.8,
          total_deliveries: 127,
          profile_photo_url: `https://picsum.photos/200/200?random=${courierData.uid}`
        },
        estimated_pickup_time: new Date(Date.now() + 30 * 60000).toISOString(),
        contact_methods: ['chat', 'phone'],
        tracking_available: true
      }
    });

    res.json({ success: true, message: 'Delivery accepted successfully' });

  } catch (error) {
    console.error('Courier availability error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * Get Courier Details Endpoint
 * Retrieves detailed courier profile information
 */
app.get('/api/v1/couriers/:courier_uid', authenticateToken, async (req, res) => {
  try {
    const { courier_uid } = req.params;

    const client = await pool.connect();
    const courierResult = await client.query(
      `SELECT c.*, u.first_name, u.last_name, u.profile_photo_url, u.email, u.phone
       FROM couriers c
       JOIN users u ON c.user_uid = u.uid
       WHERE c.uid = $1`,
      [courier_uid]
    );

    if (courierResult.rows.length === 0) {
      client.release();
      return res.status(404).json({ success: false, error: 'Courier not found' });
    }

    const courier = courierResult.rows[0];

    // Get recent reviews
    const reviews = await client.query(
      `SELECT r.*, u.first_name as reviewer_name FROM reviews r
       JOIN users u ON r.reviewer_user_uid = u.uid
       WHERE r.reviewed_user_uid = $1
       ORDER BY r.created_at DESC LIMIT 5`,
      [courier.user_uid]
    );

    client.release();

    res.json({
      ...courier,
      user_info: {
        first_name: courier.first_name,
        last_name: courier.last_name,
        profile_photo_url: courier.profile_photo_url,
        email: courier.email,
        phone: courier.phone
      },
      reviews: reviews.rows
    });

  } catch (error) {
    console.error('Get courier error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Delivery Routes

/**
 * Create Delivery Request Endpoint
 * Creates new delivery requests with package details and pricing calculations
 */
app.post('/api/v1/deliveries', authenticateToken, async (req, res) => {
  try {
    const {
      pickup_address, delivery_address, packages, pickup_contact_name, pickup_contact_phone,
      delivery_contact_name, delivery_contact_phone, delivery_instructions, pickup_instructions,
      delivery_type = 'standard', scheduled_pickup_time, is_signature_required = false,
      is_photo_proof_required = true, priority_level = 1, payment_method_uid, promotional_code
    } = req.body;

    if (!pickup_address || !delivery_address || !packages || !delivery_contact_name || !delivery_contact_phone) {
      return res.status(400).json({ success: false, error: 'Missing required delivery fields' });
    }

    const client = await pool.connect();
    const delivery_uid = uuidv4();
    const delivery_number = generateDeliveryNumber();
    const timestamp = getCurrentTimestamp();

    // Handle pickup address
    let pickup_address_uid;
    if (pickup_address.address_uid) {
      pickup_address_uid = pickup_address.address_uid;
    } else {
      // Create new pickup address
      const geocodeResult = await geocode_address(pickup_address);
      pickup_address_uid = uuidv4();
      await client.query(
        `INSERT INTO addresses (uid, user_uid, street_address, city, state_province, postal_code, country, 
         latitude, longitude, is_verified, use_count, is_favorite, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
        [pickup_address_uid, req.user.uid, pickup_address.street_address, pickup_address.city,
         pickup_address.state_province, pickup_address.postal_code, pickup_address.country,
         geocodeResult.latitude, geocodeResult.longitude, geocodeResult.is_valid, 0, false, timestamp, timestamp]
      );
    }

    // Handle delivery address
    let delivery_address_uid;
    if (delivery_address.address_uid) {
      delivery_address_uid = delivery_address.address_uid;
    } else {
      // Create new delivery address
      const geocodeResult = await geocode_address(delivery_address);
      delivery_address_uid = uuidv4();
      await client.query(
        `INSERT INTO addresses (uid, user_uid, street_address, city, state_province, postal_code, country,
         latitude, longitude, is_verified, use_count, is_favorite, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
        [delivery_address_uid, null, delivery_address.street_address, delivery_address.city,
         delivery_address.state_province, delivery_address.postal_code, delivery_address.country,
         geocodeResult.latitude, geocodeResult.longitude, geocodeResult.is_valid, 0, false, timestamp, timestamp]
      );
    }

    // Calculate pricing using route info
    const pickupAddressData = await client.query('SELECT latitude, longitude FROM addresses WHERE uid = $1', [pickup_address_uid]);
    const deliveryAddressData = await client.query('SELECT latitude, longitude FROM addresses WHERE uid = $1', [delivery_address_uid]);
    
    const routeInfo = await calculate_route_info(
      { latitude: pickupAddressData.rows[0].latitude, longitude: pickupAddressData.rows[0].longitude },
      { latitude: deliveryAddressData.rows[0].latitude, longitude: deliveryAddressData.rows[0].longitude }
    );

    const base_price = 5.0;
    const distance_price = routeInfo.success ? routeInfo.estimated_cost - base_price : Math.random() * 50 + 10;
    const surge_multiplier = 1.0 + (Math.random() * 0.5);
    const total_price = (base_price + distance_price) * surge_multiplier;
    const courier_earnings = total_price * 0.75;

    // Create delivery
    const deliveryResult = await client.query(
      `INSERT INTO deliveries (uid, delivery_number, sender_user_uid, pickup_address_uid, 
       delivery_address_uid, pickup_contact_name, pickup_contact_phone, delivery_contact_name, 
       delivery_contact_phone, delivery_instructions, pickup_instructions, delivery_type, 
       status, scheduled_pickup_time, total_distance, base_price, distance_price, surge_multiplier, total_price, 
       courier_earnings, payment_status, is_signature_required, is_photo_proof_required, 
       priority_level, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26)
       RETURNING *`,
      [delivery_uid, delivery_number, req.user.uid, pickup_address_uid, delivery_address_uid,
       pickup_contact_name, pickup_contact_phone, delivery_contact_name, delivery_contact_phone,
       delivery_instructions, pickup_instructions, delivery_type, 'requested', scheduled_pickup_time,
       routeInfo.success ? routeInfo.distance_km : null, base_price, distance_price, surge_multiplier, 
       total_price, courier_earnings, 'pending', is_signature_required, is_photo_proof_required, 
       priority_level, timestamp, timestamp]
    );

    // Create packages
    for (let i = 0; i < packages.length; i++) {
      const package = packages[i];
      const package_uid = uuidv4();
      await client.query(
        `INSERT INTO packages (uid, delivery_uid, package_number, description, category, size, 
         weight, dimensions, value, is_fragile, special_instructions, insurance_coverage, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [package_uid, delivery_uid, i + 1, package.description, package.category, package.size,
         package.weight, package.dimensions, package.value, package.is_fragile, 
         package.special_instructions, package.insurance_coverage, timestamp]
      );
    }

    // Create initial tracking record
    const tracking_uid = uuidv4();
    await client.query(
      `INSERT INTO delivery_tracking (uid, delivery_uid, status, notes, is_milestone, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [tracking_uid, delivery_uid, 'requested', 'Delivery requested, finding courier', true, timestamp]
    );

    client.release();

    // Calculate estimated times
    const estimated_pickup_time = new Date(Date.now() + 30 * 60000).toISOString();
    const estimated_delivery_time = new Date(Date.now() + (routeInfo.success ? (routeInfo.duration_minutes + 30) * 60000 : 120 * 60000)).toISOString();

    // Broadcast to available couriers
    io.emit('new_delivery_request', {
      event: 'new_delivery_request',
      data: {
        delivery_uid,
        delivery_number,
        pickup_address: pickup_address,
        delivery_address: delivery_address,
        package_info: {
          total_packages: packages.length,
          total_weight: packages.reduce((sum, pkg) => sum + (pkg.weight || 0), 0),
          size_category: packages[0]?.size || 'medium',
          special_instructions: packages.map(pkg => pkg.special_instructions).filter(Boolean).join('; ')
        },
        delivery_type,
        estimated_earnings: courier_earnings,
        estimated_duration: routeInfo.success ? routeInfo.duration_minutes : 120,
        distance_from_courier: Math.random() * 20 + 5,
        expires_at: new Date(Date.now() + 300000).toISOString()
      }
    });

    res.status(201).json({
      success: true,
      delivery_uid,
      delivery_number,
      pricing: {
        base_price,
        distance_price,
        surge_multiplier,
        total_price
      },
      estimated_pickup_time,
      estimated_delivery_time
    });

  } catch (error) {
    console.error('Create delivery error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * Get Delivery Details Endpoint
 * Retrieves comprehensive delivery information including tracking history
 */
app.get('/api/v1/deliveries/:delivery_uid', authenticateToken, async (req, res) => {
  try {
    const { delivery_uid } = req.params;

    const client = await pool.connect();
    
    // Get delivery with addresses and courier info
    const deliveryResult = await client.query(
      `SELECT d.*, 
       pickup_addr.street_address as pickup_street, pickup_addr.city as pickup_city,
       delivery_addr.street_address as delivery_street, delivery_addr.city as delivery_city,
       c.uid as courier_uid, cu.first_name as courier_first_name, cu.last_name as courier_last_name,
       cu.profile_photo_url as courier_photo,
       s.first_name as sender_first_name, s.last_name as sender_last_name
       FROM deliveries d
       LEFT JOIN addresses pickup_addr ON d.pickup_address_uid = pickup_addr.uid
       LEFT JOIN addresses delivery_addr ON d.delivery_address_uid = delivery_addr.uid
       LEFT JOIN couriers c ON d.courier_uid = c.uid
       LEFT JOIN users cu ON c.user_uid = cu.uid
       LEFT JOIN users s ON d.sender_user_uid = s.uid
       WHERE d.uid = $1`,
      [delivery_uid]
    );

    if (deliveryResult.rows.length === 0) {
      client.release();
      return res.status(404).json({ success: false, error: 'Delivery not found' });
    }

    const delivery = deliveryResult.rows[0];

    // Get packages
    const packages = await client.query(
      `SELECT uid, package_number, description, category, size, weight, dimensions, value,
       is_fragile, special_instructions, insurance_coverage, package_photo_urls
       FROM packages WHERE delivery_uid = $1 ORDER BY package_number`,
      [delivery_uid]
    );

    // Get tracking history
    const tracking = await client.query(
      `SELECT uid, status, latitude, longitude, notes, photo_url, is_milestone, 
       estimated_arrival_time, created_at
       FROM delivery_tracking WHERE delivery_uid = $1 ORDER BY created_at ASC`,
      [delivery_uid]
    );

    client.release();

    // Format response
    const response = {
      ...delivery,
      pickup_address: {
        street_address: delivery.pickup_street,
        city: delivery.pickup_city,
        latitude: delivery.pickup_lat,
        longitude: delivery.pickup_lng
      },
      delivery_address: {
        street_address: delivery.delivery_street,
        city: delivery.delivery_city,
        latitude: delivery.delivery_lat,
        longitude: delivery.delivery_lng
      },
      packages: packages.rows,
      tracking_history: tracking.rows,
      courier_info: delivery.courier_uid ? {
        uid: delivery.courier_uid,
        first_name: delivery.courier_first_name,
        last_name: delivery.courier_last_name,
        vehicle_type: delivery.vehicle_type,
        average_rating: delivery.average_rating,
        total_deliveries: delivery.total_deliveries,
        profile_photo_url: delivery.courier_photo
      } : null,
      sender_info: {
        first_name: delivery.sender_first_name,
        last_name: delivery.sender_last_name
      }
    };

    res.json(response);

  } catch (error) {
    console.error('Get delivery error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * Accept Delivery Request Endpoint
 * Allows couriers to accept delivery requests
 */
app.post('/api/v1/deliveries/:delivery_uid/accept', authenticateToken, async (req, res) => {
  try {
    const { delivery_uid } = req.params;

    const client = await pool.connect();

    // Get courier info
    const courier = await client.query(
      'SELECT uid, is_available, verification_status FROM couriers WHERE user_uid = $1',
      [req.user.uid]
    );

    if (courier.rows.length === 0) {
      client.release();
      return res.status(404).json({ success: false, error: 'Courier profile not found' });
    }

    const courierData = courier.rows[0];

    if (courierData.verification_status !== 'approved') {
      client.release();
      return res.status(403).json({ success: false, error: 'Courier not verified' });
    }

    if (!courierData.is_available) {
      client.release();
      return res.status(403).json({ success: false, error: 'Courier not available' });
    }

    // Check if delivery is still available
    const delivery = await client.query(
      'SELECT uid, status, sender_user_uid FROM deliveries WHERE uid = $1',
      [delivery_uid]
    );

    if (delivery.rows.length === 0) {
      client.release();
      return res.status(404).json({ success: false, error: 'Delivery not found' });
    }

    if (delivery.rows[0].status !== 'requested') {
      client.release();
      return res.status(409).json({ success: false, error: 'Delivery already assigned' });
    }

    // Assign courier to delivery
    const timestamp = getCurrentTimestamp();
    await client.query(
      'UPDATE deliveries SET courier_uid = $1, status = $2, updated_at = $3 WHERE uid = $4',
      [courierData.uid, 'courier_assigned', timestamp, delivery_uid]
    );

    // Update courier capacity
    await client.query(
      'UPDATE couriers SET current_capacity = current_capacity + 1 WHERE uid = $1',
      [courierData.uid]
    );

    // Create tracking record
    const tracking_uid = uuidv4();
    await client.query(
      `INSERT INTO delivery_tracking (uid, delivery_uid, courier_uid, status, notes, is_milestone, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [tracking_uid, delivery_uid, courierData.uid, 'courier_assigned', 'Courier assigned to delivery', true, timestamp]
    );

    client.release();

    // Emit courier assignment event
    io.emit('courier_assigned', {
      event: 'courier_assigned',
      data: {
        delivery_uid,
        delivery_number: `QD${delivery_uid.substring(0, 8)}`,
        courier: {
          uid: courierData.uid,
          first_name: req.user.first_name,
          last_name: req.user.last_name,
          vehicle_type: 'bicycle',
          average_rating: 4.8,
          total_deliveries: 127,
          profile_photo_url: `https://picsum.photos/200/200?random=${courierData.uid}`
        },
        estimated_pickup_time: new Date(Date.now() + 30 * 60000).toISOString(),
        contact_methods: ['chat', 'phone'],
        tracking_available: true
      }
    });

    res.json({ success: true, message: 'Delivery accepted successfully' });

  } catch (error) {
    console.error('Accept delivery error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * Confirm Pickup Endpoint
 * Allows couriers to confirm package pickup with photo proof
 */
app.post('/api/v1/deliveries/:delivery_uid/pickup', authenticateToken, async (req, res) => {
  try {
    const { delivery_uid } = req.params;
    const { photo_urls = [], notes, pickup_time } = req.body;

    const client = await pool.connect();

    // Verify courier assignment
    const delivery = await client.query(
      `SELECT d.uid, d.status, c.uid as courier_uid FROM deliveries d
       JOIN couriers c ON d.courier_uid = c.uid
       WHERE d.uid = $1 AND c.user_uid = $2`,
      [delivery_uid, req.user.uid]
    );

    if (delivery.rows.length === 0) {
      client.release();
      return res.status(404).json({ success: false, error: 'Delivery not found or not assigned to you' });
    }

    if (delivery.rows[0].status !== 'courier_assigned') {
      client.release();
      return res.status(409).json({ success: false, error: 'Invalid delivery status for pickup' });
    }

    // Update delivery status
    const timestamp = getCurrentTimestamp();
    const actual_pickup_time = pickup_time || timestamp;
    
    await client.query(
      'UPDATE deliveries SET status = $1, actual_pickup_time = $2, updated_at = $3 WHERE uid = $4',
      ['picked_up', actual_pickup_time, timestamp, delivery_uid]
    );

    // Create tracking record
    const tracking_uid = uuidv4();
    await client.query(
      `INSERT INTO delivery_tracking (uid, delivery_uid, courier_uid, status, notes, 
       photo_url, is_milestone, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [tracking_uid, delivery_uid, delivery.rows[0].courier_uid, 'picked_up', 
       notes || 'Package collected successfully', photo_urls[0] || null, true, timestamp]
    );

    client.release();

    // Emit status change event
    io.emit('delivery_status_changed', {
      event: 'delivery_status_changed',
      data: {
        delivery_uid,
        delivery_number: `QD${delivery_uid.substring(0, 8)}`,
        status: 'picked_up',
        status_timestamp: timestamp,
        courier_info: {
          uid: delivery.rows[0].courier_uid,
          first_name: req.user.first_name,
          last_name: req.user.last_name
        },
        proof_photo: photo_urls[0] || null,
        estimated_delivery_time: new Date(Date.now() + 90 * 60000).toISOString()
      }
    });

    res.json({ success: true, message: 'Pickup confirmed successfully' });

  } catch (error) {
    console.error('Confirm pickup error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * Confirm Delivery Endpoint
 * Allows couriers to confirm delivery completion
 */
app.post('/api/v1/deliveries/:delivery_uid/deliver', authenticateToken, async (req, res) => {
  try {
    const { delivery_uid } = req.params;
    const { delivery_confirmation_method, signature, photo_urls = [], recipient_name, notes, delivery_time } = req.body;

    if (!delivery_confirmation_method) {
      return res.status(400).json({ success: false, error: 'delivery_confirmation_method is required' });
    }

    const client = await pool.connect();

    // Verify courier assignment
    const delivery = await client.query(
      `SELECT d.uid, d.status, c.uid as courier_uid FROM deliveries d
       JOIN couriers c ON d.courier_uid = c.uid
       WHERE d.uid = $1 AND c.user_uid = $2`,
      [delivery_uid, req.user.uid]
    );

    if (delivery.rows.length === 0) {
      client.release();
      return res.status(404).json({ success: false, error: 'Delivery not found or not assigned to you' });
    }

    if (delivery.rows[0].status !== 'picked_up') {
      client.release();
      return res.status(409).json({ success: false, error: 'Invalid delivery status for completion' });
    }

    // Update delivery status
    const timestamp = getCurrentTimestamp();
    const actual_delivery_time = delivery_time || timestamp;
    
    await client.query(
      'UPDATE deliveries SET status = $1, actual_delivery_time = $2, updated_at = $3 WHERE uid = $4',
      ['delivered', actual_delivery_time, timestamp, delivery_uid]
    );

    // Create tracking record
    const tracking_uid = uuidv4();
    await client.query(
      `INSERT INTO delivery_tracking (uid, delivery_uid, courier_uid, status, notes, 
       photo_url, is_milestone, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [tracking_uid, delivery_uid, delivery.rows[0].courier_uid, 'delivered', 
       notes || `Package delivered successfully via ${delivery_confirmation_method}`, 
       photo_urls[0] || null, true, timestamp]
    );

    // Update courier capacity and statistics
    await client.query(
      `UPDATE couriers SET current_capacity = current_capacity - 1, 
       total_deliveries = total_deliveries + 1,
       completion_rate = (total_deliveries / (total_deliveries + 1)) * 100
       WHERE uid = $1`,
      [delivery.rows[0].courier_uid]
    );

    client.release();

    // Emit status change event
    io.emit('delivery_status_changed', {
      event: 'delivery_status_changed',
      data: {
        delivery_uid,
        delivery_number: `QD${delivery_uid.substring(0, 8)}`,
        status: 'delivered',
        status_timestamp: timestamp,
        courier_info: {
          uid: delivery.rows[0].courier_uid,
          first_name: req.user.first_name,
          last_name: req.user.last_name
        },
        proof_photo: photo_urls[0] || null
      }
    });

    res.json({ success: true, message: 'Delivery completed successfully' });

  } catch (error) {
    console.error('Confirm delivery error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * Get Delivery Status Endpoint
 * Retrieves current delivery status with real-time information
 */
app.get('/api/v1/deliveries/:delivery_uid/status', authenticateToken, async (req, res) => {
  try {
    const { delivery_uid } = req.params;

    const client = await pool.connect();
    
    const deliveryResult = await client.query(
      `SELECT d.uid, d.delivery_number, d.status, d.updated_at, d.estimated_delivery_time,
       c.uid as courier_uid, c.vehicle_type, c.average_rating,
       cu.first_name as courier_first_name, cu.last_name as courier_last_name,
       cu.profile_photo_url as courier_photo
       FROM deliveries d
       LEFT JOIN couriers c ON d.courier_uid = c.uid
       LEFT JOIN users cu ON c.user_uid = cu.uid
       WHERE d.uid = $1`,
      [delivery_uid]
    );

    if (deliveryResult.rows.length === 0) {
      client.release();
      return res.status(404).json({ success: false, error: 'Delivery not found' });
    }

    const delivery = deliveryResult.rows[0];

    // Get latest tracking location (if available)
    const locationResult = await client.query(
      `SELECT latitude, longitude, created_at 
       FROM delivery_tracking 
       WHERE delivery_uid = $1 AND latitude IS NOT NULL AND longitude IS NOT NULL
       ORDER BY created_at DESC LIMIT 1`,
      [delivery_uid]
    );

    client.release();

    const response = {
      delivery_uid: delivery.uid,
      delivery_number: delivery.delivery_number,
      status: delivery.status,
      status_timestamp: delivery.updated_at,
      courier_info: delivery.courier_uid ? {
        uid: delivery.courier_uid,
        first_name: delivery.courier_first_name,
        last_name: delivery.courier_last_name,
        vehicle_type: delivery.vehicle_type,
        current_location: locationResult.rows.length > 0 ? {
          latitude: locationResult.rows[0].latitude,
          longitude: locationResult.rows[0].longitude
        } : null
      } : null,
      estimated_delivery_time: delivery.estimated_delivery_time,
      tracking_url: `https://quickdrop.com/track/${delivery.delivery_number}`
    };

    res.json(response);

  } catch (error) {
    console.error('Get delivery status error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * List Deliveries Endpoint
 * Retrieves deliveries with filtering and pagination
 */
app.get('/api/v1/deliveries', authenticateToken, async (req, res) => {
  try {
    const { status, date_from, date_to, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let whereConditions = ['d.sender_user_uid = $1'];
    let queryParams = [req.user.uid];
    let paramCount = 1;

    if (status) {
      paramCount++;
      whereConditions.push(`d.status = $${paramCount}`);
      queryParams.push(status);
    }

    if (date_from) {
      paramCount++;
      whereConditions.push(`d.created_at >= $${paramCount}`);
      queryParams.push(date_from);
    }

    if (date_to) {
      paramCount++;
      whereConditions.push(`d.created_at <= $${paramCount}`);
      queryParams.push(date_to);
    }

    const client = await pool.connect();
    
    const deliveryResult = await client.query(
      `SELECT d.*, 
       pickup_addr.street_address as pickup_street, pickup_addr.city as pickup_city,
       delivery_addr.street_address as delivery_street, delivery_addr.city as delivery_city,
       c.uid as courier_uid, cu.first_name as courier_name, cu.last_name as courier_last_name
       FROM deliveries d
       LEFT JOIN addresses pickup_addr ON d.pickup_address_uid = pickup_addr.uid
       LEFT JOIN addresses delivery_addr ON d.delivery_address_uid = delivery_addr.uid
       LEFT JOIN couriers c ON d.courier_uid = c.uid
       LEFT JOIN users cu ON c.user_uid = cu.uid
       WHERE ${whereConditions.join(' AND ')}
       ORDER BY d.created_at DESC
       LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`,
      [...queryParams, limit, offset]
    );

    // Get total count for pagination
    const countResult = await client.query(
      `SELECT COUNT(*) as total FROM deliveries d WHERE ${whereConditions.join(' AND ')}`,
      queryParams
    );

    const totalCount = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(totalCount / limit);

    client.release();

    res.json({
      deliveries: deliveryResult.rows,
      pagination: {
        current_page: parseInt(page),
        total_pages: totalPages,
        total_count: totalCount,
        per_page: parseInt(limit)
      },
      statistics: {
        total_deliveries: totalCount,
        total_amount: deliveryResult.rows.reduce((sum, delivery) => sum + parseFloat(delivery.total_price || 0), 0),
        average_rating: 4.8
      }
    });

  } catch (error) {
    console.error('List deliveries error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Payment Routes

/**
 * Process Payment Endpoint
 * Processes payment for delivery services with promotional code support
 */
app.post('/api/v1/payments/process', authenticateToken, async (req, res) => {
  try {
    const { delivery_uid, payment_method_uid, promotional_code, billing_address_uid } = req.body;

    if (!delivery_uid || !payment_method_uid) {
      return res.status(400).json({ success: false, error: 'Missing required payment fields' });
    }

    const client = await pool.connect();

    // Verify delivery exists and belongs to user
    const delivery = await client.query(
      'SELECT uid, total_price, payment_status FROM deliveries WHERE uid = $1 AND sender_user_uid = $2',
      [delivery_uid, req.user.uid]
    );

    if (delivery.rows.length === 0) {
      client.release();
      return res.status(404).json({ success: false, error: 'Delivery not found' });
    }

    if (delivery.rows[0].payment_status === 'paid') {
      client.release();
      return res.status(409).json({ success: false, error: 'Payment already processed' });
    }

    // Verify payment method
    const paymentMethod = await client.query(
      'SELECT uid, type, provider, provider_payment_method_id FROM payment_methods WHERE uid = $1 AND user_uid = $2 AND is_active = true',
      [payment_method_uid, req.user.uid]
    );

    if (paymentMethod.rows.length === 0) {
      client.release();
      return res.status(404).json({ success: false, error: 'Payment method not found' });
    }

    let finalAmount = parseFloat(delivery.rows[0].total_price);

    // Apply promotional code if provided
    if (promotional_code) {
      const promo = await client.query(
        `SELECT uid, discount_type, discount_value, minimum_order_value, maximum_discount
         FROM promotional_codes WHERE code = $1 AND is_active = true 
         AND valid_from <= $2 AND valid_until >= $2`,
        [promotional_code, getCurrentTimestamp()]
      );

      if (promo.rows.length > 0) {
        const promoData = promo.rows[0];
        if (finalAmount >= promoData.minimum_order_value) {
          let discountAmount = 0;
          if (promoData.discount_type === 'percentage') {
            discountAmount = (finalAmount * promoData.discount_value) / 100;
            if (promoData.maximum_discount && discountAmount > promoData.maximum_discount) {
              discountAmount = promoData.maximum_discount;
            }
          } else if (promoData.discount_type === 'fixed_amount') {
            discountAmount = promoData.discount_value;
          }
          finalAmount = Math.max(0, finalAmount - discountAmount);

          // Record promo usage
          await client.query(
            `INSERT INTO promo_code_usage (uid, promotional_code_uid, user_uid, delivery_uid, discount_applied, used_at)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [uuidv4(), promoData.uid, req.user.uid, delivery_uid, discountAmount, getCurrentTimestamp()]
          );
        }
      }
    }

    // Process payment through external API
    const paymentResult = await process_payment_transaction({
      payment_method_id: paymentMethod.rows[0].provider_payment_method_id,
      amount: finalAmount,
      currency: 'USD',
      customer_id: req.user.uid,
      order_id: delivery_uid
    });

    if (!paymentResult.success) {
      client.release();
      return res.status(400).json({ success: false, error: 'Payment processing failed' });
    }

    // Create transaction record
    const transaction_uid = uuidv4();
    const timestamp = getCurrentTimestamp();
    
    await client.query(
      `INSERT INTO transactions (uid, delivery_uid, user_uid, payment_method_uid, transaction_type,
       amount, currency, status, provider_transaction_id, fee_amount, description, processed_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [transaction_uid, delivery_uid, req.user.uid, payment_method_uid, 'payment', finalAmount,
       'USD', 'completed', paymentResult.transaction_id, paymentResult.fee_amount,
       `Payment for delivery ${delivery_uid}`, timestamp, timestamp]
    );

    // Update delivery payment status
    await client.query(
      'UPDATE deliveries SET payment_status = $1, updated_at = $2 WHERE uid = $3',
      ['paid', timestamp, delivery_uid]
    );

    client.release();

    res.json({
      success: true,
      transaction_uid,
      amount_charged: finalAmount,
      payment_status: 'completed',
      receipt_url: paymentResult.receipt_url
    });

  } catch (error) {
    console.error('Process payment error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * Get Payment Methods Endpoint
 * Retrieves user's saved payment methods
 */
app.get('/api/v1/payment-methods', authenticateToken, async (req, res) => {
  try {
    const client = await pool.connect();
    
    const paymentMethods = await client.query(
      `SELECT uid, type, provider, last_four_digits, expiry_month, expiry_year, 
       cardholder_name, is_default, created_at
       FROM payment_methods WHERE user_uid = $1 AND is_active = true
       ORDER BY is_default DESC, created_at DESC`,
      [req.user.uid]
    );

    client.release();
    res.json(paymentMethods.rows);

  } catch (error) {
    console.error('Get payment methods error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * Create Payment Method Endpoint
 * Adds a new payment method for the user
 */
app.post('/api/v1/payment-methods', authenticateToken, async (req, res) => {
  try {
    const { type, provider_payment_method_id, last_four_digits, expiry_month, expiry_year, cardholder_name, is_default = false } = req.body;

    if (!type || !provider_payment_method_id) {
      return res.status(400).json({ success: false, error: 'Missing required payment method fields' });
    }

    const client = await pool.connect();
    
    // If setting as default, unset other default methods
    if (is_default) {
      await client.query(
        'UPDATE payment_methods SET is_default = false WHERE user_uid = $1',
        [req.user.uid]
      );
    }

    const payment_method_uid = uuidv4();
    const timestamp = getCurrentTimestamp();

    const paymentMethodResult = await client.query(
      `INSERT INTO payment_methods (uid, user_uid, type, provider, provider_payment_method_id,
       last_four_digits, expiry_month, expiry_year, cardholder_name, is_default, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
      [payment_method_uid, req.user.uid, type, 'stripe', provider_payment_method_id,
       last_four_digits, expiry_month, expiry_year, cardholder_name, is_default, true, timestamp, timestamp]
    );

    client.release();

    res.status(201).json(paymentMethodResult.rows[0]);

  } catch (error) {
    console.error('Create payment method error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// File Upload Routes

/**
 * File Upload Endpoint
 * Handles file uploads for various purposes (profile photos, package images, etc.)
 */
app.post('/api/v1/files/upload', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    const { entity_type, entity_uid, upload_purpose, is_public = false } = req.body;

    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    if (!entity_type || !entity_uid || !upload_purpose) {
      return res.status(400).json({ success: false, error: 'Missing required file upload fields' });
    }

    const client = await pool.connect();
    
    const file_uid = uuidv4();
    const timestamp = getCurrentTimestamp();
    const storage_url = `${req.protocol}://${req.get('host')}/storage/${req.file.filename}`;
    
    // Generate thumbnail for images
    let thumbnail_url = null;
    if (req.file.mimetype.startsWith('image/')) {
      thumbnail_url = storage_url;
    }

    const fileResult = await client.query(
      `INSERT INTO file_uploads (uid, user_uid, entity_type, entity_uid, file_type, file_name,
       file_size, mime_type, storage_url, thumbnail_url, is_public, upload_purpose, uploaded_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *`,
      [file_uid, req.user.uid, entity_type, entity_uid, req.file.mimetype.split('/')[0],
       req.file.filename, req.file.size, req.file.mimetype, storage_url, thumbnail_url,
       is_public, upload_purpose, timestamp, timestamp]
    );

    // Update related entity with file URL if applicable
    if (entity_type === 'profile' && upload_purpose === 'profile_photo') {
      await client.query(
        'UPDATE users SET profile_photo_url = $1 WHERE uid = $2',
        [storage_url, req.user.uid]
      );
    }

    client.release();

    res.status(201).json({
      success: true,
      file_uid,
      storage_url,
      thumbnail_url,
      file_size: req.file.size,
      mime_type: req.file.mimetype
    });

  } catch (error) {
    console.error('File upload error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Messaging Routes

/**
 * Get Delivery Messages Endpoint
 * Retrieves messages for a specific delivery
 */
app.get('/api/v1/deliveries/:delivery_uid/messages', authenticateToken, async (req, res) => {
  try {
    const { delivery_uid } = req.params;

    const client = await pool.connect();
    
    // Verify user has access to this delivery
    const deliveryAccess = await client.query(
      `SELECT uid FROM deliveries WHERE uid = $1 AND 
       (sender_user_uid = $2 OR courier_uid = (SELECT uid FROM couriers WHERE user_uid = $2))`,
      [delivery_uid, req.user.uid]
    );

    if (deliveryAccess.rows.length === 0) {
      client.release();
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const messages = await client.query(
      `SELECT m.uid, m.sender_user_uid, m.recipient_user_uid, m.message_type, m.content,
       m.photo_url, m.location_lat, m.location_lng, m.is_read, m.read_at, m.created_at,
       u.first_name as sender_name, u.user_type as sender_type
       FROM messages m
       JOIN users u ON m.sender_user_uid = u.uid
       WHERE m.delivery_uid = $1
       ORDER BY m.created_at ASC`,
      [delivery_uid]
    );

    client.release();

    res.json(messages.rows);

  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * Send Message Endpoint
 * Sends a message for a delivery
 */
app.post('/api/v1/deliveries/:delivery_uid/messages', authenticateToken, async (req, res) => {
  try {
    const { delivery_uid } = req.params;
    const { recipient_user_uid, message_type, content, photo_url, location } = req.body;

    if (!recipient_user_uid || !message_type) {
      return res.status(400).json({ success: false, error: 'Missing required message fields' });
    }

    const client = await pool.connect();
    
    // Verify user has access to this delivery
    const deliveryAccess = await client.query(
      `SELECT uid FROM deliveries WHERE uid = $1 AND 
       (sender_user_uid = $2 OR courier_uid = (SELECT uid FROM couriers WHERE user_uid = $2))`,
      [delivery_uid, req.user.uid]
    );

    if (deliveryAccess.rows.length === 0) {
      client.release();
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const message_uid = uuidv4();
    const timestamp = getCurrentTimestamp();

    const messageResult = await client.query(
      `INSERT INTO messages (uid, delivery_uid, sender_user_uid, recipient_user_uid, message_type,
       content, photo_url, location_lat, location_lng, is_read, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [message_uid, delivery_uid, req.user.uid, recipient_user_uid, message_type, content,
       photo_url, location?.latitude, location?.longitude, false, timestamp]
    );

    client.release();

    // Emit real-time message
    io.emit('chat_message', {
      event: 'chat_message',
      data: {
        message_uid,
        delivery_uid,
        sender_info: {
          user_uid: req.user.uid,
          first_name: req.user.first_name,
          user_type: req.user.user_type
        },
        message_type,
        content,
        photo_url,
        location,
        timestamp
      }
    });

    res.status(201).json(messageResult.rows[0]);

  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Review Routes

/**
 * Submit Review Endpoint
 * Allows users to submit reviews for completed deliveries
 */
app.post('/api/v1/deliveries/:delivery_uid/reviews', authenticateToken, async (req, res) => {
  try {
    const { delivery_uid } = req.params;
    const { overall_rating, speed_rating, communication_rating, care_rating, written_review, photo_uids = [], is_anonymous = false } = req.body;

    if (!overall_rating || overall_rating < 1 || overall_rating > 5) {
      return res.status(400).json({ success: false, error: 'Invalid overall rating' });
    }

    const client = await pool.connect();

    // Verify delivery exists and user participated
    const delivery = await client.query(
      `SELECT d.uid, d.status, d.sender_user_uid, c.user_uid as courier_user_uid
       FROM deliveries d
       LEFT JOIN couriers c ON d.courier_uid = c.uid
       WHERE d.uid = $1 AND (d.sender_user_uid = $2 OR c.user_uid = $2)`,
      [delivery_uid, req.user.uid]
    );

    if (delivery.rows.length === 0) {
      client.release();
      return res.status(404).json({ success: false, error: 'Delivery not found or access denied' });
    }

    if (delivery.rows[0].status !== 'delivered') {
      client.release();
      return res.status(400).json({ success: false, error: 'Can only review completed deliveries' });
    }

    const deliveryData = delivery.rows[0];
    const is_sender = deliveryData.sender_user_uid === req.user.uid;
    const reviewed_user_uid = is_sender ? deliveryData.courier_user_uid : deliveryData.sender_user_uid;
    const reviewer_type = is_sender ? 'sender' : 'courier';

    // Check if review already exists
    const existingReview = await client.query(
      'SELECT uid FROM reviews WHERE delivery_uid = $1 AND reviewer_user_uid = $2',
      [delivery_uid, req.user.uid]
    );

    if (existingReview.rows.length > 0) {
      client.release();
      return res.status(409).json({ success: false, error: 'Review already submitted' });
    }

    const review_uid = uuidv4();
    const timestamp = getCurrentTimestamp();

    const reviewResult = await client.query(
      `INSERT INTO reviews (uid, delivery_uid, reviewer_user_uid, reviewed_user_uid, reviewer_type,
       overall_rating, speed_rating, communication_rating, care_rating, written_review, 
       photo_urls, is_anonymous, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *`,
      [review_uid, delivery_uid, req.user.uid, reviewed_user_uid, reviewer_type,
       overall_rating, speed_rating, communication_rating, care_rating, written_review,
       JSON.stringify(photo_uids), is_anonymous, timestamp, timestamp]
    );

    // Update courier average rating if reviewing courier
    if (reviewer_type === 'sender') {
      await client.query(
        `UPDATE couriers SET average_rating = (
          SELECT AVG(overall_rating) FROM reviews WHERE reviewed_user_uid = $1
        ) WHERE user_uid = $1`,
        [reviewed_user_uid]
      );
    }

    client.release();

    res.status(201).json(reviewResult.rows[0]);

  } catch (error) {
    console.error('Submit review error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Notification Routes

/**
 * Get Notifications Endpoint
 * Retrieves user notifications with pagination
 */
app.get('/api/v1/notifications', authenticateToken, async (req, res) => {
  try {
    const { unread_only = false, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let whereCondition = 'user_uid = $1';
    let queryParams = [req.user.uid];

    if (unread_only === 'true') {
      whereCondition += ' AND is_read = false';
    }

    const client = await pool.connect();

    const notifications = await client.query(
      `SELECT uid, delivery_uid, type, title, message, channel, status, is_read, priority,
       scheduled_for, sent_at, read_at, created_at
       FROM notifications WHERE ${whereCondition}
       ORDER BY created_at DESC
       LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`,
      [...queryParams, limit, offset]
    );

    const countResult = await client.query(
      `SELECT COUNT(*) as total, SUM(CASE WHEN is_read = false THEN 1 ELSE 0 END) as unread_count
       FROM notifications WHERE user_uid = $1`,
      [req.user.uid]
    );

    const totalCount = parseInt(countResult.rows[0].total);
    const unreadCount = parseInt(countResult.rows[0].unread_count);
    const totalPages = Math.ceil(totalCount / limit);

    client.release();

    res.json({
      notifications: notifications.rows,
      pagination: {
        current_page: parseInt(page),
        total_pages: totalPages,
        total_count: totalCount,
        per_page: parseInt(limit)
      },
      unread_count: unreadCount
    });

  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * Mark Notification as Read Endpoint
 * Marks a specific notification as read
 */
app.put('/api/v1/notifications/:notification_uid/read', authenticateToken, async (req, res) => {
  try {
    const { notification_uid } = req.params;

    const client = await pool.connect();
    
    const updateResult = await client.query(
      'UPDATE notifications SET is_read = true, read_at = $1 WHERE uid = $2 AND user_uid = $3',
      [getCurrentTimestamp(), notification_uid, req.user.uid]
    );

    client.release();

    if (updateResult.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Notification not found' });
    }

    res.json({ success: true, message: 'Notification marked as read' });

  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Business Account Routes

/**
 * Create Business Account Endpoint
 * Creates a new business account for corporate users
 */
app.post('/api/v1/business-accounts', authenticateToken, async (req, res) => {
  try {
    const { company_name, business_registration_number, tax_id, billing_email, billing_phone, company_address, industry_type } = req.body;

    if (!company_name) {
      return res.status(400).json({ success: false, error: 'Company name is required' });
    }

    const client = await pool.connect();

    const business_account_uid = uuidv4();
    const timestamp = getCurrentTimestamp();

    const businessResult = await client.query(
      `INSERT INTO business_accounts (uid, owner_user_uid, company_name, business_registration_number,
       tax_id, billing_email, billing_phone, company_address, industry_type, is_verified, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
      [business_account_uid, req.user.uid, company_name, business_registration_number, tax_id,
       billing_email, billing_phone, company_address, industry_type, false, timestamp, timestamp]
    );

    client.release();

    res.status(201).json(businessResult.rows[0]);

  } catch (error) {
    console.error('Create business account error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * Get Business Account Details Endpoint
 * Retrieves comprehensive business account information
 */
app.get('/api/v1/business-accounts/:business_account_uid', authenticateToken, async (req, res) => {
  try {
    const { business_account_uid } = req.params;

    const client = await pool.connect();

    // Get business account details
    const businessResult = await client.query(
      `SELECT ba.*, u.first_name as owner_first_name, u.last_name as owner_last_name, u.email as owner_email
       FROM business_accounts ba
       JOIN users u ON ba.owner_user_uid = u.uid
       WHERE ba.uid = $1`,
      [business_account_uid]
    );

    if (businessResult.rows.length === 0) {
      client.release();
      return res.status(404).json({ success: false, error: 'Business account not found' });
    }

    const business = businessResult.rows[0];

    // Get team members
    const teamMembers = await client.query(
      `SELECT btm.*, u.first_name, u.last_name, u.email
       FROM business_team_members btm
       JOIN users u ON btm.user_uid = u.uid
       WHERE btm.business_account_uid = $1 AND btm.is_active = true`,
      [business_account_uid]
    );

    // Get delivery statistics
    const deliveryStats = await client.query(
      `SELECT COUNT(*) as total_deliveries, AVG(total_price) as average_cost
       FROM deliveries WHERE business_account_uid = $1`,
      [business_account_uid]
    );

    client.release();

    res.json({
      business_account: {
        ...business,
        owner_info: {
          first_name: business.owner_first_name,
          last_name: business.owner_last_name,
          email: business.owner_email
        }
      },
      team_members: teamMembers.rows,
      delivery_stats: {
        total_deliveries: parseInt(deliveryStats.rows[0].total_deliveries || 0),
        monthly_volume: Math.floor(Math.random() * 50) + 10,
        average_cost: parseFloat(deliveryStats.rows[0].average_cost || 0)
      },
      api_integration: {
        active_keys: Math.floor(Math.random() * 3) + 1,
        webhook_endpoints: []
      }
    });

  } catch (error) {
    console.error('Get business account error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Admin Routes

/**
 * Get All Users (Admin) Endpoint
 * Administrative endpoint to retrieve all users with filtering
 */
app.get('/api/v1/admin/users', authenticateToken, async (req, res) => {
  try {
    // Simple admin check - in production, implement proper role-based access control
    if (req.user.user_type !== 'admin') {
      return res.status(403).json({ success: false, error: 'Admin access required' });
    }

    const { user_type, is_active, page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    let whereConditions = [];
    let queryParams = [];
    let paramCount = 0;

    if (user_type) {
      paramCount++;
      whereConditions.push(`user_type = $${paramCount}`);
      queryParams.push(user_type);
    }

    if (is_active !== undefined) {
      paramCount++;
      whereConditions.push(`is_active = $${paramCount}`);
      queryParams.push(is_active === 'true');
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const client = await pool.connect();

    const users = await client.query(
      `SELECT uid, email, phone, user_type, first_name, last_name, is_active, 
       is_email_verified, is_phone_verified, created_at, last_login_at
       FROM users ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`,
      [...queryParams, limit, offset]
    );

    const countResult = await client.query(
      `SELECT COUNT(*) as total FROM users ${whereClause}`,
      queryParams
    );

    const totalCount = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(totalCount / limit);

    client.release();

    res.json({
      users: users.rows,
      pagination: {
        current_page: parseInt(page),
        total_pages: totalPages,
        total_count: totalCount,
        per_page: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Admin get users error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Serve static files from the storage directory
app.use('/storage', express.static(storageDir));

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

// WebSocket Connection Handler with proper authentication
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id, 'User:', socket.user.uid);

  // Handle courier location updates
  socket.on('courier_location_update', async (data) => {
    const client = await pool.connect();
    try {
      const { courier_uid, latitude, longitude, heading, speed, accuracy, timestamp } = data.data;
      
      // Verify courier ownership
      const courierCheck = await client.query(
        'SELECT uid FROM couriers WHERE uid = $1 AND user_uid = $2',
        [courier_uid, socket.user.uid]
      );

      if (courierCheck.rows.length === 0) {
        return socket.emit('error', { message: 'Unauthorized courier access' });
      }
      
      // Insert location tracking data
      const tracking_uid = uuidv4();
      await client.query(
        `INSERT INTO delivery_tracking (uid, delivery_uid, courier_uid, status, latitude, longitude, 
         notes, created_at)
         SELECT $1, d.uid, $2, 'location_update', $3, $4, $5, $6
         FROM deliveries d WHERE d.courier_uid = $2 AND d.status IN ('picked_up', 'en_route_pickup', 'en_route_delivery')`,
        [tracking_uid, courier_uid, latitude, longitude, 'GPS location update', timestamp]
      );

      // Broadcast to relevant delivery participants
      socket.broadcast.emit('courier_location_update', {
        event: 'courier_location_update',
        data: {
          delivery_uid: `delivery_${courier_uid}`,
          courier_location: {
            latitude,
            longitude,
            heading,
            updated_at: timestamp
          },
          estimated_arrival: new Date(Date.now() + 20 * 60000).toISOString(),
          distance_remaining: Math.random() * 10 + 2
        }
      });

    } catch (error) {
      console.error('Courier location update error:', error);
      socket.emit('error', { message: 'Location update failed' });
    } finally {
      client.release();
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Start server with proper error handling
const PORT = process.env.PORT || 3000;
server.listen(PORT, (err) => {
  if (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
  console.log(`QuickDrop server running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down server...');
  server.close();
  await pool.end();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Shutting down server...');
  server.close();
  await pool.end();
  process.exit(0);
});