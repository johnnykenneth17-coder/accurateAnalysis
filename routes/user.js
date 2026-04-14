const express = require("express");
const authMiddleware = require("../middleware/auth");
const TrackedTip = require("../models/TrackedTip");
const Transaction = require("../models/Transaction");
const User = require("../models/User");

const router = express.Router();

// Dashboard stats
router.get("/dashboard", authMiddleware, async (req, res) => {
  try {
    const stats = await TrackedTip.getUserStats(req.user.id);
    const recentTransactions = await Transaction.findByUser(req.user.id, 10);
    const trackedCount = (await TrackedTip.findByUser(req.user.id)).length;

    const hasActiveSubscription =
      req.user.subscription_type !== "free" &&
      (!req.user.subscription_expiry ||
        new Date(req.user.subscription_expiry) > new Date());

    res.json({
      stats: {
        totalProfit: stats.totalProfit.toFixed(2),
        winRate: stats.winRate.toFixed(1),
        totalBets: stats.totalBets,
        activeSubscription: hasActiveSubscription,
        subscriptionType: req.user.subscription_type,
        subscriptionExpiry: req.user.subscription_expiry,
        credits: req.user.credits,
      },
      recentTransactions,
      trackedTipsCount: trackedCount,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
});

// Get all tracked tips with details
router.get("/tracked-tips", authMiddleware, async (req, res) => {
  try {
    const trackedTips = await TrackedTip.findByUser(req.user.id);
    res.json(trackedTips);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
});

// Update user profile
router.put("/profile", authMiddleware, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ error: "Name is required" });
    }

    const updatedUser = await User.update(req.user.id, { name });
    res.json({
      message: "Profile updated",
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        role: updatedUser.role,
        subscription_type: updatedUser.subscription_type,
        subscription_expiry: updatedUser.subscription_expiry,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
