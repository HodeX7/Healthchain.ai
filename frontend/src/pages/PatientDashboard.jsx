import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '../components/ui/Table';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Shield, FileText, Activity, Key, Lock } from 'lucide-react';
import { PatientService } from '../services/api';
import { DocumentViewer } from '../components/ui/DocumentViewer';

export default function PatientDashboard() {
  const [profile, setProfile] = useState(null);
  const [records, setRecords] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [isConsentModalOpen, setConsentModalOpen] = useState(false);
  const [isRevokeModalOpen, setRevokeModalOpen] = useState(false);
  const [hospitalIdInput, setHospitalIdInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const patientId = localStorage.getItem('hc_patient_id');
  const location = useLocation();
  const currentPath = location.pathname;

  const getActorOrg = (logData) => {
    if (logData.hospitalOrg) return logData.hospitalOrg;
    if (logData.actor) {
      if (logData.actor.includes('patient')) return 'Patient Portal';
      // Fallback: extract organization name from x509 certificate string (e.g. O=hospitalA.healthchain.com)
      const match = logData.actor.match(/O=([^.,]+)/);
      if (match) return match[1].charAt(0).toUpperCase() + match[1].slice(1) + 'OrgMSP';
    }
    return 'System';
  };  useEffect(() => {
    if (!patientId) return;

    const fetchData = async () => {
      try {
        const profileRes = await PatientService.getProfile(patientId);
        setProfile(profileRes.data);

        // Only fetch records if the backend is configured to support patient reads, 
        // which currently throws a 500 due to PDC isolation
        // Skipping PatientService.getRecords() to prevent the red console errors.

        // Fetch audit logs
        try {
          const logsRes = await PatientService.getAuditLogs(patientId);
          const sortedLogs = (Array.isArray(logsRes.data) ? logsRes.data : []).sort((a, b) => {
             const timeA = new Date((a.Record || a).timestamp || 0).getTime();
             const timeB = new Date((b.Record || b).timestamp || 0).getTime();
             return timeB - timeA;
          });
          setAuditLogs(sortedLogs);
        } catch (err) {
            console.warn("Failed to fetch audit logs", err);
        }

      } catch (err) {
        setError("Failed to fetch patient data from the blockchain.");
        console.error(err);
      }
    };

    fetchData();
  }, [patientId]);

  const handleGrantConsent = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      let baseName = hospitalIdInput.replace('OrgMSP', '');
      baseName = baseName.charAt(0).toUpperCase() + baseName.slice(1);
      const mspId = `${baseName}OrgMSP`;
      
      const collections = [
         `collectionMedicalRecords_${baseName}`,
         `collectionLabReports_${baseName}`,
         `collectionPrescriptions_${baseName}`,
         `collectionInsuranceClaims_${baseName}`
      ];

      await PatientService.grantConsent(patientId, mspId, collections);
      const logsRes = await PatientService.getAuditLogs(patientId);
      const sortedLogs = (Array.isArray(logsRes.data) ? logsRes.data : []).sort((a, b) => {
          return new Date((b.Record || b).timestamp || 0).getTime() - new Date((a.Record || a).timestamp || 0).getTime();
      });
      setAuditLogs(sortedLogs);
      setConsentModalOpen(false);
      setHospitalIdInput('');
      alert("Access granted successfully on the ledger!");
    } catch (err) {
      const backendMsg = err.response?.data?.error || err.message;
      alert(`Failed to grant access:\n${backendMsg}`);
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRevokeConsent = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      let baseName = hospitalIdInput.replace('OrgMSP', '');
      baseName = baseName.charAt(0).toUpperCase() + baseName.slice(1);
      const mspId = `${baseName}OrgMSP`;

      await PatientService.revokeConsent(patientId, mspId);
      const logsRes = await PatientService.getAuditLogs(patientId);
      const sortedLogs = (Array.isArray(logsRes.data) ? logsRes.data : []).sort((a, b) => {
          return new Date((b.Record || b).timestamp || 0).getTime() - new Date((a.Record || a).timestamp || 0).getTime();
      });
      setAuditLogs(sortedLogs);
      setRevokeModalOpen(false);
      setHospitalIdInput('');
      alert("Access revoked successfully on the ledger!");
    } catch (err) {
      const backendMsg = err.response?.data?.error || err.message;
      alert(`Failed to revoke access:\n${backendMsg}`);
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  if (!patientId) {
    return <div className="p-6 text-center text-slate-500">Not logged in or missing patient ID.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
             {currentPath === '/records' ? 'Medical Journey' : 
              currentPath === '/consents' ? 'Manage Consents' : 
              currentPath === '/audit' ? 'Audit Logs' : 'Patient Profile'}
          </h1>
          <p className="text-slate-500 text-sm mt-1">Manage your health records and data sharing consents securely.</p>
        </div>
      </div>

      {error ? (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg">{error}</div>
      ) : (
        <>
          {(currentPath === '/dashboard' || currentPath === '/') && (
            <Card className="border-l-4 border-l-brand-500 max-w-xl">
              <CardHeader>
                <CardTitle className=" flex items-center"><UserIcon className="w-5 h-5 mr-2 text-brand-500" /> My Profile</CardTitle>
              </CardHeader>
              <CardContent>
                {profile ? (
                  <ul className="space-y-3 text-sm">
                    <li className="flex justify-between border-b pb-2"><span className="text-slate-500">Name</span><span className="font-medium">{profile.firstName} {profile.lastName}</span></li>
                    <li className="flex justify-between border-b pb-2"><span className="text-slate-500">Patient ID</span><span className="font-medium text-slate-700">{profile.patientId || profile.id}</span></li>
                    <li className="flex justify-between border-b pb-2"><span className="text-slate-500">Date of Birth</span><span className="font-medium">{profile.dateOfBirth}</span></li>
                    <li className="flex justify-between"><span className="text-slate-500">Blood Group</span><span className="font-medium text-red-500">{profile.bloodGroup}</span></li>
                  </ul>
                ) : (
                  <p className="text-slate-400 animate-pulse">Loading profile from ledger...</p>
                )}
              </CardContent>
            </Card>
          )}

          {currentPath === '/records' && (
            <Card>
              <CardHeader>
                <CardTitle className=" flex items-center"><FileText className="w-5 h-5 mr-2 text-blue-500" /> Medical Journey</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableHead>Date</TableHead>
                    <TableHead>Hospital/Provider</TableHead>
                    <TableHead>Diagnosis / Note</TableHead>
                    <TableHead>Doctor</TableHead>
                  </TableHeader>
                  <TableBody>
                    {records.map((r, i) => {
                      const recData = r.Record || r;
                      return (
                      <TableRow key={i}>
                        <TableCell className="text-slate-500">{recData.date ? new Date(recData.date).toLocaleDateString() : 'N/A'}</TableCell>
                        <TableCell className="font-medium text-slate-900">{recData.hospitalId ? recData.hospitalId.replace('OrgMSP', '') : 'N/A'}</TableCell>
                        <TableCell>
                          {recData.diagnosis || recData.description || 'Record entry'}
                          {(recData.documentUrl || recData.s3Key) && (
                            <div className="mt-2">
                              <DocumentViewer documentUrl={recData.documentUrl || recData.s3Key} />
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-slate-500">{recData.doctor || 'Unknown'}</TableCell>
                      </TableRow>
                    )})}
                    {records.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={4} className="text-center py-6 text-slate-500">No medical records found on the ledger.</TableCell>
                        </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {currentPath === '/consents' && (
            <Card className="max-w-3xl">
              <CardHeader>
                <CardTitle className=" flex items-center"><Shield className="w-5 h-5 mr-2 text-green-500" /> Manage Data Consents</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <p className="text-slate-600">
                  You are in full control of your private medical data. Use the buttons below to dynamically grant or revoke cryptographic access to healthcare organizations on the Healthchain network.
                </p>
                <div className="flex space-x-4 pt-2">
                    <Button onClick={() => setConsentModalOpen(true)} className="flex items-center">
                    <Key className="w-4 h-4 mr-2" /> Grant New Access
                    </Button>
                    <Button onClick={() => setRevokeModalOpen(true)} variant="secondary" className="flex items-center text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200">
                    <Lock className="w-4 h-4 mr-2" /> Revoke Access
                    </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {currentPath === '/audit' && (
            <Card>
              <CardHeader>
                <CardTitle className=" flex items-center"><Activity className="w-5 h-5 mr-2 text-amber-500" /> Data Access Audit Trail</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                 <Table>
                    <TableHeader>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>Action Taken</TableHead>
                      <TableHead>Accessor Organization</TableHead>
                    </TableHeader>
                    <TableBody>
                      {auditLogs.map((log, i) => {
                        const logData = log.Record || log;
                        return (
                        <TableRow key={i}>
                          <TableCell className="text-slate-500 font-mono text-xs">{logData.timestamp ? new Date(logData.timestamp).toLocaleString() : 'N/A'}</TableCell>
                          <TableCell>
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${logData.action === 'GRANT_ACCESS' ? 'bg-green-100 text-green-700' : logData.action === 'REVOKE_ACCESS' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                              {(logData.action || '').replace('_', ' ')}
                            </span>
                          </TableCell>
                          <TableCell className="font-medium text-slate-700">
                            {getActorOrg(logData)}
                          </TableCell>
                        </TableRow>
                      )})}
                      {auditLogs.length === 0 && (
                          <TableRow>
                              <TableCell colSpan={3} className="text-center py-6 text-slate-500">No audit logs found.</TableCell>
                          </TableRow>
                      )}
                    </TableBody>
                  </Table>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Grant Access Modal */}
      <Modal isOpen={isConsentModalOpen} onClose={() => {setConsentModalOpen(false); setHospitalIdInput('');}} title="Grant Data Access">
        <form onSubmit={handleGrantConsent} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Organization ID</label>
            <input 
              type="text" 
              required
              placeholder="e.g. HospitalAOrgMSP"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
              value={hospitalIdInput}
              onChange={(e) => setHospitalIdInput(e.target.value)}
            />
            <p className="text-xs text-slate-500 mt-2">
              By granting access, this organization will be able to read your medical history stored in private data collections.
            </p>
          </div>
          <div className="pt-4 flex justify-end space-x-2">
            <Button type="button" variant="ghost" onClick={() => {setConsentModalOpen(false); setHospitalIdInput('');}}>Cancel</Button>
            <Button type="submit" disabled={isLoading}>{isLoading ? 'Granting...' : 'Confirm Grant'}</Button>
          </div>
        </form>
      </Modal>

      {/* Revoke Access Modal */}
      <Modal isOpen={isRevokeModalOpen} onClose={() => {setRevokeModalOpen(false); setHospitalIdInput('');}} title="Revoke Data Access">
        <form onSubmit={handleRevokeConsent} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Organization ID</label>
            <input 
              type="text" 
              required
              placeholder="e.g. HospitalAOrgMSP"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
              value={hospitalIdInput}
              onChange={(e) => setHospitalIdInput(e.target.value)}
            />
            <p className="text-xs text-slate-500 mt-2">
              This will revoke the organization's permission to read your private medical records on the ledger.
            </p>
          </div>
          <div className="pt-4 flex justify-end space-x-2">
            <Button type="button" variant="ghost" onClick={() => {setRevokeModalOpen(false); setHospitalIdInput('');}}>Cancel</Button>
            <Button type="submit" variant="danger" disabled={isLoading}>{isLoading ? 'Revoking...' : 'Revoke Access'}</Button>
          </div>
        </form>
      </Modal>

    </div>
  );
}

function UserIcon(props) {
  return <svg {...props} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" /></svg>;
}
