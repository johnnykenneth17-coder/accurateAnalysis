const { supabase, supabaseAdmin } = require("../config/supabase");

class Transaction {
  // Create a transaction record (admin client)
  static async create(transactionData) {
    const { data, error } = await supabaseAdmin
      .from("transactions")
      .insert(transactionData)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Update transaction by Stripe payment intent ID (admin client)
  static async updateByPaymentIntent(paymentIntentId, updates) {
    const { data, error } = await supabaseAdmin
      .from("transactions")
      .update(updates)
      .eq("stripe_payment_intent", paymentIntentId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Get recent successful transactions for a user (public read with RLS)
  static async findByUser(userId, limit = 10) {
    const { data, error } = await supabase
      .from("transactions")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "success")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data;
  }

  // Get total revenue from successful transactions (admin only)
  static async getTotalRevenue() {
    const { data, error } = await supabaseAdmin
      .from("transactions")
      .select("amount")
      .eq("status", "success");

    if (error) throw error;
    const total = data.reduce((sum, t) => sum + parseFloat(t.amount), 0);
    return total;
  }
}

module.exports = Transaction;
