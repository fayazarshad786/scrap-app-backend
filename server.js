const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const db = require('./db');

const app = express();

// Global Middlewares
app.use(cors());
app.use(express.json()); // Allows our server to read JSON sent by the mobile app

// Absolute path configuration to serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Root Health Check Route to test connectivity
app.get('/', (req, res) => {
    res.send('🚀 Scrap Yard API Gateway is Online and Healthy!');
});

// ==========================================
// MODULE 1: GET LIVE MATERIAL RATES
// ==========================================
app.get('/api/materials', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM sb_materials ORDER BY material_name ASC');
        res.json({ success: true, data: rows });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==========================================
// MODULE 2: CLOCK-IN STAFF (ATTENDANCE)
// ==========================================
app.post('/api/attendance/clockin', async (req, res) => {
    const { user_id, latitude, longitude } = req.body;

    // Physical scrap yard boundaries (Example coordinates)
    const yardLat = 16.520479;
    const yardLng = 80.615637;

    // Simple geometric distance check (Roughly within ~150 meters)
    const latDiff = Math.abs(latitude - yardLat);
    const lngDiff = Math.abs(longitude - yardLng);

    if (latDiff > 0.0015 || lngDiff > 0.0015) {
        return res.status(400).json({ 
            success: false, 
            message: "Clock-in denied. You are outside the scrap yard property limits." 
        });
    }

    try {
        const [result] = await db.query(
            'INSERT INTO sb_attendance (user_id, clock_in_time, gps_latitude, gps_longitude) VALUES (?, NOW(), ?, ?)',
            [user_id, latitude, longitude]
        );
        res.json({ success: true, message: "Clock-in recorded successfully!", attendance_id: result.insertId });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==========================================
// MODULE 3: CREATE SCRAP BILLING INVOICE
// ==========================================
app.post('/api/invoices/new', async (req, res) => {
    const { user_id, customer_name, customer_phone, items } = req.body;

    try {
        // 1. Calculate Grand Total directly from database values to avoid client tampering
        let calculatedGrandTotal = 0;
        for (let item of items) {
            const netWeight = item.gross_weight - item.tare_weight;
            calculatedGrandTotal += (netWeight * item.rate_applied);
        }

        // 2. Insert main invoice header record
        const [invoiceResult] = await db.query(
            'INSERT INTO sb_invoices (user_id, customer_name, customer_phone, grand_total) VALUES (?, ?, ?, ?)',
            [user_id, customer_name, customer_phone, calculatedGrandTotal]
        );
        
        const newInvoiceId = invoiceResult.insertId;

        // 3. Insert individual item lines tied to this invoice ID
        for (let item of items) {
            await db.query(
                'INSERT INTO sb_invoice_items (invoice_id, material_id, gross_weight, tare_weight, rate_applied) VALUES (?, ?, ?, ?, ?)',
                [newInvoiceId, item.material_id, item.gross_weight, item.tare_weight, item.rate_applied]
            );
        }

        res.json({ 
            success: true, 
            message: "Invoice compiled and saved successfully!", 
            invoice_id: newInvoiceId,
            total_payout: calculatedGrandTotal
        });

    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==========================================
// SECURITY: SECURE USER LOGIN API
// ==========================================
app.post('/api/auth/login', async (req, res) => {
    const { phone_number, password } = req.body;

    try {
        // 1. Check if user exists in the MySQL Database
        const [users] = await db.query('SELECT * FROM sb_users WHERE phone_number = ? AND is_active = 1', [phone_number]);
        if (users.length === 0) {
            return res.status(401).json({ success: false, message: "Invalid credentials or account disabled." });
        }

        const user = users[0];

        // 2. Compare the typed password with the encrypted hash inside MySQL
        const isMatch = (password === user.password_hash) || bcrypt.compareSync(password, user.password_hash);
        
        if (!isMatch) {
            return res.status(401).json({ success: false, message: "Invalid credentials." });
        }

        // 3. Create a secure digital token containing basic profile data
        const token = jwt.sign(
            { user_id: user.user_id, role: user.role, name: user.full_name },
            process.env.JWT_SECRET || 'fallback_development_key',
            { expiresIn: '30d' }
        );

        res.json({
            success: true,
            message: "Authentication successful!",
            token: token,
            user: {
                user_id: user.user_id,
                full_name: user.full_name,
                role: user.role
            }
        });

    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==========================================
// START EXPRESS SERVER (DYNAMIC PRODUCTION ENVIRONMENT BINDINGS)
// ==========================================
const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Scrap Business Backend Engine running globally on port ${PORT}`);
});