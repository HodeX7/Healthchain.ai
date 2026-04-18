import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Search, Plus, FileText, FlaskConical, Pill, ShieldAlert, ShieldCheck, Key } from 'lucide-react';
import { HospitalService, DocumentService } from '../services/api';
import { DocumentUploader } from '../components/ui/DocumentUploader';
import { DocumentViewer } from '../components/ui/DocumentViewer';

export default function HospitalDashboard() {
  const [patientIdInput, setPatientIdInput] = useState('');
  const [activePatientId, setActivePatientId] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [patientData, setPatientData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [requestStatus, setRequestStatus] = useState('');
  
  // Modals state
  const [activeModal, setActiveModal] = useState(null); // 'note', 'lab', 'prescription', 'claim'
  const [modalLoading, setModalLoading] = useState(false);
  const [formData, setFormData] = useState({});
  const [selectedDocs, setSelectedDocs] = useState({}); // To hold fetched download links


  const fetchPatientRecords = async (idToFetch) => {
    setIsLoading(true);
    setRequestStatus('');
    try {
      const recordsRes = await HospitalService.getPatientRecords(idToFetch);
      if (recordsRes.status === 'access_pending') {
          setPatientData({ error: 'pending', message: recordsRes.message });
      } else {
          setPatientData({
            name: `Patient ${idToFetch}`,
            status: 'Access Granted',
            records: Array.isArray(recordsRes.data) ? recordsRes.data : []
          });
      }
    } catch (error) {
      console.error(error);
      const backendMsg = error.response?.data?.error || error.message;
      setPatientData({ error: backendMsg });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!patientIdInput) return;
    setHasSearched(true);
    setActivePatientId(patientIdInput);
    await fetchPatientRecords(patientIdInput);
  };

  const handleRequestAccess = async () => {
    setIsLoading(true);
    setRequestStatus('Requesting...');
    try {
      const hospitalMsp = localStorage.getItem('hc_role'); 
      const formattedMsp = hospitalMsp.charAt(0).toUpperCase() + hospitalMsp.slice(1) + 'OrgMSP';

      await HospitalService.requestAccess({
          patientId: activePatientId,
          hospitalMsp: formattedMsp,
          reason: "Medical consultation"
      });
      
      setRequestStatus('Request Sent! Waiting for Patient to grant access.');
    } catch (error) {
      const backendMsg = error.response?.data?.error || error.message;
      setRequestStatus(`Failed: ${backendMsg}`);
    } finally {
      setIsLoading(false);
    }
  };

  const openModal = (type) => {
    setFormData({});
    setActiveModal(type);
  };


  // Generate a sequential ID per patient using localStorage so the chaincode probe strategy can find it
  const getNextId = (prefix, patientId) => {
    const key = `hc_seq_${prefix}_${patientId}`;
    const next = parseInt(localStorage.getItem(key) || '0', 10) + 1;
    localStorage.setItem(key, String(next));
    return `${prefix}${String(next).padStart(3, '0')}`;
  };

  const handleModalSubmit = async (e) => {
    e.preventDefault();
    setModalLoading(true);
    try {
      const dataPayload = { patientId: activePatientId, ...formData };
      
      switch(activeModal) {
          case 'note':
              dataPayload.recordId = getNextId('REC', activePatientId);
              await HospitalService.createRecord(dataPayload);
              break;
          case 'lab':
              dataPayload.orderId = getNextId('ORD', activePatientId);
              await HospitalService.orderLabTest(dataPayload);
              break;
          case 'prescription':
              dataPayload.prescriptionId = getNextId('RX', activePatientId);
              // Embed documentUrl inside medications JSON since chaincode stores it as-is
              dataPayload.medications = [{ name: formData.medication, dosage: formData.dosage, documentUrl: formData.documentUrl || '' }];
              await HospitalService.issuePrescription(dataPayload);
              break;
          case 'claim':
              dataPayload.procedures = [{ code: formData.serviceDetails, cost: formData.amount, documentUrl: formData.documentUrl || '' }];
              dataPayload.claimId = getNextId('CLM', activePatientId);
              dataPayload.serviceDate = new Date().toISOString().split('T')[0];
              dataPayload.totalAmount = formData.amount;
              await HospitalService.submitClaim(dataPayload);
              break;
      }
      setActiveModal(null);
      // Refresh timeline
      await fetchPatientRecords(activePatientId);
    } catch (error) {
        const backendMsg = error.response?.data?.error || error.message;
        alert(`Action failed: ${backendMsg}`);
        console.error(error);
    } finally {
        setModalLoading(false);
    }
  };

  const handleFormChange = (e) => {
      setFormData({...formData, [e.target.name]: e.target.value});
  };

  const handleDocumentAttach = (url) => {
      setFormData({...formData, documentUrl: url});
  };


  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 mb-1">Hospital Workstation</h1>
          <p className="text-slate-500 text-sm">Access patient records, order labs, and manage treatments.</p>
        </div>
        <div className="flex space-x-2">
          <Button variant="secondary" onClick={() => { setActivePatientId(''); setHasSearched(false); setPatientIdInput(''); }}><Plus className="w-4 h-4 mr-2"/> Clear Dashboard</Button>
        </div>
      </div>

      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-100">
        <CardContent className="p-6">
          <form onSubmit={handleSearch} className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="block text-sm font-semibold text-blue-900 mb-1">Search Patient Record</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                <input 
                  type="text" 
                  className="w-full pl-10 pr-4 py-3 rounded-xl border-none shadow-sm focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter Patient ID (e.g. 12345)..."
                  value={patientIdInput}
                  onChange={(e) => setPatientIdInput(e.target.value)}
                />
              </div>
            </div>
            <Button type="submit" size="lg" className="bg-blue-600 hover:bg-blue-700 shadow-md h-[48px]" disabled={isLoading}>
              {isLoading ? 'Querying...' : 'Access Record'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {hasSearched && patientData && (
        <div className="animate-in slide-in-from-top-4 duration-300">
          {patientData.error ? (
            <div className={`p-4 ${patientData.error === 'pending' ? 'bg-yellow-50 border-yellow-200' : 'bg-red-50 border-red-200'} rounded-xl flex flex-col sm:flex-row sm:items-center justify-between shadow-sm`}>
                <div className="flex items-start sm:items-center mb-4 sm:mb-0">
                    <ShieldAlertIcon className={`w-6 h-6 mr-3 ${patientData.error === 'pending' ? 'text-yellow-600' : 'text-red-600'} flex-shrink-0`} />
                    <div>
                        <span className={`font-bold ${patientData.error === 'pending' ? 'text-yellow-900' : 'text-red-900'} block`}>
                            {patientData.error === 'pending' ? 'Access Pending' : 'Access Denied by Network'}
                        </span>
                        <p className={`text-sm ${patientData.error === 'pending' ? 'text-yellow-700' : 'text-red-700'} mt-1`}>
                            {patientData.error === 'pending' ? patientData.message : patientData.error}
                        </p>
                        {patientData.error !== 'pending' && <p className="text-xs text-red-600 mt-1 opacity-80">This usually means the patient has not explicitly granted your organization read access to their Private Data Collection.</p>}
                    </div>
                </div>
                
                {patientData.error !== 'pending' && (
                  <div className="flex flex-col items-end">
                    <Button onClick={handleRequestAccess} disabled={isLoading || requestStatus.includes('Sent')} className="whitespace-nowrap bg-red-600 hover:bg-red-700">
                      <Key className="w-4 h-4 mr-2" /> Request Access
                    </Button>
                    {requestStatus && <span className="text-xs font-medium text-red-600 mt-2">{requestStatus}</span>}
                  </div>
                )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Patient Quick Info */}
              <Card className="col-span-1 border-l-4 border-l-blue-500 flex flex-col">
                <CardHeader>
                  <CardTitle className=" text-blue-900">Patient Details</CardTitle>
                </CardHeader>
                <CardContent className="flex-1 overflow-auto">
                  <div className="flex items-center mb-4">
                    <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-xl mr-4 uppercase">
                      {activePatientId.charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-bold text-lg text-slate-900">{patientData.name}</h3>
                      <span className="text-xs font-semibold px-2 py-1 bg-green-100 text-green-700 rounded-full inline-flex items-center mt-1">
                        <ShieldCheckIcon className="w-3 h-3 mr-1" />
                        {patientData.status}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-3 mt-6">
                      <h4 className="text-xs uppercase font-bold text-slate-400 border-b pb-1">Patient Timeline: {patientData.records.length} records</h4>
                      {[...patientData.records]
                        .map(r => r.Record || r)
                        .sort((a, b) => {
                          const getTime = (r) => new Date(r.createdAt || r.issuedAt || r.submittedAt || r.completedAt || r.orderedAt || 0).getTime();
                          return getTime(b) - getTime(a);
                        })
                        .map((rec, i) => {
                          const docType = (rec.docType || '').toLowerCase();
                          
                          // Color coding per doc type
                          const colorMap = {
                            medicalrecord: { bar: 'bg-blue-400', badge: 'bg-blue-100 text-blue-700', label: 'CLINICAL NOTE' },
                            labreport: { bar: 'bg-purple-400', badge: 'bg-purple-100 text-purple-700', label: 'LAB REPORT' },
                            laborder: { bar: 'bg-violet-400', badge: 'bg-violet-100 text-violet-700', label: 'LAB ORDER' },
                            prescription: { bar: 'bg-green-400', badge: 'bg-green-100 text-green-700', label: 'PRESCRIPTION' },
                            insuranceclaim: { bar: 'bg-amber-400', badge: 'bg-amber-100 text-amber-700', label: 'INSURANCE CLAIM' },
                          };
                          const style = colorMap[docType] || { bar: 'bg-slate-400', badge: 'bg-slate-100 text-slate-700', label: (rec.docType || 'DOCUMENT').toUpperCase() };

                          // Org tag
                          const orgTag = rec.hospitalOrg || rec.labOrg || '';
                          
                          // Extract embedded documentUrl from medications or procedures arrays
                          let embeddedDocUrl = rec.documentUrl || rec.s3Key || '';
                          if (!embeddedDocUrl && Array.isArray(rec.medications)) {
                            const docEntry = rec.medications.find(m => m.documentUrl);
                            if (docEntry) embeddedDocUrl = docEntry.documentUrl;
                          }
                          if (!embeddedDocUrl && Array.isArray(rec.procedures)) {
                            const docEntry = rec.procedures.find(p => p.documentUrl);
                            if (docEntry) embeddedDocUrl = docEntry.documentUrl;
                          }
                          
                          // Date display
                          const dateStr = rec.createdAt || rec.issuedAt || rec.submittedAt || rec.completedAt || rec.orderedAt;
                          
                          return (
                          <div key={i} className="text-sm border p-3 rounded-lg bg-slate-50 shadow-sm relative overflow-hidden">
                              <div className={`absolute top-0 left-0 w-1 h-full ${style.bar}`}></div>
                              <div className="flex items-center justify-between mb-1">
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${style.badge}`}>{style.label}</span>
                                  <span className="text-xs text-slate-400">{dateStr ? new Date(dateStr).toLocaleString() : 'Unknown'}</span>
                              </div>
                              
                              {/* Org Tag */}
                              {orgTag && (
                                <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-600 mb-1 border border-indigo-100">
                                  🏥 {orgTag}
                                </span>
                              )}
                              
                              {/* Main content per type */}
                              <span className="font-medium text-slate-800 break-words block">
                                {rec.diagnosis || rec.testType || (rec.medications && `Rx: ${Array.isArray(rec.medications) ? rec.medications.filter(m => m.name).map(m => `${m.name}${m.dosage ? ' — ' + m.dosage : ''}`).join(', ') : rec.medications}`) || (rec.procedures && `Claim: ${Array.isArray(rec.procedures) ? rec.procedures.filter(p => p.code).map(p => p.code || p.name || JSON.stringify(p)).join(', ') : rec.procedures}`) || rec.description || 'Data Entry'}
                              </span>
                              
                              {/* Extra details */}
                              {rec.treatment && <span className="text-xs text-slate-500 block mt-1">Treatment: {rec.treatment}</span>}
                              {rec.results && <span className="text-xs text-slate-500 block mt-1">Results: {typeof rec.results === 'string' ? rec.results : JSON.stringify(rec.results)}</span>}
                              {rec.status && <span className={`text-xs font-semibold block mt-1 ${rec.status === 'fulfilled' || rec.status === 'approved' || rec.status === 'completed' ? 'text-green-600' : rec.status === 'denied' ? 'text-red-600' : 'text-amber-600'}`}>Status: {rec.status.toUpperCase()}</span>}
                              {rec.totalAmount && <span className="text-xs text-slate-500 block mt-1">Amount: ${rec.totalAmount}</span>}
                              {rec.notes && <span className="text-xs text-slate-500 block mt-1">Notes: {rec.notes}</span>}

                              <span className="text-xs text-slate-400 mt-2 block break-all">ID: {rec.recordId || rec.orderId || rec.prescriptionId || rec.claimId || rec.reportId || 'N/A'}</span>
                              {embeddedDocUrl && (
                                <DocumentViewer documentUrl={embeddedDocUrl} />
                              )}
                          </div>
                      )})}
                      {patientData.records.length === 0 && (
                          <div className="p-4 bg-slate-50 rounded-lg text-center border border-dashed">
                              <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                              <p className="text-sm text-slate-500 font-medium">No historical records on ledger.</p>
                          </div>
                      )}
                  </div>
                </CardContent>
              </Card>

              {/* Action Board */}
              <div className="col-span-1 md:col-span-2 space-y-4">
                <h3 className="text-lg font-semibold tracking-tight text-slate-900 px-1">Clinical Actions for {activePatientId}</h3>
                <div className="grid grid-cols-2 gap-4">
                  <ActionCard onClick={() => openModal('note')} icon={FileText} title="Add Clinical Note" desc="Append to medical history" color="text-indigo-600" bg="bg-indigo-50" border="border-indigo-100" hover="hover:border-indigo-300 hover:shadow-md" />
                  <ActionCard onClick={() => openModal('lab')} icon={FlaskConical} title="Order Lab Test" desc="Send request to LabOrg" color="text-purple-600" bg="bg-purple-50" border="border-purple-100" hover="hover:border-purple-300 hover:shadow-md" />
                  <ActionCard onClick={() => openModal('prescription')} icon={Pill} title="Issue Prescription" desc="Send to Pharmacy network" color="text-green-600" bg="bg-green-50" border="border-green-100" hover="hover:border-green-300 hover:shadow-md" />
                  <ActionCard onClick={() => openModal('claim')} icon={ShieldCheckIcon} title="Submit Claim" desc="Forward to Insurance" color="text-amber-600" bg="bg-amber-50" border="border-amber-100" hover="hover:border-amber-300 hover:shadow-md" />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Dynamic Modal for Actions */}
      <Modal 
          isOpen={!!activeModal} 
          onClose={() => setActiveModal(null)} 
          title={
              activeModal === 'note' ? 'Append Clinical Note' :
              activeModal === 'lab' ? 'Order Lab Test' :
              activeModal === 'prescription' ? 'Issue Prescription' :
              'Submit Insurance Claim'
          }
      >
          <form onSubmit={handleModalSubmit} className="space-y-4">
              <p className="text-sm text-slate-500 mb-4 bg-slate-50 p-2 rounded border border-slate-100">
                  Target Identity: <strong className="text-slate-900">{activePatientId}</strong>
              </p>

              {activeModal === 'note' && (
                  <>
                      <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Diagnosis</label>
                          <input required name="diagnosis" value={formData.diagnosis || ''} onChange={handleFormChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g. Hypertension" />
                      </div>
                      <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Treatment / Recommendations</label>
                          <textarea required name="treatment" value={formData.treatment || ''} onChange={handleFormChange} rows={3} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Prescribed rest and medication..." />
                      </div>
                      <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Attach PDF (Optional)</label>
                          <DocumentUploader onUploadComplete={handleDocumentAttach} />
                      </div>
                  </>
              )}

              {activeModal === 'lab' && (
                  <>
                      <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Target Laboratory MSP</label>
                          <select required name="labMsp" value={formData.labMsp || ''} onChange={handleFormChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                              <option value="">Select Lab...</option>
                              <option value="LabOrgMSP">Central Lab (LabOrgMSP)</option>
                          </select>
                      </div>
                      <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Test Type</label>
                          <input required name="testType" value={formData.testType || ''} onChange={handleFormChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g. Complete Blood Count" />
                      </div>
                      <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Instructions for Lab</label>
                          <input required name="instructions" value={formData.instructions || ''} onChange={handleFormChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g. Fasting required" />
                      </div>
                  </>
              )}

              {activeModal === 'prescription' && (
                  <>
                      <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Pharmacy Network</label>
                          <select required name="pharmacyMsp" value={formData.pharmacyMsp || ''} onChange={handleFormChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                              <option value="">Select Pharmacy Hub...</option>
                              <option value="PharmacyOrgMSP">National Pharmacy Network (PharmacyOrgMSP)</option>
                          </select>
                      </div>
                      <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Medication</label>
                          <input required name="medication" value={formData.medication || ''} onChange={handleFormChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g. Amoxicillin 500mg" />
                      </div>
                      <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Dosage / Instructions</label>
                          <input required name="dosage" value={formData.dosage || ''} onChange={handleFormChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g. 1 pill twice a day for 7 days" />
                      </div>
                      <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Attach PDF (Optional)</label>
                          <DocumentUploader onUploadComplete={handleDocumentAttach} />
                      </div>
                  </>
              )}

              {activeModal === 'claim' && (
                  <>
                      <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Insurance Provider MSP</label>
                          <select required name="insuranceMsp" value={formData.insuranceMsp || ''} onChange={handleFormChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                              <option value="">Select Insurer...</option>
                              <option value="InsuranceOrgMSP">HealthCareInc (InsuranceOrgMSP)</option>
                          </select>
                      </div>
                      <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Service Provided</label>
                          <input required name="serviceDetails" value={formData.serviceDetails || ''} onChange={handleFormChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g. Emergency Room Visit" />
                      </div>
                      <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Claim Amount ($)</label>
                          <input required type="number" name="amount" value={formData.amount || ''} onChange={handleFormChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g. 1500" />
                      </div>
                      <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Attach Invoice/Receipt (Optional PDF)</label>
                          <DocumentUploader onUploadComplete={handleDocumentAttach} />
                      </div>
                  </>
              )}

              <div className="pt-4 flex items-center justify-end border-t border-slate-100 mt-6 space-x-3">
                  <Button variant="ghost" type="button" onClick={() => setActiveModal(null)}>Cancel</Button>
                  <Button type="submit" disabled={modalLoading}>{modalLoading ? 'Confirming to Ledger...' : 'Sign & Submit'}</Button>
              </div>
          </form>
      </Modal>

    </div>
  );
}

function ActionCard({ icon: Icon, title, desc, color, bg, border, hover, onClick }) {
  return (
    <button onClick={onClick} className={`p-5 rounded-xl border ${border} ${bg} ${hover} transition-all duration-200 text-left group focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}>
      <Icon className={`w-8 h-8 ${color} mb-3 group-hover:scale-110 transition-transform`} />
      <h4 className="font-bold text-slate-900 mb-1">{title}</h4>
      <p className="text-xs text-slate-600">{desc}</p>
    </button>
  );
}

function ShieldAlertIcon(props) {
  return <svg {...props} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3Z" /></svg>;
}
function ShieldCheckIcon(props) {
  return <svg {...props} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 0 1-1.043 3.296 3.745 3.745 0 0 1-3.296 1.043A3.745 3.745 0 0 1 12 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 0 1-3.296-1.043 3.745 3.745 0 0 1-1.043-3.296A3.745 3.745 0 0 1 3 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 0 1 1.043-3.296 3.746 3.746 0 0 1 3.296-1.043A3.746 3.746 0 0 1 12 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 0 1 3.296 1.043 3.746 3.746 0 0 1 1.043 3.296A3.745 3.745 0 0 1 21 12Z" /></svg>;
}
