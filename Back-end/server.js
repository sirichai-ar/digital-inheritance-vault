// บรรทัดแรกสุดของ server.js
require('dotenv').config();
// ==========================================
// 🔥 1. โซนเชื่อมต่อกุญแจเข้า Firebase
// ==========================================
const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const path = require("path"); 
const serviceAccount = require("./serviceAccountKey.json");

initializeApp({
    credential: cert(serviceAccount)
});

const firestoreDB = getFirestore();
global.db = firestoreDB; 

// ==========================================
// 📁 2. โซนตั้งค่าเซิร์ฟเวอร์ Express.js และเปิดระบบสิทธิ์ CORS
// ==========================================
const express = require('express');
const app = express();
const cors = require('cors');

// 🔒 [Security Hardening]: ปิด X-Powered-By เพื่อลดการเปิดเผย Technology Stack
app.disable('x-powered-by');

// 🔒 [Security Hardening - CORS]: กำหนด Allowlist ตาม Frontend ที่โปรเจกต์ใช้จริง ห้ามใช้ * หรือสะท้อน Origin
const allowedOrigins = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:5500',
    'http://127.0.0.1:5500',
    'http://localhost:5501',
    'http://127.0.0.1:5501'
];

const corsOptions = {
    origin: function (origin, callback) {
        // รองรับ request ที่ไม่มี Origin เช่น Postman หรือ Server-to-Server
        if (!origin) {
            return callback(null, true);
        }
        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        // ปฏิเสธ Origin ที่ไม่อยู่ใน Allowlist อย่างเด็ดขาด
        return callback(null, false);
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
app.use(express.json()); 

// 🔒 [Security Hardening - Headers]: เพิ่ม Global Middleware สำหรับกำหนด HTTP Security Headers พื้นฐาน
app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff"); // ป้องกัน MIME Type Sniffing
    if (req.path.startsWith('/api/user/')) {
        res.setHeader("Cache-Control", "no-store"); // ป้องกันการแคชข้อมูลส่วนบุคคล
    }
    next();
});

const bblockModule = require('./bblock');
const loginModule = require('./login'); 
const { fetchVaultDataFromChain } = require('./link.js');

// ==========================================
// 🚪 3. ท่อ API ระบบต่างๆ
// ==========================================

// API สมัครสมาชิก
app.post('/api/auth/register', async (req, res) => {
    try {
        const { uid, email, password, name, walletAddress, birthDate } = req.body;
        const result = await loginModule.registerUser(uid, { email, password, name, walletAddress, birthDate });
        if (result.success) res.status(200).json(result);
        else res.status(400).json(result); 
    } catch (err) {
        res.status(500).json({ success: false, error: "เกิดข้อผิดพลาดภายในระบบ" });
    }
});

// API ระบบโหวต Feedback (แบบสำรวจความช่วยเหลือ FAQ)
app.post('/api/support/feedback', async (req, res) => {
    try {
        const { faqNumber, isHelpful, surveyReason } = req.body;
        const result = await bblockModule.saveFaqFeedback(faqNumber, isHelpful, surveyReason);
        if (result.success) res.status(200).json(result);
        else res.status(400).json(result);
    } catch (err) {
        res.status(500).json({ success: false, error: "เกิดข้อผิดพลาดภายในระบบ" });
    }
});

// API ลืมรหัสผ่าน (3 ด่าน)
app.post('/api/auth/forget-password-request', async (req, res) => {
    try {
        const { email, birthDate } = req.body;
        const result = await loginModule.requestForgetPasswordOTP(email, birthDate);
        if (result.success) res.status(200).json(result);
        else res.status(400).json(result);
    } catch (err) {
        res.status(500).json({ success: false, message: "เกิดข้อผิดพลาดภายในระบบ" });
    }
});

app.post('/api/auth/forget-password-verify', async (req, res) => {
    try {
        const { email, birthDate, otp } = req.body;
        const result = await loginModule.verifyForgetPasswordOTP(email, birthDate, otp);
        if (result.success) res.status(200).json(result);
        else res.status(400).json(result);
    } catch (err) {
        res.status(500).json({ success: false, message: "เกิดข้อผิดพลาดภายในระบบ" });
    }
});

app.post('/api/auth/reset-password-submit', async (req, res) => {
    try {
        const { email, newPassword } = req.body;
        const result = await loginModule.resetUserPassword(email, newPassword);
        if (result.success) res.status(200).json(result);
        else res.status(400).json(result);
    } catch (err) {
        res.status(500).json({ success: false, message: "เกิดข้อผิดพลาดภายในระบบ" });
    }
});

// API ระบบ Login (แบบบันทึกประวัติการเข้าใช้งาน)
app.post('/api/auth/request-otp', async (req, res) => {
    try {
        const { email, password } = req.body;
        const result = await loginModule.requestLoginOTP(email, password);
        if (result.success) res.status(200).json(result);
        else res.status(400).json(result);
    } catch (err) {
        res.status(500).json({ success: false, message: "เกิดข้อผิดพลาดภายในระบบ" });
    }
});

app.post('/api/auth/verify-login', async (req, res) => {
    try {
        const { email, password, otp } = req.body;
        const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        const userAgent = req.headers['user-agent'];
        const result = await loginModule.verifyLoginWithOTP(email, password, otp, ipAddress, userAgent);
        
        if (result.success) res.status(200).json(result);
        else res.status(400).json(result);
    } catch (err) {
        res.status(500).json({ success: false, message: "เกิดข้อผิดพลาดภายในระบบ" });
    }
});

// API ระบบโปรไฟล์ (ดึงข้อมูล และ อัปเดตข้อมูล) พร้อมผูกระบบป้องกัน BOLA
app.get('/api/user/profile', async (req, res) => {
    try {
        const authHeader = req.headers['authorization'];
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ success: false, message: "สิทธิ์การเข้าถึงไม่ถูกต้องหรือรูปแบบ Header ผิดพลาด" });
        }

        const tokenParts = authHeader.split(' ');
        if (tokenParts.length !== 2 || !tokenParts[1] || tokenParts[1] === "null") {
            return res.status(401).json({ success: false, message: "สิทธิ์การเข้าถึงไม่ถูกต้อง" });
        }

        const tokenUid = tokenParts[1];

        const result = await loginModule.getUserProfile(tokenUid);
        if (result.success) {
            res.status(200).json(result);
        } else {
            res.status(result.status || 401).json(result);
        }
    } catch (err) {
        res.status(500).json({ success: false, message: "เกิดข้อผิดพลาดภายในระบบ" });
    }
});

app.post('/api/user/profile-update', async (req, res) => {
    try {
        const authHeader = req.headers['authorization'];
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ success: false, message: "สิทธิ์การเข้าถึงไม่ถูกต้องหรือรูปแบบ Header ผิดพลาด" });
        }

        const tokenParts = authHeader.split(' ');
        if (tokenParts.length !== 2 || !tokenParts[1] || tokenParts[1] === "null") {
            return res.status(401).json({ success: false, message: "สิทธิ์การเข้าถึงไม่ถูกต้อง" });
        }

        const tokenUid = tokenParts[1];

        const { name, birthDate, email } = req.body;
        const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        const userAgent = req.headers['user-agent'];

        const result = await loginModule.updateUserProfile(tokenUid, { name, birthDate, email }, ipAddress, userAgent);
        if (result.success) {
            res.status(200).json(result);
        } else {
            res.status(result.status || 401).json(result);
        }
    } catch (err) {
        res.status(500).json({ success: false, message: "เกิดข้อผิดพลาดภายในระบบ" });
    }
});

// API เชื่อมต่อบล็อกเชน (vault data)
app.get('/api/vault/data/:address', async (req, res) => {
    try {
        const walletAddress = req.params.address;
        console.log("🔍 กำลังดึงข้อมูลให้ Wallet Address:", walletAddress);

        const result = await fetchVaultDataFromChain(walletAddress);
        console.log("📦 ผลลัพธ์จาก link.js:", result);

        if (!result.success) {
            return res.status(400).json({
                success: false,
                message: result.error
            });
        }

        return res.status(200).json({
            success: true,
            data: result.data
        });

    } catch (error) {
        console.error("❌ API Error [Vault Data]:", error.message);
        return res.status(500).json({
            success: false,
            message: "เกิดข้อผิดพลาดในการดึงข้อมูลจากบล็อกเชน"
        });
    }
});

// ==========================================
// 📁 4. เสิร์ฟหน้าเว็บ Frontend และจัดการ Error กลาง
// ==========================================
app.use(express.static(path.join(__dirname, '../Front-end')));

// Centralized Error Handling Middleware (ป้องกันการรั่วไหลของ Stack Trace)
app.use((err, req, res, next) => {
    console.error("❌ [Server Error Log]:", err.stack); 
    res.status(400).json({
        success: false,
        message: "รูปแบบคำขอไม่ถูกต้องหรือเกิดข้อผิดพลาดในการประมวลผล"
    });
});

// ==========================================
// 📡 5. สั่งให้เซิร์ฟเวอร์เริ่มทำงาน (ต้องอยู่บรรทัดท้ายสุดเสมอ)
// ==========================================
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../Front-end/pages/bblock.html'));
});
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server BBlockWallet กำลังทำงานที่ port ${PORT}`);
});

//dapp
app.use(express.static(path.join(__dirname, '../Front-end')));

app.use('/public', express.static(path.join(__dirname, '../public')));
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});