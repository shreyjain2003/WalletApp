import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ApiService } from '../../core/services/api';
import { AuthService } from '../../core/services/auth';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, MatIconModule, MatSnackBarModule],
  template: `
    <div class="spinner-overlay" *ngIf="loading"><div class="spinner"></div></div>
    
    <div class="dashboard-wrapper">
      <!-- KYC Banner -->
      <div class="kyc-banner fade-in" *ngIf="showKycWarning">
        <mat-icon>info_outline</mat-icon>
        <span>KYC verification pending &mdash; <a routerLink="/profile">Submit documents</a> to activate your wallet complete features.</span>
        <button class="banner-close" routerLink="/profile">Complete KYC</button>
      </div>

      <div class="top-row fade-in">
        <!-- Premium Balance Card -->
        <div class="balance-card">
          <div class="balance-glow"></div>
          <div class="balance-glow-2"></div>
          <div class="balance-header">
            <span class="balance-label">Total Balance</span>
            <span class="balance-currency">{{ wallet?.currency ?? 'INR' }}</span>
          </div>
          <div class="balance-amount">
            <span class="balance-symbol">&#8377;</span>
            <span class="balance-value">{{ wallet?.balance ?? 0 | number:'1.2-2' }}</span>
          </div>
          <div class="balance-meta">
            <span class="meta-tag" [class.locked]="wallet?.isLocked">
              <mat-icon>{{ wallet?.isLocked ? 'lock' : 'check_circle' }}</mat-icon>
              {{ wallet?.isLocked ? 'Locked' : 'Active' }}
            </span>
            <span class="meta-tag">
              <mat-icon>account_balance_wallet</mat-icon>
              Personal Wallet
            </span>
          </div>
          <div class="balance-actions">
            <a routerLink="/wallet/topup" class="bal-btn bal-btn-primary">
              <mat-icon>add_circle</mat-icon> Top Up
            </a>
            <a routerLink="/wallet/transfer" class="bal-btn bal-btn-secondary">
              <mat-icon>send</mat-icon> Send
            </a>
            <a routerLink="/request-money" class="bal-btn bal-btn-outline">
              <mat-icon>request_quote</mat-icon>
            </a>
          </div>
        </div>

        <!-- Quick Stats -->
        <div class="stats-grid">
          <div class="stat-tile" routerLink="/wallet/history">
            <div class="stat-icon income"><mat-icon>call_received</mat-icon></div>
            <div>
              <p class="stat-label">Total Received</p>
              <p class="stat-val">&#8377;{{ totalReceived | number:'1.0-0' }}</p>
            </div>
          </div>
          <div class="stat-tile" routerLink="/wallet/history">
            <div class="stat-icon expense"><mat-icon>call_made</mat-icon></div>
            <div>
              <p class="stat-label">Total Sent</p>
              <p class="stat-val">&#8377;{{ totalSent | number:'1.0-0' }}</p>
            </div>
          </div>
          <div class="stat-tile" routerLink="/rewards">
            <div class="stat-icon rewards"><mat-icon>workspace_premium</mat-icon></div>
            <div>
              <p class="stat-label">Reward Points</p>
              <p class="stat-val">{{ rewardPoints | number }}</p>
            </div>
          </div>
          <div class="stat-tile" routerLink="/wallet/history">
            <div class="stat-icon txns"><mat-icon>receipt_long</mat-icon></div>
            <div>
              <p class="stat-label">Transactions</p>
              <p class="stat-val">{{ recentTx.length }}</p>
            </div>
          </div>
        </div>
      </div>

      <div class="bottom-row fade-in-2">
        <!-- Recent Transactions -->
        <div class="wa-card">
          <div class="card-header-row">
            <h3 class="card-title-small">Recent Transactions</h3>
            <a routerLink="/wallet/history" class="view-all">View all</a>
          </div>

          <div class="empty-state" *ngIf="recentTx.length === 0 && !loading">
            <mat-icon>receipt_long</mat-icon>
            <p>No transactions yet</p>
          </div>

          <div class="tx-list">
            <div class="tx-row" *ngFor="let tx of recentTx">
              <div class="tx-icon-wrap" [class]="tx.type">
                <mat-icon>{{ txIcon(tx.type) }}</mat-icon>
              </div>
              <div class="tx-info">
                <p class="tx-title">{{ txLabel(tx.type) }}</p>
                <p class="tx-date">{{ tx.createdAt | date:'dd MMM, hh:mm a' }}</p>
              </div>
              <div class="tx-amt" [class]="tx.type">
                 {{ tx.type === 'transfer_out' ? '&minus;' : '+' }}&#8377;{{ tx.amount | number:'1.2-2' }}
              </div>
            </div>
          </div>
        </div>

        <!-- Quick Access panel -->
        <div class="wa-card quick-access">
          <div class="card-header-row" style="margin-bottom: 24px;">
            <h3 class="card-title-small">Quick Actions</h3>
          </div>
          <div class="quick-grid">
            <a class="quick-link" routerLink="/analytics">
               <div class="icon-circle"><mat-icon>bar_chart</mat-icon></div>
               <span>Analytics</span>
            </a>
            <a class="quick-link" routerLink="/rewards">
               <div class="icon-circle"><mat-icon>workspace_premium</mat-icon></div>
               <span>Rewards</span>
            </a>
            <a class="quick-link" routerLink="/notifications">
               <div class="icon-circle"><mat-icon>notifications_none</mat-icon></div>
               <span>Alerts</span>
            </a>
            <a class="quick-link" routerLink="/profile">
               <div class="icon-circle"><mat-icon>manage_accounts</mat-icon></div>
               <span>Profile</span>
            </a>
            <a class="quick-link" routerLink="/support">
               <div class="icon-circle"><mat-icon>support_agent</mat-icon></div>
               <span>Support</span>
            </a>
            <a class="quick-link" routerLink="/set-pin">
               <div class="icon-circle"><mat-icon>lock_outline</mat-icon></div>
               <span>Sec. PIN</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .dashboard-wrapper {
      max-width: 1140px; margin: 0 auto;
    }
    
    .kyc-banner {
      display: flex; align-items: center; gap: 12px;
      background-color: var(--teal-dim);
      border: 1px solid rgba(192, 133, 82, 0.3);
      padding: 16px 20px; border-radius: var(--r-md);
      margin-bottom: 24px; color: var(--secondary); font-size: 14px;
      box-shadow: var(--shadow-sm);
    }
    .kyc-banner mat-icon { font-size: 22px; width: 22px; height: 22px; flex-shrink: 0; color: var(--teal); }
    .kyc-banner span { flex: 1; font-weight: 500;}
    .kyc-banner a { color: var(--secondary); font-weight: 700; text-decoration: underline; }
    .banner-close {
      background: var(--teal); color: #fff;
      border: none; padding: 8px 16px; border-radius: 8px;
      font-size: 13px; font-weight: 600; cursor: pointer;
      box-shadow: var(--shadow-teal); transition: all 0.2s;
    }
    .banner-close:hover { background: var(--secondary); }

    .top-row {
      display: grid; grid-template-columns: 400px 1fr; gap: 24px; margin-bottom: 32px;
    }

    /* Premium Balance Card */
    .balance-card {
      position: relative; overflow: hidden;
      background: linear-gradient(135deg, var(--text-primary) 0%, #2A1A18 100%);
      border-radius: var(--r-xl); padding: 36px 32px;
      color: #FFF; box-shadow: var(--shadow-lg);
    }
    .balance-glow {
      position: absolute; top: -60px; right: -60px;
      width: 240px; height: 240px; border-radius: 50%;
      background: radial-gradient(circle, rgba(192, 133, 82, 0.25) 0%, transparent 70%);
      pointer-events: none;
    }
    .balance-glow-2 {
      position: absolute; bottom: -40px; left: -40px;
      width: 180px; height: 180px; border-radius: 50%;
      background: radial-gradient(circle, rgba(255, 255, 255, 0.05) 0%, transparent 70%);
      pointer-events: none;
    }
    .balance-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; position: relative; z-index: 2;}
    .balance-label { font-size: 14px; font-weight: 500; opacity: 0.8; letter-spacing: 0.5px; }
    .balance-currency { font-size: 12px; font-weight: 700; background: rgba(192, 133, 82, 0.3); padding: 4px 10px; border-radius: 20px; color: #FFF8F0; border: 1px solid rgba(192, 133, 82, 0.5);}
    
    .balance-amount { display: flex; align-items: baseline; gap: 6px; margin-bottom: 24px; position: relative; z-index: 2;}
    .balance-symbol { font-size: 28px; font-weight: 600; opacity: 0.8; }
    .balance-value  { font-size: 48px; font-weight: 800; font-family: 'Outfit', sans-serif; letter-spacing: -1px; }
    
    .balance-meta { display: flex; gap: 10px; margin-bottom: 32px; position: relative; z-index: 2; }
    .meta-tag {
      display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600;
      background: rgba(255, 255, 255, 0.1); padding: 6px 14px; border-radius: 20px;
      border: 1px solid rgba(255,255,255,0.1);
    }
    .meta-tag mat-icon { font-size: 16px; width: 16px; height: 16px; }
    
    .balance-actions { display: flex; gap: 12px; position: relative; z-index: 2; }
    .bal-btn {
      height: 48px; display: flex; align-items: center; justify-content: center; gap: 8px;
      font-size: 14px; font-weight: 600; text-decoration: none; border-radius: 12px;
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1); cursor: pointer;
    }
    .bal-btn mat-icon { font-size: 20px; width: 20px; height: 20px; }
    .bal-btn-primary { flex: 2; background: var(--teal); color: #FFF; box-shadow: var(--shadow-teal); border: 1px solid var(--teal);}
    .bal-btn-primary:hover { background: var(--secondary); transform: translateY(-2px); border-color: var(--secondary);}
    .bal-btn-secondary { flex: 2; background: rgba(255,255,255,0.15); color: #FFF; backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.1);}
    .bal-btn-secondary:hover { background: rgba(255,255,255,0.25); transform: translateY(-2px); }
    .bal-btn-outline { flex: 1; min-width: 48px; background: transparent; border: 1.5px solid rgba(255,255,255,0.3); color: #FFF; }
    .bal-btn-outline:hover { background: rgba(255,255,255,0.1); transform: translateY(-2px); }

    /* Stats Grid */
    .stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    .stat-tile {
      background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--r-lg);
      padding: 24px; display: flex; align-items: center; gap: 20px; cursor: pointer;
      text-decoration: none; transition: all 0.2s; box-shadow: var(--shadow-sm);
    }
    .stat-tile:hover { border-color: var(--teal); box-shadow: var(--shadow-md); transform: translateY(-2px); }
    
    .stat-icon { width: 52px; height: 52px; border-radius: 14px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .stat-icon mat-icon { font-size: 26px; width: 26px; height: 26px; }
    .stat-icon.income { background: rgba(45, 138, 86, 0.1); color: var(--success); }
    .stat-icon.expense { background: rgba(217, 72, 72, 0.1); color: var(--danger); }
    .stat-icon.rewards { background: var(--teal-dim); color: var(--teal); }
    .stat-icon.txns { background: rgba(45, 106, 138, 0.1); color: var(--info); }
    
    .stat-label { margin: 0 0 8px 0; font-size: 13px; color: var(--text-secondary); font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;}
    .stat-val { margin: 0; font-size: 26px; font-weight: 800; color: var(--text-primary); font-family: 'Outfit', sans-serif; letter-spacing: -0.5px;}

    /* Bottom Row */
    .bottom-row { display: grid; grid-template-columns: 1fr 340px; gap: 32px; }
    .wa-card { padding: 32px; }
    
    .card-header-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; padding-bottom: 20px; border-bottom: 1px solid var(--space-600); }
    .card-title-small { font-size: 18px; font-weight: 700; color: var(--text-primary); font-family: 'Outfit', sans-serif; margin: 0;}
    .view-all { font-size: 14px; color: var(--teal); text-decoration: none; font-weight: 600; padding: 6px 12px; border-radius: 20px; background: var(--teal-dim); transition: all 0.2s;}
    .view-all:hover { background: var(--teal); color: #fff; }

    .tx-row { display: flex; align-items: center; gap: 18px; padding: 16px 20px; border: 1px solid transparent; border-bottom: 1px dashed var(--space-600); transition: all 0.2s; border-radius: var(--r-md); margin-bottom: 4px;}
    .tx-row:last-child { border-bottom: 1px solid transparent; margin-bottom: 0;}
    .tx-row:hover { background: var(--space-800); border: 1px solid var(--border); transform: translateX(4px); }
    
    .tx-icon-wrap { width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .tx-icon-wrap mat-icon { font-size: 22px; width: 22px; height: 22px; }
    .tx-icon-wrap.topup { background: rgba(45, 138, 86, 0.1); color: var(--success); }
    .tx-icon-wrap.transfer_in { background: rgba(45, 106, 138, 0.1); color: var(--info); }
    .tx-icon-wrap.transfer_out { background: rgba(217, 72, 72, 0.1); color: var(--danger); }
    .tx-icon-wrap.admin_adjustment { background: var(--teal-dim); color: var(--teal); }
    .tx-icon-wrap.cashback { background: rgba(59,130,246,0.1); color: #3B82F6; }

    .tx-info { flex: 1; }
    .tx-title { margin: 0 0 6px 0; font-size: 15px; font-weight: 600; color: var(--text-primary); }
    .tx-date { margin: 0; font-size: 13px; color: var(--text-muted); font-weight: 500;}

    .tx-amt { font-size: 16px; font-weight: 800; font-family: 'Outfit', sans-serif;}
    .tx-amt.topup { color: var(--success); }
    .tx-amt.transfer_in { color: var(--info); }
    .tx-amt.transfer_out { color: var(--danger); }
    .tx-amt.admin_adjustment { color: var(--teal); }
    .tx-amt.cashback { color: #3B82F6; }

    /* Quick Grid */
    .quick-access { background: var(--space-800); border: none; }
    .quick-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .quick-link {
      display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 24px 16px;
      background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--r-md);
      color: var(--text-primary); text-decoration: none; font-size: 14px; font-weight: 600;
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1); box-shadow: var(--shadow-sm);
    }
    .icon-circle { width: 48px; height: 48px; border-radius: 50%; background: var(--space-800); display: flex; align-items: center; justify-content: center; color: var(--text-secondary); transition: all 0.2s;}
    .quick-link:hover { border-color: var(--teal); box-shadow: var(--shadow-md); transform: translateY(-3px); }
    .quick-link:hover .icon-circle { background: var(--teal); color: white; box-shadow: var(--shadow-teal); }

    .empty-state { text-align: center; padding: 48px 0; color: var(--text-muted); }
    .empty-state mat-icon { font-size: 48px; width: 48px; height: 48px; margin-bottom: 16px; opacity: 0.3; }

    @media (max-width: 992px) {
      .top-row { grid-template-columns: 1fr; }
      .stats-grid { grid-template-columns: repeat(4, 1fr); }
      .bottom-row { grid-template-columns: 1fr; }
    }
    @media (max-width: 600px) {
      .stats-grid { grid-template-columns: 1fr 1fr; }
    }
  `]
})
export class DashboardComponent implements OnInit {
  wallet: any = null;
  recentTx: any[] = [];
  loading = true;
  showKycWarning = false;
  totalReceived = 0;
  totalSent = 0;
  rewardPoints = 0;

  constructor(private api: ApiService, private auth: AuthService, private snackBar: MatSnackBar) {}

  ngOnInit(): void {
    this.api.get<any>('/api/wallet').subscribe({
      next: (res) => { if (res.success) this.wallet = res.data; this.loading = false; },
      error: () => this.loading = false
    });
    this.api.get<any>('/api/wallet/history').subscribe({
      next: (res) => {
        if (res.success) {
          this.recentTx = res.data.slice(0, 6);
          this.totalReceived = res.data.filter((t: any) => t.type === 'topup' || t.type === 'transfer_in').reduce((s: number, t: any) => s + t.amount, 0);
          this.totalSent = res.data.filter((t: any) => t.type === 'transfer_out').reduce((s: number, t: any) => s + t.amount, 0);
        }
      }
    });
    this.api.get<any>('/api/auth/profile').subscribe({
      next: (res) => { if (res.success) this.showKycWarning = res.data.status === 'Pending'; }
    });
    this.api.get<any>('/api/rewards').subscribe({
      next: (res) => { if (res.success) this.rewardPoints = res.data.pointsBalance ?? 0; }
    });
  }

  txIcon(type: string): string {
    const m: Record<string, string> = { topup: 'add_circle', transfer_in: 'call_received', transfer_out: 'call_made', admin_adjustment: 'tune', cashback: 'local_offer' };
    return m[type] ?? 'sync_alt';
  }
  txLabel(type: string): string {
    const m: Record<string, string> = { topup: 'Wallet Top Up', transfer_in: 'Money Received', transfer_out: 'Money Sent', admin_adjustment: 'Admin Adjustment', cashback: 'Cashback Reward' };
    return m[type] ?? type;
  }
}
