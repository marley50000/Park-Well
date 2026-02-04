import React, { useEffect, useState } from 'react';
import { Trophy, Star, TrendingUp, Gift, Crown, ChevronRight, History } from 'lucide-react';
import { motion } from 'framer-motion';

const Rewards = () => {
    const [user, setUser] = useState(null);

    useEffect(() => {
        fetch('/api/user/profile')
            .then(res => res.json())
            .then(data => setUser(data))
            .catch(err => console.error("Failed to load profile", err));
    }, []);

    if (!user) return <div className="p-10 text-center text-white">Loading Rewards...</div>;

    const nextTierPoints = user.tier === 'Bronze' ? 200 : user.tier === 'Silver' ? 500 : 1000;
    const progress = Math.min((user.points / nextTierPoints) * 100, 100);

    return (
        <div className="rewards-page" style={{ paddingTop: '80px', paddingBottom: '40px', minHeight: '100vh', background: '#0f172a', color: 'white' }}>
            <div className="container mx-auto px-4 max-w-4xl">

                {/* Header */}
                <div className="text-center mb-10">
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="inline-block p-3 rounded-full bg-gradient-to-r from-yellow-400 to-orange-500 mb-4 shadow-lg shadow-orange-500/20"
                    >
                        <Crown size={40} className="text-white" />
                    </motion.div>
                    <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">ParkPoints Rewards</h1>
                    <p className="text-gray-400 mt-2">Earn points with every park. Unlock exclusive benefits.</p>
                </div>

                {/* Main Card */}
                <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="glass-card p-8 rounded-3xl relative overflow-hidden mb-8"
                    style={{ background: 'linear-gradient(145deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)', border: '1px solid rgba(255,255,255,0.1)' }}
                >
                    {/* Background Glow */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/20 blur-[100px] rounded-full pointer-events-none"></div>

                    <div className="flex flex-col md:flex-row items-center justify-between gap-8 relative z-10">
                        <div className="text-center md:text-left">
                            <h2 className="text-2xl font-bold mb-1">Current Status</h2>
                            <div className="text-5xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 to-yellow-500">
                                {user.tier} Member
                            </div>
                            <p className="text-gray-400 mt-2 flex items-center gap-2 justify-center md:justify-start">
                                <Star className="text-yellow-500" fill="currentColor" size={16} />
                                <span className="text-white font-bold">{user.points}</span> Total Points
                            </p>
                        </div>

                        <div className="w-full md:w-1/2">
                            <div className="flex justify-between text-sm mb-2 text-gray-400">
                                <span>Progress to {user.tier === 'Platinum' ? 'Max Level' : 'Next Tier'}</span>
                                <span>{user.points} / {nextTierPoints}</span>
                            </div>
                            <div className="h-4 bg-gray-800 rounded-full overflow-hidden border border-white/5">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${progress}%` }}
                                    transition={{ duration: 1, ease: "easeOut" }}
                                    className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 shadow-[0_0_15px_rgba(168,85,247,0.5)]"
                                ></motion.div>
                            </div>
                            <p className="text-xs text-center mt-2 text-gray-500">
                                {nextTierPoints - user.points} more points to reach next level
                            </p>
                        </div>
                    </div>
                </motion.div>

                {/* Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* History */}
                    <div className="glass-card p-6 rounded-2xl bg-white/5 border border-white/10">
                        <div className="flex items-center gap-3 mb-6">
                            <History className="text-indigo-400" />
                            <h3 className="text-xl font-bold">Recent Activity</h3>
                        </div>
                        <div className="space-y-4">
                            {user.history && user.history.length > 0 ? (
                                [...user.history].reverse().slice(0, 5).map((item, idx) => (
                                    <div key={idx} className="flex justify-between items-center p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
                                        <div>
                                            <p className="font-medium text-white">{item.action}</p>
                                            <p className="text-xs text-gray-400">{item.spot}</p>
                                        </div>
                                        <div className="text-green-400 font-bold">+{item.points} pts</div>
                                    </div>
                                ))
                            ) : (
                                <p className="text-gray-500 text-center py-4">No recent activity</p>
                            )}
                        </div>
                    </div>

                    {/* Perks */}
                    <div className="glass-card p-6 rounded-2xl bg-white/5 border border-white/10">
                        <div className="flex items-center gap-3 mb-6">
                            <Gift className="text-pink-400" />
                            <h3 className="text-xl font-bold">Your Benefits</h3>
                        </div>
                        <ul className="space-y-3">
                            <PerkItem active={true} text="Real-time Spot Availability" />
                            <PerkItem active={user.tier !== 'Bronze'} text="5% Discount on Weekends" />
                            <PerkItem active={user.tier === 'Gold' || user.tier === 'Platinum'} text="Priority Reservation (24h in advance)" />
                            <PerkItem active={user.tier === 'Platinum'} text="Dedicated VIP Support" />
                            <PerkItem active={user.tier === 'Platinum'} text="Free Valet Once a Month" />
                        </ul>
                    </div>
                </div>

            </div>
        </div>
    );
};

const PerkItem = ({ active, text }) => (
    <li className={`flex items-center gap-3 ${active ? 'text-white' : 'text-gray-600'}`}>
        <div className={`w-5 h-5 rounded-full flex items-center justify-center ${active ? 'bg-green-500/20 text-green-400' : 'bg-gray-800 text-gray-600'}`}>
            {active ? <TrendingUp size={12} /> : <div className="w-2 h-2 rounded-full bg-gray-600"></div>}
        </div>
        <span>{text}</span>
        {!active && <span className="text-xs border border-gray-700 px-2 py-0.5 rounded text-gray-500 ml-auto">Locked</span>}
    </li>
);

export default Rewards;
