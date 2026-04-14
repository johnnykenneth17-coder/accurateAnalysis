const { supabase, supabaseAdmin } = require("../config/supabase");

class TrackedTip {
  // Track a tip (user follows)
  static async create(userId, tipId, stake) {
    const { data, error } = await supabaseAdmin
      .from("tracked_tips")
      .insert({ user_id: userId, tip_id: tipId, stake: stake || 10 })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Untrack a tip
  static async delete(userId, tipId) {
    const { error } = await supabaseAdmin
      .from("tracked_tips")
      .delete()
      .eq("user_id", userId)
      .eq("tip_id", tipId);

    if (error) throw error;
    return true;
  }

  // Get all tracked tips for a user, including tip details
  static async findByUser(userId) {
    const { data, error } = await supabase
      .from("tracked_tips")
      .select(
        `
                *,
                tip:tips(*)
            `,
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data;
  }

  // Check if a tip is already tracked by a user
  static async isTracked(userId, tipId) {
    const { data, error } = await supabase
      .from("tracked_tips")
      .select("id")
      .eq("user_id", userId)
      .eq("tip_id", tipId)
      .maybeSingle();

    if (error && error.code !== "PGRST116") throw error;
    return !!data;
  }

  // Get aggregated stats for a user (profit, win rate, total bets)
  static async getUserStats(userId) {
    const tracked = await this.findByUser(userId);
    let totalProfit = 0;
    let wonCount = 0;
    let lostCount = 0;

    for (const t of tracked) {
      const tip = t.tip;
      if (tip && tip.status === "won") {
        const profit = t.stake * tip.odds - t.stake;
        totalProfit += profit;
        wonCount++;
      } else if (tip && tip.status === "lost") {
        totalProfit -= t.stake;
        lostCount++;
      }
    }

    const totalBets = wonCount + lostCount;
    const winRate = totalBets > 0 ? (wonCount / totalBets) * 100 : 0;

    return { totalProfit, winRate, totalBets };
  }
}

module.exports = TrackedTip;
