USE WalletAuth;
UPDATE Users 
SET Role = 'Admin', Status = 'Active'
WHERE Email = 'admin@walletapp.com';