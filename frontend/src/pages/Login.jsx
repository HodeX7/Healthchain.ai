import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, User, Building, Activity, Pill, UserPlus, Lock } from 'lucide-react';
import { Card, CardContent } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import { Button } from '../components/ui/Button';
import { PatientService } from '../services/api';

const roles = [
  { id: 'patient', name: 'Patient', icon: User, desc: 'Manage your profile and data consents', color: 'bg-brand-50 text-brand-600 border-brand-200 hover:border-brand-300 hover:bg-brand-100' },
  { id: 'hospital', name: 'Hospital', icon: Building, desc: 'Manage patient records and order tests', color: 'bg-blue-50 text-blue-600 border-blue-200 hover:border-blue-300 hover:bg-blue-100' },
  { id: 'lab', name: 'Laboratory', icon: Activity, desc: 'View orders and upload test results', color: 'bg-purple-50 text-purple-600 border-purple-200 hover:border-purple-300 hover:bg-purple-100' },
  { id: 'pharmacy', name: 'Pharmacy', icon: Pill, desc: 'Fulfill patient prescriptions safely', color: 'bg-green-50 text-green-600 border-green-200 hover:border-green-300 hover:bg-green-100' },
  { id: 'insurance', name: 'Insurance Provider', icon: Shield, desc: 'Process and approve health claims', color: 'bg-amber-50 text-amber-600 border-amber-200 hover:border-amber-300 hover:bg-amber-100' },
];

export default function Login() {
  const navigate = useNavigate();
  const [isRegisterModalOpen, setRegisterModalOpen] = useState(false);
  const [isHospitalModalOpen, setHospitalModalOpen] = useState(false);
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    id: '', password: '', firstName: '', lastName: '', dob: '', bloodGroup: '', email: '', phone: ''
  });
  const [hospitalIdInput, setHospitalIdInput] = useState('');

  const handleLogin = (roleId) => {
    if (roleId === 'hospital') {
      setHospitalModalOpen(true);
    } else if (roleId === 'patient') {
      setRegisterModalOpen(true);
    } else {
      localStorage.setItem('hc_role', roleId);
      navigate('/dashboard');
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handlePatientSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isLoginMode) {
        // Just verify the patient exists before logging in
        await PatientService.getProfile(formData.id);
        
        // Simulate checking the password locally
        const storedPassword = localStorage.getItem(`hc_pwd_${formData.id}`);
        if (!storedPassword) {
            // For demo robustness, if they created via API (no pwd), we let them set it now.
            localStorage.setItem(`hc_pwd_${formData.id}`, formData.password);
        } else if (storedPassword !== formData.password) {
            alert("Incorrect Password!");
            setLoading(false);
            return;
        }

        localStorage.setItem('hc_role', 'patient');
        localStorage.setItem('hc_patient_id', formData.id);
        navigate('/dashboard');
      } else {
        // Register new identity
        await PatientService.register(formData);
        
        // Simulate password creation in our demo environment
        localStorage.setItem(`hc_pwd_${formData.id}`, formData.password);
        
        localStorage.setItem('hc_role', 'patient');
        localStorage.setItem('hc_patient_id', formData.id);
        navigate('/dashboard');
      }
    } catch (error) {
      const backendMsg = error.response?.data?.error || error.message;
      alert(`${isLoginMode ? "Login" : "Registration"} failed: \n${backendMsg}`);
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleHospitalSubmit = (e) => {
    e.preventDefault();
    if (!hospitalIdInput) return;
    
    // Setting the exact hospital id (e.g. hospitalA, hospitalB, hospitalC) 
    // so the backend can use it for dynamic query routing.
    localStorage.setItem('hc_role', hospitalIdInput);
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="text-center mb-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-brand-600 text-white mb-6 shadow-lg shadow-brand-200">
          <Shield className="w-8 h-8" />
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-slate-900 mb-3">HealthChain.ai</h1>
        <p className="text-lg text-slate-600 max-w-lg mx-auto">
          Secure, interoperable healthcare data exchange built on Hyperledger Fabric. Select your organization role to enter the portal.
        </p>
      </div>

      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-8 duration-700">
        {roles.map((role) => {
          const Icon = role.icon;
          const isProtected = role.id === 'patient' || role.id === 'hospital';
          return (
            <button
              key={role.id}
              onClick={() => handleLogin(role.id)}
              className="text-left group focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-4 rounded-xl transition-all duration-200 transform hover:-translate-y-1 hover:shadow-md"
            >
              <Card className={`h-full border-2 cursor-pointer transition-colors relative overflow-hidden ${role.color}`}>
                <CardContent className="p-6 pointer-events-none">
                  <div className="flex justify-between items-start mb-4">
                    <Icon className="w-10 h-10" />
                    {isProtected && (
                      <span className="flex items-center text-xs font-semibold bg-white/50 px-2 py-1 rounded-full text-brand-700">
                        <Lock className="w-3 h-3 mr-1" />
                        Secure
                      </span>
                    )}
                  </div>
                  <h3 className="text-xl font-bold mb-2 text-slate-900">{role.name}</h3>
                  <p className="text-sm font-medium opacity-80">{role.desc}</p>
                </CardContent>
              </Card>
            </button>
          );
        })}
      </div>

      {/* Patient Login/Registration Modal */}
      <Modal 
        isOpen={isRegisterModalOpen} 
        onClose={() => setRegisterModalOpen(false)} 
        title={isLoginMode ? "Patient Login" : "Register New Patient Identity"}
      >
        <form onSubmit={handlePatientSubmit} className="space-y-4">
          <p className="text-sm text-slate-500 mb-4">
            {isLoginMode 
              ? "Enter your credentials to securely access your case files from the blockchain ledger."
              : "This will create a new decentralized identity for you on the Hyperledger Fabric blockchain. Secure it with a strong password."}
          </p>
          
          {!isLoginMode && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">First Name *</label>
                <input required={!isLoginMode} name="firstName" value={formData.firstName} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500" placeholder="John" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Last Name *</label>
                <input required={!isLoginMode} name="lastName" value={formData.lastName} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500" placeholder="Doe" />
              </div>
            </div>
          )}
          
          <div>
             <label className="block text-sm font-medium text-slate-700 mb-1">National ID / Unique ID *</label>
             <input required name="id" value={formData.id} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500" placeholder="e.g. SSN-12345" />
          </div>

          <div>
             <label className="block text-sm font-medium text-slate-700 mb-1">Password *</label>
             <input required type="password" name="password" value={formData.password} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500" placeholder="••••••••" />
          </div>

          {!isLoginMode && (
            <>
              <div className="grid grid-cols-2 gap-4 mt-2">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Date of Birth</label>
                  <input type="date" name="dob" value={formData.dob} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Blood Group</label>
                  <select name="bloodGroup" value={formData.bloodGroup} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white">
                    <option value="">Select...</option>
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                  <input type="email" name="email" value={formData.email} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500" placeholder="john@example.com" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                  <input type="tel" name="phone" value={formData.phone} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500" placeholder="555-0198" />
                </div>
              </div>
            </>
          )}

          <div className="pt-4 flex items-center justify-between border-t border-slate-100 mt-6">
             <button type="button" onClick={() => setIsLoginMode(!isLoginMode)} className="text-sm text-brand-600 hover:text-brand-800 font-medium focus:outline-none">
               {isLoginMode ? "Need an account? Register" : "Already registered? Login"}
             </button>
             <div className="flex space-x-3">
               <Button variant="ghost" type="button" onClick={() => setRegisterModalOpen(false)}>
                 Cancel
               </Button>
               <Button type="submit" disabled={loading}>
                 {loading ? 'Processing...' : (isLoginMode ? 'Login Securely' : 'Register Identity')}
               </Button>
             </div>
          </div>
        </form>
      </Modal>

      {/* Hospital Login Modal */}
      <Modal 
        isOpen={isHospitalModalOpen} 
        onClose={() => setHospitalModalOpen(false)} 
        title="Hospital Login"
      >
        <form onSubmit={handleHospitalSubmit} className="space-y-4">
          <p className="text-sm text-slate-500 mb-4">
            Enter your participating Hospital Node ID to connect to the HealthChain.ai network.
          </p>
          
          <div>
             <label className="block text-sm font-medium text-slate-700 mb-1">Hospital Node ID *</label>
             <input 
                required 
                value={hospitalIdInput} 
                onChange={(e) => setHospitalIdInput(e.target.value)} 
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" 
                placeholder="e.g. hospitalA, hospitalB, hospitalC" 
             />
             <p className="text-xs text-slate-400 mt-2">The Node ID dictates which organizational wallet is used for signing transactions.</p>
          </div>

          <div className="pt-4 flex items-center justify-end border-t border-slate-100 mt-6 space-x-3">
            <Button variant="ghost" type="button" onClick={() => setHospitalModalOpen(false)}>
                Cancel
            </Button>
            <Button type="submit">
                Connect Node
            </Button>
          </div>
        </form>
      </Modal>

    </div>
  );
}
