import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { AuthService } from '../../../core/services/auth';
import { ApiService } from '../../../core/services/api';

@Component({
  selector: 'app-kyc-list',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterLink,
    MatCardModule, MatButtonModule,
    MatIconModule, MatInputModule, MatSnackBarModule
  ],
  template: `
    <div class="page-container fade-in">
      <div class="navbar">
        <div class="nav-content">
          <span class="brand"><mat-icon style="margin-right:8px; vertical-align:middle;">admin_panel_settings</mat-icon>Admin Panel</span>
          <div class="nav-links">
            <a style="cursor:pointer;" routerLink="/admin/tickets">Tickets</a>
            <a style="cursor:pointer;" routerLink="/admin/users">Users</a>
            <a style="cursor:pointer;" (click)="logout()"><mat-icon>logout</mat-icon> Logout</a>
          </div>
        </div>
      </div>

      <div class="content">
        <div class="page-header">
          <h2 class="page-title" style="margin:0;">Pending KYC Reviews</h2>
        </div>

        <div class="wa-card empty-state" *ngIf="reviews.length === 0" style="text-align:center; padding: 48px;">
          <mat-icon style="font-size: 48px; width:48px; height:48px; opacity: 0.5; margin-bottom:16px;">verified_user</mat-icon>
          <p class="empty" style="color:var(--text-muted); margin:0;">No pending KYC reviews.</p>
        </div>

        <div class="kyc-card wa-card" *ngFor="let kyc of reviews">
          <div class="kyc-header">
            <div>
              <h3 class="user-name">{{ kyc.userFullName }}</h3>
              <p class="email">{{ kyc.userEmail }}</p>
            </div>
            <span class="status-badge pending">{{ kyc.status }}</span>
          </div>

          <div class="kyc-details">
            <div class="detail"><span class="label">Document Type</span><span class="val">{{ kyc.documentType }}</span></div>
            <div class="detail"><span class="label">Document Number</span><span class="val">{{ kyc.documentNumber }}</span></div>
            <div class="detail"><span class="label">Submitted</span><span class="val">{{ kyc.submittedAt | date:'medium' }}</span></div>
          </div>

          <div class="wa-field">
            <div class="wa-label">Admin Note (optional)</div>
            <div class="wa-input-wrap">
              <mat-icon>edit_note</mat-icon>
              <input type="text" [(ngModel)]="kyc.adminNoteInput" placeholder="Add a note for approval or rejection..."/>
            </div>
          </div>

          <div class="actions">
            <button class="action-btn approve" (click)="decide(kyc, 'Approved')" [disabled]="kyc.loading">
              <mat-icon>check_circle</mat-icon> {{ kyc.loading ? 'Updating...' : 'Approve KYC' }}
            </button>
            <button class="action-btn reject" (click)="decide(kyc, 'Rejected')" [disabled]="kyc.loading">
              <mat-icon>cancel</mat-icon> Reject KYC
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .page-container { min-height: 100vh; background: var(--bg); color: var(--text-primary); }

    .navbar { background: var(--bg-card); border-bottom: 1px solid var(--border); position: sticky; top: 0; z-index: 100; }
    .nav-content { display: flex; align-items: center; justify-content: space-between; max-width: 800px; margin: 0 auto; padding: 16px 24px; }
    .brand { font-size: 18px; font-weight: 800; color: var(--text-primary); font-family: 'Outfit', sans-serif; display:flex; align-items:center; }
    .nav-links { display: flex; gap: 24px; align-items: center; }
    .nav-links a { display:flex; align-items:center; gap:6px; color: var(--text-secondary); text-decoration: none; font-weight: 600; font-size: 14px; transition: color 0.2s; }
    .nav-links a:hover { color: var(--teal); }
    .nav-links mat-icon { font-size: 18px; width: 18px; height: 18px; }

    .content { padding: 32px 20px; max-width: 700px; margin: 0 auto; }
    .page-header { margin-bottom: 24px; }
    .page-title { font-size: 28px; font-weight: 800; font-family: 'Outfit', sans-serif; letter-spacing: -1px; }

    .kyc-card { padding: 24px; margin-bottom: 20px; }
    .kyc-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; }
    .user-name { margin: 0; font-weight: 700; font-size: 18px; color: var(--text-primary); font-family: 'Outfit', sans-serif; }
    .email { margin: 4px 0 0; color: var(--text-secondary); font-size: 14px; }
    
    .status-badge { padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 700; white-space: nowrap; border: 1px solid transparent; }
    .status-badge.pending { background: rgba(245,158,11,0.1); color: #F59E0B; border-color: rgba(245,158,11,0.2); }

    .kyc-details { background: rgba(192, 133, 82, 0.03); border-radius: 12px; padding: 16px; border: 1px dashed rgba(192, 133, 82, 0.2); margin-bottom: 24px; }
    .detail { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px dashed var(--border); font-size: 14px; }
    .detail:last-child { border-bottom: none; padding-bottom: 0; }
    .detail:first-child { padding-top: 0; }
    .label { color: var(--text-secondary); }
    .val { color: var(--text-primary); font-weight: 600; }

    .wa-field { margin-bottom: 20px; }
    
    .actions { display: flex; gap: 12px; }
    .action-btn { flex: 1; height: 46px; border: none; border-radius: var(--r-md); font-size: 14px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; font-family: 'Inter', sans-serif; transition: all 0.2s ease; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
    .action-btn mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .action-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none !important; }
    
    .action-btn.approve { background: #10B981; color: white; box-shadow: 0 4px 12px rgba(16,185,129,0.2); }
    .action-btn.approve:hover:not(:disabled) { background: #059669; transform: translateY(-1px); }
    
    .action-btn.reject { background: #EF4444; color: white; box-shadow: 0 4px 12px rgba(239,68,68,0.2); }
    .action-btn.reject:hover:not(:disabled) { background: #DC2626; transform: translateY(-1px); }
  `]
})
export class KycListComponent implements OnInit {
  reviews: any[] = [];

  constructor(private api: ApiService, private auth: AuthService,
    private snackBar: MatSnackBar) { }

  ngOnInit(): void {
    this.loadReviews();
  }

  loadReviews(): void {
    this.api.get<any>('/api/admin/kyc/pending').subscribe({
      next: (res) => {
        if (res.success) {
          this.reviews = res.data.map((k: any) => ({
            ...k, adminNoteInput: '', loading: false
          }));
        }
      },
      error: () => this.snackBar.open('Failed to load KYC list', 'Close', { duration: 3000 })
    });
  }

  decide(kyc: any, decision: string): void {
    kyc.loading = true;
    this.api.post<any>(`/api/admin/kyc/${kyc.id}/decide`, {
      decision: decision,
      adminNote: kyc.adminNoteInput
    }).subscribe({
      next: (res) => {
        if (res.success) {
          this.snackBar.open(`KYC ${decision}`, 'Close', { duration: 3000 });
          this.reviews = this.reviews.filter(r => r.id !== kyc.id);
        } else {
          this.snackBar.open(res.message, 'Close', { duration: 3000 });
        }
        kyc.loading = false;
      },
      error: () => {
        this.snackBar.open('Action failed', 'Close', { duration: 3000 });
        kyc.loading = false;
      }
    });
  }

  logout(): void {
    this.auth.logout();
  }
}
