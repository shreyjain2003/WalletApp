$outDir = 'C:\WalletApp\docs'
if (!(Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir | Out-Null }

$docxPath = Join-Path $outDir ("WalletApp_Architecture_Diagrams_" + (Get-Date -Format 'yyyyMMdd_HHmmss') + ".docx")
$tmpRoot = Join-Path $env:TEMP ('walletapp_docx_' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $tmpRoot | Out-Null
New-Item -ItemType Directory -Path (Join-Path $tmpRoot '_rels') | Out-Null
New-Item -ItemType Directory -Path (Join-Path $tmpRoot 'docProps') | Out-Null
New-Item -ItemType Directory -Path (Join-Path $tmpRoot 'word') | Out-Null
New-Item -ItemType Directory -Path (Join-Path $tmpRoot 'word\_rels') | Out-Null

$contentTypes = @'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>
'@

$rels = @'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>
'@

$docRels = @'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships" />
'@

$core = @'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>WalletApp Architecture Diagrams</dc:title>
  <dc:creator>Codex</dc:creator>
  <cp:lastModifiedBy>Codex</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">2026-04-08T00:00:00Z</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">2026-04-08T00:00:00Z</dcterms:modified>
</cp:coreProperties>
'@

$app = @'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>Microsoft Office Word</Application>
</Properties>
'@

function XmlEscape([string]$s) {
  if ($null -eq $s) { return '' }
  return $s.Replace('&','&amp;').Replace('<','&lt;').Replace('>','&gt;').Replace('"','&quot;').Replace("'",'&apos;')
}

$sections = @(
  @{ title='WalletApp Architecture Diagrams'; expl='This document contains key system diagrams for the WalletApp project. Each section includes a short explanation and a Mermaid definition that can be rendered in Mermaid-enabled tools.'; code=$null },
  @{ title='1) Authentication Diagram'; expl='Shows login/register, JWT issuance, and token-based authorization across gateway and services.'; code=@'
flowchart LR
  U["User/Admin (Frontend Angular)"] --> G["API Gateway (Ocelot)"]
  G --> A["AuthService API"]
  A --> DB[(AuthDB: Users, KYC)]
  A --> T["TokenService (JWT)"]
  T --> A
  A --> G
  G --> U

  U -->|"Authorization: Bearer <JWT>"| G
  G -->|"forward token"| W["WalletService / Other Services"]
  W -->|"validate JWT claims"| W
'@ },
  @{ title='2) HLD (High-Level Design)'; expl='Shows macro architecture of frontend, gateway, microservices, databases, RabbitMQ, and SMTP.'; code=@'
flowchart TB
  FE["Frontend (Angular)"] --> GW["Gateway (Ocelot)"]

  GW --> AUTH["AuthService"]
  GW --> WAL["WalletService"]
  GW --> ADM["AdminService"]
  GW --> REW["RewardService"]
  GW --> NOTI["NotificationService"]

  AUTH --> AUTHDB[(AuthDB)]
  WAL --> WALDB[(WalletDB)]
  ADM --> ADMDB[(AdminDB)]
  REW --> REWDB[(RewardDB)]
  NOTI --> NOTIDB[(NotificationDB)]

  AUTH --> MQ[(RabbitMQ)]
  WAL --> MQ
  ADM --> MQ
  REW --> MQ
  MQ --> NOTI

  NOTI --> SMTP["SMTP (Official App Email)"]
'@ },
  @{ title='3) ERD (Entity Relationship Diagram)'; expl='Defines core data entities and database relationships (users, wallets, transactions, notifications, tickets, rewards).'; code=@'
erDiagram
  USERS ||--o| KYC_DOCUMENTS : has
  USERS ||--|| WALLETS : owns
  WALLETS ||--o{ WALLET_TRANSACTIONS : records
  WALLETS ||--o{ WALLET_TRANSACTIONS : target_wallet
  USERS ||--|| REWARD_WALLETS : owns
  REWARD_WALLETS ||--o{ REWARD_TRANSACTIONS : records
  USERS ||--o{ NOTIFICATIONS : receives
  USERS ||--o{ TICKETS : creates
  ADMINS ||--o{ TICKET_REPLIES : posts
  TICKETS ||--o{ TICKET_REPLIES : has
'@ },
  @{ title='4) ER Diagram (Relationship Summary)'; expl='Compact relationship-only view for quick understanding.'; code=@'
flowchart LR
  USERS -->|"1:1"| WALLETS
  USERS -->|"1:0..1"| KYC_DOCUMENTS
  WALLETS -->|"1:N"| WALLET_TRANSACTIONS
  USERS -->|"1:1"| REWARD_WALLETS
  REWARD_WALLETS -->|"1:N"| REWARD_TRANSACTIONS
  USERS -->|"1:N"| NOTIFICATIONS
  USERS -->|"1:N"| TICKETS
  TICKETS -->|"1:N"| TICKET_REPLIES
  ADMINS -->|"1:N"| TICKET_REPLIES
'@ },
  @{ title='5) UML (Layered Service Structure)'; expl='Shows layering and dependency direction (Controller -> Service -> Repository).'; code=@'
classDiagram
  class AuthController
  class IAuthService
  class AuthService
  class IAuthRepository
  class AuthRepository
  class ITransactionPinRepository
  class TransactionPinRepository
  class ITokenService
  class TokenService

  class WalletController
  class IWalletService
  class WalletService
  class IWalletRepository
  class WalletRepository

  class NotificationController
  class INotificationService
  class NotificationService
  class IEmailNotificationService
  class EmailNotificationService

  AuthController --> IAuthService
  IAuthService <|.. AuthService
  AuthService --> IAuthRepository
  IAuthRepository <|.. AuthRepository
  AuthService --> ITransactionPinRepository
  ITransactionPinRepository <|.. TransactionPinRepository
  AuthService --> ITokenService
  ITokenService <|.. TokenService

  WalletController --> IWalletService
  IWalletService <|.. WalletService
  WalletService --> IWalletRepository
  IWalletRepository <|.. WalletRepository

  NotificationController --> INotificationService
  INotificationService <|.. NotificationService
  NotificationService --> IEmailNotificationService
  IEmailNotificationService <|.. EmailNotificationService
'@ },
  @{ title='6) RabbitMQ Flow Diagram'; expl='Describes event producers, broker queues/exchanges, and consumers.'; code=@'
flowchart LR
  AUTH["AuthService"] -->|"notifications, kyc events"| MQ[(RabbitMQ)]
  WAL["WalletService"] -->|"wallet_transfer, wallet_topup, notifications"| MQ
  ADM["AdminService"] -->|"kyc decisions / admin events"| MQ
  REW["RewardService"] -->|"reward events"| MQ

  MQ --> NC["NotificationConsumer"]
  MQ --> KC["KycDecisionConsumer (Auth side)"]
  MQ --> RC["Reward Consumer"]

  NC --> NOTI["NotificationService DB Save"]
  NC --> EMAIL["EmailNotificationService -> SMTP"]
'@ },
  @{ title='7) Data Flow Diagram (Level 1)'; expl='Shows how user/admin actions move through processes and data stores.'; code=@'
flowchart TB
  USER["End User"] --> P1["P1: Authenticate & KYC"]
  ADMIN["Admin"] --> P2["P2: KYC Review & Admin Ops"]
  USER --> P3["P3: Wallet Ops (Topup/Transfer/History)"]
  USER --> P4["P4: Rewards & Notifications"]

  P1 --> D1[(AuthDB)]
  P2 --> D1
  P2 --> D3[(AdminDB)]
  P3 --> D2[(WalletDB)]
  P4 --> D4[(RewardDB)]
  P4 --> D5[(NotificationDB)]

  P1 --> MQ[(RabbitMQ)]
  P2 --> MQ
  P3 --> MQ
  MQ --> P4
  P4 --> SMTP["Email Provider"]
'@ },
  @{ title='8) Sequence Diagram (Transfer with PIN + Email)'; expl='Step-by-step flow of secure transfer with PIN validation and email notification.'; code=@'
sequenceDiagram
  actor U as User
  participant FE as Frontend
  participant GW as Gateway
  participant WS as WalletService
  participant AS as AuthService
  participant MQ as RabbitMQ
  participant NS as NotificationService
  participant SMTP as SMTP

  U->>FE: Enter transfer + PIN
  FE->>GW: POST /api/wallet/transfer
  GW->>WS: Forward request
  WS->>AS: POST /internal/user/{id}/pin/verify
  AS-->>WS: PIN valid
  WS->>WS: Debit sender / credit receiver
  WS->>MQ: Publish transfer + notification events
  WS-->>GW: Transfer success
  GW-->>FE: Response success
  MQ->>NS: Consume notification event
  NS->>SMTP: Send email (includes sender/recipient name)
  SMTP-->>U: Transaction email delivered
'@ }
)

$sb = New-Object System.Text.StringBuilder
[void]$sb.Append('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>')
[void]$sb.Append('<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>')

foreach ($s in $sections) {
  $title = XmlEscape $s.title
  [void]$sb.Append("<w:p><w:r><w:rPr><w:b/></w:rPr><w:t>$title</w:t></w:r></w:p>")

  if ($s.expl) {
    $expl = XmlEscape $s.expl
    [void]$sb.Append("<w:p><w:r><w:t>$expl</w:t></w:r></w:p>")
  }

  if ($s.code) {
    [void]$sb.Append('<w:p><w:r><w:rPr><w:i/></w:rPr><w:t>Mermaid:</w:t></w:r></w:p>')
    $lines = $s.code -split "`r?`n"
    foreach ($line in $lines) {
      $esc = XmlEscape $line
      [void]$sb.Append("<w:p><w:r><w:rPr><w:rFonts w:ascii='Consolas' w:hAnsi='Consolas'/></w:rPr><w:t xml:space='preserve'>$esc</w:t></w:r></w:p>")
    }
  }

  [void]$sb.Append("<w:p><w:r><w:t xml:space='preserve'> </w:t></w:r></w:p>")
}

[void]$sb.Append('<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr>')
[void]$sb.Append('</w:body></w:document>')
$documentXml = $sb.ToString()

$utf8 = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText((Join-Path $tmpRoot '[Content_Types].xml'), $contentTypes, $utf8)
[System.IO.File]::WriteAllText((Join-Path $tmpRoot '_rels\.rels'), $rels, $utf8)
[System.IO.File]::WriteAllText((Join-Path $tmpRoot 'docProps\core.xml'), $core, $utf8)
[System.IO.File]::WriteAllText((Join-Path $tmpRoot 'docProps\app.xml'), $app, $utf8)
[System.IO.File]::WriteAllText((Join-Path $tmpRoot 'word\document.xml'), $documentXml, $utf8)
[System.IO.File]::WriteAllText((Join-Path $tmpRoot 'word\_rels\document.xml.rels'), $docRels, $utf8)

$zipPath = Join-Path $env:TEMP ('walletapp_docx_' + [guid]::NewGuid().ToString('N') + '.zip')
Compress-Archive -Path (Join-Path $tmpRoot '*') -DestinationPath $zipPath -Force
Move-Item -Path $zipPath -Destination $docxPath
Remove-Item -Path $tmpRoot -Recurse -Force

Write-Output "CREATED: $docxPath"
