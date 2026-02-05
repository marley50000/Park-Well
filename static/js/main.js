document.addEventListener('DOMContentLoaded', () => {
    // Default: Accra
    const DEFAULT_CENTER = [5.6037, -0.1870];
    let map = L.map('map', { zoomControl: false }).setView(DEFAULT_CENTER, 13);

    // Google Maps Tiles (Standard)
    L.tileLayer('https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
        attribution: '&copy; <a href="https://www.google.com/maps">Google Maps</a>',
        maxZoom: 20,
        keepBuffer: 4,               // Keep more tiles in memory to reduce reloading
        updateWhenZooming: false,    // Wait until zoom finishes to load new tiles (prevents flickering)
        updateInterval: 100          // Delay tile update slightly to bundle requests
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
    // 1. Initialize & Watch User
    function init() {
        // Secure Context Warning
        if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
            console.warn("Geolocation API requires Secure Context (HTTPS) on non-localhost origins.");
        }

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
                        map.setView([latitude, longitude], 17); // Closer zoom for nav
                        fetchSpots(); // Initial fetch
                    }

                    // FOLLOW MODE 
                    if (isNavigating || !window.hasInteracted) {
                        map.setView([latitude, longitude], map.getZoom());
                    }

                    // --- ARRIVAL DETECTION ---
                    if (isNavigating && navTargetSpot) {
                        const distToTarget = getDistanceFromLatLonInKm(latitude, longitude, navTargetSpot.lat, navTargetSpot.lng);

                        // Update Nav Card distance if active
                        // (Optional: if we want live update on the card)
                        const distEl = document.getElementById('navDistance');
                        if (distEl) distEl.innerText = distToTarget.toFixed(2) + ' km to your spot';

                        // Threshold: 0.05 km (50 meters)
                        if (distToTarget < 0.05 && !window.hasArrived) {
                            window.hasArrived = true;
                            showArrivalWelcome(navTargetSpot);
                            // Optional: Vibrate phone
                            if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
                        }
                    }

                    // Reset any rotation just in case
                    document.getElementById('map').style.transform = 'none';
                    document.getElementById('map').style.transition = 'none';

                },
                (error) => console.error("Location Error:", error),
                { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
            );

            // NO Device Orientation Rotation - Static Map (North Up)

        } else {
            alert("Geolocation is not supported by your browser.");
            fetchSpots();
        }

        // Real-Time Updates (Socket.IO)
        const socket = io();
        socket.on('data_update', (msg) => {
            console.log("Live update:", msg);
            fetchSpots();
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

                // --- SELF-HEALING: Verify Active Session ---
                const currentSession = JSON.parse(localStorage.getItem('activeSession'));
                if (currentSession) {
                    const spotStillExists = spots.find(s => s.id == currentSession.spotId);
                    if (!spotStillExists) {
                        console.warn("Active session spot no longer exists (Deleted by Admin). Auto-clearing.");
                        // Clear Session
                        if (window.sessionInterval) clearInterval(window.sessionInterval);
                        clearInterval(window.sessionInterval);
                        const widget = document.getElementById('sessionWidget');
                        if (widget) widget.remove();
                        localStorage.removeItem('activeSession');

                        // Small non-blocking toast instead of alert to not annoy if it happens in background
                        // But for now, alert is safer to ensure they know why it vanished
                        // alert("Notice: Your active session was closed because the parking spot was removed.");
                    }
                }

                renderSpots(spots);

                // AUTO-ROUTING LOGIC
                if (userLocation && !window.hasAutoRouted && spots.length > 0) {
                    window.hasAutoRouted = true;
                    const nearest = spots.find(s => s.available > 0);
                    if (nearest) {
                        // Show visible notification or just center
                        // Let's create a non-intrusive toast
                        const toast = document.createElement('div');
                        toast.innerHTML = `
                            <div style="background: #10b981; color: white; padding: 12px 16px; border-radius: 8px; font-weight: 600; font-family: 'Inter', sans-serif; box-shadow: 0 4px 12px rgba(0,0,0,0.2); display: flex; align-items: center; gap: 8px;">
                                <ion-icon name="location"></ion-icon>
                                Nearest Spot Found: ${nearest.name}
                            </div>
                        `;
                        toast.style.cssText = "position: absolute; top: 20px; left: 50%; transform: translateX(-50%); z-index: 9999; animation: slideDown 0.5s ease-out;";
                        document.body.appendChild(toast);

                        // Auto-center and open popup
                        setTimeout(() => {
                            map.setView([nearest.lat, nearest.lng], 16);
                            if (markers[nearest.id]) markers[nearest.id].openPopup();
                            // Optional: Highlight card?
                            toast.remove();
                        }, 2500);
                    }
                }

                // Check for Deep Link (QR Code Scan)
                const urlParams = new URLSearchParams(window.location.search);
                const deepLinkSpotId = urlParams.get('spot_id');

                if (deepLinkSpotId) {
                    const spot = spots.find(s => s.id == deepLinkSpotId);
                    if (spot) {
                        // Wait a bit for map to settle
                        setTimeout(() => {
                            map.setView([spot.lat, spot.lng], 18);
                            if (markers[spot.id]) markers[spot.id].openPopup();

                            // Auto-open booking modal as requested
                            reserveSpot(spot.id, spot.price);
                        }, 500);
                    }
                }
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

        // Date Logic for Availability
        const nowLocal = new Date();
        const todayDateString = nowLocal.toISOString().split('T')[0]; // YYYY-MM-DD
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const todayDayName = days[nowLocal.getDay()];

        // --- PRIVACY & COMMITMENT LOGIC ---
        spots.forEach(spot => {
            // Check if this spot is the ACTIVELY BOOKED one
            const activeSession = JSON.parse(localStorage.getItem('activeSession'));
            const isBookedByUser = activeSession && activeSession.spotId == spot.id;

            let marker;
            let typeColor = '#6366f1';
            let typeIconName = 'car-sport';
            if (spot.vehicle_type === 'bike') { typeColor = '#f59e0b'; typeIconName = 'bicycle'; }
            if (spot.vehicle_type === 'truck') { typeColor = '#10b981'; typeIconName = 'bus'; }

            if (isBookedByUser) {
                // --- COMMITMENT MODE: EXACT PIN ---
                const iconHtml = `
                    <div style="background-color: ${typeColor}; width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2px solid white; box-shadow: 0 0 15px ${typeColor}; animation: bounce 1.5s infinite;">
                        <ion-icon name="flag" style="color: black; font-size: 1.4rem;"></ion-icon>
                    </div>`;

                const customIcon = L.divIcon({
                    className: 'custom-pin',
                    html: iconHtml,
                    iconSize: [34, 34],
                    iconAnchor: [17, 34],
                    popupAnchor: [0, -34]
                });

                marker = L.marker([spot.lat, spot.lng], { icon: customIcon }).addTo(map);
            } else {
                // --- DISCOVERY MODE: PRIVACY ZONE ---
                // Render a circle representing the "Area/Zone"
                marker = L.circle([spot.lat, spot.lng], {
                    color: typeColor,
                    fillColor: typeColor,
                    fillOpacity: 0.15,
                    radius: 120, // 120m radius fuzz
                    weight: 1,
                    dashArray: '4, 4'
                }).addTo(map);
            }

            // --- NAME PROTECTION ---
            const displayName = isBookedByUser ? spot.name : `<span style="font-style:italic; opacity:0.8;">🔒 Protected Zone</span>`;

            // Popup Content
            // Popup Content
            marker.bindPopup(`
                <div style="color: black; text-align: left; min-width: 220px; font-family: 'Inter', sans-serif; overflow: hidden; border-radius: 8px;">
                    
                    ${spot.image_url ? `
                    <div style="height: 100px; margin: -14px -20px 12px -20px; position: relative;">
                         <img src="${spot.image_url}" style="width: 100%; height: 100%; object-fit: cover;">
                         <div style="position: absolute; bottom: 0; left: 0; width: 100%; height: 40px; background: linear-gradient(to top, white, transparent);"></div>
                    </div>
                    ` : ''}

                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                        <div style="font-weight: 800; font-size: 1.1rem; line-height: 1.2;">${displayName}</div>
                        <div style="background: ${isBookedByUser ? '#d1fae5' : '#f3f4f6'}; color: ${isBookedByUser ? '#065f46' : '#6b7280'}; font-size: 0.7rem; font-weight: 700; padding: 2px 6px; border-radius: 4px; text-transform: uppercase;">
                            ${isBookedByUser ? 'UNLOCKED' : 'HIDDEN'}
                        </div>
                    </div>
                    
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px; color: #4b5563; font-size: 0.9rem;">
                         <ion-icon name="${typeIconName}"></ion-icon> 
                         <span>${spot.available} Spaces • GH₵ ${spot.price}/hr</span>
                    </div>

                    ${isBookedByUser ? `
                        <div style="margin-bottom: 12px; padding: 8px; background: #ecfdf5; border-radius: 6px; border: 1px solid #10b981; font-size: 0.8rem; color: #065f46;">
                            📍 Exact location revealed.
                        </div>
                        <button onclick="startAppNavigation({lat:${spot.lat}, lng:${spot.lng}, name:'${spot.name.replace(/'/g, "\\'")}'})" style="width: 100%; background: #10b981; color: white; border: none; padding: 10px; border-radius: 6px; font-weight: 700; cursor: pointer;">
                            NAVIGATE TO ENTRANCE
                        </button>
                    ` : `
                        <div style="margin-bottom: 12px; font-size: 0.8rem; color: #6b7280; font-style: italic;">
                            <ion-icon name="lock-closed" style="vertical-align: middle;"></ion-icon> Exact name & location hidden.
                        </div>
                        <button onclick="reserveSpot(${spot.id}, ${spot.price})" style="width: 100%; background: #000; color: white; border: none; padding: 10px; border-radius: 6px; font-weight: 700; cursor: pointer;">
                            RESERVE TO UNLOCK
                        </button>
                    `}
                </div>
            `);
            markers[spot.id] = marker;

            // External Maps Link (Fallback)
            const navUrl = `https://www.google.com/maps/dir/?api=1&destination=${spot.lat},${spot.lng}`;

            // Card Logic - Reuse vars from above if possible or new ones
            let cardLabel = 'Car';
            let cardIcon = 'car-sport';
            let cardColor = '#6366f1';

            if (spot.vehicle_type === 'bike') {
                cardLabel = 'Bike';
                cardIcon = 'bicycle';
                cardColor = '#f59e0b';
            } else if (spot.vehicle_type === 'truck') {
                cardLabel = 'Truck';
                cardIcon = 'bus';
                cardColor = '#10b981';
            }

            // Create Card
            // Create Card
            const card = document.createElement('div');
            card.className = 'spot-card-item'; // New wrapper class

            // Availability Check
            const unavailableDates = spot.unavailable_dates || [];
            const unavailableDays = spot.unavailable_days || [];
            let isUnavailable = false;

            if (unavailableDates.includes(todayDateString)) isUnavailable = true;
            if (unavailableDays.includes(todayDayName)) isUnavailable = true;

            // Availability Badge
            let availabilityColor = '#10b981';
            let availabilityText = 'Available';

            if (isUnavailable) {
                availabilityColor = '#6b7280'; // Gray
                availabilityText = 'Closed';
            } else if (spot.available === 0) {
                availabilityColor = '#ef4444';
                availabilityText = 'Full';
            } else if (spot.available < 3) {
                availabilityColor = '#f59e0b';
                availabilityText = 'Limited';
            }

            // Default Placeholder if no image (Abstract Tech Parking)
            const bgImage = spot.image_url || 'https://images.unsplash.com/photo-1573348729566-314a40a34951?q=80&w=1000&auto=format&fit=crop';

            card.innerHTML = `
                <div class="glass-card" style="padding: 1.5rem; height: 100%; display: flex; flex-direction: column; justify-content: space-between; position: relative; overflow: hidden; background: rgba(17, 24, 39, 0.85); backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.1);">
                    
                    <!-- Media Background -->
                    <div style="position: absolute; top:0; left:0; width:100%; height:140px; z-index:0;">
                        <img src="${bgImage}" 
                             onerror="this.src='https://images.unsplash.com/photo-1590674899484-d5640e854abe?q=80&w=1000&auto=format&fit=crop'"
                             style="width:100%; height:100%; object-fit: cover; opacity: 0.7; mask-image: linear-gradient(to bottom, black 30%, transparent 100%); -webkit-mask-image: linear-gradient(to bottom, black 30%, transparent 100%);">
                    </div>
                    
                    <div style="display: flex; gap: 1rem; align-items: flex-start; margin-bottom: 2rem; position: relative; z-index: 1; margin-top: 3rem;">
                        <!-- Big Icon -->
                        <div style="width: 60px; height: 60px; background: rgba(0,0,0,0.6); backdrop-filter: blur(4px); border-radius: 16px; display: flex; align-items: center; justify-content: center; color: ${cardColor}; box-shadow: 0 4px 12px rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.1);">
                            <ion-icon name="${cardIcon}" style="font-size: 2rem;"></ion-icon>
                        </div>
                        
                        <div style="flex: 1; text-shadow: 0 2px 4px rgba(0,0,0,0.8);">
                            <h3 style="font-size: 1.4rem; font-weight: 700; color: white; margin-bottom: 0.25rem; line-height: 1.1;">
                                ${spot.name}
                            </h3>
                            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 6px;">
                                ${spot.is_premium ? `
                                <div style="background: rgba(245, 158, 11, 0.2); color: #fbbf24; padding: 3px 8px; border-radius: 6px; font-size: 0.75rem; font-weight: 700; border: 1px solid rgba(245, 158, 11, 0.3); display: flex; align-items: center; gap: 4px;">
                                    SAFE <ion-icon name="shield-checkmark"></ion-icon>
                                </div>
                                ` : ''}
                                <div style="background: ${availabilityColor}15; color: ${availabilityColor}; padding: 3px 8px; border-radius: 6px; font-size: 0.75rem; font-weight: 700; border: 1px solid ${availabilityColor}30; background: rgba(0,0,0,0.4);">
                                    ${availabilityText} (${spot.available})
                                </div>
                                <span style="font-size: 0.85rem; color: #d1d5db; display: flex; align-items: center; gap: 3px;">
                                   <ion-icon name="location-outline"></ion-icon> ${spot.distance}
                                </span>
                            </div>
                            
                            <!-- Amenities Icons -->
                            <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                                ${(spot.amenities || []).map(a => {
                let icon = 'ellipse'; let color = '#9ca3af';
                if (a === 'cctv') { icon = 'shield-checkmark'; color = '#10b981'; }
                if (a === 'covered') { icon = 'umbrella'; color = '#60a5fa'; }
                if (a === 'ev') { icon = 'flash'; color = '#f59e0b'; }
                if (a === 'disability') { icon = 'accessibility'; color = '#8b5cf6'; }
                if (a === '24/7') { icon = 'time'; color = '#ec4899'; }
                return `<div title="${a}" style="background: rgba(255,255,255,0.1); padding: 4px; border-radius: 4px; display: flex; align-items: center; justify-content: center;"><ion-icon name="${icon}" style="color: ${color}; font-size: 0.9rem;"></ion-icon></div>`;
            }).join('')}
                            </div>
                        </div>

                        <div style="text-align: right; text-shadow: 0 2px 4px rgba(0,0,0,0.8);">
                             <div style="font-size: 1.5rem; font-weight: 800; color: white;">GH₵${spot.price}</div>
                             <div style="font-size: 0.75rem; color: #d1d5db;">per hour</div>
                        </div>
                    </div>

                    <!-- Action Area -->
                    <div style="display: flex; gap: 0.75rem; margin-top: auto; position: relative; z-index: 1;">
                        
                        ${isUnavailable ? `
                            <!-- UNAVAILABLE ACTION -->
                            <div style="width: 100%; display: flex; flex-direction: column; gap: 4px;">
                                <button disabled
                                    style="width: 100%; height: 52px; background: rgba(55, 65, 81, 0.5); color: #9ca3af; border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; font-weight: 700; font-size: 1.1rem; cursor: not-allowed; display: flex; align-items: center; justify-content: center; gap: 0.75rem;">
                                    UNAVAILABLE
                                    <ion-icon name="ban" style="font-size: 1.4rem;"></ion-icon>
                                </button>
                                ${spot.unavailable_reason ? `<div style="text-align: center; color: #f87171; font-size: 0.75rem; font-weight: 500;">${spot.unavailable_reason}</div>` : ''}
                            </div>
                        ` : isBookedByUser ? `
                            <!-- BOOKED ACTIONS -->
                            <a href="${bgImage}" target="_blank" 
                                style="width: 52px; height: 52px; border-radius: 12px; background: rgba(255,255,255,0.1); display: flex; align-items: center; justify-content: center; color: white; transition: 0.2s; border: 1px solid rgba(255,255,255,0.2);" title="View Image">
                                <ion-icon name="image" style="font-size: 1.5rem;"></ion-icon>
                            </a>
                            
                            <button onclick="startAppNavigation({lat:${spot.lat}, lng:${spot.lng}, name:'${spot.name.replace(/'/g, "\\'")}'})" 
                                style="flex: 1; height: 52px; background: #10b981; color: white; border: none; border-radius: 12px; font-weight: 700; font-size: 1.1rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 0.75rem; box-shadow: 0 0 20px rgba(16, 185, 129, 0.4);">
                                NAVIGATE
                                <ion-icon name="navigate-circle" style="font-size: 1.4rem;"></ion-icon>
                            </button>
                        ` : `
                            <!-- UNBOOKED ACTIONS -->
                            <div style="width: 52px; height: 52px; border-radius: 12px; background: rgba(255,255,255,0.05); display: flex; align-items: center; justify-content: center; color: white; border: 1px solid rgba(255,255,255,0.05);" title="View Location">
                                <ion-icon name="location" style="font-size: 1.5rem;"></ion-icon>
                            </div>
                            
                            <button onclick="reserveSpot(${spot.id}, ${spot.price})" 
                                style="flex: 1; height: 52px; background: linear-gradient(135deg, ${cardColor} 0%, ${cardColor}dd 100%); color: white; border: none; border-radius: 12px; font-weight: 700; font-size: 1.1rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 0.75rem; box-shadow: 0 4px 20px ${cardColor}40; transition: transform 0.2s; letter-spacing: 0.5px;">
                                BOOK SPOT
                                <ion-icon name="arrow-forward-circle" style="font-size: 1.4rem;"></ion-icon>
                            </button>
                        `}
                    </div>
                </div>`;
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

    function getTrustBadgeHTML(level) {
        if (level === 1) return '<span style="display:inline-block; vertical-align:middle; background: rgba(251, 191, 36, 0.2); color: #fbbf24; padding: 1px 4px; border-radius: 4px; font-size: 0.65rem; font-weight: 700; border: 1px solid rgba(251, 191, 36, 0.3); margin-left: 6px;">GOLD <ion-icon name="checkmark-circle"></ion-icon></span>';
        if (level === 2) return '<span style="display:inline-block; vertical-align:middle; background: rgba(148, 163, 184, 0.2); color: #94a3b8; padding: 1px 4px; border-radius: 4px; font-size: 0.65rem; font-weight: 700; border: 1px solid rgba(148, 163, 184, 0.3); margin-left: 6px;">SILVER <ion-icon name="shield-checkmark"></ion-icon></span>';
        return '';
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
        } else if (currentFilter === 'Premium') {
            filtered = filtered.filter(s => s.is_premium);
        } else if (currentFilter === 'Bike') {
            filtered = filtered.filter(s => s.vehicle_type === 'bike');
        } else if (currentFilter === 'Truck') {
            filtered = filtered.filter(s => s.vehicle_type === 'truck');
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
            activateFilter(e.target);
        });
    });

    function activateFilter(targetBlock) {
        // Reset UI
        document.querySelectorAll('.filter-chip').forEach(b => {
            b.style.background = 'rgba(255,255,255,0.05)';
            b.style.borderColor = 'rgba(255,255,255,0.1)';
            b.style.color = '#9ca3af';
        });
        // Activate Target
        targetBlock.style.background = 'rgba(99,102,241,0.2)';
        targetBlock.style.borderColor = '#6366f1';
        targetBlock.style.color = 'white';

        currentFilter = targetBlock.dataset.val;
        applyFilters();
    }

    // --- VOICE AI LOGIC ---
    let recognition = null;

    window.startVoiceSearch = () => {
        if (!('webkitSpeechRecognition' in window)) {
            alert("Voice search not supported. Try using Google Chrome.");
            return;
        }

        // Stop any previous instance
        if (recognition) {
            recognition.abort();
            recognition = null;
        }

        recognition = new webkitSpeechRecognition();
        recognition.lang = 'en-US';
        recognition.interimResults = false;
        recognition.maxAlternatives = 5; // Reduced from 10 used to save bandwidth

        const micBtn = document.getElementById('voiceBtn');
        const searchInput = document.getElementById('searchInput');

        try {
            recognition.start();
            micBtn.style.color = '#ef4444';
            micBtn.style.transform = 'scale(1.2)';
            searchInput.placeholder = "Listening...";
        } catch (e) {
            console.error("Mic start error", e);
        }

        recognition.onresult = (event) => {
            const results = event.results[0];
            let command = results[0].transcript.toLowerCase();

            // --- SMART CONVERSATIONAL LOGIC ---

            const bikeKeywords = ['bike', 'motor', 'cycle', 'scooter', 'moped', 'two wheel', 'bicycles'];
            const truckKeywords = ['truck', 'bus', 'van', 'lorry', 'trailer', 'heavy', 'large', 'big'];
            const cheapKeywords = ['cheap', 'low', 'budget', 'affordable', 'least', 'price', 'economy'];
            const carKeywords = ['car', 'auto', 'sedan', 'suv', 'taxi', 'vehicle', 'reset', 'clear'];

            let detectedFilter = 'All';

            // 1. Pick the best alternative that matches a keyword (if any)
            // If the user said "Find bike", but top result is "Find Mike", we want to switch 'command' to "Find bike"
            for (let i = 0; i < results.length; i++) {
                const alt = results[i].transcript.toLowerCase();
                if ([...bikeKeywords, ...truckKeywords, ...cheapKeywords, ...carKeywords].some(k => alt.includes(k))) {
                    command = alt;
                    break;
                }
            }

            // 2. Detect Filter from final Command
            if (bikeKeywords.some(k => command.includes(k))) detectedFilter = 'Bike';
            else if (truckKeywords.some(k => command.includes(k))) detectedFilter = 'Truck';
            else if (cheapKeywords.some(k => command.includes(k))) detectedFilter = 'Cheap';

            // 3. Activate Filter UI
            if (detectedFilter !== 'All') {
                const btn = document.querySelector(`.filter-chip[data-val="${detectedFilter}"]`);
                if (btn) activateFilter(btn);
            } else {
                if (carKeywords.some(k => command.includes(k))) {
                    const btn = document.querySelector('.filter-chip[data-val="All"]');
                    if (btn) activateFilter(btn);
                }
            }

            // 4. Extract "Search Intent" (Location/Name)
            // Remove the detected category keywords AND filler words to find the "place"
            let cleanText = command;
            const fillers = ['find', 'show me', 'show', 'search', 'looking for', 'i want', 'parking', 'spot', 'place', ' me ', ' a ', ' the ', ' in ', ' at ', 'near', 'please'];

            fillers.forEach(f => cleanText = cleanText.replace(f, ' '));

            if (detectedFilter === 'Bike') bikeKeywords.forEach(k => cleanText = cleanText.replace(k, ' '));
            if (detectedFilter === 'Truck') truckKeywords.forEach(k => cleanText = cleanText.replace(k, ' '));
            if (detectedFilter === 'Cheap') cheapKeywords.forEach(k => cleanText = cleanText.replace(k, ' '));
            carKeywords.forEach(k => cleanText = cleanText.replace(k, ' '));

            cleanText = cleanText.replace(/\s+/g, ' ').trim(); // Collapse spaces

            console.log("Voice:", command, "-> Filter:", detectedFilter, "-> Search:", cleanText);

            // 5. Apply Search
            if (cleanText.length > 2) {
                searchInput.value = cleanText;
                searchTerm = cleanText;
            } else {
                searchInput.value = ""; // Just a category command, clear text
                searchTerm = "";
            }

            applyFilters();
            resetMicUI();
        };

        recognition.onspeechend = () => {
            recognition.stop();
            resetMicUI();
        };

        recognition.onerror = (event) => {
            console.error("Speech Error:", event.error);
            resetMicUI();

            if (event.error === 'network') {
                searchInput.value = "";
                searchInput.placeholder = "Offline/Network Error. Type instead.";
            } else if (event.error === 'not-allowed') {
                alert("Microphone access blocked. Please allow permissions.");
            }
        };

        function resetMicUI() {
            micBtn.style.color = '#6366f1';
            micBtn.style.transform = 'scale(1)';
            // Keep the placeholder or value logic clean
            if (searchInput.placeholder === "Listening...") {
                searchInput.placeholder = "Search or say 'Find Bike'...";
            }
        }
    };

    // --- WALLET SYSTEM ---
    const DEPOSIT_AMOUNT = 20.00; // Advance Hold
    let realUserBalance = 0.0;

    function initWallet() {
        console.log("Fetching real wallet balance...");
        fetch('/api/user/profile')
            .then(r => r.json())
            .then(user => {
                realUserBalance = user.wallet_balance || 0.0;
                updateWalletUI(realUserBalance);
            })
            .catch(err => {
                console.error("Wallet fetch error", err);
                // Fallback to local if offline? No, strictly server now.
                updateWalletUI(0.00);
            });
    }

    function updateWalletUI(balance) {
        const el = document.getElementById('userWallet');
        if (el) el.innerText = 'GH₵ ' + parseFloat(balance).toFixed(2);
    }

    // Modal Logic
    const bookingModal = document.getElementById('bookingModal');
    let currentSpotRate = 0;

    window.openBookingModal = (spotId, price) => {
        document.getElementById('bookingSpotId').value = spotId;
        currentSpotRate = price;
        updateBookingPrice(); // Init with 1 hour
        bookingModal.classList.remove('hidden');

        // Refresh balance when opening modal to be sure
        initWallet();
    };

    window.updateBookingPrice = () => {
        let duration = 1;
        const selectVal = document.getElementById('bookingDuration').value;

        if (selectVal === 'custom') {
            const customVal = document.getElementById('customDurationInput').value;
            duration = customVal ? parseInt(customVal) : 0;
        } else {
            duration = parseInt(selectVal);
        }

        const total = (currentSpotRate * duration).toFixed(2);

        // Show Breakdown: Base + Deposit
        const toPay = parseFloat(total) + DEPOSIT_AMOUNT;

        const priceEl = document.getElementById('bookingPrice');
        if (priceEl) {
            priceEl.innerHTML = `
                <div style="text-align:right">
                    <div>GH₵ ${total}</div>
                    <div style="font-size:0.7rem; color:#9ca3af; font-weight:400;">+ GH₵ ${DEPOSIT_AMOUNT.toFixed(2)} Hold</div>
                    <div style="font-size:0.8rem; color:#fbbf24; border-top:1px solid rgba(255,255,255,0.1); margin-top:2px; padding-top:2px;">Total: GH₵ ${toPay.toFixed(2)}</div>
                </div>
            `;
        }
    };

    window.toggleCustomDuration = () => {
        const select = document.getElementById('bookingDuration');
        const customInput = document.getElementById('customDurationInput');

        if (select.value === 'custom') {
            customInput.classList.remove('hidden');
            customInput.focus();
            updateBookingPrice();
        } else {
            customInput.classList.add('hidden');
            updateBookingPrice();
        }
    };

    window.closeBookingModal = () => bookingModal.classList.add('hidden');

    // Handle Reservation
    document.getElementById('bookingForm').addEventListener('submit', async (e) => {
        e.preventDefault();

        const formData = new FormData(e.target);
        const spotId = formData.get('spot_id');

        let duration = 0;
        if (document.getElementById('bookingDuration').value === 'custom') {
            duration = parseInt(formData.get('custom_duration'));
        } else {
            duration = parseInt(formData.get('duration_select'));
        }

        if (!duration || duration <= 0) {
            alert("Please enter a valid duration.");
            return;
        }

        const baseAmount = currentSpotRate * duration;
        const totalCharge = baseAmount + DEPOSIT_AMOUNT;

        // Ensure we have the latest balance before deciding
        try {
            const res = await fetch('/api/user/profile');
            const data = await res.json();
            realUserBalance = data.wallet_balance || 0.0;
            updateWalletUI(realUserBalance);
        } catch (err) { console.error(err); }

        const bookingData = {
            user_name: formData.get('user_name'),
            user_phone: formData.get('user_phone'),
            vehicle_plate: formData.get('vehicle_plate'),
            duration: duration,
            amount: baseAmount
        };

        if (!spotId) {
            alert("Error: Missing Spot ID");
            return;
        }

        // --- PAYMENT SELECTION LOGIC ---
        let useWallet = false;

        if (realUserBalance >= totalCharge) {
            // Offer Wallet Payment
            if (confirm(`Pay GH₵ ${totalCharge.toFixed(2)} using your Wallet?\n\nCurrent Balance: GH₵ ${realUserBalance.toFixed(2)}`)) {
                useWallet = true;
            }
        } else {
            // Note: Could alert here that they need to top up or just fall through to card
            // console.log("Insufficient wallet for full charge, falling back to Paystack");
        }

        if (useWallet) {
            // --- WALLET PAYMENT FLOW ---
            bookingData.payment_method = 'wallet';

            fetch(`/api/reserve/${spotId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bookingData)
            })
                .then(r => r.json())
                .then(res => {
                    if (res.success) {
                        closeBookingModal();

                        // Update UI immediately
                        if (res.new_balance !== undefined) {
                            realUserBalance = res.new_balance;
                            updateWalletUI(realUserBalance);
                        } else {
                            // Fallback manual update
                            initWallet();
                        }

                        alert(`✅ WALLET PAYMENT SUCCESSFUL!\n\nReference: ${res.transaction_id || 'WAL-' + Date.now()}`);

                        // Trigger Success Logic (Session Start)
                        startSessionSuccess(spotId, duration, bookingData.vehicle_plate, res.transaction_id || 'WALLET', DEPOSIT_AMOUNT);

                    } else {
                        alert("Wallet Payment Failed: " + res.message);
                    }
                })
                .catch(err => alert("System Error: " + err.message));

            return; // EXIT HERE
        }

        // --- PAYSTACK PAYMENT FLOW (Fallback) ---
        const paystackKey = window.PAYSTACK_PUBLIC_KEY;
        if (!paystackKey || paystackKey.includes('placeholder')) {
            alert("Configuration Error: Paystack Public Key not set.");
            return;
        }

        const handler = PaystackPop.setup({
            key: paystackKey,
            email: window.USER_EMAIL || "guest@parkwell.com",
            amount: Math.ceil(totalCharge * 100), // Amount in kobo
            currency: 'GHS', // Adjust if needed
            metadata: {
                custom_fields: [
                    { display_name: "Spot ID", variable_name: "spot_id", value: spotId },
                    { display_name: "Plate", variable_name: "plate", value: bookingData.vehicle_plate }
                ]
            },
            callback: function (response) {
                console.log("Paystack Success:", response);

                // Add reference to payload
                bookingData.payment_reference = response.reference;
                bookingData.payment_method = 'paystack';

                // Call Backend
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
                            alert(`✅ Reservation Confirmed!\n\nReference: ${response.reference}`);

                            // Trigger Success Logic
                            startSessionSuccess(spotId, duration, bookingData.vehicle_plate, response.reference, DEPOSIT_AMOUNT);

                        } else {
                            alert("Booking Failed: " + res.message);
                        }
                    })
                    .catch(err => {
                        console.error(err);
                        alert("System Error: " + err.message);
                    });
            },
            onClose: function () {
                alert('Transaction was not completed.');
            }
        });

        handler.openIframe();
    });

    // Separated Success Logic to avoid duplication
    function startSessionSuccess(spotId, duration, plate, ref, depositInfo) {
        // 1. SAVE SESSION DATA
        // We need to find the spot object again (inefficient but safe)
        fetch('/api/spots').then(r => r.json()).then(latestSpots => {
            const parkedSpot = latestSpots.find(s => s.id == spotId);
            const startTime = Date.now();
            const expiryTime = startTime + (duration * 60 * 60 * 1000);

            const sessionData = {
                depositHeld: depositInfo,
                spotId: spotId,
                lat: parkedSpot ? parkedSpot.lat : 0,
                lng: parkedSpot ? parkedSpot.lng : 0,
                name: parkedSpot ? parkedSpot.name : 'Unknown Spot',
                startTime: startTime,
                expiryTime: expiryTime,
                plate: plate,
                paymentRef: ref
            };

            localStorage.setItem('activeSession', JSON.stringify(sessionData));

            // 3. Start Enforcer
            startSessionMonitor();

            // 4. AUTO-START NAVIGATION
            if (parkedSpot) {
                // Refresh Map UI to show "Booked" icon
                renderSpots(latestSpots);

                startAppNavigation({
                    lat: parkedSpot.lat,
                    lng: parkedSpot.lng,
                    name: parkedSpot.name
                });
            }
        });
    }

    window.reserveSpot = (id, price) => {
        openBookingModal(id, price);
    };

    // --- ENFORCEMENT SYSTEM (Silent but Deadly) ---
    function startSessionMonitor() {
        const session = JSON.parse(localStorage.getItem('activeSession'));
        if (!session) return;

        // Create/Update UI Widget
        let widget = document.getElementById('sessionWidget');
        if (!widget) {
            widget = document.createElement('div');
            widget.id = 'sessionWidget';
            widget.className = 'glass-card';
            widget.style.cssText = 'position: fixed; bottom: 1.5rem; left: 50%; transform: translateX(-50%); width: 90%; max-width: 400px; z-index: 2000; padding: 1.5rem; border: 1px solid rgba(99, 102, 241, 0.5); box-shadow: 0 10px 40px rgba(0,0,0,0.5); animation: slideUp 0.5s ease-out;';
            document.body.appendChild(widget);
        }

        // Update Loop
        if (window.sessionInterval) clearInterval(window.sessionInterval);

        window.sessionInterval = setInterval(() => {
            const now = Date.now();
            const timeLeft = session.expiryTime - now;

            // Overtime Logic
            let isOvertime = timeLeft < 0;
            let statusHTML = '';
            let actionBtn = '';

            if (!isOvertime) {
                // NORMAL TIME
                const minutesLeft = Math.ceil(timeLeft / 60000);
                const hours = Math.floor(minutesLeft / 60);
                const mins = minutesLeft % 60;

                let color = '#10b981'; // Green
                if (minutesLeft < 15) color = '#f59e0b'; // Warn
                if (minutesLeft < 5) color = '#ef4444'; // Critical

                statusHTML = `
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
                        <span style="color:#9ca3af; font-size:0.8rem;">Session Active • ${session.plate}</span>
                        <div style="background:${color}; color:#000; font-weight:800; padding:2px 8px; border-radius:4px; font-size:0.75rem;">LIVE</div>
                    </div>
                    <div style="font-size:2rem; font-weight:800; color:white; font-variant-numeric: tabular-nums;">
                         ${hours}h ${mins}m <span style="font-size:1rem; color:#6b7280;">remaining</span>
                    </div>
                    <div style="font-size:0.8rem; color:#9ca3af;">${session.name}</div>
                `;
            } else {
                // OVERTIME (The "Deadly" Part)
                const overtimeMs = Math.abs(timeLeft);
                const overtimeMins = Math.ceil(overtimeMs / 60000);

                // Pricing Model: 1st 30m = GHS 8, Next 30m = GHS 12
                // Simplified: GHS 8 base + GHS 0.5 per minute after 30
                let penalty = 0;
                if (overtimeMins <= 30) penalty = 8;
                else penalty = 8 + ((overtimeMins - 30) * 0.5); // Accrue fast!

                statusHTML = `
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
                        <span style="color:#ef4444; font-weight:700; font-size:0.9rem;">⚠️ OVERTIME ACTIVE</span>
                        <div style="background:#ef4444; color:white; font-weight:800; padding:2px 8px; border-radius:4px; font-size:0.75rem;">FINE ACCRUING</div>
                    </div>
                    <div style="font-size:2rem; font-weight:800; color:#ef4444; font-variant-numeric: tabular-nums;">
                         +${overtimeMins}m <span style="font-size:1rem; color:#9ca3af;">overdue</span>
                    </div>
                    <div style="margin-top:0.5rem; padding:0.5rem; background:rgba(239,68,68,0.1); border:1px solid #ef4444; border-radius:6px; color:#fca5a5; font-weight:700;">
                        Current Penalty: GH₵ ${penalty.toFixed(2)}
                    </div>
                `;
            }

            widget.innerHTML = `
                ${statusHTML}
                <button onclick="checkoutSession()" style="width:100%; margin-top:1rem; background:white; color:black; font-weight:800; padding:12px; border-radius:8px; border:none; cursor:pointer;">
                    I HAVE LEFT THE SPOT (CHECKOUT)
                </button>
            `;

        }, 1000);
    }

    // 4. CHECKOUT (GPS Location Proof + Refund)
    window.checkoutSession = () => {
        if (!confirm("Are you sure you have left the parking spot? We will verify your location.")) return;

        const session = JSON.parse(localStorage.getItem('activeSession'));
        if (!session) return;

        // Use userLocation from main scope
        if (!userLocation) {
            alert("GPS Signal Lost. Cannot verify departure. Please move to an open area.");
            return;
        }

        const dist = getDistanceFromLatLonInKm(userLocation.lat, userLocation.lng, session.lat, session.lng);
        const distMeters = dist * 1000;

        // MUST be at least 100m away to prove they left
        if (distMeters < 50) { // 50m tolerance
            alert(`❌ CHECKOUT REJECTED\n\nYou are still ${Math.round(distMeters)}m from the spot.\nPlease drive away before ending the session to avoid penalties.`);
            return;
        }

        // --- REFUND CALCULATION ---
        const now = Date.now();
        const timeLeft = session.expiryTime - now;
        let deposit = session.depositHeld || 0;
        let refund = 0;
        let penalty = 0;
        let message = "";

        if (timeLeft >= 0) {
            // No Overtime -> Full Refund
            refund = deposit;
            message = `✅ ON TIME! Full Deposit Refunded: GH₵ ${refund.toFixed(2)}`;
        } else {
            // Overtime
            const overtimeMins = Math.ceil(Math.abs(timeLeft) / 60000);

            // Penalty: Base 8 + 0.5/min after 30
            if (overtimeMins <= 30) penalty = 8;
            else penalty = 8 + ((overtimeMins - 30) * 0.5);

            if (deposit >= penalty) {
                refund = deposit - penalty;
                const paidFine = penalty;
                message = `⚠️ OVERTIME (${overtimeMins}m)\nFine Deducted: GH₵ ${paidFine.toFixed(2)}\nRefund: GH₵ ${refund.toFixed(2)}`;
            } else {
                refund = 0;
                const extraOwed = penalty - deposit;
                message = `❌ MAJOR OVERSTAY (${overtimeMins}m)\nFine: GH₵ ${penalty.toFixed(2)}\nDeposit Used Full. You owe GH₵ ${extraOwed.toFixed(2)} (Added to Debt)`;
            }
        }

        // Update Wallet
        let wallet = parseFloat(localStorage.getItem('userWalletBalance'));
        if (isNaN(wallet)) wallet = 0;
        wallet += refund;
        localStorage.setItem('userWalletBalance', wallet);
        updateWalletUI(wallet);

        // Success Cleanup
        clearInterval(window.sessionInterval);
        document.getElementById('sessionWidget').remove();
        localStorage.removeItem('activeSession');

        alert(`SESSION CLOSED\n\nCheckout confirmed. You are ${Math.round(distMeters)}m away.\n\n${message}\n\nNew Wallet Balance: GH₵ ${wallet.toFixed(2)}`);

        // In real app, send API call to /api/checkout to free the spot
    };

    // Start App
    init();
    initWallet();
    startSessionMonitor(); // specific check on load

    // --- ADMIN CANCELLATION LISTENER ---
    const socket = io(); // Ensure we have socket instance or reuse existing if possible
    socket.on('force_end_session', (data) => {
        const session = JSON.parse(localStorage.getItem('activeSession'));
        if (session && session.spotId == data.spot_id) {
            console.log("Session forcefully ended by Admin");

            // Clear Session
            clearInterval(window.sessionInterval);
            const widget = document.getElementById('sessionWidget');
            if (widget) widget.remove();
            localStorage.removeItem('activeSession');

            // Find current spot and refresh UI if needed (force fetch)
            fetchSpots();

            // Alert User
            alert("⚠️ " + (data.message || "Your session has been cancelled by the Admin."));
        }
    });
});

// Removed old checkParkedCar/findMyCar logic as it overlaps with new session logic or kept separate? 
// Keeping findMyCar separate for now as it's useful.

function checkParkedCar() {
    const saved = localStorage.getItem('parkedCar');
    let btn = document.getElementById('myCarBtn');

    if (saved) {
        if (!btn) {
            btn = document.createElement('button');
            btn.id = 'myCarBtn';
            btn.className = 'btn-primary';
            btn.style.cssText = 'position: fixed; bottom: 100px; right: 20px; z-index: 1000; box-shadow: 0 4px 15px rgba(99,102,241,0.5); border-radius: 99px; padding: 12px 24px; font-weight: 700; animate: bounceIn 0.5s;';
            btn.innerHTML = '<ion-icon name="navigate-circle" style="margin-right: 8px; font-size: 1.2rem;"></ion-icon> Find My Vehicle';
            btn.onclick = window.findMyCar;
            document.body.appendChild(btn);
        }
    } else {
        if (btn) btn.remove();
    }
}

window.findMyCar = () => {
    const saved = JSON.parse(localStorage.getItem('parkedCar'));
    if (!saved) return;

    // Use existing nav logic but targeting the return trip
    const dummySpot = {
        lat: saved.lat,
        lng: saved.lng,
        name: "My Vehicle (" + saved.name + ")",
        price: 0,
        available: 1
    };

    // Reuse startAppNavigation
    startAppNavigation(dummySpot);

    // Optionally clear it after arrival? Or keep until manually cleared
    if (confirm("Have you reached your vehicle? Click OK to clear this saved spot.")) {
        localStorage.removeItem('parkedCar');
        checkParkedCar();
    }
};

// --- ARRIVAL WELCOME LOGIC ---
window.showArrivalWelcome = (spot) => {
    // Prevent duplicates
    if (document.getElementById('arrivalOverlay')) return;

    // Stop Navigation updates (but keep view)
    // We don't call stopNavigation() immediately because it clears the route line which looks nice.
    // Instead we just stop the updates.
    window.isNavigating = false;
    window.navTargetSpot = null;
    document.getElementById('navControls').classList.remove('active');

    const overlay = document.createElement('div');
    overlay.id = 'arrivalOverlay';
    overlay.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.85); backdrop-filter: blur(10px);
        z-index: 9999; display: flex; flex-direction: column; align-items: center; justify-content: center;
        animation: fadeIn 0.5s ease-out;
    `;

    overlay.innerHTML = `
        <div style="background: linear-gradient(135deg, #1f2937, #111827); border: 1px solid rgba(255,255,255,0.1); padding: 2rem; border-radius: 24px; text-align: center; max-width: 90%; width: 350px; box-shadow: 0 0 50px rgba(99,102,241,0.5); transform: scale(0.9); animation: popIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;">
            
            <div style="width: 80px; height: 80px; background: #10b981; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 1.5rem; box-shadow: 0 0 20px rgba(16,185,129,0.5);">
                <ion-icon name="checkmark-circle" style="font-size: 3rem; color: white;"></ion-icon>
            </div>

            <h2 style="font-size: 1.8rem; font-weight: 800; color: white; margin-bottom: 0.5rem;">You have arrived!</h2>
            <p style="color: #9ca3af; font-size: 1rem; margin-bottom: 2rem;">Welcome to <span style="color: #10b981; font-weight: 700;">${spot.name}</span>.</p>

            <div style="display: flex; gap: 1rem; flex-direction: column;">
                <button onclick="dismissArrival()" style="background: #6366f1; color: white; border: none; padding: 1rem; border-radius: 12px; font-weight: 700; font-size: 1.1rem; cursor: pointer; box-shadow: 0 4px 15px rgba(99,102,241,0.4);">
                    Awesome, I'm here!
                </button>
            </div>
        </div>
        
        <style>
            @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
            @keyframes popIn { from { transform: scale(0.8); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        </style>
    `;

    document.body.appendChild(overlay);
};

window.dismissArrival = () => {
    const el = document.getElementById('arrivalOverlay');
    if (el) {
        el.style.opacity = '0';
        setTimeout(() => el.remove(), 500);
    }
    // Clean up route line
    if (currentRouteLayer) {
        map.removeLayer(currentRouteLayer);
        currentRouteLayer = null;
    }
    window.hasArrived = false;
};
