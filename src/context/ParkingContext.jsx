import React, { createContext, useState, useContext, useEffect } from 'react';

const ParkingContext = createContext();

export const useParking = () => useContext(ParkingContext);

export const ParkingProvider = ({ children }) => {
    const [spots, setSpots] = useState([]);

    // Load initial data from API
    useEffect(() => {
        fetchSpots();
        // Setup polling or socket listener could go here
    }, []);

    const fetchSpots = async () => {
        try {
            const res = await fetch('/api/spots');
            if (res.ok) {
                const data = await res.json();
                setSpots(data);
            }
        } catch (error) {
            console.error("Failed to fetch spots", error);
        }
    };

    const addSpot = async (spotData) => {
        try {
            const res = await fetch('/api/spots', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(spotData)
            });

            const data = await res.json();

            if (!res.ok) {
                // Return error to caller
                throw new Error(data.message || 'Failed to add spot');
            }

            // Optimistic update or refetch
            setSpots(prev => [...prev, data]);
            return { success: true };
        } catch (error) {
            console.error("Add Spot Error:", error);
            // Propagate error to UI for display
            throw error;
        }
    };

    const deleteSpot = async (id) => {
        try {
            await fetch(`/api/spots/${id}`, { method: 'DELETE' });
            setSpots(spots.filter(s => s.id !== id));
        } catch (error) {
            console.error("Delete failed", error);
        }
    };

    const reserveSpot = async (id, paymentReference = null, bookingDetails = {}) => {
        // Placeholder for reserve logic contacting API
        try {
            const body = {
                ...bookingDetails,
                payment_reference: paymentReference
            };

            const res = await fetch(`/api/reserve/${id}`, {
                method: 'POST',
                body: JSON.stringify(body),
                headers: { 'Content-Type': 'application/json' }
            });

            const data = await res.json();

            if (res.ok && data.success) {
                setSpots(spots.map(s => s.id === id && s.available > 0 ? { ...s, available: s.available - 1 } : s));
                return { success: true };
            } else {
                console.error("Reserve failed:", data.message);
                return { success: false, message: data.message };
            }
        } catch (error) {
            console.error("Reserve failed", error);
            return { success: false, message: "Network error" };
        }
    };

    const undoAction = async () => {
        try {
            const res = await fetch('/api/admin/undo', { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                fetchSpots(); // Refresh local state
                return true;
            }
            return false;
        } catch (error) {
            console.error(error);
            return false;
        }
    };

    const redoAction = async () => {
        try {
            const res = await fetch('/api/admin/redo', { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                fetchSpots();
                return true;
            }
            return false;
        } catch (error) {
            console.error(error);
            return false;
        }
    };

    return (
        <ParkingContext.Provider value={{ spots, addSpot, deleteSpot, reserveSpot, undoAction, redoAction }}>
            {children}
        </ParkingContext.Provider>
    );
};
