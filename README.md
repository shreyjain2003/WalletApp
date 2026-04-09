# WalletApp

Full-stack digital wallet platform built with a microservices backend in .NET 8 and an Angular frontend.

## Repository Layout

```text
WalletApp/
|-- frontend/
|   `-- wallet-app/
|       `-- Angular application
|-- backend/
|   |-- AuthService/
|   |-- WalletService/
|   |-- AdminService/
|   |-- RewardService/
|   |-- NotificationService/
|   `-- Gateway/
|-- WalletApp.slnx
`-- ARCHITECTURE.md
```

## Backend Architecture

Each backend service follows the same layers:

- `Controllers/` for HTTP endpoints and authorization
- `Services/` for business logic and orchestration
- `Repositories/` for persistence access
- `DTOs/` for request and response contracts
- `Models/` for entities
- `Data/` for EF Core database contexts
- `Consumers/` for RabbitMQ event handling

Request flow:

```text
Frontend -> Gateway -> Controller -> Service -> Repository -> Database
```

Event flow:

```text
Service -> RabbitMQ -> Consumer -> Service/Repository -> Database
```

## Services

- `backend/AuthService` handles authentication, profiles, and KYC ownership
- `backend/WalletService` handles balances, transfers, transaction history, and exports
- `backend/AdminService` handles KYC review and support tickets
- `backend/RewardService` handles reward points and tiers
- `backend/NotificationService` handles in-app notifications and email delivery
- `backend/Gateway` exposes the frontend-facing Ocelot routes

## Local Development

### Backend

Open `WalletApp.slnx` in Visual Studio or run the projects under `backend/`.

### Frontend

```bash
cd frontend/wallet-app
npm install
ng serve
```

The Angular app runs on `http://localhost:4200` and talks to the gateway on `http://localhost:5000`.

## Default Admin Credentials

```text
Email: admin@walletapp.com
Password: Admin@123
```
