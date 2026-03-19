import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ApiService } from '../../../core/services/api';

@Component({
  selector: 'app-history',
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
        <span class="title">Transaction History</span>
      </div>

      <div class="content">

        <!-- Summary -->
        <div class="summary-row">
          <mat-card class="summary-card income">
            <mat-card-content>
              <mat-icon>arrow_downward</mat-icon>
              <div>
                <p class="summary-label">Total Received</p>
                <p class="summary-amount">₹{{ totalReceived | number:'1.2-2' }}</p>
              </div>
            </mat-card-content>
          </mat-card>

          <mat-card class="summary-card expense">
            <mat-card-content>
              <mat-icon>arrow_upward</mat-icon>
              <div>
                <p class="summary-label">Total Sent</p>
                <p class="summary-amount">₹{{ totalSent | number:'1.2-2' }}</p>
              </div>
            </mat-card-content>
          </mat-card>
        </div>

        <!-- Empty state -->
        <mat-card *ngIf="transactions.length === 0 && !loading">
          <mat-card-content>
            <p class="empty">No transactions yet. Make your first top-up!</p>
          </mat-card-content>
        </mat-card>

        <!-- Transaction list -->
        <mat-card class="tx-card" *ngFor="let tx of transactions">
          <mat-card-content class="tx-content">
            <div class="tx-icon-wrap" [class]="tx.type">
              <mat-icon>{{ getIcon(tx.type) }}</mat-icon>
            </div>
            <div class="tx-info">
              <p class="tx-type">{{ getLabel(tx.type) }}</p>
              <p class="tx-ref">{{ tx.reference }}</p>
              <p class="tx-date">{{ tx.createdAt | date:'dd MMM yyyy, hh:mm a' }}</p>
              <p class="tx-note" *ngIf="tx.note">{{ tx.note }}</p>
            </div>
            <div class="tx-right">
              <p class="tx-amount" [class]="tx.type">
                {{ tx.type === 'transfer_out' ? '-' : '+' }}₹{{ tx.amount | number:'1.2-2' }}
              </p>
              <p class="tx-balance">Bal: ₹{{ tx.balanceAfter | number:'1.2-2' }}</p>
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

    .summary-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-bottom: 16px;
    }
    .summary-card mat-card-content {
      display: flex !important;
      align-items: center !important;
      gap: 12px !important;
      padding: 8px !important;
    }
    .summary-card.income mat-icon { color: #4caf50; font-size: 32px; width: 32px; height: 32px; }
    .summary-card.expense mat-icon { color: #f44336; font-size: 32px; width: 32px; height: 32px; }
    .summary-label { margin: 0; font-size: 12px; color: #666; }
    .summary-amount { margin: 0; font-size: 18px; font-weight: 700; }

    .empty { text-align: center; color: #999; padding: 48px 32px; }
    .tx-card { margin-bottom: 8px; }
    .tx-content {
      display: flex !important;
      align-items: center !important;
      gap: 12px !important;
    }

    .tx-icon-wrap {
      width: 44px; height: 44px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .tx-icon-wrap mat-icon { color: white; }
    .tx-icon-wrap.topup        { background: linear-gradient(135deg, #43a047, #66bb6a); }
    .tx-icon-wrap.transfer_in  { background: linear-gradient(135deg, #1e88e5, #42a5f5); }
    .tx-icon-wrap.transfer_out { background: linear-gradient(135deg, #e53935, #ef5350); }

    .tx-info { flex: 1; }
    .tx-type { margin: 0; font-weight: 600; font-size: 14px; }
    .tx-ref  { margin: 0; font-size: 11px; color: #999; }
    .tx-date { margin: 0; font-size: 12px; color: #999; }
    .tx-note { margin: 2px 0 0; font-size: 12px; color: #666; font-style: italic; }

    .tx-right { text-align: right; }
    .tx-amount { margin: 0; font-weight: 700; font-size: 15px; }
    .tx-amount.topup        { color: #4caf50; }
    .tx-amount.transfer_in  { color: #4caf50; }
    .tx-amount.transfer_out { color: #f44336; }
    .tx-balance { margin: 0; font-size: 11px; color: #999; }
  `]
})
export class HistoryComponent implements OnInit {
  transactions: any[] = [];
  loading = true;
  totalReceived = 0;
  totalSent = 0;

  constructor(private api: ApiService,
    private snackBar: MatSnackBar) { }

  ngOnInit(): void {
    this.api.get<any>('/api/wallet/history').subscribe({
      next: (res) => {
        if (res.success) {
          this.transactions = res.data;
          this.calculateSummary();
        }
        this.loading = false;
      },
      error: () => {
        this.snackBar.open('Failed to load history', 'Close', { duration: 3000 });
        this.loading = false;
      }
    });
  }

  calculateSummary(): void {
    this.totalReceived = this.transactions
      .filter(t => t.type === 'topup' || t.type === 'transfer_in')
      .reduce((sum, t) => sum + t.amount, 0);

    this.totalSent = this.transactions
      .filter(t => t.type === 'transfer_out')
      .reduce((sum, t) => sum + t.amount, 0);
  }

  getIcon(type: string): string {
    switch (type) {
      case 'topup': return 'add_circle';
      case 'transfer_in': return 'arrow_downward';
      case 'transfer_out': return 'arrow_upward';
      default: return 'swap_horiz';
    }
  }

  getLabel(type: string): string {
    switch (type) {
      case 'topup': return 'Top Up';
      case 'transfer_in': return 'Money Received';
      case 'transfer_out': return 'Money Sent';
      default: return type;
    }
  }
}
