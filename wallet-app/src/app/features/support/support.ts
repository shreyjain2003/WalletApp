import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ApiService } from '../../core/services/api';

@Component({
  selector: 'app-support',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterLink,
    MatCardModule, MatButtonModule,
    MatIconModule, MatInputModule, MatSnackBarModule
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
        <span class="title">Support</span>
      </div>

      <div class="content">

        <!-- Submit ticket -->
        <mat-card class="submit-card">
          <mat-card-content>
            <div class="card-header">
              <mat-icon class="card-icon">support_agent</mat-icon>
              <div>
                <h3>Raise a Ticket</h3>
                <p class="card-sub">We'll get back to you within 24 hours</p>
              </div>
            </div>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Subject</mat-label>
              <input matInput [(ngModel)]="subject"
                     placeholder="What's your issue?"/>
              <mat-icon matSuffix>title</mat-icon>
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Message</mat-label>
              <textarea matInput [(ngModel)]="message"
                        rows="4"
                        placeholder="Describe your issue in detail...">
              </textarea>
            </mat-form-field>

            <button mat-raised-button color="primary"
                    class="full-width submit-btn"
                    (click)="submitTicket()"
                    [disabled]="submitting">
              <mat-icon>send</mat-icon>
              {{ submitting ? 'Submitting...' : 'Submit Ticket' }}
            </button>
          </mat-card-content>
        </mat-card>

        <!-- My tickets -->
        <h3 class="section-heading">My Tickets</h3>

        <mat-card *ngIf="tickets.length === 0 && !loading">
          <mat-card-content>
            <p class="empty">No tickets submitted yet.</p>
          </mat-card-content>
        </mat-card>

        <mat-card class="ticket-card" *ngFor="let ticket of tickets">
          <mat-card-content>
            <div class="ticket-header">
              <div class="ticket-title-wrap">
                <h4>{{ ticket.subject }}</h4>
                <p class="ticket-date">{{ ticket.createdAt | date:'dd MMM yyyy' }}</p>
              </div>
              <span class="status-badge" [class]="ticket.status.toLowerCase()">
                {{ ticket.status }}
              </span>
            </div>

            <p class="ticket-message">{{ ticket.message }}</p>

            <div class="admin-reply" *ngIf="ticket.adminReply">
              <div class="reply-header">
                <mat-icon>support_agent</mat-icon>
                <span>Admin Reply</span>
                <span class="reply-date">
                  {{ ticket.respondedAt | date:'dd MMM yyyy' }}
                </span>
              </div>
              <p class="reply-text">{{ ticket.adminReply }}</p>
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
      padding: 8px 16px;
      background: linear-gradient(135deg, #3f51b5 0%, #5c6bc0 100%);
      color: white;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    }
    .title { font-size: 18px; font-weight: 500; margin-left: 8px; flex: 1; }
    .content { padding: 24px; max-width: 600px; margin: 0 auto; }

    .submit-card { margin-bottom: 24px; padding: 8px; }
    .card-header {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 24px;
    }
    .card-icon {
      font-size: 40px;
      width: 40px;
      height: 40px;
      color: #3f51b5;
    }
    .card-header h3 { margin: 0; font-size: 18px; }
    .card-sub { margin: 4px 0 0; color: #666; font-size: 13px; }

    .full-width { width: 100%; margin-bottom: 16px; }
    .submit-btn {
      height: 48px;
      font-size: 15px !important;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .section-heading { margin: 0 0 12px; font-size: 16px; font-weight: 600; color: #333; }

    .ticket-card { margin-bottom: 12px; }
    .ticket-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 12px;
    }
    .ticket-title-wrap h4 { margin: 0; font-size: 15px; }
    .ticket-date { margin: 4px 0 0; font-size: 12px; color: #999; }

    .status-badge {
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
      white-space: nowrap;
    }
    .status-badge.open       { background: #e3f2fd; color: #1565c0; }
    .status-badge.responded  { background: #e8f5e9; color: #2e7d32; }
    .status-badge.closed     { background: #f5f5f5; color: #666; }

    .ticket-message { color: #555; font-size: 14px; margin-bottom: 12px; }

    .admin-reply {
      background: #f8f9ff;
      border-left: 3px solid #3f51b5;
      border-radius: 0 8px 8px 0;
      padding: 12px;
    }
    .reply-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
      font-weight: 600;
      font-size: 13px;
      color: #3f51b5;
    }
    .reply-header mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .reply-date { margin-left: auto; font-weight: 400; color: #999; font-size: 12px; }
    .reply-text { margin: 0; font-size: 14px; color: #333; }

    .empty { text-align: center; color: #999; padding: 32px; }
  `]
})
export class SupportComponent implements OnInit {
  subject = '';
  message = '';
  submitting = false;
  loading = true;
  tickets: any[] = [];

  constructor(private api: ApiService,
    private snackBar: MatSnackBar) { }

  ngOnInit(): void {
    this.loadTickets();
  }

  loadTickets(): void {
    this.api.get<any>('/api/admin/tickets/my').subscribe({
      next: (res) => {
        if (res.success) this.tickets = res.data;
        this.loading = false;
      },
      error: () => {
        this.snackBar.open('Failed to load tickets', 'Close', { duration: 3000 });
        this.loading = false;
      }
    });
  }

  submitTicket(): void {
    if (!this.subject || !this.message) {
      this.snackBar.open('Please fill in all fields', 'Close', { duration: 3000 });
      return;
    }

    this.submitting = true;
    this.api.post<any>('/api/admin/tickets/submit', {
      subject: this.subject,
      message: this.message
    }).subscribe({
      next: (res) => {
        if (res.success) {
          this.snackBar.open('Ticket submitted!', 'Close', { duration: 3000 });
          this.subject = '';
          this.message = '';
          this.loadTickets();
        } else {
          this.snackBar.open(res.message, 'Close', { duration: 3000 });
        }
        this.submitting = false;
      },
      error: () => {
        this.snackBar.open('Failed to submit ticket.', 'Close', { duration: 3000 });
        this.submitting = false;
      }
    });
  }
}
