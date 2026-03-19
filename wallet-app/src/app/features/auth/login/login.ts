import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { AuthService } from '../../../core/services/auth';

@Component({
  selector: 'app-login',
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

    <div class="auth-container">
      <div class="auth-left">
        <div class="brand-section">
          <div class="brand-icon">💳</div>
          <h1>WalletApp</h1>
          <p>Your smart digital wallet for seamless transactions</p>
          <div class="features">
            <div class="feature">
              <mat-icon>security</mat-icon>
              <span>Bank-level Security</span>
            </div>
            <div class="feature">
              <mat-icon>flash_on</mat-icon>
              <span>Instant Transfers</span>
            </div>
            <div class="feature">
              <mat-icon>stars</mat-icon>
              <span>Rewards & Cashback</span>
            </div>
          </div>
        </div>
      </div>

      <div class="auth-right">
        <mat-card class="auth-card">
          <mat-card-content>
            <h2>Welcome Back</h2>
            <p class="subtitle">Sign in to your account</p>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Email</mat-label>
              <input matInput type="email" [(ngModel)]="email"
                     placeholder="you@example.com"/>
              <mat-icon matSuffix>email</mat-icon>
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Password</mat-label>
              <input matInput [type]="showPass ? 'text' : 'password'"
                     [(ngModel)]="password" placeholder="••••••••"
                     (keyup.enter)="login()"/>
              <mat-icon matSuffix style="cursor:pointer"
                        (click)="showPass = !showPass">
                {{ showPass ? 'visibility_off' : 'visibility' }}
              </mat-icon>
            </mat-form-field>

            <button mat-raised-button color="primary"
                    class="full-width submit-btn"
                    (click)="login()" [disabled]="loading">
              Sign In
            </button>

            <div class="divider">
              <span>Don't have an account?</span>
            </div>

            <button mat-stroked-button color="primary"
                    class="full-width" routerLink="/register">
              Create Account
            </button>

            <p class="admin-link">
              <a routerLink="/admin/login">Admin Portal →</a>
            </p>
          </mat-card-content>
        </mat-card>
      </div>
    </div>
  `,
  styles: [`
    .auth-container {
      display: flex;
      min-height: 100vh;
    }
    .auth-left {
      flex: 1;
      background: linear-gradient(135deg, #3f51b5 0%, #5c35d4 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 48px;
      color: white;
    }
    .brand-section { max-width: 400px; }
    .brand-icon { font-size: 64px; margin-bottom: 16px; }
    .brand-section h1 {
      font-size: 48px;
      font-weight: 700;
      margin-bottom: 16px;
    }
    .brand-section p {
      font-size: 18px;
      opacity: 0.8;
      margin-bottom: 48px;
    }
    .features { display: flex; flex-direction: column; gap: 16px; }
    .feature {
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 16px;
    }
    .feature mat-icon { opacity: 0.9; }
    .auth-right {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 48px;
      background: #f5f5f5;
    }
    .auth-card {
      width: 100%;
      max-width: 420px;
      padding: 32px;
    }
    .auth-card h2 {
      font-size: 28px;
      font-weight: 700;
      margin-bottom: 8px;
      color: #333;
    }
    .subtitle { color: #666; margin-bottom: 32px; }
    .full-width { width: 100%; margin-bottom: 16px; }
    .submit-btn {
      height: 48px;
      font-size: 16px !important;
      margin-bottom: 16px;
    }
    .divider {
      text-align: center;
      color: #999;
      margin: 16px 0;
      font-size: 14px;
    }
    .admin-link {
      text-align: center;
      margin-top: 16px;
      font-size: 14px;
    }
    .admin-link a { color: #3f51b5; text-decoration: none; }
    @media (max-width: 768px) {
      .auth-left { display: none; }
      .auth-right { padding: 24px; }
    }
  `]
})
export class LoginComponent implements OnInit {
  email = '';
  password = '';
  loading = false;
  showPass = false;

  constructor(private auth: AuthService, private router: Router,
    private snackBar: MatSnackBar) { }

  ngOnInit(): void {
    // Clear any stale session on login page load
    const role = localStorage.getItem('role');
    if (role === 'Admin') {
      localStorage.clear();
    }
  }

  login(): void {
    if (!this.email || !this.password) {
      this.snackBar.open('Please fill in all fields', 'Close', { duration: 3000 });
      return;
    }

    this.loading = true;
    this.auth.login({ email: this.email, password: this.password })
      .subscribe({
        next: (res: any) => {
          if (res.success) {
            const role = res.data.role;
            if (role === 'Admin') {
              this.router.navigate(['/admin/kyc']);
            } else {
              this.router.navigate(['/dashboard']);
            }
          } else {
            this.snackBar.open(res.message, 'Close', { duration: 3000 });
          }
          this.loading = false;
        },
        error: () => {
          this.snackBar.open('Login failed. Try again.', 'Close', { duration: 3000 });
          this.loading = false;
        }
      });
  }
}
