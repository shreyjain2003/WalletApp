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
  selector: 'app-profile',
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
        <span class="title">My Profile</span>
      </div>

      <div class="content">

        <!-- Profile Card -->
        <mat-card class="profile-card">
          <mat-card-content>
            <div class="avatar">{{ getInitials() }}</div>
            <h2 class="profile-name">{{ profile?.fullName }}</h2>
            <p class="profile-email">{{ profile?.email }}</p>
            <p class="profile-phone">
              <mat-icon>phone</mat-icon>
              {{ profile?.phoneNumber }}
            </p>
            <span class="status-badge" [class]="profile?.status?.toLowerCase()">
              {{ profile?.status }}
            </span>
          </mat-card-content>
        </mat-card>

        <!-- KYC Card -->
        <mat-card class="kyc-card">
          <mat-card-content>
            <div class="kyc-header">
              <mat-icon class="kyc-icon">verified_user</mat-icon>
              <h3>KYC Verification</h3>
            </div>

            <!-- KYC submitted -->
            <div *ngIf="profile?.kyc">
              <div class="kyc-detail">
                <span class="detail-label">Document Type</span>
                <span class="detail-value">{{ profile.kyc.documentType }}</span>
              </div>
              <div class="kyc-detail">
                <span class="detail-label">Document Number</span>
                <span class="detail-value">{{ profile.kyc.documentNumber }}</span>
              </div>
              <div class="kyc-detail">
                <span class="detail-label">Status</span>
                <span class="status-badge" [class]="profile.kyc.status?.toLowerCase()">
                  {{ profile.kyc.status }}
                </span>
              </div>
              <div class="kyc-detail" *ngIf="profile.kyc.adminNote">
                <span class="detail-label">Admin Note</span>
                <span class="detail-value">{{ profile.kyc.adminNote }}</span>
              </div>

              <div class="kyc-message pending"
                   *ngIf="profile.kyc.status === 'Pending'">
                <mat-icon>hourglass_empty</mat-icon>
                <span>Your KYC is under review. Please wait for admin approval.</span>
              </div>

              <div class="kyc-message approved"
                   *ngIf="profile.kyc.status === 'Approved'">
                <mat-icon>check_circle</mat-icon>
                <span>Your KYC is approved. Your wallet is active!</span>
              </div>
            </div>

            <!-- Submit KYC -->
            <div *ngIf="!profile?.kyc || profile?.kyc?.status === 'Rejected'">
              <div class="kyc-message rejected"
                   *ngIf="profile?.kyc?.status === 'Rejected'">
                <mat-icon>cancel</mat-icon>
                <span>Your KYC was rejected. Please resubmit.</span>
              </div>

              <div class="kyc-message info" *ngIf="!profile?.kyc">
                <mat-icon>info</mat-icon>
                <span>Submit your KYC documents to activate your wallet.</span>
              </div>

              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Document Type</mat-label>
                <select matNativeControl [(ngModel)]="docType">
                  <option value="">Select type</option>
                  <option value="passport">Passport</option>
                  <option value="national_id">National ID</option>
                  <option value="driving_license">Driving License</option>
                </select>
              </mat-form-field>

              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Document Number</mat-label>
                <input matInput [(ngModel)]="docNumber"
                       placeholder="Enter document number"/>
                <mat-icon matSuffix>badge</mat-icon>
              </mat-form-field>

              <button mat-raised-button color="primary"
                      class="full-width submit-btn"
                      (click)="submitKyc()"
                      [disabled]="submitting">
                <mat-icon>upload</mat-icon>
                {{ submitting ? 'Submitting...' : 'Submit KYC' }}
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
      padding: 8px 16px;
      background: linear-gradient(135deg, #3f51b5 0%, #5c6bc0 100%);
      color: white;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    }
    .title { font-size: 18px; font-weight: 500; margin-left: 8px; flex: 1; }
    .content { padding: 24px; max-width: 600px; margin: 0 auto; }

    .profile-card { margin-bottom: 16px; text-align: center; padding: 16px; }
    .avatar {
      width: 80px; height: 80px;
      border-radius: 50%;
      background: linear-gradient(135deg, #3f51b5, #5c6bc0);
      color: white;
      font-size: 32px;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 16px;
    }
    .profile-name { margin: 0 0 4px; font-size: 22px; font-weight: 700; }
    .profile-email { margin: 0 0 8px; color: #666; font-size: 14px; }
    .profile-phone {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      color: #666;
      font-size: 14px;
      margin-bottom: 12px;
    }
    .profile-phone mat-icon { font-size: 16px; width: 16px; height: 16px; }

    .status-badge {
      display: inline-block;
      padding: 4px 16px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
    }
    .status-badge.pending  { background: #fff3e0; color: #e65100; }
    .status-badge.active   { background: #e8f5e9; color: #2e7d32; }
    .status-badge.rejected { background: #ffebee; color: #c62828; }
    .status-badge.approved { background: #e8f5e9; color: #2e7d32; }

    .kyc-card { padding: 8px; }
    .kyc-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 20px;
    }
    .kyc-icon { color: #3f51b5; font-size: 28px; width: 28px; height: 28px; }
    .kyc-header h3 { margin: 0; font-size: 18px; }

    .kyc-detail {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 0;
      border-bottom: 1px solid #f0f0f0;
      margin-bottom: 4px;
    }
    .detail-label { color: #666; font-size: 14px; }
    .detail-value { font-weight: 500; font-size: 14px; }

    .kyc-message {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px;
      border-radius: 8px;
      margin: 16px 0;
      font-size: 14px;
    }
    .kyc-message.pending  { background: #fff3e0; color: #e65100; }
    .kyc-message.approved { background: #e8f5e9; color: #2e7d32; }
    .kyc-message.rejected { background: #ffebee; color: #c62828; }
    .kyc-message.info     { background: #e3f2fd; color: #1565c0; }
    .kyc-message mat-icon { font-size: 20px; width: 20px; height: 20px; }

    .full-width { width: 100%; margin-bottom: 16px; margin-top: 8px; }
    .submit-btn {
      height: 48px;
      font-size: 15px !important;
      display: flex;
      align-items: center;
      gap: 8px;
    }
  `]
})
export class ProfileComponent implements OnInit {
  profile: any = null;
  docType = '';
  docNumber = '';
  loading = true;
  submitting = false;

  constructor(private api: ApiService,
    private snackBar: MatSnackBar) { }

  ngOnInit(): void {
    this.loadProfile();
  }

  loadProfile(): void {
    this.loading = true;
    this.api.get<any>('/api/auth/profile').subscribe({
      next: (res) => {
        if (res.success) this.profile = res.data;
        this.loading = false;
      },
      error: () => {
        this.snackBar.open('Failed to load profile', 'Close', { duration: 3000 });
        this.loading = false;
      }
    });
  }

  getInitials(): string {
    return this.profile?.fullName
      ?.split(' ')
      .map((n: string) => n[0])
      .join('')
      .toUpperCase() ?? '?';
  }

  submitKyc(): void {
    if (!this.docType || !this.docNumber) {
      this.snackBar.open('Please fill in all fields', 'Close', { duration: 3000 });
      return;
    }

    this.submitting = true;
    this.api.post<any>('/api/auth/kyc', {
      documentType: this.docType,
      documentNumber: this.docNumber
    }).subscribe({
      next: (res) => {
        if (res.success) {
          this.snackBar.open('KYC submitted successfully!', 'Close', { duration: 3000 });
          this.loadProfile();
        } else {
          this.snackBar.open(res.message, 'Close', { duration: 3000 });
        }
        this.submitting = false;
      },
      error: () => {
        this.snackBar.open('KYC submission failed.', 'Close', { duration: 3000 });
        this.submitting = false;
      }
    });
  }
}
