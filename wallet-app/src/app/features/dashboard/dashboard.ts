import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ApiService } from '../../core/services/api';
import { AuthService } from '../../core/services/auth';
import { ThemeService } from '../../core/services/theme';

@Component({
  selector: 'app-dashboard',
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

    <div class="dashboard-container">
      <div class="navbar">
        <span class="brand">💳 WalletApp</span>
        <span class="welcome">{{ name }}</span>
        <button mat-icon-button style="color:white"
                (click)="theme.toggleDark()">
          <mat-icon>{{ theme.getDarkMode() ? 'light_mode' : 'dark_mode' }}</mat-icon>
        </button>
        <button mat-icon-button style="color:white" (click)="logout()">
          <mat-icon>logout</mat-icon>
        </button>
      </div>

      <div class="dash-content">

        <mat-card class="balance-card">
          <mat-card-content>
            <p class="balance-label">Total Balance</p>
            <h1 class="balance-amount">
              ₹{{ wallet?.balance ?? 0 | number:'1.2-2' }}
            </h1>
            <div class="balance-footer">
              <span>{{ wallet?.currency ?? 'INR' }}</span>
              <span>{{ wallet?.isLocked ? '🔒 Locked' : '✅ Active' }}</span>
            </div>
          </mat-card-content>
        </mat-card>

        <mat-card class="kyc-warning" *ngIf="showKycWarning">
          <mat-card-content class="kyc-content">
            <mat-icon>warning</mat-icon>
            <span>Your KYC is pending.
              <a routerLink="/profile">Submit documents</a>
              to activate your wallet.
            </span>
          </mat-card-content>
        </mat-card>

        <div class="actions-grid">
          <mat-card class="action-card" routerLink="/wallet/topup">
            <mat-card-content>
              <div class="action-icon topup">
                <mat-icon>add_circle</mat-icon>
              </div>
              <p>Top Up</p>
            </mat-card-content>
          </mat-card>

          <mat-card class="action-card" routerLink="/wallet/transfer">
            <mat-card-content>
              <div class="action-icon transfer">
                <mat-icon>send</mat-icon>
              </div>
              <p>Transfer</p>
            </mat-card-content>
          </mat-card>

          <mat-card class="action-card" routerLink="/wallet/history">
            <mat-card-content>
              <div class="action-icon history">
                <mat-icon>history</mat-icon>
              </div>
              <p>History</p>
            </mat-card-content>
          </mat-card>

          <mat-card class="action-card" routerLink="/rewards">
            <mat-card-content>
              <div class="action-icon rewards">
                <mat-icon>stars</mat-icon>
              </div>
              <p>Rewards</p>
            </mat-card-content>
          </mat-card>

          <mat-card class="action-card" routerLink="/notifications">
            <mat-card-content>
              <div class="action-icon notifications">
                <mat-icon>notifications</mat-icon>
              </div>
              <p>Notifications</p>
            </mat-card-content>
          </mat-card>

          <mat-card class="action-card" routerLink="/profile">
            <mat-card-content>
              <div class="action-icon profile">
                <mat-icon>person</mat-icon>
              </div>
              <p>Profile</p>
            </mat-card-content>
          </mat-card>

          <mat-card class="action-card" routerLink="/support">
            <mat-card-content>
              <div class="action-icon support">
                <mat-icon>support_agent</mat-icon>
              </div>
              <p>Support</p>
            </mat-card-content>
          </mat-card>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .dashboard-container {
      min-height: 100vh;
      background: #f5f5f5;
      transition: background 0.3s;
    }

    .navbar {
      display: flex;
      align-items: center;
      padding: 12px 24px;
      background: linear-gradient(135deg, #3f51b5 0%, #5c6bc0 100%);
      color: white;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      gap: 8px;
    }

    .brand {
      font-size: 20px;
      font-weight: 700;
      flex: 1;
      letter-spacing: 0.5px;
    }

    .welcome {
      font-size: 14px;
      opacity: 0.9;
    }

    .dash-content {
      padding: 24px;
      max-width: 800px;
      margin: 0 auto;
    }

    .balance-card {
      background: linear-gradient(135deg, #3f51b5 0%, #7986cb 100%) !important;
      color: white !important;
      margin-bottom: 16px;
      padding: 8px;
    }

    .balance-label {
      opacity: 0.8;
      font-size: 14px;
      margin-bottom: 8px;
    }

    .balance-amount {
      font-size: 48px;
      font-weight: 700;
      margin-bottom: 8px;
    }

    .balance-footer {
      display: flex;
      justify-content: space-between;
      opacity: 0.8;
      font-size: 14px;
    }

    .kyc-warning {
      background: #fff3e0 !important;
      margin-bottom: 16px;
    }

    .kyc-content {
      display: flex !important;
      align-items: center !important;
      gap: 8px !important;
    }

    .kyc-warning mat-icon { color: #e65100; }
    .kyc-warning a { color: #3f51b5; font-weight: 600; }

    .actions-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
    }

    .action-card {
      cursor: pointer;
      text-align: center;
      padding: 8px;
    }

    .action-card:hover { transform: translateY(-4px); }

    .action-card p {
      margin: 8px 0 0;
      font-weight: 500;
      font-size: 14px;
      color: #555;
    }

    .action-icon {
      width: 56px;
      height: 56px;
      border-radius: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto;
    }

    .action-icon mat-icon {
      color: white;
      font-size: 28px;
      width: 28px;
      height: 28px;
    }

    .action-icon.topup         { background: linear-gradient(135deg, #43a047, #66bb6a); }
    .action-icon.transfer      { background: linear-gradient(135deg, #1e88e5, #42a5f5); }
    .action-icon.history       { background: linear-gradient(135deg, #8e24aa, #ab47bc); }
    .action-icon.rewards       { background: linear-gradient(135deg, #f4511e, #ff7043); }
    .action-icon.notifications { background: linear-gradient(135deg, #e53935, #ef5350); }
    .action-icon.profile       { background: linear-gradient(135deg, #00897b, #26a69a); }
    .action-icon.support       { background: linear-gradient(135deg, #f9a825, #ffd54f); }
  `]
})
export class DashboardComponent implements OnInit {
  wallet: any = null;
  name = '';
  loading = true;
  showKycWarning = false;

  constructor(
    private api: ApiService,
    private auth: AuthService,
    private router: Router,
    private snackBar: MatSnackBar,
    public theme: ThemeService
  ) { }

  ngOnInit(): void {
    this.name = this.auth.getName();
    this.loadData();
  }

  loadData(): void {
    this.loading = true;
    this.api.get<any>('/api/wallet').subscribe({
      next: (res) => {
        if (res.success) this.wallet = res.data;
        this.loading = false;
      },
      error: () => this.loading = false
    });

    this.api.get<any>('/api/auth/profile').subscribe({
      next: (res) => {
        if (res.success) {
          this.showKycWarning = res.data.status === 'Pending';
        }
      }
    });
  }

  logout(): void {
    this.auth.logout();
  }
}
