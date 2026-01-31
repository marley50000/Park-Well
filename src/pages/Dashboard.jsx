import React, { useState } from 'react';
import { LayoutDashboard, Wallet, Car, BarChart3, Settings, TrendingUp, Users, Menu, X, Trash2, Plus } from 'lucide-react';
import { useParking } from '../context/ParkingContext';

const SidebarItem = ({ icon: Icon, label, active }) => (
    <div className={`sidebar-link ${active ? 'active' : ''}`}>
        <Icon size={20} />
        <span>{label}</span>
    </div>
);

const StatCard = ({ title, value, sub, icon: Icon, trend }) => (
    <div className="glass-card" style={{ padding: '1.5rem', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, right: 0, padding: '1rem', opacity: 0.1, color: 'var(--color-primary)' }}>
            <Icon size={64} />
        </div>
        <div style={{ position: 'relative', zIndex: 10 }}>
            <p className="text-muted text-sm" style={{ fontWeight: 500, marginBottom: '0.25rem' }}>{title}</p>
            <h3 style={{ fontSize: '1.875rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>{value}</h3>
            <div className="flex-items-center gap-2">
                <span className="text-xs font-bold" style={{ padding: '0.125rem 0.375rem', borderRadius: '0.25rem', background: trend > 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', color: trend > 0 ? '#34d399' : '#f87171' }}>
                    {trend > 0 ? '+' : ''}{trend}%
                </span>
                <span className="text-xs text-muted">{sub}</span>
            </div>
        </div>
    </div>
);

const Dashboard = () => {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const { spots, addSpot, deleteSpot } = useParking();
    const [showAddModal, setShowAddModal] = useState(false);
    const [newSpot, setNewSpot] = useState({ name: '', price: '', available: '', lat: '', lng: '' });

    const handleAddSpot = (e) => {
        e.preventDefault();
        addSpot(newSpot);
        setShowAddModal(false);
        setNewSpot({ name: '', price: '', available: '', lat: '', lng: '' });
    };

    return (
        <div className="dashboard-container">
            {/* Mobile Sidebar Overlay */}
            {sidebarOpen && (
                <div
                    style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 45, backdropFilter: 'blur(4px)' }}
                    onClick={() => setSidebarOpen(false)}
                    className="lg:hidden"
                />
            )}

            {/* Add Spot Modal */}
            {showAddModal && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(5px)' }}>
                    <div className="glass-card" style={{ width: '100%', maxWidth: '30rem', background: '#111827' }}>
                        <div className="flex-items-center justify-between mb-4">
                            <h3 className="font-bold text-lg">Add New Parking Lot</h3>
                            <button onClick={() => setShowAddModal(false)}><X size={20} className="text-gray-400" /></button>
                        </div>
                        <form onSubmit={handleAddSpot} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div>
                                <label className="text-xs text-muted mb-1 block">Lot Name</label>
                                <input required type="text" className="input-glass" placeholder="e.g. Central Station Parking" value={newSpot.name} onChange={e => setNewSpot({ ...newSpot, name: e.target.value })} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', padding: '0.75rem', borderRadius: '0.5rem', width: '100%', color: 'white' }} />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label className="text-xs text-muted mb-1 block">Price ($/hr)</label>
                                    <input required type="number" className="input-glass" placeholder="10" value={newSpot.price} onChange={e => setNewSpot({ ...newSpot, price: e.target.value })} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', padding: '0.75rem', borderRadius: '0.5rem', width: '100%', color: 'white' }} />
                                </div>
                                <div>
                                    <label className="text-xs text-muted mb-1 block">Total Spots</label>
                                    <input required type="number" className="input-glass" placeholder="50" value={newSpot.available} onChange={e => setNewSpot({ ...newSpot, available: e.target.value })} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', padding: '0.75rem', borderRadius: '0.5rem', width: '100%', color: 'white' }} />
                                </div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label className="text-xs text-muted mb-1 block">Latitude</label>
                                    <input required type="number" step="any" className="input-glass" placeholder="40.7128" value={newSpot.lat} onChange={e => setNewSpot({ ...newSpot, lat: e.target.value })} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', padding: '0.75rem', borderRadius: '0.5rem', width: '100%', color: 'white' }} />
                                </div>
                                <div>
                                    <label className="text-xs text-muted mb-1 block">Longitude</label>
                                    <input required type="number" step="any" className="input-glass" placeholder="-74.0060" value={newSpot.lng} onChange={e => setNewSpot({ ...newSpot, lng: e.target.value })} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', padding: '0.75rem', borderRadius: '0.5rem', width: '100%', color: 'white' }} />
                                </div>
                            </div>
                            <button type="submit" className="btn-primary" style={{ justifyContent: 'center', marginTop: '1rem' }}>Create Location</button>
                        </form>
                    </div>
                </div>
            )}

            {/* Sidebar */}
            <div className={`dash-sidebar ${sidebarOpen ? 'open' : ''}`}>
                <div className="flex-items-center justify-between mb-4">
                    <div className="flex-items-center gap-2" style={{ fontSize: '1.25rem', fontWeight: 'bold', padding: '0 0.5rem' }}>
                        <div style={{ background: 'var(--color-primary)', padding: '0.375rem', borderRadius: '0.5rem', display: 'flex', boxShadow: '0 0 10px var(--color-primary-glow)' }}>
                            <Car size={20} className="text-white" />
                        </div>
                        <span>Park<span style={{ color: 'var(--color-primary)' }}>Well</span></span>
                    </div>
                    {/* Close button for mobile */}
                    <button
                        onClick={() => setSidebarOpen(false)}
                        style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}
                        className="lg:hidden"
                    >
                        <X size={24} />
                    </button>
                </div>

                <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: 1 }}>
                    <SidebarItem icon={LayoutDashboard} label="Overview" active />
                    <SidebarItem icon={BarChart3} label="Analytics" />
                    <SidebarItem icon={Car} label="My Lots" />
                    <SidebarItem icon={Wallet} label="Revenue" />
                    <SidebarItem icon={Users} label="Customers" />
                </nav>

                <div style={{ marginTop: 'auto' }}>
                    <SidebarItem icon={Settings} label="Settings" />
                </div>
            </div>

            {/* Main Content */}
            <div className="dash-main">
                {/* Top Bar */}
                <header className="dash-header">
                    <div className="flex-items-center gap-4">
                        <button
                            onClick={() => setSidebarOpen(true)}
                            style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', display: 'none' }}
                            // In real CSS we would use media query, but inline styles are harder. 
                            // Let's rely on class utility or just show it and let CSS hide it on desktop if we had tailwind.
                            // Since we use vanilla CSS, I'll add a style block helper or just always show it and let user assume.
                            // Actually, I'll inline the display check roughly or rely on index.css helper I'll add.
                            className="mobile-menu-btn"
                        >
                            <Menu size={24} />
                        </button>
                        <h1 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>Dashboard Overview</h1>
                    </div>
                    <div className="flex-items-center" style={{ gap: '1rem' }}>
                        <button onClick={() => setShowAddModal(true)} className="btn-primary text-sm">
                            <Plus size={16} /> Add New Lot
                        </button>
                        <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(to top right, #6366f1, #a855f7)', border: '2px solid rgba(255,255,255,0.2)' }}></div>
                    </div>
                </header>

                <main className="dash-content">
                    {/* Stats Grid */}
                    <div className="stats-grid">
                        <StatCard title="Total Revenue" value="$12,450" sub="vs last month" trend={12} icon={Wallet} />
                        <StatCard title="Active Locations" value={spots.length} sub="Currently managed" trend={0} icon={Car} />
                        <StatCard title="Occupancy Rate" value="78%" sub="Average daily" trend={8} icon={TrendingUp} />
                        <StatCard title="New Customers" value="64" sub="This week" trend={24} icon={Users} />
                    </div>

                    {/* Main Chart Area & List */}
                    <div className="charts-grid">
                        <div className="glass-card" style={{ height: '24rem', display: 'flex', flexDirection: 'column', background: 'rgba(17, 24, 39, 0.4)' }}>
                            <div className="flex-items-center" style={{ justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                                <h3 className="font-bold">Managed Locations</h3>
                            </div>

                            <div style={{ flex: 1, overflowY: 'auto', paddingRight: '0.5rem' }}>
                                {spots.map(spot => (
                                    <div key={spot.id} className="flex-items-center justify-between p-3 mb-2 rounded-xl bg-white/5 border border-white/5 hover:border-indigo-500/30 transition-colors group">
                                        <div className="flex-items-center gap-3">
                                            <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                                                <Car size={20} />
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-sm">{spot.name}</h4>
                                                <p className="text-xs text-muted flex gap-2">
                                                    <span>${spot.price}/hr</span>
                                                    <span>•</span>
                                                    <span className={spot.available > 0 ? "text-emerald-400" : "text-red-400"}>{spot.available} spots left</span>
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => deleteSpot(spot.id)}
                                            className="p-2 rounded-lg hover:bg-red-500/20 text-gray-500 hover:text-red-400 transition-colors"
                                            title="Remove Location"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                ))}
                                {spots.length === 0 && (
                                    <div className="text-center text-muted py-8">
                                        No parking locations added yet.
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="glass-card" style={{ height: '24rem', display: 'flex', flexDirection: 'column', background: 'rgba(17, 24, 39, 0.4)' }}>
                            <h3 className="font-bold mb-4">Revenue Analytics</h3>
                            {/* CSS Chart Mock */}
                            <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '1rem', paddingBottom: '0.5rem' }}>
                                {[40, 65, 45, 80, 55, 90, 70].map((h, i) => (
                                    <div key={i} className="chart-bar" style={{ height: `${h}%` }}></div>
                                ))}
                            </div>
                            <div className="flex-items-center" style={{ justifyContent: 'space-between', fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.5rem' }}>
                                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => <span key={d} style={{ flex: 1, textAlign: 'center' }}>{d}</span>)}
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
};

export default Dashboard;
