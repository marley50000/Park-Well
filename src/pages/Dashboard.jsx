import React, { useState, useEffect } from 'react';
import { LayoutDashboard, Wallet, Car, BarChart3, Settings, TrendingUp, Users, Menu, X, Trash2, Plus, RotateCcw, RotateCw, AlertTriangle } from 'lucide-react';
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
    const { spots, addSpot, deleteSpot, undoAction, redoAction } = useParking();
    const [showAddModal, setShowAddModal] = useState(false);
    const [newSpot, setNewSpot] = useState({ name: '', price: '', available: '', lat: '', lng: '' });
    const [activeSessions, setActiveSessions] = useState([]);

    useEffect(() => {
        fetchActiveSessions();
        const interval = setInterval(fetchActiveSessions, 5000); // Poll for updates
        return () => clearInterval(interval);
    }, []);

    const fetchActiveSessions = async () => {
        try {
            const res = await fetch('/api/admin/sessions');
            if (res.ok) {
                const data = await res.json();
                setActiveSessions(data);
            }
        } catch (e) {
            console.error("Failed to fetch sessions", e);
        }
    };

    const handleCancelSession = async (spotId) => {
        if (!window.confirm("Force cancel this session? This cannot be undone.")) return;
        try {
            const res = await fetch('/api/admin/cancel_booking', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ spot_id: spotId })
            });
            if (res.ok) {
                alert("Session terminated.");
                fetchActiveSessions();
            } else {
                alert("Failed to cancel.");
            }
        } catch (e) {
            alert("Error canceling session.");
        }
    };

    const handleAddSpot = async (e) => {
        e.preventDefault();

        // Check for Geolocation
        if (!navigator.geolocation) {
            alert("Geolocation is not supported by your browser. You cannot add a spot.");
            return;
        }

        const submitSpot = (position) => {
            const payload = {
                ...newSpot,
                user_lat: position ? position.coords.latitude : null,
                user_lng: position ? position.coords.longitude : null
            };

            addSpot(payload)
                .then(() => {
                    setShowAddModal(false);
                    setNewSpot({ name: '', price: '', available: '', lat: '', lng: '' });
                    alert("Location added successfully!");
                })
                .catch(err => {
                    alert(`Error: ${err.message}`);
                });
        };

        // Try to get location
        navigator.geolocation.getCurrentPosition(
            (position) => {
                submitSpot(position);
            },
            (error) => {
                // If location denied, still try to submit (maybe they are admin, let backend decide)
                // Or if we want strict enforcement on frontend too:
                console.warn("Location access denied or failed", error);

                // We send null, backend will reject if not admin
                submitSpot(null);
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
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
                            <button
                                type="button"
                                className="text-xs text-indigo-400 underline mb-2"
                                onClick={() => {
                                    navigator.geolocation.getCurrentPosition(pos => {
                                        setNewSpot({ ...newSpot, lat: pos.coords.latitude, lng: pos.coords.longitude });
                                    });
                                }}
                            >
                                Use My Current Location
                            </button>
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
                        <span>ParkingSlot<span style={{ color: 'var(--color-primary)' }}>Africa</span></span>
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
                        {/* Undo / Redo Controls */}
                        <div className="flex bg-white/5 rounded-lg p-1 mr-2 border border-white/10">
                            <button onClick={undoAction} className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded transition-colors" title="Undo Last Action">
                                <RotateCcw size={18} />
                            </button>
                            <div className="w-px bg-white/10 mx-1"></div>
                            <button onClick={redoAction} className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded transition-colors" title="Redo Action">
                                <RotateCw size={18} />
                            </button>
                        </div>

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
                            <h3 className="font-bold mb-4 flex items-center gap-2">
                                <AlertTriangle className="text-yellow-500" size={20} />
                                Active Sessions Management
                            </h3>

                            <div style={{ flex: 1, overflowY: 'auto', paddingRight: '0.5rem' }}>
                                {activeSessions.map((session, idx) => (
                                    <div key={idx} className="flex-items-center justify-between p-3 mb-2 rounded-xl bg-white/5 border border-white/5 hover:border-yellow-500/30 transition-colors">
                                        <div>
                                            <h4 className="font-bold text-sm text-yellow-100">{session.user_name}</h4>
                                            <p className="text-xs text-muted">Vehicle: {session.vehicle_plate}</p>
                                            <p className="text-xs text-gray-500">Spot ID: {session.spot_id}</p>
                                        </div>
                                        <button
                                            onClick={() => handleCancelSession(session.spot_id)}
                                            className="px-3 py-1 bg-red-500/10 text-red-400 hover:bg-red-500/20 text-xs font-bold rounded-lg border border-red-500/20 transition-colors"
                                        >
                                            Force End
                                        </button>
                                    </div>
                                ))}
                                {activeSessions.length === 0 && (
                                    <div className="text-center text-muted py-8 flex flex-col items-center">
                                        <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-2">
                                            <Car className="text-gray-600" size={24} />
                                        </div>
                                        <p>No active sessions.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
};

export default Dashboard;
