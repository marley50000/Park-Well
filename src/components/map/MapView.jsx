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

// Google Maps Tiles (Standard) - Optimized with subdomains
const MAP_URL = 'https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}';
const SUBDOMAINS = ['mt0', 'mt1', 'mt2', 'mt3'];
const ATTRIBUTION = '&copy; <a href="https://www.google.com/maps">Google Maps</a>';

const MapView = ({ spots = [] }) => {
    return (
        <div style={{ width: '100%', height: '100%', position: 'relative', zIndex: 0 }}>
            {/* Gradients - Cinematic Black */}
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '12rem', background: 'linear-gradient(to bottom, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0) 100%)', pointerEvents: 'none', zIndex: 400 }}></div>
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '12rem', background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0) 100%)', pointerEvents: 'none', zIndex: 400 }}></div>

            <MapContainer
                center={[40.7128, -74.0060]}
                zoom={15}
                scrollWheelZoom={true}
                zoomControl={false}
                style={{ width: '100%', height: '100%', background: '#030712', outline: 'none' }}
            >
                <TileLayer
                    attribution={ATTRIBUTION}
                    url={MAP_URL}
                    subdomains={SUBDOMAINS}
                    maxZoom={20}
                    keepBuffer={4}
                    updateWhenZooming={false}
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
