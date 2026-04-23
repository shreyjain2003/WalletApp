import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { AuthService } from '../../../core/services/auth';

@Component({
  selector: 'app-admin-login',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatSnackBarModule],
  template: `
    <div class="spinner-overlay" *ngIf="loading"><div class="spinner"></div></div>
    
    <div class="auth-page fade-in">
      <div class="auth-left">
        <div class="left-content">
          <div class="brand">
            <img src="assets/logo.png" alt="Trunqo Logo" class="brand-logo" />
          </div>
          <h1>Control<br><span class="accent">Center</span></h1>
          <p class="tagline">Manage users, review KYC submissions, and handle support tickets.</p>
          <div class="features">
            <div class="feat"><mat-icon>verified_user</mat-icon><span>Review KYC submissions</span></div>
            <div class="feat"><mat-icon>group</mat-icon><span>Manage all registered users</span></div>
            <div class="feat"><mat-icon>support_agent</mat-icon><span>Respond to support tickets</span></div>
          </div>
        </div>
        <div class="left-deco"></div>
      </div>
      <div class="auth-right">
        <div class="auth-card">
          <div class="admin-badge"><mat-icon>admin_panel_settings</mat-icon><span>Restricted — Admins Only</span></div>
          <h2>Admin Sign In</h2>
          <p class="auth-sub">Access the administrator dashboard</p>
          
          <div class="wa-label">Admin Email</div>
          <div class="wa-input-wrap" [class.focused]="ef" style="margin-bottom: 20px;">
            <mat-icon>mail_outline</mat-icon>
            <input type="email" [(ngModel)]="email" placeholder="admin@trunqo.com" (focus)="ef=true" (blur)="ef=false" (keyup.enter)="login()"/>
          </div>
          
          <div class="wa-label">Password</div>
          <div class="wa-input-wrap" [class.focused]="pf" style="margin-bottom: 28px;">
            <mat-icon>lock_outline</mat-icon>
            <input [type]="showPass?'text':'password'" [(ngModel)]="password" placeholder="Enter admin password" (focus)="pf=true" (blur)="pf=false" (keyup.enter)="login()"/>
            <mat-icon class="eye-icon" (click)="showPass=!showPass">{{ showPass?'visibility_off':'visibility' }}</mat-icon>
          </div>
          
          <button class="wa-btn-primary full-width" (click)="login()" [disabled]="loading">
            {{ loading ? 'Signing in...' : 'Sign In as Admin' }}<mat-icon *ngIf="!loading">arrow_forward</mat-icon>
          </button>
          
          <p class="back-link" (click)="goToUserLogin()"><mat-icon>arrow_back</mat-icon> Back to User Login</p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .auth-page { display: flex; min-height: 100vh; background: var(--bg); }
    
    .auth-left { flex: 1.2; position: relative; overflow: hidden; background: var(--bg-card); border-right: 1px solid var(--border); display: flex; align-items: center; justify-content: center; padding: 60px 80px; }
    .left-deco { position: absolute; top: 0; bottom: 0; left: 0; right: 0; background: radial-gradient(circle at top left, rgba(192, 133, 82, 0.15) 0%, transparent 60%); pointer-events: none; }
    .left-content { position: relative; z-index: 1; max-width: 480px; }
    
    .brand { display: flex; align-items: center; gap: 12px; margin-bottom: 40px; }
    .brand-logo { max-width: 140px; height: auto; display: block; }
    
    h1 { font-size: 48px; font-weight: 800; color: var(--text-primary); line-height: 1.1; margin-bottom: 20px; letter-spacing: -1.5px; font-family: 'Outfit', sans-serif; }
    .accent { color: var(--teal); }
    .tagline { font-size: 16px; color: var(--text-secondary); margin-bottom: 48px; line-height: 1.6; }
    
    .features { display: flex; flex-direction: column; gap: 20px; }
    .feat { display: flex; align-items: center; gap: 16px; color: var(--text-primary); font-size: 15px; font-weight: 500; }
    .feat mat-icon { font-size: 22px; width: 22px; height: 22px; color: var(--teal); flex-shrink: 0; opacity: 0.9; }
    
    .auth-right { flex: 1; display: flex; align-items: center; justify-content: center; padding: 48px; background: var(--bg); }
    
    .admin-badge { display: flex; align-items: center; width: max-content; gap: 8px; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); border-radius: 8px; padding: 6px 12px; font-size: 12px; font-weight: 700; color: #EF4444; margin-bottom: 24px; margin-left: auto; margin-right: auto; }
    .admin-badge mat-icon { font-size: 16px; width: 16px; height: 16px; }
    
    h2 { font-size: 28px; font-weight: 800; color: var(--text-primary); margin-bottom: 8px; letter-spacing: -1px; text-align: center; font-family: 'Outfit', sans-serif; }
    .auth-sub { color: var(--text-secondary); font-size: 15px; margin: 0 0 32px 0; text-align: center; }
    
    .full-width { width: 100%; display: flex; align-items: center; justify-content: center; opacity: 1; margin: 0; }
    .full-width mat-icon { font-size: 18px; width: 18px; height: 18px; margin-left: 6px; }
    
    .back-link { display: flex; align-items: center; justify-content: center; gap: 6px; margin-top: 24px; color: var(--text-secondary); font-size: 14px; font-weight: 500; cursor: pointer; transition: color 0.15s; }
    .back-link mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .back-link:hover { color: var(--text-primary); }
    
    @media (max-width: 900px) { .auth-left { display: none; } .auth-right { padding: 24px; } }
  `]
})
export class AdminLoginComponent implements OnInit {
  email = ''; password = ''; loading = false; showPass = false; ef = false; pf = false;
  constructor(private auth: AuthService, private router: Router, private snackBar: MatSnackBar) {}
  ngOnInit(): void { if (localStorage.getItem('role') === 'Admin') this.router.navigate(['/admin/kyc']); }
  login(): void {
    if (!this.email || !this.password) { this.snackBar.open('Please fill in all fields', 'Close', { duration: 3000 }); return; }
    this.loading = true;
    this.auth.adminLogin({ email: this.email, password: this.password }).subscribe({
      next: (res: any) => { if (res.success) { this.router.navigate(['/admin/kyc']); } else { this.snackBar.open(res.message, 'Close', { duration: 3000 }); } this.loading = false; },
      error: () => { this.snackBar.open('Login failed. Try again.', 'Close', { duration: 3000 }); this.loading = false; }
    });
  }
  goToUserLogin(): void { this.router.navigate(['/login']); }
}
