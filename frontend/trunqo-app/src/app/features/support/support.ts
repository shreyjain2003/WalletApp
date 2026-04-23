import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ApiService } from '../../core/services/api';

@Component({
  selector: 'app-support',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatSnackBarModule],
  template: `
    <div class="spinner-overlay" *ngIf="loading"><div class="spinner"></div></div>
    
    <div class="page-container fade-in">
      <div class="page-header">
        <h1 class="page-title">Support</h1>
        <p class="page-subtitle">We're here to help with any issues.</p>
      </div>
      
      <div class="two-col">
        <!-- Submit form -->
        <div class="wa-card support-form">
          <div class="panel-head">
            <div class="head-icon"><mat-icon>support_agent</mat-icon></div>
            <div><h3>Raise a Ticket</h3><p class="head-sub">We'll respond within 24 hours</p></div>
          </div>
          
          <div class="wa-label">Subject</div>
          <div class="wa-input-wrap" [class.focused]="sf" style="margin-bottom: 20px;">
            <mat-icon>title</mat-icon>
            <input [(ngModel)]="subject" placeholder="What's your issue?" (focus)="sf=true" (blur)="sf=false"/>
          </div>
          
          <div class="wa-label">Message</div>
          <div class="textarea-wrap" [class.focused]="mf" style="margin-bottom: 24px;">
            <textarea [(ngModel)]="message" rows="5" placeholder="Describe your issue in detail..." (focus)="mf=true" (blur)="mf=false"></textarea>
          </div>
          
          <button class="wa-btn-primary full-width" (click)="submitTicket()" [disabled]="submitting">
            <mat-icon>send</mat-icon>{{ submitting ? 'Submitting...' : 'Submit Ticket' }}
          </button>
        </div>

        <!-- Tickets list -->
        <div class="tickets-panel">
          <h3 class="card-title-small" style="padding: 0 4px; margin-bottom: 16px;">My Tickets</h3>
          
          <div class="empty-state" *ngIf="tickets.length === 0 && !loading">
            <mat-icon>inbox</mat-icon><p>No tickets submitted yet.</p>
          </div>
          
          <div class="wa-card ticket-card" *ngFor="let t of tickets">
            <div class="ticket-head">
              <div>
                <h4>{{ t.subject }}</h4>
                <p class="ticket-date">{{ t.createdAt | date:'dd MMM yyyy' }}</p>
              </div>
              <span class="badge" [class]="'badge-' + statusClass(t.status)">{{ t.status }}</span>
            </div>
            <p class="ticket-msg">{{ t.message }}</p>
            <div class="admin-reply" *ngIf="t.adminReply">
              <div class="reply-head"><mat-icon>support_agent</mat-icon><span>Admin Reply</span><span class="reply-date">{{ t.respondedAt | date:'dd MMM yyyy' }}</span></div>
              <p class="reply-text">{{ t.adminReply }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .page-container { max-width: 1000px; margin: 0 auto; padding-bottom: 32px; }
    .page-header { margin-bottom: 32px; display: flex; flex-direction: column; }
    .page-title { font-size: 32px; font-weight: 800; color: var(--text-primary); font-family: 'Outfit', sans-serif; margin-bottom: 8px; letter-spacing: -1px; }
    .page-subtitle { color: var(--text-secondary); font-size: 15px; margin: 0; }

    .two-col { display: grid; grid-template-columns: 1fr 420px; gap: 24px; }
    
    .support-form { align-self: start; }
    
    .panel-head { display: flex; align-items: center; gap: 16px; margin-bottom: 24px; }
    .head-icon { width: 44px; height: 44px; border-radius: 12px; background: rgba(192, 133, 82, 0.1); border: 1px solid rgba(192, 133, 82, 0.2); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .head-icon mat-icon { color: var(--teal); font-size: 22px; width: 22px; height: 22px; }
    .panel-head h3 { margin: 0; font-size: 16px; font-weight: 700; color: var(--text-primary); }
    .head-sub { margin: 3px 0 0; font-size: 13px; color: var(--text-secondary); }
    
    .textarea-wrap { border: 1px solid var(--border); border-radius: 12px; padding: 12px 16px; background: var(--bg); transition: all 0.2s; }
    .textarea-wrap.focused { border-color: var(--teal-light); box-shadow: 0 0 0 3px rgba(192, 133, 82, 0.1); }
    .textarea-wrap textarea { width: 100%; border: none; outline: none; font-size: 14px; color: var(--text-primary); background: transparent; font-family: 'Inter', sans-serif; resize: vertical; }
    .textarea-wrap textarea::placeholder { color: var(--text-muted); }
    
    .full-width { width: 100%; display: flex; align-items: center; justify-content: center; opacity: 1; margin: 0; }
    
    .tickets-panel { display: flex; flex-direction: column; gap: 16px; align-self: start; }
    
    .empty-state { text-align: center; padding: 48px 24px; color: var(--text-muted); background: var(--bg-card); border-radius: var(--r-md); border: 1px dashed var(--border); }
    .empty-state mat-icon { font-size: 40px; width: 40px; height: 40px; margin-bottom: 12px; opacity: 0.5; }
    .empty-state p { font-size: 14px; margin: 0; }
    
    .ticket-card { margin-bottom: 0; padding: 20px; }
    .ticket-head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; gap: 12px; }
    .ticket-head h4 { margin: 0; font-size: 14px; font-weight: 700; color: var(--text-primary); line-height: 1.4; }
    .ticket-date { margin: 4px 0 0; font-size: 12px; color: var(--text-muted); }
    
    .badge { display: inline-flex; align-items: center; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; white-space: nowrap; }
    .badge-success { background: rgba(16,185,129,0.1); color: #10B981; }
    .badge-info    { background: rgba(192, 133, 82, 0.1); color: var(--teal); }
    .badge-neutral { background: var(--bg); color: var(--text-secondary); border: 1px solid var(--border); }
    
    .ticket-msg { color: var(--text-secondary); font-size: 13px; margin-bottom: 16px; line-height: 1.5; white-space: pre-wrap; }
    
    .admin-reply { background: var(--bg); border-left: 3px solid var(--teal); border-radius: 0 8px 8px 0; padding: 12px 16px; border-top: 1px solid var(--border); border-right: 1px solid var(--border); border-bottom: 1px solid var(--border); }
    .reply-head { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; font-size: 13px; font-weight: 600; color: var(--teal); }
    .reply-head mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .reply-date { margin-left: auto; font-weight: 500; color: var(--text-muted); font-size: 11px; }
    .reply-text { margin: 0; font-size: 13px; color: var(--text-primary); line-height: 1.5; white-space: pre-wrap; }
    
    @media (max-width: 900px) { .two-col { grid-template-columns: 1fr; } }
  `]
})
export class SupportComponent implements OnInit {
  subject = ''; message = ''; submitting = false; loading = true; tickets: any[] = [];
  sf = false; mf = false;
  constructor(private api: ApiService, private snackBar: MatSnackBar) {}
  ngOnInit(): void { this.loadTickets(); }
  loadTickets(): void {
    this.api.get<any>('/api/admin/tickets/my').subscribe({
      next: (res) => { if (res.success) this.tickets = res.data; this.loading = false; },
      error: () => { this.snackBar.open('Failed to load tickets', 'Close', { duration: 3000 }); this.loading = false; }
    });
  }
  submitTicket(): void {
    if (!this.subject || !this.message) { this.snackBar.open('Please fill in all fields', 'Close', { duration: 3000 }); return; }
    this.submitting = true;
    this.api.post<any>('/api/admin/tickets/submit', { subject: this.subject, message: this.message }).subscribe({
      next: (res) => { if (res.success) { this.snackBar.open('Ticket submitted!', 'Close', { duration: 3000 }); this.subject = ''; this.message = ''; this.loadTickets(); } else { this.snackBar.open(res.message, 'Close', { duration: 3000 }); } this.submitting = false; },
      error: () => { this.snackBar.open('Failed to submit ticket', 'Close', { duration: 3000 }); this.submitting = false; }
    });
  }
  statusClass(status: string): string { if (status === 'Responded') return 'success'; if (status === 'Open') return 'info'; return 'neutral'; }
}
