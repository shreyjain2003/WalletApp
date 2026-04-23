import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ApiService } from '../../core/services/api';
import { AuthService } from '../../core/services/auth';
import { TokenRefreshService } from '../../core/services/token-refresh';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, MatIconModule, MatSnackBarModule],
  template: `
    <div class="spinner-overlay" *ngIf="loading"><div class="spinner"></div></div>
    
    <div class="page-container fade-in">
      <div class="page-header">
        <h1 class="page-title">My Profile</h1>
        <p class="page-subtitle">Manage your personal details and security settings.</p>
      </div>
      
      <div class="two-col">
        <!-- Left: profile + KYC -->
        <div>
          <div class="wa-card profile-card" style="margin-bottom: 24px;">
            <div class="avatar">{{ getInitials() }}</div>
            <div class="profile-info">
              <h2>{{ profile?.fullName }}</h2>
              <p class="profile-email">{{ profile?.email }}</p>
              <p class="profile-phone"><mat-icon>phone_iphone</mat-icon>{{ profile?.phoneNumber }}</p>
            </div>
            <span class="badge" [class]="'badge-' + statusClass(profile?.status)">{{ profile?.status }}</span>
          </div>

          <div class="wa-card">
            <div class="panel-head">
              <div class="head-icon"><mat-icon>verified_user</mat-icon></div>
              <div><h3>KYC Verification</h3><p class="head-sub">Identity verification status</p></div>
            </div>

            <div *ngIf="profile?.kyc">
              <div class="detail-row"><span class="detail-lbl">Document Type</span><span class="detail-val">{{ profile.kyc.documentType }}</span></div>
              <div class="detail-row"><span class="detail-lbl">Document Number</span><span class="detail-val">{{ profile.kyc.documentNumber }}</span></div>
              <div class="detail-row"><span class="detail-lbl">Status</span><span class="badge" [class]="'badge-' + statusClass(profile.kyc.status)">{{ profile.kyc.status }}</span></div>
              <div class="detail-row" *ngIf="profile.kyc.adminNote"><span class="detail-lbl">Admin Note</span><span class="detail-val">{{ profile.kyc.adminNote }}</span></div>
              <div class="kyc-msg pending" *ngIf="profile.kyc?.status === 'Pending'">
                <mat-icon>hourglass_empty</mat-icon><span>KYC is under review.</span>
                <button class="refresh-btn" (click)="loadProfile()"><mat-icon>refresh</mat-icon>Refresh</button>
              </div>
              <div class="kyc-msg approved" *ngIf="profile.kyc?.status === 'Approved'">
                <mat-icon>check_circle</mat-icon><span>KYC approved. Wallet is active!</span>
              </div>
            </div>

            <div *ngIf="!profile?.kyc || profile?.kyc?.status === 'Rejected'">
              <div class="kyc-msg rejected" *ngIf="profile?.kyc?.status === 'Rejected'"><mat-icon>cancel</mat-icon><span>KYC was rejected. Please resubmit.</span></div>
              <div class="kyc-msg info" *ngIf="!profile?.kyc"><mat-icon>info_outline</mat-icon><span>Submit KYC documents to activate your wallet.</span></div>
              
              <div class="wa-label" style="margin-top: 16px;">Document Type</div>
              <div class="wa-input-wrap" style="margin-bottom: 16px;">
                <mat-icon>badge</mat-icon>
                <select [(ngModel)]="docType">
                  <option value="">Select type</option>
                  <option value="passport">Passport</option>
                  <option value="national_id">National ID</option>
                  <option value="driving_license">Driving License</option>
                </select>
              </div>
              
              <div class="wa-label">Document Number</div>
              <div class="wa-input-wrap" style="margin-bottom: 24px;">
                <mat-icon>numbers</mat-icon>
                <input [(ngModel)]="docNumber" placeholder="Enter document number"/>
              </div>
              
              <button class="wa-btn-primary full-width" (click)="submitKyc()" [disabled]="submitting">
                <mat-icon>upload</mat-icon>{{ submitting ? 'Submitting...' : 'Submit KYC' }}
              </button>
            </div>
          </div>
        </div>

        <!-- Right: PIN -->
        <div>
          <div class="wa-card">
            <div class="panel-head">
              <div class="head-icon" [class.active]="pinSet"><mat-icon>{{ pinSet ? 'lock' : 'lock_open' }}</mat-icon></div>
              <div><h3>Transaction PIN</h3><p class="head-sub">{{ pinSet ? 'PIN protection is active' : 'No PIN set — transfers unprotected' }}</p></div>
            </div>
            <a routerLink="/set-pin" class="wa-btn-primary full-width" style="text-decoration:none">
              <mat-icon>{{ pinSet ? 'edit' : 'add_moderator' }}</mat-icon>
              {{ pinSet ? 'Change PIN' : 'Set PIN Now' }}
            </a>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .page-container { max-width: 1000px; margin: 0 auto; padding-bottom: 32px; }
    .page-header { margin-bottom: 32px; display: flex; flex-direction: column; }
    .page-title { font-size: 32px; font-weight: 800; color: var(--text-primary); font-family: 'Outfit', sans-serif; margin-bottom: 8px; letter-spacing: -1px; }
    .page-subtitle { color: var(--text-secondary); font-size: 15px; margin: 0; }

    .two-col { display: grid; grid-template-columns: 1fr 340px; gap: 24px; }
    
    .profile-card { display: flex; align-items: center; gap: 16px; }
    .avatar { width: 56px; height: 56px; border-radius: 14px; background: var(--teal); color: #FFF; font-size: 20px; font-weight: 800; font-family: 'Outfit', sans-serif; display: flex; align-items: center; justify-content: center; flex-shrink: 0; box-shadow: var(--shadow-teal); }
    .profile-info { flex: 1; }
    .profile-info h2 { margin: 0 0 4px; font-size: 18px; font-weight: 700; color: var(--text-primary); font-family: 'Outfit', sans-serif; }
    .profile-email { margin: 0 0 6px; font-size: 13px; color: var(--text-secondary); }
    .profile-phone { margin: 0; font-size: 13px; color: var(--text-secondary); display: flex; align-items: center; gap: 6px; }
    .profile-phone mat-icon { font-size: 14px; width: 14px; height: 14px; color: var(--text-muted); }
    
    .badge { display: inline-flex; align-items: center; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; white-space: nowrap; }
    .badge-success { background: rgba(45, 138, 86, 0.1); color: var(--success); }
    .badge-warning { background: rgba(229, 139, 36, 0.1); color: var(--warning); }
    .badge-danger  { background: rgba(217, 72, 72, 0.1); color: var(--danger); }
    .badge-neutral { background: var(--space-800); color: var(--text-secondary); border: 1px solid var(--border); }
    
    .panel-head { display: flex; align-items: center; gap: 16px; margin-bottom: 24px; }
    .head-icon { width: 44px; height: 44px; border-radius: 12px; background: var(--space-800); display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: all 0.2s; border: 1px solid var(--border); }
    .head-icon mat-icon { color: var(--text-muted); font-size: 22px; width: 22px; height: 22px; }
    .head-icon.active { background: var(--teal-dim); border-color: rgba(192, 133, 82, 0.3); }
    .head-icon.active mat-icon { color: var(--teal); }
    
    .panel-head h3 { margin: 0; font-size: 16px; font-weight: 700; color: var(--text-primary); }
    .head-sub { margin: 3px 0 0; font-size: 13px; color: var(--text-secondary); }
    
    .detail-row { display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px dashed var(--border); font-size: 13px; }
    .detail-row:last-of-type { border-bottom: none; }
    .detail-lbl { color: var(--text-secondary); }
    .detail-val { font-weight: 600; color: var(--text-primary); }
    
    .kyc-msg { display: flex; align-items: center; gap: 10px; padding: 12px 14px; border-radius: var(--r-md); margin-top: 16px; font-size: 13px; font-weight: 500; }
    .kyc-msg mat-icon { font-size: 18px; width: 18px; height: 18px; flex-shrink: 0; }
    .kyc-msg.pending  { background: rgba(229, 139, 36, 0.08); color: var(--warning); border: 1px solid rgba(229, 139, 36, 0.2); }
    .kyc-msg.approved { background: rgba(45, 138, 86, 0.08); color: var(--success); border: 1px solid rgba(45, 138, 86, 0.2); }
    .kyc-msg.rejected { background: rgba(217, 72, 72, 0.08); color: var(--danger); border: 1px solid rgba(217, 72, 72, 0.2); }
    .kyc-msg.info     { background: var(--teal-dim); color: var(--teal); border: 1px solid rgba(192, 133, 82, 0.2); }
    
    .refresh-btn { margin-left: auto; border: none; background: rgba(229, 139, 36, 0.15); color: var(--warning); border-radius: 6px; padding: 4px 10px; cursor: pointer; display: flex; align-items: center; gap: 4px; font-size: 12px; font-weight: 600; font-family: 'Inter', sans-serif; }
    .refresh-btn mat-icon { font-size: 14px; width: 14px; height: 14px; }
    
    .full-width { width: 100%; display: flex; align-items: center; justify-content: center; opacity: 1; margin: 0; }
    
    @media (max-width: 900px) { .two-col { grid-template-columns: 1fr; } }
  `]
})
export class ProfileComponent implements OnInit {
  profile: any = null; docType = ''; docNumber = '';
  loading = true; submitting = false; pinSet = false; dnf = false;
  constructor(private api: ApiService, private auth: AuthService, private tokenRefresh: TokenRefreshService, private snackBar: MatSnackBar) {}
  ngOnInit(): void {
    this.auth.getPinStatus().subscribe({ next: (res) => { this.pinSet = !!res?.data?.hasPin; }, error: () => { this.pinSet = false; } });
    this.loadProfile();
  }
  loadProfile(): void {
    this.loading = true;
    this.api.get<any>('/api/auth/profile').subscribe({
      next: (res) => { if (res.success) { this.profile = res.data; if (res.data.status === 'Active') localStorage.setItem('userStatus', 'Active'); } this.loading = false; },
      error: () => { this.snackBar.open('Failed to load profile', 'Close', { duration: 3000 }); this.loading = false; }
    });
  }
  getInitials(): string { return this.profile?.fullName?.split(' ').map((n: string) => n[0]).join('').toUpperCase() ?? '?'; }
  submitKyc(): void {
    if (!this.docType || !this.docNumber) { this.snackBar.open('Please fill in all fields', 'Close', { duration: 3000 }); return; }
    this.submitting = true;
    this.api.post<any>('/api/auth/kyc', { documentType: this.docType, documentNumber: this.docNumber }).subscribe({
      next: (res) => { if (res.success) { this.snackBar.open('KYC submitted!', 'Close', { duration: 3000 }); this.loadProfile(); } else { this.snackBar.open(res.message, 'Close', { duration: 3000 }); } this.submitting = false; },
      error: () => { this.snackBar.open('KYC submission failed', 'Close', { duration: 3000 }); this.submitting = false; }
    });
  }
  statusClass(status: string): string {
    if (status === 'Active' || status === 'Approved') return 'success';
    if (status === 'Pending') return 'warning';
    if (status === 'Rejected') return 'danger';
    return 'neutral';
  }
  refreshToken(): void { this.tokenRefresh.refreshNow(); }
}
