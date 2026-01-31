import React, { createContext, useState, useContext } from 'react';

const ParkingContext = createContext();

export const useParking = () => useContext(ParkingContext);

const INITIAL_SPOTS = [
    { id: 1, name: 'Downtown Plaza Garage', position: [40.7128, -74.0060], price: 12, available: 14, distance: '0.2 mi' },
    { id: 2, name: 'Westside Auto Park', position: [40.7150, -74.0090], price: 8, available: 3, distance: '0.8 mi' },
    { id: 3, name: 'Times Square Valet', position: [40.7100, -74.0020], price: 25, available: 0, distance: '1.2 mi' },
    { id: 4, name: 'Hudson River Lot', position: [40.7180, -74.0100], price: 15, available: 42, distance: '0.5 mi' },
];

export const ParkingProvider = ({ children }) => {
    // Initialize from LocalStorage or use default
    const [spots, setSpots] = useState(() => {
        const saved = localStorage.getItem('parkwell_spots');
        return saved ? JSON.parse(saved) : INITIAL_SPOTS;
    });

    // Persist to LocalStorage on change
    React.useEffect(() => {
        localStorage.setItem('parkwell_spots', JSON.stringify(spots));
    }, [spots]);

    const addSpot = (spot) => {
        const newSpot = {
            ...spot,
            id: Date.now(),
            distance: '0.5 mi', // Default for simulated locations
            position: [parseFloat(spot.lat), parseFloat(spot.lng)],
            available: parseInt(spot.available) || 0,
            price: parseFloat(spot.price) || 0
        };
        setSpots([...spots, newSpot]);
    };

    const deleteSpot = (id) => {
        setSpots(spots.filter(s => s.id !== id));
    };

    const reserveSpot = (id) => {
        setSpots(spots.map(s => {
            if (s.id === id) {
                if (s.available > 0) {
                    return { ...s, available: s.available - 1 };
                }
            }
            return s;
        }));
    };

    return (
        <ParkingContext.Provider value={{ spots, addSpot, deleteSpot, reserveSpot }}>
            {children}
        </ParkingContext.Provider>
    );
};
