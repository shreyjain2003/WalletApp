# WalletApp Architecture

## Frontend

- `frontend/wallet-app/`
  - Angular standalone application
  - Talks only to the gateway at `http://localhost:5000`
  - Organized by feature under `src/app/features`
  - Shared client-side services live under `src/app/core/services`

## Backend

- `backend/AuthService/`
  - authentication, user profile, KYC ownership
- `backend/WalletService/`
  - wallet balance, transfer, history, exports
- `backend/AdminService/`
  - KYC review and support tickets
- `backend/RewardService/`
  - reward points and tiers
- `backend/NotificationService/`
  - notification delivery and email
- `backend/Gateway/`
  - Ocelot API gateway for frontend-facing routes

## Backend Layers

Each backend service follows the same layering model:

1. `Controllers/`
   - HTTP endpoints only
   - request/response orchestration
   - authorization checks

2. `Services/`
   - business rules
   - workflow orchestration
   - publishing integration events

3. `Repositories/`
   - data access abstraction
   - hides EF Core or MongoDB details from services

4. `DTOs/`
   - API contracts
   - request and response shapes

5. `Models/`
   - persistence entities

6. `Data/`
   - database contexts

7. `Consumers/`
   - background event handlers

## Repository Pattern

Repository interfaces are now defined per backend service context:

- `AuthService/Repositories/AuthRepository.cs`
- `WalletService/Repositories/WalletRepository.cs`
- `AdminService/Repositories/AdminRepository.cs`
- `RewardService/Repositories/RewardRepository.cs`
- `NotificationService/Repositories/NotificationRepository.cs`
- concretely located under `backend/<ServiceName>/Repositories/`

This keeps business services independent from direct database calls and improves:

- testability
- separation of concerns
- maintainability
- consistency across services

## Request Flow

Typical request flow:

`Frontend -> Gateway -> Controller -> Service -> Repository -> Database`

Typical event flow:

`Service -> RabbitMQ -> Consumer -> Service/Repository -> Database`

## Dependency Injection

Each service registers:

- business service interfaces
- repository interfaces
- messaging publishers
- hosted consumers where applicable

That keeps all dependencies explicit and replaceable.
