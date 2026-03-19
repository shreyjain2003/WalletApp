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
    <div class="page-container">
      <div class="navbar">
        <span class="brand">🔐 Admin Panel</span>
        <button mat-button routerLink="/admin/kyc">KYC Reviews</button>
        <button mat-button (click)="logout()">Logout</button>
      </div>

      <div class="content">
        <h2>Support Tickets</h2>

        <mat-card *ngIf="tickets.length === 0">
          <mat-card-content>
            <p class="empty">No support tickets yet.</p>
          </mat-card-content>
        </mat-card>

        <mat-card class="ticket-card" *ngFor="let ticket of tickets">
          <mat-card-content>
            <div class="ticket-header">
              <div>
                <h3>{{ ticket.subject }}</h3>
                <p class="email">{{ ticket.userEmail }}</p>
              </div>
              <span class="status" [class]="ticket.status.toLowerCase()">
                {{ ticket.status }}
              </span>
            </div>

            <p class="message">{{ ticket.message }}</p>
            <p class="date">{{ ticket.createdAt | date:'medium' }}</p>

            <div class="reply-section" *ngIf="ticket.adminReply">
              <p class="reply-label">Admin Reply:</p>
              <p class="reply-text">{{ ticket.adminReply }}</p>
            </div>

            <div *ngIf="ticket.status === 'Open'">
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Your Reply</mat-label>
                <textarea matInput [(ngModel)]="ticket.replyInput"
                          rows="3" placeholder="Type your reply...">
                </textarea>
              </mat-form-field>

              <button mat-raised-button color="primary"
                      (click)="reply(ticket)"
                      [disabled]="ticket.loading">
                {{ ticket.loading ? 'Sending...' : 'Send Reply' }}
              </button>
            </div>
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
      padding: 8px 24px;
      background: #c62828;
      color: white;
    }
    .brand { font-size: 18px; font-weight: bold; flex: 1; }
    .content { padding: 24px; max-width: 700px; margin: 0 auto; }
    .empty { text-align: center; color: #999; padding: 32px; }
    .ticket-card { margin-bottom: 16px; }
    .ticket-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 12px;
    }
    .ticket-header h3 { margin: 0; }
    .email { margin: 4px 0 0; color: #666; font-size: 14px; }
    .status { padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; }
    .status.open { background: #e3f2fd; color: #1565c0; }
    .status.responded { background: #e8f5e9; color: #2e7d32; }
    .status.closed { background: #fafafa; color: #666; }
    .message { color: #333; margin-bottom: 4px; }
    .date { color: #999; font-size: 12px; margin-bottom: 16px; }
    .reply-section {
      background: #f5f5f5;
      padding: 12px;
      border-radius: 8px;
      margin-bottom: 16px;
    }
    .reply-label { margin: 0 0 4px; font-weight: 600; color: #666; font-size: 12px; }
    .reply-text { margin: 0; }
    .full-width { width: 100%; margin-bottom: 12px; }
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
