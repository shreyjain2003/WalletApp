USE WalletAdmin;

INSERT INTO KycReviews (
    Id, UserId, UserFullName, UserEmail,
    DocumentType, DocumentNumber, Status, SubmittedAt
)
VALUES (
    NEWID(),
    '01b1c50e-ac54-4b23-8328-fcd2cadfc984',  -- Test User's ID
    'Test User',
    'test@example.com',
    'passport',
    'P1234567',
    'Pending',
    GETUTCDATE()
);
GO

