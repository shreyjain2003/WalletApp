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

    <div class="login-container">

      <!-- Left Panel -->
      <div class="left-panel">
        <div class="left-content">
          <div class="logo-wrap">
            <div class="logo-icon">💳</div>
            <span class="logo-text">WalletApp</span>
          </div>

          <div class="hero-text">
            <h1>Smart Money,<br><span class="gradient-text">Smarter Life</span></h1>
            <p>The next generation digital wallet for seamless, secure and rewarding transactions.</p>
          </div>

          <div class="stats-row">
            <div class="stat">
              <span class="stat-num">10K+</span>
              <span class="stat-label">Users</span>
            </div>
            <div class="stat-divider"></div>
            <div class="stat">
              <span class="stat-num">₹5M+</span>
              <span class="stat-label">Transferred</span>
            </div>
            <div class="stat-divider"></div>
            <div class="stat">
              <span class="stat-num">99.9%</span>
              <span class="stat-label">Uptime</span>
            </div>
          </div>

          <div class="features-list">
            <div class="feature-item">
              <div class="feature-dot green"></div>
              <span>Instant wallet-to-wallet transfers</span>
            </div>
            <div class="feature-item">
              <div class="feature-dot blue"></div>
              <span>Earn rewards on every transaction</span>
            </div>
            <div class="feature-item">
              <div class="feature-dot purple"></div>
              <span>Bank-grade security with JWT & KYC</span>
            </div>
          </div>
        </div>

        <!-- Floating Cards -->
        <div class="floating-card card1">
          <mat-icon>check_circle</mat-icon>
          <span>Transfer Successful</span>
          <span class="fc-amount">+₹2,500</span>
        </div>
        <div class="floating-card card2">
          <mat-icon>stars</mat-icon>
          <span>Points Earned!</span>
          <span class="fc-amount">+10 pts</span>
        </div>
        <div class="floating-card card3">
          <mat-icon>verified_user</mat-icon>
          <span>KYC Approved</span>
          <span class="fc-status">Active ✓</span>
        </div>
      </div>

      <!-- Right Panel -->
      <div class="right-panel">
        <div class="form-wrap">
          <h2>Welcome Back 👋</h2>
          <p class="form-sub">Sign in to continue to WalletApp</p>

          <div class="input-group">
            <label>Email Address</label>
            <div class="input-wrap" [class.focused]="emailFocused">
              <mat-icon>email</mat-icon>
              <input type="email" [(ngModel)]="email"
                     placeholder="you@example.com"
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
                     placeholder="Enter your password"
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
            <span *ngIf="!loading">Sign In</span>
            <span *ngIf="loading">Signing in...</span>
            <mat-icon *ngIf="!loading">arrow_forward</mat-icon>
          </button>

          <div class="divider-row">
            <div class="divider-line"></div>
            <span>New to WalletApp?</span>
            <div class="divider-line"></div>
          </div>

          <button class="create-btn" routerLink="/register">
            <mat-icon>person_add</mat-icon>
            Create Free Account
          </button>

          <p class="admin-link">
            <a routerLink="/admin/login">
              <mat-icon>admin_panel_settings</mat-icon>
              Admin Portal
            </a>
          </p>
        </div>
      </div>

    </div>
  `,
  styles: [`
    .login-container {
      display: flex;
      min-height: 100vh;
      background: #f0f2f5;
    }

    /* ── LEFT PANEL ── */
    .left-panel {
      flex: 1;
      background: linear-gradient(135deg, #1a1a5e 0%, #3f51b5 40%, #7c4dff 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 48px;
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
      max-width: 420px;
      position: relative;
      z-index: 1;
    }

    .logo-wrap {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 48px;
    }

    .logo-icon {
      font-size: 36px;
      background: rgba(255,255,255,0.15);
      width: 56px; height: 56px;
      border-radius: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      backdrop-filter: blur(8px);
    }

    .logo-text {
      font-size: 24px;
      font-weight: 800;
      color: white;
      letter-spacing: -0.5px;
    }

    .hero-text {
      margin-bottom: 40px;
    }

    .hero-text h1 {
      font-size: 48px;
      font-weight: 800;
      color: white;
      line-height: 1.1;
      margin-bottom: 16px;
      letter-spacing: -1px;
    }

    .gradient-text {
      background: linear-gradient(135deg, #69f0ae, #40c4ff);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .hero-text p {
      font-size: 16px;
      color: rgba(255,255,255,0.7);
      line-height: 1.6;
    }

    .stats-row {
      display: flex;
      align-items: center;
      gap: 24px;
      margin-bottom: 40px;
      background: rgba(255,255,255,0.08);
      padding: 16px 24px;
      border-radius: 16px;
      backdrop-filter: blur(8px);
    }

    .stat { text-align: center; }
    .stat-num {
      display: block;
      font-size: 22px;
      font-weight: 800;
      color: white;
    }
    .stat-label {
      font-size: 12px;
      color: rgba(255,255,255,0.6);
    }
    .stat-divider {
      width: 1px;
      height: 32px;
      background: rgba(255,255,255,0.2);
    }

    .features-list {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .feature-item {
      display: flex;
      align-items: center;
      gap: 12px;
      color: rgba(255,255,255,0.85);
      font-size: 14px;
      font-weight: 500;
    }

    .feature-dot {
      width: 8px; height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .feature-dot.green  { background: #69f0ae; box-shadow: 0 0 8px #69f0ae; }
    .feature-dot.blue   { background: #40c4ff; box-shadow: 0 0 8px #40c4ff; }
    .feature-dot.purple { background: #ea80fc; box-shadow: 0 0 8px #ea80fc; }

    /* ── Floating Cards ── */
    .floating-card {
      position: absolute;
      background: rgba(255,255,255,0.12);
      backdrop-filter: blur(12px);
      border: 1px solid rgba(255,255,255,0.2);
      border-radius: 16px;
      padding: 10px 14px;
      display: flex;
      align-items: center;
      gap: 10px;
      color: white;
      font-size: 12px;
      font-weight: 600;
      animation: float 3s ease-in-out infinite;
      z-index: 2;
      white-space: nowrap;
    }

    .floating-card mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .fc-amount { margin-left: auto; color: #69f0ae; font-weight: 700; }
    .fc-status { margin-left: auto; color: #69f0ae; font-weight: 700; }

    .card1 { bottom: 160px; right: 16px; animation-delay: 0s; }
    .card2 { bottom: 80px; right: 16px; animation-delay: 1s; }
    .card3 { bottom: 240px; right: 16px; animation-delay: 2s; }

    
/* ── Stats Row ── */
.stats-row {
  display: flex;
  align-items: center;
  gap: 20px;
  margin-bottom: 36px;
  background: rgba(255,255,255,0.08);
  padding: 14px 20px;
  border-radius: 16px;
  backdrop-filter: blur(8px);
  width: fit-content;
}

    @keyframes float {
      0%, 100% { transform: translateY(0); }
      50%       { transform: translateY(-8px); }
    }

    /* ── RIGHT PANEL ── */
    .right-panel {
      flex: 0.8;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 48px 40px;
      background: white;
    }

    .form-wrap {
      width: 100%;
      max-width: 400px;
    }

    .form-wrap h2 {
      font-size: 32px;
      font-weight: 800;
      color: #1a1a2e;
      margin-bottom: 8px;
      letter-spacing: -0.5px;
    }

    .form-sub {
      color: #888;
      font-size: 15px;
      margin-bottom: 36px;
    }

    .input-group {
      margin-bottom: 20px;
    }

    .input-group label {
      display: block;
      font-size: 13px;
      font-weight: 600;
      color: #444;
      margin-bottom: 8px;
    }

    .input-wrap {
      display: flex;
      align-items: center;
      gap: 12px;
      border: 2px solid #e8e8f0;
      border-radius: 14px;
      padding: 14px 16px;
      transition: border-color 0.2s ease, box-shadow 0.2s ease;
      background: #fafafa;
    }

    .input-wrap.focused {
      border-color: #7c4dff;
      box-shadow: 0 0 0 4px rgba(124,77,255,0.1);
      background: white;
    }

    .input-wrap mat-icon {
      color: #aaa;
      font-size: 20px;
      width: 20px;
      height: 20px;
      flex-shrink: 0;
      transition: color 0.2s;
    }

    .input-wrap.focused mat-icon { color: #7c4dff; }

    .input-wrap input {
      flex: 1;
      border: none;
      outline: none;
      font-size: 15px;
      color: #1a1a2e;
      background: transparent;
      font-family: 'Inter', sans-serif;
    }

    .input-wrap input::placeholder { color: #bbb; }

    .toggle-pass {
      cursor: pointer !important;
      color: #bbb !important;
      transition: color 0.2s !important;
    }

    .toggle-pass:hover { color: #7c4dff !important; }

    .sign-in-btn {
      width: 100%;
      height: 52px;
      background: linear-gradient(135deg, #3f51b5, #7c4dff);
      color: white;
      border: none;
      border-radius: 14px;
      font-size: 16px;
      font-weight: 700;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      margin-top: 8px;
      transition: all 0.3s ease;
      letter-spacing: 0.3px;
      font-family: 'Inter', sans-serif;
    }

    .sign-in-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 24px rgba(124,77,255,0.4);
    }

    .sign-in-btn:disabled {
      opacity: 0.7;
      cursor: not-allowed;
      transform: none;
    }

    .sign-in-btn mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    .divider-row {
      display: flex;
      align-items: center;
      gap: 12px;
      margin: 24px 0;
      color: #aaa;
      font-size: 13px;
    }

    .divider-line {
      flex: 1;
      height: 1px;
      background: #e8e8f0;
    }

    .create-btn {
      width: 100%;
      height: 52px;
      background: transparent;
      color: #3f51b5;
      border: 2px solid #e8e8f0;
      border-radius: 14px;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      transition: all 0.2s ease;
      font-family: 'Inter', sans-serif;
    }

    .create-btn:hover {
      border-color: #7c4dff;
      color: #7c4dff;
      background: rgba(124,77,255,0.04);
    }

    .create-btn mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    .admin-link {
      text-align: center;
      margin-top: 20px;
    }

    .admin-link a {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      color: #aaa;
      text-decoration: none;
      font-size: 13px;
      font-weight: 500;
      transition: color 0.2s;
    }

    .admin-link a mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }

    .admin-link a:hover { color: #7c4dff; }

    /* ── Mobile ── */
    @media (max-width: 768px) {
      .left-panel { display: none; }
      .right-panel {
        padding: 32px 24px;
        background: linear-gradient(135deg, #1a1a5e 0%, #3f51b5 100%);
      }
      .form-wrap {
        background: white;
        border-radius: 24px;
        padding: 32px 24px;
      }
    }
  `]
})
export class LoginComponent implements OnInit {
  email = '';
  password = '';
  loading = false;
  showPass = false;
  emailFocused = false;
  passFocused = false;

  constructor(private auth: AuthService, private router: Router,
    private snackBar: MatSnackBar) { }

  ngOnInit(): void {
    const role = localStorage.getItem('role');
    if (role === 'Admin') localStorage.clear();
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
