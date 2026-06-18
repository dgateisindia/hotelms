CREATE DATABASE hotelms;

USE hotelms;

CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100),
  email VARCHAR(100) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role ENUM('admin','manager','employee') DEFAULT 'employee',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);