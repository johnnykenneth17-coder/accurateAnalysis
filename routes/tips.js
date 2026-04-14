const express = require("express");
const Tip = require("../models/Tip");
const TrackedTip = require("../models/TrackedTip");
const authMiddleware = require("../middleware/auth");

const router = express.Router();

// Get all tips (with filters and VIP access check)
router.get("/", authMiddleware, async (req, res) => {
  try {
    const {
      sport,
      league,
      tip_type,
      status,
      search,
      page = 1,
      limit = 20,
    } = req.query;
    const filters = { sport, league, tip_type, status, search };

    // Check if user has VIP access
    const hasVipAccess =
      req.user.subscription_type !== "free" &&
      (!req.user.subscription_expiry ||
        new Date(req.user.subscription_expiry) > new Date());

    const result = await Tip.findAll(
      filters,
      parseInt(page),
      parseInt(limit),
      hasVipAccess,
    );

    // Mark which tips are tracked by this user
    const tipsWithTracking = [];
    for (const tip of result.tips) {
      const isTracked = await TrackedTip.isTracked(req.user.id, tip.id);
      tipsWithTracking.push({ ...tip, is_tracked: isTracked });
    }

    res.json({
      tips: tipsWithTracking,
      total: result.total,
      page: result.page,
      totalPages: result.totalPages,
      hasVipAccess,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
});

// Get single tip
router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const tip = await Tip.findById(req.params.id);
    if (!tip) {
      return res.status(404).json({ error: "Tip not found" });
    }

    // Check VIP access
    if (tip.is_vip) {
      const hasVipAccess =
        req.user.subscription_type !== "free" &&
        (!req.user.subscription_expiry ||
          new Date(req.user.subscription_expiry) > new Date());
      if (!hasVipAccess) {
        return res.status(403).json({ error: "VIP subscription required" });
      }
    }

    const isTracked = await TrackedTip.isTracked(req.user.id, tip.id);
    res.json({ ...tip, is_tracked: isTracked });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
});

// Track a tip
router.post("/:id/track", authMiddleware, async (req, res) => {
  try {
    const { stake } = req.body;
    const tip = await Tip.findById(req.params.id);
    if (!tip) {
      return res.status(404).json({ error: "Tip not found" });
    }

    // VIP check
    if (tip.is_vip) {
      const hasVipAccess =
        req.user.subscription_type !== "free" &&
        (!req.user.subscription_expiry ||
          new Date(req.user.subscription_expiry) > new Date());
      if (!hasVipAccess) {
        return res.status(403).json({ error: "VIP subscription required" });
      }
    }

    const alreadyTracked = await TrackedTip.isTracked(req.user.id, tip.id);
    if (alreadyTracked) {
      return res.status(400).json({ error: "Tip already tracked" });
    }

    await TrackedTip.create(req.user.id, tip.id, stake || 10);
    res.json({ message: "Tip tracked successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
});

// Untrack a tip
router.delete("/:id/track", authMiddleware, async (req, res) => {
  try {
    await TrackedTip.delete(req.user.id, req.params.id);
    res.json({ message: "Tip untracked successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
