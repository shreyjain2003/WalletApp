import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ApiService } from '../../core/services/api';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatSnackBarModule],
  template: `
    <div class="spinner-overlay" *ngIf="loading"><div class="spinner"></div></div>
    
    <div class="page-container fade-in">
      <div class="page-header" style="display: flex; justify-content: space-between; align-items: flex-end;">
        <div>
          <h1 class="page-title">Notifications</h1>
          <p class="page-subtitle">Stay updated on your account activity.</p>
        </div>
        <div *ngIf="unreadCount > 0" style="margin-bottom: 8px;">
          <span class="unread-badge">{{ unreadCount }} unread</span>
        </div>
      </div>

      <div class="empty-state" *ngIf="notifications.length === 0 && !loading">
        <mat-icon>notifications_none</mat-icon><p>No notifications yet</p>
      </div>

      <div class="wa-card notif-list" *ngIf="notifications.length > 0">
        <div class="notif-row" *ngFor="let n of notifications" [class.unread]="!n.isRead">
          <div class="notif-icon" [class]="n.type"><mat-icon>{{ getIcon(n.type) }}</mat-icon></div>
          <div class="notif-body">
            <p class="notif-title">{{ n.title }}</p>
            <p class="notif-msg">{{ n.message }}</p>
            <p class="notif-date">{{ n.createdAt | date:'dd MMM yyyy, hh:mm a' }}</p>
          </div>
          <button class="read-btn" *ngIf="!n.isRead" (click)="markRead(n.id)" title="Mark as read">
            <mat-icon>done</mat-icon>
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .page-container { max-width: 800px; margin: 0 auto; padding-bottom: 32px; }
    .page-header { margin-bottom: 24px; }
    .page-title { font-size: 32px; font-weight: 800; color: var(--text-primary); font-family: 'Outfit', sans-serif; margin-bottom: 8px; letter-spacing: -1px; }
    .page-subtitle { color: var(--text-secondary); font-size: 15px; margin: 0; }
    
    .unread-badge { background: rgba(192, 133, 82, 0.15); color: var(--teal); border: 1px solid rgba(192, 133, 82, 0.3); padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }
    
    .empty-state { text-align: center; padding: 64px 24px; color: var(--text-muted); background: var(--bg-card); border-radius: var(--r-lg); border: 1px dashed var(--border); }
    .empty-state mat-icon { font-size: 48px; width: 48px; height: 48px; margin-bottom: 12px; opacity: 0.7; }
    .empty-state p { font-size: 14px; }
    
    .notif-list { padding: 0; overflow: hidden; }
    .notif-row { display: flex; align-items: flex-start; gap: 16px; padding: 16px 20px; border-bottom: 1px solid var(--border); transition: background 0.15s; }
    .notif-row:last-child { border-bottom: none; }
    .notif-row:hover { background: rgba(192, 133, 82, 0.03); }
    .notif-row.unread { border-left: 3px solid var(--teal); background: rgba(192, 133, 82, 0.05); }
    
    .notif-icon { width: 42px; height: 42px; border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 2px; }
    .notif-icon mat-icon { font-size: 20px; width: 20px; height: 20px; }
    .notif-icon.topup        { background: rgba(16,185,129,0.1); color: #10B981; }
    .notif-icon.transfer_in  { background: rgba(59,130,246,0.1); color: #3B82F6; }
    .notif-icon.transfer_out { background: rgba(239,68,68,0.1); color: #EF4444; }
    .notif-icon.kyc_decision { background: rgba(192, 133, 82, 0.1); color: var(--teal); }
    .notif-icon.tier_upgrade { background: rgba(245,158,11,0.1); color: #F59E0B; }
    .notif-icon.ticket_reply { background: rgba(139,92,246,0.1); color: #8B5CF6; }
    
    .notif-body { flex: 1; }
    .notif-title { margin: 0 0 4px; font-size: 14px; font-weight: 700; color: var(--text-primary); }
    .notif-msg   { margin: 0 0 6px; font-size: 13px; color: var(--text-secondary); line-height: 1.4; }
    .notif-date  { margin: 0; font-size: 12px; color: var(--text-muted); }
    
    .read-btn { border: 1px solid rgba(16,185,129,0.3); background: rgba(16,185,129,0.1); cursor: pointer; color: #10B981; padding: 6px; border-radius: 8px; transition: background 0.15s; flex-shrink: 0; display: flex; align-items: center; justify-content: center; }
    .read-btn:hover { background: rgba(16,185,129,0.2); }
    .read-btn mat-icon { font-size: 18px; width: 18px; height: 18px; }
  `]
})
export class NotificationsComponent implements OnInit {
  notifications: any[] = []; loading = true; unreadCount = 0;
  constructor(private api: ApiService, private snackBar: MatSnackBar) {}
  ngOnInit(): void {
    this.api.get<any>('/api/notifications').subscribe({
      next: (res) => { if (res.success) { this.notifications = res.data; this.unreadCount = res.data.filter((n: any) => !n.isRead).length; } this.loading = false; },
      error: () => { this.snackBar.open('Failed to load notifications', 'Close', { duration: 3000 }); this.loading = false; }
    });
  }
  markRead(id: string): void {
    this.api.put<any>(`/api/notifications/${id}/read`, {}).subscribe({
      next: (res) => { if (res.success) { const n = this.notifications.find(n => n.id === id); if (n) { n.isRead = true; this.unreadCount = Math.max(0, this.unreadCount - 1); } } }
    });
  }
  getIcon(type: string): string {
    const m: Record<string,string> = { topup: 'add_circle', transfer_in: 'arrow_downward', transfer_out: 'arrow_upward', kyc_decision: 'verified_user', tier_upgrade: 'workspace_premium', ticket_reply: 'support_agent', campaign_applied: 'local_offer' };
    return m[type] ?? 'notifications';
  }
}
