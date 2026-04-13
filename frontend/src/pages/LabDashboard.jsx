import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '../components/ui/Table';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { FlaskConical, UploadCloud, CheckCircle2, Clock } from 'lucide-react';
import { LabService, DocumentService } from '../services/api';
import { DocumentUploader } from '../components/ui/DocumentUploader';
import { DocumentViewer } from '../components/ui/DocumentViewer';

export default function LabDashboard() {
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);

  const fetchOrders = async () => {
    setIsLoading(true);
    try {
      const res = await LabService.getOrders();
      setOrders(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);
  const [documentUrl, setDocumentUrl] = useState(null);
  const [notes, setNotes] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const handleDocumentAttach = (url) => setDocumentUrl(url);

  const handleUpload = async (e) => {
    e.preventDefault();
    setIsUploading(true);
    try {
      
      await LabService.uploadReport({
          reportId: `REP${Math.floor(Math.random()*1000)}`,
          orderId: selectedOrder.orderId || selectedOrder.id,
          patientId: selectedOrder.patientId || selectedOrder.patient,
          testName: selectedOrder.testName || selectedOrder.test,
          testResults: { notes },
          documentUrl
      });
      
      setSelectedOrder(null);
      setDocumentUrl(null);
      setNotes('');
      await fetchOrders();
    } catch (err) {
      alert("Failed to upload report: " + (err.response?.data?.error || err.message));
    } finally {
      setIsUploading(false);
    }
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
        <StatCard title="Pending Orders" val={orders.filter(o=>{ const d = o.Record || o; return d.status === 'pending' || d.status === 'ordered'; }).length} icon={Clock} color="text-amber-500" bg="bg-amber-50"/>
        <StatCard title="Completed Today" val={orders.filter(o=>{ const d = o.Record || o; return d.status === 'completed'; }).length} icon={CheckCircle2} color="text-green-500" bg="bg-green-50"/>
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
                {isLoading ? (
                  <TableRow>
                     <TableCell colSpan={6} className="text-center py-6 text-slate-500">Loading orders from ledger...</TableCell>
                  </TableRow>
                ) : orders.length === 0 ? (
                  <TableRow>
                     <TableCell colSpan={6} className="text-center py-6 text-slate-500">No lab orders found.</TableCell>
                  </TableRow>
                ) : orders.map((o) => {
                  const oData = o.Record || o;
                  return (
                  <TableRow key={oData.orderId || o.Key}>
                    <TableCell className="font-mono text-sm font-medium text-slate-700">{oData.orderId || o.Key}</TableCell>
                    <TableCell className="text-slate-500">{oData.patientId || oData.patient}</TableCell>
                    <TableCell className="font-medium">{oData.testName || oData.test}</TableCell>
                    <TableCell className="text-slate-500">{oData.hospitalOrg || oData.hospitalMsp || oData.orderedBy || 'N/A'}</TableCell>
                    <TableCell>
                      {oData.status === 'pending' || oData.status === 'ordered' ? (
                        <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-semibold flex items-center w-20 justify-center">Pending</span>
                      ) : (
                        <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold flex items-center w-20 justify-center">Completed</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {oData.status === 'pending' || oData.status === 'ordered' ? (
                        <Button size="sm" variant="secondary" onClick={() => setSelectedOrder(oData)}>
                          Upload Results
                        </Button>
                      ) : (
                        <Button size="sm" variant="ghost" disabled>View Report</Button>
                      )}
                    </TableCell>
                  </TableRow>
                )})}
              </TableBody>
            </Table>
        </CardContent>
      </Card>

      <Modal isOpen={!!selectedOrder} onClose={() => setSelectedOrder(null)} title="Upload Lab Results">
        {selectedOrder && (
          <form onSubmit={handleUpload} className="space-y-4">
             <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mb-4">
                <p className="text-sm font-medium"><span className="text-slate-500">Test:</span> {selectedOrder.testName || selectedOrder.test}</p>
                <p className="text-sm font-medium"><span className="text-slate-500">Order ID:</span> {selectedOrder.orderId || selectedOrder.id}</p>
             </div>
             <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Result Notes</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-purple-500" rows="3" placeholder="Enter findings..."></textarea>
             </div>
             
             <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Attach Final Report (PDF)</label>
                <DocumentUploader onUploadComplete={handleDocumentAttach} />
             </div>
             
             <div className="pt-4 flex justify-end space-x-2">
               <Button type="button" variant="ghost" onClick={() => setSelectedOrder(null)}>Cancel</Button>
               <Button type="submit" className="bg-purple-600 hover:bg-purple-700 focus:ring-purple-500" disabled={isUploading}>{isUploading ? 'Uploading...' : 'Submit Results'}</Button>
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
