/**
 * ฟังก์ชันรับไม้ต่อจาก server.js เพื่อนำไปบันทึกลงคอลเลกชันใน Cloud Firestore (เพิ่ม Server-side Validation)
 */
async function saveFaqFeedback(faqNumber, isHelpful, surveyReason) {
    try {
        // ⚠️ ตรวจสอบว่าระบบสามารถอ่านตัวแปรฐานข้อมูล global.db ที่ส่งมาจาก server.js ได้ไหม
        if (!global.db) {
            throw new Error("ระบบฐานข้อมูลยังไม่ได้ทำการเชื่อมต่อสิทธิ์ (global.db is missing)");
        }

        // 🔒 [Security - F-06/F-07]: ตรวจสอบข้อมูลบังคับเบื้องต้น (Required Fields Validation)
        if (!faqNumber || isHelpful === undefined || isHelpful === null) {
            return { success: false, error: "ข้อมูลหัวข้อ FAQ หรือผลประเมินไม่ครบถ้วน" };
        }

        // 🔒 [Security - F-06/F-07]: จำกัดความยาวของข้อความเหตุผล (Maximum Length Validation ป้องกัน Oversized Payload)
        let cleanedReason = "";
        if (surveyReason) {
            if (typeof surveyReason !== 'string') {
                cleanedReason = String(surveyReason);
            } else {
                cleanedReason = surveyReason.trim();
            }
            
            // จำกัดความยาวไม่เกิน 500 ตัวอักษร
            if (cleanedReason.length > 500) {
                return { success: false, error: "ข้อความเหตุผลมีความยาวเกินกว่า 500 ตัวอักษรที่กำหนด" };
            }
        }

        // 📝 วิ่งไปหาคอลเลกชัน "faq_feedbacks" แล้วสั่งเพิ่มข้อมูลเอกสารใหม่ (Add Document)
        const docRef = await global.db.collection('faq_feedbacks').add({
            faq_number: String(faqNumber),
            is_helpful: String(isHelpful),
            survey_reason: cleanedReason,
            submitted_at: new Date() // ใช้เวลาของฝั่งเซิร์ฟเวอร์
        });
        
        // ถ้าบันทึกสำเร็จ ส่งสัญญาณกลับไปบอก server.js
        return { success: true, docId: docRef.id };
        
    } catch (error) {
        console.error("ผิดพลาดในโมดูล bblock.js:", error.message);
        return { success: false, error: error.message };
    }
}

// 📦 ส่งออกฟังก์ชันออกไปนอกไฟล์ให้ server.js สามารถมองเห็น
module.exports = {
    saveFaqFeedback
};