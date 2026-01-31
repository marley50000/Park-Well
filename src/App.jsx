import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Dashboard from './pages/Dashboard';
import { ParkingProvider } from './context/ParkingContext';

function App() {
    return (
        <div className="app-container">
            <ParkingProvider>
                <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/dashboard" element={<Dashboard />} />
                </Routes>
            </ParkingProvider>
        </div>
    );
}

export default App;
