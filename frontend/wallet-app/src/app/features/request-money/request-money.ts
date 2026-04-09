import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
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
  imports: [
    CommonModule, FormsModule, RouterLink,
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
        <span class="title">Request Money</span>
      </div>

      <div class="content">

        <!-- New Request Form -->
        <div class="section-card">
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

          <div class="user-found" *ngIf="requestFromName">
            <div class="user-avatar">{{ getInitials(requestFromName) }}</div>
            <div class="user-info">
              <p class="user-name">{{ requestFromName }}</p>
              <p class="user-email">{{ requestFromEmail }}</p>
            </div>
            <mat-icon class="verified-icon">verified</mat-icon>
          </div>

          <div class="error-msg" *ngIf="lookupError && !lookingUp">
            <mat-icon>info</mat-icon>
            {{ lookupError }}
          </div>
        </div>

        <!-- Amount -->
        <div class="section-card" *ngIf="requestFromName">
          <p class="section-label">
            <mat-icon>currency_rupee</mat-icon>
            Amount to Request
          </p>

          <div class="amount-display">
            <span class="currency-symbol">₹</span>
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
              ₹{{ amt | number }}
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
        <button class="request-btn"
                *ngIf="requestFromName"
                (click)="sendRequest()"
                [disabled]="sending || !requestAmount || requestAmount <= 0">
          <mat-icon>send</mat-icon>
          Request ₹{{ requestAmount > 0 ? (requestAmount | number:'1.0-0') : '0' }}
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

          <div class="request-card" *ngFor="let req of receivedRequests">
            <div class="request-header">
              <div class="req-avatar">{{ getInitials(req.fromName) }}</div>
              <div class="req-info">
                <p class="req-name">{{ req.fromName }}</p>
                <p class="req-note">{{ req.note || 'No note' }}</p>
                <p class="req-date">{{ req.createdAt | date:'dd MMM, hh:mm a' }}</p>
              </div>
              <div class="req-amount">₹{{ req.amount | number:'1.0-0' }}</div>
            </div>

            <div class="req-actions" *ngIf="req.status === 'pending'">
              <button class="pay-btn" (click)="payRequest(req)">
                <mat-icon>check</mat-icon>
                Pay Now
              </button>
              <button class="decline-btn" (click)="declineRequest(req)">
                <mat-icon>close</mat-icon>
                Decline
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

          <div class="request-card" *ngFor="let req of sentRequests">
            <div class="request-header">
              <div class="req-avatar sent">{{ getInitials(req.fromName) }}</div>
              <div class="req-info">
                <p class="req-name">Requested from {{ req.fromName }}</p>
                <p class="req-note">{{ req.note || 'No note' }}</p>
                <p class="req-date">{{ req.createdAt | date:'dd MMM, hh:mm a' }}</p>
              </div>
              <div class="req-amount">₹{{ req.amount | number:'1.0-0' }}</div>
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
    .page-container { min-height: 100vh; background: #f0f2f5; }

    .navbar {
      display: flex;
      align-items: center;
      padding: 8px 16px;
      background: linear-gradient(135deg, #e91e63 0%, #ad1457 100%);
      color: white;
      box-shadow: 0 4px 20px rgba(233,30,99,0.3);
      position: sticky;
      top: 0;
      z-index: 100;
    }

    .title { font-size: 17px; font-weight: 700; margin-left: 8px; flex: 1; }
    .content { padding: 20px 16px; max-width: 500px; margin: 0 auto; }

    .section-card {
      background: white;
      border-radius: 20px;
      padding: 20px;
      margin-bottom: 16px;
      box-shadow: 0 2px 20px rgba(0,0,0,0.06);
      border: 1px solid rgba(0,0,0,0.04);
    }

    .section-label {
      display: flex; align-items: center; gap: 8px;
      font-size: 13px; font-weight: 700; color: #666;
      text-transform: uppercase; letter-spacing: 1px;
      margin-bottom: 16px;
    }

    .section-label mat-icon { font-size: 18px; width: 18px; height: 18px; color: #e91e63; }

    .email-input-wrap {
      display: flex; align-items: center; gap: 12px;
      border: 2px solid #e8e8f0; border-radius: 14px;
      padding: 14px 16px; transition: all 0.2s ease;
      background: #fafafa; margin-bottom: 12px;
    }
    .email-input-wrap.active { border-color: #00c853; background: #f0fff4; }
    .email-input-wrap.error  { border-color: #ff5252; background: #fff5f5; }

    .input-icon { color: #aaa; font-size: 20px; width: 20px; height: 20px; flex-shrink: 0; }

    .email-input-wrap input {
      flex: 1; border: none; outline: none;
      font-size: 15px; color: #1a1a2e;
      background: transparent; font-family: 'Inter', sans-serif;
    }
    .email-input-wrap input::placeholder { color: #bbb; }

    .status-icon { font-size: 20px; width: 20px; height: 20px; flex-shrink: 0; }
    .status-icon.success { color: #00c853; }
    .status-icon.error   { color: #ff5252; }

    .mini-spinner {
      width: 18px; height: 18px;
      border: 2px solid #e0e0e0;
      border-top-color: #e91e63;
      border-radius: 50%;
      animation: spin 0.6s linear infinite;
      flex-shrink: 0;
    }

    @keyframes spin { to { transform: rotate(360deg); } }

    .user-found {
      display: flex; align-items: center; gap: 12px;
      background: linear-gradient(135deg, #f0fff4, #e8f5e9);
      border: 1px solid #c8e6c9; border-radius: 12px;
      padding: 12px 16px;
      animation: slideIn 0.3s ease;
    }

    @keyframes slideIn {
      from { opacity: 0; transform: translateY(-8px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    .user-avatar {
      width: 40px; height: 40px; border-radius: 50%;
      background: linear-gradient(135deg, #e91e63, #f48fb1);
      color: white; font-size: 16px; font-weight: 700;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }

    .user-info { flex: 1; }
    .user-name  { margin: 0; font-weight: 700; font-size: 14px; color: #1a1a2e; }
    .user-email { margin: 2px 0 0; font-size: 12px; color: #666; }
    .verified-icon { color: #00c853; font-size: 20px; width: 20px; height: 20px; }

    .error-msg {
      display: flex; align-items: center; gap: 8px;
      color: #ff5252; font-size: 13px; font-weight: 500; padding: 8px 0;
    }
    .error-msg mat-icon { font-size: 16px; width: 16px; height: 16px; }

    .amount-display {
      display: flex; align-items: center; justify-content: center; gap: 4px;
      padding: 16px 0; border-bottom: 2px solid #f0f0f0; margin-bottom: 16px;
    }

    .currency-symbol { font-size: 32px; font-weight: 700; color: #e91e63; }

    .amount-input {
      border: none; outline: none;
      font-size: 52px; font-weight: 800; color: #1a1a2e;
      background: transparent; width: 200px; text-align: center;
      font-family: 'Inter', sans-serif; -moz-appearance: textfield;
    }
    .amount-input::-webkit-outer-spin-button,
    .amount-input::-webkit-inner-spin-button { -webkit-appearance: none; }

    .quick-amounts { display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap; }

    .quick-btn {
      padding: 6px 14px; border: 2px solid #e8e8f0; border-radius: 20px;
      background: transparent; color: #555; font-size: 13px; font-weight: 600;
      cursor: pointer; transition: all 0.2s ease; font-family: 'Inter', sans-serif;
    }
    .quick-btn:hover  { border-color: #e91e63; color: #e91e63; }
    .quick-btn.selected { background: #e91e63; border-color: #e91e63; color: white; }

    .note-wrap {
      display: flex; align-items: center; gap: 10px;
      border: 2px solid #e8e8f0; border-radius: 12px;
      padding: 12px 14px; background: #fafafa;
    }
    .note-wrap mat-icon { color: #aaa; font-size: 20px; width: 20px; height: 20px; }
    .note-wrap input {
      flex: 1; border: none; outline: none;
      font-size: 14px; color: #1a1a2e;
      background: transparent; font-family: 'Inter', sans-serif;
    }
    .note-wrap input::placeholder { color: #bbb; }

    .request-btn {
      width: 100%; height: 56px;
      background: linear-gradient(135deg, #e91e63, #ad1457);
      color: white; border: none; border-radius: 16px;
      font-size: 17px; font-weight: 700; cursor: pointer;
      display: flex; align-items: center; justify-content: center; gap: 10px;
      transition: all 0.3s ease; font-family: 'Inter', sans-serif;
      box-shadow: 0 4px 20px rgba(233,30,99,0.3); margin-bottom: 24px;
    }
    .request-btn:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 8px 28px rgba(233,30,99,0.45);
    }
    .request-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
    .request-btn mat-icon { font-size: 22px; width: 22px; height: 22px; }

    /* Tabs */
    .tabs {
      display: flex; gap: 4px;
      background: #e8e8f0; border-radius: 12px; padding: 4px;
      margin-bottom: 16px;
    }

    .tab-btn {
      flex: 1; padding: 10px; border: none; border-radius: 10px;
      background: transparent; color: #666; font-size: 13px; font-weight: 600;
      cursor: pointer; transition: all 0.2s ease; font-family: 'Inter', sans-serif;
    }
    .tab-btn.active { background: white; color: #e91e63; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }

    /* Request Cards */
    .empty-state {
      text-align: center; padding: 40px 20px; color: #999;
    }
    .empty-state mat-icon { font-size: 48px; width: 48px; height: 48px; margin-bottom: 12px; opacity: 0.4; }
    .empty-state p { font-size: 14px; }

    .request-card {
      background: white; border-radius: 16px; padding: 16px;
      margin-bottom: 12px; box-shadow: 0 2px 12px rgba(0,0,0,0.06);
      border: 1px solid rgba(0,0,0,0.04);
    }

    .request-header { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }

    .req-avatar {
      width: 44px; height: 44px; border-radius: 14px;
      background: linear-gradient(135deg, #e91e63, #f48fb1);
      color: white; font-size: 16px; font-weight: 700;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .req-avatar.sent { background: linear-gradient(135deg, #3f51b5, #7c4dff); }

    .req-info { flex: 1; }
    .req-name  { margin: 0; font-size: 14px; font-weight: 700; color: #1a1a2e; }
    .req-note  { margin: 2px 0; font-size: 12px; color: #666; font-style: italic; }
    .req-date  { margin: 0; font-size: 11px; color: #999; }

    .req-amount { font-size: 18px; font-weight: 800; color: #e91e63; }

    .req-actions { display: flex; gap: 8px; }

    .pay-btn {
      flex: 1; height: 40px;
      background: linear-gradient(135deg, #00c853, #69f0ae);
      color: white; border: none; border-radius: 10px;
      font-size: 13px; font-weight: 700; cursor: pointer;
      display: flex; align-items: center; justify-content: center; gap: 6px;
      font-family: 'Inter', sans-serif; transition: all 0.2s ease;
    }
    .pay-btn:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,200,83,0.3); }
    .pay-btn mat-icon { font-size: 18px; width: 18px; height: 18px; }

    .decline-btn {
      flex: 1; height: 40px;
      background: #f5f5f5; color: #f44336;
      border: none; border-radius: 10px;
      font-size: 13px; font-weight: 700; cursor: pointer;
      display: flex; align-items: center; justify-content: center; gap: 6px;
      font-family: 'Inter', sans-serif; transition: all 0.2s ease;
    }
    .decline-btn:hover { background: #ffebee; }
    .decline-btn mat-icon { font-size: 18px; width: 18px; height: 18px; }

    .req-status {
      display: flex; align-items: center; gap: 6px;
      font-size: 13px; font-weight: 600; padding: 8px 12px;
      border-radius: 8px;
    }
    .req-status mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .req-status.paid     { background: #e8f5e9; color: #2e7d32; }
    .req-status.declined { background: #ffebee; color: #c62828; }
    .req-status.pending  { background: #fff3e0; color: #e65100; }

    /* Dark Mode */
    :host-context(body.dark) .section-card,
    :host-context(body.dark) .request-card {
      background: #13131f; border-color: rgba(255,255,255,0.06);
    }
    :host-context(body.dark) .email-input-wrap {
      border-color: #333355; background: #1a1a2e;
    }
    :host-context(body.dark) .email-input-wrap input,
    :host-context(body.dark) .amount-input,
    :host-context(body.dark) .note-wrap input { color: #e8e8f0; }
    :host-context(body.dark) .note-wrap { border-color: #333355; background: #1a1a2e; }
    :host-context(body.dark) .amount-display { border-bottom-color: #1e1e30; }
    :host-context(body.dark) .quick-btn { border-color: #333355; color: #b0b0cc; }
    :host-context(body.dark) .section-label { color: #555577; }
    :host-context(body.dark) .req-name { color: #e8e8f0; }
    :host-context(body.dark) .tabs { background: #1e1e30; }
    :host-context(body.dark) .tab-btn.active { background: #13131f; }
    :host-context(body.dark) .decline-btn { background: #1e1e30; }
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
    // Load from localStorage
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
      `/api/auth/internal/user-by-email?email=${this.requestFromEmail}`)
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

    // Store the sent request locally
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

    // Also save a "received" copy for the other user's perspective
    // In a real app this would go through the backend
    const receivedCopy: PaymentRequest = {
      ...newRequest,
      id: crypto.randomUUID(),
      fromName: this.currentUserName,
      fromUserId: this.currentUserId,
      type: 'received'
    };
    this.saveReceivedRequest(receivedCopy, this.requestFromId);

    this.snackBar.open(
      `Payment request of ₹${this.requestAmount} sent to ${this.requestFromName}!`,
      'Close', { duration: 3000 });

    // Reset form
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
    // Trigger actual transfer
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
      const key = `requests_${this.currentUserId}`;
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : [];
    } catch { return []; }
  }

  private saveRequest(req: PaymentRequest): void {
    try {
      const key = `requests_${this.currentUserId}`;
      const existing = this.getStoredRequests();
      existing.unshift(req);
      localStorage.setItem(key, JSON.stringify(existing.slice(0, 50)));
    } catch { }
  }

  private saveReceivedRequest(req: PaymentRequest, toUserId: string): void {
    try {
      const key = `requests_${toUserId}`;
      const existing: PaymentRequest[] = JSON.parse(
        localStorage.getItem(key) || '[]');
      existing.unshift(req);
      localStorage.setItem(key, JSON.stringify(existing.slice(0, 50)));
    } catch { }
  }

  private updateRequest(req: PaymentRequest): void {
    try {
      const key = `requests_${this.currentUserId}`;
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

