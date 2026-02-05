import React, { useState } from 'react';
import Navbar from '../components/layout/Navbar';
import MapView from '../components/map/MapView';
import { Search, MapPin, SlidersHorizontal } from 'lucide-react';
import { useParking } from '../context/ParkingContext';
import VoiceAssistant from '../components/ai/VoiceAssistant';
import { usePaystackPayment } from 'react-paystack';

const Home = () => {
    const { spots, reserveSpot } = useParking();
    const [searchTerm, setSearchTerm] = useState('');
    const [filter, setFilter] = useState('All');
    const [userBalance, setUserBalance] = useState(0);

    // Fetch balance on load
    React.useEffect(() => {
        fetch('/api/user/profile')
            .then(res => res.json())
            .then(data => setUserBalance(data.wallet_balance || 0)).catch(e => console.error(e));
    }, []);

    // PAYSTACK CONFIGURATION
    // REPLACE 'pk_test_xxxxxxxxxxxxxxxxxxxx' with your actual Public Key from Paystack Dashboard
    const [config, setConfig] = useState({
        reference: (new Date()).getTime().toString(),
        email: "user@example.com", // Replace with user's email
        amount: 2000, // Amount in kobo (e.g. 2000 = 20.00 NGN) - will be dynamic based on spot price
        publicKey: import.meta.env.VITE_PAYSTACK_PUBLIC_KEY || 'pk_test_placeholder',
    });

    // Helper to initialize payment
    const initializePayment = usePaystackPayment(config);

    const onSuccess = (reference, spot) => {
        // Implementation for what happens after payment
        console.log("Paystack Success:", reference); // Log the response to debug

        // Handle if reference is an object or string
        const refString = typeof reference === 'object' && reference.reference ? reference.reference : reference;

        if (!refString) {
            alert('Payment verification failed: No reference ID returned.');
            return;
        }

        reserveSpot(spot.id, refString)
            .then((res) => {
                if (res.success) {
                    const points = 10 + Math.floor(spot.price);
                    alert(`Reservation Confirmed for ${spot.name}!\n\n🎉 +${points} ParkPoints Earned!\nNavigate to spot to claim.`);
                } else {
                    alert('Reservation failed: ' + res.message);
                }
            });
    };

    const handleWalletPayment = (spot) => {
        if (userBalance < spot.price) {
            alert("Insufficient wallet balance. Please Top Up in Dashboard or pay with card.");
            return;
        }

        if (!confirm(`Pay GH₵${spot.price} from your wallet?`)) return;

        // Call reserve with wallet method
        // We need to modify reserveSpot in context or just fetch directly here. 
        // Assuming context just wraps fetch, but for custom method param we might need to be explicit.
        // Let's call API directly to ensure we pass payment_method

        fetch(`/api/reserve/${spot.id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                payment_method: 'wallet',
                duration: 1, // Default 1 hr for now
                user_name: 'Alex Driver' // Mock
            })
        })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    const points = 10 + Math.floor(spot.price);
                    alert(`Reservation Confirmed for ${spot.name}!\n\nPAID WITH WALLET\n🎉 +${points} ParkPoints Earned!`);
                    setUserBalance(data.new_balance); // Update local balance
                    setSelectedSpot(null);
                } else {
                    alert('Reservation Failed: ' + data.message);
                }
            })
            .catch(err => alert("Network Error"));
    };

    const onClose = () => {
        console.log('Payment closed');
    };

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
            // Update config dynamically for this transaction
            setConfig({
                ...config,
                reference: (new Date()).getTime().toString(),
                amount: Math.ceil(spot.price * 100), // Currency conversion (e.g. GHS/NGN)
            });

            setSelectedSpot(spot);

            // Refresh balance just in case
            fetch('/api/user/profile')
                .then(res => res.json())
                .then(data => setUserBalance(data.wallet_balance || 0));

        } else {
            alert('Sorry, this lot is full.');
        }
    };

    const [selectedSpot, setSelectedSpot] = useState(null);

    return (
        <div className="home-wrapper">
            <Navbar />

            {/* Payment Confirmation Modal (Simple Overlay) */}
            {selectedSpot && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.7)', zIndex: 9999,
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                }} onClick={() => setSelectedSpot(null)}>
                    <div style={{
                        background: '#0f172a', padding: '2rem', borderRadius: '1rem',
                        minWidth: '320px', maxWidth: '90%',
                        border: '1px solid #334155', color: 'white'
                    }} onClick={e => e.stopPropagation()}>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>Confirm Reservation</h2>
                        <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1.5rem' }}>
                            <p style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>{selectedSpot.name}</p>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem' }}>
                                <span style={{ color: '#94a3b8' }}>Success Rate</span>
                                <span style={{ color: '#10b981' }}>98%</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.25rem' }}>
                                <span style={{ color: '#94a3b8' }}>Price</span>
                                <span style={{ color: '#fff', fontWeight: 'bold' }}>GH₵{selectedSpot.price}/hr</span>
                            </div>
                        </div>

                        <p style={{ marginBottom: '0.5rem', fontSize: '0.9rem', color: '#cbd5e1' }}>Select Payment Method:</p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            {/* Wallet Option */}
                            <button onClick={() => handleWalletPayment(selectedSpot)}
                                disabled={userBalance < selectedSpot.price}
                                style={{
                                    background: userBalance >= selectedSpot.price ? '#4f46e5' : '#334155',
                                    opacity: userBalance >= selectedSpot.price ? 1 : 0.7,
                                    border: '1px solid #6366f1', color: 'white', padding: '0.75rem', borderRadius: '0.5rem',
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: userBalance >= selectedSpot.price ? 'pointer' : 'not-allowed'
                                }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <span style={{ fontSize: '1.2rem' }}>🛍️</span>
                                    <div style={{ textAlign: 'left' }}>
                                        <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>Pay with Wallet</div>
                                        <div style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>Bal: GH₵{userBalance.toFixed(2)}</div>
                                    </div>
                                </div>
                                {userBalance < selectedSpot.price && <span style={{ fontSize: '0.7rem', background: '#ef4444', padding: '2px 6px', borderRadius: '4px' }}>GHS {selectedSpot.price} Needed</span>}
                            </button>

                            {/* Card Option */}
                            <PaystackHookButton
                                spot={selectedSpot}
                                config={{
                                    ...config,
                                    amount: Math.ceil(selectedSpot.price * 100),
                                    reference: (new Date()).getTime().toString()
                                }}
                                onSuccess={(ref) => {
                                    onSuccess(ref, selectedSpot);
                                    setSelectedSpot(null);
                                }}
                                onClose={() => console.log('closed')}
                            />
                        </div>

                        <button onClick={() => setSelectedSpot(null)} style={{
                            marginTop: '1.5rem', background: 'none', border: 'none',
                            color: '#94a3b8', cursor: 'pointer', width: '100%', fontSize: '0.9rem'
                        }}>Cancel</button>
                    </div>
                </div>
            )}

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

// Sub-component to clean up hook usage
const PaystackHookButton = ({ spot, config, onSuccess, onClose }) => {
    const initializePayment = usePaystackPayment(config);
    return (
        <button className="btn-primary" style={{ width: '100%', background: 'transparent', border: '1px solid #4ade80', color: '#4ade80' }}
            onClick={() => {
                initializePayment(onSuccess, onClose);
            }}>
            Pay with Card
        </button>
    );
};

export default Home;
