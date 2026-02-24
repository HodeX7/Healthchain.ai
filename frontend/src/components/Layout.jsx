import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Shield, User, Building, Activity, Pill, FileText, LogOut, Menu } from 'lucide-react';

export function Layout() {
  const navigate = useNavigate();
  // We'll read the role from localStorage to simulate authentication
  const role = localStorage.getItem('hc_role');
  
  if (!role) {
    navigate('/');
    return null;
  }

  const roleConfig = {
    patient: { name: 'Patient Portal', icon: User, color: 'text-brand-600', bg: 'bg-brand-50' },
    hospital: { name: 'Hospital System', icon: Building, color: 'text-blue-600', bg: 'bg-blue-50' },
    lab: { name: 'Laboratory Dashboard', icon: Activity, color: 'text-purple-600', bg: 'bg-purple-50' },
    pharmacy: { name: 'Pharmacy Network', icon: Pill, color: 'text-green-600', bg: 'bg-green-50' },
    insurance: { name: 'Insurance Provider', icon: Shield, color: 'text-amber-600', bg: 'bg-amber-50' },
  };

  const currentConfig = roleConfig[role] || roleConfig.patient;
  const RoleIcon = currentConfig.icon;

  const handleLogout = () => {
    localStorage.removeItem('hc_role');
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-white border-r border-slate-200 flex flex-col">
        <div className="h-16 flex items-center px-6 border-b border-slate-100">
          <Shield className="w-6 h-6 text-brand-600 mr-2" />
          <span className="font-bold text-xl tracking-tight text-slate-900">HealthChain</span>
        </div>
        
        <div className={`m-4 p-4 rounded-xl flex flex-col items-center justify-center border border-slate-100 ${currentConfig.bg}`}>
          <div className={`p-3 bg-white rounded-full shadow-sm mb-2 ${currentConfig.color}`}>
            <RoleIcon className="w-6 h-6" />
          </div>
          <span className="font-semibold text-sm text-slate-800">{currentConfig.name}</span>
          <span className="text-xs text-slate-500 capitalize mt-0.5">Role: {role}</span>
        </div>

        <nav className="flex-1 px-4 pb-4 space-y-1 overflow-y-auto">
          {/* Navigation Links based on role */}
          {role === 'patient' && (
            <>
              <NavItem to="/dashboard" icon={User} label="My Profile" />
              <NavItem to="/records" icon={FileText} label="Medical Records" />
              <NavItem to="/consents" icon={Shield} label="Manage Consents" />
              <NavItem to="/audit" icon={Activity} label="Audit Logs" />
            </>
          )}
          
          {role === 'hospital' && (
            <>
              <NavItem to="/dashboard" icon={Building} label="Patient Search" />
              <NavItem to="/create-record" icon={FileText} label="Create Record" />
              <NavItem to="/orders" icon={Activity} label="Lab Orders" />
              <NavItem to="/prescriptions" icon={Pill} label="Prescriptions" />
            </>
          )}

          {role === 'lab' && (
            <NavItem to="/dashboard" icon={Activity} label="Pending Orders" />
          )}

          {role === 'pharmacy' && (
            <NavItem to="/dashboard" icon={Pill} label="Pending Prescriptions" />
          )}

          {role === 'insurance' && (
            <NavItem to="/dashboard" icon={FileText} label="Pending Claims" />
          )}
        </nav>

        <div className="p-4 border-t border-slate-200">
          <button 
            onClick={handleLogout}
            className="flex items-center w-full px-3 py-2 text-sm font-medium text-slate-600 rounded-lg hover:bg-red-50 hover:text-red-600 transition-colors"
          >
            <LogOut className="w-4 h-4 mr-3" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile Header */}
        <header className="md:hidden h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4">
          <div className="flex flex-row items-center">
             <Shield className="w-5 h-5 text-brand-600 mr-2" />
             <span className="font-bold text-lg">HealthChain</span>
          </div>
          <button className="text-slate-500 hover:text-slate-700">
            <Menu className="w-6 h-6" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-5xl mx-auto">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}

function NavItem({ to, icon: Icon, label }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${
          isActive 
            ? 'bg-brand-50 text-brand-700' 
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <Icon className={`w-5 h-5 mr-3 ${isActive ? 'text-brand-600' : 'text-slate-400'}`} />
          {label}
        </>
      )}
    </NavLink>
  );
}
