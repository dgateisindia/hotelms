const bcrypt = require('bcryptjs');

const hash = '$2a$10$XNOPn1wyHIeEVxv29H3SM.kotlQBBFFicSB.bY4ism8JfMrbkykIy';

bcrypt.compare('Admin@123', hash)
  .then(console.log);