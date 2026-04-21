import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import Login from './pages/Login';
import PatientDashboard from './pages/PatientDashboard';
import HospitalDashboard from './pages/HospitalDashboard';
import LabDashboard from './pages/LabDashboard';
import PharmacyDashboard from './pages/PharmacyDashboard';
import InsuranceDashboard from './pages/InsuranceDashboard';
import { ToastProvider } from './components/ui/Toast';

function RoleDashboardRouter() {
  const role = localStorage.getItem('hc_role');
  
  if (role === 'patient') return <PatientDashboard />;
  if (role && role.startsWith('hospital')) return <HospitalDashboard />;
  if (role === 'lab') return <LabDashboard />;
  if (role === 'pharmacy') return <PharmacyDashboard />;
  if (role === 'insurance') return <InsuranceDashboard />;
  
  return <Navigate to="/" replace />;
}

const RoleGuard = ({ roleRequired, children }) => {
  const currentRole = localStorage.getItem('hc_role');
  // Handle wildcard hospital IDs
  if (roleRequired === 'hospital' && currentRole && currentRole.startsWith('hospital')) {
     return children;
  }
  if (currentRole === roleRequired) {
     return children;
  }
  return <Navigate to="/dashboard" replace />;
};

// Fallback for unmatched protected routes
const UnderConstruction = () => (
  <div className="flex flex-col items-center justify-center p-12 text-center h-full">
    <div className="w-16 h-16 bg-brand-100 text-brand-600 rounded-full flex items-center justify-center mb-4 text-2xl">⏳</div>
    <h2 className="text-xl font-bold text-slate-800 mb-2">Coming Soon</h2>
    <p className="text-slate-600 max-w-md">This specific tool view is currently under development. Please check back later.</p>
  </div>
);

export default function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Login />} />
          
          {/* Protected Routes utilizing Layout */}
          <Route element={<Layout />}>
            <Route path="/dashboard" element={<RoleDashboardRouter />} />
            <Route path="/records" element={<RoleGuard roleRequired="patient"><PatientDashboard /></RoleGuard>} />
            <Route path="/consents" element={<RoleGuard roleRequired="patient"><PatientDashboard /></RoleGuard>} />
            <Route path="/audit" element={<RoleGuard roleRequired="patient"><PatientDashboard /></RoleGuard>} />
            <Route path="/create-record" element={<RoleGuard roleRequired="hospital"><HospitalDashboard /></RoleGuard>} />
            <Route path="/orders" element={<RoleGuard roleRequired="lab"><LabDashboard /></RoleGuard>} />
            <Route path="/prescriptions" element={<RoleGuard roleRequired="pharmacy"><PharmacyDashboard /></RoleGuard>} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}
