import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ApiService } from '../../../core/services/api';
import { AuthService } from '../../../core/services/auth';

@Component({
  selector: 'app-user-list',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterLink,
    MatCardModule, MatButtonModule,
    MatIconModule, MatInputModule, MatSnackBarModule
  ],
  template: `
    <div class="spinner-overlay" *ngIf="loading">
      <div class="spinner"></div>
    </div>

    <!-- Edit Wallet Modal -->
    <div class="modal-overlay" *ngIf="editingUser">
      <div class="modal">
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
            <label>Full Name</label>
            <div class="modal-input-wrap">
              <mat-icon>person</mat-icon>
              <input type="text" [(ngModel)]="editFullName" placeholder="Full name"/>
            </div>
          </div>

          <div class="modal-field">
            <label>Email</label>
            <div class="modal-input-wrap">
              <mat-icon>email</mat-icon>
              <input type="email" [(ngModel)]="editEmail" placeholder="Email address"/>
            </div>
          </div>

          <div class="modal-field">
            <label>Phone Number</label>
            <div class="modal-input-wrap">
              <mat-icon>phone</mat-icon>
              <input type="text" [(ngModel)]="editPhoneNumber" placeholder="10-digit mobile number"/>
            </div>
          </div>

          <div class="modal-field">
            <label>New Balance (Rs.)</label>
            <div class="modal-input-wrap">
              <mat-icon>currency_rupee</mat-icon>
              <input type="number" [(ngModel)]="newBalance" placeholder="0"/>
            </div>
          </div>

          <div class="modal-field">
            <label>Reason</label>
            <div class="modal-input-wrap">
              <mat-icon>edit_note</mat-icon>
              <input type="text" [(ngModel)]="adjustReason"
                     placeholder="Reason for adjustment"/>
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
          <button class="save-btn" (click)="saveWalletChanges()" [disabled]="saving">
            <mat-icon>save</mat-icon>
            {{ saving ? 'Saving...' : 'Save Changes' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Delete Confirm Modal -->
    <div class="modal-overlay" *ngIf="deletingUser">
      <div class="modal delete-modal">
        <div class="delete-icon">
          <mat-icon>warning</mat-icon>
        </div>
        <h3>Delete User?</h3>
        <p>Are you sure you want to permanently delete
          <strong>{{ deletingUser.fullName }}</strong>?
          This action cannot be undone.
        </p>
        <div class="modal-actions">
          <button class="cancel-btn" (click)="deletingUser = null">Cancel</button>
          <button class="delete-confirm-btn" (click)="confirmDelete()" [disabled]="deleting">
            <mat-icon>delete_forever</mat-icon>
            {{ deleting ? 'Deleting...' : 'Delete Permanently' }}
          </button>
        </div>
      </div>
    </div>

    <div class="page-container">
      <div class="navbar">
        <span class="brand">Admin Panel</span>
        <button mat-button routerLink="/admin/kyc" style="color:white">KYC</button>
        <button mat-button routerLink="/admin/tickets" style="color:white">Tickets</button>
        <button mat-button (click)="logout()" style="color:white">Logout</button>
      </div>

      <div class="content">
        <div class="page-header">
          <h2>Registered Users</h2>
          <span class="user-count">{{ filteredUsers.length }} users</span>
        </div>

        <!-- Summary Cards -->
        <div class="summary-grid">
          <div class="summary-item active">
            <mat-icon>check_circle</mat-icon>
            <div>
              <p class="s-num">{{ activeCount }}</p>
              <p class="s-label">Active</p>
            </div>
          </div>
          <div class="summary-item pending">
            <mat-icon>hourglass_empty</mat-icon>
            <div>
              <p class="s-num">{{ pendingCount }}</p>
              <p class="s-label">Pending</p>
            </div>
          </div>
          <div class="summary-item total">
            <mat-icon>group</mat-icon>
            <div>
              <p class="s-num">{{ users.length }}</p>
              <p class="s-label">Total</p>
            </div>
          </div>
        </div>

        <!-- Search -->
        <div class="search-wrap">
          <mat-icon>search</mat-icon>
          <input type="text" [(ngModel)]="searchQuery"
                 (input)="filterUsers()"
                 placeholder="Search by name or email..."/>
          <button *ngIf="searchQuery" (click)="searchQuery=''; filterUsers()">
            <mat-icon>close</mat-icon>
          </button>
        </div>

        <!-- Empty -->
        <mat-card *ngIf="filteredUsers.length === 0 && !loading">
          <mat-card-content>
            <p class="empty">No users found.</p>
          </mat-card-content>
        </mat-card>

        <!-- User Cards -->
        <div class="user-card" *ngFor="let user of filteredUsers">
          <div class="user-header">
            <div class="user-avatar">{{ getInitials(user.fullName) }}</div>
            <div class="user-info">
              <p class="user-name">{{ user.fullName }}</p>
              <p class="user-email">{{ user.email }}</p>
              <p class="user-phone">Phone: {{ user.phoneNumber }}</p>
            </div>
            <div class="user-badges">
              <span class="status-badge" [class]="user.status.toLowerCase()">
                {{ user.status }}
              </span>
            </div>
          </div>

          <!-- KYC Info -->
          <div class="kyc-section" *ngIf="user.kyc">
            <div class="kyc-row">
              <span class="kyc-label">Document</span>
              <span>{{ user.kyc.documentType }} - {{ user.kyc.documentNumber }}</span>
            </div>
            <div class="kyc-row">
              <span class="kyc-label">KYC Status</span>
              <span class="status-badge" [class]="user.kyc.status.toLowerCase()">
                {{ user.kyc.status }}
              </span>
            </div>
          </div>

          <div class="no-kyc" *ngIf="!user.kyc">
            <mat-icon>info</mat-icon>
            <span>KYC not submitted yet</span>
          </div>

          <!-- Wallet Info -->
          <div class="wallet-section" *ngIf="user.wallet">
            <div class="wallet-balance">
              <mat-icon>account_balance_wallet</mat-icon>
              <span class="balance-val">Rs. {{ user.wallet.balance | number:'1.2-2' }}</span>
              <span class="wallet-status-badge" [class]="user.wallet.isLocked ? 'locked' : 'active'">
                {{ user.wallet.isLocked ? 'Locked' : 'Active' }}
              </span>
            </div>
          </div>

          <div class="no-wallet" *ngIf="!user.wallet">
            <mat-icon>account_balance_wallet</mat-icon>
            <span>No wallet created yet</span>
          </div>

          <!-- Action Buttons -->
          <div class="action-row">
            <button class="action-btn edit" (click)="startEdit(user)">
              <mat-icon>edit</mat-icon>
              Edit User & Wallet
            </button>
            <button class="action-btn delete" (click)="startDelete(user)">
              <mat-icon>delete</mat-icon>
              Delete User
            </button>
          </div>
        </div>

      </div>
    </div>
  `,
  styles: [`
    .page-container { min-height: 100vh; background: #f0f2f5; }

    .navbar {
      display: flex; align-items: center; padding: 8px 24px;
      background: linear-gradient(135deg, #c62828, #e53935);
      color: white; box-shadow: 0 4px 20px rgba(198,40,40,0.3);
      position: sticky; top: 0; z-index: 100;
    }
    .brand { font-size: 18px; font-weight: 800; flex: 1; }
    .content { padding: 20px; max-width: 900px; margin: 0 auto; }

    .page-header {
      display: flex; align-items: center; justify-content: space-between;
      margin-bottom: 20px;
    }
    .page-header h2 { margin: 0; font-size: 22px; font-weight: 700; }
    .user-count {
      background: #e8eaf6; color: #3f51b5;
      padding: 4px 12px; border-radius: 20px; font-size: 13px; font-weight: 600;
    }

    .summary-grid {
      display: grid; grid-template-columns: repeat(3, 1fr);
      gap: 12px; margin-bottom: 16px;
    }
    .summary-item {
      background: white; border-radius: 16px; padding: 16px;
      display: flex; align-items: center; gap: 12px;
      box-shadow: 0 2px 12px rgba(0,0,0,0.06);
    }
    .summary-item mat-icon { font-size: 28px; width: 28px; height: 28px; }
    .summary-item.active mat-icon  { color: #00c853; }
    .summary-item.pending mat-icon { color: #ff6f00; }
    .summary-item.total  mat-icon  { color: #3f51b5; }
    .s-num   { margin: 0; font-size: 24px; font-weight: 800; color: #1a1a2e; }
    .s-label { margin: 0; font-size: 12px; color: #888; }

    /* Search */
    .search-wrap {
      display: flex; align-items: center; gap: 12px;
      background: white; border-radius: 14px; padding: 12px 16px;
      margin-bottom: 16px; box-shadow: 0 2px 12px rgba(0,0,0,0.06);
    }
    .search-wrap mat-icon { color: #aaa; }
    .search-wrap input {
      flex: 1; border: none; outline: none; font-size: 14px;
      color: #1a1a2e; font-family: 'Inter', sans-serif;
    }
    .search-wrap button {
      border: none; background: transparent; cursor: pointer; color: #aaa;
    }

    /* User Card */
    .user-card {
      background: white; border-radius: 20px; padding: 20px;
      margin-bottom: 12px; box-shadow: 0 2px 16px rgba(0,0,0,0.06);
      border: 1px solid rgba(0,0,0,0.04);
    }

    .user-header {
      display: flex; align-items: flex-start; gap: 14px; margin-bottom: 16px;
    }
    .user-avatar {
      width: 48px; height: 48px; border-radius: 14px;
      background: linear-gradient(135deg, #3f51b5, #7c4dff);
      color: white; font-size: 18px; font-weight: 700;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .user-info { flex: 1; }
    .user-name  { margin: 0; font-weight: 700; font-size: 15px; color: #1a1a2e; }
    .user-email { margin: 2px 0; color: #666; font-size: 13px; }
    .user-phone { margin: 0; color: #888; font-size: 12px; }

    .status-badge {
      padding: 4px 12px; border-radius: 20px;
      font-size: 12px; font-weight: 600; white-space: nowrap;
    }
    .status-badge.active   { background: #e8f5e9; color: #2e7d32; }
    .status-badge.pending  { background: #fff3e0; color: #e65100; }
    .status-badge.rejected { background: #ffebee; color: #c62828; }
    .status-badge.approved { background: #e8f5e9; color: #2e7d32; }

    .kyc-section {
      background: #f8f9ff; border-radius: 12px; padding: 12px;
      border: 1px solid #e8eaf6; margin-bottom: 12px;
    }
    .kyc-row {
      display: flex; justify-content: space-between; align-items: center;
      padding: 6px 0; border-bottom: 1px solid #eee; font-size: 13px;
    }
    .kyc-row:last-child { border-bottom: none; }
    .kyc-label { color: #666; }

    .no-kyc, .no-wallet {
      display: flex; align-items: center; gap: 8px;
      color: #999; font-size: 13px; padding: 8px 0; margin-bottom: 12px;
    }
    .no-kyc mat-icon, .no-wallet mat-icon { font-size: 16px; width: 16px; height: 16px; }

    /* Wallet Section */
    .wallet-section {
      background: linear-gradient(135deg, #f0f4ff, #e8eaf6);
      border-radius: 12px; padding: 12px 16px;
      border: 1px solid #c5cae9; margin-bottom: 12px;
    }
    .wallet-balance {
      display: flex; align-items: center; gap: 10px;
    }
    .wallet-balance mat-icon { color: #3f51b5; }
    .balance-val { font-size: 18px; font-weight: 800; color: #1a1a2e; flex: 1; }
    .wallet-status-badge {
      font-size: 12px; font-weight: 600; padding: 4px 10px; border-radius: 20px;
    }
    .wallet-status-badge.active { background: #e8f5e9; color: #2e7d32; }
    .wallet-status-badge.locked { background: #ffebee; color: #c62828; }

    /* Action Row */
    .action-row { display: flex; gap: 8px; }

    .action-btn {
      flex: 1; height: 40px; border: none; border-radius: 10px;
      font-size: 13px; font-weight: 700; cursor: pointer;
      display: flex; align-items: center; justify-content: center; gap: 6px;
      font-family: 'Inter', sans-serif; transition: all 0.2s ease;
    }
    .action-btn mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .action-btn.edit {
      background: #e8eaf6; color: #3f51b5;
    }
    .action-btn.edit:hover { background: #c5cae9; }
    .action-btn.delete {
      background: #ffebee; color: #c62828;
    }
    .action-btn.delete:hover { background: #ffcdd2; }

    /* Modals */
    .modal-overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,0.6);
      backdrop-filter: blur(6px); z-index: 1000;
      display: flex; align-items: center; justify-content: center;
      animation: fadeIn 0.2s ease;
    }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

    .modal {
      background: white; border-radius: 24px; padding: 28px;
      width: 380px; box-shadow: 0 24px 64px rgba(0,0,0,0.3);
      animation: slideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    @keyframes slideUp {
      from { opacity: 0; transform: translateY(40px) scale(0.95); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }

    .modal-header {
      display: flex; align-items: center; gap: 12px; margin-bottom: 24px;
    }
    .modal-avatar {
      width: 44px; height: 44px; border-radius: 12px;
      background: linear-gradient(135deg, #3f51b5, #7c4dff);
      color: white; font-size: 16px; font-weight: 700;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .modal-header h3 { margin: 0; font-size: 18px; font-weight: 700; color: #1a1a2e; flex: 1; }
    .modal-sub { margin: 2px 0 0; font-size: 13px; color: #666; }
    .modal-close {
      border: none; background: #f5f5f5; border-radius: 8px;
      cursor: pointer; display: flex; align-items: center; justify-content: center;
      width: 32px; height: 32px;
    }
    .modal-close mat-icon { color: #666; font-size: 18px; width: 18px; height: 18px; }

    .modal-body { margin-bottom: 20px; }
    .modal-field { margin-bottom: 16px; }
    .modal-field label {
      display: block; font-size: 13px; font-weight: 600;
      color: #444; margin-bottom: 8px;
    }
    .modal-input-wrap {
      display: flex; align-items: center; gap: 10px;
      border: 2px solid #e8e8f0; border-radius: 12px;
      padding: 12px 14px; background: #fafafa;
    }
    .modal-input-wrap mat-icon { color: #aaa; font-size: 18px; width: 18px; height: 18px; }
    .modal-input-wrap input {
      flex: 1; border: none; outline: none; font-size: 14px;
      color: #1a1a2e; background: transparent; font-family: 'Inter', sans-serif;
    }

    .lock-toggle {
      display: flex; align-items: center; justify-content: space-between;
      background: #f5f5f8; border-radius: 12px; padding: 12px 16px;
    }
    .lock-info { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 600; }
    .lock-info mat-icon { font-size: 20px; width: 20px; height: 20px; }
    .lock-info mat-icon.locked   { color: #f44336; }
    .lock-info mat-icon.unlocked { color: #00c853; }
    .toggle-btn {
      padding: 6px 16px; border: none; border-radius: 8px;
      font-size: 12px; font-weight: 700; cursor: pointer;
      font-family: 'Inter', sans-serif; transition: all 0.2s;
    }
    .toggle-btn.lock   { background: #ffebee; color: #c62828; }
    .toggle-btn.unlock { background: #e8f5e9; color: #2e7d32; }

    .modal-actions { display: flex; gap: 8px; }
    .cancel-btn {
      flex: 1; height: 44px; border: 2px solid #e8e8f0; border-radius: 12px;
      background: transparent; color: #666; font-size: 14px; font-weight: 600;
      cursor: pointer; font-family: 'Inter', sans-serif;
    }
    .save-btn {
      flex: 2; height: 44px; border: none; border-radius: 12px;
      background: linear-gradient(135deg, #3f51b5, #7c4dff);
      color: white; font-size: 14px; font-weight: 700; cursor: pointer;
      display: flex; align-items: center; justify-content: center; gap: 6px;
      font-family: 'Inter', sans-serif; transition: all 0.2s;
    }
    .save-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .save-btn mat-icon { font-size: 18px; width: 18px; height: 18px; }

    /* Delete Modal */
    .delete-modal { text-align: center; }
    .delete-icon {
      width: 72px; height: 72px; border-radius: 50%;
      background: linear-gradient(135deg, #c62828, #e53935);
      display: flex; align-items: center; justify-content: center;
      margin: 0 auto 16px; box-shadow: 0 8px 24px rgba(198,40,40,0.3);
    }
    .delete-icon mat-icon { color: white; font-size: 36px; width: 36px; height: 36px; }
    .delete-modal h3 { margin: 0 0 12px; font-size: 20px; font-weight: 800; color: #1a1a2e; }
    .delete-modal p  { color: #666; font-size: 14px; line-height: 1.6; margin-bottom: 24px; }
    .delete-modal p strong { color: #c62828; }
    .delete-confirm-btn {
      flex: 2; height: 44px; border: none; border-radius: 12px;
      background: linear-gradient(135deg, #c62828, #e53935);
      color: white; font-size: 14px; font-weight: 700; cursor: pointer;
      display: flex; align-items: center; justify-content: center; gap: 6px;
      font-family: 'Inter', sans-serif; transition: all 0.2s;
    }
    .delete-confirm-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .delete-confirm-btn mat-icon { font-size: 18px; width: 18px; height: 18px; }

    .empty { text-align: center; color: #999; padding: 32px; }
  `]
})
export class UserListComponent implements OnInit {
  users: any[] = [];
  filteredUsers: any[] = [];
  loading = true;
  searchQuery = '';
  activeCount = 0;
  pendingCount = 0;

  // Edit wallet
  editingUser: any = null;
  editFullName = '';
  editEmail = '';
  editPhoneNumber = '';
  newBalance = 0;
  adjustReason = '';
  editingLocked = false;
  saving = false;

  // Delete user
  deletingUser: any = null;
  deleting = false;

  constructor(
    private api: ApiService,
    private auth: AuthService,
    private snackBar: MatSnackBar
  ) { }

  loadUsers(): void {
    this.loading = true;
    this.api.get<any>('/api/auth/internal/users').subscribe({
      next: async (res) => {
        if (res.success) {
          this.users = res.data;
          // Load wallet info for each user
          await this.loadWallets();
          this.activeCount = this.users.filter((u: any) => u.status === 'Active').length;
          this.pendingCount = this.users.filter((u: any) => u.status === 'Pending').length;
          this.filteredUsers = [...this.users];
        }
        this.loading = false;
      },
      error: () => {
        this.snackBar.open('Failed to load users', 'Close', { duration: 3000 });
        this.loading = false;
      }
    });
  }

  async loadWallets(): Promise<void> {
    for (const user of this.users) {
      try {
        const res: any = await new Promise((resolve, reject) => {
          this.api.get<any>(`/api/wallet/by-email?email=${encodeURIComponent(user.email)}`)
            .subscribe({
              next: resolve,
              error: reject
            });
        });
        if (res?.success) {
          user.wallet = res.data;
        } else {
          user.wallet = null;
        }
      } catch {
        user.wallet = null;
      }
    }
  }

  filterUsers(): void {
    const q = this.searchQuery.toLowerCase();
    this.filteredUsers = this.users.filter(u =>
      u.fullName.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q)
    );
  }

  getInitials(name: string): string {
    return name?.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) ?? '?';
  }

  // Edit Wallet
  startEdit(user: any): void {
    this.editingUser = user;
    this.editFullName = user.fullName ?? '';
    this.editEmail = user.email ?? '';
    this.editPhoneNumber = user.phoneNumber ?? '';
    this.newBalance = user.wallet?.balance ?? 0;
    this.adjustReason = '';
    this.editingLocked = user.wallet?.isLocked ?? false;
  }

  cancelEdit(): void {
    this.editingUser = null;
  }

  private validateEditForm(): string | null {
    const fullName = this.editFullName.trim();
    const email = this.editEmail.trim().toLowerCase();
    const phone = this.editPhoneNumber.trim();

    if (!fullName || !email || !phone) {
      return 'Please fill in all user details';
    }

    if (fullName.length < 3) {
      return 'Full name must be at least 3 characters';
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return 'Enter a valid email address';
    }

    if (!/^[6-9]\d{9}$/.test(phone)) {
      return 'Enter a valid 10-digit mobile number';
    }

    if (this.newBalance < 0) {
      return 'Balance cannot be negative';
    }

    return null;
  }

  saveWalletChanges(): void {
    if (!this.editingUser) return;

    const validationError = this.validateEditForm();
    if (validationError) {
      this.snackBar.open(validationError, 'Close', { duration: 3000 });
      return;
    }

    this.saving = true;

    this.api.put<any>(`/api/auth/internal/user/${this.editingUser.userId}`, {
      fullName: this.editFullName.trim(),
      email: this.editEmail.trim().toLowerCase(),
      phoneNumber: this.editPhoneNumber.trim()
    }).subscribe({
      next: (userRes) => {
        if (userRes.success) {
          this.api.put<any>('/api/wallet/admin/adjust', {
            userId: this.editingUser.userId,
            newBalance: this.newBalance,
            reason: this.adjustReason || 'Admin adjustment'
          }).subscribe({
            next: (walletRes) => {
              if (walletRes.success) {
                this.api.put<any>('/api/wallet/admin/lock', {
                  userId: this.editingUser.userId,
                  isLocked: this.editingLocked
                }).subscribe({
                  next: () => {
                    this.editingUser.fullName = this.editFullName.trim();
                    this.editingUser.email = this.editEmail.trim().toLowerCase();
                    this.editingUser.phoneNumber = this.editPhoneNumber.trim();
                    this.editingUser.wallet = this.editingUser.wallet ?? {};
                    this.editingUser.wallet.balance = this.newBalance;
                    this.editingUser.wallet.isLocked = this.editingLocked;
                    this.filterUsers();
                    this.snackBar.open('User and wallet updated successfully!', 'Close', { duration: 3000 });
                    this.saving = false;
                    this.editingUser = null;
                  },
                  error: () => {
                    this.snackBar.open('User and balance updated, but wallet lock update failed.', 'Close', { duration: 3500 });
                    this.saving = false;
                    this.editingUser = null;
                  }
                });
              } else {
                this.snackBar.open(walletRes.message, 'Close', { duration: 3000 });
                this.saving = false;
              }
            },
            error: (err) => {
              const msg = err?.error?.message ?? 'Failed to update wallet.';
              this.snackBar.open(msg, 'Close', { duration: 3000 });
              this.saving = false;
            }
          });
        } else {
          this.snackBar.open(userRes.message, 'Close', { duration: 3000 });
          this.saving = false;
        }
      },
      error: (err) => {
        const msg = err?.error?.message ?? 'Failed to update user.';
        this.snackBar.open(msg, 'Close', { duration: 3000 });
        this.saving = false;
      }
    });
  }

  // Delete User
  startDelete(user: any): void {
    this.deletingUser = user;
  }

  confirmDelete(): void {
    if (!this.deletingUser) return;
    this.deleting = true;

    this.api.delete<any>(`/api/auth/internal/user/${this.deletingUser.userId}`)
      .subscribe({
        next: (res) => {
          if (res.success) {
            this.snackBar.open(
              `${this.deletingUser.fullName} deleted successfully.`,
              'Close', { duration: 3000 });
            this.users = this.users.filter(u => u.userId !== this.deletingUser.userId);
            this.filteredUsers = this.filteredUsers.filter(u => u.userId !== this.deletingUser.userId);
            this.activeCount = this.users.filter(u => u.status === 'Active').length;
            this.pendingCount = this.users.filter(u => u.status === 'Pending').length;
            this.deletingUser = null;
          } else {
            this.snackBar.open(res.message, 'Close', { duration: 3000 });
          }
          this.deleting = false;
        },
        error: (err) => {
          console.error(err);
          this.snackBar.open('Failed to delete user.', 'Close', { duration: 3000 });
          this.deleting = false;
        }
      });
  }
  ngOnInit() {
    this.loadUsers();
  }

  logout(): void {
    this.auth.logout();
  }
}




