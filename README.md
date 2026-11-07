# Digital Inheritance Vault

> **Hybrid Web2/Web3 Digital Estate & Inheritance Vault**  
An automated asset management and digital inheritance system bridging Web 2.0 user dashboards with Web 3.0 smart contract execution.

---

## Architecture Overview

The system combines off-chain monitoring for fast user experience with on-chain cryptographic security for asset delivery:
- **Web 2.0 (Read & Dashboard Layer):** User management, off-chain metadata storage, and inactivity monitoring dashboard served securely via Nginx and managed by PM2.
- **Web 3.0 (Asset Vault & Execution Layer):** Non-custodial escrow smart contracts deployed on EVM Testnet, handling token deposits and time-based inheritance releases (Dead Man's Switch).

---

## Key Features

-  **Non-Custodial Vault:** Assets remain entirely secured by smart contracts until execution conditions are met.
-  **Dead Man's Switch Engine:** Automated inheritance trigger based on verifiable account inactivity timeouts.
-  **Real-time Web2 Indexing:** Fast off-chain API indexing for balances, vault status, and beneficiary management.
-  **Production-Ready Infrastructure:** Scalable backend deployment configured with PM2 process management and Nginx reverse proxy.
-  **System Testing:** Unit and integration ngrok testing protocols ensuring smart contract and backend reliability.

---

## Project Team & Credits

- **[@sirichai-ar](https://github.com/sirichai-ar)** - **Project Lead, Systems Architect & PM** *(Hybrid Architecture, Smart Contracts, Full-Stack Dev)*
- **[@friend1-username](https://github.com/friend1-username)** - **Black-Box Security & QA Specialist** *(Black-Box Pentesting, Security Audit)*
- **[@friend2-username](https://github.com/friend2-username)** - **White-Box & API Testing Specialist** *(White-Box Audit, UI Testing, API Security)*

---

## Tech Stack & Tools

- **Backend & Infrastructure:** Node.js, Express, ngrok, PM2, Firebase / Database
- **Web3 & Blockchain:** Solidity, EVM Testnet, MetaMask, Web3.js / Ethers.js
- **Testing & Quality Assurance:** Automated Testing & Integration Protocols
- **Project Management & Design:** Jira (Agile/Scrum Framework), Figma (UI/UX Design)
