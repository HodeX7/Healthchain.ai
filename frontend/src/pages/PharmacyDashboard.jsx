import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '../components/ui/Table';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Pill, Check, Clock } from 'lucide-react';

export default function PharmacyDashboard() {
  const [prescriptions, setPrescriptions] = useState([
    { id: 'RX-7721', patient: 'patient_alice', drug: 'Amoxicillin 500mg', instructions: '1 tablet twice a day', status: 'pending', date: '2023-11-21T08:15:00Z', hospital: 'HospitalA' }
  ]);
  const [selectedRx, setSelectedRx] = useState(null);

  const handleFulfill = (e) => {
    e.preventDefault();
    const updated = prescriptions.map(p => p.id === selectedRx.id ? { ...p, status: 'fulfilled' } : p);
    setPrescriptions(updated);
    setSelectedRx(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 mb-1">Pharmacy Network</h1>
          <p className="text-slate-500 text-sm">Review incoming digital prescriptions and record fulfillment.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className=" flex items-center"><Pill className="w-5 h-5 mr-2 text-green-600" /> Prescription Queue</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
           <Table>
              <TableHeader>
                <TableHead>Rx ID</TableHead>
                <TableHead>Patient ID</TableHead>
                <TableHead>Medication</TableHead>
                <TableHead>Issued By</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Action</TableHead>
              </TableHeader>
              <TableBody>
                {prescriptions.map((rx) => (
                  <TableRow key={rx.id}>
                    <TableCell className="font-mono text-sm font-medium text-slate-700">{rx.id}</TableCell>
                    <TableCell className="text-slate-500">{rx.patient}</TableCell>
                    <TableCell className="font-medium text-slate-900">
                       {rx.drug}
                       <div className="text-xs text-slate-500 truncate w-48">{rx.instructions}</div>
                    </TableCell>
                    <TableCell className="text-slate-500">{rx.hospital}</TableCell>
                    <TableCell>
                      {rx.status === 'pending' ? (
                         <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-semibold flex items-center w-[85px] justify-center"><Clock className="w-3 h-3 mr-1"/> Pending</span>
                      ) : (
                         <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold flex items-center w-[85px] justify-center"><Check className="w-3 h-3 mr-1"/> Fulfilled</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {rx.status === 'pending' ? (
                        <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => setSelectedRx(rx)}>
                          Dispense Meds
                        </Button>
                      ) : (
                        <Button size="sm" variant="ghost" disabled>Completed</Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
        </CardContent>
      </Card>

      <Modal isOpen={!!selectedRx} onClose={() => setSelectedRx(null)} title="Fulfill Prescription">
        {selectedRx && (
          <form onSubmit={handleFulfill} className="space-y-5">
             <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="flex justify-between border-b border-slate-200 pb-2 mb-2">
                   <span className="text-slate-500 text-sm">Medication</span>
                   <span className="font-bold text-slate-900">{selectedRx.drug}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200 pb-2 mb-2">
                   <span className="text-slate-500 text-sm">Instructions</span>
                   <span className="font-medium text-slate-700 text-right max-w-[200px]">{selectedRx.instructions}</span>
                </div>
                <div className="flex justify-between">
                   <span className="text-slate-500 text-sm">Patient ID</span>
                   <span className="font-mono text-slate-700 text-sm">{selectedRx.patient}</span>
                </div>
             </div>
             
             <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Pharmacist Notes</label>
                <textarea className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-green-500 focus:border-green-500" rows="2" placeholder="Brand dispensed, warnings given..."></textarea>
             </div>
             
             <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-start">
               <Check className="w-5 h-5 text-green-600 mr-2 shrink-0 mt-0.5" />
               <p className="text-xs text-green-800 tracking-tight">
                 By confirming, a cryptographic transaction will be saved to the ledger marking this prescription as fulfilled to prevent double-dispensing.
               </p>
             </div>

             <div className="pt-2 flex justify-end space-x-2">
               <Button type="button" variant="ghost" onClick={() => setSelectedRx(null)}>Cancel</Button>
               <Button type="submit" className="bg-green-600 hover:bg-green-700 focus:ring-green-500">Confirm Dispensed</Button>
             </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
