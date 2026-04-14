const express = require("express");
const stripe = require("../config/stripe");
const authMiddleware = require("../middleware/auth");
const Transaction = require("../models/Transaction");
const User = require("../models/User");

const router = express.Router();

const PLANS = {
  weekly: { price: 999, name: "Weekly Plan", days: 7 },
  monthly: { price: 2999, name: "Monthly Plan", days: 30 },
  yearly: { price: 9999, name: "Yearly Plan", days: 365 },
};

// Create Stripe checkout session
router.post("/create-checkout-session", authMiddleware, async (req, res) => {
  try {
    const { plan_id } = req.body;
    const plan = PLANS[plan_id];
    if (!plan) {
      return res.status(400).json({ error: "Invalid plan" });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: plan.name,
              description: `${plan.days} days of VIP access`,
            },
            unit_amount: plan.price,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${process.env.FRONTEND_URL}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/pricing`,
      metadata: {
        user_id: req.user.id,
        plan_id: plan_id,
        days: plan.days,
      },
    });

    // Create pending transaction
    await Transaction.create({
      user_id: req.user.id,
      amount: plan.price / 100,
      currency: "usd",
      stripe_payment_intent: session.id,
      subscription_plan: plan_id,
      status: "pending",
    });

    res.json({ sessionId: session.id, url: session.url });
  } catch (error) {
    console.error("Stripe session error:", error);
    res.status(500).json({ error: "Failed to create checkout session" });
  }
});

// Stripe webhook (raw body required)
const handleWebhook = async (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const { user_id, plan_id, days } = session.metadata;

    // Update transaction status
    await Transaction.updateByPaymentIntent(session.id, { status: "success" });

    // Update user subscription
    const user = await User.findById(user_id);
    if (user) {
      const newExpiry = new Date();
      newExpiry.setDate(newExpiry.getDate() + parseInt(days));
      await User.update(user_id, {
        subscription_type: "vip",
        subscription_expiry: newExpiry.toISOString(),
      });
    }
  }

  res.json({ received: true });
};

// Webhook endpoint – must use raw body parser
router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  handleWebhook,
);

module.exports = router;
