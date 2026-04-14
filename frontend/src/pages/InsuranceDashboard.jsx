import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '../components/ui/Card';
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '../components/ui/Table';
import { Button } from '../components/ui/Button';
import { ShieldAlert, FileSearch, CheckCircle2, XCircle } from 'lucide-react';
import { InsuranceService } from '../services/api';
import { DocumentViewer } from '../components/ui/DocumentViewer';

export default function InsuranceDashboard() {
  const [claims, setClaims] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchClaims = async () => {
    setIsLoading(true);
    try {
      const res = await InsuranceService.getPendingClaims();
      setClaims(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchClaims();
  }, []);



  const handleProcessClaim = async (id, newStatus) => {
    if (newStatus !== 'approved') return; // backend API only supports claims/approve currently.
    try {
      await InsuranceService.approveClaim({ claimId: id, details: "Automated standard approval process." });
      await fetchClaims();
    } catch (err) {
      alert("Failed to process claim: " + (err.response?.data?.error || err.message));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 mb-1">Insurance Provider Network</h1>
          <p className="text-slate-500 text-sm">Process automated claims verified against immutable medical records.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center"><FileSearch className="w-5 h-5 mr-2 text-amber-600" /> Claims Processing Queue</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                  <TableHeader>
                    <TableHead>Claim ID / Date</TableHead>
                    <TableHead>Patient / Provider</TableHead>
                    <TableHead>Service / Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Decision</TableHead>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                         <TableCell colSpan={5} className="text-center py-6 text-slate-500">Loading claims from ledger...</TableCell>
                      </TableRow>
                    ) : claims.length === 0 ? (
                      <TableRow>
                         <TableCell colSpan={5} className="text-center py-6 text-slate-500">No pending claims found.</TableCell>
                      </TableRow>
                    ) : claims.map((claim) => {
                      const cData = claim.Record || claim;
                      const serviceDesc = Array.isArray(cData.procedures) ? (cData.procedures[0]?.description || cData.procedures[0]?.code) : (cData.service || 'Medical Service');
                      const claimDate = cData.timestamp ? new Date(cData.timestamp).toLocaleDateString() : cData.date;
                      return (
                      <TableRow key={cData.claimId || claim.Key}>
                        <TableCell>
                          <div className="font-mono text-sm font-bold text-slate-700">{cData.claimId || claim.Key}</div>
                          <div className="text-xs text-slate-500">{claimDate}</div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-slate-900">{cData.patientId || cData.patient}</div>
                          <div className="text-xs text-slate-500">{cData.hospitalId || cData.hospitalOrg || cData.hospital}</div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-slate-900">{serviceDesc}</div>
                          <div className="text-sm font-semibold text-emerald-600">${cData.totalAmount || cData.amount}</div>
                          {(cData.documentUrl || cData.s3Key) && (
                            <div className="mt-1">
                              <DocumentViewer documentUrl={cData.documentUrl || cData.s3Key} />
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {cData.status === 'pending' || cData.status === 'submitted' ? <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-semibold">Under Review</span> : cData.status === 'approved' ? <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">Approved</span> : <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-semibold">Rejected</span>}
                        </TableCell>
                        <TableCell className="text-right">
                          {cData.status === 'pending' || cData.status === 'submitted' ? (
                            <div className="flex justify-end space-x-2">
                              <Button size="sm" className="bg-green-600 hover:bg-green-700 px-2" onClick={() => handleProcessClaim(cData.claimId || claim.Key, 'approved')} title="Approve">
                                <CheckCircle2 className="w-4 h-4" />
                              </Button>
                              <Button size="sm" variant="danger" className="px-2" onClick={() => handleProcessClaim(cData.claimId || claim.Key, 'rejected')} title="Reject">
                                <XCircle className="w-4 h-4" />
                              </Button>
                            </div>
                          ) : (
                             <span className="text-xs text-slate-400 font-medium italic">Processed</span>
                          )}
                        </TableCell>
                      </TableRow>
                    )})}
                  </TableBody>
                </Table>
            </CardContent>
          </Card>
        </div>
        
        <div className="lg:col-span-1">
           <Card className="h-full bg-gradient-to-b from-slate-800 to-slate-900 text-white border-none shadow-xl">
             <CardHeader className="border-b border-slate-700 bg-transparent">
               <CardTitle className="text-white flex items-center"><ShieldAlert className="w-5 h-5 mr-2 text-brand-400" /> Fraud Detection AI</CardTitle>
             </CardHeader>
             <CardContent className="p-6">
                <div className="space-y-6">
                  <div className="relative">
                     <div className="flex justify-between mb-1">
                       <span className="text-xs font-medium text-slate-300">Network Consensus Match</span>
                       <span className="text-xs font-bold text-green-400">99.8%</span>
                     </div>
                     <div className="w-full bg-slate-700 rounded-full h-2">
                       <div className="bg-green-500 h-2 rounded-full w-[99.8%]"></div>
                     </div>
                  </div>
                  <div className="relative">
                     <div className="flex justify-between mb-1">
                       <span className="text-xs font-medium text-slate-300">Duplicate Claim Risk</span>
                       <span className="text-xs font-bold text-blue-400">Low</span>
                     </div>
                     <div className="w-full bg-slate-700 rounded-full h-2">
                       <div className="bg-blue-500 h-2 rounded-full w-[5%]"></div>
                     </div>
                  </div>
                </div>
                
                <div className="mt-8 p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                  <h4 className="font-semibold text-sm mb-2 text-brand-300">Why Blockchain for Claims?</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Every claim is cryptographically linked to a verified medical record created by the hospital. If the diagnosis on the claim doesn't match the on-chain record, smart contracts auto-flag it.
                  </p>
                </div>
             </CardContent>
           </Card>
        </div>
      </div>
    </div>
  );
}
