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
  email = ''; loading = false; ef = false;
  constructor(private auth: AuthService, private router: Router, private snackBar: MatSnackBar) {}
  submit(): void {
    if (!this.email.trim()) { this.snackBar.open('Enter your email', 'Close', { duration: 3000 }); return; }
    this.loading = true;
    this.auth.forgotPassword(this.email.trim()).subscribe({
      next: () => { this.router.navigate(['/verify-otp'], { queryParams: { email: this.email.trim() } }); },
      error: () => { this.snackBar.open('Error sending OTP', 'Close', { duration: 3000 }); this.loading = false; }
    });
  }
}

