import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { AuthService } from '../../../core/services/auth';

@Component({
  selector: 'app-verify-otp',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, MatIconModule, MatSnackBarModule],
  template: `
    <div class="auth-container fade-in">
      <div class="auth-card">
        <div class="auth-card-header">
          <div style="width: 56px; height: 56px; border-radius: 16px; background: rgba(192, 133, 82, 0.1); border: 1px solid rgba(192, 133, 82, 0.2); display: flex; align-items: center; justify-content: center; margin: 0 auto 24px auto;">
            <mat-icon style="color: var(--teal); font-size: 28px; width: 28px; height: 28px;">mark_email_read</mat-icon>
          </div>
          <h1 class="auth-title">Check Your Email</h1>
          <p class="auth-subtitle">We sent a 6-digit OTP to <strong style="color: var(--text-primary);">{{ email }}</strong></p>
        </div>

        <div class="wa-label">Enter OTP</div>
        <div class="wa-input-wrap" [class.focused]="of">
          <mat-icon>pin</mat-icon>
          <input [(ngModel)]="otp" placeholder="6-digit code" maxlength="6"
                 (focus)="of=true" (blur)="of=false" (keyup.enter)="verify()"
                 style="font-size: 20px; font-weight: 700; letter-spacing: 4px; text-align: center;"/>
        </div>
        
        <br>
        <button class="wa-btn-primary" (click)="verify()" [disabled]="loading || !otp" style="margin-top: 8px;">
          {{ loading ? 'Verifying...' : 'Verify OTP' }}<mat-icon *ngIf="!loading">check_circle</mat-icon>
        </button>

        <div class="auth-footer-text">
          <a routerLink="/forgot-password" style="display: flex; align-items: center; justify-content: center; gap: 6px;">
            <mat-icon style="font-size: 16px; width: 16px; height: 16px;">refresh</mat-icon> Resend OTP
          </a>
        </div>
      </div>
    </div>
  `,
  styles: []
})
export class VerifyOtpComponent implements OnInit {
  otp = ''; email = ''; loading = false; of = false;
  constructor(private auth: AuthService, private router: Router, private route: ActivatedRoute, private snackBar: MatSnackBar) {}
  ngOnInit(): void { this.route.queryParams.subscribe(p => { this.email = p['email'] || ''; }); }
  verify(): void {
    if (!this.otp || this.otp.length !== 6) { this.snackBar.open('Enter the 6-digit OTP', 'Close', { duration: 3000 }); return; }
    this.loading = true;
    this.auth.verifyOtp(this.email, this.otp).subscribe({
      next: (res: any) => {
        const token = res.resetToken;
        if (!token) { this.snackBar.open('Token not received', 'Close', { duration: 3000 }); this.loading = false; return; }
        this.router.navigate(['/reset-password'], { queryParams: { email: this.email, token } });
      },
      error: () => { this.snackBar.open('Invalid or expired OTP', 'Close', { duration: 3000 }); this.loading = false; }
    });
  }
}

