/**
 * forgot-password.ts — ForgotPasswordComponent
 *
 * Step 1 of the password reset flow.
 * Route: /forgot-password
 *
 * Responsibilities:
 *  - Accepts the user's email address
 *  - Calls AuthService.forgotPassword() → POST /api/auth/forgot-password
 *  - The backend generates a 6-digit OTP, stores its SHA-256 hash, and
 *    publishes a notification event so the OTP is emailed to the user
 *  - On success (always 200 — backend never reveals if email exists),
 *    navigates to /verify-otp passing the email as a query parameter
 *    so the next step can display it and submit the OTP
 *
 * Flow: /forgot-password → /verify-otp → /reset-password
 */

import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { AuthService } from '../../../core/services/auth';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, MatIconModule, MatSnackBarModule],
  template: `
    <div class="auth-container fade-in">
      <div class="auth-card">
        <div class="auth-card-header">
          <div style="width: 56px; height: 56px; border-radius: 16px; background: rgba(192, 133, 82, 0.1); border: 1px solid rgba(192, 133, 82, 0.2); display: flex; align-items: center; justify-content: center; margin: 0 auto 24px auto;">
            <mat-icon style="color: var(--teal); font-size: 28px; width: 28px; height: 28px;">lock_reset</mat-icon>
          </div>
          <h1 class="auth-title">Forgot Password?</h1>
          <p class="auth-subtitle">Enter your email and we'll send you a 6-digit OTP to reset your password.</p>
        </div>

        <div class="wa-label">Email Address</div>
        <div class="wa-input-wrap" [class.focused]="ef">
          <mat-icon>mail_outline</mat-icon>
          <input type="email" [(ngModel)]="email" placeholder="you@example.com"
                 (focus)="ef=true" (blur)="ef=false" (keyup.enter)="submit()"/>
        </div>
        
        <br>
        <button class="wa-btn-primary" (click)="submit()" [disabled]="loading" style="margin-top: 8px;">
          {{ loading ? 'Sending OTP...' : 'Send OTP' }}<mat-icon *ngIf="!loading">send</mat-icon>
        </button>

        <div class="auth-footer-text">
          <a routerLink="/login" style="display: flex; align-items: center; justify-content: center; gap: 6px;">
            <mat-icon style="font-size: 16px; width: 16px; height: 16px;">arrow_back</mat-icon> Back to Sign In
          </a>
        </div>
      </div>
    </div>
  `,
  styles: []
})
export class ForgotPasswordComponent {
  /** Two-way bound to the email input */
  email = '';
  /** Controls the loading spinner and disables the button during the API call */
  loading = false;
  /** Focus state flag for input wrapper styling */
  ef = false;

  constructor(
    private auth: AuthService,
    private router: Router,
    private snackBar: MatSnackBar
  ) {}

  /**
   * Submits the email to trigger an OTP.
   * The backend always returns 200 regardless of whether the email exists
   * (to prevent user enumeration), so we always navigate to /verify-otp.
   * The email is passed as a query param so the OTP page can display it
   * and include it in the verify-otp API call.
   */
  submit(): void {
    if (!this.email.trim()) {
      this.snackBar.open('Enter your email', 'Close', { duration: 3000 });
      return;
    }
    this.loading = true;
    this.auth.forgotPassword(this.email.trim()).subscribe({
      next: () => {
        // Navigate to OTP verification step, passing the email as a query param
        this.router.navigate(['/verify-otp'], { queryParams: { email: this.email.trim() } });
      },
      error: () => {
        this.snackBar.open('Error sending OTP', 'Close', { duration: 3000 });
        this.loading = false;
      }
    });
  }
}
