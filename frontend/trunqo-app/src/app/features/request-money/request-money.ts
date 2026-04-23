import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ApiService } from '../../core/services/api';
import { AuthService } from '../../core/services/auth';

interface PaymentRequest {
  id: string;
  fromName: string;
  fromEmail: string;
  fromUserId: string;
  amount: number;
  note: string;
  status: 'pending' | 'paid' | 'declined';
  createdAt: string;
  type: 'sent' | 'received';
}

@Component({
  selector: 'app-request-money',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, MatIconModule, MatSnackBarModule],
  template: `
    <div class="spinner-overlay" *ngIf="loading">
      <div class="spinner"></div>
    </div>

    <div class="page-container fade-in">
      <div class="navbar">
        <button mat-icon-button routerLink="/dashboard" class="back-btn">
          <mat-icon>arrow_back</mat-icon>
        </button>
        <span class="title">Request Money</span>
      </div>

      <div class="content">

        <!-- New Request Form -->
        <div class="wa-card section-card">
          <p class="section-label">
            <mat-icon>person_search</mat-icon>
            Request From
          </p>

          <div class="email-input-wrap" [class.active]="requestFromName"
               [class.error]="lookupError">
            <mat-icon class="input-icon">alternate_email</mat-icon>
            <input type="email"
                   [(ngModel)]="requestFromEmail"
                   placeholder="Enter their email"
                   (blur)="lookupUser()"/>
            <div class="mini-spinner" *ngIf="lookingUp"></div>
            <mat-icon class="status-icon success" *ngIf="requestFromName">check_circle</mat-icon>
            <mat-icon class="status-icon error" *ngIf="lookupError && !lookingUp">error</mat-icon>
          </div>

          <div class="user-found fade-in" *ngIf="requestFromName">
            <div class="user-avatar">{{ getInitials(requestFromName) }}</div>
            <div class="user-info">
              <p class="user-name">{{ requestFromName }}</p>
              <p class="user-email">{{ requestFromEmail }}</p>
            </div>
            <mat-icon class="verified-icon">verified</mat-icon>
          </div>

          <div class="error-msg fade-in" *ngIf="lookupError && !lookingUp">
            <mat-icon>info</mat-icon>
            {{ lookupError }}
          </div>
        </div>

        <!-- Amount -->
        <div class="wa-card section-card fade-in" *ngIf="requestFromName">
          <p class="section-label">
            <mat-icon>currency_rupee</mat-icon>
            Amount to Request
          </p>

          <div class="amount-display">
            <span class="currency-symbol">&#8377;</span>
            <input class="amount-input"
                   type="number"
                   [(ngModel)]="requestAmount"
                   placeholder="0"/>
          </div>

          <div class="quick-amounts">
            <button *ngFor="let amt of quickAmounts"
                    class="quick-btn"
                    [class.selected]="requestAmount === amt"
                    (click)="requestAmount = amt">
              &#8377;{{ amt | number }}
            </button>
          </div>

          <div class="note-wrap">
            <mat-icon>edit_note</mat-icon>
            <input type="text"
                   [(ngModel)]="requestNote"
                   placeholder="What's it for? (optional)"/>
          </div>
        </div>

        <!-- Send Request Button -->
        <button class="wa-btn-primary request-btn fade-in"
                *ngIf="requestFromName"
                (click)="sendRequest()"
                [disabled]="sending || !requestAmount || requestAmount <= 0">
          <mat-icon>send</mat-icon>
          Request &#8377;{{ requestAmount > 0 ? (requestAmount | number:'1.0-0') : '0' }}
        </button>

        <!-- Tabs -->
        <div class="tabs">
          <button class="tab-btn" [class.active]="activeTab === 'received'"
                  (click)="activeTab = 'received'">
            Received ({{ receivedRequests.length }})
          </button>
          <button class="tab-btn" [class.active]="activeTab === 'sent'"
                  (click)="activeTab = 'sent'">
            Sent ({{ sentRequests.length }})
          </button>
        </div>

        <!-- Received Requests -->
        <div *ngIf="activeTab === 'received'">
          <div class="empty-state" *ngIf="receivedRequests.length === 0">
            <mat-icon>inbox</mat-icon>
            <p>No payment requests received</p>
          </div>

          <div class="request-card fade-in" *ngFor="let req of receivedRequests">
            <div class="request-header">
              <div class="req-avatar">{{ getInitials(req.fromName) }}</div>
              <div class="req-info">
                <p class="req-name">{{ req.fromName }}</p>
                <p class="req-note">{{ req.note || 'No note' }}</p>
                <p class="req-date">{{ req.createdAt | date:'dd MMM, hh:mm a' }}</p>
              </div>
              <div class="req-amount">&#8377;{{ req.amount | number:'1.0-0' }}</div>
            </div>

            <div class="req-actions" *ngIf="req.status === 'pending'">
              <button class="pay-btn" (click)="payRequest(req)">
                <mat-icon>check</mat-icon> Pay Now
              </button>
              <button class="decline-btn" (click)="declineRequest(req)">
                <mat-icon>close</mat-icon> Decline
              </button>
            </div>

            <div class="req-status" *ngIf="req.status !== 'pending'"
                 [class]="req.status">
              <mat-icon>{{ req.status === 'paid' ? 'check_circle' : 'cancel' }}</mat-icon>
              {{ req.status === 'paid' ? 'Paid' : 'Declined' }}
            </div>
          </div>
        </div>

        <!-- Sent Requests -->
        <div *ngIf="activeTab === 'sent'">
          <div class="empty-state" *ngIf="sentRequests.length === 0">
            <mat-icon>outbox</mat-icon>
            <p>No payment requests sent</p>
          </div>

          <div class="request-card fade-in" *ngFor="let req of sentRequests">
            <div class="request-header">
              <div class="req-avatar sent">{{ getInitials(req.fromName) }}</div>
              <div class="req-info">
                <p class="req-name">Requested from {{ req.fromName }}</p>
                <p class="req-note">{{ req.note || 'No note' }}</p>
                <p class="req-date">{{ req.createdAt | date:'dd MMM, hh:mm a' }}</p>
              </div>
              <div class="req-amount">&#8377;{{ req.amount | number:'1.0-0' }}</div>
            </div>

            <div class="req-status" [class]="req.status">
              <mat-icon>
                {{ req.status === 'pending' ? 'hourglass_empty' :
                   req.status === 'paid'    ? 'check_circle' : 'cancel' }}
              </mat-icon>
              {{ req.status === 'pending' ? 'Awaiting payment' :
                 req.status === 'paid'    ? 'Paid' : 'Declined' }}
            </div>
          </div>
        </div>

      </div>
    </div>
  `,
  styles: [`
    .page-container { min-height: 100vh; background: var(--bg); padding-bottom: 40px;}

    .navbar {
      display: flex;
      align-items: center;
      padding: 16px 20px;
      margin: 20px auto 24px;
      max-width: 600px;
      background: var(--bg-card);
      border-radius: var(--r-xl);
      border: 1px solid var(--border);
      box-shadow: var(--shadow-sm);
    }

    .back-btn { 
      background: var(--space-800); border: 1px solid var(--border); border-radius: 50%;
      width: 40px; height: 40px; display: flex; align-items: center; justify-content: center;
      cursor: pointer; color: var(--text-primary); transition: all 0.2s;
    }
    .back-btn:hover { background: var(--teal-dim); color: var(--teal); border-color: var(--teal-light);}

    .title { font-size: 18px; font-weight: 700; margin-left: 16px; flex: 1; font-family: 'Outfit', sans-serif;}
    
    .content { padding: 0 16px; max-width: 600px; margin: 0 auto; }

    .section-card { margin-bottom: 24px; padding: 24px; }

    .section-label {
      display: flex; align-items: center; gap: 8px;
      font-size: 13px; font-weight: 700; color: var(--text-secondary);
      text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 16px;
    }
    .section-label mat-icon { font-size: 20px; width: 20px; height: 20px; color: var(--teal); }

    .email-input-wrap {
      display: flex; align-items: center; gap: 12px;
      border: 2px solid var(--border); border-radius: 12px;
      padding: 14px 16px; transition: all 0.2s ease;
      background: var(--bg); margin-bottom: 12px;
    }
    .email-input-wrap.active { border-color: var(--success); background: rgba(45, 138, 86, 0.05); }
    .email-input-wrap.error  { border-color: var(--danger); background: rgba(217, 72, 72, 0.05); }
    .email-input-wrap:focus-within:not(.active):not(.error) { border-color: var(--teal); box-shadow: 0 0 0 3px rgba(192,133,82,0.1);}

    .input-icon { color: var(--text-muted); font-size: 20px; width: 20px; height: 20px; flex-shrink: 0; }
    .email-input-wrap input {
      flex: 1; border: none; outline: none;
      font-size: 15px; color: var(--text-primary); font-weight: 500;
      background: transparent; font-family: 'Inter', sans-serif;
    }
    .email-input-wrap input::placeholder { color: var(--text-muted); font-weight: 400;}

    .status-icon { font-size: 20px; width: 20px; height: 20px; flex-shrink: 0; }
    .status-icon.success { color: var(--success); }
    .status-icon.error   { color: var(--danger); }

    .user-found {
      display: flex; align-items: center; gap: 12px;
      background: rgba(45, 138, 86, 0.05);
      border: 1px solid rgba(45, 138, 86, 0.2); border-radius: 12px;
      padding: 16px;
    }

    .user-avatar {
      width: 44px; height: 44px; border-radius: 50%;
      background: var(--teal); color: white; font-size: 16px; font-weight: 700;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
      font-family: 'Outfit', sans-serif;
    }

    .user-info { flex: 1; }
    .user-name  { margin: 0; font-weight: 700; font-size: 15px; color: var(--text-primary); }
    .user-email { margin: 2px 0 0; font-size: 13px; color: var(--text-secondary); }
    .verified-icon { color: var(--success); font-size: 20px; width: 20px; height: 20px; }

    .error-msg {
      display: flex; align-items: center; gap: 8px; margin-top: 8px;
      color: var(--danger); font-size: 13px; font-weight: 500; padding: 4px 0;
    }
    .error-msg mat-icon { font-size: 18px; width: 18px; height: 18px; }

    .amount-display {
      display: flex; align-items: center; justify-content: center; gap: 6px;
      padding: 16px 0; border-bottom: 2px dashed var(--space-600); margin-bottom: 24px;
    }

    .currency-symbol { font-size: 32px; font-weight: 700; color: var(--text-primary); font-family: 'Outfit', sans-serif;}

    .amount-input {
      border: none; outline: none;
      font-size: 56px; font-weight: 800; color: var(--text-primary);
      background: transparent; width: 220px; text-align: center;
      font-family: 'Outfit', sans-serif; -moz-appearance: textfield; letter-spacing:-1px;
    }
    .amount-input::-webkit-outer-spin-button,
    .amount-input::-webkit-inner-spin-button { -webkit-appearance: none; }

    .quick-amounts { display: flex; gap: 10px; margin-bottom: 24px; flex-wrap: wrap; justify-content: center;}

    .quick-btn {
      padding: 8px 16px; border: 1px solid var(--border); border-radius: 20px;
      background: var(--space-800); color: var(--text-secondary); font-size: 14px; font-weight: 600;
      cursor: pointer; transition: all 0.2s ease; font-family: 'Inter', sans-serif;
    }
    .quick-btn:hover  { border-color: var(--teal); color: var(--teal); background: var(--teal-dim);}
    .quick-btn.selected { background: var(--teal); border-color: var(--teal); color: white; box-shadow: var(--shadow-teal);}

    .note-wrap {
      display: flex; align-items: center; gap: 12px;
      border: 1px solid var(--border); border-radius: 12px;
      padding: 14px 16px; background: var(--space-800); transition: all 0.2s;
    }
    .note-wrap:focus-within { border-color: var(--teal); background: var(--bg-card); box-shadow: 0 0 0 3px rgba(192,133,82,0.1); }
    .note-wrap mat-icon { color: var(--text-muted); font-size: 20px; width: 20px; height: 20px; }
    .note-wrap input {
      flex: 1; border: none; outline: none;
      font-size: 14px; color: var(--text-primary); font-weight: 500;
      background: transparent; font-family: 'Inter', sans-serif;
    }
    .note-wrap input::placeholder { color: var(--text-muted); font-weight:400;}

    .request-btn { margin-bottom: 32px; font-size: 16px;}

    /* Tabs */
    .tabs {
      display: flex; gap: 6px;
      background: var(--space-800); border-radius: 12px; padding: 6px;
      margin-bottom: 24px; border: 1px solid var(--border);
    }

    .tab-btn {
      flex: 1; padding: 12px; border: none; border-radius: 8px;
      background: transparent; color: var(--text-secondary); font-size: 14px; font-weight: 600;
      cursor: pointer; transition: all 0.2s ease; font-family: 'Inter', sans-serif;
    }
    .tab-btn.active { background: var(--bg-card); color: var(--teal); box-shadow: 0 2px 8px rgba(75,46,43,0.05); }

    /* Request Cards */
    .request-card {
      background: var(--bg-card); border-radius: var(--r-md); padding: 20px;
      margin-bottom: 16px; box-shadow: var(--shadow-sm);
      border: 1px solid var(--border); transition: all 0.2s;
    }
    .request-card:hover { transform: translateY(-2px); box-shadow: var(--shadow-md); border-color: var(--teal-dim);}

    .request-header { display: flex; align-items: center; gap: 14px; margin-bottom: 16px; }

    .req-avatar {
      width: 48px; height: 48px; border-radius: 14px;
      background: var(--teal); color: white; font-size: 16px; font-weight: 700;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
      font-family: 'Outfit', sans-serif;
    }
    .req-avatar.sent { background: var(--secondary); }

    .req-info { flex: 1; }
    .req-name  { margin: 0; font-size: 15px; font-weight: 700; color: var(--text-primary); }
    .req-note  { margin: 4px 0; font-size: 13px; color: var(--text-secondary); font-style: italic; }
    .req-date  { margin: 0; font-size: 12px; color: var(--text-muted); font-weight: 500;}

    .req-amount { font-size: 20px; font-weight: 800; color: var(--text-primary); font-family: 'Outfit', sans-serif; }

    .req-actions { display: flex; gap: 10px; }

    .pay-btn {
      flex: 1; height: 44px;
      background: var(--success);
      color: white; border: none; border-radius: 10px;
      font-size: 14px; font-weight: 700; cursor: pointer;
      display: flex; align-items: center; justify-content: center; gap: 8px;
      font-family: 'Inter', sans-serif; transition: all 0.2s ease;
    }
    .pay-btn:hover { background: #247547; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(45,138,86,0.3); }
    .pay-btn mat-icon { font-size: 18px; width: 18px; height: 18px; }

    .decline-btn {
      flex: 1; height: 44px;
      background: rgba(217, 72, 72, 0.1); color: var(--danger);
      border: none; border-radius: 10px;
      font-size: 14px; font-weight: 700; cursor: pointer;
      display: flex; align-items: center; justify-content: center; gap: 8px;
      font-family: 'Inter', sans-serif; transition: all 0.2s ease;
    }
    .decline-btn:hover { background: rgba(217, 72, 72, 0.15); }
    .decline-btn mat-icon { font-size: 18px; width: 18px; height: 18px; }

    .req-status {
      display: flex; align-items: center; gap: 8px;
      font-size: 14px; font-weight: 600; padding: 10px 14px;
      border-radius: 10px;
    }
    .req-status mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .req-status.paid     { background: rgba(45, 138, 86, 0.1); color: var(--success); }
    .req-status.declined { background: rgba(217, 72, 72, 0.1); color: var(--danger); }
    .req-status.pending  { background: rgba(229, 139, 36, 0.1); color: var(--warning); }
  `]
})
export class RequestMoneyComponent implements OnInit {
  requestFromEmail = '';
  requestFromName = '';
  requestFromId = '';
  lookupError = '';
  lookingUp = false;
  requestAmount = 0;
  requestNote = '';
  sending = false;
  loading = false;
  activeTab: 'received' | 'sent' = 'received';
  quickAmounts = [100, 500, 1000, 2000];

  receivedRequests: PaymentRequest[] = [];
  sentRequests: PaymentRequest[] = [];

  private currentUserId = '';
  private currentUserName = '';

  constructor(
    private api: ApiService,
    private auth: AuthService,
    private snackBar: MatSnackBar
  ) { }

  ngOnInit(): void {
    this.currentUserId = this.auth.getUserId();
    this.currentUserName = this.auth.getName();
    this.loadRequests();
  }

  loadRequests(): void {
    const all: PaymentRequest[] = this.getStoredRequests();
    this.receivedRequests = all.filter(r => r.type === 'received');
    this.sentRequests = all.filter(r => r.type === 'sent');
  }

  lookupUser(): void {
    if (!this.requestFromEmail) return;

    this.requestFromName = '';
    this.lookupError = '';
    this.requestFromId = '';
    this.lookingUp = true;

    this.api.get<any>(
      '/api/auth/internal/user-by-email?email=' + this.requestFromEmail)
      .subscribe({
        next: (res) => {
          if (res.success) {
            this.requestFromName = res.data.fullName;
            this.requestFromId = res.data.userId;
          } else {
            this.lookupError = 'User not found.';
          }
          this.lookingUp = false;
        },
        error: () => {
          this.lookupError = 'User not found.';
          this.lookingUp = false;
        }
      });
  }

  sendRequest(): void {
    if (!this.requestFromId || !this.requestAmount || this.requestAmount <= 0) {
      this.snackBar.open('Please fill in all fields', 'Close', { duration: 3000 });
      return;
    }

    this.sending = true;

    const newRequest: PaymentRequest = {
      id: crypto.randomUUID(),
      fromName: this.requestFromName,
      fromEmail: this.requestFromEmail,
      fromUserId: this.requestFromId,
      amount: this.requestAmount,
      note: this.requestNote,
      status: 'pending',
      createdAt: new Date().toISOString(),
      type: 'sent'
    };

    this.saveRequest(newRequest);
    this.api.post<any>('/api/notifications/request-money', {
      recipientUserId: this.requestFromId,
      amount: this.requestAmount,
      note: this.requestNote
    }).subscribe({
      error: () => {
        this.snackBar.open(
          'Money request saved, but the email notification could not be sent.',
          'Close',
          { duration: 4000 }
        );
      }
    });

    const receivedCopy: PaymentRequest = {
      ...newRequest,
      id: crypto.randomUUID(),
      fromName: this.currentUserName,
      fromUserId: this.currentUserId,
      type: 'received'
    };
    this.saveReceivedRequest(receivedCopy, this.requestFromId);

    this.snackBar.open(
      'Payment request of ₹' + this.requestAmount + ' sent to ' + this.requestFromName + '!',
      'Close', { duration: 3000 });

    this.requestFromEmail = '';
    this.requestFromName = '';
    this.requestFromId = '';
    this.requestAmount = 0;
    this.requestNote = '';
    this.sending = false;

    this.loadRequests();
    this.activeTab = 'sent';
  }

  payRequest(req: PaymentRequest): void {
    this.api.post<any>('/api/wallet/transfer', {
      receiverUserId: req.fromUserId,
      amount: req.amount,
      note: `Payment for: ${req.note || 'request'}`
    }).subscribe({
      next: (res) => {
        if (res.success) {
          req.status = 'paid';
          this.updateRequest(req);
          this.snackBar.open(`Paid request for ${req.amount}`, 'Close', { duration: 3000 });
        } else {
          this.snackBar.open(res.message, 'Close', { duration: 3000 });
        }
      },
      error: (err) => {
        const message = err?.error?.message ?? 'Payment failed. Try again.';
        this.snackBar.open(message, 'Close', { duration: 3000 });
      }
    });
  }

  declineRequest(req: PaymentRequest): void {
    req.status = 'declined';
    this.updateRequest(req);
    this.snackBar.open('Request declined.', 'Close', { duration: 3000 });
  }

  getInitials(name: string): string {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) ?? '?';
  }

  private getStoredRequests(): PaymentRequest[] {
    try {
      const key = 'requests_' + this.currentUserId;
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : [];
    } catch { return []; }
  }

  private saveRequest(req: PaymentRequest): void {
    try {
      const key = 'requests_' + this.currentUserId;
      const existing = this.getStoredRequests();
      existing.unshift(req);
      localStorage.setItem(key, JSON.stringify(existing.slice(0, 50)));
    } catch { }
  }

  private saveReceivedRequest(req: PaymentRequest, toUserId: string): void {
    try {
      const key = 'requests_' + toUserId;
      const existing: PaymentRequest[] = JSON.parse(
        localStorage.getItem(key) || '[]');
      existing.unshift(req);
      localStorage.setItem(key, JSON.stringify(existing.slice(0, 50)));
    } catch { }
  }

  private updateRequest(req: PaymentRequest): void {
    try {
      const key = 'requests_' + this.currentUserId;
      const all = this.getStoredRequests();
      const idx = all.findIndex(r => r.id === req.id);
      if (idx !== -1) {
        all[idx] = req;
        localStorage.setItem(key, JSON.stringify(all));
      }
      this.loadRequests();
    } catch { }
  }
}
