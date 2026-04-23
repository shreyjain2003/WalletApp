const fs = require('fs');

const path = 'c:/Trunqo/frontend/trunqo-app/src/app/features/admin/user-list/user-list.ts';
let content = fs.readFileSync(path, 'utf8');

const newTemplate = \
    <div class="spinner-overlay" *ngIf="loading"><div class="spinner"></div></div>

    <!-- Edit Wallet Modal -->
    <div class="modal-overlay" *ngIf="editingUser">
      <div class="modal wa-card">
        <div class="modal-header">
          <div class="modal-avatar">{{ getInitials(editingUser.fullName) }}</div>
          <div>
            <h3>Edit User & Wallet</h3>
            <p class="modal-sub">{{ editingUser.fullName }}</p>
          </div>
          <button class="modal-close" (click)="cancelEdit()">
            <mat-icon>close</mat-icon>
          </button>
        </div>

        <div class="modal-body">
          <div class="modal-field">
            <div class="wa-label">Full Name</div>
            <div class="wa-input-wrap">
              <mat-icon>person</mat-icon>
              <input type="text" [(ngModel)]="editFullName" placeholder="Full name"/>
            </div>
          </div>

          <div class="modal-field">
            <div class="wa-label">Email</div>
            <div class="wa-input-wrap">
              <mat-icon>email</mat-icon>
              <input type="email" [(ngModel)]="editEmail" placeholder="Email address"/>
            </div>
          </div>

          <div class="modal-field">
            <div class="wa-label">Phone Number</div>
            <div class="wa-input-wrap">
              <mat-icon>phone</mat-icon>
              <input type="text" [(ngModel)]="editPhoneNumber" placeholder="10-digit mobile number"/>
            </div>
          </div>

          <div class="modal-field">
            <div class="wa-label">New Balance (Rs.)</div>
            <div class="wa-input-wrap">
              <mat-icon>currency_rupee</mat-icon>
              <input type="number" [(ngModel)]="newBalance" placeholder="0"/>
            </div>
          </div>

          <div class="modal-field">
            <div class="wa-label">Reason</div>
            <div class="wa-input-wrap">
              <mat-icon>edit_note</mat-icon>
              <input type="text" [(ngModel)]="adjustReason" placeholder="Reason for adjustment"/>
            </div>
          </div>

          <div class="lock-toggle">
            <div class="lock-info">
              <mat-icon [class]="editingLocked ? 'locked' : 'unlocked'">
                {{ editingLocked ? 'lock' : 'lock_open' }}
              </mat-icon>
              <span>Wallet {{ editingLocked ? 'Locked' : 'Unlocked' }}</span>
            </div>
            <button class="toggle-btn" [class]="editingLocked ? 'unlock' : 'lock'"
                    (click)="editingLocked = !editingLocked">
              {{ editingLocked ? 'Unlock Wallet' : 'Lock Wallet' }}
            </button>
          </div>
        </div>

        <div class="modal-actions">
          <button class="cancel-btn" (click)="cancelEdit()">Cancel</button>
          <button class="wa-btn-primary full-width" style="flex:2; margin:0;" (click)="saveWalletChanges()" [disabled]="saving">
            <mat-icon>save</mat-icon> {{ saving ? 'Saving...' : 'Save Changes' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Delete Confirm Modal -->
    <div class="modal-overlay" *ngIf="deletingUser">
      <div class="modal delete-modal wa-card">
        <div class="delete-icon"><mat-icon>warning</mat-icon></div>
        <h3 style="color:var(--text-primary); font-family: 'Outfit', sans-serif;">Delete User?</h3>
        <p style="color:var(--text-muted);">Are you sure you want to permanently delete
          <strong style="color:var(--danger);">{{ deletingUser.fullName }}</strong>?
          This action cannot be undone.
        </p>
        <div class="modal-actions">
          <button class="cancel-btn" (click)="deletingUser = null">Cancel</button>
          <button class="delete-confirm-btn" (click)="confirmDelete()" [disabled]="deleting">
            <mat-icon>delete_forever</mat-icon> {{ deleting ? 'Deleting...' : 'Delete Permanently' }}
          </button>
        </div>
      </div>
    </div>

    <div class="page-container">
      <div class="navbar">
        <div class="nav-content">
          <span class="brand"><mat-icon style="margin-right:8px; vertical-align:middle;">admin_panel_settings</mat-icon>Admin Panel</span>
          <div class="nav-links">
            <a style="cursor:pointer;" routerLink="/admin/kyc">KYC</a>
            <a style="cursor:pointer;" routerLink="/admin/tickets">Tickets</a>
            <a style="cursor:pointer;" (click)="logout()"><mat-icon>logout</mat-icon> Logout</a>
          </div>
        </div>
      </div>

      <div class="content">
        <div class="page-header">
          <h2 class="page-title" style="margin:0;">Registered Users</h2>
          <span class="user-count">{{ filteredUsers.length }} users</span>
        </div>

        <div class="summary-grid">
          <div class="summary-item wa-card active">
            <mat-icon>check_circle</mat-icon><div><p class="s-label">Active</p><p class="s-num">{{ activeCount }}</p></div>
          </div>
          <div class="summary-item wa-card pending">
            <mat-icon>hourglass_empty</mat-icon><div><p class="s-label">Pending</p><p class="s-num">{{ pendingCount }}</p></div>
          </div>
          <div class="summary-item wa-card total">
            <mat-icon>group</mat-icon><div><p class="s-label">Total</p><p class="s-num">{{ users.length }}</p></div>
          </div>
        </div>

        <div class="wa-input-wrap search-wrap" style="margin-bottom: 24px;">
          <mat-icon>search</mat-icon>
          <input type="text" [(ngModel)]="searchQuery" (input)="filterUsers()" placeholder="Search by name or email..."/>
          <button *ngIf="searchQuery" (click)="searchQuery=''; filterUsers()" style="background:transparent; border:none; color:var(--text-muted); cursor:pointer; padding:0;"><mat-icon>close</mat-icon></button>
        </div>

        <div class="wa-card empty-state" *ngIf="filteredUsers.length === 0 && !loading" style="text-align:center; padding: 48px;">
          <mat-icon style="font-size: 48px; width:48px; height:48px; opacity: 0.5; margin-bottom:16px;">search_off</mat-icon>
          <p class="empty" style="color:var(--text-muted); margin:0;">No users found.</p>
        </div>

        <div class="user-card wa-card" *ngFor="let user of filteredUsers" style="margin-bottom: 16px;">
          <div class="user-header">
            <div class="user-avatar">{{ getInitials(user.fullName) }}</div>
            <div class="user-info">
              <p class="user-name">{{ user.fullName }}</p>
              <p class="user-email">{{ user.email }}</p>
              <p class="user-phone">Phone: {{ user.phoneNumber }}</p>
            </div>
            <div class="user-badges">
              <span class="status-badge" [class]="user.status.toLowerCase()">{{ user.status }}</span>
            </div>
          </div>

          <div class="kyc-section" *ngIf="user.kyc">
            <div class="kyc-row"><span class="kyc-label">Document</span><span style="font-weight:500;">{{ user.kyc.documentType }} - {{ user.kyc.documentNumber }}</span></div>
            <div class="kyc-row"><span class="kyc-label">KYC Status</span><span class="status-badge" [class]="user.kyc.status.toLowerCase()">{{ user.kyc.status }}</span></div>
          </div>
          <div class="no-kyc" *ngIf="!user.kyc"><mat-icon>info_outline</mat-icon><span>KYC not submitted yet</span></div>

          <div class="wallet-section" *ngIf="user.wallet">
            <div class="wallet-balance">
              <mat-icon style="color:var(--teal);">account_balance_wallet</mat-icon>
              <span class="balance-val">Rs. {{ user.wallet.balance | number:'1.2-2' }}</span>
              <span class="wallet-status-badge" [class]="user.wallet.isLocked ? 'locked' : 'active'">{{ user.wallet.isLocked ? 'Locked' : 'Active' }}</span>
            </div>
          </div>
          <div class="no-wallet" *ngIf="!user.wallet"><mat-icon>account_balance_wallet</mat-icon><span>No wallet created yet</span></div>

          <div class="action-row">
            <button class="action-btn edit" (click)="startEdit(user)"><mat-icon>edit</mat-icon> Edit User</button>
            <button class="action-btn delete" (click)="startDelete(user)"><mat-icon>delete</mat-icon> Delete User</button>
          </div>
        </div>
      </div>
    </div>
  \`;

const newStyles = \[
    \.page-container { min-height: 100vh; background: var(--bg); color: var(--text-primary); }\,
    \\,
    \.navbar {\,
    \  background: var(--bg-card); border-bottom: 1px solid var(--border);\,
    \  position: sticky; top: 0; z-index: 100;\,
    \}\,
    \.nav-content { display: flex; align-items: center; justify-content: space-between; max-width: 1000px; margin: 0 auto; padding: 16px 24px; }\,
    \.brand { font-size: 18px; font-weight: 800; color: var(--text-primary); font-family: 'Outfit', sans-serif; display:flex; align-items:center; }\,
    \.nav-links { display: flex; gap: 24px; align-items: center; }\,
    \.nav-links a { display:flex; align-items:center; gap:6px; color: var(--text-secondary); text-decoration: none; font-weight: 600; font-size: 14px; transition: color 0.2s; }\,
    \.nav-links a:hover { color: var(--teal); }\,
    \.nav-links mat-icon { font-size: 18px; width: 18px; height: 18px; }\,
    \\,
    \.content { padding: 32px 20px; max-width: 1000px; margin: 0 auto; }\,
    \\,
    \.page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; }\,
    \.page-title { font-size: 28px; font-weight: 800; font-family: 'Outfit', sans-serif; letter-spacing: -1px; }\,
    \.user-count { background: rgba(192, 133, 82, 0.15); color: var(--teal); padding: 6px 14px; border-radius: 20px; font-size: 13px; font-weight: 700; border: 1px solid rgba(192, 133, 82, 0.3); }\,
    \\,
    \.summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 24px; }\,
    \.summary-item { padding: 20px; display: flex; align-items: center; gap: 16px; margin: 0; border: 1px solid var(--border); }\,
    \.summary-item mat-icon { font-size: 36px; width: 36px; height: 36px; padding: 12px; border-radius: 12px; }\,
    \.summary-item.active mat-icon  { color: #10B981; background: rgba(16,185,129,0.1); }\,
    \.summary-item.pending mat-icon { color: #F59E0B; background: rgba(245,158,11,0.1); }\,
    \.summary-item.total  mat-icon  { color: var(--teal); background: rgba(192, 133, 82, 0.1); }\,
    \.s-num   { margin: 4px 0 0; font-size: 24px; font-weight: 800; color: var(--text-primary); font-family: 'Outfit', sans-serif; line-height:1; }\,
    \.s-label { margin: 0; font-size: 13px; color: var(--text-secondary); text-transform:uppercase; font-weight:600; letter-spacing: 0.5px; }\,
    \\,
    \.user-card { padding: 24px; }\,
    \.user-header { display: flex; align-items: flex-start; gap: 16px; margin-bottom: 20px; }\,
    \.user-avatar { width: 52px; height: 52px; border-radius: 12px; background: rgba(192, 133, 82, 0.1); border: 1px solid rgba(192, 133, 82, 0.2); color: var(--teal); font-size: 18px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }\,
    \.user-info { flex: 1; }\,
    \.user-name  { margin: 0; font-weight: 700; font-size: 16px; color: var(--text-primary); }\,
    \.user-email { margin: 4px 0; color: var(--text-secondary); font-size: 14px; }\,
    \.user-phone { margin: 0; color: var(--text-muted); font-size: 13px; }\,
    \\,
    \.status-badge { padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 700; white-space: nowrap; border: 1px solid transparent; }\,
    \.status-badge.active   { background: rgba(16,185,129,0.1); color: #10B981; border-color: rgba(16,185,129,0.2); }\,
    \.status-badge.pending  { background: rgba(245,158,11,0.1); color: #F59E0B; border-color: rgba(245,158,11,0.2); }\,
    \.status-badge.rejected { background: rgba(239,68,68,0.1); color: #EF4444; border-color: rgba(239,68,68,0.2); }\,
    \.status-badge.approved { background: rgba(16,185,129,0.1); color: #10B981; border-color: rgba(16,185,129,0.2); }\,
    \\,
    \.kyc-section { background: var(--bg); border-radius: 12px; padding: 16px; border: 1px solid var(--border); margin-bottom: 16px; }\,
    \.kyc-row { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px dashed var(--border); font-size: 14px; color: var(--text-primary); }\,
    \.kyc-row:last-child { border-bottom: none; padding-bottom: 0; }\,
    \.kyc-row:first-child { padding-top: 0; }\,
    \.kyc-label { color: var(--text-secondary); }\,
    \\,
    \.no-kyc, .no-wallet { display: flex; align-items: center; gap: 8px; color: var(--text-muted); font-size: 13px; padding: 8px 0; margin-bottom: 16px; }\,
    \.no-kyc mat-icon, .no-wallet mat-icon { font-size: 18px; width: 18px; height: 18px; }\,
    \\,
    \.wallet-section { background: rgba(192, 133, 82, 0.05); border-radius: 12px; padding: 16px; border: 1px dashed rgba(192, 133, 82, 0.3); margin-bottom: 16px; }\,
    \.wallet-balance { display: flex; align-items: center; gap: 12px; }\,
    \.balance-val { font-size: 20px; font-weight: 800; color: var(--text-primary); font-family: 'Outfit', sans-serif; flex: 1; }\,
    \.wallet-status-badge { font-size: 12px; font-weight: 700; padding: 4px 12px; border-radius: 20px; }\,
    \.wallet-status-badge.active { background: rgba(16,185,129,0.1); color: #10B981; }\,
    \.wallet-status-badge.locked { background: rgba(239,68,68,0.1); color: #EF4444; }\,
    \\,
    \.action-row { display: flex; gap: 12px; margin-top: 20px; }\,
    \.action-btn { flex: 1; height: 44px; border: none; border-radius: var(--r-md); font-size: 14px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; font-family: 'Inter', sans-serif; transition: all 0.2s ease; border: 1px solid var(--border); }\,
    \.action-btn mat-icon { font-size: 18px; width: 18px; height: 18px; }\,
    \.action-btn.edit { background: var(--bg); color: var(--text-primary); }\,
    \.action-btn.edit:hover { background: rgba(192, 133, 82, 0.1); border-color: var(--teal); color: var(--teal); }\,
    \.action-btn.delete { background: rgba(239, 68, 68, 0.05); color: #EF4444; border-color: rgba(239, 68, 68, 0.2); }\,
    \.action-btn.delete:hover { background: rgba(239, 68, 68, 0.1); }\,
    \\,
    \/* Modals */\,
    \.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.8); backdrop-filter: blur(8px); z-index: 1000; display: flex; align-items: center; justify-content: center; animation: fadeIn 0.2s ease; }\,
    \@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }\,
    \.modal { padding: 32px; width: 100%; max-width: 440px; margin: 20px; max-height: 90vh; overflow-y: auto; background: var(--bg-card); animation: slideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); }\,
    \@keyframes slideUp { from { opacity: 0; transform: translateY(40px) scale(0.95); } to   { opacity: 1; transform: translateY(0) scale(1); } }\,
    \\,
    \.modal-header { display: flex; align-items: center; gap: 16px; margin-bottom: 24px; }\,
    \.modal-avatar { width: 48px; height: 48px; border-radius: 12px; background: rgba(192, 133, 82, 0.15); color: var(--teal); font-size: 16px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; border: 1px solid rgba(192, 133, 82, 0.3); }\,
    \.modal-header h3 { margin: 0; font-size: 20px; font-weight: 700; color: var(--text-primary); font-family: 'Outfit', sans-serif; flex: 1; }\,
    \.modal-sub { margin: 2px 0 0; font-size: 13px; color: var(--text-secondary); }\,
    \.modal-close { border: none; background: transparent; cursor: pointer; display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: 50%; transition: background 0.2s; }\,
    \.modal-close:hover { background: var(--bg); }\,
    \.modal-close mat-icon { color: var(--text-muted); font-size: 20px; width: 20px; height: 20px; }\,
    \\,
    \.modal-field { margin-bottom: 20px; }\,
    \.lock-toggle { display: flex; align-items: center; justify-content: space-between; background: var(--bg); border: 1px solid var(--border); border-radius: 12px; padding: 16px; margin-bottom: 24px; }\,
    \.lock-info { display: flex; align-items: center; gap: 10px; font-size: 14px; font-weight: 600; color: var(--text-primary); }\,
    \.lock-info mat-icon { font-size: 20px; width: 20px; height: 20px; }\,
    \.lock-info mat-icon.locked   { color: #EF4444; }\,
    \.lock-info mat-icon.unlocked { color: #10B981; }\,
    \.toggle-btn { padding: 8px 16px; border: none; border-radius: 8px; font-size: 13px; font-weight: 700; cursor: pointer; font-family: 'Inter', sans-serif; transition: all 0.2s; }\,
    \.toggle-btn.lock   { background: rgba(239, 68, 68, 0.1); color: #EF4444; border: 1px solid rgba(239, 68, 68, 0.2); }\,
    \.toggle-btn.unlock { background: rgba(16, 185, 129, 0.1); color: #10B981; border: 1px solid rgba(16, 185, 129, 0.2); }\,
    \\,
    \.modal-actions { display: flex; gap: 12px; }\,
    \.cancel-btn { flex: 1; height: 46px; border: 1px solid var(--border); border-radius: var(--r-md); background: transparent; color: var(--text-secondary); font-size: 14px; font-weight: 600; cursor: pointer; font-family: 'Inter', sans-serif; transition: all 0.2s; }\,
    \.cancel-btn:hover { background: var(--bg); color: var(--text-primary); }\,
    \\,
    \/* Delete Modal */\,
    \.delete-modal { text-align: center; }\,
    \.delete-icon { width: 72px; height: 72px; border-radius: 50%; background: rgba(239, 68, 68, 0.1); display: flex; align-items: center; justify-content: center; margin: 0 auto 24px; border: 1px solid rgba(239, 68, 68, 0.3); }\,
    \.delete-icon mat-icon { color: #EF4444; font-size: 32px; width: 32px; height: 32px; }\,
    \.delete-confirm-btn { flex: 2; height: 46px; border: none; border-radius: var(--r-md); background: #EF4444; color: white; font-size: 14px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; font-family: 'Inter', sans-serif; transition: all 0.2s; box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3); }\,
    \.delete-confirm-btn:hover:not(:disabled) { background: #DC2626; transform: translateY(-1px); }\,
    \.delete-confirm-btn:disabled { opacity: 0.5; cursor: not-allowed; }\
  ]\;

content = content.replace(/template: \\\[\\s\\S]*?\\\,\\s*styles: \\[[\\s\\S]*?\\]/, \	emplate: \\\\\\\,\\n  styles: \\);

fs.writeFileSync(path, content, 'utf8');
