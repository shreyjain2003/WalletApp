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
    <div class="page-container">
      <div class="navbar">
        <button mat-icon-button routerLink="/dashboard">
          <mat-icon>arrow_back</mat-icon>
        </button>
        <span class="title">Transfer Money</span>
      </div>

      <div class="content">
        <mat-card>
          <mat-card-content>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Receiver Email</mat-label>
              <input matInput type="email"
                     [(ngModel)]="receiverEmail"
                     placeholder="receiver@example.com"
                     (blur)="lookupReceiver()"/>
            </mat-form-field>

            <div class="receiver-info" *ngIf="receiverName">
              <mat-icon>check_circle</mat-icon>
              <span>Sending to: <strong>{{ receiverName }}</strong></span>
            </div>

            <div class="receiver-error" *ngIf="receiverError">
              <mat-icon>error</mat-icon>
              <span>{{ receiverError }}</span>
            </div>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Amount (₹)</mat-label>
              <input matInput type="number" [(ngModel)]="amount"
                     placeholder="Enter amount"/>
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Note (optional)</mat-label>
              <input matInput [(ngModel)]="note"
                     placeholder="What's this for?"/>
            </mat-form-field>

            <button mat-raised-button color="primary"
                    class="full-width" (click)="transfer()"
                    [disabled]="loading || !receiverUserId">
              {{ loading ? 'Processing...' : 'Send Money' }}
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
    .full-width { width: 100%; margin-bottom: 16px; }
    .receiver-info {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #4caf50;
      margin-bottom: 16px;
      font-weight: 500;
    }
    .receiver-error {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #f44336;
      margin-bottom: 16px;
    }
  `]
})
export class TransferComponent {
  receiverEmail = '';
  receiverUserId = '';
  receiverName = '';
  receiverError = '';
  amount = 0;
  note = '';
  loading = false;

  constructor(private api: ApiService, private router: Router,
    private snackBar: MatSnackBar) { }

  lookupReceiver(): void {
    if (!this.receiverEmail) return;

    this.receiverName = '';
    this.receiverError = '';
    this.receiverUserId = '';

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
                }
              });
          } else {
            this.receiverError = 'User not found or wallet not activated.';
          }
        },
        error: () => {
          this.receiverError = 'User not found or wallet not activated.';
        }
      });
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
          // Show actual error message from server
          this.snackBar.open(res.message, 'Close', { duration: 4000 });
        }
        this.loading = false;
      },
      error: (err) => {
        // Extract server error message from 400 response
        const message = err?.error?.message ?? 'Transfer failed. Try again.';
        this.snackBar.open(message, 'Close', { duration: 4000 });
        this.loading = false;
      }
    });
  }
}
