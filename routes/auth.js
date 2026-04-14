const express = require("express");
const jwt = require("jsonwebtoken");
const { body, validationResult } = require("express-validator");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const authMiddleware = require("../middleware/auth");

const router = express.Router();

// Register
router.post(
  "/register",
  [
    body("email").isEmail().normalizeEmail(),
    body("password").isLength({ min: 6 }),
    body("name").notEmpty().trim(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password, name, referral_code } = req.body;

      // Check if user already exists
      const existingUser = await User.findByEmail(email);
      if (existingUser) {
        return res.status(400).json({ error: "Email already registered" });
      }

      // Find referrer if referral code provided
      let referredBy = null;
      if (referral_code) {
        const referrer = await User.findByReferralCode(referral_code);
        if (referrer) referredBy = referrer.id;
      }

      // Create user
      const user = await User.create({
        email,
        password,
        name,
        referred_by: referredBy,
      });

      // Generate JWT
      const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
        expiresIn: "30d",
      });

      res.status(201).json({
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          subscription_type: user.subscription_type,
          subscription_expiry: user.subscription_expiry,
          credits: user.credits,
        },
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Server error" });
    }
  },
);

// Login
router.post(
  "/login",
  [body("email").isEmail(), body("password").notEmpty()],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password } = req.body;
      const user = await User.findByEmail(email);

      if (!user) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
        expiresIn: "30d",
      });

      res.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          subscription_type: user.subscription_type,
          subscription_expiry: user.subscription_expiry,
          credits: user.credits,
        },
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Server error" });
    }
  },
);

// Get current user
router.get("/me", authMiddleware, async (req, res) => {
  res.json({
    id: req.user.id,
    email: req.user.email,
    name: req.user.name,
    role: req.user.role,
    subscription_type: req.user.subscription_type,
    subscription_expiry: req.user.subscription_expiry,
    credits: req.user.credits,
    referral_code: req.user.referral_code,
  });
});

module.exports = router;
