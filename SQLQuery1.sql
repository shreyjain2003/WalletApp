CREATE DATABASE WalletAuth;
CREATE DATABASE WalletWallet;
CREATE DATABASE WalletPayment;
CREATE DATABASE WalletAdmin;
CREATE DATABASE WalletReward;
GO

USE WalletAuth;
GO

CREATE TABLE Users (
    Id            UNIQUEIDENTIFIER  PRIMARY KEY DEFAULT NEWID(),
    FullName      NVARCHAR(200)     NOT NULL,
    Email         NVARCHAR(256)     NOT NULL,
    PhoneNumber   NVARCHAR(20)      NOT NULL,
    PasswordHash  NVARCHAR(MAX)     NOT NULL,
    Role          NVARCHAR(20)      NOT NULL DEFAULT 'User',
    Status        NVARCHAR(20)      NOT NULL DEFAULT 'Pending',
    CreatedAt     DATETIME2         NOT NULL DEFAULT GETUTCDATE(),

    CONSTRAINT UQ_Users_Email  UNIQUE (Email),
    CONSTRAINT UQ_Users_Phone  UNIQUE (PhoneNumber)
);
GO

CREATE TABLE KycDocuments (
    Id             UNIQUEIDENTIFIER  PRIMARY KEY DEFAULT NEWID(),
    UserId         UNIQUEIDENTIFIER  NOT NULL,
    DocumentType   NVARCHAR(50)      NOT NULL,
    DocumentNumber NVARCHAR(100)     NOT NULL,
    Status         NVARCHAR(20)      NOT NULL DEFAULT 'Pending',
    AdminNote      NVARCHAR(500)     NULL,
    SubmittedAt    DATETIME2         NOT NULL DEFAULT GETUTCDATE(),
    ReviewedAt     DATETIME2         NULL,

    CONSTRAINT FK_Kyc_Users
        FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE CASCADE,

    CONSTRAINT UQ_Kyc_UserId UNIQUE (UserId)
);
GO


USE WalletWallet;
GO

CREATE TABLE Wallets (
    Id         UNIQUEIDENTIFIER  PRIMARY KEY DEFAULT NEWID(),
    UserId     UNIQUEIDENTIFIER  NOT NULL,
    Balance    DECIMAL(18,2)     NOT NULL DEFAULT 0.00,
    Currency   NVARCHAR(10)      NOT NULL DEFAULT 'INR',
    IsLocked   BIT               NOT NULL DEFAULT 0,
    CreatedAt  DATETIME2         NOT NULL DEFAULT GETUTCDATE(),
    UpdatedAt  DATETIME2         NOT NULL DEFAULT GETUTCDATE(),

    CONSTRAINT UQ_Wallets_UserId UNIQUE (UserId)
);
GO

CREATE TABLE WalletTransactions (
    Id           UNIQUEIDENTIFIER  PRIMARY KEY DEFAULT NEWID(),
    WalletId     UNIQUEIDENTIFIER  NOT NULL,
    ToWalletId   UNIQUEIDENTIFIER  NULL,
    Type         NVARCHAR(30)      NOT NULL,
    Amount       DECIMAL(18,2)     NOT NULL,
    BalanceAfter DECIMAL(18,2)     NOT NULL,
    Status       NVARCHAR(20)      NOT NULL DEFAULT 'Success',
    Reference    NVARCHAR(100)     NOT NULL,
    Note         NVARCHAR(500)     NULL,
    CreatedAt    DATETIME2         NOT NULL DEFAULT GETUTCDATE(),

    CONSTRAINT FK_Transactions_Wallet
        FOREIGN KEY (WalletId) REFERENCES Wallets(Id),

    CONSTRAINT UQ_Transactions_Reference UNIQUE (Reference)
);
GO

USE WalletPayment;
GO

CREATE TABLE Payments (
    Id         UNIQUEIDENTIFIER  PRIMARY KEY DEFAULT NEWID(),
    UserId     UNIQUEIDENTIFIER  NOT NULL,
    WalletId   UNIQUEIDENTIFIER  NOT NULL,
    Amount     DECIMAL(18,2)     NOT NULL,
    Type       NVARCHAR(30)      NOT NULL,
    Status     NVARCHAR(20)      NOT NULL DEFAULT 'Pending',
    GatewayRef NVARCHAR(200)     NULL,
    Note       NVARCHAR(500)     NULL,
    CreatedAt  DATETIME2         NOT NULL DEFAULT GETUTCDATE(),
    UpdatedAt  DATETIME2         NOT NULL DEFAULT GETUTCDATE()
);
GO

USE WalletAdmin;
GO

CREATE TABLE KycReviews (
    Id             UNIQUEIDENTIFIER  PRIMARY KEY DEFAULT NEWID(),
    UserId         UNIQUEIDENTIFIER  NOT NULL,
    UserFullName   NVARCHAR(200)     NOT NULL,
    UserEmail      NVARCHAR(256)     NOT NULL,
    DocumentType   NVARCHAR(50)      NOT NULL,
    DocumentNumber NVARCHAR(100)     NOT NULL,
    Status         NVARCHAR(20)      NOT NULL DEFAULT 'Pending',
    AdminNote      NVARCHAR(500)     NULL,
    ReviewedBy     UNIQUEIDENTIFIER  NULL,
    SubmittedAt    DATETIME2         NOT NULL DEFAULT GETUTCDATE(),
    ReviewedAt     DATETIME2         NULL,

    CONSTRAINT UQ_KycReviews_UserId UNIQUE (UserId)
);
GO

CREATE TABLE SupportTickets (
    Id          UNIQUEIDENTIFIER  PRIMARY KEY DEFAULT NEWID(),
    UserId      UNIQUEIDENTIFIER  NOT NULL,
    UserEmail   NVARCHAR(256)     NOT NULL,
    Subject     NVARCHAR(300)     NOT NULL,
    Message     NVARCHAR(MAX)     NOT NULL,
    Status      NVARCHAR(20)      NOT NULL DEFAULT 'Open',
    AdminReply  NVARCHAR(MAX)     NULL,
    RespondedBy UNIQUEIDENTIFIER  NULL,
    CreatedAt   DATETIME2         NOT NULL DEFAULT GETUTCDATE(),
    RespondedAt DATETIME2         NULL
);
GO

USE WalletReward;
GO

CREATE TABLE Rewards (
    Id            UNIQUEIDENTIFIER  PRIMARY KEY DEFAULT NEWID(),
    UserId        UNIQUEIDENTIFIER  NOT NULL,
    PointsBalance INT               NOT NULL DEFAULT 0,
    TotalEarned   INT               NOT NULL DEFAULT 0,
    Tier          NVARCHAR(20)      NOT NULL DEFAULT 'Bronze',
    CreatedAt     DATETIME2         NOT NULL DEFAULT GETUTCDATE(),
    UpdatedAt     DATETIME2         NOT NULL DEFAULT GETUTCDATE(),

    CONSTRAINT UQ_Rewards_UserId UNIQUE (UserId)
);
GO

CREATE TABLE RewardTransactions (
    Id        UNIQUEIDENTIFIER  PRIMARY KEY DEFAULT NEWID(),
    UserId    UNIQUEIDENTIFIER  NOT NULL,
    Points    INT               NOT NULL,
    Reason    NVARCHAR(100)     NOT NULL,
    Reference NVARCHAR(100)     NOT NULL,
    CreatedAt DATETIME2         NOT NULL DEFAULT GETUTCDATE()
);
GO