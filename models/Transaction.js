const { supabase, supabaseAdmin } = require("../config/supabase");

class Transaction {
  // Create a transaction record (admin client)
  static async create(transactionData) {
    const { data, error } = await supabaseAdmin
      .from("transactions")
      .insert({
        user_id: transactionData.user_id,
        amount: transactionData.amount,
        currency: transactionData.currency || "USD",
        flutterwave_tx_ref: transactionData.flutterwave_tx_ref, // changed from stripe_payment_intent
        subscription_plan: transactionData.subscription_plan,
        status: transactionData.status || "pending",
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Update transaction by ID (admin client)
  static async update(id, updates) {
    const { data, error } = await supabaseAdmin
      .from("transactions")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Find transaction by Flutterwave tx_ref (admin client)
  static async findByTxRef(tx_ref) {
    const { data, error } = await supabaseAdmin
      .from("transactions")
      .select("*")
      .eq("flutterwave_tx_ref", tx_ref)
      .maybeSingle();

    if (error && error.code !== "PGRST116") throw error;
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
