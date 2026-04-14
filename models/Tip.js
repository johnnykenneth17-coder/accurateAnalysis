const { supabase, supabaseAdmin } = require('../config/supabase');

class Tip {
    // Create a new tip (admin only)
    static async create(tipData) {
        const { data, error } = await supabaseAdmin
            .from('tips')
            .insert(tipData)
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    // Find single tip by ID (public read – respects RLS)
    static async findById(id) {
        const { data, error } = await supabase
            .from('tips')
            .select('*')
            .eq('id', id)
            .maybeSingle();

        if (error && error.code !== 'PGRST116') throw error;
        return data;
    }

    // Get all tips with filtering and pagination
    // hasVipAccess: boolean – if true, show VIP tips; if false, exclude them
    static async findAll(filters = {}, page = 1, limit = 20, hasVipAccess = false) {
        let query = supabase
            .from('tips')
            .select('*', { count: 'exact' });

        // Apply filters
        if (filters.sport) query = query.eq('sport', filters.sport);
        if (filters.league) query = query.eq('league', filters.league);
        if (filters.tip_type) query = query.eq('tip_type', filters.tip_type);
        if (filters.status) query = query.eq('status', filters.status);
        if (filters.search) {
            query = query.or(`home_team.ilike.%${filters.search}%,away_team.ilike.%${filters.search}%`);
        }

        // VIP filter
        if (!hasVipAccess) {
            query = query.eq('is_vip', false);
        }

        const from = (page - 1) * limit;
        const to = from + limit - 1;

        const { data, error, count } = await query
            .order('match_datetime', { ascending: true })
            .range(from, to);

        if (error) throw error;

        return {
            tips: data,
            total: count,
            page,
            totalPages: Math.ceil(count / limit)
        };
    }

    // Update tip (admin only)
    static async update(id, updates) {
        // Add updated_at automatically
        const { data, error } = await supabaseAdmin
            .from('tips')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    // Delete tip (admin only)
    static async delete(id) {
        const { error } = await supabaseAdmin
            .from('tips')
            .delete()
            .eq('id', id);

        if (error) throw error;
        return true;
    }

    // Get tip statistics for admin dashboard
    static async getStats() {
        const { data, error } = await supabaseAdmin
            .from('tips')
            .select('status');

        if (error) throw error;

        const total = data.length;
        const pending = data.filter(t => t.status === 'pending').length;
        const won = data.filter(t => t.status === 'won').length;
        const lost = data.filter(t => t.status === 'lost').length;
        const winRate = (won + lost) > 0 ? (won / (won + lost)) * 100 : 0;

        return { total, pending, won, lost, winRate };
    }
}

module.exports = Tip;