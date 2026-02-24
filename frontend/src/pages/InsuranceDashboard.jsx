import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '../components/ui/Card';
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '../components/ui/Table';
import { Button } from '../components/ui/Button';
import { ShieldAlert, FileSearch, CheckCircle2, XCircle } from 'lucide-react';

export default function InsuranceDashboard() {
  const [claims, setClaims] = useState([
    { id: 'CLM-00912', patient: 'patient_bob', hospital: 'HospitalA', service: 'Emergency Room Visit', amount: '$1,250.00', status: 'pending', date: '2023-11-20' },
    { id: 'CLM-00913', patient: 'patient_alice', hospital: 'HospitalB', service: 'MRI Scan', amount: '$3,400.00', status: 'pending', date: '2023-11-22' }
  ]);

  const handleProcessClaim = (id, newStatus) => {
    const updated = claims.map(c => c.id === id ? { ...c, status: newStatus } : c);
    setClaims(updated);
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
                    {claims.map((claim) => (
                      <TableRow key={claim.id}>
                        <TableCell>
                          <div className="font-mono text-sm font-bold text-slate-700">{claim.id}</div>
                          <div className="text-xs text-slate-500">{claim.date}</div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-slate-900">{claim.patient}</div>
                          <div className="text-xs text-slate-500">{claim.hospital}</div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-slate-900">{claim.service}</div>
                          <div className="text-sm font-semibold text-emerald-600">{claim.amount}</div>
                        </TableCell>
                        <TableCell>
                          {claim.status === 'pending' && <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-semibold">Under Review</span>}
                          {claim.status === 'approved' && <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">Approved</span>}
                          {claim.status === 'rejected' && <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-semibold">Rejected</span>}
                        </TableCell>
                        <TableCell className="text-right">
                          {claim.status === 'pending' ? (
                            <div className="flex justify-end space-x-2">
                              <Button size="sm" className="bg-green-600 hover:bg-green-700 px-2" onClick={() => handleProcessClaim(claim.id, 'approved')} title="Approve">
                                <CheckCircle2 className="w-4 h-4" />
                              </Button>
                              <Button size="sm" variant="danger" className="px-2" onClick={() => handleProcessClaim(claim.id, 'rejected')} title="Reject">
                                <XCircle className="w-4 h-4" />
                              </Button>
                            </div>
                          ) : (
                             <span className="text-xs text-slate-400 font-medium italic">Processed</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
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
