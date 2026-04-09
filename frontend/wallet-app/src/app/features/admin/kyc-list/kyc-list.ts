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
  selector: 'app-kyc-list',
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
        <button mat-button routerLink="/admin/tickets">Tickets</button>
        <button mat-button (click)="logout()">Logout</button>
        <button mat-button routerLink="/admin/users">Users</button>
      </div>

      <div class="content">
        <h2>Pending KYC Reviews</h2>

        <mat-card *ngIf="reviews.length === 0">
          <mat-card-content>
            <p class="empty">No pending KYC reviews.</p>
          </mat-card-content>
        </mat-card>

        <mat-card class="kyc-card" *ngFor="let kyc of reviews">
          <mat-card-content>
            <div class="kyc-header">
              <div>
                <h3>{{ kyc.userFullName }}</h3>
                <p class="email">{{ kyc.userEmail }}</p>
              </div>
              <span class="status pending">{{ kyc.status }}</span>
            </div>

            <div class="kyc-details">
              <div class="detail">
                <span class="label">Document Type</span>
                <span>{{ kyc.documentType }}</span>
              </div>
              <div class="detail">
                <span class="label">Document Number</span>
                <span>{{ kyc.documentNumber }}</span>
              </div>
              <div class="detail">
                <span class="label">Submitted</span>
                <span>{{ kyc.submittedAt | date:'medium' }}</span>
              </div>
            </div>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Admin Note (optional)</mat-label>
              <input matInput [(ngModel)]="kyc.adminNoteInput"
                     placeholder="Add a note..."/>
            </mat-form-field>

            <div class="actions">
              <button mat-raised-button color="primary"
                      (click)="decide(kyc, 'Approved')"
                      [disabled]="kyc.loading">
                ✅ Approve
              </button>
              <button mat-raised-button color="warn"
                      (click)="decide(kyc, 'Rejected')"
                      [disabled]="kyc.loading">
                ❌ Reject
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
    .kyc-card { margin-bottom: 16px; }
    .kyc-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 16px;
    }
    .kyc-header h3 { margin: 0; }
    .email { margin: 4px 0 0; color: #666; font-size: 14px; }
    .status { padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; }
    .status.pending { background: #fff3e0; color: #e65100; }
    .kyc-details { margin-bottom: 16px; }
    .detail {
      display: flex;
      justify-content: space-between;
      padding: 6px 0;
      border-bottom: 1px solid #eee;
    }
    .label { color: #666; font-size: 14px; }
    .full-width { width: 100%; margin-bottom: 12px; }
    .actions { display: flex; gap: 12px; }
  `]
})
export class KycListComponent implements OnInit {
  reviews: any[] = [];

  constructor(private api: ApiService, private auth: AuthService,
    private snackBar: MatSnackBar) { }

  ngOnInit(): void {
    this.loadReviews();
  }

  loadReviews(): void {
    this.api.get<any>('/api/admin/kyc/pending').subscribe({
      next: (res) => {
        if (res.success) {
          this.reviews = res.data.map((k: any) => ({
            ...k, adminNoteInput: '', loading: false
          }));
        }
      },
      error: () => this.snackBar.open('Failed to load KYC list', 'Close', { duration: 3000 })
    });
  }

  decide(kyc: any, decision: string): void {
    kyc.loading = true;
    this.api.post<any>(`/api/admin/kyc/${kyc.id}/decide`, {
      decision: decision,
      adminNote: kyc.adminNoteInput
    }).subscribe({
      next: (res) => {
        if (res.success) {
          this.snackBar.open(`KYC ${decision}`, 'Close', { duration: 3000 });
          this.reviews = this.reviews.filter(r => r.id !== kyc.id);
        } else {
          this.snackBar.open(res.message, 'Close', { duration: 3000 });
        }
        kyc.loading = false;
      },
      error: () => {
        this.snackBar.open('Action failed', 'Close', { duration: 3000 });
        kyc.loading = false;
      }
    });
  }

  logout(): void {
    this.auth.logout();
  }
}
