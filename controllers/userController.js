
import asyncHandler from 'express-async-handler';
import bcrypt from 'bcryptjs';
import generateToken from '../utils/generateToken.js';
import User from '../models/userModel.js';
import sendEmail from '../utils/sendEmail.js';

// @desc    Auth user & get token
// @route   POST /api/users/login
// @access  Public
const authUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });

  if (user && (await user.matchPassword(password))) {
    if (!user.isVerified && !user.isAdmin) {
      res.status(401);
      throw new Error('Please verify your email address first.');
    }
    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      isAdmin: user.isAdmin,
      token: generateToken(user._id),
    });
  } else {
    res.status(401);
    throw new Error('Invalid email or password');
  }
});

// @desc    Register a new user
// @route   POST /api/users
// @access  Public
const registerUser = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;
  const userExists = await User.findOne({ email });

  if (userExists) {
    res.status(400);
    throw new Error('User already exists');
  }

  // Check if this is the FIRST user in the database
  const isFirstAccount = (await User.countDocuments({})) === 0;

  // Generate 6-digit PIN
  const verificationPin = Math.floor(100000 + Math.random() * 900000).toString();
  const hashedPin = await bcrypt.hash(verificationPin, 10);

  const user = await User.create({
    name,
    email,
    password,
    isAdmin: isFirstAccount, // First user becomes admin automatically
    verificationToken: hashedPin,
    verificationTokenExpire: Date.now() + 10 * 60 * 1000, // 10 minutes
    isVerified: false
  });

  if (user) {
    const message = `
      <div style="font-family: 'Georgia', serif; color: #333; padding: 40px; max-w: 600px; margin: 0 auto; background-color: #fff9f9; border: 1px solid #fce4ec;">
        <h2 style="color: #d63384; border-bottom: 2px solid #fce4ec; padding-bottom: 10px;">Verify Your Email</h2>
        <p style="font-size: 16px; line-height: 1.6;">Hello <strong>${user.name}</strong>,</p>
        <p style="font-size: 16px; line-height: 1.6;">Thank you for joining Jaanmak. Please use the PIN below to verify your email address:</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <span style="background-color: #111; color: white; padding: 15px 30px; font-size: 24px; letter-spacing: 5px; border-radius: 10px; font-weight: bold; display: inline-block; font-family: sans-serif;">${verificationPin}</span>
        </div>

        <p style="font-size: 14px; color: #666;">This PIN is valid for 10 minutes.</p>
        <hr style="border: none; border-top: 1px solid #fce4ec; margin: 20px 0;" />
        <p style="font-size: 12px; color: #d63384; text-align: center;">JAANMAK LTD - The Certainty of Uncompromising Quality</p>
      </div>
    `;

    try {
      await sendEmail({
        to: user.email,
        subject: 'Verify Your Email - Jaanmak',
        html: message
      });

      res.status(201).json({
        message: 'Verification email sent',
        email: user.email
      });
    } catch (error) {
      console.error(error);
      await User.findByIdAndDelete(user._id); // Rollback user creation if email fails
      res.status(500);
      throw new Error('Email could not be sent. Please try again.');
    }
  } else {
    res.status(400);
    throw new Error('Invalid user data');
  }
});

// @desc    Get user profile
// @route   GET /api/users/profile
// @access  Private
const getUserProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  if (user) {
    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      isAdmin: user.isAdmin,
      address: user.address,
      city: user.city,
      state: user.state,
      phone: user.phone
    });
  } else {
    res.status(404);
    throw new Error('User not found');
  }
});

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
const updateUserProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);

  if (user) {
    user.name = req.body.name || user.name;
    user.email = req.body.email || user.email;
    user.address = req.body.address || user.address;
    user.city = req.body.city || user.city;
    user.state = req.body.state || user.state;
    user.phone = req.body.phone || user.phone;

    if (req.body.password) {
      user.password = req.body.password;
    }

    const updatedUser = await user.save();

    res.json({
      _id: updatedUser._id,
      name: updatedUser.name,
      email: updatedUser.email,
      isAdmin: updatedUser.isAdmin,
      token: generateToken(updatedUser._id),
      address: updatedUser.address,
      city: updatedUser.city,
      state: updatedUser.state,
      phone: updatedUser.phone
    });
  } else {
    res.status(404);
    throw new Error('User not found');
  }
});

// @desc    Send Forgot Password Email
// @route   POST /api/users/forgot-password
// @access  Public
const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email });

  if (!user) {
    return res.status(200).json({ message: 'If account exists, email sent.' });
  }

  // Generate 6-digit PIN
  const resetToken = Math.floor(100000 + Math.random() * 900000).toString();

  // Hash token and save to database
  user.resetPasswordToken = await bcrypt.hash(resetToken, 10);
  user.resetPasswordExpire = Date.now() + 10 * 60 * 1000; // 10 minutes

  await user.save();

  const message = `
    <div style="font-family: 'Georgia', serif; color: #333; padding: 40px; max-w: 600px; margin: 0 auto; background-color: #fff9f9; border: 1px solid #fce4ec;">
      <h2 style="color: #d63384; border-bottom: 2px solid #fce4ec; padding-bottom: 10px;">Password Reset Request</h2>
      <p style="font-size: 16px; line-height: 1.6;">Hello <strong>${user.name}</strong>,</p>
      <p style="font-size: 16px; line-height: 1.6;">You requested to reset your password. Use the PIN below to proceed:</p>
      
      <div style="text-align: center; margin: 30px 0;">
        <span style="background-color: #111; color: white; padding: 15px 30px; font-size: 24px; letter-spacing: 5px; border-radius: 10px; font-weight: bold; display: inline-block; font-family: sans-serif;">${resetToken}</span>
      </div>

      <p style="font-size: 14px; color: #666;">This PIN is valid for 10 minutes.</p>
      
      <p style="font-size: 14px; color: #999; margin-top: 30px;">If you did not request this, please ignore this email.</p>
      <hr style="border: none; border-top: 1px solid #fce4ec; margin: 20px 0;" />
      <p style="font-size: 12px; color: #d63384; text-align: center;">JAANMAK LTD - The Certainty of Uncompromising Quality</p>
    </div>
  `;

  try {
    await sendEmail({
      to: user.email,
      subject: 'Your Password Reset PIN',
      html: message
    });
    res.status(200).json({ message: 'Email sent' });
  } catch (error) {
    console.error(error);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();
    res.status(500);
    throw new Error('Email could not be sent');
  }
});

// @desc    Reset Password
// @route   PUT /api/users/reset-password
// @access  Public
const resetPassword = asyncHandler(async (req, res) => {
  const { email, pin, password } = req.body;

  const user = await User.findOne({
    email,
    resetPasswordExpire: { $gt: Date.now() }
  });

  if (!user) {
    res.status(400);
    throw new Error('Invalid or expired token');
  }

  const isMatch = await bcrypt.compare(pin, user.resetPasswordToken);

  if (!isMatch) {
    res.status(400);
    throw new Error('Invalid PIN');
  }

  user.password = password;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpire = undefined;

  await user.save();
  res.json({ message: 'Password updated successfully' });
});

// @desc    Get all users
// @route   GET /api/users
// @access  Private/Admin
const getUsers = asyncHandler(async (req, res) => {
  const users = await User.find({});
  res.json(users);
});

// @desc    Delete user
// @route   DELETE /api/users/:id
// @access  Private/Admin
const deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (user) {
    await user.deleteOne();
    res.json({ message: 'User removed' });
  } else {
    res.status(404);
    throw new Error('User not found');
  }
});

// @desc    Verify Email
// @route   POST /api/users/verify-email
// @access  Public
const verifyEmail = asyncHandler(async (req, res) => {
  const { email, pin } = req.body;

  const user = await User.findOne({
    email,
    verificationTokenExpire: { $gt: Date.now() }
  });

  if (!user) {
    res.status(400);
    throw new Error('Invalid or expired PIN');
  }

  const isMatch = await bcrypt.compare(pin, user.verificationToken);

  if (!isMatch) {
    res.status(400);
    throw new Error('Invalid PIN');
  }

  user.isVerified = true;
  user.verificationToken = undefined;
  user.verificationTokenExpire = undefined;

  await user.save();

  res.json({
    _id: user._id,
    name: user.name,
    email: user.email,
    isAdmin: user.isAdmin,
    token: generateToken(user._id),
  });
});

export { authUser, registerUser, getUserProfile, updateUserProfile, forgotPassword, resetPassword, getUsers, deleteUser, verifyEmail };
