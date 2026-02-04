
import React, { useState } from 'react';
import Navbar from '../components/layout/Navbar';
import MapView from '../components/map/MapView';
import { Search, MapPin, SlidersHorizontal } from 'lucide-react';
import { useParking } from '../context/ParkingContext';
import VoiceAssistant from '../components/ai/VoiceAssistant';

const Home = () => {
    const { spots, reserveSpot } = useParking();
    const [searchTerm, setSearchTerm] = useState('');
    const [filter, setFilter] = useState('All');

    // Filter logic
    const filteredSpots = spots.filter(spot => {
        const matchesSearch = spot.name.toLowerCase().includes(searchTerm.toLowerCase());

        if (filter === 'All') return matchesSearch;
        if (filter === 'Nearby') return matchesSearch && (spot.distance.includes('0.') || parseFloat(spot.distance) < 0.5); // Adapt for string/number
        if (filter === 'Lowest Price') return matchesSearch && parseFloat(spot.price) < 15;
        if (filter === 'Available') return matchesSearch && spot.available > 0;

        return matchesSearch;
    }).sort((a, b) => {
        if (filter === 'Lowest Price') {
            return parseFloat(a.price) - parseFloat(b.price);
        }
        return 0; // Default order
    });

    const handleVoiceCommand = (cmd) => {
        if (cmd === 'filter:price') setFilter('Lowest Price');
        else if (cmd === 'filter:distance') setFilter('Nearby');
        else if (cmd === 'filter:all') { setFilter('All'); setSearchTerm(''); }
        else if (cmd === 'filter:available') setFilter('Available');
        else if (cmd.startsWith('search:')) {
            const term = cmd.replace('search:', '');
            setSearchTerm(term);
            setFilter('All');
        }
    };

    const handleReserve = (spot) => {
        if (spot.available > 0) {
            const points = 10 + Math.floor(spot.price);
            reserveSpot(spot.id);
            alert(`Reservation Confirmed for ${spot.name}!\n\n🎉 +${points} ParkPoints Earned!\nNavigate to spot to claim.`);
        } else {
            alert('Sorry, this lot is full.');
        }
    };

    const handleNavigate = (spot) => {
        const url = `https://www.google.com/maps/dir/?api=1&destination=${spot.position[0]},${spot.position[1]}`;
        window.open(url, '_blank');
    };

    return (
        <div className="home-wrapper">
            <Navbar />

            {/* Map Background */}
            <div className="map-bg">
                <MapView spots={filteredSpots} />
            </div>

            {/* Search Overlay */}
            <div className="search-container">
                <div className="search-box">
                    <div className="search-input-wrapper">
                        <Search color="#9ca3af" size={20} />
                        <input
                            type="text"
                            placeholder="Where are you going?"
                            className="search-input"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        <button style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}>
                            <SlidersHorizontal size={20} color="#6366f1" />
                        </button>
                    </div>

                    {/* Filter Pills */}
                    <div className="filter-row">
                        {['All', 'Nearby', 'Lowest Price', 'Covered', 'Valet', 'EV Charging'].map((f) => (
                            <button
                                key={f}
                                className="filter-chip"
                                style={filter === f ? { background: 'rgba(99, 102, 241, 0.2)', borderColor: 'var(--color-primary)', color: 'white' } : {}}
                                onClick={() => setFilter(f)}
                            >
                                {f}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Bottom Spot List / Details */}
            <div className="spots-container">
                <div className="spots-scroll">
                    {filteredSpots.map(spot => (
                        <div key={spot.id} className="spot-card-item">
                            <div className="glass-card spot-card">
                                <div className="flex-items-center" style={{ justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                    <div>
                                        <h3 style={{ fontSize: '1.125rem', fontWeight: 'bold', marginBottom: '0.25rem' }}>{spot.name}</h3>
                                        <div className="flex-items-center gap-3">
                                            <p className="text-muted text-sm flex-items-center gap-1"><MapPin size={12} /> {spot.distance}</p>
                                            <button
                                                onClick={() => handleNavigate(spot)}
                                                className="text-xs text-indigo-400 hover:text-indigo-300 underline font-medium"
                                            >
                                                Navigate
                                            </button>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.25rem' }}>
                                        <div style={{ color: '#818cf8', background: 'rgba(99, 102, 241, 0.1)', padding: '0.25rem 0.5rem', borderRadius: '0.5rem', fontSize: '0.875rem', fontWeight: 'bold' }}>
                                            ${spot.price}/hr
                                        </div>
                                        <div style={{ fontSize: '0.65rem', color: '#fbbf24', fontWeight: 'bold' }}>
                                            +{10 + Math.floor(spot.price)} pts
                                        </div>
                                    </div>
                                </div>

                                <div className="flex-items-center" style={{ justifyContent: 'space-between', marginTop: '1rem' }}>
                                    <div className="flex-items-center gap-2">
                                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: spot.available > 0 ? '#10b981' : '#ef4444', boxShadow: spot.available > 0 ? '0 0 8px rgba(16,185,129,0.5)' : 'none' }}></div>
                                        <span className="text-sm font-bold text-muted">
                                            {spot.available > 0 ? `${spot.available} spots open` : 'Full'}
                                        </span>
                                    </div>
                                    <button
                                        onClick={() => handleReserve(spot)}
                                        className="btn-primary text-sm"
                                        style={{ opacity: spot.available > 0 ? 1 : 0.5, pointerEvents: spot.available > 0 ? 'auto' : 'none' }}
                                    >
                                        {spot.available > 0 ? 'Reserve' : 'Full'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                    {filteredSpots.length === 0 && (
                        <div className="glass-panel p-4 rounded-xl text-center text-gray-400 mx-auto w-full max-w-sm">
                            <p>No parking spots found.</p>
                        </div>
                    )}
                </div>
            </div>

            <VoiceAssistant onCommand={handleVoiceCommand} />
        </div>
    );
};

export default Home;
