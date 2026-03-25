/**
 * Streak milestone definitions.
 * Each milestone has a threshold (min streak days), emoji, title, and subtitle.
 * Ordered from highest to lowest for easy lookup.
 */
export const STREAK_MILESTONES = [
    { threshold: 60, emoji: '👑', title: 'G.O.A.T', subtitle: 'Greatest Of All Time', color: '#f59e0b', themeName: 'Nút Ruby 💎' },
    { threshold: 40, emoji: '🧊', title: 'Lạnh lùng tàn nhẫn', subtitle: 'Bình tĩnh streak như không', color: '#06b6d4', themeName: 'Kim Cương 💠' },
    { threshold: 30, emoji: '🚀', title: 'Không ai đỡ nổi', subtitle: 'Đà này ai chặn được?', color: '#10b981', themeName: 'Nút Vàng 🥇' },
    { threshold: 18, emoji: '💪', title: 'Dính streak như keo 502', subtitle: 'Học hoài không biết mệt', color: '#8b5cf6', themeName: 'Nút Bạc 🥈' },
    { threshold: 5, emoji: '🔥', title: 'Máu lửa thật sự', subtitle: 'Bạn không phải dạng vừa', color: '#ef4444', themeName: 'Giao diện tối 🌙' },
];

/**
 * Get the current milestone for a given streak count.
 * Returns the highest milestone the user has reached, or null if none.
 */
export function getCurrentMilestone(streak) {
    if (!streak || streak < 0) return null;
    return STREAK_MILESTONES.find(m => streak >= m.threshold) || null;
}

/**
 * Get the next milestone the user is working towards.
 * Returns null if they've reached the highest milestone.
 */
export function getNextMilestone(streak) {
    if (!streak || streak < 0) streak = 0;
    // Milestones are sorted highest-first, so reverse to find the next one
    const sorted = [...STREAK_MILESTONES].reverse();
    return sorted.find(m => streak < m.threshold) || null;
}
