const express = require("express");
const flw = require("../config/flutterwave");
const authMiddleware = require("../middleware/auth");
const Transaction = require("../models/Transaction");
const User = require("../models/User");
const crypto = require("crypto");

const router = express.Router();

const PLANS = {
  weekly: { amount: 9.99, name: "Weekly Plan", days: 7 },
  monthly: { amount: 29.99, name: "Monthly Plan", days: 30 },
  yearly: { amount: 99.99, name: "Yearly Plan", days: 365 },
};

// Create transaction reference
router.post("/create-transaction", authMiddleware, async (req, res) => {
  try {
    const { plan_id } = req.body;
    const plan = PLANS[plan_id];
    if (!plan) return res.status(400).json({ error: "Invalid plan" });

    const tx_ref = "tx_" + Date.now() + "_" + req.user.id;
    // Store pending transaction in database
    await Transaction.create({
      user_id: req.user.id,
      amount: plan.amount,
      currency: "USD",
      flutterwave_tx_ref: tx_ref,
      subscription_plan: plan_id,
      status: "pending",
    });

    res.json({
      transaction_ref: tx_ref,
      amount: plan.amount,
      currency: "USD",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to create transaction" });
  }
});

// Verify payment (called from frontend after checkout)
router.post("/verify", authMiddleware, async (req, res) => {
  const { transaction_id } = req.body;
  try {
    const response = await flw.Transaction.verify({ id: transaction_id });
    if (response.data.status === "successful") {
      const tx_ref = response.data.tx_ref;
      const transaction = await Transaction.findByTxRef(tx_ref);
      if (!transaction) throw new Error("Transaction not found");
      await Transaction.update(transaction.id, {
        status: "success",
        flutterwave_transaction_id: transaction_id,
      });
      // Extend subscription
      const plan = PLANS[transaction.subscription_plan];
      const user = await User.findById(transaction.user_id);
      let expiry = user.subscription_expiry
        ? new Date(user.subscription_expiry)
        : new Date();
      expiry.setDate(expiry.getDate() + plan.days);
      await User.update(transaction.user_id, {
        subscription_type: "vip",
        subscription_expiry: expiry.toISOString(),
      });
      res.json({ success: true });
    } else {
      res.status(400).json({ error: "Payment not successful" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Verification failed" });
  }
});

// Optional webhook (Flutterwave can send to /webhook)
router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const hash = crypto
      .createHmac("sha512", process.env.FLOW_SECRET_KEY)
      .update(JSON.stringify(req.body))
      .digest("hex");
    if (hash !== req.headers["verif-hash"]) return res.status(401).end();
    const event = req.body;
    if (
      event.event === "charge.completed" &&
      event.data.status === "successful"
    ) {
      // similar verification logic
    }
    res.sendStatus(200);
  },
);

module.exports = router;
