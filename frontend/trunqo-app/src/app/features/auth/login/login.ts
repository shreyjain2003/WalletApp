import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { AuthService } from '../../../core/services/auth';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, MatIconModule, MatSnackBarModule],
  template: `
    <div class="spinner-overlay" *ngIf="loading"><div class="spinner"></div></div>
    
    <div class="auth-container fade-in">
      <div class="auth-card">
        <div class="auth-card-header">
          <div class="auth-logo">Trunqo</div>
          <h1 class="auth-title">Welcome back</h1>
          <p class="auth-subtitle">Sign in to your premium account</p>
        </div>

        <div class="wa-label">Email Address</div>
        <div class="wa-input-wrap" [class.focused]="ef">
          <mat-icon>mail_outline</mat-icon>
          <input type="email" [(ngModel)]="email" placeholder="you@example.com"
                 (focus)="ef=true" (blur)="ef=false" (keyup.enter)="login()"/>
        </div>
        <br>

        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <div class="wa-label" style="margin-bottom: 0;">Password</div>
          <a routerLink="/forgot-password" style="font-size: 12px; font-weight: 500; color: var(--teal); text-decoration: none;">Forgot password?</a>
        </div>
        <div class="wa-input-wrap" [class.focused]="pf">
          <mat-icon>lock_outline</mat-icon>
          <input [type]="showPass?'text':'password'" [(ngModel)]="password"
                 placeholder="Enter your password"
                 (focus)="pf=true" (blur)="pf=false" (keyup.enter)="login()"/>
          <mat-icon style="cursor: pointer;" (click)="showPass=!showPass">{{ showPass?'visibility_off':'visibility' }}</mat-icon>
        </div>
        
        <br>
        <button class="wa-btn-primary" (click)="login()" [disabled]="loading" style="margin-top: 16px;">
          {{ loading ? 'Signing in...' : 'Sign In' }}
          <mat-icon *ngIf="!loading">arrow_forward</mat-icon>
        </button>

        <div style="display: flex; align-items: center; gap: 12px; margin: 32px 0; color: var(--text-muted); font-size: 13px;">
          <div style="flex: 1; height: 1px; background: var(--border);"></div>
          <span>New to Trunqo?</span>
          <div style="flex: 1; height: 1px; background: var(--border);"></div>
        </div>

        <button class="wa-btn-outline" routerLink="/register">
          <mat-icon>person_add_alt</mat-icon> Create an Account
        </button>

        <div class="auth-footer-text">
          <a routerLink="/admin/login">Admin Portal Access</a>
        </div>
      </div>
    </div>
  `,
  styles: []
})
export class LoginComponent implements OnInit {
  email = ''; password = ''; loading = false; showPass = false; ef = false; pf = false;

  constructor(private auth: AuthService, private router: Router, private snackBar: MatSnackBar) {}

  ngOnInit(): void { if (localStorage.getItem('role') === 'Admin') localStorage.clear(); }

  login(): void {
    if (!this.email.trim() || !this.password) { this.snackBar.open('Please fill in all fields', 'Close', { duration: 3000 }); return; }
    this.loading = true;
    this.auth.login({ email: this.email.trim().toLowerCase(), password: this.password }).subscribe({
      next: (res: any) => {
        if (res.success) { this.router.navigate([res.data.role === 'Admin' ? '/admin/kyc' : '/dashboard']); }
        else { this.snackBar.open(res.message, 'Close', { duration: 3000 }); }
        this.loading = false;
      },
      error: (err: any) => { this.snackBar.open(err?.error?.message ?? 'Login failed', 'Close', { duration: 3000 }); this.loading = false; }
    });
  }
}

