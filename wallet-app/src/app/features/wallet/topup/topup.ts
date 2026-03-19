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
  selector: 'app-topup',
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
        <span class="title">Top Up Wallet</span>
      </div>

      <div class="content">

        <!-- Amount Section -->
        <div class="section-card">
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

        <!-- Summary -->
        <div class="summary-card" *ngIf="amount > 0">
          <div class="summary-row">
            <span>Adding to wallet</span>
            <span class="summary-val amount">₹{{ amount | number:'1.2-2' }}</span>
          </div>
          <div class="summary-row">
            <span>Payment method</span>
            <span class="summary-val">
              <mat-icon style="font-size:16px;width:16px;height:16px;vertical-align:middle">
                account_balance
              </mat-icon>
              Mock Gateway
            </span>
          </div>
          <div class="summary-row" *ngIf="note">
            <span>Note</span>
            <span class="summary-val">{{ note }}</span>
          </div>
        </div>

        <!-- Add Money Button -->
        <button class="topup-btn"
                (click)="topUp()"
                [disabled]="loading || !amount || amount <= 0">
          <mat-icon>add_circle</mat-icon>
          Add ₹{{ amount > 0 ? (amount | number:'1.0-0') : '0' }} to Wallet
        </button>

        <!-- Info Cards -->
        <div class="info-grid">
          <div class="info-item">
            <mat-icon>flash_on</mat-icon>
            <span>Instant</span>
          </div>
          <div class="info-item">
            <mat-icon>security</mat-icon>
            <span>Secure</span>
          </div>
          <div class="info-item">
            <mat-icon>stars</mat-icon>
            <span>Earn Points</span>
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
      background: linear-gradient(135deg, #00897b 0%, #00c853 100%);
      color: white;
      box-shadow: 0 4px 20px rgba(0,200,83,0.3);
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
      color: #00c853;
    }

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
      color: #00c853;
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
      padding: 6px 16px;
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
      border-color: #00c853;
      color: #00c853;
    }

    .quick-btn.selected {
      background: #00c853;
      border-color: #00c853;
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
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .summary-val.amount {
      font-size: 20px;
      font-weight: 800;
      color: #00c853;
    }

    /* ── Top Up Button ── */
    .topup-btn {
      width: 100%;
      height: 56px;
      background: linear-gradient(135deg, #00897b, #00c853);
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
      box-shadow: 0 4px 20px rgba(0,200,83,0.3);
      margin-bottom: 20px;
    }

    .topup-btn:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 8px 28px rgba(0,200,83,0.45);
    }

    .topup-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      transform: none;
    }

    .topup-btn mat-icon { font-size: 22px; width: 22px; height: 22px; }

    /* ── Info Grid ── */
    .info-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      margin-bottom: 24px;
    }

    .info-item {
      background: white;
      border-radius: 14px;
      padding: 14px 8px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      box-shadow: 0 2px 12px rgba(0,0,0,0.04);
      font-size: 12px;
      font-weight: 600;
      color: #666;
    }

    .info-item mat-icon { color: #00c853; font-size: 24px; width: 24px; height: 24px; }

    /* ── Dark Mode ── */
    :host-context(body.dark) .section-card,
    :host-context(body.dark) .summary-card,
    :host-context(body.dark) .info-item {
      background: #13131f;
      border-color: rgba(255,255,255,0.06);
    }

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

    :host-context(body.dark) .section-label {
      color: #555577;
    }

    :host-context(body.dark) .info-item {
      color: #8888aa;
    }
  `]
})
export class TopupComponent {
  amount = 0;
  note = '';
  loading = false;
  quickAmounts = [500, 1000, 2000, 5000];

  constructor(private api: ApiService, private router: Router,
    private snackBar: MatSnackBar) { }

  topUp(): void {
    if (!this.amount || this.amount <= 0) {
      this.snackBar.open('Enter a valid amount', 'Close', { duration: 3000 });
      return;
    }

    this.loading = true;
    this.api.post<any>('/api/wallet/topup', {
      amount: this.amount,
      note: this.note
    }).subscribe({
      next: (res) => {
        if (res.success) {
          this.snackBar.open(
            `₹${this.amount} added successfully!`, 'Close', { duration: 3000 });
          this.router.navigate(['/dashboard']);
        } else {
          this.snackBar.open(res.message, 'Close', { duration: 3000 });
        }
        this.loading = false;
      },
      error: (err) => {
        const message = err?.error?.message ?? 'Top up failed. Try again.';
        this.snackBar.open(message, 'Close', { duration: 3000 });
        this.loading = false;
      }
    });
  }
}
