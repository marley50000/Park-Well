import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Dashboard from './pages/Dashboard';
import Rewards from './pages/Rewards';
import { ParkingProvider } from './context/ParkingContext';

function App() {
    return (
        <div className="app-container">
            <ParkingProvider>
                <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/rewards" element={<Rewards />} />
                </Routes>
            </ParkingProvider>
        </div>
    );
}

export default App;
