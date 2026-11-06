const { ethers } = require("ethers");

// ==========================================
// 1. Blockchain Configuration
// ==========================================

const RPC_ENDPOINT = process.env.RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com";

const provider = new ethers.JsonRpcProvider(RPC_ENDPOINT);

const contractAddress =
    "0x1bF160867FB69e6aE2745160B2273F92634F6A86";

// ==========================================
// 2. Smart Contract ABI
// ==========================================

const contractABI = [
    "function vaults(address) view returns (bytes32 hashedUserKey, bytes32 hashedPentax, bool isSecuritySet, uint256 depositPool, bool isDistributed, uint256 lastActiveTimestamp, uint8 inheritanceStage, bool isTrustActive)",

    "function getHeirs(address _user) view returns (tuple(address payable wallet, uint256 percentage)[])"
];

const contract = new ethers.Contract(
    contractAddress,
    contractABI,
    provider
);

// ==========================================
// 3. Fetch Vault Data
// ==========================================

async function fetchVaultDataFromChain(userWalletAddress) {
    try {

        // ตรวจสอบ Wallet Address
        if (!ethers.isAddress(userWalletAddress)) {
            throw new Error("Invalid user wallet address format");
        }

        console.log(
            "⛓️ กำลังอ่าน Smart Contract สำหรับ:",
            userWalletAddress
        );

        // ==========================================
        // ดึงข้อมูล Vault
        // ==========================================

        const vaultData =
            await contract.vaults(userWalletAddress);

        // ==========================================
        // ดึงข้อมูล Heirs
        // ==========================================

        const heirsRaw =
            await contract.getHeirs(userWalletAddress);

        // ==========================================
        // แปลง Wei → ETH
        // ==========================================

        const reserveBalanceETH =
            ethers.formatEther(vaultData.depositPool);

        // ==========================================
        // จัดรูปแบบ Heirs
        // ==========================================

        const beneficiaries = heirsRaw.map((heir) => ({
            walletAddress: heir.wallet,
            percentage: Number(heir.percentage)
        }));

        // ==========================================
        // Return
        // ==========================================

        return {
            success: true,

            data: {
                vaultOwner: userWalletAddress,

                isSecuritySet:
                    vaultData.isSecuritySet,

                reserveBalanceETH,

                heirs: beneficiaries
            }
        };

    } catch (error) {

        console.error(
            "❌ ดึงข้อมูล Smart Contract ล้มเหลว:",
            error.message
        );

        return {
            success: false,
            error: error.message
        };
    }
}

module.exports = {
    fetchVaultDataFromChain
};