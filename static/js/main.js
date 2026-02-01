document.addEventListener('DOMContentLoaded', () => {
    // Default: Accra
    const DEFAULT_CENTER = [5.6037, -0.1870];
    let map = L.map('map', { zoomControl: false }).setView(DEFAULT_CENTER, 13);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap &copy; CARTO'
    }).addTo(map);

    let allSpots = [];
    let markers = {};
    let userLocation = null;
    let userMarker = null;
    let currentRouteLayer = null;
    let isNavigating = false;
    let navTargetSpot = null;

    // Custom Icons
    const userIcon = L.divIcon({
        className: 'user-location-marker',
        html: '<div style="background-color: #6366f1; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 0 10px rgba(99, 102, 241, 0.3);"></div>',
        iconSize: [20, 20],
        iconAnchor: [10, 10]
    });

    // 1. Initialize & Watch User
    // 1. Initialize & Watch User
    function init() {
        if ("geolocation" in navigator) {
            navigator.geolocation.watchPosition(
                (position) => {
                    const { latitude, longitude } = position.coords;
                    userLocation = { lat: latitude, lng: longitude };

                    // Update or Add User Marker
                    if (userMarker) {
                        userMarker.setLatLng([latitude, longitude]);
                    } else {
                        userMarker = L.marker([latitude, longitude], { icon: userIcon }).addTo(map);
                        userMarker.bindPopup("You are here");
                        // Only center initially if no marker existed
                        map.setView([latitude, longitude], 14);
                        fetchSpots(); // Initial fetch
                    }

                    // Follow Mode if Navigating
                    if (isNavigating && navTargetSpot) {
                        map.setView([latitude, longitude], 16);

                        // Optional: Update distance on card
                        const dist = getDistanceFromLatLonInKm(latitude, longitude, navTargetSpot.lat, navTargetSpot.lng);
                        document.getElementById('navDistance').innerText = dist.toFixed(1) + ' km to your destination';
                    }
                },
                (error) => {
                    console.error("Error watching location:", error);
                    if (!userLocation) { // Only alert if we never got location
                        alert("Could not get your location. Showing default/last known view.");
                        fetchSpots();
                    }
                },
                {
                    enableHighAccuracy: true,
                    maximumAge: 1000,
                    timeout: 27000
                }
            );
        } else {
            console.log("Geolocation not supported");
            fetchSpots();
        }

        // Real-Time Updates (Socket.IO)
        const socket = io();
        socket.on('data_update', (msg) => {
            console.log("Live update:", msg);
            fetchSpots(); // Refresh markers instantly
        });
    }

    // 2. Fetch Data
    function fetchSpots() {
        fetch('/api/spots')
            .then(r => r.json())
            .then(spots => {
                // If we have user location, calculate real distances & sort
                if (userLocation) {
                    spots.forEach(spot => {
                        spot._realDistance = getDistanceFromLatLonInKm(
                            userLocation.lat, userLocation.lng,
                            spot.lat, spot.lng
                        );
                        // Format for display (e.g., "1.2 km")
                        spot.distance = spot._realDistance.toFixed(1) + " km";
                    });

                    // Sort by nearest
                    spots.sort((a, b) => a._realDistance - b._realDistance);
                }

                allSpots = spots;
                renderSpots(spots);
            });
    }

    function renderSpots(spots) {
        const listEl = document.getElementById('spotsList');
        listEl.innerHTML = '';

        // Add Mobile Sheet Handle
        const handle = document.createElement('div');
        handle.className = 'sheet-handle-container';
        handle.innerHTML = '<div class="sheet-handle-bar"></div>';
        handle.onclick = toggleSheet;
        listEl.appendChild(handle);

        // Clear Markers
        Object.values(markers).forEach(m => map.removeLayer(m));
        markers = {};

        spots.forEach(spot => {
            // Add Marker
            const marker = L.marker([spot.lat, spot.lng]).addTo(map);
            marker.bindPopup(`
                <div style="color: black; text-align: center;">
                    <b>${spot.name}</b><br>
                    ${spot.available} spots<br>
                    GH₵ ${spot.price}/hr<br>
                    <span style="font-size:0.8em; color: #666;">${spot.distance} away</span>
                </div>
            `);
            markers[spot.id] = marker;

            // External Maps Link (Fallback)
            const navUrl = `https://www.google.com/maps/dir/?api=1&destination=${spot.lat},${spot.lng}`;

            // Add Card
            const card = document.createElement('div');
            card.className = 'spot-card-item';
            card.innerHTML = `
                <div class="glass-card">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
                        <div>
                            <h3 style="font-weight: 700; font-size: 1.1rem; margin-bottom: 0.25rem;">${spot.name}</h3>
                            <div style="display: flex; gap: 0.5rem; color: #9ca3af; font-size: 0.875rem; align-items: center;">
                                <ion-icon name="location"></ion-icon> ${spot.distance}
                                <a href="${navUrl}" target="_blank" style="color: #6366f1; text-decoration: none; margin-left: 0.5rem; font-size: 0.75rem; border: 1px solid rgba(99,102,241,0.3); padding: 2px 6px; border-radius: 4px;">Google Maps</a>
                            </div>
                        </div>
                        <div style="background: rgba(99,102,241,0.1); color: #818cf8; padding: 4px 8px; border-radius: 6px; font-weight: 700; font-size: 0.875rem;">
                            GH₵ ${spot.price}/hr
                        </div>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 1rem; gap: 0.5rem;">
                         <div style="display: flex; gap: 0.5rem; align-items: center;">
                            <div style="width: 8px; height: 8px; border-radius: 50%; background: ${spot.available > 0 ? '#10b981' : '#ef4444'}; box-shadow: 0 0 10px ${spot.available > 0 ? '#10b981' : '#ef4444'};"></div>
                            <span style="font-size: 0.875rem; color: #9ca3af; font-weight: 500;">
                                ${spot.available > 0 ? spot.available + ' spots' : 'Full'}
                            </span>
                        </div>
                        
                        <div style="display: flex; gap: 0.5rem;">
                            <button onclick='startAppNavigation(${JSON.stringify(spot).replace(/'/g, "&#39;")})' class="btn-primary" style="background: white; color: #6366f1; box-shadow: none; padding: 0.5rem 0.75rem;">
                                <ion-icon name="navigate" style="font-size: 1.1rem;"></ion-icon>
                            </button>
                            <button onclick="reserveSpot(${spot.id}, ${spot.price})" class="btn-primary" ${spot.available < 1 ? 'disabled' : ''}>
                                Reserve
                            </button>
                        </div>
                    </div>
                </div>
            `;
            listEl.appendChild(card);
        });

        if (spots.length === 0) {
            const noSpots = document.createElement('div');
            noSpots.style.cssText = 'color: gray; text-align: center; width: 100%; padding: 20px;';
            noSpots.innerText = 'No spots found';
            listEl.appendChild(noSpots);
        }
    }

    // Toggle Sheet Logic
    window.toggleSheet = () => {
        const sheet = document.getElementById('spotsList');
        sheet.classList.toggle('expanded');
    };

    // Navigation Logic
    window.startAppNavigation = (spot) => {
        if (!userLocation) {
            alert("Please enable location services to use navigation.");
            return;
        }

        // Collapse Sheet
        document.getElementById('spotsList').classList.remove('expanded');
        // Close Booking Modal if open
        closeBookingModal();

        isNavigating = true;
        navTargetSpot = spot;

        // 1. Fetch Route
        const url = `https://router.project-osrm.org/route/v1/driving/${userLocation.lng},${userLocation.lat};${spot.lng},${spot.lat}?overview=full&geometries=geojson`;

        fetch(url)
            .then(r => r.json())
            .then(data => {
                if (data.routes && data.routes.length > 0) {
                    const route = data.routes[0];
                    drawRoute(route.geometry);

                    // Show Controls
                    document.getElementById('navTargetName').innerText = spot.name;
                    document.getElementById('navDistance').innerText = (route.distance / 1000).toFixed(1) + ' km • ' + Math.ceil(route.duration / 60) + ' min';
                    document.getElementById('navControls').classList.add('active');

                    // Zoom to fit
                    const bounds = L.geoJSON(route.geometry).getBounds();
                    map.fitBounds(bounds, { padding: [50, 50] });

                } else {
                    alert("Could not find a route.");
                }
            })
            .catch(e => {
                console.error(e);
                alert("Routing Error");
            });
    };

    window.stopNavigation = () => {
        if (currentRouteLayer) {
            map.removeLayer(currentRouteLayer);
            currentRouteLayer = null;
        }
        document.getElementById('navControls').classList.remove('active');

        isNavigating = false;
        navTargetSpot = null;
        // Return to user view
        if (userLocation) map.setView([userLocation.lat, userLocation.lng], 14);
    };

    function drawRoute(geometry) {
        if (currentRouteLayer) map.removeLayer(currentRouteLayer);

        currentRouteLayer = L.geoJSON(geometry, {
            style: {
                color: '#6366f1',
                weight: 6,
                opacity: 0.8,
                lineCap: 'round',
                lineJoin: 'round'
            }
        }).addTo(map);
    }

    // Helper: Haversine Distance
    function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
        var R = 6371; // Radius of the earth in km
        var dLat = deg2rad(lat2 - lat1);  // deg2rad below
        var dLon = deg2rad(lon2 - lon1);
        var a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        var d = R * c; // Distance in km
        return d;
    }

    function deg2rad(deg) {
        return deg * (Math.PI / 180)
    }

    // Search & Filter Logic
    let currentFilter = 'All';
    let searchTerm = '';

    function applyFilters() {
        let filtered = allSpots.filter(s => s.name.toLowerCase().includes(searchTerm));

        // Apply Sorting/Filtering based on Chip
        if (currentFilter === 'Nearby') {
            // Ensure sorted by distance (already done largely by default if loc exists, but good to enforce)
            if (userLocation) {
                filtered.sort((a, b) => (a._realDistance || 999) - (b._realDistance || 999));
            }
        } else if (currentFilter === 'Cheap') {
            filtered.sort((a, b) => a.price - b.price);
        }

        renderSpots(filtered);
    }

    // Search Input
    document.getElementById('searchInput').addEventListener('input', (e) => {
        searchTerm = e.target.value.toLowerCase();
        applyFilters();
    });

    // Filter Chips
    document.querySelectorAll('.filter-chip').forEach(btn => {
        btn.addEventListener('click', (e) => {
            // Update UI
            document.querySelectorAll('.filter-chip').forEach(b => {
                b.style.background = 'rgba(255,255,255,0.05)';
                b.style.borderColor = 'rgba(255,255,255,0.1)';
                b.style.color = '#9ca3af';
            });
            e.target.style.background = 'rgba(99,102,241,0.2)';
            e.target.style.borderColor = '#6366f1';
            e.target.style.color = 'white';

            // Update Logic
            currentFilter = e.target.dataset.val;
            applyFilters();
        });
    });

    // Modal Logic
    const bookingModal = document.getElementById('bookingModal');

    window.openBookingModal = (spotId, price) => {
        document.getElementById('bookingSpotId').value = spotId;
        document.getElementById('bookingPrice').innerText = 'GH₵ ' + price + '/hr';
        bookingModal.classList.remove('hidden');
    };

    window.closeBookingModal = () => bookingModal.classList.add('hidden');

    // Handle Reservation
    document.getElementById('bookingForm').addEventListener('submit', (e) => {
        e.preventDefault();
        console.log("Submitting booking form...");

        const formData = new FormData(e.target);
        const spotId = formData.get('spot_id');

        const bookingData = {
            user_name: formData.get('user_name'),
            user_phone: formData.get('user_phone'),
            vehicle_plate: formData.get('vehicle_plate')
        };

        if (!spotId) {
            alert("Error: Missing Spot ID");
            return;
        }

        fetch(`/api/reserve/${spotId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bookingData)
        })
            .then(async r => {
                if (!r.ok) {
                    const text = await r.text();
                    throw new Error(text || `Server Error: ${r.status}`);
                }
                return r.json();
            })
            .then(res => {
                if (res.success) {
                    closeBookingModal();

                    // Show Payment Instructions
                    const payModal = document.getElementById('paymentModal');
                    document.getElementById('payAmount').innerText = document.getElementById('bookingPrice').innerText;
                    document.getElementById('payRef').innerText = bookingData.vehicle_plate.toUpperCase();
                    payModal.classList.remove('hidden');

                    // Define finish callback
                    window.finishPayment = () => {
                        // Success State
                        const modalContent = payModal.querySelector('.glass-card');
                        modalContent.innerHTML = `
                            <div style="text-align: center; padding: 2rem 0;">
                                <div style="font-size: 3rem; color: #10b981; margin-bottom: 1rem;">
                                    <ion-icon name="checkmark-circle"></ion-icon>
                                </div>
                                <h3 style="font-size: 1.5rem; font-weight: 700; margin-bottom: 0.5rem;">Booking Confirmed!</h3>
                                <p style="color: #9ca3af; margin-bottom: 2rem;">Your spot has been secured.</p>
                                
                                <a href="/receipt/${res.transaction_id}" target="_blank" class="btn-primary" style="display: inline-flex; justify-content: center; text-decoration: none; margin-bottom: 1rem; width: 100%;">
                                    <ion-icon name="receipt"></ion-icon> Download Receipt
                                </a>
                                
                                <button onclick="location.reload()" style="background: transparent; border: 1px solid rgba(255,255,255,0.1); color: #9ca3af; padding: 0.75rem; border-radius: 0.5rem; cursor: pointer; width: 100%;">
                                    Close & Return
                                </button>
                            </div>
                        `;
                    }
                } else {
                    alert("Booking Failed: " + res.message);
                }
            })
            .catch(err => {
                console.error(err);
                alert("System Error: " + err.message);
            });
    });

    window.reserveSpot = (id, price) => { // Updated signature
        openBookingModal(id, price);
    };

    // Start App
    init();
});
