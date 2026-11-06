require('dotenv').config();

const { getFirestore } = require("firebase-admin/firestore");
const bcrypt = require("bcrypt");
const nodemailer = require("nodemailer");

const db = global.db || getFirestore();

// 🛡️ [Security Fix - BOLA]: ตัวแปรสำหรับบันทึกเซสชันของผู้ใช้ที่ผ่านการ Login และยืนยัน OTP สำเร็จแล้ว
const activeSessions = {};

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'your_email@gmail.com',
    pass: process.env.EMAIL_PASS || 'your_app_password'
  }
});

transporter.verify(function (error, success) {
  if (error) {
    console.log("X [Email Server] เชื่อมต่อกับ Gmail ล้มเหลว เนื่องจาก:", error.message);
  } else {
    console.log(" [Email Server] ระบบส่งจดหมาย Gmail พร้อมใช้งาน 100%");
  }
});

/**
 * 🛡️ ฟังก์ชันตรวจสอบสถานะการถูกล็อกบัญชี
 */
async function checkAccountLockStatus(userDoc) {
    try {
        const userData = userDoc.data();
        const now = Date.now();

        if (userData.lockUntil) {
            let lockUntilTime = userData.lockUntil.toDate ? userData.lockUntil.toDate().getTime() : new Date(userData.lockUntil).getTime();
            
            if (now < lockUntilTime) {
                const remainingMinutes = Math.ceil((lockUntilTime - now) / (60 * 1000));
                let message = `บัญชีของคุณถูกล็อกชั่วคราว กรุณาลองใหม่อีกครั้งใน ${remainingMinutes} นาที`;
                
                if (lockUntilTime - now > 50 * 365 * 24 * 60 * 60 * 1000) {
                    message = "⚠️ บัญชีของคุณถูกระงับการใช้งานถาวร โปรดติดต่อแอดมินเพื่อทำการปลดล็อกบัญชี";
                }

                return {
                    isLocked: true,
                    message: message,
                    lockUntilMs: lockUntilTime
                };
            }
        }

        return { isLocked: false };
    } catch (error) {
        console.error("เกิดข้อผิดพลาดในการตรวจสอบสถานะล็อก:", error);
        return { isLocked: false };
    }
}

/**
 * 📝 2. ฟังก์ชันสมัครสมาชิก (เพิ่ม Server-side Validation + ป้องกันสมัครอีเมลซ้ำ)
 */
async function registerUser(uid, userData) {
    try {
        // 🔒 [Security - F-02]: ตรวจสอบข้อมูลบังคับและรูปแบบอีเมล
        if (!userData || !userData.email || typeof userData.email !== 'string' || userData.email.trim() === "") {
            return { success: false, message: "❌ กรุณาระบุอีเมลผู้ใช้งานให้ถูกต้อง" };
        }
        
        const cleanedEmail = userData.email.trim().toLowerCase();

        // ตรวจสอบรูปแบบอีเมลด้วย RegEx
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(cleanedEmail)) {
            return { success: false, message: "❌ รูปแบบอีเมลไม่ถูกต้อง" };
        }

        // 🔒 [Business Logic]: ตรวจสอบว่ามีอีเมลนี้อยู่ในระบบหรือยัง ป้องกันการสมัครซ้ำ
        const existingUserSnapshot = await db.collection('users').where('email', '==', cleanedEmail).get();
        if (!existingUserSnapshot.empty) {
            return { success: false, message: "❌ อีเมลนี้ถูกใช้งานในระบบแล้ว กรุณาใช้อีเมลอื่น" };
        }

        if (!userData.password) {
            return { success: false, message: "❌ กรุณาระบุรหัสผ่าน" };
        }

        // 🔒 ตรวจสอบมาตรฐานรหัสผ่าน: ตัวอักษรภาษาอังกฤษ, ตัวเลข, และอักขระพิเศษ (ขั้นต่ำ 8 ตัว)
        const passwordRegex = /^[A-Za-z0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]{8,}$/;
        if (!passwordRegex.test(userData.password)) {
            return { success: false, message: "❌ รหัสผ่านต้องมีความยาวอย่างน้อย 8 ตัวอักษร และประกอบด้วยตัวอักษรภาษาอังกฤษ ตัวเลข หรืออักขระพิเศษเท่านั้น" };
        }

        const userRef = db.collection('users').doc(uid);
        
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(userData.password, saltRounds);

        const newUserData = {
            uid: uid || "UNID_TEMP",
            name: userData.name ? userData.name.trim() : "",
            email: cleanedEmail,
            password_hash: hashedPassword,
            birthDate: userData.birthDate ? new Date(userData.birthDate) : new Date(), 
            walletAddress: userData.walletAddress || "",
            terms_accepted: "true",
            privacy_accepted: "true",
            risk_accepted: "true",
            status: "active",
            createdAt: new Date(),
            failedAttempts: 0,
            lockUntil: null
        };

        await userRef.set(newUserData);
        console.log(`🔥 [Firestore] บันทึกบัญชีของคุณ ${newUserData.name} ลงระบบสำเร็จ!`);

        // 📨 3. กล่องเนื้อหาอีเมลต้อนรับ
        const mailOptions = {
            from: '"BBlockWallet Official" <bblock.wallet@gmail.com>',
            to: newUserData.email, 
            subject: '🎉 ยินดีต้อนรับสู่ BBlockWallet - แพลตฟอร์มจัดการทรัพย์สินและมรดกดิจิทัลของคุณ',
            html: `
                <div style="font-family: 'Kanit', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 12px; color: #333;">
                    <div style="text-align: center; margin-bottom: 20px;">
                        <p style="color: #6b7280; font-size: 14px;">Digital Asset Management & Inheritance Trust Platform</p>
                    </div>
                    
                    <hr style="border: none; border-top: 1px solid #f3f4f6; margin: 20px 0;">
                    
                    <h2>สวัสดีคุณ ${newUserData.name}</h2>
                    <p style="line-height: 1.6;">ยินดีต้อนรับเข้าสู่การเป็นส่วนหนึ่งในบริการกระเป๋าเงินคริปโตเคอร์เรนซีและระบบมรดกดิจิทัลของเราอย่างเป็นทางการ บัญชีของคุณได้รับการเปิดใช้งานในฐานข้อมูลเสร็จสมบูรณ์แล้ว!</p>
                    
                    <div style="background-color: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #7c3aed;">
                        <h4 style="margin-top: 0; color: #4b5563;">💡 BBlockWallet คือระบบอะไร และมีจุดประสงค์เพื่ออะไร?</h4>
                        <p style="font-size: 13px; line-height: 1.5; color: #4b5563; margin-bottom: 0;">
                            แพลตฟอร์มของเราถูกพัฒนาขึ้นโดยมีจุดประสงค์เพื่อช่วยให้คุณสามารถ <b>"จัดการและส่งต่อสินทรัพย์คริปโตได้อย่างปลอดภัยและมีประสิทธิภาพ"</b> 
                            ผ่านระบบกระเป๋าเงินกระจายศูนย์ (Decentralized) ควบคู่กับนวัตกรรม <b>Digital Asset Trust (Dead Man's Switch Smart Contract)</b> 
                            ที่ช่วยโอนย้ายและส่งต่อทรัพย์สินดิจิทัลของคุณไปยังทายาทหรือผู้รับสืบทอดโดยอัตโนมัติทันที หากบัญชีไม่มีการเคลื่อนไหวตามระยะเวลาที่คุณกำหนดไว้ 
                            เพื่อให้มั่นใจว่าทรัพย์สินคริปโตของคุณจะไม่สูญหายไปตลอดกาล
                        </p>
                    </div>

                    <p style="font-size: 13px; color: #6b7280;"><b>🔒 ข้อมูลความปลอดภัยของบัญชีคุณ:</b></p>
                    <ul style="font-size: 13px; color: #4b5563; padding-left: 20px;">
                        <li><b>อีเมลใช้งาน:</b> ${newUserData.email}</li>
                        <li><b>กระเป๋าเงินที่ผูก:</b> ${newUserData.walletAddress}</li>
                        <li><b>สถานะระบบ:</b> Active (พร้อมเชื่อมต่อ Web3 / MetaMask)</li>
                    </ul>
                    
                    <hr style="border: none; border-top: 1px solid #f3f4f6; margin: 25px 0;">
                    
                    <p style="font-size: 12px; color: #9ca3af; text-align: center;">
                        ข้อความนี้เป็นอีเมลอัตโนมัติจากระบบลงทะเบียนของ BBlockWallet โปรดเก็บรักษาข้อมูลส่วนตัวของคุณไว้เป็นความลับ<br>
                        Copyright © 2026 BBlockWallet.com. All rights reserved.
                    </p>
                </div>
            `
        };

        transporter.sendMail(mailOptions, (err, info) => {
            if (err) console.error("❌ [Email Error] ส่งอีเมลล้มเหลวเนื่องจาก:", err.message);
            else console.log("📧 [Email Success] ยิงจดหมายแนะนำจุดประสงค์ระบบเข้าสู่หน้ากล่องข้อความผู้ใช้สำเร็จ! ID:", info.messageId);
        });

        return { success: true, message: "สร้างบัญชีผู้ใช้ในคลังข้อมูลสำเร็จแล้ว" };

    } catch (error) {
        console.error("เกิดข้อผิดพลาดในระบบสมัครสมาชิก:", error);
        return { success: false, message: "❌ เกิดข้อผิดพลาดภายในระบบ กรุณาลองใหม่อีกครั้ง" };
    }
}

/**
 * 🚨 ฟังก์ชันจัดการกรณีผู้ใช้กรอกรหัสผ่านหรือ OTP ผิดพลาด
 */
async function handleFailedAttempt(userDoc, ipAddress, userAgent) {
    const userData = userDoc.data();
    const currentAttempts = (userData.failedAttempts || 0) + 1;
    const now = Date.now();
    let updateData = { failedAttempts: currentAttempts };
    let message = "";
    let lockUntilTime = null;

    if (currentAttempts === 3) {
        lockUntilTime = new Date(now + 30 * 60 * 1000);
        message = "รหัสผ่านหรือ OTP ไม่ถูกต้อง (ผิดครั้งที่ 3) ระบบได้ทำการล็อกเป็นเวลา 30 นาที";
    } 
    else if (currentAttempts === 5) {
        lockUntilTime = new Date(now + 6 * 60 * 60 * 1000);
        message = "รหัสผ่านหรือ OTP ไม่ถูกต้อง (ผิดครั้งที่ 5) ระบบได้ทำการล็อกเป็นเวลา 6 ชั่วโมง";
        await sendSecurityAlertEmail(userData.email, userData.name, ipAddress, userAgent, false);
    }
    else if (currentAttempts >= 6 && currentAttempts <= 9) {
        const extraMinutes = (currentAttempts - 5) * 30; 
        const totalLockMinutes = (6 * 60) + extraMinutes;
        
        lockUntilTime = new Date(now + totalLockMinutes * 60 * 1000);
        message = `รหัสผ่านหรือ OTP ไม่ถูกต้อง (ผิดครั้งที่ ${currentAttempts}) ระบบได้ทำการล็อกเพิ่มเวลาเป็น ${Math.floor(totalLockMinutes / 60)} ชั่วโมง ${totalLockMinutes % 60 ? (totalLockMinutes % 60) + ' นาที' : ''}`;
    }
    else if (currentAttempts >= 10) {
        lockUntilTime = new Date(now + 100 * 365 * 24 * 60 * 60 * 1000); 
        updateData.status = "permanently_locked";
        
        message = "⚠️ บัญชีของคุณมีการกรอกข้อมูลผิดเกินกำหนด โปรดติดต่อแอดมินเพื่อทำการปลดล็อกบัญชี";
        
        await sendSecurityAlertEmail(userData.email, userData.name, ipAddress, userAgent, true);
    }
    else {
        const remaining = currentAttempts < 3 ? (3 - currentAttempts) : (5 - currentAttempts);
        message = `รหัสผ่านหรือ OTP ไม่ถูกต้อง (คุณเหลือโอกาสอีก ${remaining} ครั้งก่อนถูกล็อกระบบ)`;
    }

    updateData.lockUntil = lockUntilTime;
    await userDoc.ref.update(updateData);
    
    return { 
        success: false, 
        message: message, 
        lockUntilMs: lockUntilTime ? lockUntilTime.getTime() : null 
    };
}

/**
 * 📧 ฟังก์ชันส่งอีเมลแจ้งเตือนความปลอดภัย
 */
async function sendSecurityAlertEmail(email, name, ipAddress, userAgent, isPermanentLock = false) {
    try {
        const attemptTime = new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });
        const deviceDetails = parseUserAgentToDevice(userAgent);
        const locationDetails = ipAddress && ipAddress !== '127.0.0.1' ? `IP: ${ipAddress}` : "ตรวจสอบจากเครือข่ายปัจจุบัน";

        let subject = '🚨 แจ้งเตือนความปลอดภัย: พบความพยายามเข้าสู่ระบบที่ผิดปกติบนบัญชีของคุณ';
        let alertDescription = 'ระบบความปลอดภัยของ BBlockWallet ตรวจพบการเข้าสู่ระบบที่ผิดปกติ เนื่องจากมีการกรอกรหัสผ่านหรือรหัส OTP ไม่ถูกต้องติดต่อกันหลายครั้ง จนทำให้บัญชีถูกล็อกชั่วคราวเป็นเวลา 6 ชั่วโมง';
        let contactSection = '';

        if (isPermanentLock) {
            subject = '⚠️ แจ้งเตือนสำคัญ: บัญชี BBlockWallet ของคุณถูกระงับการใช้งานถาวร';
            alertDescription = 'บัญชีของคุณถูกล็อกเนื่องจากการกรอกข้อมูลผิดเกินกำหนด โปรดติดต่อแอดมินเพื่อปลดล็อกบัญชี';
            contactSection = `
                <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <h4 style="margin-top: 0; color: #166534;">💬 ช่องทางการติดต่อแอดมินเพื่อปลดล็อกบัญชี:</h4>
                    <p style="font-size: 13px; color: #15803d; margin-bottom: 8px;"><b>LINE Official:</b> @BBlockWalletSupport</p>
                    <p style="font-size: 13px; color: #15803d; margin-bottom: 0;"><b>Facebook Fanpage:</b> BBlockWallet Official</p>
                </div>
            `;
        }

        const mailOptions = {
            from: '"BBlockWallet Security" <bblock.wallet@gmail.com>',
            to: email.trim(),
            subject: subject,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 550px; margin: 0 auto; padding: 25px; border: 1px solid #feb2b2; border-radius: 16px; color: #1a202c; background-color: #ffffff;">
                    <h2 style="color: #e53e3e; text-align: center; margin-bottom: 5px;">⚠️ Security Alert</h2>
                    <p style="text-align: center; color: #718096; font-size: 13px;">แจ้งเตือนสถานะความปลอดภัยของบัญชี</p>
                    <hr style="border: none; border-top: 1px solid #edf2f7; margin: 20px 0;">
                    
                    <p>สวัสดีคุณ ${name || 'ผู้ใช้งาน'},</p>
                    <p style="color: #c53030; font-weight: bold;">${alertDescription}</p>
                    
                    ${contactSection}

                    <div style="background-color: #fff5f5; border: 1px solid #feb2b2; padding: 15px; border-radius: 8px; margin: 20px 0;">
                        <h4 style="margin-top: 0; color: #c53030;">📋 รายละเอียดการพยายามทำรายการล่าสุด:</h4>
                        <ul style="font-size: 13px; color: #4a5568; padding-left: 20px; line-height: 1.6; margin-bottom: 0;">
                            <li><b>วันและเวลา:</b> ${attemptTime}</li>
                            <li><b>รุ่นโทรศัพท์/อุปกรณ์:</b> ${deviceDetails}</li>
                            <li><b>สถานที่/เครือข่าย:</b> ${locationDetails}</li>
                        </ul>
                    </div>

                    <p style="font-size: 13px; color: #2d3748;"><b>💡 คำแนะนำ:</b> หากคุณไม่ได้เป็นผู้ทำรายการนี้ โปรดติดต่อทีมงานผ่านช่องทางด้านบนเพื่อความปลอดภัยสูงสุดของสินทรัพย์ดิจิทัลของคุณ</p>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);
        console.log(`📧 [Security Alert] ส่งอีเมลเตือนภัยไปยัง ${email} สำเร็จเรียบร้อย`);
    } catch (error) {
        console.error("❌ [Email Alert Error] ส่งอีเมลเตือนภัยล้มเหลว:", error.message);
    }
}

/**
 * 🔑 3. ฟังก์ชันตรวจสอบการเข้าสู่ระบบ (Login)
 */
async function loginUser(email, password, ipAddress = "127.0.0.1", userAgent = "") {
    try {
        if (!email || typeof email !== 'string' || email.trim() === "") {
            return { success: false, message: "กรุณาระบุอีเมล" };
        }

        const userSnapshot = await db.collection('users').where('email', '==', email.trim().toLowerCase()).get();

        if (userSnapshot.empty) {
            return { success: false, message: "ไม่พบอีเมลนี้ในระบบ" };
        }

        const userDoc = userSnapshot.docs[0];
        const userData = userDoc.data();

        const lockCheck = await checkAccountLockStatus(userDoc);
        if (lockCheck.isLocked) {
            return { success: false, message: lockCheck.message, lockUntilMs: lockCheck.lockUntilMs };
        }

        const isPasswordMatch = await bcrypt.compare(password, userData.password_hash);

        if (isPasswordMatch) {
            await userDoc.ref.update({
                failedAttempts: 0,
                lockUntil: null
            });

            // 🌟 [Security Fix - BOLA]: บันทึกสถานะว่า UID นี้ผ่านกระบวนการ Login และสร้าง Active Session สำเร็จแล้ว
            activeSessions[userDoc.id] = true;

            return { 
                success: true, 
                message: "เข้าสู่ระบบสำเร็จ", 
                uid: userDoc.id,
                user: { name: userData.name, email: userData.email }
            };
        } else {
            return await handleFailedAttempt(userDoc, ipAddress, userAgent);
        }
    } catch (error) {
        console.error("เกิดข้อผิดพลาดในการล็อกอิน:", error);
        return { success: false, message: "เกิดข้อผิดพลาดภายในระบบ กรุณาลองใหม่อีกครั้ง" };
    }
}

//email otp
const otpStore = {};

/**
 * 📧 4. ฟังก์ชันสำหรับขอรหัส OTP
 */
async function requestLoginOTP(email, password, ipAddress = "127.0.0.1", userAgent = "") {
    try {
        if (!email) return { success: false, message: "กรุณาระบุอีเมล" };
        
        const userSnapshot = await db.collection('users').where('email', '==', email.trim().toLowerCase()).get();
        if (userSnapshot.empty) {
            return { success: false, message: "ไม่พบอีเมลนี้ในคลังระบบ" };
        }

        const userDoc = userSnapshot.docs[0];
        const userData = userDoc.data();

        const lockCheck = await checkAccountLockStatus(userDoc);
        if (lockCheck.isLocked) {
            return { success: false, message: lockCheck.message, lockUntilMs: lockCheck.lockUntilMs };
        }

        const isPasswordMatch = await bcrypt.compare(password, userData.password_hash);
        if (!isPasswordMatch) {
            return await handleFailedAttempt(userDoc, ipAddress, userAgent);
        }

        const now = Date.now();
        
        if (otpStore[email] && (now - otpStore[email].lastRequestedAt < 60 * 1000)) {
            const secsLeft = Math.ceil((60 * 1000 - (now - otpStore[email].lastRequestedAt)) / 1000);
            return { success: false, message: `กรุณารออีก ${secsLeft} วินาทีก่อนขอรหัสใหม่อีกครั้ง` };
        }

        const generatedOTP = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpiryTime = now + (3 * 60 * 1000);

        otpStore[email] = { otp: generatedOTP, expiresAt: otpExpiryTime, lastRequestedAt: now };

        const mailOptions = {
            from: '"BBlockWallet Security" <bblock.wallet@gmail.com>',
            to: email.trim(),
            subject: '🔒 รหัส OTP สำหรับเข้าสู่ระบบ BBlockWallet ของคุณ',
            html: `
                <div style="font-family: 'Kanit', sans-serif; max-width: 500px; margin: 0 auto; padding: 25px; border: 1px solid #e2e8f0; border-radius: 16px; color: #1a202c;">
                    <h2 style="color: #7c3aed; text-align: center; margin-bottom: 5px;">BBlockWallet Security</h2>
                    <p style="text-align: center; color: #718096; font-size: 13px;">รหัสยืนยันการเข้าสู่ระบบแบบสองชั้น (2FA)</p>
                    <hr style="border: none; border-top: 1px solid #edf2f7; margin: 20px 0;">
                    
                    <p>สวัสดีครับ,</p>
                    <p>โปรดใช้รหัส OTP ด้านล่างนี้เพื่อยืนยันตัวตนบนหน้าเว็บไซต์:</p>
                    
                    <div style="background-color: #f7fafc; border: 1px dashed #cbd5e0; padding: 15px; border-radius: 8px; text-align: center; margin: 25px 0;">
                        <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #2d3748;">${generatedOTP}</span>
                    </div>
                    
                    <p style="font-size: 13px; color: #e53e3e; font-weight: 500;">⚠️ ข้อควรระวังด้านความปลอดภัย: รหัส OTP นี้มีอายุการใช้งาน 3 นาที</p>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);
        return { success: true, message: "ส่งรหัส OTP เรียบร้อยแล้ว" };

    } catch (error) {
        console.error("เกิดข้อผิดพลาดในการสร้าง OTP:", error);
        return { success: false, message: "เกิดข้อผิดพลาดภายในระบบ กรุณาลองใหม่อีกครั้ง" };
    }
}

/**
 * 🔒 5. ฟังก์ชันตรวจสอบการล็อกอินขั้นสุดท้ายผ่าน OTP
 */
async function verifyLoginWithOTP(email, password, userOTP, ipAddress = "127.0.0.1", userAgent = "") {
    try {
        if (!email) return { success: false, message: "กรุณาระบุอีเมล" };

        const userSnapshot = await db.collection('users').where('email', '==', email.trim().toLowerCase()).get();
        if (!userSnapshot.empty) {
            const userDoc = userSnapshot.docs[0];
            const lockCheck = await checkAccountLockStatus(userDoc);
            if (lockCheck.isLocked) {
                return { success: false, message: lockCheck.message, lockUntilMs: lockCheck.lockUntilMs };
            }
        }

        const record = otpStore[email];
        if (!record) {
            return { success: false, message: "ไม่พบข้อมูลประวัติการขอรหัส OTP สำหรับบัญชีนี้" };
        }

        if (Date.now() > record.expiresAt) {
            delete otpStore[email];
            return { success: false, message: "❌ รหัส OTP นี้หมดอายุแล้ว (เกิน 3 นาที)" };
        }

        if (record.otp !== userOTP) {
            if (!userSnapshot.empty) {
                const userDoc = userSnapshot.docs[0];
                return await handleFailedAttempt(userDoc, ipAddress, userAgent);
            }
            return { success: false, message: "❌ รหัส OTP ไม่ถูกต้อง" };
        }

        const loginResult = await loginUser(email, password, ipAddress, userAgent);
        if (loginResult.success) {
            delete otpStore[email];
            await saveLoginHistoryLog(loginResult.uid, ipAddress, userAgent);
        }
        return loginResult;
    } catch (error) {
        console.error("เกิดข้อผิดพลาดในการยืนยัน OTP:", error);
        return { success: false, message: "เกิดข้อผิดพลาดภายในระบบ กรุณาลองใหม่อีกครั้ง" };
    }
}

//repassword email
const forgetOtpStore = {};

/**
 * 🔍 6. ฟังก์ชันขอ OTP เคสลืมรหัสผ่าน
 */
async function requestForgetPasswordOTP(email, birthDateString, ipAddress = "127.0.0.1", userAgent = "") {
    try {
        if (!email) return { success: false, message: "กรุณาระบุอีเมล" };

        const userSnapshot = await db.collection('users').where('email', '==', email.trim().toLowerCase()).get();
        if (userSnapshot.empty) {
            return { success: false, message: "ไม่พบอีเมลนี้ในระบบสมัครสมาชิก" };
        }

        const userDoc = userSnapshot.docs[0];
        const userData = userDoc.data();

        const lockCheck = await checkAccountLockStatus(userDoc);
        if (lockCheck.isLocked) {
            return { success: false, message: lockCheck.message, lockUntilMs: lockCheck.lockUntilMs };
        }

        if (!userData.birthDate) {
            return { success: false, message: "บัญชีนี้ไม่มีประวัติข้อมูลวันเกิด" };
        }

        const dbDate = userData.birthDate.toDate(); 
        const inputDate = new Date(birthDateString);

        if (dbDate.getFullYear() !== inputDate.getFullYear() ||
            dbDate.getMonth() !== inputDate.getMonth() ||
            dbDate.getDate() !== inputDate.getDate()) {
            return await handleFailedAttempt(userDoc, ipAddress, userAgent);
        }

        const now = Date.now();
        if (forgetOtpStore[email] && (now - forgetOtpStore[email].lastRequestedAt < 60 * 1000)) {
            const secsLeft = Math.ceil((60 * 1000 - (now - forgetOtpStore[email].lastRequestedAt)) / 1000);
            return { success: false, message: `กรุณารออีก ${secsLeft} วินาทีก่อนขอรหัสใหม่อีกครั้ง` };
        }

        const generatedOTP = Math.floor(100000 + Math.random() * 900000).toString();
        forgetOtpStore[email] = { otp: generatedOTP, expiresAt: now + (3 * 60 * 1000), lastRequestedAt: now, verified: false };

        const mailOptions = {
            from: '"BBlockWallet Security" <bblock.wallet@gmail.com>',
            to: email.trim(),
            subject: '🔒 รหัส OTP สำหรับกู้คืนรหัสผ่าน BBlockWallet ของคุณ',
            html: `
                <div style="font-family: 'Kanit', sans-serif; max-width: 500px; margin: 0 auto; padding: 25px; border: 1px solid #e2e8f0; border-radius: 16px; color: #1a202c;">
                    <h2 style="color: #7c3aed; text-align: center; margin-bottom: 5px;">BBlockWallet Account Recovery</h2>
                    <p style="text-align: center; color: #718096; font-size: 13px;">รหัสยืนยันเพื่อเปลี่ยนรหัสผ่านใหม่</p>
                    <hr style="border: none; border-top: 1px solid #edf2f7; margin: 20px 0;">
                    <p>สวัสดีครับ,</p>
                    <p>ระบบได้รับการขอยืนยันเพื่อเปลี่ยนรหัสผ่านเนื่องจากลืมรหัสผ่าน โปรดใช้รหัส OTP 6 หลักนี้เพื่อดำเนินรายการต่อ:</p>
                    <div style="background-color: #f7fafc; border: 1px dashed #cbd5e0; padding: 15px; border-radius: 8px; text-align: center; margin: 25px 0;">
                        <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #dc2626;">${generatedOTP}</span>
                    </div>
                    <p style="font-size: 12px; color: #4a5568; line-height: 1.6;">
                        ⚠️ รหัสมี<b>อายุใช้งานจำกัดเพียง 3 นาทีเท่านั้น</b> หากครบกำหนดเวลาโค้ดจะถูกล้างทำลายโดยอัตโนมัติเพื่อความปลอดภัยของกระเป๋าเงินดิจิทัลของคุณ
                    </p>
                    <hr style="border: none; border-top: 1px solid #edf2f7; margin: 25px 0;">
                    <p style="font-size: 11px; color: #a0aec0; text-align: center; margin-bottom: 0;">Copyright © 2026 BBlockWallet.com. All rights reserved.</p>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);
        return { success: true, message: "ส่งรหัส OTP เรียบร้อยแล้ว" };
    } catch (error) {
        console.error("เกิดข้อผิดพลาดขอ OTP ลืมรหัสผ่าน:", error);
        return { success: false, message: "เกิดข้อผิดพลาดภายในระบบ กรุณาลองใหม่อีกครั้ง" };
    }
}

/**
 * 🔒 7. ฟังก์ชันตรวจสอบรหัส OTP เคสลืมรหัสผ่าน
 */
async function verifyForgetPasswordOTP(email, birthDateString, userOTP, ipAddress = "127.0.0.1", userAgent = "") {
    try {
        if (!email) return { success: false, message: "กรุณาระบุอีเมล" };

        const userSnapshot = await db.collection('users').where('email', '==', email.trim().toLowerCase()).get();
        if (!userSnapshot.empty) {
            const userDoc = userSnapshot.docs[0];
            const lockCheck = await checkAccountLockStatus(userDoc);
            if (lockCheck.isLocked) {
                return { success: false, message: lockCheck.message, lockUntilMs: lockCheck.lockUntilMs };
            }
        }

        const record = forgetOtpStore[email];
        if (!record || Date.now() > record.expiresAt) {
            return { success: false, message: "❌ รหัส OTP หมดอายุหรือไม่พบข้อมูล" };
        }

        if (record.otp !== userOTP) {
            if (!userSnapshot.empty) {
                const userDoc = userSnapshot.docs[0];
                return await handleFailedAttempt(userDoc, ipAddress, userAgent);
            }
            return { success: false, message: "❌ รหัส OTP ไม่ถูกต้อง" };
        }

        record.verified = true;
        return { success: true, message: "ยืนยันรหัส OTP สำเร็จ" };
    } catch (error) {
        console.error("เกิดข้อผิดพลาดตรวจสอบ OTP ลืมรหัส:", error);
        return { success: false, message: "เกิดข้อผิดพลาดภายในระบบ กรุณาลองใหม่อีกครั้ง" };
    }
}

/**
 * 🔄 8. ฟังก์ชันบันทึกเปลี่ยนรหัสผ่านใหม่ (พร้อมตรวจสอบมาตรฐานรหัสผ่าน)
 */
async function resetUserPassword(email, newPassword) {
    try {
        const passwordRegex = /^[A-Za-z0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]{8,}$/;
        if (!passwordRegex.test(newPassword)) {
            return { success: false, message: "❌ รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 8 ตัวอักษร และประกอบด้วยตัวอักษรภาษาอังกฤษ ตัวเลข หรืออักขระพิเศษเท่านั้น" };
        }

        const record = forgetOtpStore[email];
        if (!record || !record.verified) {
            return { success: false, message: "❌ สิทธิ์ความปลอดภัยล้มเหลว: โปรดยืนยันรหัส OTP ให้สำเร็จก่อน" };
        }

        const userSnapshot = await db.collection('users').where('email', '==', email.trim().toLowerCase()).get();
        if (userSnapshot.empty) {
            return { success: false, message: "ไม่พบอีเมลนี้ในคลังระบบ" };
        }

        const userDoc = userSnapshot.docs[0];
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await userDoc.ref.update({
            password_hash: hashedPassword,
            failedAttempts: 0,
            lockUntil: null
        });

        delete forgetOtpStore[email];
        return { success: true, message: "เปลี่ยนรหัสผ่านใหม่สำเร็จแล้ว" };
    } catch (error) {
        console.error("เกิดข้อผิดพลาดรีเซ็ตรหัสผ่าน:", error);
        return { success: false, message: "เกิดข้อผิดพลาดภายในระบบ กรุณาลองใหม่อีกครั้ง" };
    }
}

/**
 * 🔒 [Security Fix - F-01 (BOLA)]: ป้องกันการใช้ UID สุ่มมาดึงข้อมูล
 * ตรวจสอบทั้งการมีอยู่จริงใน Firestore และต้องผ่าน Active Session หลัง Login สำเร็จแล้วเท่านั้น
 */
async function getUserProfile(uid) {
    try {
        if (!uid || typeof uid !== 'string' || uid.trim() === "") {
            return { success: false, status: 401, message: "❌ ข้อมูลระบุตัวตนไม่ถูกต้อง" };
        }

        // 🛡️ ป้องกัน BOLA: ตรวจสอบว่า UID นี้มี Active Session จากการ Login จริงหรือไม่
        if (!activeSessions[uid.trim()]) {
            return { success: false, status: 401, message: "⛔ สิทธิ์การเข้าถึงถูกปฏิเสธ: ไม่อนุญาตให้เข้าถึงโดยไม่มีเซสชันล็อกอิน" };
        }

        const userDoc = await db.collection('users').doc(uid.trim()).get();
        if (!userDoc.exists) {
            return { success: false, status: 401, message: "ไม่พบข้อมูลบัญชีผู้ใช้งานนี้ในระบบ" };
        }
        
        const userData = userDoc.data();
        let cleanBirthDate = userData.birthDate ? userData.birthDate.toDate().toISOString() : "";

        return {
            success: true,
            data: {
                uid: userData.uid,
                name: userData.name,
                email: userData.email,
                birthDate: cleanBirthDate,
                logs: userData.logs || []
            }
        };
    } catch (error) {
        console.error("เกิดข้อผิดพลาดดึงข้อมูลโปรไฟล์:", error);
        return { success: false, status: 500, message: "เกิดข้อผิดพลาดภายในระบบ กรุณาลองใหม่อีกครั้ง" };
    }
}

/**
 * 🔒 [Security Fix - F-01 (BOLA)]: ป้องกันการแอบแก้โปรไฟล์บัญชีอื่น
 * ตรวจสอบ Active Session ก่อนอนุญาตให้อัปเดตข้อมูล
 */
async function updateUserProfile(uid, updateData, ipAddress, userAgent) {
    try {
        if (!uid || typeof uid !== 'string' || uid.trim() === "") {
            return { success: false, status: 401, message: "❌ ข้อมูลระบุตัวตนไม่ถูกต้อง" };
        }

        // 🛡️ ป้องกัน BOLA: ตรวจสอบว่า UID นี้มี Active Session จากการ Login จริงหรือไม่
        if (!activeSessions[uid.trim()]) {
            return { success: false, status: 401, message: "⛔ สิทธิ์การเข้าถึงถูกปฏิเสธ: ไม่อนุญาตให้แก้ไขโดยไม่มีเซสชันล็อกอิน" };
        }

        const userRef = db.collection('users').doc(uid.trim());
        const userDoc = await userRef.get();
        if (!userDoc.exists) {
            return { success: false, status: 401, message: "ไม่พบข้อมูลบัญชีผู้ใช้งาน" };
        }

        const formattedData = {
            name: updateData.name ? updateData.name.trim() : "",
            email: updateData.email ? updateData.email.trim().toLowerCase() : "",
            birthDate: updateData.birthDate ? new Date(updateData.birthDate) : new Date()
        };

        const currentLogs = userDoc.data().logs || [];
        currentLogs.unshift({
            action: "แก้ไขข้อมูลบัญชี",
            details: "มีการแก้ไขข้อมูลโปรไฟล์ (ชื่อ/วันเกิด/อีเมล)",
            timestamp: new Date().toISOString(),
            ip: ipAddress || "127.0.0.1",
            device: parseUserAgentToDevice(userAgent)
        });
        
        formattedData.logs = currentLogs;
        await userRef.update(formattedData);
        return { success: true, message: "อัปเดตข้อมูลบัญชีสำเร็จ" };
    } catch (error) {
        console.error("เกิดข้อผิดพลาดอัปเดตโปรไฟล์:", error);
        return { success: false, status: 500, message: "เกิดข้อผิดพลาดภายในระบบ กรุณาลองใหม่อีกครั้ง" };
    }
}

async function saveLoginHistoryLog(uid, ipAddress, userAgent) {
    try {
        const userRef = db.collection('users').doc(uid);
        const userDoc = await userRef.get();
        if (!userDoc.exists) return;

        const currentLogs = userDoc.data().logs || [];
        currentLogs.unshift({
            action: "เข้าสู่ระบบ",
            details: "มีการเข้าสู่ระบบสำเร็จผ่านการยืนยันรหัส OTP 2FA",
            timestamp: new Date().toISOString(),
            ip: ipAddress || "127.0.0.1",
            device: parseUserAgentToDevice(userAgent)
        });

        await userDoc.ref.update({ logs: currentLogs });
    } catch (error) {
        console.error("❌ ไม่สามารถเขียนประวัติล็อกอินได้:", error.message);
    }
}

function parseUserAgentToDevice(userAgent) {
    if (!userAgent) return "Unknown Device";
    let device = "Windows PC";
    if (userAgent.includes("iPhone")) device = "iPhone";
    else if (userAgent.includes("iPad")) device = "iPad";
    else if (userAgent.includes("Android")) device = "Android Smartphone";
    else if (userAgent.includes("Macintosh")) device = "MacBook / iMac";
    else if (userAgent.includes("Linux")) device = "Linux Workstation";

    let browser = "Browser";
    if (userAgent.includes("Edg/")) browser = "Microsoft Edge";
    else if (userAgent.includes("Chrome/")) browser = "Google Chrome";
    else if (userAgent.includes("Safari/")) browser = "Apple Safari";
    else if (userAgent.includes("Firefox/")) browser = "Mozilla Firefox";

    return `${device} (/browser)`;
}

module.exports = { 
    registerUser, 
    loginUser, 
    requestLoginOTP, 
    verifyLoginWithOTP,
    requestForgetPasswordOTP,
    verifyForgetPasswordOTP,
    resetUserPassword,
    getUserProfile,       
    updateUserProfile,    
    saveLoginHistoryLog   
};