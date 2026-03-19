USE WalletAuth;
GO

-- Delete placeholder if exists
DELETE FROM Users WHERE Email = 'admin@walletapp.com';

-- Insert admin with real BCrypt hash for password "Admin@123"
INSERT INTO Users (Id, FullName, Email, PhoneNumber, PasswordHash, Role, Status, CreatedAt)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'System Admin',
    'admin@walletapp.com',
    '0000000000',
    '$2a$11$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
    'Admin',
    'Active',
    GETUTCDATE()
);
GO