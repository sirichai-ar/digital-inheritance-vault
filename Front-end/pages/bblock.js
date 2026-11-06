// ==========================================
// 1. ระบบคลังข้อมูลการสลับภาษา (TH / EN)
// ==========================================
const translations = {
    th: {
        "nav-features": "Features",
        "nav-assets": "Assets",
        "nav-security": "Security",
        "nav-support": "Support",
        "nav-about": "About",
        "hero-title": "จัดการทรัพย์สินคริปโตของคุณ<br>อย่างมีประสิทธิภาพ",
        "hero-desc": "กำหนดเงื่อนไขมรดกของคุณ ด้วย smart contract อันทรงพลัง",
        "btn-register": "สมัคร",
        "btn-login": "เข้าสู่ระบบ",
        "f1-title": "จัดการทรัพย์สินคริปโตของคุณ<br>ด้วย Digital Asset Trust",
        "f1-desc": "กำหนดเงื่อนไขมรดกของคุณ ด้วย smart contract มรดกดิจิทัล",
        "f2-title": "ตรวจสอบมูลค่าของคริปโตได้ทุกเวลา<br>ประเมินมูลค่าทรัพย์สินเป็นสกุลเงินจริง",
        "f2-desc": "ตั้งค่าสกุลเงินจริงและประเมินมูลค่าทรัพย์สินของคุณเป็นสกุลเงินจริงได้อย่างรวดเร็ว",
        "sec-main-title": "ระบบรักษาความปลอดภัย 2 ชั้น",
        "sec-l1-title": "ชั้นที่ 1: Web 2.0 Account Security",
        "sec-l1-desc": "ปกป้องบัญชีของคุณในด่านแรกด้วยการเข้าสู่ระบบด้วย อีเมล, รหัสผ่าน<br>และระบบ Email OTP ที่รัดกุมเพื่อเข้าถึงหน้าจัดการข้อมูลทั่วไป และตรวจดูข้อมูลมูลค่าสินทรัพย์ได้อย่างปลอดภัย",
        "sec-l2-title": "ชั้นที่ 2: Web3 Smart Contract Verification",
        "sec-l2-desc": "ยกระดับความปลอดภัยขั้นสูงสุดในด่านที่สอง ทุกครั้งที่คุณต้องการเปิดใช้งานฟังก์ชัน<br>Digital Asset Trust (จัดการมรดก) หรือทำธุรกรรมผ่าน Smart Contract<br>ระบบจะบังคับให้คุณต้องเชื่อมต่อและยืนยันตัวตนผ่านกระเป๋า MetaMask อีกครั้ง<br>เพื่อให้มั่นใจว่ามีเพียงเจ้าของกุญแจส่วนตัว (Private Key)<br>ตัวจริงเท่านั้นที่มีสิทธิ์สั่งการระบบได้",
        "footer-copy": "Copyright © 2026 BBlockWallet.com. All rights reserved.",
        "search-placeholder": "ค้นหาฟังก์ชัน..."
    },
    en: {
        "nav-features": "Features",
        "nav-assets": "Assets",
        "nav-security": "Security",
        "nav-support": "Support",
        "nav-about": "About",
        "hero-title": "Manage Your Crypto Assets<br>Efficiently",
        "hero-desc": "Define your inheritance conditions with powerful smart contracts.",
        "btn-register": "Register",
        "btn-login": "Login",
        "f1-title": "Manage Your Crypto Assets<br>with Digital Asset Trust",
        "f1-desc": "Set up your legacy rules using digital asset smart contracts.",
        "f2-title": "Monitor Crypto Value Anytime<br>Evaluate Asset in Fiat Currency",
        "f2-desc": "Configure real-world currencies and value your portfolio in real-time smoothly.",
        "sec-main-title": "2-Layer Security System",
        "sec-l1-title": "Layer 1: Web 2.0 Account Security",
        "sec-l1-desc": "Protect your account initially by logging in with Email, Password<br>and a robust Email OTP system to safely access general data management and view portfolio balances.",
        "sec-l2-title": "Layer 2: Web3 Smart Contract Verification",
        "sec-l2-desc": "Elevate to maximum security at the second phase. Every time you trigger<br>the Digital Asset Trust feature or execute a transaction via Smart Contract,<br>the system enforces a connection and authentication via MetaMask wallet<br>to ensure only the actual Private Key owner holds the right to command the platform.",
        "footer-copy": "Copyright © 2026 BBlockWallet.com. All rights reserved.",
        "search-placeholder": "Search features..."
    }
};

let currentLang = 'th';

// ฟังก์ชันสลับภาษา
function toggleLanguage() {
    currentLang = currentLang === 'th' ? 'en' : 'th';
    
    document.querySelectorAll('[data-translate]').forEach(element => {
        const key = element.getAttribute('data-translate');
        if (translations[currentLang][key]) {
            element.innerHTML = translations[currentLang][key];
        }
    });

    const searchInput = document.getElementById('footer-search');
    if (searchInput) {
        searchInput.placeholder = translations[currentLang]["search-placeholder"];
    }

    document.getElementById('lang-label').innerText = currentLang === 'th' ? 'EN' : 'TH';
}

// ฟังก์ชันสลับ Dark / Light Mode
function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    const iconHeader = document.getElementById('theme-icon');
    const iconFooter = document.getElementById('theme-icon-footer');
    
    if (document.body.classList.contains('dark-mode')) {
        iconHeader.className = "fa-solid fa-sun text-yellow-400";
        iconFooter.className = "fa-solid fa-sun text-yellow-400";
    } else {
        iconHeader.className = "fa-regular fa-moon";
        iconFooter.className = "fa-regular fa-moon";
    }
}

// ==========================================
// 2. แก้ไขจุดที่ 1: ระบบตรวจจับและไฮไลต์เมนูตอนเลื่อนหน้าจอ
// ==========================================
// ==========================================
// แก้ไขระบบตรวจจับและไฮไลต์เมนูตอนเลื่อนหน้าจอ (เวอร์ชันสมบูรณ์)
// ==========================================
// ==========================================
// แก้ไขจุดบกพร่อง: ระบบตรวจจับตำแหน่งและแสดงสถานะเมนูแบบแม่นยำสูง
// ==========================================
function updateActiveMenuOnScroll() {
    const sections = document.querySelectorAll('.target-section');
    const navItems = document.querySelectorAll('.nav-item');
    
    let currentActiveSectionId = "";
    
    // ค้นหาว่าเซกชันไหนที่กำลังแสดงอยู่บนหน้าจอ ณ ปัจจุบัน
    sections.forEach(section => {
        const sectionTop = section.getBoundingClientRect().top;
        
        // ถ้าขอบบนของเซกชันเลื่อนขึ้นมาใกล้กับความสูงของ Navbar (ประมาณ 100-150px จากขอบบนสุด)
        if (sectionTop <= 150) {
            currentActiveSectionId = section.getAttribute('id');
        }
    });

    // อัปเดตคลาส active ให้ตรงกับสถานะของเซกชันปัจจุบัน
    if (currentActiveSectionId) {
        navItems.forEach(item => {
            if (item.getAttribute('href') === `#${currentActiveSectionId}`) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
    }
}

// ตรวจจับเหตุการณ์ตอนเลื่อนหน้าจอ
window.addEventListener('scroll', updateActiveMenuOnScroll);
// เรียกใช้ทันทีตอนโหลดหน้าเว็บ เพื่อเช็คว่าเปิดมาแล้วอยู่ที่เซกชันไหน
document.addEventListener('DOMContentLoaded', updateActiveMenuOnScroll);
// ==========================================
// 3. แก้ไขจุดที่ 2: ระบบค้นหาฟังก์ชันและเลื่อนหน้าจอให้แม่นยำ
// ==========================================
function performFeatureSearch() {
    const query = document.getElementById('footer-search').value.toLowerCase().trim();
    if (!query) return;

    let targetElement = null;

    // ตรวจสอบคำค้นหา
    if (query.includes('มรดก') || query.includes('asset') || query.includes('trust') || query.includes('คริปโต')) {
        targetElement = document.getElementById('assets');
    } else if (query.includes('ปลอดภัย') || query.includes('security') || query.includes('ชั้น') || query.includes('เว็บบล็อก') || query.includes('web')) {
        targetElement = document.getElementById('security');
    } else if (query.includes('หน้าแรก') || query.includes('หลัก') || query.includes('feature') || query.includes('hero')) {
        targetElement = document.getElementById('hero');
    }

    // สั่งเลื่อนหน้าจอโดยคำนวณระยะหลบ Navbar ล่วงหน้า (แก้ปัญหาค้นหาแล้วนิ่ง)
    if (targetElement) {
        const navbarHeight = document.querySelector('.navbar').offsetHeight || 80;
        const targetPosition = targetElement.getBoundingClientRect().top + window.scrollY - navbarHeight;
        
        window.scrollTo({
            top: targetPosition,
            behavior: 'smooth'
        });
        
        // ล้างกล่องค้นหาหลังจากเจอผลลัพธ์
        document.getElementById('footer-search').value = '';
    } else {
        alert(currentLang === 'th' ? 'ไม่พบฟังก์ชันที่คุณค้นหา ลองพิมพ์คำว่า "มรดก" หรือ "Security"' : 'Feature not found! Try searching "Asset" or "Security"');
    }
}

// ==========================================
// 4. ผูกเหตุการณ์การทำงานทั้งหมดตอนเปิดเว็บ
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    // ปุ่มเปลี่ยนภาษา
    document.getElementById('lang-toggle').addEventListener('click', toggleLanguage);
    document.getElementById('lang-toggle-footer').addEventListener('click', toggleLanguage);
    
    // ปุ่มโหมดมืด
    document.getElementById('theme-toggle').addEventListener('click', toggleDarkMode);
    document.getElementById('theme-toggle-footer').addEventListener('click', toggleDarkMode);

    // ระบบค้นหาฟังก์ชัน
    document.getElementById('search-submit').addEventListener('click', performFeatureSearch);
    document.getElementById('footer-search').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') performFeatureSearch();
    });

    // เปิดใช้งานระบบตรวจจับสถานะเมนูตอนเลื่อนหน้าจอ
    window.addEventListener('scroll', updateActiveMenuOnScroll);
    updateActiveMenuOnScroll(); // เรียกใช้ทันทีหนึ่งครั้งเพื่อเช็คสถานะตอนโหลดเสร็จ
});