CREATE DATABASE hotelms;

USE hotelms;

CREATE TABLE users (
    user_id INT PRIMARY KEY AUTO_INCREMENT,
    full_name VARCHAR(150),
    email VARCHAR(150) UNIQUE,
    phone VARCHAR(20),
    password VARCHAR(255),
    role ENUM(
        'super_admin',
        'admin',
        'receptionist',
        'housekeeping',
        'accountant',
        'customer'
    ),
    profile_image VARCHAR(255),
    status ENUM('active','inactive') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- ======================================
-- HOTEL REGISTRATION PAGE
-- ======================================

CREATE TABLE hotels (
    hotel_id INT AUTO_INCREMENT PRIMARY KEY,
    hotel_name VARCHAR(255) NOT NULL,
    hotel_type VARCHAR(100),
    hotel_desc TEXT,
    star_rating INT,
    year_established YEAR,
    gst_number VARCHAR(20),
    pan_number VARCHAR(20),
    business_reg_number VARCHAR(100),
    hotel_logo VARCHAR(255),
    status ENUM('pending','active','rejected') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- ======================================
-- ROOMS PAGE
-- ======================================

CREATE TABLE rooms (
    room_id INT PRIMARY KEY AUTO_INCREMENT,
    room_number VARCHAR(20) UNIQUE,
    room_type VARCHAR(100),
    floor_number INT,
    price_per_night DECIMAL(10,2),
    capacity INT,
    status ENUM(
        'available',
        'occupied',
        'maintenance',
        'cleaning'
    ) DEFAULT 'available',
    qr_code_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- ======================================
-- CUSTOMER PAGE
-- ======================================

CREATE TABLE customers (
    customer_id INT PRIMARY KEY AUTO_INCREMENT,
    full_name VARCHAR(150),
    email VARCHAR(150),
    phone VARCHAR(20),
    gender VARCHAR(20),
    address TEXT,
    id_proof_type VARCHAR(100),
    id_proof_number VARCHAR(100),
    profile_image VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- ======================================
-- BOOKINGS PAGE  
-- ======================================

CREATE TABLE bookings (
    booking_id INT PRIMARY KEY AUTO_INCREMENT,
    customer_id INT,
    room_id INT,
    booking_code VARCHAR(50),
    check_in DATETIME,
    check_out DATETIME,
    total_guests INT,
    booking_status ENUM(
        'pending',
        'confirmed',
        'checked_in',
        'checked_out',
        'cancelled'
    ) DEFAULT 'pending',
    payment_status ENUM(
        'paid',
        'partial',
        'unpaid'
    ) DEFAULT 'unpaid',
    total_amount DECIMAL(10,2),
    special_request TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (customer_id) REFERENCES customers(customer_id),
    FOREIGN KEY (room_id) REFERENCES rooms(room_id)
);
-- ======================================
-- PAYMENT PAGE
-- ======================================

CREATE TABLE payments (
    payment_id INT PRIMARY KEY AUTO_INCREMENT,
    booking_id INT,
    amount DECIMAL(10,2),
    payment_method ENUM(
        'cash',
        'card',
        'upi',
        'bank_transfer'
    ),
    transaction_id VARCHAR(255),
    payment_status ENUM(
        'success',
        'pending',
        'failed'
    ),
    payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (booking_id)
    REFERENCES bookings(booking_id)
);
-- ======================================
-- FOOD ORDER PAGE
-- ======================================

CREATE TABLE food_orders (
    order_id INT PRIMARY KEY AUTO_INCREMENT,
    booking_id INT,
    room_id INT,
    ordered_by VARCHAR(150),
    total_amount DECIMAL(10,2),
    order_status ENUM(
        'pending',
        'preparing',
        'delivered',
        'cancelled'
    ) DEFAULT 'pending',
    remarks TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (booking_id)
    REFERENCES bookings(booking_id),

    FOREIGN KEY (room_id)
    REFERENCES rooms(room_id)
);
-- ======================================
-- FOOD ITEMS PAGE
-- ======================================

CREATE TABLE food_order_items (
    item_id INT PRIMARY KEY AUTO_INCREMENT,
    order_id INT,
    item_name VARCHAR(150),
    quantity INT,
    price DECIMAL(10,2),
    total_price DECIMAL(10,2),

    FOREIGN KEY (order_id)
    REFERENCES food_orders(order_id)
);
-- ======================================
-- SERVICE PAGE
-- ======================================

CREATE TABLE service_requests (
    request_id INT PRIMARY KEY AUTO_INCREMENT,
    booking_id INT,
    room_id INT,
    service_type ENUM(
        'laundry',
        'cleaning',
        'taxi',
        'extra_bed',
        'water',
        'wake_up_call',
        'other'
    ),
    description TEXT,
    request_status ENUM(
        'pending',
        'in_progress',
        'completed',
        'cancelled'
    ) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (booking_id)
    REFERENCES bookings(booking_id),

    FOREIGN KEY (room_id)
    REFERENCES rooms(room_id)
);
-- ======================================
-- STAFF PAGE
-- ======================================


CREATE TABLE staff (
    staff_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT,
    department VARCHAR(100),
    designation VARCHAR(100),
    salary DECIMAL(10,2),
    joining_date DATE,
    emergency_contact VARCHAR(20),

    FOREIGN KEY (user_id)
    REFERENCES users(user_id)
);
-- ======================================
-- ATTENDANCE PAGE
-- ======================================

CREATE TABLE attendance (
    attendance_id INT PRIMARY KEY AUTO_INCREMENT,
    staff_id INT,
    attendance_date DATE,
    check_in_time TIME,
    check_out_time TIME,
    status ENUM(
        'present',
        'absent',
        'half_day',
        'leave'
    ),

    FOREIGN KEY (staff_id)
    REFERENCES staff(staff_id)
);
-- ======================================
-- PAYROLL PAGE
-- ======================================

CREATE TABLE payroll (
    payroll_id INT PRIMARY KEY AUTO_INCREMENT,
    staff_id INT,
    month_year VARCHAR(20),
    basic_salary DECIMAL(10,2),
    bonus DECIMAL(10,2),
    deductions DECIMAL(10,2),
    net_salary DECIMAL(10,2),
    payment_status ENUM(
        'paid',
        'pending'
    ) DEFAULT 'pending',
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (staff_id)
    REFERENCES staff(staff_id)
);
-- ======================================
-- INVOICE PAGE
-- ======================================

CREATE TABLE invoices (
    invoice_id INT PRIMARY KEY AUTO_INCREMENT,
    booking_id INT,
    invoice_number VARCHAR(100),
    room_charges DECIMAL(10,2),
    food_charges DECIMAL(10,2),
    laundry_charges DECIMAL(10,2),
    extra_service_charges DECIMAL(10,2),
    tax_amount DECIMAL(10,2),
    total_amount DECIMAL(10,2),
    paid_amount DECIMAL(10,2),
    pending_amount DECIMAL(10,2),
    invoice_status ENUM(
        'paid',
        'partial',
        'unpaid'
    ) DEFAULT 'unpaid',
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (booking_id)
    REFERENCES bookings(booking_id)
);
-- ======================================
--  NOTIFICATION PAGE
-- ======================================

CREATE TABLE notifications (
    notification_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT,
    title VARCHAR(255),
    message TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id)
    REFERENCES users(user_id)
);
-- ======================================
-- QR CODE PAGE
-- ======================================

CREATE TABLE qr_codes (
    qr_id INT PRIMARY KEY AUTO_INCREMENT,
    room_id INT,
    qr_image VARCHAR(255),
    qr_url TEXT,
    status ENUM(
        'active',
        'inactive'
    ) DEFAULT 'active',

    FOREIGN KEY (room_id)
    REFERENCES rooms(room_id)
);

CREATE TABLE customer_feedback (
    feedback_id INT PRIMARY KEY AUTO_INCREMENT,
    booking_id INT,
    customer_id INT,
    rating INT,
    remarks TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (booking_id)
    REFERENCES bookings(booking_id),

    FOREIGN KEY (customer_id)
    REFERENCES customers(customer_id)
);

CREATE TABLE aws_documents (
    document_id INT PRIMARY KEY AUTO_INCREMENT,
    uploaded_by INT,
    file_name VARCHAR(255),
    file_url TEXT,
    file_type VARCHAR(100),
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (uploaded_by)
    REFERENCES users(user_id)
);

CREATE TABLE audit_logs (
    log_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT,
    module_name VARCHAR(100),
    action_type VARCHAR(100),
    description TEXT,
    ip_address VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id)
    REFERENCES users(user_id)
);

CREATE TABLE backup_logs (
    backup_id INT PRIMARY KEY AUTO_INCREMENT,
    backup_name VARCHAR(255),
    backup_type VARCHAR(100),
    file_size VARCHAR(100),
    backup_status ENUM(
        'success',
        'failed'
    ),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE taxi_bookings (
    taxi_booking_id INT PRIMARY KEY AUTO_INCREMENT,
    booking_id INT,
    pickup_location VARCHAR(255),
    destination VARCHAR(255),
    booking_time DATETIME,
    status ENUM(
        'pending',
        'confirmed',
        'completed',
        'cancelled'
    ) DEFAULT 'pending',

    FOREIGN KEY (booking_id)
    REFERENCES bookings(booking_id)
);

CREATE TABLE role_permissions (
    permission_id INT PRIMARY KEY AUTO_INCREMENT,
    role_name VARCHAR(100),
    module_name VARCHAR(100),
    can_create BOOLEAN DEFAULT FALSE,
    can_read BOOLEAN DEFAULT TRUE,
    can_update BOOLEAN DEFAULT FALSE,
    can_delete BOOLEAN DEFAULT FALSE
);

UPDATE users
SET password = 'Admin@123'
WHERE email = 'admin@gmail.com';

show databases;

select * from users;

-- ====================
-- VALUES
-- ====================
INSERT INTO users (
  hotel_id,
  full_name,
  email,
  phone,
  password,
  role,
  status
)VALUES (?,?,?,?,?,
  'admin',
  'active'
);
