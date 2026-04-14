const express = require("express");
const adminMiddleware = require("../middleware/admin");
const authMiddleware = require("../middleware/auth");
const Tip = require("../models/Tip");
const User = require("../models/User");
const Transaction = require("../models/Transaction");
const { supabaseAdmin } = require("../config/supabase");

const router = express.Router();

// All admin routes require auth + admin role
router.use(authMiddleware, adminMiddleware);

// Dashboard stats
router.get("/stats", async (req, res) => {
  try {
    const userCounts = await User.getCounts();
    const tipStats = await Tip.getStats();
    const revenue = await Transaction.getTotalRevenue();

    res.json({
      totalUsers: userCounts.total,
      activeSubscriptions: userCounts.activeSubscriptions,
      totalTips: tipStats.total,
      pendingTips: tipStats.pending,
      winRate: tipStats.winRate.toFixed(1),
      revenue,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
});

// Get all tips (admin view)
router.get("/tips", async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, error, count } = await supabaseAdmin
      .from("tips")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) throw error;

    res.json({
      tips: data,
      total: count,
      page: parseInt(page),
      totalPages: Math.ceil(count / limit),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
});

// Create a new tip
router.post("/tips", async (req, res) => {
  try {
    const tipData = {
      ...req.body,
      created_by: req.user.id,
    };
    const tip = await Tip.create(tipData);

    // Emit real-time update via socket
    const emitTipUpdate = req.app.get("emitTipUpdate");
    if (emitTipUpdate) emitTipUpdate(tip.id);

    res.status(201).json(tip);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
});

// Update a tip
router.put("/tips/:id", async (req, res) => {
  try {
    const tip = await Tip.update(req.params.id, req.body);

    // Emit real-time update
    const emitTipUpdate = req.app.get("emitTipUpdate");
    if (emitTipUpdate) emitTipUpdate(tip.id);

    res.json(tip);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
});

// Delete a tip
router.delete("/tips/:id", async (req, res) => {
  try {
    await Tip.delete(req.params.id);

    // Optionally emit deletion event
    const emitTipUpdate = req.app.get("emitTipUpdate");
    if (emitTipUpdate) emitTipUpdate(req.params.id); // or a custom 'tip-deleted' event

    res.json({ message: "Tip deleted" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
});

// Get all users (admin)
router.get("/users", async (req, res) => {
  try {
    const users = await User.getAll();
    res.json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
});

// Update user subscription
router.put("/users/:id/subscription", async (req, res) => {
  try {
    const { subscription_type, subscription_expiry } = req.body;
    const updated = await User.update(req.params.id, {
      subscription_type,
      subscription_expiry,
    });
    res.json({ message: "Subscription updated", user: updated });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
