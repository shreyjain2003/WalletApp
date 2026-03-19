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
        <mat-card class="topup-card">
          <mat-card-content>

            <div class="section-title">Quick Select</div>
            <div class="quick-amounts">
              <button mat-stroked-button
                      *ngFor="let amt of quickAmounts"
                      [class.selected]="amount === amt"
                      (click)="amount = amt">
                ₹{{ amt }}
              </button>
            </div>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Amount (₹)</mat-label>
              <input matInput type="number" [(ngModel)]="amount"
                     placeholder="Enter amount"/>
              <mat-icon matSuffix>currency_rupee</mat-icon>
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Note (optional)</mat-label>
              <input matInput [(ngModel)]="note"
                     placeholder="Add a note"/>
              <mat-icon matSuffix>note</mat-icon>
            </mat-form-field>

            <button mat-raised-button color="primary"
                    class="full-width submit-btn"
                    (click)="topUp()" [disabled]="loading">
              <mat-icon>add_circle</mat-icon>
              Add Money
            </button>

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
    .content { padding: 24px; max-width: 500px; margin: 0 auto; }
    .topup-card { padding: 8px; }
    .section-title {
      font-size: 14px;
      color: #666;
      font-weight: 500;
      margin-bottom: 12px;
    }
    .quick-amounts {
      display: flex;
      gap: 8px;
      margin-bottom: 24px;
      flex-wrap: wrap;
    }
    .quick-amounts button {
      border-radius: 20px !important;
      font-weight: 600 !important;
    }
    .quick-amounts button.selected {
      background: #3f51b5 !important;
      color: white !important;
    }
    .full-width { width: 100%; margin-bottom: 16px; }
    .submit-btn {
      height: 48px;
      font-size: 16px !important;
      display: flex;
      align-items: center;
      gap: 8px;
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
