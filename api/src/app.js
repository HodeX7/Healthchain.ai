'use strict';

const express = require('express');
const cors = require('cors');

// Import modular routes
const patientRoutes = require('./routes/patientRoutes');
const hospitalRoutes = require('./routes/hospitalRoutes');
const labRoutes = require('./routes/labRoutes');
const pharmacyRoutes = require('./routes/pharmacyRoutes');
const insuranceRoutes = require('./routes/insuranceRoutes');
const uploadRoutes = require('./routes/uploadRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// API Register
app.use('/api/patient', patientRoutes);
app.use('/api/hospital', hospitalRoutes);
app.use('/api/lab', labRoutes);
app.use('/api/pharmacy', pharmacyRoutes);
app.use('/api/insurance', insuranceRoutes);
app.use('/api/documents', uploadRoutes);

// General health check
app.get('/', (req, res) => {
    res.json({
        status: 'ok',
        message: 'HealthChain Modular API is running 🩺',
        endpoints: {
            patient: '/api/patient',
            hospital: '/api/hospital',
            lab: '/api/lab',
            pharmacy: '/api/pharmacy',
            insurance: '/api/insurance',
            documents: '/api/documents/upload-url'
        }
    });
});

// Error handling map for 404
app.use((req, res) => {
    res.status(404).json({ success: false, error: 'Endpoint not found' });
});

app.listen(PORT, () => {
    console.log(`\n🩺  HealthChain API listening on http://localhost:${PORT}\n`);
    console.log('Available Modules:');
    console.log('  /api/patient     — Patient Organization operations');
    console.log('  /api/hospital    — Hospital Organization operations');
    console.log('  /api/lab         — Lab Organization operations');
    console.log('  /api/pharmacy    — Pharmacy Organization operations');
    console.log('  /api/insurance   — Insurance Organization operations');
    console.log('  /api/documents   — Secure Document Upload (GCP)');
    console.log('');
});
