import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ApiService } from '../../core/services/api';

@Component({
  selector: 'app-notifications',
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
        <button mat-icon-button routerLink="/dashboard">
          <mat-icon>arrow_back</mat-icon>
        </button>
        <span class="title">Notifications</span>
        <span class="unread-badge" *ngIf="unreadCount > 0">
          {{ unreadCount }} unread
        </span>
      </div>

      <div class="content">

        <mat-card *ngIf="notifications.length === 0 && !loading">
          <mat-card-content>
            <p class="empty">🔔 No notifications yet.</p>
          </mat-card-content>
        </mat-card>

        <mat-card class="notif-card"
                  *ngFor="let n of notifications"
                  [class.unread]="!n.isRead">
          <mat-card-content class="notif-content">
            <div class="notif-icon-wrap" [class]="n.type">
              <mat-icon>{{ getIcon(n.type) }}</mat-icon>
            </div>
            <div class="notif-info">
              <p class="notif-title">{{ n.title }}</p>
              <p class="notif-message">{{ n.message }}</p>
              <p class="notif-date">{{ n.createdAt | date:'dd MMM yyyy, hh:mm a' }}</p>
            </div>
            <button mat-icon-button *ngIf="!n.isRead"
                    class="read-btn"
                    (click)="markRead(n.id)"
                    title="Mark as read">
              <mat-icon>done</mat-icon>
            </button>
          </mat-card-content>
        </mat-card>

      </div>
    </div>
  `,
  styles: [`
    .page-container { min-height: 100vh; background: #f5f5f5; }
    .navbar {
      display: flex;
      align-items: center;
      padding: 8px 16px;
      background: linear-gradient(135deg, #3f51b5 0%, #5c6bc0 100%);
      color: white;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      gap: 8px;
    }
    .title { font-size: 18px; font-weight: 500; margin-left: 8px; flex: 1; }
    .unread-badge {
      background: #f44336;
      color: white;
      padding: 2px 10px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
    }
    .content { padding: 24px; max-width: 600px; margin: 0 auto; }
    .empty { text-align: center; color: #999; padding: 48px 32px; font-size: 16px; }

    .notif-card { margin-bottom: 10px; transition: all 0.2s; }
    .notif-card.unread {
      border-left: 4px solid #3f51b5;
      background: #f8f9ff !important;
    }

    .notif-content {
      display: flex !important;
      align-items: flex-start !important;
      gap: 12px !important;
    }

    .notif-icon-wrap {
      width: 44px; height: 44px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      margin-top: 4px;
    }
    .notif-icon-wrap mat-icon { color: white; }
    .notif-icon-wrap.welcome      { background: linear-gradient(135deg, #43a047, #66bb6a); }
    .notif-icon-wrap.topup        { background: linear-gradient(135deg, #1e88e5, #42a5f5); }
    .notif-icon-wrap.transfer_out { background: linear-gradient(135deg, #e53935, #ef5350); }
    .notif-icon-wrap.transfer_in  { background: linear-gradient(135deg, #43a047, #66bb6a); }
    .notif-icon-wrap.kyc_decision { background: linear-gradient(135deg, #8e24aa, #ab47bc); }
    .notif-icon-wrap.tier_upgrade { background: linear-gradient(135deg, #f4511e, #ff7043); }
    .notif-icon-wrap.ticket_reply { background: linear-gradient(135deg, #f9a825, #ffd54f); }

    .notif-info { flex: 1; }
    .notif-title { margin: 0 0 4px; font-weight: 600; font-size: 14px; }
    .notif-message { margin: 0 0 4px; color: #555; font-size: 13px; line-height: 1.4; }
    .notif-date { margin: 0; font-size: 11px; color: #999; }

    .read-btn { color: #4caf50 !important; }
  `]
})
export class NotificationsComponent implements OnInit {
  notifications: any[] = [];
  loading = true;
  unreadCount = 0;

  constructor(private api: ApiService,
    private snackBar: MatSnackBar) { }

  ngOnInit(): void {
    this.api.get<any>('/api/notifications').subscribe({
      next: (res) => {
        if (res.success) {
          this.notifications = res.data;
          this.unreadCount = res.data.filter((n: any) => !n.isRead).length;
        }
        this.loading = false;
      },
      error: () => {
        this.snackBar.open('Failed to load notifications', 'Close', { duration: 3000 });
        this.loading = false;
      }
    });
  }

  markRead(id: string): void {
    this.api.put<any>(`/api/notifications/${id}/read`, {}).subscribe({
      next: (res) => {
        if (res.success) {
          const n = this.notifications.find(n => n.id === id);
          if (n) {
            n.isRead = true;
            this.unreadCount = Math.max(0, this.unreadCount - 1);
          }
        }
      }
    });
  }

  getIcon(type: string): string {
    switch (type) {
      case 'welcome': return 'celebration';
      case 'topup': return 'add_circle';
      case 'transfer_out': return 'arrow_upward';
      case 'transfer_in': return 'arrow_downward';
      case 'kyc_decision': return 'verified_user';
      case 'tier_upgrade': return 'stars';
      case 'ticket_reply': return 'support_agent';
      default: return 'notifications';
    }
  }
}
