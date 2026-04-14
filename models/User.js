const { supabase, supabaseAdmin } = require("../config/supabase");
const bcrypt = require("bcryptjs");

class User {
  // Find user by email (public read – respects RLS)
  static async findByEmail(email) {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("email", email)
      .maybeSingle();
    if (error && error.code !== "PGRST116") throw error;
    return data;
  }

  // Find user by ID (public read)
  static async findById(id) {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error && error.code !== "PGRST116") throw error;
    return data;
  }

  // Find user by referral code (public read)
  static async findByReferralCode(code) {
    const { data, error } = await supabase
      .from("users")
      .select("id")
      .eq("referral_code", code)
      .maybeSingle();
    if (error && error.code !== "PGRST116") throw error;
    return data;
  }

  // Create new user (uses admin client to bypass RLS)
  static async create(userData) {
    const hashedPassword = await bcrypt.hash(userData.password, 10);
    const referralCode = Math.random()
      .toString(36)
      .substring(2, 10)
      .toUpperCase();

    const { data, error } = await supabaseAdmin
      .from("users")
      .insert({
        email: userData.email,
        password: hashedPassword,
        name: userData.name,
        referral_code: referralCode,
        referred_by: userData.referred_by || null,
        role: "user",
        subscription_type: "free",
        credits: 0,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Update user (admin client)
  static async update(id, updates) {
    const { data, error } = await supabaseAdmin
      .from("users")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Get all users (admin only)
  static async getAll() {
    const { data, error } = await supabaseAdmin
      .from("users")
      .select(
        "id, email, name, role, subscription_type, subscription_expiry, credits, referral_code, created_at",
      );

    if (error) throw error;
    return data;
  }

  // Get user counts for admin dashboard
  static async getCounts() {
    const { count: total, error: err1 } = await supabaseAdmin
      .from("users")
      .select("*", { count: "exact", head: true });

    const { count: active, error: err2 } = await supabaseAdmin
      .from("users")
      .select("*", { count: "exact", head: true })
      .neq("subscription_type", "free")
      .gt("subscription_expiry", new Date().toISOString());

    if (err1 || err2) throw err1 || err2;
    return { total, activeSubscriptions: active };
  }
}

module.exports = User;
