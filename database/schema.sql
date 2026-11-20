-- =============================================================================
-- Event Planning and Management System (SYP)
-- Database Schema: Authentication, Authorization (RBAC), and Session Management
-- Dialect: ANSI SQL / PostgreSQL / MySQL / SQLite Compatible
-- =============================================================================

-- 1. ROLES TABLE
-- Defines the hierarchical roles within the Event Management System:
-- - CUSTOMER: Can register freely, browse packages, and book events.
-- - ORGANIZER: Staff/Coordinators managing event logistics (catering, decor, etc.)
-- - ADMIN: Superuser managing system configuration, users, and reports.
CREATE TABLE IF NOT EXISTS roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(50) NOT NULL UNIQUE,       -- 'CUSTOMER', 'ORGANIZER', 'ADMIN'
    description VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. USERS TABLE
-- Stores user accounts, hashed credentials, and role associations.
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    role_id INTEGER NOT NULL,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    phone VARCHAR(25),
    password_hash VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT 1,            -- Admin can deactivate bad actors
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE RESTRICT
);

-- Index for high-performance lookup on email during authentication
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role_id ON users(role_id);

-- 3. USER SESSIONS / TOKEN BLACKLIST TABLE
-- Tracks active or revoked JWTs / sessions to guarantee real logout invalidation.
CREATE TABLE IF NOT EXISTS user_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token_hash VARCHAR(64) NOT NULL UNIQUE, -- SHA-256 hash of the issued JWT / refresh token
    expires_at TIMESTAMP NOT NULL,
    revoked_at TIMESTAMP NULL,              -- Set when user logs out
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON user_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON user_sessions(user_id);

-- 4. PASSWORD RESET TOKENS TABLE
-- Secure token store for the forgot/reset password flow.
-- We store a SHA-256 hash of the raw token so DB leaks do not compromise reset links.
CREATE TABLE IF NOT EXISTS password_resets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    used_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_password_resets_token ON password_resets(token_hash);
