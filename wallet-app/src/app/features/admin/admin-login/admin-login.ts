import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { AuthService } from '../../../core/services/auth';

@Component({
  selector: 'app-admin-login',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatCardModule, MatInputModule,
    MatButtonModule, MatSnackBarModule
  ],
  template: `
    <div class="auth-container">
      <mat-card class="auth-card">
        <mat-card-header>
          <mat-card-title>🔐 Admin Panel</mat-card-title>
          <mat-card-subtitle>Sign in as administrator</mat-card-subtitle>
        </mat-card-header>

        <mat-card-content>
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Email</mat-label>
            <input matInput type="email" [(ngModel)]="email"
                   placeholder="admin@walletapp.com"/>
          </mat-form-field>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Password</mat-label>
            <input matInput type="password" [(ngModel)]="password"
                   placeholder="••••••••"/>
          </mat-form-field>
        </mat-card-content>

        <mat-card-actions>
          <button mat-raised-button color="warn"
                  class="full-width" (click)="login()"
                  [disabled]="loading">
            {{ loading ? 'Signing in...' : 'Admin Sign In' }}
          </button>
        </mat-card-actions>
      </mat-card>
    </div>
  `,
  styles: [`
    .auth-container {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      background: linear-gradient(135deg, #f5576c 0%, #f093fb 100%);
    }
    .auth-card { width: 400px; padding: 24px; }
    .full-width { width: 100%; }
    mat-card-header { margin-bottom: 16px; }
    mat-card-title { font-size: 24px !important; }
    mat-card-actions { padding: 16px 0; }
  `]
})
export class AdminLoginComponent {
  email = '';
  password = '';
  loading = false;

  constructor(private auth: AuthService, private router: Router,
    private snackBar: MatSnackBar) { }

  login(): void {
    if (!this.email || !this.password) {
      this.snackBar.open('Please fill in all fields', 'Close', { duration: 3000 });
      return;
    }

    this.loading = true;
    this.auth.adminLogin({ email: this.email, password: this.password })
      .subscribe({
        next: (res: any) => {
          if (res.success) {
            this.router.navigate(['/admin/kyc']);
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
