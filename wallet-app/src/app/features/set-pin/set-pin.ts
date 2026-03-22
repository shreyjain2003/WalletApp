import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { AuthService } from '../../core/services/auth';

@Component({
  selector: 'app-set-pin',
  standalone: true,
  imports: [
    CommonModule, RouterLink,
    MatIconModule, MatButtonModule, MatSnackBarModule
  ],
  template: `
    <div class="page-container">
      <div class="navbar">
        <button mat-icon-button routerLink="/dashboard">
          <mat-icon>arrow_back</mat-icon>
        </button>
        <span class="title">{{ hasPin ? 'Change PIN' : 'Set Transaction PIN' }}</span>
      </div>

      <div class="content">

        <!-- Info Banner -->
        <div class="info-banner">
          <mat-icon>shield</mat-icon>
          <div>
            <p class="info-title">Secure Your Transfers</p>
            <p class="info-sub">
              A 4-digit PIN will be required before every money transfer.
            </p>
          </div>
        </div>

        <!-- Step Indicator -->
        <div class="steps">
          <div class="step" [class.active]="currentStep === 1" [class.done]="currentStep > 1">
            <div class="step-circle">{{ currentStep > 1 ? '✓' : '1' }}</div>
            <span>{{ hasPin ? 'Enter current PIN' : 'Create PIN' }}</span>
          </div>
          <div class="step-line"></div>
          <div class="step" [class.active]="currentStep === 2" [class.done]="currentStep > 2">
            <div class="step-circle">{{ currentStep > 2 ? '✓' : '2' }}</div>
            <span>{{ hasPin ? 'New PIN' : 'Confirm PIN' }}</span>
          </div>
          <div class="step-line" *ngIf="hasPin"></div>
          <div class="step" *ngIf="hasPin" [class.active]="currentStep === 3">
            <div class="step-circle">3</div>
            <span>Confirm PIN</span>
          </div>
        </div>

        <!-- PIN Entry -->
        <div class="pin-card">
          <p class="pin-label">
            <span *ngIf="currentStep === 1 && !hasPin">Enter your new 4-digit PIN</span>
            <span *ngIf="currentStep === 1 && hasPin">Enter your current PIN</span>
            <span *ngIf="currentStep === 2 && !hasPin">Confirm your PIN</span>
            <span *ngIf="currentStep === 2 && hasPin">Enter your new 4-digit PIN</span>
            <span *ngIf="currentStep === 3">Confirm your new PIN</span>
          </p>

          <!-- PIN Dots -->
          <div class="pin-dots">
            <div class="dot" *ngFor="let i of [0,1,2,3]"
                 [class.filled]="currentPin.length > i">
            </div>
          </div>

          <!-- Error message -->
          <p class="pin-error" *ngIf="errorMsg">{{ errorMsg }}</p>

          <!-- Number Pad -->
          <div class="numpad">
            <button class="num-btn" *ngFor="let n of [1,2,3,4,5,6,7,8,9]"
                    (click)="pressKey(n.toString())">
              {{ n }}
            </button>
            <button class="num-btn clear" (click)="clearPin()">
              <mat-icon>backspace</mat-icon>
            </button>
            <button class="num-btn" (click)="pressKey('0')">0</button>
            <button class="num-btn confirm"
                    [disabled]="currentPin.length < 4"
                    (click)="confirmStep()">
              <mat-icon>check</mat-icon>
            </button>
          </div>
        </div>

        <!-- Remove PIN -->
        <button class="remove-pin-btn" *ngIf="hasPin && currentStep === 1"
                (click)="removePin()">
          <mat-icon>lock_open</mat-icon>
          Remove PIN Protection
        </button>

      </div>
    </div>
  `,
  styles: [`
    .page-container { min-height: 100vh; background: #f0f2f5; }

    .navbar {
      display: flex; align-items: center; padding: 8px 16px;
      background: linear-gradient(135deg, #3f51b5 0%, #5c35d4 100%);
      color: white; box-shadow: 0 4px 20px rgba(63,81,181,0.3);
      position: sticky; top: 0; z-index: 100;
    }
    .title { font-size: 17px; font-weight: 700; margin-left: 8px; flex: 1; }

    .content { padding: 20px 16px; max-width: 420px; margin: 0 auto; }

    .info-banner {
      display: flex; align-items: flex-start; gap: 14px;
      background: linear-gradient(135deg, #e8eaf6, #c5cae9);
      border-radius: 16px; padding: 16px; margin-bottom: 24px;
      border: 1px solid #9fa8da;
    }
    .info-banner mat-icon { color: #3f51b5; font-size: 28px; width: 28px; height: 28px; flex-shrink: 0; }
    .info-title { margin: 0 0 4px; font-size: 14px; font-weight: 700; color: #1a1a2e; }
    .info-sub   { margin: 0; font-size: 12px; color: #555; line-height: 1.5; }

    /* ── Steps ── */
    .steps {
      display: flex; align-items: center; justify-content: center;
      gap: 8px; margin-bottom: 28px;
    }
    .step { display: flex; flex-direction: column; align-items: center; gap: 6px; }
    .step-circle {
      width: 32px; height: 32px; border-radius: 50%;
      background: #e8e8f0; color: #999; font-size: 13px; font-weight: 700;
      display: flex; align-items: center; justify-content: center;
      transition: all 0.3s ease;
    }
    .step.active .step-circle { background: #3f51b5; color: white; box-shadow: 0 4px 12px rgba(63,81,181,0.4); }
    .step.done  .step-circle  { background: #00c853; color: white; }
    .step span { font-size: 11px; color: #999; font-weight: 500; white-space: nowrap; }
    .step.active span { color: #3f51b5; font-weight: 700; }
    .step-line { width: 40px; height: 2px; background: #e8e8f0; margin-bottom: 18px; }

    /* ── PIN Card ── */
    .pin-card {
      background: white; border-radius: 24px; padding: 28px 24px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.08); margin-bottom: 16px;
      text-align: center;
    }

    .pin-label {
      font-size: 15px; font-weight: 600; color: #444;
      margin-bottom: 24px;
    }

    /* ── PIN Dots ── */
    .pin-dots {
      display: flex; justify-content: center; gap: 16px; margin-bottom: 16px;
    }

    .dot {
      width: 18px; height: 18px; border-radius: 50%;
      border: 2px solid #d0d0e0;
      transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
    }

    .dot.filled {
      background: #3f51b5; border-color: #3f51b5;
      transform: scale(1.15);
      box-shadow: 0 4px 12px rgba(63,81,181,0.4);
    }

    .pin-error {
      color: #f44336; font-size: 13px; font-weight: 500;
      margin-bottom: 16px; animation: shake 0.4s ease;
    }

    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      25%       { transform: translateX(-8px); }
      75%       { transform: translateX(8px); }
    }

    /* ── Number Pad ── */
    .numpad {
      display: grid; grid-template-columns: repeat(3, 1fr);
      gap: 12px; max-width: 280px; margin: 0 auto;
    }

    .num-btn {
      height: 64px; border: none; border-radius: 16px;
      background: #f5f5f8; color: #1a1a2e;
      font-size: 22px; font-weight: 700; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      transition: all 0.15s ease; font-family: 'Inter', sans-serif;
      box-shadow: 0 2px 8px rgba(0,0,0,0.06);
    }

    .num-btn:active { transform: scale(0.93); background: #e8e8f0; }

    .num-btn.clear {
      background: #fff0f0; color: #f44336;
    }
    .num-btn.clear mat-icon { font-size: 22px; width: 22px; height: 22px; }

    .num-btn.confirm {
      background: linear-gradient(135deg, #3f51b5, #7c4dff);
      color: white; box-shadow: 0 4px 16px rgba(63,81,181,0.4);
    }
    .num-btn.confirm mat-icon { font-size: 24px; width: 24px; height: 24px; }
    .num-btn.confirm:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }

    /* ── Remove PIN ── */
    .remove-pin-btn {
      width: 100%; padding: 14px; border: 2px solid #ffcdd2;
      border-radius: 14px; background: #fff5f5; color: #f44336;
      font-size: 14px; font-weight: 600; cursor: pointer;
      display: flex; align-items: center; justify-content: center; gap: 8px;
      font-family: 'Inter', sans-serif; transition: all 0.2s ease;
    }
    .remove-pin-btn:hover { background: #ffebee; border-color: #f44336; }
    .remove-pin-btn mat-icon { font-size: 20px; width: 20px; height: 20px; }

    /* ── Dark Mode ── */
    :host-context(body.dark) .pin-card { background: #13131f; }
    :host-context(body.dark) .pin-label { color: #b0b0cc; }
    :host-context(body.dark) .num-btn { background: #1e1e30; color: #e8e8f0; }
    :host-context(body.dark) .num-btn:active { background: #2a2a40; }
    :host-context(body.dark) .num-btn.clear { background: #2d1a1a; }
    :host-context(body.dark) .dot { border-color: #333355; }
    :host-context(body.dark) .info-banner {
      background: linear-gradient(135deg, #1a1a3a, #12122a);
      border-color: #2d2d5a;
    }
    :host-context(body.dark) .info-title { color: #e8e8f0; }
    :host-context(body.dark) .info-sub   { color: #8888aa; }
    :host-context(body.dark) .step-line  { background: #1e1e30; }
    :host-context(body.dark) .step-circle { background: #1e1e30; }
    :host-context(body.dark) .remove-pin-btn {
      background: #2d1a1a; border-color: #5a2a2a; color: #ef9a9a;
    }
  `]
})
export class SetPinComponent implements OnInit {
  currentPin = '';
  step1Pin = '';
  step2Pin = '';
  currentStep = 1;
  hasPin = false;
  errorMsg = '';

  private readonly PIN_KEY_PREFIX = 'wallet_pin_';

  constructor(
    private auth: AuthService,
    private snackBar: MatSnackBar
  ) { }

  ngOnInit(): void {
    const userId = this.auth.getUserId();
    this.hasPin = !!localStorage.getItem(`${this.PIN_KEY_PREFIX}${userId}`);
  }

  pressKey(key: string): void {
    if (this.currentPin.length < 4) {
      this.currentPin += key;
      this.errorMsg = '';
    }
  }

  clearPin(): void {
    if (this.currentPin.length > 0) {
      this.currentPin = this.currentPin.slice(0, -1);
    }
    this.errorMsg = '';
  }

  confirmStep(): void {
    if (this.currentPin.length < 4) return;

    const userId = this.auth.getUserId();
    const storedPin = localStorage.getItem(`${this.PIN_KEY_PREFIX}${userId}`);

    if (!this.hasPin) {
      // New PIN flow: Step 1 = create, Step 2 = confirm
      if (this.currentStep === 1) {
        this.step1Pin = this.currentPin;
        this.currentPin = '';
        this.currentStep = 2;
      } else {
        if (this.currentPin === this.step1Pin) {
          localStorage.setItem(`${this.PIN_KEY_PREFIX}${userId}`, this.currentPin);
          this.snackBar.open('PIN set successfully! 🔒', 'Close', { duration: 3000 });
          this.hasPin = true;
          this.currentPin = '';
          this.currentStep = 1;
          this.step1Pin = '';
        } else {
          this.errorMsg = 'PINs do not match. Try again.';
          this.currentPin = '';
          this.currentStep = 1;
          this.step1Pin = '';
        }
      }
    } else {
      // Change PIN flow: Step 1 = verify old, Step 2 = new, Step 3 = confirm new
      if (this.currentStep === 1) {
        if (this.currentPin === storedPin) {
          this.currentPin = '';
          this.currentStep = 2;
          this.errorMsg = '';
        } else {
          this.errorMsg = 'Incorrect PIN. Try again.';
          this.currentPin = '';
        }
      } else if (this.currentStep === 2) {
        this.step1Pin = this.currentPin;
        this.currentPin = '';
        this.currentStep = 3;
      } else {
        if (this.currentPin === this.step1Pin) {
          localStorage.setItem(`${this.PIN_KEY_PREFIX}${userId}`, this.currentPin);
          this.snackBar.open('PIN changed successfully! 🔒', 'Close', { duration: 3000 });
          this.currentPin = '';
          this.currentStep = 1;
          this.step1Pin = '';
        } else {
          this.errorMsg = 'PINs do not match. Try again.';
          this.currentPin = '';
          this.currentStep = 2;
          this.step1Pin = '';
        }
      }
    }
  }

  removePin(): void {
    const userId = this.auth.getUserId();
    localStorage.removeItem(`${this.PIN_KEY_PREFIX}${userId}`);
    this.hasPin = false;
    this.snackBar.open('PIN removed. Transfers are now unprotected.', 'Close', { duration: 3000 });
  }
}
