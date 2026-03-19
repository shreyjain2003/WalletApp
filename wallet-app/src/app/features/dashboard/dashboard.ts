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
      <!-- Navbar -->
      <div class="navbar">
        <span class="brand">💳 WalletApp</span>
        <span class="welcome">Hi, {{ name }}!</span>
        <button mat-icon-button style="color:white"
                (click)="theme.toggleDark()">
          <mat-icon>{{ theme.getDarkMode() ? 'light_mode' : 'dark_mode' }}</mat-icon>
        </button>
        <button mat-icon-button style="color:white" (click)="logout()">
          <mat-icon>logout</mat-icon>
        </button>
      </div>

      <div class="dash-content">

        <!-- Balance Card -->
        <div class="balance-card fade-in">
          <div class="balance-bg">
            <div class="balance-circle c1"></div>
            <div class="balance-circle c2"></div>
            <div class="balance-circle c3"></div>
          </div>
          <div class="balance-inner">
            <p class="balance-label">Total Balance</p>
            <h1 class="balance-amount">
              ₹{{ wallet?.balance ?? 0 | number:'1.2-2' }}
            </h1>
            <div class="balance-footer">
              <div class="balance-tag">
                <mat-icon>account_balance_wallet</mat-icon>
                <span>{{ wallet?.currency ?? 'INR' }}</span>
              </div>
              <div class="balance-tag">
                <mat-icon>{{ wallet?.isLocked ? 'lock' : 'check_circle' }}</mat-icon>
                <span>{{ wallet?.isLocked ? 'Locked' : 'Active' }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- KYC Warning -->
        <div class="kyc-banner fade-in" *ngIf="showKycWarning">
          <mat-icon>warning_amber</mat-icon>
          <span>KYC pending —
            <a routerLink="/profile">Submit documents</a>
            to activate wallet
          </span>
        </div>

        <!-- Quick Actions -->
        <p class="section-label">Quick Actions</p>
        <div class="actions-grid fade-in">
          <div class="action-item" routerLink="/wallet/topup">
            <div class="action-icon-wrap topup">
              <mat-icon>add_circle_outline</mat-icon>
            </div>
            <span>Top Up</span>
          </div>

          <div class="action-item" routerLink="/wallet/transfer">
            <div class="action-icon-wrap transfer">
              <mat-icon>send</mat-icon>
            </div>
            <span>Transfer</span>
          </div>

          <div class="action-item" routerLink="/wallet/history">
            <div class="action-icon-wrap history">
              <mat-icon>receipt_long</mat-icon>
            </div>
            <span>History</span>
          </div>

          <div class="action-item" routerLink="/rewards">
            <div class="action-icon-wrap rewards">
              <mat-icon>workspace_premium</mat-icon>
            </div>
            <span>Rewards</span>
          </div>
        </div>

        <!-- More Options -->
        <p class="section-label">More</p>
        <div class="more-grid fade-in">
          <mat-card class="more-card" routerLink="/notifications">
            <mat-card-content>
              <mat-icon class="more-icon notif">notifications</mat-icon>
              <div>
                <p class="more-title">Notifications</p>
                <p class="more-sub">View all alerts</p>
              </div>
              <mat-icon class="more-arrow">chevron_right</mat-icon>
            </mat-card-content>
          </mat-card>

          <mat-card class="more-card" routerLink="/profile">
            <mat-card-content>
              <mat-icon class="more-icon profile">manage_accounts</mat-icon>
              <div>
                <p class="more-title">Profile & KYC</p>
                <p class="more-sub">Manage your account</p>
              </div>
              <mat-icon class="more-arrow">chevron_right</mat-icon>
            </mat-card-content>
          </mat-card>

          <mat-card class="more-card" routerLink="/support">
            <mat-card-content>
              <mat-icon class="more-icon support">support_agent</mat-icon>
              <div>
                <p class="more-title">Support</p>
                <p class="more-sub">Get help & raise tickets</p>
              </div>
              <mat-icon class="more-arrow">chevron_right</mat-icon>
            </mat-card-content>
          </mat-card>
        </div>

      </div>
    </div>
  `,
  styles: [`
    .dashboard-container {
      min-height: 100vh;
      background: #f0f2f5;
      transition: background 0.4s ease;
    }

    .navbar {
      display: flex;
      align-items: center;
      padding: 14px 20px;
      background: linear-gradient(135deg, #3f51b5 0%, #5c35d4 100%);
      color: white;
      box-shadow: 0 4px 20px rgba(63,81,181,0.3);
      gap: 4px;
      position: sticky;
      top: 0;
      z-index: 100;
    }

    .brand {
      font-size: 18px;
      font-weight: 800;
      flex: 1;
      letter-spacing: -0.5px;
    }

    .welcome {
      font-size: 13px;
      opacity: 0.85;
      font-weight: 500;
    }

    .dash-content {
      padding: 20px 16px;
      max-width: 500px;
      margin: 0 auto;
    }

    /* ── Balance Card ── */
    .balance-card {
      position: relative;
      background: linear-gradient(135deg, #3f51b5 0%, #7c4dff 50%, #5c35d4 100%);
      border-radius: 24px;
      padding: 28px 24px;
      color: white;
      overflow: hidden;
      margin-bottom: 16px;
      box-shadow: 0 8px 32px rgba(63,81,181,0.4);
    }

    .balance-bg { position: absolute; inset: 0; }

    .balance-circle {
      position: absolute;
      border-radius: 50%;
      background: rgba(255,255,255,0.08);
    }

    .c1 { width: 200px; height: 200px; top: -60px; right: -40px; }
    .c2 { width: 120px; height: 120px; bottom: -30px; right: 60px; }
    .c3 { width: 80px; height: 80px; top: 20px; right: 100px; }

    .balance-inner { position: relative; z-index: 1; }

    .balance-label {
      font-size: 13px;
      opacity: 0.8;
      font-weight: 500;
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .balance-amount {
      font-size: 42px;
      font-weight: 800;
      margin-bottom: 20px;
      letter-spacing: -1px;
    }

    .balance-footer {
      display: flex;
      gap: 16px;
    }

    .balance-tag {
      display: flex;
      align-items: center;
      gap: 6px;
      background: rgba(255,255,255,0.15);
      padding: 6px 12px;
      border-radius: 20px;
      font-size: 13px;
      font-weight: 500;
      backdrop-filter: blur(4px);
    }

    .balance-tag mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }

    /* ── KYC Banner ── */
    .kyc-banner {
      display: flex;
      align-items: center;
      gap: 10px;
      background: linear-gradient(135deg, #fff3e0, #ffe0b2);
      border: 1px solid #ffb74d;
      border-radius: 12px;
      padding: 12px 16px;
      margin-bottom: 20px;
      font-size: 13px;
      color: #e65100;
      font-weight: 500;
    }

    .kyc-banner a {
      color: #3f51b5;
      font-weight: 700;
      text-decoration: underline;
    }

    .kyc-banner mat-icon {
      color: #ff6f00;
      font-size: 20px;
      width: 20px;
      height: 20px;
      flex-shrink: 0;
    }

    /* ── Section Label ── */
    .section-label {
      font-size: 13px;
      font-weight: 700;
      color: #666;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 12px;
    }

    /* ── Quick Actions Grid ── */
    .actions-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      margin-bottom: 24px;
    }

    .action-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      cursor: pointer;
    }

    .action-item span {
      font-size: 12px;
      font-weight: 600;
      color: #444;
    }

    .action-icon-wrap {
      width: 60px;
      height: 60px;
      border-radius: 18px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1),
                  box-shadow 0.3s ease;
    }

    .action-item:hover .action-icon-wrap {
      transform: translateY(-4px) scale(1.05);
      box-shadow: 0 8px 24px rgba(0,0,0,0.15);
    }

    .action-icon-wrap mat-icon {
      color: white;
      font-size: 26px;
      width: 26px;
      height: 26px;
    }

    .action-icon-wrap.topup    { background: linear-gradient(135deg, #00c853, #69f0ae); box-shadow: 0 4px 16px rgba(0,200,83,0.3); }
    .action-icon-wrap.transfer { background: linear-gradient(135deg, #2979ff, #82b1ff); box-shadow: 0 4px 16px rgba(41,121,255,0.3); }
    .action-icon-wrap.history  { background: linear-gradient(135deg, #aa00ff, #ea80fc); box-shadow: 0 4px 16px rgba(170,0,255,0.3); }
    .action-icon-wrap.rewards  { background: linear-gradient(135deg, #ff6d00, #ffab40); box-shadow: 0 4px 16px rgba(255,109,0,0.3); }

    /* ── More Grid ── */
    .more-grid {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin-bottom: 24px;
    }

    .more-card {
      cursor: pointer;
      border-radius: 16px !important;
    }

    .more-card:hover {
      transform: translateX(4px) !important;
    }

    .more-card mat-card-content {
      display: flex !important;
      align-items: center !important;
      gap: 14px !important;
      padding: 4px !important;
    }

    .more-icon {
      font-size: 28px !important;
      width: 28px !important;
      height: 28px !important;
      padding: 10px;
      border-radius: 12px;
      flex-shrink: 0;
    }

    .more-icon.notif   { background: #e8eaf6; color: #3f51b5; }
    .more-icon.profile { background: #e0f2f1; color: #00897b; }
    .more-icon.support { background: #fff8e1; color: #f9a825; }

    .more-title {
      margin: 0;
      font-size: 14px;
      font-weight: 600;
      color: #222;
    }

    .more-sub {
      margin: 2px 0 0;
      font-size: 12px;
      color: #888;
    }

    .more-arrow {
      margin-left: auto;
      color: #ccc !important;
    }

    /* ── Dark Mode Overrides ── */
    :host-context(body.dark) .dashboard-container {
      background: #0a0a0f;
    }

    :host-context(body.dark) .section-label {
      color: #555577;
    }

    :host-context(body.dark) .action-item span {
      color: #b0b0cc;
    }

    :host-context(body.dark) .more-title {
      color: #e8e8f0;
    }

    :host-context(body.dark) .more-sub {
      color: #555577;
    }

    :host-context(body.dark) .more-icon.notif {
      background: #1a1a3a;
      color: #7c8ff5;
    }

    :host-context(body.dark) .more-icon.profile {
      background: #0d2420;
      color: #4db6ac;
    }

    :host-context(body.dark) .more-icon.support {
      background: #2d2200;
      color: #ffd54f;
    }

    :host-context(body.dark) .more-arrow {
      color: #333355 !important;
    }

    :host-context(body.dark) .kyc-banner {
      background: linear-gradient(135deg, #2d1f00, #3d2a00);
      border-color: #ff6f00;
    }

    :host-context(body.dark) .balance-card {
      background: linear-gradient(135deg, #1a1a5e 0%, #2d1b69 50%, #1a0a3a 100%);
      box-shadow: 0 8px 32px rgba(124,77,255,0.3);
    }

    /* ── Mobile ── */
    @media (max-width: 400px) {
      .balance-amount { font-size: 34px; }
      .action-icon-wrap { width: 52px; height: 52px; border-radius: 16px; }
      .action-icon-wrap mat-icon { font-size: 22px; width: 22px; height: 22px; }
    }
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
