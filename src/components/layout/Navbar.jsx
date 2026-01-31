import React from 'react';
import { Car, User } from 'lucide-react';
import { Link } from 'react-router-dom';

const Navbar = () => {
    return (
        <nav className="navbar">
            <div className="navbar-content">
                {/* Logo */}
                <Link to="/" className="nav-logo">
                    <div className="logo-icon">
                        <Car size={22} className="text-white" />
                    </div>
                    <span>Park<span style={{ color: 'var(--color-primary)' }}>Well</span></span>
                </Link>

                <div className="nav-links">
                    <Link to="/dashboard" className="glass-panel nav-btn">
                        For Owners
                    </Link>
                    {/* User Profile */}
                    <button className="glass-panel nav-btn" style={{ padding: '0.5rem', display: 'flex' }}>
                        <User size={20} />
                    </button>
                </div>
            </div>
        </nav>
    );
};

export default Navbar;
