import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ApiService } from '../../../core/services/api';

@Component({
  selector: 'app-transfer',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterLink,
    MatCardModule, MatInputModule,
    MatButtonModule, MatIconModule, MatSnackBarModule
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
        <span class="title">Transfer Money</span>
      </div>

      <div class="content">

        <!-- Receiver Section -->
        <div class="section-card">
          <p class="section-label">
            <mat-icon>person_search</mat-icon>
            Find Receiver
          </p>

          <div class="email-input-wrap" [class.active]="receiverName"
               [class.error]="receiverError">
            <mat-icon class="input-icon">alternate_email</mat-icon>
            <input type="email"
                   [(ngModel)]="receiverEmail"
                   placeholder="Enter receiver's email"
                   (blur)="lookupReceiver()"/>
            <div class="lookup-status" *ngIf="lookingUp">
              <div class="mini-spinner"></div>
            </div>
            <mat-icon class="status-icon success" *ngIf="receiverName">
              check_circle
            </mat-icon>
            <mat-icon class="status-icon error" *ngIf="receiverError && !lookingUp">
              error
            </mat-icon>
          </div>

          <!-- Receiver Found -->
          <div class="receiver-found" *ngIf="receiverName">
            <div class="receiver-avatar">{{ getInitials(receiverName) }}</div>
            <div class="receiver-info">
              <p class="receiver-name">{{ receiverName }}</p>
              <p class="receiver-email">{{ receiverEmail }}</p>
            </div>
            <mat-icon class="verified-icon">verified</mat-icon>
          </div>

          <!-- Error -->
          <div class="error-msg" *ngIf="receiverError && !lookingUp">
            <mat-icon>info</mat-icon>
            {{ receiverError }}
          </div>
        </div>

        <!-- Amount Section -->
        <div class="section-card" *ngIf="receiverName">
          <p class="section-label">
            <mat-icon>currency_rupee</mat-icon>
            Enter Amount
          </p>

          <div class="amount-display">
            <span class="currency-symbol">₹</span>
            <input class="amount-input"
                   type="number"
                   [(ngModel)]="amount"
                   placeholder="0"/>
          </div>

          <div class="quick-amounts">
            <button *ngFor="let amt of quickAmounts"
                    class="quick-btn"
                    [class.selected]="amount === amt"
                    (click)="amount = amt">
              ₹{{ amt | number }}
            </button>
          </div>

          <div class="note-wrap">
            <mat-icon>edit_note</mat-icon>
            <input type="text"
                   [(ngModel)]="note"
                   placeholder="Add a note (optional)"/>
          </div>
        </div>

        <!-- Transfer Summary -->
        <div class="summary-card" *ngIf="receiverName && amount > 0">
          <div class="summary-row">
            <span>Sending to</span>
            <span class="summary-val">{{ receiverName }}</span>
          </div>
          <div class="summary-row">
            <span>Amount</span>
            <span class="summary-val amount">₹{{ amount | number:'1.2-2' }}</span>
          </div>
          <div class="summary-row" *ngIf="note">
            <span>Note</span>
            <span class="summary-val">{{ note }}</span>
          </div>
        </div>

        <!-- Send Button -->
        <button class="send-btn"
                *ngIf="receiverName"
                (click)="transfer()"
                [disabled]="loading || !amount || amount <= 0">
          <mat-icon>send</mat-icon>
          Send ₹{{ amount > 0 ? (amount | number:'1.0-0') : '0' }}
        </button>

      </div>
    </div>
  `,
  styles: [`
    .page-container { min-height: 100vh; background: #f0f2f5; }

    .navbar {
      display: flex;
      align-items: center;
      padding: 8px 16px;
      background: linear-gradient(135deg, #3f51b5 0%, #5c35d4 100%);
      color: white;
      box-shadow: 0 4px 20px rgba(63,81,181,0.3);
      position: sticky;
      top: 0;
      z-index: 100;
    }

    .title {
      font-size: 17px;
      font-weight: 700;
      margin-left: 8px;
      flex: 1;
    }

    .content {
      padding: 20px 16px;
      max-width: 500px;
      margin: 0 auto;
    }

    /* ── Section Card ── */
    .section-card {
      background: white;
      border-radius: 20px;
      padding: 20px;
      margin-bottom: 16px;
      box-shadow: 0 2px 20px rgba(0,0,0,0.06);
      border: 1px solid rgba(0,0,0,0.04);
    }

    .section-label {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      font-weight: 700;
      color: #666;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 16px;
    }

    .section-label mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: #7c4dff;
    }

    /* ── Email Input ── */
    .email-input-wrap {
      display: flex;
      align-items: center;
      gap: 12px;
      border: 2px solid #e8e8f0;
      border-radius: 14px;
      padding: 14px 16px;
      transition: all 0.2s ease;
      background: #fafafa;
      margin-bottom: 12px;
    }

    .email-input-wrap.active {
      border-color: #00c853;
      background: #f0fff4;
    }

    .email-input-wrap.error {
      border-color: #ff5252;
      background: #fff5f5;
    }

    .input-icon {
      color: #aaa;
      font-size: 20px;
      width: 20px;
      height: 20px;
      flex-shrink: 0;
    }

    .email-input-wrap input {
      flex: 1;
      border: none;
      outline: none;
      font-size: 15px;
      color: #1a1a2e;
      background: transparent;
      font-family: 'Inter', sans-serif;
    }

    .email-input-wrap input::placeholder { color: #bbb; }

    .status-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
      flex-shrink: 0;
    }

    .status-icon.success { color: #00c853; }
    .status-icon.error   { color: #ff5252; }

    .mini-spinner {
      width: 18px; height: 18px;
      border: 2px solid #e0e0e0;
      border-top-color: #7c4dff;
      border-radius: 50%;
      animation: spin 0.6s linear infinite;
      flex-shrink: 0;
    }

    @keyframes spin { to { transform: rotate(360deg); } }

    /* ── Receiver Found ── */
    .receiver-found {
      display: flex;
      align-items: center;
      gap: 12px;
      background: linear-gradient(135deg, #f0fff4, #e8f5e9);
      border: 1px solid #c8e6c9;
      border-radius: 12px;
      padding: 12px 16px;
      animation: slideIn 0.3s ease;
    }

    @keyframes slideIn {
      from { opacity: 0; transform: translateY(-8px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    .receiver-avatar {
      width: 40px; height: 40px;
      border-radius: 50%;
      background: linear-gradient(135deg, #00c853, #69f0ae);
      color: white;
      font-size: 16px;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .receiver-info { flex: 1; }
    .receiver-name  { margin: 0; font-weight: 700; font-size: 14px; color: #1a1a2e; }
    .receiver-email { margin: 2px 0 0; font-size: 12px; color: #666; }

    .verified-icon { color: #00c853; font-size: 20px; width: 20px; height: 20px; }

    .error-msg {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #ff5252;
      font-size: 13px;
      font-weight: 500;
      padding: 8px 0;
    }

    .error-msg mat-icon { font-size: 16px; width: 16px; height: 16px; }

    /* ── Amount ── */
    .amount-display {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      padding: 16px 0;
      border-bottom: 2px solid #f0f0f0;
      margin-bottom: 16px;
    }

    .currency-symbol {
      font-size: 32px;
      font-weight: 700;
      color: #7c4dff;
    }

    .amount-input {
      border: none;
      outline: none;
      font-size: 52px;
      font-weight: 800;
      color: #1a1a2e;
      background: transparent;
      width: 200px;
      text-align: center;
      font-family: 'Inter', sans-serif;
      -moz-appearance: textfield;
    }

    .amount-input::-webkit-outer-spin-button,
    .amount-input::-webkit-inner-spin-button { -webkit-appearance: none; }

    .quick-amounts {
      display: flex;
      gap: 8px;
      margin-bottom: 16px;
      flex-wrap: wrap;
    }

    .quick-btn {
      padding: 6px 14px;
      border: 2px solid #e8e8f0;
      border-radius: 20px;
      background: transparent;
      color: #555;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      font-family: 'Inter', sans-serif;
    }

    .quick-btn:hover {
      border-color: #7c4dff;
      color: #7c4dff;
    }

    .quick-btn.selected {
      background: #7c4dff;
      border-color: #7c4dff;
      color: white;
    }

    .note-wrap {
      display: flex;
      align-items: center;
      gap: 10px;
      border: 2px solid #e8e8f0;
      border-radius: 12px;
      padding: 12px 14px;
      background: #fafafa;
    }

    .note-wrap mat-icon { color: #aaa; font-size: 20px; width: 20px; height: 20px; }

    .note-wrap input {
      flex: 1;
      border: none;
      outline: none;
      font-size: 14px;
      color: #1a1a2e;
      background: transparent;
      font-family: 'Inter', sans-serif;
    }

    .note-wrap input::placeholder { color: #bbb; }

    /* ── Summary ── */
    .summary-card {
      background: white;
      border-radius: 20px;
      padding: 20px;
      margin-bottom: 16px;
      box-shadow: 0 2px 20px rgba(0,0,0,0.06);
      border: 1px solid rgba(0,0,0,0.04);
    }

    .summary-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 0;
      border-bottom: 1px solid #f5f5f5;
      font-size: 14px;
      color: #666;
    }

    .summary-row:last-child { border-bottom: none; }

    .summary-val {
      font-weight: 600;
      color: #1a1a2e;
    }

    .summary-val.amount {
      font-size: 18px;
      font-weight: 800;
      color: #7c4dff;
    }

    /* ── Send Button ── */
    .send-btn {
      width: 100%;
      height: 56px;
      background: linear-gradient(135deg, #3f51b5, #7c4dff);
      color: white;
      border: none;
      border-radius: 16px;
      font-size: 17px;
      font-weight: 700;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      transition: all 0.3s ease;
      font-family: 'Inter', sans-serif;
      box-shadow: 0 4px 20px rgba(124,77,255,0.3);
      margin-bottom: 24px;
    }

    .send-btn:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 8px 28px rgba(124,77,255,0.45);
    }

    .send-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      transform: none;
    }

    .send-btn mat-icon { font-size: 22px; width: 22px; height: 22px; }

    /* ── Dark Mode ── */
    :host-context(body.dark) .section-card,
    :host-context(body.dark) .summary-card {
      background: #13131f;
      border-color: rgba(255,255,255,0.06);
    }

    :host-context(body.dark) .email-input-wrap {
      border-color: #333355;
      background: #1a1a2e;
    }

    :host-context(body.dark) .email-input-wrap input,
    :host-context(body.dark) .amount-input,
    :host-context(body.dark) .note-wrap input {
      color: #e8e8f0;
    }

    :host-context(body.dark) .note-wrap {
      border-color: #333355;
      background: #1a1a2e;
    }

    :host-context(body.dark) .amount-display {
      border-bottom-color: #1e1e30;
    }

    :host-context(body.dark) .quick-btn {
      border-color: #333355;
      color: #b0b0cc;
    }

    :host-context(body.dark) .summary-row {
      border-bottom-color: #1e1e30;
      color: #8888aa;
    }

    :host-context(body.dark) .summary-val {
      color: #e8e8f0;
    }

    :host-context(body.dark) .receiver-name {
      color: #e8e8f0;
    }

    :host-context(body.dark) .section-label {
      color: #555577;
    }
  `]
})
export class TransferComponent {
  receiverEmail = '';
  receiverUserId = '';
  receiverName = '';
  receiverError = '';
  lookingUp = false;
  amount = 0;
  note = '';
  loading = false;
  quickAmounts = [500, 1000, 2000, 5000];

  constructor(private api: ApiService, private router: Router,
    private snackBar: MatSnackBar) { }

  lookupReceiver(): void {
    if (!this.receiverEmail) return;

    this.receiverName = '';
    this.receiverError = '';
    this.receiverUserId = '';
    this.lookingUp = true;

    this.api.get<any>(`/api/wallet/by-email?email=${this.receiverEmail}`)
      .subscribe({
        next: (res) => {
          if (res.success) {
            this.receiverUserId = res.data.userId;
            this.api.get<any>(
              `/api/auth/internal/user-by-email?email=${this.receiverEmail}`)
              .subscribe({
                next: (authRes) => {
                  if (authRes.success) {
                    this.receiverName = authRes.data.fullName;
                  }
                  this.lookingUp = false;
                },
                error: () => {
                  this.receiverName = this.receiverEmail;
                  this.lookingUp = false;
                }
              });
          } else {
            this.receiverError = 'User not found or wallet not activated.';
            this.lookingUp = false;
          }
        },
        error: () => {
          this.receiverError = 'User not found or wallet not activated.';
          this.lookingUp = false;
        }
      });
  }

  getInitials(name: string): string {
    return name.split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  transfer(): void {
    if (!this.receiverUserId || !this.amount || this.amount <= 0) {
      this.snackBar.open('Please fill in all fields', 'Close', { duration: 3000 });
      return;
    }

    this.loading = true;
    this.api.post<any>('/api/wallet/transfer', {
      receiverUserId: this.receiverUserId,
      amount: this.amount,
      note: this.note
    }).subscribe({
      next: (res) => {
        if (res.success) {
          this.snackBar.open(
            `₹${this.amount} sent to ${this.receiverName}!`,
            'Close', { duration: 3000 });
          this.router.navigate(['/dashboard']);
        } else {
          this.snackBar.open(res.message, 'Close', { duration: 4000 });
        }
        this.loading = false;
      },
      error: (err) => {
        const message = err?.error?.message ?? 'Transfer failed. Try again.';
        this.snackBar.open(message, 'Close', { duration: 4000 });
        this.loading = false;
      }
    });
  }
}
