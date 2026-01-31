document.addEventListener('DOMContentLoaded', () => {
    loadSpots();
    loadAnalytics();

    // Load Data
    function loadSpots() {
        fetch('/api/spots')
            .then(r => r.json())
            .then(spots => {
                document.getElementById('totalSpots').innerText = spots.length;
                renderList(spots);
            });
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

                // Render Recent Activity
                const activityList = document.getElementById('activityList');
                activityList.innerHTML = '';

                if (data.recent_activity.length === 0) {
                    activityList.innerHTML = '<div style="text-align:center; padding: 1rem; color: #6b7280;">No recent activity</div>';
                }

                data.recent_activity.forEach(txn => {
                    const timeString = new Date(txn.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    const div = document.createElement('div');
                    div.className = 'glass-card'; // Reuse default style
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
                     <button onclick='openEditModal(${JSON.stringify(spot).replace(/'/g, "&#39;")})' style="background: rgba(99,102,241,0.1); color: #6366f1; border: none; width: 36px; height: 36px; border-radius: 8px; display: flex; align-items: center; justify-content: center;">
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

    // Modal Logic
    const modal = document.getElementById('addModal');
    window.openModal = () => modal.classList.remove('hidden');
    window.closeModal = () => modal.classList.add('hidden');

    // Add Spot
    document.getElementById('addForm').addEventListener('submit', (e) => {
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
            .then(r => r.json())
            .then(() => {
                closeModal();
                e.target.reset();
                loadSpots();
            });
    });

    // Edit Logic
    const editModal = document.getElementById('editModal');

    window.openEditModal = (spot) => {
        document.getElementById('editId').value = spot.id;
        document.getElementById('editName').value = spot.name;
        document.getElementById('editPrice').value = spot.price;
        document.getElementById('editAvailable').value = spot.available;
        document.getElementById('editLat').value = spot.lat;
        document.getElementById('editLng').value = spot.lng;
        editModal.classList.remove('hidden');
    };

    window.closeEditModal = () => editModal.classList.add('hidden');

    document.getElementById('editForm').addEventListener('submit', (e) => {
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
                    closeEditModal();
                    loadSpots(); // Refresh list
                } else {
                    alert('Update Failed');
                }
            });
    });

    // Delete Spot
    window.deleteSpot = (id) => {
        if (!confirm('Are you sure?')) return;
        fetch(`/api/spots/${id}`, { method: 'DELETE' })
            .then(() => loadSpots());
    };

    // Tab Switching
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
        const list = document.getElementById('dashboardList').parentElement;
        const activity = document.getElementById('activityList').parentElement;

        if (tab === 'overview') {
            stats.style.display = 'grid';
            list.style.display = 'block';
            activity.style.display = 'block';
        } else if (tab === 'analytics') {
            stats.style.display = 'grid';
            list.style.display = 'none';
            activity.style.display = 'block';
        } else if (tab === 'revenue') {
            stats.style.display = 'grid';
            list.style.display = 'none';
            activity.style.display = 'block';
        }
    };
});
