const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const NocoDBService = require('../services/nocodb.service');

// --- Helper Functions ---
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '1d',
  });
};

// --- Controller Functions ---

/**
 * @desc    Register a new user
 * @route   POST /api/auth/signup
 * @access  Public
 */
const signup = async (req, res, next) => {
  const { name, email, password } = req.body;

  try {
    // Basic Validation
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Please provide name, email, and password' });
    }
    if (password.length < 8) {
        return res.status(400).json({ message: 'Password must be at least 8 characters' });
    }

    // Check if user already exists
    const existingUser = await NocoDBService.findUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists with this email' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user in NocoDB
    const newUser = await NocoDBService.createUser(name, email, hashedPassword);
    if (!newUser) {
        // createUser should throw an error if NocoDB fails, but double-check
        throw new Error('Failed to create user record in NocoDB');
    }

    // Generate JWT
    const token = generateToken(newUser.Id); // Use the ID returned by NocoDB

    // Exclude password from the response user object
    const { [process.env.NOCODB_PASSWORD_COLUMN]: _, ...userWithoutPassword } = newUser;

    res.status(201).json({
      token,
      user: userWithoutPassword, // Send back user info (without password)
    });

  } catch (error) {
    console.error('Signup Error:', error);
    // Pass error to the error handling middleware
    next(error); 
  }
};

/**
 * @desc    Authenticate user and get token
 * @route   POST /api/auth/login
 * @access  Public
 */
const login = async (req, res, next) => {
  const { email, password } = req.body;

  try {
    // Basic Validation
    if (!email || !password) {
      return res.status(400).json({ message: 'Please provide email and password' });
    }

    // Find user by email
    const user = await NocoDBService.findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' }); // User not found
    }

    // Compare password
    const passwordColumn = process.env.NOCODB_PASSWORD_COLUMN || 'password';
    const isMatch = await bcrypt.compare(password, user[passwordColumn]);

    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' }); // Wrong password
    }

    // Generate JWT
    const token = generateToken(user.Id); // Use the ID from the found user

    // Exclude password from the response user object
    const { [passwordColumn]: _, ...userWithoutPassword } = user;

    res.status(200).json({
      token,
      user: userWithoutPassword, // Send back user info (without password)
    });

  } catch (error) {
    console.error('Login Error:', error);
    // Pass error to the error handling middleware
    next(error); 
  }
};

module.exports = {
  signup,
  login,
}; 