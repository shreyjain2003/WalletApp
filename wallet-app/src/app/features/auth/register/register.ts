import { Component } from '@angular/core';
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
  selector: 'app-register',
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
          <p>Join thousands of users managing their money smarter</p>
          <div class="steps">
            <div class="step">
              <div class="step-num">1</div>
              <span>Create your account</span>
            </div>
            <div class="step">
              <div class="step-num">2</div>
              <span>Submit KYC documents</span>
            </div>
            <div class="step">
              <div class="step-num">3</div>
              <span>Start transacting!</span>
            </div>
          </div>
        </div>
      </div>

      <div class="auth-right">
        <mat-card class="auth-card">
          <mat-card-content>
            <h2>Create Account</h2>
            <p class="subtitle">Fill in your details to get started</p>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Full Name</mat-label>
              <input matInput [(ngModel)]="fullName" placeholder="John Doe"/>
              <mat-icon matSuffix>person</mat-icon>
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Email</mat-label>
              <input matInput type="email" [(ngModel)]="email"
                     placeholder="you@example.com"/>
              <mat-icon matSuffix>email</mat-icon>
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Phone Number</mat-label>
              <input matInput [(ngModel)]="phone"
                     placeholder="9876543210"/>
              <mat-icon matSuffix>phone</mat-icon>
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Password</mat-label>
              <input matInput [type]="showPass ? 'text' : 'password'"
                     [(ngModel)]="password" placeholder="Min 8 characters"/>
              <mat-icon matSuffix style="cursor:pointer"
                        (click)="showPass = !showPass">
                {{ showPass ? 'visibility_off' : 'visibility' }}
              </mat-icon>
            </mat-form-field>

            <button mat-raised-button color="primary"
                    class="full-width submit-btn"
                    (click)="register()" [disabled]="loading">
              Create Account
            </button>

            <div class="divider">
              <span>Already have an account?</span>
            </div>

            <button mat-stroked-button color="primary"
                    class="full-width" routerLink="/login">
              Sign In
            </button>
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
    .brand-section h1 { font-size: 48px; font-weight: 700; margin-bottom: 16px; }
    .brand-section p { font-size: 18px; opacity: 0.8; margin-bottom: 48px; }
    .steps { display: flex; flex-direction: column; gap: 20px; }
    .step { display: flex; align-items: center; gap: 16px; font-size: 16px; }
    .step-num {
      width: 32px; height: 32px;
      border-radius: 50%;
      background: rgba(255,255,255,0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      flex-shrink: 0;
    }
    .auth-right {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 48px;
      background: #f5f5f5;
    }
    .auth-card { width: 100%; max-width: 420px; padding: 32px; }
    .auth-card h2 { font-size: 28px; font-weight: 700; margin-bottom: 8px; color: #333; }
    .subtitle { color: #666; margin-bottom: 32px; }
    .full-width { width: 100%; margin-bottom: 16px; }
    .submit-btn { height: 48px; font-size: 16px !important; margin-bottom: 16px; }
    .divider { text-align: center; color: #999; margin: 16px 0; font-size: 14px; }
    @media (max-width: 768px) {
      .auth-left { display: none; }
      .auth-right { padding: 24px; }
    }
  `]
})
export class RegisterComponent {
  fullName = '';
  email = '';
  phone = '';
  password = '';
  loading = false;
  showPass = false;

  constructor(private auth: AuthService, private router: Router,
    private snackBar: MatSnackBar) { }

  register(): void {
    if (!this.fullName || !this.email || !this.phone || !this.password) {
      this.snackBar.open('Please fill in all fields', 'Close', { duration: 3000 });
      return;
    }

    this.loading = true;
    this.auth.register({
      fullName: this.fullName,
      email: this.email,
      phoneNumber: this.phone,
      password: this.password
    }).subscribe({
      next: (res: any) => {
        if (res.success) {
          this.snackBar.open('Account created!', 'Close', { duration: 3000 });
          this.router.navigate(['/dashboard']);
        } else {
          this.snackBar.open(res.message, 'Close', { duration: 3000 });
        }
        this.loading = false;
      },
      error: () => {
        this.snackBar.open('Registration failed.', 'Close', { duration: 3000 });
        this.loading = false;
      }
    });
  }
}
