# 💳 WalletApp — Full Stack Fintech Application

A production-ready digital wallet application built with **.NET 8 microservices** backend and **Angular 21** frontend.

![Tech Stack](https://img.shields.io/badge/.NET-8.0-purple) ![Angular](https://img.shields.io/badge/Angular-21-red) ![SQL Server](https://img.shields.io/badge/SQL%20Server-2022-blue) ![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-green) ![RabbitMQ](https://img.shields.io/badge/RabbitMQ-3.x-orange)

## 🏗️ Architecture
```
WalletApp/
├── AuthService          → JWT auth, KYC management
├── WalletService        → Wallet, transfers, history
├── AdminService         → KYC approval, support tickets
├── RewardService        → Points system, tier management
├── NotificationService  → MongoDB Atlas, RabbitMQ consumer
├── Gateway              → Ocelot API Gateway
└── wallet-app           → Angular 21 frontend
```

## 🚀 Tech Stack

### Backend
- **.NET 8** — ASP.NET Core Web API (Controllers)
- **Entity Framework Core 8** — Database first approach
- **SQL Server** — 5 separate databases (one per service)
- **MongoDB Atlas** — Notifications storage
- **RabbitMQ** — Async messaging between microservices
- **Ocelot** — API Gateway & routing
- **JWT Bearer** — Authentication & authorization
- **BCrypt** — Password hashing

### Frontend
- **Angular 21** — Standalone components architecture
- **Angular Material** — UI component library
- **Dark Mode** — System-wide theme toggle
- **Responsive Design** — Mobile friendly

## ✨ Features

### User Features
- ✅ Register and login with JWT authentication
- ✅ KYC submission from frontend
- ✅ Wallet top-up with quick amount selection
- ✅ Wallet-to-wallet transfer by email
- ✅ Transaction history with income/expense summary
- ✅ Rewards points system (Bronze/Silver/Gold tiers)
- ✅ Real-time notifications via MongoDB
- ✅ Support ticket submission and tracking
- ✅ Dark mode toggle

### Admin Features
- ✅ KYC review and approval/rejection
- ✅ KYC auto-synced via RabbitMQ
- ✅ User auto-activated on KYC approval
- ✅ Wallet auto-created on KYC approval
- ✅ Support ticket management and replies

### System Features
- ✅ Microservices architecture
- ✅ Event-driven communication via RabbitMQ
- ✅ API Gateway with Ocelot
- ✅ Database-per-service pattern
- ✅ JWT token validation across services

## 📡 Service Ports

| Service | Port | Database |
|---|---|---|
| Gateway | 5000 | — |
| AuthService | 7264 | WalletAuth (SQL Server) |
| WalletService | 5163 | WalletWallet (SQL Server) |
| AdminService | 5292 | WalletAdmin (SQL Server) |
| RewardService | 5219 | WalletReward (SQL Server) |
| NotificationService | 5125 | MongoDB Atlas |
| Angular Frontend | 4200 | — |

## 🛠️ Setup & Installation

### Prerequisites
- .NET 8 SDK
- SQL Server / SQL Server Express
- RabbitMQ (with Erlang)
- MongoDB Atlas account (free tier)
- Node.js 22+
- Angular CLI 21

### Backend Setup

1. Clone the repository:
```bash
git clone https://github.com/yourusername/WalletApp.git
cd WalletApp
```

2. Create databases in SQL Server:
```sql
CREATE DATABASE WalletAuth;
CREATE DATABASE WalletWallet;
CREATE DATABASE WalletPayment;
CREATE DATABASE WalletAdmin;
CREATE DATABASE WalletReward;
```

3. Copy `appsettings.template.json` to `appsettings.json` in each service and update:
   - SQL Server connection strings
   - MongoDB Atlas connection string
   - JWT secret key

4. Open `WalletApp.slnx` in Visual Studio

5. Set all 6 projects as startup projects and press F5

### Frontend Setup
```bash
cd wallet-app
npm install
ng serve
```

Open browser at `http://localhost:4200`

## 👤 Default Credentials

### Admin Account
```
Email: admin@walletapp.com
Password: Admin@123
```

## 🔄 Event Flow
```
User submits KYC
    → AuthService publishes to kyc_submissions queue
    → AdminService consumer syncs to admin database
    → Admin approves KYC
    → AdminService publishes to kyc_decisions queue
    → AuthService consumer activates user
    → WalletService consumer creates wallet
    → NotificationService saves notification to MongoDB
```

## 📄 License

MIT License — see [LICENSE](LICENSE) file for details.

## 👨‍💻 Author

**Shreyansh Jain** — Built with ❤️ using .NET 8 and Angular 21