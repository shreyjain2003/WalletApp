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
        <div class="info-banner">
          <mat-icon>shield</mat-icon>
          <div>
            <p class="info-title">Secure Your Transfers</p>
            <p class="info-sub">
              A 4-digit PIN will be required before every money transfer.
            </p>
          </div>
        </div>

        <div class="steps">
          <div class="step" [class.active]="currentStep === 1" [class.done]="currentStep > 1">
            <div class="step-circle">{{ currentStep > 1 ? '?' : '1' }}</div>
            <span>{{ hasPin ? 'Enter current PIN' : 'Create PIN' }}</span>
          </div>
          <div class="step-line"></div>
          <div class="step" [class.active]="currentStep === 2" [class.done]="currentStep > 2">
            <div class="step-circle">{{ currentStep > 2 ? '?' : '2' }}</div>
            <span>{{ hasPin ? 'New PIN' : 'Confirm PIN' }}</span>
          </div>
          <div class="step-line" *ngIf="hasPin"></div>
          <div class="step" *ngIf="hasPin" [class.active]="currentStep === 3">
            <div class="step-circle">3</div>
            <span>Confirm PIN</span>
          </div>
        </div>

        <div class="pin-card">
          <p class="pin-label">
            <span *ngIf="currentStep === 1 && !hasPin">Enter your new 4-digit PIN</span>
            <span *ngIf="currentStep === 1 && hasPin">Enter your current PIN</span>
            <span *ngIf="currentStep === 2 && !hasPin">Confirm your PIN</span>
            <span *ngIf="currentStep === 2 && hasPin">Enter your new 4-digit PIN</span>
            <span *ngIf="currentStep === 3">Confirm your new PIN</span>
          </p>

          <div class="pin-dots">
            <div class="dot" *ngFor="let i of [0,1,2,3]"
                 [class.filled]="currentPin.length > i">
            </div>
          </div>

          <p class="pin-error" *ngIf="errorMsg">{{ errorMsg }}</p>

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
    .steps { display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 28px; }
    .step { display: flex; flex-direction: column; align-items: center; gap: 6px; }
    .step-circle {
      width: 32px; height: 32px; border-radius: 50%;
      background: #e8e8f0; color: #999; font-size: 13px; font-weight: 700;
      display: flex; align-items: center; justify-content: center; transition: all 0.3s ease;
    }
    .step.active .step-circle { background: #3f51b5; color: white; box-shadow: 0 4px 12px rgba(63,81,181,0.4); }
    .step.done .step-circle { background: #00c853; color: white; }
    .step span { font-size: 11px; color: #999; font-weight: 500; white-space: nowrap; }
    .step.active span { color: #3f51b5; font-weight: 700; }
    .step-line { width: 40px; height: 2px; background: #e8e8f0; margin-bottom: 18px; }
    .pin-card {
      background: white; border-radius: 24px; padding: 28px 24px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.08); margin-bottom: 16px; text-align: center;
    }
    .pin-label { font-size: 15px; font-weight: 600; color: #444; margin-bottom: 24px; }
    .pin-dots { display: flex; justify-content: center; gap: 16px; margin-bottom: 16px; }
    .dot {
      width: 18px; height: 18px; border-radius: 50%; border: 2px solid #d0d0e0;
      transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    .dot.filled {
      background: #3f51b5; border-color: #3f51b5; transform: scale(1.15);
      box-shadow: 0 4px 12px rgba(63,81,181,0.4);
    }
    .pin-error { color: #f44336; font-size: 13px; font-weight: 500; margin-bottom: 16px; }
    .numpad { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; max-width: 280px; margin: 0 auto; }
    .num-btn {
      height: 64px; border: none; border-radius: 16px; background: #f5f5f8; color: #1a1a2e;
      font-size: 22px; font-weight: 700; cursor: pointer; display: flex; align-items: center;
      justify-content: center; transition: all 0.15s ease; font-family: 'Inter', sans-serif;
      box-shadow: 0 2px 8px rgba(0,0,0,0.06);
    }
    .num-btn:active { transform: scale(0.93); background: #e8e8f0; }
    .num-btn.clear { background: #fff0f0; color: #f44336; }
    .num-btn.clear mat-icon { font-size: 22px; width: 22px; height: 22px; }
    .num-btn.confirm {
      background: linear-gradient(135deg, #3f51b5, #7c4dff); color: white;
      box-shadow: 0 4px 16px rgba(63,81,181,0.4);
    }
    .num-btn.confirm mat-icon { font-size: 24px; width: 24px; height: 24px; }
    .num-btn.confirm:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }
    .remove-pin-btn {
      width: 100%; padding: 14px; border: 2px solid #ffcdd2; border-radius: 14px;
      background: #fff5f5; color: #f44336; font-size: 14px; font-weight: 600; cursor: pointer;
      display: flex; align-items: center; justify-content: center; gap: 8px; font-family: 'Inter', sans-serif;
      transition: all 0.2s ease;
    }
    .remove-pin-btn:hover { background: #ffebee; border-color: #f44336; }
    .remove-pin-btn mat-icon { font-size: 20px; width: 20px; height: 20px; }
  `]
})
export class SetPinComponent implements OnInit {
  currentPin = '';
  step1Pin = '';
  currentStoredPin = '';
  currentStep = 1;
  hasPin = false;
  errorMsg = '';

  constructor(
    private auth: AuthService,
    private snackBar: MatSnackBar
  ) { }

  ngOnInit(): void {
    this.loadPinStatus();
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

    if (!this.hasPin) {
      if (this.currentStep === 1) {
        this.step1Pin = this.currentPin;
        this.currentPin = '';
        this.currentStep = 2;
        return;
      }

      if (this.currentPin !== this.step1Pin) {
        this.errorMsg = 'PINs do not match. Try again.';
        this.currentPin = '';
        this.currentStep = 1;
        this.step1Pin = '';
        return;
      }

      this.auth.setPin({
        currentPin: null,
        newPin: this.step1Pin,
        confirmPin: this.currentPin
      }).subscribe({
        next: (res) => {
          if (res.success) {
            this.snackBar.open('PIN set successfully!', 'Close', { duration: 3000 });
            this.hasPin = true;
            this.resetFlow();
          } else {
            this.errorMsg = res.message;
            this.currentPin = '';
          }
        },
        error: (err) => {
          this.errorMsg = err?.error?.message ?? 'Failed to set PIN.';
          this.currentPin = '';
        }
      });
      return;
    }

    if (this.currentStep === 1) {
      this.currentStoredPin = this.currentPin;
      this.currentPin = '';
      this.currentStep = 2;
      return;
    }

    if (this.currentStep === 2) {
      this.step1Pin = this.currentPin;
      this.currentPin = '';
      this.currentStep = 3;
      return;
    }

    if (this.currentPin !== this.step1Pin) {
      this.errorMsg = 'PINs do not match. Try again.';
      this.currentPin = '';
      this.currentStep = 2;
      return;
    }

    this.auth.setPin({
      currentPin: this.currentStoredPin,
      newPin: this.step1Pin,
      confirmPin: this.currentPin
    }).subscribe({
      next: (res) => {
        if (res.success) {
          this.snackBar.open('PIN changed successfully!', 'Close', { duration: 3000 });
          this.resetFlow();
        } else {
          this.errorMsg = res.message;
          this.currentPin = '';
          this.currentStep = 1;
          this.step1Pin = '';
          this.currentStoredPin = '';
        }
      },
      error: (err) => {
        this.errorMsg = err?.error?.message ?? 'Failed to update PIN.';
        this.currentPin = '';
        this.currentStep = 1;
        this.step1Pin = '';
        this.currentStoredPin = '';
      }
    });
  }

  removePin(): void {
    if (this.currentPin.length < 4) {
      this.errorMsg = 'Enter your current PIN to remove it.';
      return;
    }

    this.auth.removePin(this.currentPin).subscribe({
      next: (res) => {
        if (res.success) {
          this.hasPin = false;
          this.snackBar.open('PIN removed successfully.', 'Close', { duration: 3000 });
          this.resetFlow();
        } else {
          this.errorMsg = res.message;
          this.currentPin = '';
        }
      },
      error: (err) => {
        this.errorMsg = err?.error?.message ?? 'Failed to remove PIN.';
        this.currentPin = '';
      }
    });
  }

  private loadPinStatus(): void {
    this.auth.getPinStatus().subscribe({
      next: (res) => {
        this.hasPin = !!res?.data?.hasPin;
      },
      error: () => {
        this.hasPin = false;
      }
    });
  }

  private resetFlow(): void {
    this.currentPin = '';
    this.step1Pin = '';
    this.currentStoredPin = '';
    this.currentStep = 1;
    this.errorMsg = '';
    this.loadPinStatus();
  }
}
