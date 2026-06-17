CREATE DATABASE hotelms;

USE hotelms;

CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role ENUM('admin','staff') DEFAULT 'staff',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO users (
    name,
    email,
    password,
    role
)
VALUES (
    'Admin',
    'nikhilrkaushik2004@gmail.com',
    '$2a$10$tYz6EwV4sd45MKjXc3lf4.rxnx5bHBWOR4locQKLSw0fe6gyRmOTC',
    'admin'
);

select * from users;
SELECT id, name, email, role
FROM users
WHERE email='nikhilrkaushik2004@gmail.com';

SELECT password
FROM users
WHERE email='nikhilrkaushik2004@gmail.com';

DELETE FROM users
WHERE email='nikhilrkaushik2004@gmail.com';

SELECT * FROM users;

UPDATE users
SET password='$2a$10$XNOPn1wyHIeEVxv29H3SM.kotlQBBFFicSB.bY4ism8JfMrbkykIy'
WHERE email='nikhilrkaushik2004@gmail.com';

