import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// We attach a mock interceptor for demo purposes to simulate varying roles
// In a real app, this would attach JWT tokens.
api.interceptors.request.use((config) => {
  const role = localStorage.getItem('hc_role');
  if (role) {
    config.headers['X-User-Role'] = role;
  }
  return config;
});

export const PatientService = {
  register: (data) => api.post('/patient/register', data).then(res => res.data),
  getProfile: (id) => api.get(`/patient/${id}`).then(res => res.data),
  grantConsent: (id, hospitalId) => api.post(`/patient/${id}/consents/grant`, { hospitalMsp: hospitalId, collections: [`collectionMedicalRecords_${hospitalId.replace('OrgMSP', '')}`] }).then(res => res.data),
  revokeConsent: (id, hospitalId) => api.post(`/patient/${id}/consents/revoke`, { hospitalMsp: hospitalId }).then(res => res.data),
  getRecords: (id) => api.get(`/patient/${id}/records`).then(res => res.data),
  getAuditLogs: (id) => api.get(`/patient/${id}/audit-logs`).then(res => res.data),
};

export const HospitalService = {
  requestAccess: (data) => api.post('/hospital/access/request', data).then(res => res.data),
  getPatientRecords: (patientId) => api.get(`/hospital/patients/${patientId}/records`).then(res => res.data),
  createRecord: (data) => api.post('/hospital/records', data).then(res => res.data),
  orderLabTest: (data) => api.post('/hospital/lab-orders', data).then(res => res.data),
  issuePrescription: (data) => api.post('/hospital/prescriptions', data).then(res => res.data),
  submitClaim: (data) => api.post('/hospital/insurance-claims', data).then(res => res.data),
};

export const LabService = {
  getOrders: () => api.get('/lab/orders').then(res => res.data),
  uploadReport: (data) => api.post('/lab/reports', data).then(res => res.data),
};

export const PharmacyService = {
  getPendingPrescriptions: () => api.get('/pharmacy/prescriptions/pending').then(res => res.data),
  fulfillPrescription: (data) => api.post('/pharmacy/prescriptions/fulfill', data).then(res => res.data),
};

export const InsuranceService = {
  getPendingClaims: () => api.get('/insurance/claims/pending').then(res => res.data),
  approveClaim: (data) => api.post('/insurance/claims/approve', data).then(res => res.data),
};
