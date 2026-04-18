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
  const [activeConsents, setActiveConsents] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
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

        // Backend PDC isolation is resolved; fetch patient records securely
        try {
          const recordsRes = await PatientService.getRecords(patientId);
          if (recordsRes && recordsRes.data) {
            setRecords(Array.isArray(recordsRes.data) ? recordsRes.data : []);
          }
        } catch (err) {
          console.warn("Failed to fetch medical records for patient portal", err);
        }

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

        try {
          const consentsRes = await PatientService.getConsents(patientId);
          setActiveConsents(Array.isArray(consentsRes.data) ? consentsRes.data.filter(c => (c.Record || c).status === 'active').map(c => c.Record || c) : []);
        } catch (err) {
            console.warn("Failed to fetch consents", err);
        }

        try {
          const requestsRes = await PatientService.getAccessRequests(patientId);
          setPendingRequests(Array.isArray(requestsRes.data) ? requestsRes.data.filter(r => (r.Record || r).status === 'pending').map(r => r.Record || r) : []);
        } catch (err) {
            console.warn("Failed to fetch access requests", err);
        }

      } catch (err) {
        setError("Failed to fetch patient data from the blockchain.");
        console.error(err);
      }
    };

    fetchData();
  }, [patientId, currentPath]);

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
      
      // Remove from pending if it was there
      setPendingRequests(prev => prev.filter(r => r.hospitalOrg !== mspId));
      // Add to active consents
      const consentsRes = await PatientService.getConsents(patientId);
      setActiveConsents(Array.isArray(consentsRes.data) ? consentsRes.data.filter(c => (c.Record || c).status === 'active').map(c => c.Record || c) : []);

      alert("Access granted successfully on the ledger!");
    } catch (err) {
      const backendMsg = err.response?.data?.error || err.message;
      alert(`Failed to grant access:\n${backendMsg}`);
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApproveRequest = async (hospitalId) => {
    setIsLoading(true);
    try {
      const collections = [
         `collectionMedicalRecords_${hospitalId.replace('OrgMSP', '')}`,
         `collectionLabReports_${hospitalId.replace('OrgMSP', '')}`,
         `collectionPrescriptions_${hospitalId.replace('OrgMSP', '')}`,
         `collectionInsuranceClaims_${hospitalId.replace('OrgMSP', '')}`
      ];
      await PatientService.grantConsent(patientId, hospitalId, collections);
      
      // Update ui
      setPendingRequests(prev => prev.filter(r => r.hospitalOrg !== hospitalId));
      const consentsRes = await PatientService.getConsents(patientId);
      setActiveConsents(Array.isArray(consentsRes.data) ? consentsRes.data.filter(c => (c.Record || c).status === 'active').map(c => c.Record || c) : []);
      
      alert("Access granted successfully from pending request!");
    } catch (err) {
      alert(`Failed to grant access: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRejectRequest = async (hospitalId) => {
    setIsLoading(true);
    try {
      await PatientService.rejectAccessRequest(patientId, hospitalId);
      setPendingRequests(prev => prev.filter(r => r.hospitalOrg !== hospitalId));
      alert("Access request rejected.");
    } catch (err) {
       alert(`Failed to reject request: ${err.message}`);
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
      setActiveConsents(prev => prev.filter(c => c.hospitalOrg !== mspId));
      alert("Access revoked successfully on the ledger!");
    } catch (err) {
      const backendMsg = err.response?.data?.error || err.message;
      alert(`Failed to revoke access:\n${backendMsg}`);
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRevokeConsentInline = async (hospitalId) => {
    setIsLoading(true);
    try {
      await PatientService.revokeConsent(patientId, hospitalId);
      setActiveConsents(prev => prev.filter(c => c.hospitalOrg !== hospitalId));
      
      const logsRes = await PatientService.getAuditLogs(patientId);
      const sortedLogs = (Array.isArray(logsRes.data) ? logsRes.data : []).sort((a, b) => {
          return new Date((b.Record || b).timestamp || 0).getTime() - new Date((a.Record || a).timestamp || 0).getTime();
      });
      setAuditLogs(sortedLogs);
      
      alert("Access revoked successfully.");
    } catch (err) {
       alert(`Failed to revoke access: ${err.message}`);
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
                    <TableHead>Type</TableHead>
                    <TableHead>Organization</TableHead>
                    <TableHead>Details</TableHead>
                    <TableHead>Document</TableHead>
                  </TableHeader>
                  <TableBody>
                    {[...records]
                      .map(r => r.Record || r)
                      .sort((a, b) => {
                        const getTime = (r) => new Date(r.createdAt || r.issuedAt || r.submittedAt || r.completedAt || r.orderedAt || 0).getTime();
                        return getTime(b) - getTime(a);
                      })
                      .map((recData, i) => {
                      const docType = (recData.docType || '').toLowerCase();
                      
                      const typeMap = {
                        medicalrecord: { label: 'Clinical Note', cls: 'bg-blue-100 text-blue-700' },
                        labreport: { label: 'Lab Report', cls: 'bg-purple-100 text-purple-700' },
                        laborder: { label: 'Lab Order', cls: 'bg-violet-100 text-violet-700' },
                        prescription: { label: 'Prescription', cls: 'bg-green-100 text-green-700' },
                        insuranceclaim: { label: 'Insurance Claim', cls: 'bg-amber-100 text-amber-700' },
                      };
                      const typeInfo = typeMap[docType] || { label: recData.docType || 'Record', cls: 'bg-slate-100 text-slate-700' };
                      
                      // Determine date
                      const dateStr = recData.createdAt || recData.issuedAt || recData.submittedAt || recData.completedAt || recData.orderedAt || recData.date;
                      
                      // Determine org
                      const org = recData.hospitalOrg || recData.labOrg || '';
                      
                      // Extract embedded documentUrl from medications or procedures arrays
                      let embeddedDocUrl = recData.documentUrl || recData.s3Key || '';
                      if (!embeddedDocUrl && Array.isArray(recData.medications)) {
                        const docEntry = recData.medications.find(m => m.documentUrl);
                        if (docEntry) embeddedDocUrl = docEntry.documentUrl;
                      }
                      if (!embeddedDocUrl && Array.isArray(recData.procedures)) {
                        const docEntry = recData.procedures.find(p => p.documentUrl);
                        if (docEntry) embeddedDocUrl = docEntry.documentUrl;
                      }
                      
                      return (
                      <TableRow key={i}>
                        <TableCell className="text-slate-500 text-xs">{dateStr ? new Date(dateStr).toLocaleString() : 'N/A'}</TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 rounded-full text-xs font-bold ${typeInfo.cls}`}>{typeInfo.label}</span>
                        </TableCell>
                        <TableCell className="font-medium text-slate-900">
                          {org ? (
                            <span className="inline-flex items-center text-xs">
                              <span className="mr-1">🏥</span> {org.replace('OrgMSP', '')}
                            </span>
                          ) : 'N/A'}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-0.5">
                            <span className="font-medium text-slate-800 block">{recData.diagnosis || recData.testType || (recData.medications && `Rx: ${Array.isArray(recData.medications) ? recData.medications.filter(m => m.name).map(m => `${m.name}${m.dosage ? ' — ' + m.dosage : ''}`).join(', ') : recData.medications}`) || (recData.procedures && `Claim: ${Array.isArray(recData.procedures) ? recData.procedures.filter(p => p.code).map(p => p.code || p.name || JSON.stringify(p)).join(', ') : recData.procedures}`) || recData.description || 'Record entry'}</span>
                            {recData.treatment && <span className="text-xs text-slate-500 block">Treatment: {recData.treatment}</span>}
                            {recData.results && <span className="text-xs text-slate-500 block">Results: {typeof recData.results === 'string' ? recData.results : JSON.stringify(recData.results)}</span>}
                            {recData.status && <span className={`text-xs font-semibold block ${recData.status === 'fulfilled' || recData.status === 'approved' || recData.status === 'completed' ? 'text-green-600' : recData.status === 'denied' ? 'text-red-600' : 'text-amber-600'}`}>Status: {recData.status.toUpperCase()}</span>}
                            {recData.totalAmount && <span className="text-xs text-slate-500 block">Amount: ${recData.totalAmount}</span>}
                          </div>
                        </TableCell>
                        <TableCell>
                          {embeddedDocUrl ? (
                            <DocumentViewer documentUrl={embeddedDocUrl} />
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    )})}
                    {records.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={5} className="text-center py-6 text-slate-500">No medical records found on the ledger.</TableCell>
                        </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {currentPath === '/consents' && (
            <div className="space-y-6 max-w-3xl">
              {pendingRequests.length > 0 && (
                <Card className="border-l-4 border-l-yellow-500">
                  <CardHeader>
                    <CardTitle className=" flex items-center text-yellow-700">Pending Access Requests</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {pendingRequests.map(req => (
                        <div key={req.hospitalOrg} className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 border rounded-lg bg-yellow-50 border-yellow-100 shadow-sm">
                           <div className="mb-3 sm:mb-0">
                                <h4 className="font-bold text-slate-800 flex items-center"><ShieldAlertIcon className="w-4 h-4 mr-2 text-yellow-500"/> {req.hospitalOrg}</h4>
                                <p className="text-xs text-slate-500 mt-1">Requested at: {new Date(req.requestedAt).toLocaleString()}</p>
                           </div>
                           <div className="flex space-x-2 w-full sm:w-auto">
                               <Button size="sm" disabled={isLoading} onClick={() => handleApproveRequest(req.hospitalOrg)} className="bg-green-600 hover:bg-green-700 flex-1 sm:flex-none">Approve</Button>
                               <Button size="sm" disabled={isLoading} onClick={() => handleRejectRequest(req.hospitalOrg)} className="bg-red-600 hover:bg-red-700 flex-1 sm:flex-none">Reject</Button>
                           </div>
                        </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle className=" flex items-center"><Shield className="w-5 h-5 mr-2 text-green-500" /> Active Consents</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <p className="text-slate-600">
                    These organizations currently have view access to your medical records.
                  </p>
                  
                  {activeConsents.length > 0 ? (
                      <div className="space-y-3">
                         {activeConsents.map(consent => (
                            <div key={consent.hospitalOrg} className="flex justify-between items-center p-4 border rounded-lg hover:shadow-sm transition-shadow">
                               <div>
                                    <h4 className="font-bold text-slate-800">{consent.hospitalOrg}</h4>
                                    <p className="text-xs text-slate-500">Granted at: {new Date(consent.grantedAt).toLocaleString()}</p>
                               </div>
                               <Button size="sm" variant="danger" disabled={isLoading} onClick={() => handleRevokeConsentInline(consent.hospitalOrg)}>
                                   Revoke Access
                               </Button>
                            </div>
                         ))}
                      </div>
                  ) : (
                      <p className="text-sm text-slate-500 italic">No active consents found.</p>
                  )}

                  <div className="flex space-x-4 pt-6 mt-4 border-t border-slate-100">
                      <Button onClick={() => setConsentModalOpen(true)} className="flex items-center text-sm" variant="secondary">
                      <Key className="w-4 h-4 mr-2" /> Grant New Access Manually
                      </Button>
                      <Button onClick={() => setRevokeModalOpen(true)} variant="secondary" className="flex items-center text-sm text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200">
                      <Lock className="w-4 h-4 mr-2" /> Revoke Access Manually
                      </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
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
                      <TableHead>Additional Details</TableHead>
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
                          <TableCell className="text-sm">
                            <div className="space-y-1">
                                {logData.hospitalOrg && <p><span className="font-semibold text-slate-500">Hospital:</span> {logData.hospitalOrg}</p>}
                                {logData.recordType && <p><span className="font-semibold text-slate-500">Record Type:</span> {logData.recordType}</p>}
                                {logData.diagnosis && <p><span className="font-semibold text-slate-500">Diagnosis:</span> {logData.diagnosis}</p>}
                                {logData.treatment && <p><span className="font-semibold text-slate-500">Treatment:</span> {logData.treatment}</p>}
                                {logData.notes && <p><span className="font-semibold text-slate-500">Notes:</span> {logData.notes}</p>}
                                {logData.testType && <p><span className="font-semibold text-slate-500">Test:</span> {logData.testType}</p>}
                                {logData.results && <p><span className="font-semibold text-slate-500">Results:</span> {typeof logData.results === 'string' ? logData.results : JSON.stringify(logData.results)}</p>}
                                {logData.medications && <p><span className="font-semibold text-slate-500">Medications:</span> {Array.isArray(logData.medications) ? logData.medications.map(m=>m.medicationInfo?.name || m.name || m).join(', ') : JSON.stringify(logData.medications)}</p>}
                                {logData.procedures && <p><span className="font-semibold text-slate-500">Procedures:</span> {Array.isArray(logData.procedures) ? logData.procedures.map(p=>p.name || (typeof p === 'string' ? p : JSON.stringify(p))).join(', ') : JSON.stringify(logData.procedures)}</p>}
                                {logData.approvedAmount && <p><span className="font-semibold text-green-600">Approved:</span> ${logData.approvedAmount}</p>}
                                {logData.totalAmount && <p><span className="font-semibold text-slate-500">Total Claim:</span> ${logData.totalAmount}</p>}
                                {logData.denialReason && <p><span className="font-semibold text-red-500">Denial Reason:</span> {logData.denialReason}</p>}
                                {logData.s3Key && (
                                  <div className="mt-2">
                                     <DocumentViewer documentUrl={logData.s3Key} />
                                  </div>
                                )}
                                {/* Extract embedded documentUrl from medications/procedures in audit logs */}
                                {!logData.s3Key && Array.isArray(logData.medications) && logData.medications.find(m => m.documentUrl) && (
                                  <div className="mt-2">
                                     <DocumentViewer documentUrl={logData.medications.find(m => m.documentUrl).documentUrl} />
                                  </div>
                                )}
                                {!logData.s3Key && Array.isArray(logData.procedures) && logData.procedures.find(p => p.documentUrl) && (
                                  <div className="mt-2">
                                     <DocumentViewer documentUrl={logData.procedures.find(p => p.documentUrl).documentUrl} />
                                  </div>
                                )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )})}
                      {auditLogs.length === 0 && (
                          <TableRow>
                              <TableCell colSpan={4} className="text-center py-6 text-slate-500">No audit logs found.</TableCell>
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

function ShieldAlertIcon(props) {
  return <svg {...props} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3Z" /></svg>;
}
