import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '../components/ui/Table';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { FlaskConical, UploadCloud, CheckCircle2, Clock } from 'lucide-react';

export default function LabDashboard() {
  const [orders, setOrders] = useState([
    { id: 'ORD-1029', patient: 'patient_alice', test: 'Complete Blood Count', status: 'pending', date: '2023-11-20T09:00:00Z', orderedBy: 'HospitalA' },
    { id: 'ORD-1030', patient: 'patient_bob', test: 'Lipid Panel', status: 'completed', date: '2023-11-19T14:30:00Z', orderedBy: 'HospitalB' }
  ]);
  const [selectedOrder, setSelectedOrder] = useState(null);

  const handleUpload = (e) => {
    e.preventDefault();
    const updated = orders.map(o => o.id === selectedOrder.id ? { ...o, status: 'completed' } : o);
    setOrders(updated);
    setSelectedOrder(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 mb-1">Laboratory Portal</h1>
          <p className="text-slate-500 text-sm">Process incoming lab tests and publish results to the blockchain.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <StatCard title="Pending Orders" val={orders.filter(o=>o.status==='pending').length} icon={Clock} color="text-amber-500" bg="bg-amber-50"/>
        <StatCard title="Completed Today" val={orders.filter(o=>o.status==='completed').length} icon={CheckCircle2} color="text-green-500" bg="bg-green-50"/>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className=" flex items-center"><FlaskConical className="w-5 h-5 mr-2 text-purple-600" /> Lab Test Pipeline</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
           <Table>
              <TableHeader>
                <TableHead>Order ID</TableHead>
                <TableHead>Patient ID</TableHead>
                <TableHead>Requested Test</TableHead>
                <TableHead>Ordered By</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Action</TableHead>
              </TableHeader>
              <TableBody>
                {orders.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-mono text-sm font-medium text-slate-700">{o.id}</TableCell>
                    <TableCell className="text-slate-500">{o.patient}</TableCell>
                    <TableCell className="font-medium">{o.test}</TableCell>
                    <TableCell className="text-slate-500">{o.orderedBy}</TableCell>
                    <TableCell>
                      {o.status === 'pending' ? (
                        <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-semibold flex items-center w-20 justify-center">Pending</span>
                      ) : (
                        <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold flex items-center w-20 justify-center">Completed</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {o.status === 'pending' ? (
                        <Button size="sm" variant="secondary" onClick={() => setSelectedOrder(o)}>
                          Upload Results
                        </Button>
                      ) : (
                        <Button size="sm" variant="ghost" disabled>View Report</Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
        </CardContent>
      </Card>

      <Modal isOpen={!!selectedOrder} onClose={() => setSelectedOrder(null)} title="Upload Lab Results">
        {selectedOrder && (
          <form onSubmit={handleUpload} className="space-y-4">
             <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mb-4">
                <p className="text-sm font-medium"><span className="text-slate-500">Test:</span> {selectedOrder.test}</p>
                <p className="text-sm font-medium"><span className="text-slate-500">Order ID:</span> {selectedOrder.id}</p>
             </div>
             <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Result Notes</label>
                <textarea className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-purple-500" rows="3" placeholder="Enter findings..."></textarea>
             </div>
             <div className="border border-dashed border-slate-300 rounded-xl p-8 text-center bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer">
                <UploadCloud className="w-8 h-8 text-purple-400 mx-auto mb-2" />
                <p className="text-sm text-slate-600 font-medium">Click to select PDF report file</p>
                <p className="text-xs text-slate-400 mt-1">File hash will be stored on-chain</p>
             </div>
             
             <div className="pt-4 flex justify-end space-x-2">
               <Button type="button" variant="ghost" onClick={() => setSelectedOrder(null)}>Cancel</Button>
               <Button type="submit" className="bg-purple-600 hover:bg-purple-700 focus:ring-purple-500">Submit Results</Button>
             </div>
          </form>
        )}
      </Modal>
    </div>
  );
}

function StatCard({ title, val, icon: Icon, color, bg }) {
  return (
    <Card>
      <CardContent className="p-5 flex items-center">
        <div className={`p-3 rounded-full ${bg} ${color} mr-4`}>
          <Icon className="w-6 h-6" />
        </div>
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <h4 className="text-2xl font-bold text-slate-900">{val}</h4>
        </div>
      </CardContent>
    </Card>
  );
}
