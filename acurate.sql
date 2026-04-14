-- ======================================================
-- ACCURATE ANALYSIS - SUPABASE SCHEMA (NO RLS)
-- Run this entire script in your Supabase SQL editor
-- ======================================================

-- 1. USERS TABLE
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    subscription_type TEXT DEFAULT 'free' CHECK (subscription_type IN ('free', 'premium', 'vip')),
    subscription_expiry TIMESTAMPTZ,
    credits INT DEFAULT 0,
    referral_code TEXT UNIQUE,
    referred_by INT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. TIPS TABLE
CREATE TABLE tips (
    id SERIAL PRIMARY KEY,
    sport TEXT NOT NULL,
    league TEXT NOT NULL,
    home_team TEXT NOT NULL,
    away_team TEXT NOT NULL,
    match_datetime TIMESTAMPTZ NOT NULL,
    tip_type TEXT NOT NULL,
    prediction TEXT NOT NULL,
    odds DECIMAL(5,2) NOT NULL,
    confidence INT CHECK (confidence BETWEEN 1 AND 10),
    stake_suggestion TEXT,
    reasoning TEXT,
    is_vip BOOLEAN DEFAULT FALSE,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'won', 'lost', 'void')),
    result_updated_at TIMESTAMPTZ,
    created_by INT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. TRANSACTIONS TABLE
CREATE TABLE transactions (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    currency TEXT DEFAULT 'USD',
    stripe_payment_intent TEXT,
    subscription_plan TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed', 'refunded')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. TRACKED TIPS (user follows tips)
CREATE TABLE tracked_tips (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tip_id INT NOT NULL REFERENCES tips(id) ON DELETE CASCADE,
    stake DECIMAL(10,2),
    profit_loss DECIMAL(10,2),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, tip_id)
);

-- ======================================================
-- INDEXES FOR PERFORMANCE
-- ======================================================
CREATE INDEX idx_tips_match_datetime ON tips(match_datetime);
CREATE INDEX idx_tips_status ON tips(status);
CREATE INDEX idx_tips_is_vip ON tips(is_vip);
CREATE INDEX idx_tips_sport ON tips(sport);
CREATE INDEX idx_tips_league ON tips(league);
CREATE INDEX idx_tracked_tips_user ON tracked_tips(user_id);
CREATE INDEX idx_tracked_tips_tip ON tracked_tips(tip_id);
CREATE INDEX idx_transactions_user ON transactions(user_id);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_referral_code ON users(referral_code);

-- ======================================================
-- AUTOMATIC updated_at TRIGGER (for users and tips)
-- ======================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tips_updated_at 
    BEFORE UPDATE ON tips 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- ======================================================
-- OPTIONAL: INSERT DEFAULT ADMIN USER
-- Password hash is for "admin123" (bcrypt).
-- Replace with your own hash or create via backend.
-- ======================================================
-- INSERT INTO users (email, password, name, role) 
-- VALUES ('admin@example.com', '$2a$10$N9qo8uLOickgx2ZMRZoMy.Mr/.cZqHXhxM3jZQvGqJZzQfqZzLQm', 'Admin User', 'admin');