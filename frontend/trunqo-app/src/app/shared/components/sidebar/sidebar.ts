import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../../core/services/auth';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, MatIconModule],
  template: `
    <div class="overlay" *ngIf="open" (click)="close.emit()"></div>

    <aside class="sidebar" [class.open]="open">
      <!-- Brand -->
      <div class="brand">
        <img src="assets/logo.png?v=2" alt="Trunqo Logo" class="brand-logo" />
        <button class="close-btn" (click)="close.emit()">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <!-- User card -->
      <div class="user-card">
        <div class="user-avatar">{{ initials }}</div>
        <div class="user-info">
          <p class="user-name">{{ name }}</p>
          <p class="user-role">
            <span class="online-dot"></span>Personal Account
          </p>
        </div>
      </div>

      <!-- Nav sections -->
      <nav class="nav">
        <p class="nav-section-label">Main</p>
        <a class="nav-item" routerLink="/dashboard" routerLinkActive="active" (click)="close.emit()">
          <mat-icon>dashboard</mat-icon><span>Dashboard</span>
        </a>
        <a class="nav-item" routerLink="/analytics" routerLinkActive="active" (click)="close.emit()">
          <mat-icon>bar_chart</mat-icon><span>Analytics</span>
        </a>

        <p class="nav-section-label">Wallet</p>
        <a class="nav-item" routerLink="/wallet/topup" routerLinkActive="active" (click)="close.emit()">
          <mat-icon>add_circle_outline</mat-icon><span>Top Up</span>
        </a>
        <a class="nav-item" routerLink="/wallet/transfer" routerLinkActive="active" (click)="close.emit()">
          <mat-icon>send</mat-icon><span>Transfer</span>
        </a>
        <a class="nav-item" routerLink="/wallet/history" routerLinkActive="active" (click)="close.emit()">
          <mat-icon>receipt_long</mat-icon><span>History</span>
        </a>
        <a class="nav-item" routerLink="/request-money" routerLinkActive="active" (click)="close.emit()">
          <mat-icon>request_quote</mat-icon><span>Request Money</span>
        </a>

        <p class="nav-section-label">Account</p>
        <a class="nav-item" routerLink="/rewards" routerLinkActive="active" (click)="close.emit()">
          <mat-icon>workspace_premium</mat-icon><span>Rewards</span>
        </a>
        <a class="nav-item" routerLink="/notifications" routerLinkActive="active" (click)="close.emit()">
          <mat-icon>notifications_none</mat-icon><span>Notifications</span>
        </a>
        <a class="nav-item" routerLink="/profile" routerLinkActive="active" (click)="close.emit()">
          <mat-icon>manage_accounts</mat-icon><span>Profile & KYC</span>
        </a>
        <a class="nav-item" routerLink="/support" routerLinkActive="active" (click)="close.emit()">
          <mat-icon>support_agent</mat-icon><span>Support</span>
        </a>
        <a class="nav-item" routerLink="/set-pin" routerLinkActive="active" (click)="close.emit()">
          <mat-icon>lock_outline</mat-icon><span>Transition PIN</span>
        </a>
      </nav>

      <!-- Footer -->
      <div class="sidebar-footer">
        <button class="logout-btn" (click)="onLogout()">
          <mat-icon>logout</mat-icon>
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  `,
  styles: [`
    .overlay {
      position: fixed; inset: 0;
      background: rgba(0,0,0,0.4);
      z-index: 199; backdrop-filter: blur(2px);
      display: none;
    }

    .sidebar {
      width: 260px;
      height: 100vh;
      background: var(--bg-card);
      border-right: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      position: sticky;
      top: 0;
      flex-shrink: 0;
      overflow-y: auto;
      overflow-x: hidden;
      z-index: 200;
    }

    /* Brand */
    .brand {
      display: flex; align-items: center; justify-content: center;
      padding: 24px;
      border-bottom: 1px solid var(--border);
    }
    .brand-logo {
      max-width: 180px;
      max-height: 58px;
      width: auto;
      height: auto;
      object-fit: contain;
      display: block;
      background: transparent;
    }
    .close-btn { display: none; border: none; background: transparent; cursor: pointer; color: var(--text-secondary); padding: 4px; }

    /* User card */
    .user-card {
      display: flex; align-items: center; gap: 12px;
      margin: 20px 16px 12px;
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: var(--r-md);
      padding: 12px;
    }
    .user-avatar {
      width: 36px; height: 36px; border-radius: 8px;
      background: var(--teal);
      color: #FFF; font-size: 14px; font-weight: 800; font-family: 'Outfit', sans-serif;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }
    .user-name { margin: 0; font-size: 14px; font-weight: 700; color: var(--text-primary); }
    .user-role { margin: 0; font-size: 12px; color: var(--text-secondary); display: flex; align-items: center; gap: 6px; }
    .online-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--success); flex-shrink: 0; }

    /* Nav */
    .nav { flex: 1; padding: 12px 16px; display: flex; flex-direction: column; gap: 4px; }

    .nav-section-label {
      font-size: 11px; font-weight: 700; color: var(--text-muted);
      text-transform: uppercase; letter-spacing: 1px;
      padding: 16px 8px 8px; margin: 0;
    }

    .nav-item {
      display: flex; align-items: center; gap: 12px;
      padding: 12px 14px;
      border-radius: 10px;
      color: var(--text-secondary);
      text-decoration: none;
      font-size: 14px; font-weight: 600; font-family: 'Inter', sans-serif;
      transition: all 0.2s ease;
      cursor: pointer; border: 1px solid transparent;
    }
    .nav-item mat-icon { font-size: 20px; width: 20px; height: 20px; flex-shrink: 0; }
    .nav-item:hover { background: var(--teal-dim); color: var(--teal); }
    .nav-item.active {
      background: var(--teal);
      color: #FFF; border-color: var(--teal);
      box-shadow: var(--shadow-teal);
    }
    .nav-item.active mat-icon { color: #FFF; }

    /* Footer */
    .sidebar-footer {
      padding: 16px 16px 20px;
      border-top: 1px solid var(--border);
    }
    .logout-btn {
      display: flex; align-items: center; gap: 12px;
      padding: 12px 14px; border-radius: 10px;
      border: none; background: transparent;
      color: var(--danger); font-size: 14px; font-weight: 600;
      cursor: pointer; font-family: 'Inter', sans-serif;
      transition: all 0.2s ease; width: 100%; text-align: left;
    }
    .logout-btn mat-icon { font-size: 20px; width: 20px; height: 20px; }
    .logout-btn:hover { background: rgba(217, 72, 72, 0.08); }

    @media (max-width: 900px) {
      .overlay { display: block; }
      .sidebar {
        position: fixed; left: -260px; top: 0;
        transition: left 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      }
      .sidebar.open { left: 0; box-shadow: 4px 0 32px rgba(0,0,0,0.1); }
      .brand { justify-content: space-between; }
      .close-btn { display: flex; }
    }
  `]
})
export class SidebarComponent {
  @Input() open = false;
  @Output() close = new EventEmitter<void>();

  constructor(private auth: AuthService) {}

  get name(): string { return this.auth.getName(); }
  get initials(): string {
    return this.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) || 'U';
  }
  onLogout(): void { this.auth.logout(); }
}
