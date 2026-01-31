import React from 'react';
import { MapContainer, TileLayer, Marker, Popup, ZoomControl } from 'react-leaflet';
import L from 'leaflet';

// Fix for default marker icon
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: markerIcon2x,
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
});

const DARK_MAP_URL = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

const MapView = ({ spots = [] }) => {
    return (
        <div style={{ width: '100%', height: '100%', position: 'relative', zIndex: 0 }}>
            {/* Gradients */}
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '8rem', background: 'linear-gradient(to bottom, #030712 0%, rgba(3,7,18,0.6) 100%)', pointerEvents: 'none', zIndex: 400 }}></div>
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '8rem', background: 'linear-gradient(to top, #030712 0%, rgba(3,7,18,0.6) 100%)', pointerEvents: 'none', zIndex: 400 }}></div>

            <MapContainer
                center={[40.7128, -74.0060]}
                zoom={14}
                scrollWheelZoom={true}
                zoomControl={false}
                style={{ width: '100%', height: '100%', background: '#030712', outline: 'none' }}
            >
                <TileLayer
                    attribution={ATTRIBUTION}
                    url={DARK_MAP_URL}
                />
                <ZoomControl position="bottomright" />

                {spots.map((spot) => (
                    <Marker key={spot.id} position={spot.position}>
                        <Popup className="glass-popup">
                            <div style={{ padding: '0.25rem' }}>
                                <h3 style={{ fontWeight: 'bold', fontSize: '0.875rem', marginBottom: '0.25rem' }}>{spot.name}</h3>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: spot.available > 0 ? '#10b981' : '#ef4444' }}></span>
                                    <span style={{ fontSize: '0.75rem', fontWeight: 500 }}>{spot.available} spots</span>
                                </div>
                                <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>${spot.price}/hr</p>
                            </div>
                        </Popup>
                    </Marker>
                ))}

            </MapContainer>
        </div>
    );
};

export default MapView;
