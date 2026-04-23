import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { AuthService } from '../../core/services/auth';

@Component({
  selector: 'app-set-pin',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatSnackBarModule],
  template: `
    <div class="page-container fade-in">
      <div class="page-header">
        <h1 class="page-title">{{ hasPin ? 'Change PIN' : 'Set Transaction PIN' }}</h1>
        <p class="page-subtitle">A 4-digit PIN is required before every money transfer to protect your account.</p>
      </div>

      <div class="pin-layout">
        <div class="wa-card">
          <div class="info-icon"><mat-icon>shield</mat-icon></div>
          <h3 class="card-title-small" style="margin-bottom: 24px;">Follow the steps</h3>
          <div class="step-indicator">
            <div class="step" [class.active]="currentStep === 1" [class.done]="currentStep > 1">
              <div class="step-dot">{{ currentStep > 1 ? '✓' : '1' }}</div>
              <span>{{ hasPin ? 'Current PIN' : 'Create PIN' }}</span>
            </div>
            <div class="step-line"></div>
            <div class="step" [class.active]="currentStep === 2" [class.done]="currentStep > 2">
              <div class="step-dot">{{ currentStep > 2 ? '✓' : '2' }}</div>
              <span>{{ hasPin ? 'New PIN' : 'Confirm PIN' }}</span>
            </div>
            <ng-container *ngIf="hasPin">
              <div class="step-line"></div>
              <div class="step" [class.active]="currentStep === 3">
                <div class="step-dot">3</div><span>Confirm</span>
              </div>
            </ng-container>
          </div>
        </div>

        <div class="wa-card pin-card">
          <p class="pin-label">
            <span *ngIf="currentStep === 1 && !hasPin">Enter your new 4-digit PIN</span>
            <span *ngIf="currentStep === 1 && hasPin">Enter your current PIN</span>
            <span *ngIf="currentStep === 2 && !hasPin">Confirm your PIN</span>
            <span *ngIf="currentStep === 2 && hasPin">Enter your new PIN</span>
            <span *ngIf="currentStep === 3">Confirm your new PIN</span>
          </p>
          <div class="pin-dots">
            <div class="dot" *ngFor="let i of [0,1,2,3]" [class.filled]="currentPin.length > i"></div>
          </div>
          <p class="pin-error" *ngIf="errorMsg">{{ errorMsg }}</p>
          
          <div class="numpad">
            <button class="num-btn" *ngFor="let n of [1,2,3,4,5,6,7,8,9]" (click)="pressKey(n.toString())">{{ n }}</button>
            <button class="num-btn clear" (click)="clearPin()"><mat-icon>backspace</mat-icon></button>
            <button class="num-btn" (click)="pressKey('0')">0</button>
            <button class="num-btn confirm" [disabled]="currentPin.length < 4" (click)="confirmStep()"><mat-icon>check</mat-icon></button>
          </div>
          
          <button class="remove-btn" *ngIf="hasPin && currentStep === 1" (click)="removePin()">
            <mat-icon>lock_open</mat-icon> Remove PIN Protection
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .page-container { max-width: 800px; margin: 0 auto; padding-bottom: 32px; }
    .page-header { margin-bottom: 32px; display: flex; flex-direction: column; }
    .page-title { font-size: 32px; font-weight: 800; color: var(--text-primary); font-family: 'Outfit', sans-serif; margin-bottom: 8px; letter-spacing: -1px; }
    .page-subtitle { color: var(--text-secondary); font-size: 15px; margin: 0; }

    .pin-layout { display: grid; grid-template-columns: 1fr 380px; gap: 24px; align-items: start; }
    
    .info-icon { width: 48px; height: 48px; border-radius: 12px; background: rgba(192, 133, 82, 0.1); border: 1px solid rgba(192, 133, 82, 0.2); display: flex; align-items: center; justify-content: center; margin-bottom: 16px; }
    .info-icon mat-icon { color: var(--teal); font-size: 24px; width: 24px; height: 24px; }
    
    .step-indicator { display: flex; align-items: center; gap: 8px; margin-top: 16px; }
    .step { display: flex; flex-direction: column; align-items: center; gap: 8px; }
    .step-dot { width: 32px; height: 32px; border-radius: 50%; background: var(--bg); border: 1px solid var(--border); color: var(--text-muted); font-size: 13px; font-weight: 700; display: flex; align-items: center; justify-content: center; transition: all 0.2s; }
    .step.active .step-dot { background: var(--teal); border-color: var(--teal); color: #FFF; box-shadow: 0 0 12px rgba(192, 133, 82, 0.3); }
    .step.done .step-dot   { background: #10B981; border-color: #10B981; color: white; }
    .step span { font-size: 12px; color: var(--text-secondary); font-weight: 600; white-space: nowrap; }
    .step.active span { color: var(--teal); }
    .step-line { flex: 1; height: 2px; background: var(--border); margin-bottom: 18px; border-radius: 2px; }
    
    .pin-card { text-align: center; display: flex; flex-direction: column; align-items: center; }
    .pin-label { font-size: 15px; font-weight: 600; color: var(--text-secondary); margin-bottom: 24px; }
    
    .pin-dots { display: flex; justify-content: center; gap: 16px; margin-bottom: 20px; }
    .dot { width: 14px; height: 14px; border-radius: 50%; border: 2px solid var(--border); transition: all 0.2s cubic-bezier(0.34,1.56,0.64,1); }
    .dot.filled { background: var(--teal); border-color: var(--teal); transform: scale(1.2); box-shadow: 0 0 10px rgba(192, 133, 82, 0.4); }
    
    .pin-error { color: var(--danger); font-size: 13px; margin-bottom: 16px; font-weight: 500; }
    
    .numpad { display: grid; grid-template-columns: repeat(3,1fr); gap: 12px; width: 100%; max-width: 280px; margin: 0 auto 16px; }
    .num-btn { height: 60px; border: 1px solid var(--border); border-radius: 12px; background: var(--bg); color: var(--text-primary); font-size: 22px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.15s ease; font-family: 'Outfit', sans-serif; }
    .num-btn:active { transform: scale(0.93); background: rgba(255,255,255,0.05); }
    .num-btn:hover { border-color: var(--teal-light); color: var(--teal); }
    .num-btn.clear { background: rgba(239,68,68,0.1); color: var(--danger); border-color: rgba(239,68,68,0.2); }
    .num-btn.clear mat-icon { font-size: 22px; width: 22px; height: 22px; }
    .num-btn.confirm { background: var(--teal); color: #FFF; border-color: transparent; box-shadow: 0 4px 14px rgba(192, 133, 82, 0.35); }
    .num-btn.confirm:hover { border-color: transparent; color: #FFF; background: var(--teal-light); }
    .num-btn.confirm mat-icon { font-size: 24px; width: 24px; height: 24px; }
    .num-btn.confirm:disabled { opacity: 0.4; cursor: not-allowed; transform: none; box-shadow: none; background: var(--teal); }
    
    .remove-btn { width: 100%; padding: 14px; border: 1px solid rgba(239,68,68,0.3); border-radius: 10px; background: rgba(239,68,68,0.08); color: var(--danger); font-size: 13px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; font-family: 'Inter', sans-serif; transition: all 0.2s ease; margin-top: 12px; }
    .remove-btn:hover { background: rgba(239,68,68,0.15); border-color: rgba(239,68,68,0.5); }
    .remove-btn mat-icon { font-size: 18px; width: 18px; height: 18px; }
    
    @media (max-width: 900px) { .pin-layout { grid-template-columns: 1fr; } }
  `]
})
export class SetPinComponent implements OnInit {
  currentPin = ''; step1Pin = ''; currentStoredPin = ''; currentStep = 1; hasPin = false; errorMsg = '';
  constructor(private auth: AuthService, private snackBar: MatSnackBar) {}
  ngOnInit(): void { this.loadPinStatus(); }
  pressKey(key: string): void { if (this.currentPin.length < 4) { this.currentPin += key; this.errorMsg = ''; } }
  clearPin(): void { if (this.currentPin.length > 0) { this.currentPin = this.currentPin.slice(0, -1); } this.errorMsg = ''; }
  confirmStep(): void {
    if (this.currentPin.length < 4) return;
    if (!this.hasPin) {
      if (this.currentStep === 1) { this.step1Pin = this.currentPin; this.currentPin = ''; this.currentStep = 2; return; }
      if (this.currentPin !== this.step1Pin) { this.errorMsg = 'PINs do not match. Try again.'; this.currentPin = ''; this.currentStep = 1; this.step1Pin = ''; return; }
      this.auth.setPin({ currentPin: null, newPin: this.step1Pin, confirmPin: this.currentPin }).subscribe({
        next: (res) => { if (res.success) { this.snackBar.open('PIN set successfully!', 'Close', { duration: 3000 }); this.hasPin = true; this.resetFlow(); } else { this.errorMsg = res.message; this.currentPin = ''; } },
        error: (err: any) => { this.errorMsg = err?.error?.message ?? 'Failed to set PIN.'; this.currentPin = ''; }
      });
      return;
    }
    if (this.currentStep === 1) { this.currentStoredPin = this.currentPin; this.currentPin = ''; this.currentStep = 2; return; }
    if (this.currentStep === 2) { this.step1Pin = this.currentPin; this.currentPin = ''; this.currentStep = 3; return; }
    if (this.currentPin !== this.step1Pin) { this.errorMsg = 'PINs do not match. Try again.'; this.currentPin = ''; this.currentStep = 2; return; }
    this.auth.setPin({ currentPin: this.currentStoredPin, newPin: this.step1Pin, confirmPin: this.currentPin }).subscribe({
      next: (res) => { if (res.success) { this.snackBar.open('PIN changed successfully!', 'Close', { duration: 3000 }); this.resetFlow(); } else { this.errorMsg = res.message; this.currentPin = ''; this.currentStep = 1; this.step1Pin = ''; this.currentStoredPin = ''; } },
      error: (err: any) => { this.errorMsg = err?.error?.message ?? 'Failed to update PIN.'; this.currentPin = ''; this.currentStep = 1; this.step1Pin = ''; this.currentStoredPin = ''; }
    });
  }
  removePin(): void {
    if (this.currentPin.length < 4) { this.errorMsg = 'Enter your current PIN to remove it.'; return; }
    this.auth.removePin(this.currentPin).subscribe({
      next: (res) => { if (res.success) { this.hasPin = false; this.snackBar.open('PIN removed.', 'Close', { duration: 3000 }); this.resetFlow(); } else { this.errorMsg = res.message; this.currentPin = ''; } },
      error: (err: any) => { this.errorMsg = err?.error?.message ?? 'Failed to remove PIN.'; this.currentPin = ''; }
    });
  }
  private loadPinStatus(): void { this.auth.getPinStatus().subscribe({ next: (res) => { this.hasPin = !!res?.data?.hasPin; }, error: () => { this.hasPin = false; } }); }
  private resetFlow(): void { this.currentPin = ''; this.step1Pin = ''; this.currentStoredPin = ''; this.currentStep = 1; this.errorMsg = ''; this.loadPinStatus(); }
}
