/**
 * reset-password.ts — ResetPasswordComponent
 *
 * Step 3 (final) of the password reset flow.
 * Route: /reset-password?email=user@example.com&token=<resetToken>
 *
 * Responsibilities:
 *  - Reads email and resetToken from query parameters (set by VerifyOtpComponent)
 *  - If either is missing, shows an "Invalid Link" fallback view
 *  - Accepts newPassword + confirmPassword
 *  - Calls AuthService.resetPassword() → POST /api/auth/reset-password
 *  - On success, shows a snackbar and redirects to /login after 1.5s
 *  - Shows inline error messages for mismatched passwords or expired tokens
 *
 * Security: the resetToken is a one-time UUID that expires in 10 minutes.
 * The backend verifies its SHA-256 hash and marks it as used after success,
 * preventing replay attacks.
 *
 * Flow: /forgot-password → /verify-otp → /reset-password
 */

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { AuthService } from '../../../core/services/auth';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, MatIconModule, MatSnackBarModule],
  template: `
    <div class="auth-container fade-in">
      <div class="auth-card" *ngIf="email && token; else invalid">
        <div class="auth-card-header">
          <div style="width: 56px; height: 56px; border-radius: 16px; background: rgba(192, 133, 82, 0.1); border: 1px solid rgba(192, 133, 82, 0.2); display: flex; align-items: center; justify-content: center; margin: 0 auto 24px auto;">
            <mat-icon style="color: var(--teal); font-size: 28px; width: 28px; height: 28px;">lock_open</mat-icon>
          </div>
          <h1 class="auth-title">Set New Password</h1>
          <p class="auth-subtitle">Choose a strong password for your account.</p>
        </div>

        <div class="wa-label">New Password</div>
        <div class="wa-input-wrap" [class.focused]="nf">
          <mat-icon>lock_outline</mat-icon>
          <input [type]="showNew?'text':'password'" [(ngModel)]="newPassword" placeholder="Min 8 chars, mixed case + symbol" (focus)="nf=true" (blur)="nf=false"/>
          <mat-icon style="cursor: pointer;" (click)="showNew=!showNew">{{ showNew?'visibility_off':'visibility' }}</mat-icon>
        </div>
        <br>

        <div class="wa-label">Confirm Password</div>
        <div class="wa-input-wrap" [class.focused]="cf">
          <mat-icon>lock_outline</mat-icon>
          <input [type]="showConf?'text':'password'" [(ngModel)]="confirmPassword" placeholder="Repeat your new password" (focus)="cf=true" (blur)="cf=false" (keyup.enter)="reset()"/>
          <mat-icon style="cursor: pointer;" (click)="showConf=!showConf">{{ showConf?'visibility_off':'visibility' }}</mat-icon>
        </div>
        
        <p *ngIf="errMsg" style="display: flex; align-items: center; gap: 6px; color: var(--danger); font-size: 13px; margin: 12px 0;">
          <mat-icon style="font-size: 16px; width: 16px; height: 16px;">error_outline</mat-icon>{{ errMsg }}
        </p>

        <br>
        <button class="wa-btn-primary" (click)="reset()" [disabled]="loading" style="margin-top: 8px;">
          {{ loading ? 'Resetting...' : 'Reset Password' }}<mat-icon *ngIf="!loading">check_circle</mat-icon>
        </button>
      </div>

      <ng-template #invalid>
        <div class="auth-card" style="text-align: center;">
          <mat-icon style="font-size:44px; width:44px; height:44px; color: var(--text-muted); margin-bottom:16px;">link_off</mat-icon>
          <h1 class="auth-title">Invalid Link</h1>
          <p class="auth-subtitle">This reset link is invalid or has expired.</p>
          <button class="wa-btn-primary" routerLink="/forgot-password" style="margin-top: 24px;">Request New OTP</button>
        </div>
      </ng-template>
    </div>
  `,
  styles: []
})

export class ResetPasswordComponent implements OnInit {
  /** Email read from query param — passed to the API to identify the user */
  email = '';
  /** One-time reset token from query param — proves OTP was verified */
  token = '';
  /** New password entered by the user */
  newPassword = '';
  /** Confirmation field — must match newPassword before submitting */
  confirmPassword = '';
  /** Controls the loading spinner */
  loading = false;
  /** Inline error message shown below the confirm field */
  errMsg = '';
  /** Toggle visibility for new password field */
  showNew = false;
  /** Toggle visibility for confirm password field */
  showConf = false;
  /** Focus state flags for input wrapper styling */
  nf = false; cf = false;

  constructor(
    private auth: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private snackBar: MatSnackBar
  ) {}

  /**
   * Reads email and token from the URL query parameters.
   * These were set by VerifyOtpComponent after successful OTP verification.
   * If either is missing, the template shows the #invalid fallback view.
   */
  ngOnInit(): void {
    this.route.queryParams.subscribe(p => {
      this.email = p['email'] || '';
      this.token = p['token'] || '';
    });
  }

  /**
   * Submits the new password.
   * Client-side checks: both fields filled, passwords match.
   * On success, redirects to /login after a 1.5s delay so the user
   * can read the success snackbar before being redirected.
   */
  reset(): void {
    this.errMsg = '';
    if (!this.newPassword || !this.confirmPassword) { this.errMsg = 'Please fill all fields'; return; }
    if (this.newPassword !== this.confirmPassword) { this.errMsg = 'Passwords do not match'; return; }
    this.loading = true;
    this.auth.resetPassword({
      email: this.email,
      resetToken: this.token,
      newPassword: this.newPassword,
      confirmPassword: this.confirmPassword
    }).subscribe({
      next: () => {
        this.snackBar.open('Password reset successful!', 'Close', { duration: 3000 });
        // Brief delay so the user sees the success message before being redirected
        setTimeout(() => this.router.navigate(['/login']), 1500);
      },
      error: (err: any) => {
        // Backend returns a specific message if the token is expired or already used
        this.errMsg = err?.error?.message || 'Invalid or expired token';
        this.loading = false;
      }
    });
  }
}
