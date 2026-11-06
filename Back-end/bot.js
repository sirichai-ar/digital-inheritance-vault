require('dotenv').config();
const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

// ========================================
// 1. CONNECT TO SEPOLIA
// ========================================
const PROVIDER_URL =
    "https://ethereum-sepolia-rpc.publicnode.com";

const provider = new ethers.JsonRpcProvider(PROVIDER_URL);

const privateKey = process.env.BOT_PRIVATE_KEY;

const botWallet = new ethers.Wallet(
    BOT_PRIVATE_KEY,
    provider
);

// Contract Address ตัวทดสอบล่าสุดที่คุณส่งมา
const CONTRACT_ADDRESS =
    "0xfCdc539BB6Cd3796d64cb835AB7029187d23ED69";

const CONTRACT_ABI = [
    "event SecurityInitialized(address indexed user)",

    "function processAutomatedInheritance(address _vaultOwner) external payable",

    "function vaults(address) view returns (bytes32 hashedUserKey, bytes32 hashedPentax, bool isSecuritySet, uint256 depositPool, bool isDistributed, uint256 lastActiveTimestamp, uint8 inheritanceStage, bool isTrustActive)"
];

const contract = new ethers.Contract(
    CONTRACT_ADDRESS,
    CONTRACT_ABI,
    botWallet
);

// เก็บ users.json ในโฟลเดอร์เดียวกับ bot.js
const USERS_FILE = path.join(__dirname, "users.json");

// ========================================
// 2. CONFIGURATION
// ========================================
const SCAN_BLOCKS = 2000;

const THREE_MINUTES = 3 * 60;
const FIVE_MINUTES = 5 * 60;
const SEVEN_MINUTES = 7 * 60;

const CHECK_INTERVAL = 30 * 1000;

let isChecking = false;

// ========================================
// 3. LOAD USERS.JSON
// ========================================
function getRegisteredUsers() {
    if (!fs.existsSync(USERS_FILE)) {
        fs.writeFileSync(
            USERS_FILE,
            JSON.stringify([], null, 2),
            "utf8"
        );

        console.log("สร้าง users.json ใหม่แล้ว");
        return [];
    }

    const data = fs.readFileSync(USERS_FILE, "utf8");

    let users;

    try {
        users = JSON.parse(data);
    } catch (error) {
        throw new Error(
            `users.json ไม่ใช่ JSON ที่ถูกต้อง: ${error.message}`
        );
    }

    if (!Array.isArray(users)) {
        throw new Error(
            "users.json ต้องมีรูปแบบเป็น Array ของ Wallet Address"
        );
    }

    // ตรวจสอบ Address และตัดรายการซ้ำ
    const uniqueUsers = new Map();

    for (const address of users) {
        if (
            typeof address !== "string" ||
            !ethers.isAddress(address)
        ) {
            console.log("ข้าม Address ที่ไม่ถูกต้อง:", address);
            continue;
        }

        const key = address.toLowerCase();

        if (!uniqueUsers.has(key)) {
            uniqueUsers.set(key, ethers.getAddress(address));
        }
    }

    const result = [...uniqueUsers.values()];

    // ทำความสะอาดรายการซ้ำหรือข้อมูลที่ไม่ใช่ Address
    if (JSON.stringify(users) !== JSON.stringify(result)) {
        fs.writeFileSync(
            USERS_FILE,
            JSON.stringify(result, null, 2),
            "utf8"
        );

        console.log("จัดระเบียบรายชื่อใน users.json แล้ว");
    }

    return result;
}

// ========================================
// 4. SAVE NEW USERS
// ========================================
function saveUsers(users) {
    fs.writeFileSync(
        USERS_FILE,
        JSON.stringify(users, null, 2),
        "utf8"
    );
}

// ========================================
// 5. SCAN SECURITY INITIALIZED EVENTS
// ========================================
async function scanRegisteredUsers(currentBlock) {
    const fromBlock = Math.max(
        0,
        currentBlock - SCAN_BLOCKS
    );

    console.log(
        `🔍 สแกน Event ตั้งแต่บล็อก ${fromBlock} ถึง ${currentBlock}`
    );

    const filter = contract.filters.SecurityInitialized();

    const events = await contract.queryFilter(
        filter,
        fromBlock,
        currentBlock
    );

    console.log(
        `📡 SecurityInitialized events found: ${events.length}`
    );

    const scannedUsers = new Map();

    for (const event of events) {
        const address = event.args?.user;

        if (!address || !ethers.isAddress(address)) {
            console.log(
                "ข้าม Event ที่ไม่มี Wallet Address ที่ถูกต้อง"
            );
            continue;
        }

        const normalizedAddress = ethers.getAddress(address);

        scannedUsers.set(
            normalizedAddress.toLowerCase(),
            normalizedAddress
        );

        console.log(
            `พบผู้สมัคร: ${normalizedAddress} | Block: ${event.blockNumber}`
        );
    }

    return [...scannedUsers.values()];
}

// ========================================
// 6. MERGE JSON USERS + SCANNED USERS
// ========================================
function mergeUsers(knownUsers, scannedUsers) {
    const merged = new Map();

    // ใส่ Address เดิมก่อน
    for (const address of knownUsers) {
        merged.set(
            address.toLowerCase(),
            ethers.getAddress(address)
        );
    }

    // เพิ่มเฉพาะ Address ที่ยังไม่มี
    const newUsers = [];

    for (const address of scannedUsers) {
        const key = address.toLowerCase();

        if (!merged.has(key)) {
            const normalizedAddress = ethers.getAddress(address);

            merged.set(key, normalizedAddress);
            newUsers.push(normalizedAddress);
        }
    }

    return {
        allUsers: [...merged.values()],
        newUsers
    };
}

// ========================================
// 7. CHECK VAULT STATUS
// ========================================
async function checkVault(userAddress, currentTimestamp) {
    console.log(`\n🔎 ตรวจสอบ Wallet: ${userAddress}`);

    try {
        const vault = await contract.vaults(userAddress);

        if (!vault.isSecuritySet) {
            console.log("⏭️ ยังไม่ได้ตั้งค่า Security");
            return;
        }

        if (!vault.isTrustActive) {
            console.log("⏭️ Trust ไม่ได้เปิดใช้งาน");
            return;
        }

        if (vault.isDistributed) {
            console.log("⏭️ แจกจ่ายครบแล้ว");
            return;
        }

        const lastActive = Number(vault.lastActiveTimestamp);

        const inactiveTime = Math.max(
            0,
            currentTimestamp - lastActive
        );

        const currentStage = Number(vault.inheritanceStage);

        console.log(
            `⏱️ ไม่เคลื่อนไหว: ${Math.floor(inactiveTime / 60)} นาที`
        );

        console.log(`📊 Stage ปัจจุบัน: ${currentStage}`);

        let targetStage = currentStage;

        if (
            inactiveTime >= SEVEN_MINUTES &&
            currentStage < 3
        ) {
            targetStage = 3;
        } else if (
            inactiveTime >= FIVE_MINUTES &&
            inactiveTime < SEVEN_MINUTES &&
            currentStage < 2
        ) {
            targetStage = 2;
        } else if (
            inactiveTime >= THREE_MINUTES &&
            inactiveTime < FIVE_MINUTES &&
            currentStage < 1
        ) {
            targetStage = 1;
        }

        if (targetStage <= currentStage) {
            console.log("⏳ ยังไม่ถึงเวลา Stage ถัดไป");
            return;
        }

        console.log(
            `🚀 เข้าเกณฑ์ Stage ${currentStage} → ${targetStage}`
        );

        console.log(
            "กำลังเรียก Contract เพื่อประมวลผล..."
        );

        const tx = await contract.processAutomatedInheritance(
            userAddress
        );

        console.log("📨 Transaction Hash:", tx.hash);

        const receipt = await tx.wait();

        if (receipt.status === 1) {
            console.log(
                `✅ Transaction สำเร็จ: ${userAddress}`
            );
        } else {
            console.error(
                `❌ Transaction ล้มเหลว: ${userAddress}`
            );
        }

    } catch (error) {
        console.error(
            `❌ ตรวจ Vault ของ ${userAddress} ไม่สำเร็จ:`,
            error.reason ||
            error.shortMessage ||
            error.message
        );
    }
}

// ========================================
// 8. MAIN BOT CYCLE
// ========================================
async function checkAndTriggerVaults() {
    console.log("\n========================================");
    console.log("🤖 Digital Vault Legacy Bot");
    console.log("========================================");

    console.log("Contract:", CONTRACT_ADDRESS);
    console.log("Bot Wallet:", botWallet.address);
    console.log("users.json:", USERS_FILE);

    // ขั้นที่ 1: อ่านรายชื่อเดิม
    const knownUsers = getRegisteredUsers();

    console.log(
        `📂 รายชื่อเดิมใน users.json: ${knownUsers.length}`
    );

    // ขั้นที่ 2: อ่านเลขบล็อก
    const currentBlock = await provider.getBlockNumber();

    console.log("Current Block:", currentBlock);

    // ขั้นที่ 3: สแกน Event
    // ถ้าค้นหา Event ไม่สำเร็จ จะรายงาน Error
    // และไม่เขียนทับรายชื่อเดิม
    const scannedUsers = await scanRegisteredUsers(
        currentBlock
    );

    // ขั้นที่ 4: รวมรายชื่อและตัดรายการซ้ำ
    const { allUsers, newUsers } = mergeUsers(
        knownUsers,
        scannedUsers
    );

    // ขั้นที่ 5: บันทึก Address ใหม่
    if (newUsers.length > 0) {
        console.log(
            `🆕 พบ Address ใหม่ ${newUsers.length} บัญชี`
        );

        for (const address of newUsers) {
            console.log("เพิ่ม:", address);
        }
    } else {
        console.log("ℹ️ ไม่มี Address ใหม่ในรอบนี้");
    }

    // เขียนรายชื่อที่รวมแล้วลงไฟล์
    // รายชื่อเดิมจะยังอยู่ ไม่ถูกลบเพียงเพราะไม่พบ Event รอบนี้
    saveUsers(allUsers);

    console.log(
        `💾 บันทึก users.json แล้ว รวม ${allUsers.length} บัญชี`
    );

    // ขั้นที่ 6: อ่านเวลาจาก Blockchain
    const latestBlock = await provider.getBlock("latest");

    if (!latestBlock) {
        throw new Error("อ่าน Block ล่าสุดไม่สำเร็จ");
    }

    const currentTimestamp = Number(latestBlock.timestamp);

    // ขั้นที่ 7: ตรวจ Vault ของทุก Address ที่รวมแล้ว
    for (const address of allUsers) {
        await checkVault(address, currentTimestamp);
    }

    console.log("\n🏁 จบรอบการตรวจสอบ");
}

// ========================================
// 9. SAFE REPEATING LOOP
// ========================================
async function runBotSafely() {
    if (isChecking) {
        console.log("⏳ รอบก่อนยังทำงานไม่เสร็จ");
        return;
    }

    isChecking = true;

    try {
        await checkAndTriggerVaults();
    } catch (error) {
        console.error(
            "❌ Bot cycle failed:",
            error.reason ||
            error.shortMessage ||
            error.message
        );
    } finally {
        isChecking = false;
    }
}

// ========================================
// 10. START BOT
// ========================================
async function startBot() {
    try {
        // ตรวจสอบว่า RPC ใช้งานได้ก่อนเริ่ม
        const network = await provider.getNetwork();

        console.log("Connected Chain ID:", network.chainId);

        if (network.chainId !== 11155111n) {
            throw new Error(
                "RPC นี้ไม่ได้เชื่อมต่อกับ Sepolia"
            );
        }

        console.log("🚀 Starting Ping Bot...");
        console.log("ตรวจสอบทุก 30 วินาที");

        await runBotSafely();

        setInterval(runBotSafely, CHECK_INTERVAL);

    } catch (error) {
        console.error(
            "❌ เริ่ม Bot ไม่สำเร็จ:",
            error.reason ||
            error.shortMessage ||
            error.message
        );

        process.exitCode = 1;
    }
}

startBot();
