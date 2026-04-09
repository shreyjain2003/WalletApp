import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { AuthService } from '../../../core/services/auth';

@Component({
  selector: 'app-admin-login',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatCardModule, MatInputModule,
    MatButtonModule, MatIconModule, MatSnackBarModule
  ],
  template: `
    <div class="spinner-overlay" *ngIf="loading">
      <div class="spinner"></div>
    </div>

    <div class="login-container">

      <!-- Left Panel -->
      <div class="left-panel">
        <div class="left-content">
          <div class="logo-wrap">
            <div class="logo-icon">🔐</div>
            <span class="logo-text">WalletApp</span>
          </div>

          <div class="hero-text">
            <h1>Admin<br><span class="gradient-text">Control Panel</span></h1>
            <p>Manage users, approve KYC requests and handle support tickets from one place.</p>
          </div>

          <div class="stats-row">
            <div class="stat">
              <span class="stat-num">KYC</span>
              <span class="stat-label">Reviews</span>
            </div>
            <div class="stat-divider"></div>
            <div class="stat">
              <span class="stat-num">Users</span>
              <span class="stat-label">Management</span>
            </div>
            <div class="stat-divider"></div>
            <div class="stat">
              <span class="stat-num">Support</span>
              <span class="stat-label">Tickets</span>
            </div>
          </div>

          <div class="features-list">
            <div class="feature-item">
              <div class="feature-dot red"></div>
              <span>Review and approve KYC submissions</span>
            </div>
            <div class="feature-item">
              <div class="feature-dot orange"></div>
              <span>Manage all registered users</span>
            </div>
            <div class="feature-item">
              <div class="feature-dot yellow"></div>
              <span>Respond to support tickets</span>
            </div>
          </div>
        </div>

        <!-- Floating Cards -->
        <div class="floating-card card1">
          <mat-icon>verified_user</mat-icon>
          <span>KYC Approved</span>
          <span class="fc-status">Active ✓</span>
        </div>
        <div class="floating-card card2">
          <mat-icon>support_agent</mat-icon>
          <span>Ticket Resolved</span>
          <span class="fc-status">Done ✓</span>
        </div>
        <div class="floating-card card3">
          <mat-icon>group</mat-icon>
          <span>New User</span>
          <span class="fc-status">Pending →</span>
        </div>
      </div>

      <!-- Right Panel -->
      <div class="right-panel">
        <div class="form-wrap">
          <h2>Admin Sign In 👮</h2>
          <p class="form-sub">Access the administrator dashboard</p>

          <div class="admin-badge">
            <mat-icon>admin_panel_settings</mat-icon>
            <span>Restricted Access — Admins Only</span>
          </div>

          <div class="input-group">
            <label>Admin Email</label>
            <div class="input-wrap" [class.focused]="emailFocused">
              <mat-icon>email</mat-icon>
              <input type="email" [(ngModel)]="email"
                     placeholder="admin@walletapp.com"
                     (focus)="emailFocused=true"
                     (blur)="emailFocused=false"
                     (keyup.enter)="login()"/>
            </div>
          </div>

          <div class="input-group">
            <label>Password</label>
            <div class="input-wrap" [class.focused]="passFocused">
              <mat-icon>lock</mat-icon>
              <input [type]="showPass ? 'text' : 'password'"
                     [(ngModel)]="password"
                     placeholder="Enter admin password"
                     (focus)="passFocused=true"
                     (blur)="passFocused=false"
                     (keyup.enter)="login()"/>
              <mat-icon class="toggle-pass"
                        (click)="showPass = !showPass">
                {{ showPass ? 'visibility_off' : 'visibility' }}
              </mat-icon>
            </div>
          </div>

          <button class="sign-in-btn" (click)="login()" [disabled]="loading">
            <span *ngIf="!loading">Sign In as Admin</span>
            <span *ngIf="loading">Signing in...</span>
            <mat-icon *ngIf="!loading">arrow_forward</mat-icon>
          </button>

          <p class="back-link" (click)="goToUserLogin()">
            <mat-icon>arrow_back</mat-icon>
            Back to User Login
          </p>
        </div>
      </div>

    </div>
  `,
  styles: [`
    .login-container {
      display: flex;
      min-height: 100vh;
    }

    /* ── LEFT PANEL ── */
    .left-panel {
      flex: 1;
      background: linear-gradient(135deg, #4a0000 0%, #c62828 40%, #e53935 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 48px 40px;
      position: relative;
      overflow: hidden;
    }

    .left-panel::before {
      content: '';
      position: absolute;
      width: 600px; height: 600px;
      border-radius: 50%;
      background: rgba(255,255,255,0.04);
      top: -200px; right: -200px;
    }

    .left-panel::after {
      content: '';
      position: absolute;
      width: 400px; height: 400px;
      border-radius: 50%;
      background: rgba(255,255,255,0.04);
      bottom: -150px; left: -100px;
    }

    .left-content {
      max-width: 380px;
      position: relative;
      z-index: 1;
      padding-right: 160px;
    }

    .logo-wrap {
      display: flex; align-items: center; gap: 12px; margin-bottom: 32px;
    }
    .logo-icon {
      font-size: 32px;
      background: rgba(255,255,255,0.15);
      width: 52px; height: 52px; border-radius: 14px;
      display: flex; align-items: center; justify-content: center;
      backdrop-filter: blur(8px);
    }
    .logo-text { font-size: 22px; font-weight: 800; color: white; letter-spacing: -0.5px; }

    .hero-text { margin-bottom: 28px; }
    .hero-text h1 {
      font-size: 42px; font-weight: 800; color: white;
      line-height: 1.1; margin-bottom: 12px; letter-spacing: -1px;
    }
    .gradient-text {
      background: linear-gradient(135deg, #ffcdd2, #ff8a80);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .hero-text p { font-size: 15px; color: rgba(255,255,255,0.7); line-height: 1.6; }

    .stats-row {
      display: flex; align-items: center; gap: 20px; margin-bottom: 28px;
      background: rgba(255,255,255,0.08); padding: 14px 20px;
      border-radius: 16px; backdrop-filter: blur(8px); width: fit-content;
    }
    .stat { text-align: center; }
    .stat-num   { display: block; font-size: 16px; font-weight: 800; color: white; }
    .stat-label { font-size: 11px; color: rgba(255,255,255,0.6); }
    .stat-divider { width: 1px; height: 28px; background: rgba(255,255,255,0.2); }

    .features-list { display: flex; flex-direction: column; gap: 12px; }
    .feature-item {
      display: flex; align-items: center; gap: 12px;
      color: rgba(255,255,255,0.85); font-size: 13px; font-weight: 500;
    }
    .feature-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
    .feature-dot.red    { background: #ff8a80; box-shadow: 0 0 8px #ff8a80; }
    .feature-dot.orange { background: #ffab40; box-shadow: 0 0 8px #ffab40; }
    .feature-dot.yellow { background: #fff176; box-shadow: 0 0 8px #fff176; }

    /* ── Floating Cards ── */
    .floating-card {
      position: absolute;
      background: rgba(255,255,255,0.12);
      backdrop-filter: blur(12px);
      border: 1px solid rgba(255,255,255,0.2);
      border-radius: 14px; padding: 10px 14px;
      display: flex; align-items: center; gap: 10px;
      color: white; font-size: 12px; font-weight: 600;
      animation: float 3s ease-in-out infinite;
      z-index: 2; white-space: nowrap;
    }
    .floating-card mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .fc-status { margin-left: 8px; color: #ffab40; font-weight: 700; }
    .card1 { bottom: 220px; right: 24px; animation-delay: 0s; }
    .card2 { bottom: 100px; right: 24px; animation-delay: 1s; }
    .card3 { bottom: 160px; right: 24px; animation-delay: 2s; }

    @keyframes float {
      0%, 100% { transform: translateY(0px); }
      50%       { transform: translateY(-10px); }
    }

    /* ── RIGHT PANEL ── */
    .right-panel {
      flex: 0.8;
      display: flex; align-items: center; justify-content: center;
      padding: 48px 40px; background: white;
    }

    .form-wrap { width: 100%; max-width: 380px; }

    .form-wrap h2 {
      font-size: 30px; font-weight: 800; color: #1a1a2e;
      margin-bottom: 8px; letter-spacing: -0.5px;
    }
    .form-sub { color: #888; font-size: 14px; margin-bottom: 20px; }

    .admin-badge {
      display: flex; align-items: center; gap: 8px;
      background: #fff3e0; border: 1px solid #ffb74d;
      border-radius: 10px; padding: 10px 14px;
      font-size: 12px; font-weight: 600; color: #e65100;
      margin-bottom: 24px;
    }
    .admin-badge mat-icon { font-size: 18px; width: 18px; height: 18px; color: #ff6f00; }

    .input-group { margin-bottom: 18px; }
    .input-group label {
      display: block; font-size: 13px; font-weight: 600;
      color: #444; margin-bottom: 8px;
    }

    .input-wrap {
      display: flex; align-items: center; gap: 12px;
      border: 2px solid #e8e8f0; border-radius: 14px;
      padding: 13px 16px; transition: border-color 0.2s ease, box-shadow 0.2s ease;
      background: #fafafa;
    }
    .input-wrap.focused {
      border-color: #e53935;
      box-shadow: 0 0 0 4px rgba(229,57,53,0.1);
      background: white;
    }
    .input-wrap mat-icon {
      color: #aaa; font-size: 20px; width: 20px; height: 20px;
      flex-shrink: 0; transition: color 0.2s;
    }
    .input-wrap.focused mat-icon { color: #e53935; }
    .input-wrap input {
      flex: 1; border: none; outline: none; font-size: 15px;
      color: #1a1a2e; background: transparent; font-family: 'Inter', sans-serif;
    }
    .input-wrap input::placeholder { color: #bbb; }
    .toggle-pass { cursor: pointer !important; color: #bbb !important; transition: color 0.2s !important; }
    .toggle-pass:hover { color: #e53935 !important; }

    .sign-in-btn {
      width: 100%; height: 50px;
      background: linear-gradient(135deg, #c62828, #e53935);
      color: white; border: none; border-radius: 14px;
      font-size: 15px; font-weight: 700; cursor: pointer;
      display: flex; align-items: center; justify-content: center; gap: 8px;
      margin-top: 8px; transition: all 0.3s ease;
      font-family: 'Inter', sans-serif; letter-spacing: 0.3px;
      box-shadow: 0 4px 20px rgba(198,40,40,0.3);
    }
    .sign-in-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 24px rgba(198,40,40,0.45);
    }
    .sign-in-btn:disabled { opacity: 0.7; cursor: not-allowed; transform: none; }
    .sign-in-btn mat-icon { font-size: 20px; width: 20px; height: 20px; }

    .back-link {
      display: flex; align-items: center; justify-content: center; gap: 6px;
      margin-top: 20px; color: #aaa; font-size: 13px; font-weight: 500;
      cursor: pointer; transition: color 0.2s;
    }
    .back-link mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .back-link:hover { color: #e53935; }

    /* ── Mobile ── */
    @media (max-width: 768px) {
      .left-panel { display: none; }
      .right-panel {
        padding: 32px 24px;
        background: linear-gradient(135deg, #4a0000 0%, #c62828 100%);
      }
      .form-wrap {
        background: white; border-radius: 24px; padding: 32px 24px;
      }
    }
  `]
})
export class AdminLoginComponent implements OnInit {
  email = '';
  password = '';
  loading = false;
  showPass = false;
  emailFocused = false;
  passFocused = false;

  constructor(
    private auth: AuthService,
    private router: Router,
    private snackBar: MatSnackBar
  ) { }

  ngOnInit(): void {
    // If already logged in as admin, redirect
    const role = localStorage.getItem('role');
    if (role === 'Admin') {
      this.router.navigate(['/admin/kyc']);
    }
  }

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

  goToUserLogin(): void {
    this.router.navigate(['/login']);
  }
}
