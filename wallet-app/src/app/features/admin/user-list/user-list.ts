import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ApiService } from '../../../core/services/api';
import { AuthService } from '../../../core/services/auth';

@Component({
  selector: 'app-user-list',
  standalone: true,
  imports: [
    CommonModule, RouterLink,
    MatCardModule, MatButtonModule,
    MatIconModule, MatSnackBarModule
  ],
  template: `
    <div class="spinner-overlay" *ngIf="loading">
      <div class="spinner"></div>
    </div>

    <div class="page-container">
      <div class="navbar">
        <span class="brand">🔐 Admin Panel</span>
        <button mat-button routerLink="/admin/kyc">KYC</button>
        <button mat-button routerLink="/admin/tickets">Tickets</button>
        <button mat-button (click)="logout()">Logout</button>
      </div>

      <div class="content" style="max-width:900px">
        <div class="page-header">
          <h2>Registered Users</h2>
          <span class="user-count">{{ users.length }} users</span>
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
          <div class="summary-item rejected">
            <mat-icon>cancel</mat-icon>
            <div>
              <p class="s-num">{{ rejectedCount }}</p>
              <p class="s-label">Rejected</p>
            </div>
          </div>
        </div>

        <!-- User Cards -->
        <mat-card *ngIf="users.length === 0 && !loading">
          <mat-card-content>
            <p class="empty">No users registered yet.</p>
          </mat-card-content>
        </mat-card>

        <mat-card class="user-card" *ngFor="let user of users">
          <mat-card-content>
            <div class="user-header">
              <div class="user-avatar">{{ getInitials(user.fullName) }}</div>
              <div class="user-info">
                <p class="user-name">{{ user.fullName }}</p>
                <p class="user-email">{{ user.email }}</p>
                <p class="user-phone">📱 {{ user.phoneNumber }}</p>
              </div>
              <span class="status-badge" [class]="user.status.toLowerCase()">
                {{ user.status }}
              </span>
            </div>

            <div class="kyc-section" *ngIf="user.kyc">
              <div class="kyc-row">
                <span class="kyc-label">Document Type</span>
                <span>{{ user.kyc.documentType }}</span>
              </div>
              <div class="kyc-row">
                <span class="kyc-label">Document Number</span>
                <span>{{ user.kyc.documentNumber }}</span>
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
          </mat-card-content>
        </mat-card>
      </div>
    </div>
  `,
  styles: [`
    .page-container { min-height: 100vh; background: #f0f2f5; }
    .navbar {
      display: flex;
      align-items: center;
      padding: 8px 24px;
      background: linear-gradient(135deg, #c62828, #e53935);
      color: white;
      box-shadow: 0 4px 20px rgba(198,40,40,0.3);
    }
    .brand { font-size: 18px; font-weight: 800; flex: 1; }
    .content { padding: 24px; max-width: 900px; margin: 0 auto; }

    .page-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 20px;
    }
    .page-header h2 { margin: 0; font-size: 22px; font-weight: 700; }
    .user-count {
      background: #e8eaf6;
      color: #3f51b5;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 13px;
      font-weight: 600;
    }

    .summary-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      margin-bottom: 20px;
    }

    .summary-item {
      background: white;
      border-radius: 16px;
      padding: 16px;
      display: flex;
      align-items: center;
      gap: 12px;
      box-shadow: 0 2px 12px rgba(0,0,0,0.06);
    }

    .summary-item mat-icon { font-size: 28px; width: 28px; height: 28px; }
    .summary-item.active mat-icon  { color: #00c853; }
    .summary-item.pending mat-icon { color: #ff6f00; }
    .summary-item.rejected mat-icon { color: #e53935; }

    .s-num { margin: 0; font-size: 24px; font-weight: 800; color: #1a1a2e; }
    .s-label { margin: 0; font-size: 12px; color: #888; }

    .user-card { margin-bottom: 12px; }

    .user-header {
      display: flex;
      align-items: flex-start;
      gap: 14px;
      margin-bottom: 12px;
    }

    .user-avatar {
      width: 48px; height: 48px;
      border-radius: 14px;
      background: linear-gradient(135deg, #3f51b5, #7c4dff);
      color: white;
      font-size: 18px;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .user-info { flex: 1; }
    .user-name  { margin: 0; font-weight: 700; font-size: 15px; }
    .user-email { margin: 2px 0; color: #666; font-size: 13px; }
    .user-phone { margin: 0; color: #888; font-size: 12px; }

    .status-badge {
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      white-space: nowrap;
    }
    .status-badge.active   { background: #e8f5e9; color: #2e7d32; }
    .status-badge.pending  { background: #fff3e0; color: #e65100; }
    .status-badge.rejected { background: #ffebee; color: #c62828; }
    .status-badge.approved { background: #e8f5e9; color: #2e7d32; }

    .kyc-section {
      background: #f8f9ff;
      border-radius: 12px;
      padding: 12px;
      border: 1px solid #e8eaf6;
    }

    .kyc-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 6px 0;
      border-bottom: 1px solid #eee;
      font-size: 13px;
    }
    .kyc-row:last-child { border-bottom: none; }
    .kyc-label { color: #666; }

    .no-kyc {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #999;
      font-size: 13px;
      padding: 8px 0;
    }
    .no-kyc mat-icon { font-size: 16px; width: 16px; height: 16px; }

    .empty { text-align: center; color: #999; padding: 32px; }
  `]
})
export class UserListComponent implements OnInit {
  users: any[] = [];
  loading = true;
  activeCount = 0;
  pendingCount = 0;
  rejectedCount = 0;

  constructor(private api: ApiService, private auth: AuthService,
    private snackBar: MatSnackBar) { }

  ngOnInit(): void {
    this.api.get<any>('/api/auth/internal/users').subscribe({
      next: (res) => {
        if (res.success) {
          this.users = res.data;
          this.activeCount = res.data.filter((u: any) => u.status === 'Active').length;
          this.pendingCount = res.data.filter((u: any) => u.status === 'Pending').length;
          this.rejectedCount = res.data.filter((u: any) => u.status === 'Rejected').length;
        }
        this.loading = false;
      },
      error: () => {
        this.snackBar.open('Failed to load users', 'Close', { duration: 3000 });
        this.loading = false;
      }
    });
  }

  getInitials(name: string): string {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) ?? '?';
  }

  logout(): void {
    this.auth.logout();
  }
}
