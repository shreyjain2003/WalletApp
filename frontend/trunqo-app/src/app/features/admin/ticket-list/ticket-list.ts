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
  selector: 'app-ticket-list',
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
            <a style="cursor:pointer;" routerLink="/admin/kyc">KYC</a>
            <a style="cursor:pointer;" routerLink="/admin/users">Users</a>
            <a style="cursor:pointer;" (click)="logout()"><mat-icon>logout</mat-icon> Logout</a>
          </div>
        </div>
      </div>

      <div class="content">
        <div class="page-header">
          <h2 class="page-title" style="margin:0;">Support Tickets</h2>
        </div>

        <div class="wa-card empty-state" *ngIf="tickets.length === 0" style="text-align:center; padding: 48px;">
          <mat-icon style="font-size: 48px; width:48px; height:48px; opacity: 0.5; margin-bottom:16px;">support_agent</mat-icon>
          <p class="empty" style="color:var(--text-muted); margin:0;">No support tickets yet.</p>
        </div>

        <div class="ticket-card wa-card" *ngFor="let ticket of tickets">
          <div class="ticket-header">
            <div>
              <h3 class="subject">{{ ticket.subject }}</h3>
              <p class="email">{{ ticket.userEmail }}</p>
            </div>
            <span class="status-badge" [class]="ticket.status.toLowerCase()">
              {{ ticket.status }}
            </span>
          </div>

          <div class="message-box">
            <p class="message">{{ ticket.message }}</p>
            <p class="date">{{ ticket.createdAt | date:'medium' }}</p>
          </div>

          <div class="reply-section" *ngIf="ticket.adminReply">
            <div style="display:flex; align-items:center; gap:6px; margin-bottom:8px;">
              <mat-icon style="color:var(--teal); font-size:16px; width:16px; height:16px;">forum</mat-icon>
              <p class="reply-label">Admin Reply</p>
            </div>
            <p class="reply-text">{{ ticket.adminReply }}</p>
          </div>

          <div *ngIf="ticket.status === 'Open'" style="margin-top:20px;">
            <div class="wa-label">Your Reply</div>
            <div class="wa-input-wrap">
              <mat-icon style="align-self:flex-start; margin-top:4px;">reply</mat-icon>
              <textarea [(ngModel)]="ticket.replyInput" rows="3" placeholder="Type your reply to the user..." style="width:100%; min-height:80px; background:transparent; border:none; outline:none; color:var(--text-primary); font-family:inherit; resize:vertical;"></textarea>
            </div>

            <button class="wa-btn-primary full-width" style="margin-top:16px; height:46px;"
                    (click)="reply(ticket)"
                    [disabled]="ticket.loading">
              <mat-icon>send</mat-icon> {{ ticket.loading ? 'Sending...' : 'Send Reply' }}
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

    .ticket-card { padding: 24px; margin-bottom: 20px; }
    .ticket-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; }
    .subject { margin: 0; font-weight: 700; font-size: 18px; color: var(--text-primary); font-family: 'Outfit', sans-serif; }
    .email { margin: 4px 0 0; color: var(--text-secondary); font-size: 14px; }
    
    .status-badge { padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 700; white-space: nowrap; border: 1px solid transparent; }
    .status-badge.open { background: rgba(59,130,246,0.1); color: #3B82F6; border-color: rgba(59,130,246,0.2); }
    .status-badge.responded { background: rgba(16,185,129,0.1); color: #10B981; border-color: rgba(16,185,129,0.2); }
    .status-badge.closed { background: rgba(156,163,175,0.1); color: #9CA3AF; border-color: rgba(156,163,175,0.2); }

    .message-box { background: rgba(0,0,0,0.1); border-radius: 12px; padding: 16px; margin-bottom: 16px; border: 1px solid var(--border); }
    .message { color: var(--text-primary); margin: 0 0 8px 0; line-height: 1.5; font-size: 15px; }
    .date { color: var(--text-muted); font-size: 12px; margin: 0; }

    .reply-section { background: rgba(192, 133, 82, 0.05); padding: 16px; border-radius: 12px; border: 1px dashed rgba(192, 133, 82, 0.3); margin-top: 16px; margin-bottom: 16px; }
    .reply-label { margin: 0; font-weight: 700; color: var(--teal); font-size: 13px; text-transform:uppercase; letter-spacing:0.5px; }
    .reply-text { margin: 0; color: var(--text-primary); line-height: 1.5; font-size: 15px; }
    
    .full-width { width: 100%; display: flex; align-items: center; justify-content: center; }
    .full-width mat-icon { font-size: 18px; width: 18px; height: 18px; margin-right: 6px; }
  `]
})
export class TicketListComponent implements OnInit {
  tickets: any[] = [];

  constructor(private api: ApiService, private auth: AuthService,
    private snackBar: MatSnackBar) { }

  ngOnInit(): void {
    this.loadTickets();
  }

  loadTickets(): void {
    this.api.get<any>('/api/admin/tickets').subscribe({
      next: (res) => {
        if (res.success) {
          this.tickets = res.data.map((t: any) => ({
            ...t, replyInput: '', loading: false
          }));
        }
      },
      error: () => this.snackBar.open('Failed to load tickets', 'Close', { duration: 3000 })
    });
  }

  reply(ticket: any): void {
    if (!ticket.replyInput) {
      this.snackBar.open('Please type a reply', 'Close', { duration: 3000 });
      return;
    }

    ticket.loading = true;
    this.api.post<any>(`/api/admin/tickets/${ticket.id}/reply`, {
      reply: ticket.replyInput
    }).subscribe({
      next: (res) => {
        if (res.success) {
          this.snackBar.open('Reply sent!', 'Close', { duration: 3000 });
          ticket.adminReply = ticket.replyInput;
          ticket.status = 'Responded';
          ticket.replyInput = '';
        } else {
          this.snackBar.open(res.message, 'Close', { duration: 3000 });
        }
        ticket.loading = false;
      },
      error: () => {
        this.snackBar.open('Failed to send reply', 'Close', { duration: 3000 });
        ticket.loading = false;
      }
    });
  }

  logout(): void {
    this.auth.logout();
  }
}
