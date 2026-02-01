// --- Global State ---
window.currentSpots = {};
let revenueChart = null;

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    // Initial Load
    loadSpots();
    loadAnalytics();

    // Safely init chart
    try {
        initChart();
    } catch (e) {
        console.warn("Chart failed to initialize (DOM element missing?):", e);
    }

    // Auto-refresh every 5 seconds
    setInterval(() => {
        loadSpots();
        loadAnalytics();
    }, 5000);

    // --- Event Listeners (that need DOM) ---
    const addForm = document.getElementById('addForm');
    if (addForm) {
        addForm.addEventListener('submit', handleAddSubmit);
    }

    const editForm = document.getElementById('editForm');
    if (editForm) {
        editForm.addEventListener('submit', handleEditSubmit);
    }
});

// --- Core Functions ---

function loadSpots() {
    fetch('/api/spots')
        .then(r => r.json())
        .then(spots => {
            const el = document.getElementById('totalSpots');
            if (el) el.innerText = spots.length;

            // Update global store
            window.currentSpots = spots.reduce((acc, spot) => {
                acc[spot.id] = spot;
                return acc;
            }, {});

            renderList(spots);
        })
        .catch(err => console.error("Failed to load spots:", err));
}

function loadAnalytics() {
    fetch('/api/analytics')
        .then(r => r.json())
        .then(data => {
            // Update Key Metrics
            const revenueEl = document.getElementById('totalRevenue');
            if (revenueEl) revenueEl.innerText = 'GH₵ ' + (data.revenue || 0).toLocaleString();

            const bookingsEl = document.getElementById('totalBookings');
            if (bookingsEl) bookingsEl.innerText = (data.total_bookings || 0);

            // Update Chart if ready
            if (revenueChart && revenueChart.data && revenueChart.data.datasets) {
                // Simulate live data update effect just for visuals
                // In production, map real timestamps
                revenueChart.update('none');
            }

            // Render Recent Activity
            const activityList = document.getElementById('activityList');
            if (!activityList) return;

            activityList.innerHTML = '';

            if (data.recent_activity.length === 0) {
                activityList.innerHTML = '<div style="text-align:center; padding: 1rem; color: #6b7280;">No recent activity</div>';
            }

            data.recent_activity.forEach(txn => {
                const timeString = new Date(txn.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const div = document.createElement('div');
                div.className = 'glass-card';
                div.style.padding = '0.75rem';
                div.style.marginBottom = '0.5rem';
                div.style.display = 'flex';
                div.style.justifyContent = 'space-between';
                div.style.alignItems = 'center';

                div.innerHTML = `
                    <div style="display: flex; gap: 0.75rem; align-items: center;">
                        <div style="width: 8px; height: 8px; background: #10b981; border-radius: 50%; box-shadow: 0 0 8px #10b981;"></div>
                        <div>
                            <div style="font-weight: 700; font-size: 0.9rem;">${txn.user_name}</div>
                            <div style="font-size: 0.75rem; color: #9ca3af;">${txn.spot_name} • ${timeString}</div>
                        </div>
                    </div>
                    <div style="background: rgba(16,185,129,0.1); color: #10b981; padding: 2px 8px; border-radius: 4px; font-weight: 700; font-size: 0.8rem; margin-right: 0.5rem;">
                        + GH₵ ${txn.price}
                    </div>
                    <a href="/receipt/${txn.id}" target="_blank" style="color: #9ca3af; text-decoration: none; display: flex; align-items: center;" title="Download Receipt">
                        <ion-icon name="download-outline"></ion-icon>
                    </a>
                `;
                activityList.appendChild(div);
            });
        });
}

function renderList(spots) {
    const list = document.getElementById('dashboardList');
    if (!list) return;

    list.innerHTML = '';
    spots.forEach(spot => {
        const item = document.createElement('div');
        item.className = 'glass-card';
        item.style.display = 'flex';
        item.style.justifyContent = 'space-between';
        item.style.padding = '1rem';
        item.innerHTML = `
            <div style="display: flex; gap: 1rem; align-items: center;">
                <div style="width: 40px; height: 40px; background: rgba(99,102,241,0.2); border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #6366f1;">
                    <ion-icon name="car-sport"></ion-icon>
                </div>
                <div>
                    <h4 style="font-weight: 700;">${spot.name}</h4>
                    <div style="color: #9ca3af; font-size: 0.875rem;">
                        GH₵ ${spot.price}/hr • ${spot.available} spots
                    </div>
                </div>
            </div>
            <div style="display: flex; gap: 0.5rem;">
                 <button onclick='openEditModal(${spot.id})' style="background: rgba(99,102,241,0.1); color: #6366f1; border: none; width: 36px; height: 36px; border-radius: 8px; display: flex; align-items: center; justify-content: center;">
                    <ion-icon name="create"></ion-icon>
                </button>
                <button onclick="deleteSpot(${spot.id})" style="background: rgba(239,68,68,0.1); color: #ef4444; border: none; width: 36px; height: 36px; border-radius: 8px; display: flex; align-items: center; justify-content: center;">
                    <ion-icon name="trash"></ion-icon>
                </button>
            </div>
        `;
        list.appendChild(item);
    });
}

function initChart() {
    const canvas = document.getElementById('revenueChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    // Gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(99, 102, 241, 0.5)'); // Primary color
    gradient.addColorStop(1, 'rgba(99, 102, 241, 0.0)');

    revenueChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00'],
            datasets: [{
                label: 'Revenue (GHC)',
                data: [120, 190, 150, 250, 220, 300], // Mock start data
                borderColor: '#6366f1',
                backgroundColor: gradient,
                borderWidth: 3,
                pointBackgroundColor: '#030712',
                pointBorderColor: '#6366f1',
                pointBorderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: 'rgba(3, 7, 18, 0.9)',
                    titleColor: '#f9fafb',
                    bodyColor: '#9ca3af',
                    borderColor: 'rgba(255,255,255,0.1)',
                    borderWidth: 1,
                    padding: 10,
                    displayColors: false,
                }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)', drawBorder: false },
                    ticks: { color: '#9ca3af' }
                },
                y: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)', drawBorder: false },
                    ticks: {
                        color: '#9ca3af',
                        callback: function (value) { return 'GH₵ ' + value; }
                    },
                    beginAtZero: true
                }
            },
            interaction: { intersect: false, mode: 'index' },
        }
    });
}

// --- Map Logic ---
let addMap, editMap;
let addMarker, editMarker;

function initMap(elementId, latInputId, lngInputId, isEdit = false) {
    // Default Accra Center
    const defaultLat = 5.6037;
    const defaultLng = -0.1870;

    const mapInstance = L.map(elementId).setView([defaultLat, defaultLng], 13);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
        subdomains: 'abcd',
        maxZoom: 19
    }).addTo(mapInstance);

    const marker = L.marker([defaultLat, defaultLng], { draggable: true }).addTo(mapInstance);

    // Map Click -> Update Marker & Inputs
    mapInstance.on('click', (e) => {
        const { lat, lng } = e.latlng;
        marker.setLatLng([lat, lng]);
        document.getElementById(latInputId).value = lat.toFixed(6);
        document.getElementById(lngInputId).value = lng.toFixed(6);
    });

    // Marker Drag -> Update Inputs
    marker.on('dragend', (e) => {
        const { lat, lng } = marker.getLatLng();
        document.getElementById(latInputId).value = lat.toFixed(6);
        document.getElementById(lngInputId).value = lng.toFixed(6);
    });

    return { map: mapInstance, marker };
}


// --- Global Handlers ---

window.openModal = () => {
    const modal = document.getElementById('addModal');
    if (modal) modal.classList.remove('hidden');

    // Init Map if needed
    if (!addMap) {
        // Wait for modal transition a tiny bit or just run immediately if no transition
        setTimeout(() => {
            const res = initMap('addMap', 'addLat', 'addLng');
            addMap = res.map;
            addMarker = res.marker;
        }, 100);
    } else {
        setTimeout(() => {
            addMap.invalidateSize();
            // Reset to defaults or current location?
            // Let's reset to center if inputs are empty
            addMap.setView([5.6037, -0.1870], 13);
            addMarker.setLatLng([5.6037, -0.1870]);
        }, 100);
    }
};

window.closeModal = () => {
    const modal = document.getElementById('addModal');
    if (modal) modal.classList.add('hidden');
};

window.openEditModal = (spotId) => {
    const spot = window.currentSpots[spotId];
    if (!spot) return alert('Spot data not found! Please refresh.');

    const editModal = document.getElementById('editModal');
    if (!editModal) return;

    document.getElementById('editId').value = spot.id;
    document.getElementById('editName').value = spot.name;
    document.getElementById('editPrice').value = spot.price;
    document.getElementById('editAvailable').value = spot.available;
    document.getElementById('editLat').value = spot.lat;
    document.getElementById('editLng').value = spot.lng;
    editModal.classList.remove('hidden');

    // Init or Update Map
    if (!editMap) {
        setTimeout(() => {
            const res = initMap('editMap', 'editLat', 'editLng', true);
            editMap = res.map;
            editMarker = res.marker;

            // Set initial position
            const lat = parseFloat(spot.lat);
            const lng = parseFloat(spot.lng);
            if (!isNaN(lat) && !isNaN(lng)) {
                editMap.setView([lat, lng], 15);
                editMarker.setLatLng([lat, lng]);
            }
        }, 100);
    } else {
        setTimeout(() => {
            editMap.invalidateSize();
            const lat = parseFloat(spot.lat);
            const lng = parseFloat(spot.lng);
            if (!isNaN(lat) && !isNaN(lng)) {
                editMap.setView([lat, lng], 15);
                editMarker.setLatLng([lat, lng]);
            }
        }, 100);
    }
};

window.closeEditModal = () => {
    const editModal = document.getElementById('editModal');
    if (editModal) editModal.classList.add('hidden');
};

window.deleteSpot = (id) => {
    if (!confirm('Are you sure you want to delete this location?')) return;

    fetch(`/api/spots/${id}`, { method: 'DELETE' })
        .then(r => {
            if (r.ok) return r.json();
            throw new Error('Failed to delete');
        })
        .then(() => loadSpots())
        .catch(err => alert("Error deleting spot: " + err));
};

window.switchTab = (tab) => {
    // Update Nav UI
    document.querySelectorAll('.nav-item').forEach(el => {
        el.classList.remove('active');
        el.style.color = '#9ca3af';
        el.style.background = 'transparent';
    });
    const activeNav = document.getElementById(`nav-${tab}`);
    if (activeNav) {
        activeNav.classList.add('active');
        activeNav.style.color = 'white';
        activeNav.style.background = '#6366f1';
    }

    // Update View
    const stats = document.querySelector('.stats-grid');
    const listContainer = document.getElementById('dashboardList')?.parentElement;
    const activityContainer = document.getElementById('activityList')?.parentElement;

    if (!stats || !listContainer || !activityContainer) return;

    if (tab === 'overview') {
        stats.style.display = 'grid';
        listContainer.style.display = 'block';
        activityContainer.style.display = 'block';
    } else if (tab === 'analytics') {
        stats.style.display = 'grid';
        listContainer.style.display = 'none';
        activityContainer.style.display = 'block';
    } else if (tab === 'revenue') {
        stats.style.display = 'grid';
        listContainer.style.display = 'none';
        activityContainer.style.display = 'block';
    }
};

// --- Form Handlers ---

function handleAddSubmit(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = {
        name: formData.get('name'),
        price: formData.get('price'),
        available: formData.get('available'),
        lat: formData.get('lat'),
        lng: formData.get('lng')
    };

    fetch('/api/spots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    })
        .then(r => {
            if (!r.ok) throw new Error('Failed to add spot');
            return r.json();
        })
        .then(() => {
            window.closeModal();
            e.target.reset();
            loadSpots();
        })
        .catch(err => alert(err.message));
}

function handleEditSubmit(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const id = formData.get('id');
    const data = {
        name: formData.get('name'),
        price: formData.get('price'),
        available: formData.get('available'),
        lat: formData.get('lat'),
        lng: formData.get('lng')
    };

    fetch(`/api/spots/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    })
        .then(r => r.json())
        .then(res => {
            if (res.success) {
                window.closeEditModal();
                loadSpots(); // Refresh list
            } else {
                alert('Update Failed: ' + (res.message || 'Unknown error'));
            }
        })
        .catch(err => alert("Error updating spot: " + err));
}
