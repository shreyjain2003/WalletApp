import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ApiService } from '../../../core/services/api';

@Component({
  selector: 'app-topup',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, MatIconModule, MatSnackBarModule],
  template: `
    <div class="spinner-overlay" *ngIf="loading"><div class="spinner"></div></div>
    
    <div class="page-container fade-in">
      <div class="page-header">
        <h1 class="page-title">Top Up Wallet</h1>
        <p class="page-subtitle">Add funds to your secure personal wallet.</p>
      </div>

      <div class="kyc-banner" *ngIf="kycBlocked && !loading">
        <mat-icon>lock</mat-icon>
        <div>
          <h3>Wallet Restricted</h3>
          <p>Your KYC is <strong style="color: var(--danger);">{{ kycStatus === 'Rejected' ? 'rejected' : 'pending approval' }}</strong>. Complete KYC to use wallet services.</p>
        </div>
        <a routerLink="/profile" class="kyc-btn">{{ kycStatus === 'Rejected' ? 'Resubmit KYC' : 'View Status' }} →</a>
      </div>

      <ng-container *ngIf="!kycBlocked">
        <div class="two-col">
          <!-- Left: amount input -->
          <div class="wa-card">
            <h3 class="card-title-small" style="margin-bottom: 24px;">Enter Amount</h3>
            <div class="amount-display">
              <span class="sym">₹</span>
              <input class="amount-input" type="number" [(ngModel)]="amount" placeholder="0"/>
            </div>
            <div class="quick-row">
              <button *ngFor="let a of [500,1000,2000,5000]" class="quick-chip" [class.active]="amount===a" (click)="amount=a">₹{{ a | number }}</button>
            </div>
            
            <div class="wa-label" style="margin-top: 24px;">Add a note (Optional)</div>
            <div class="wa-input-wrap">
              <mat-icon>edit_note</mat-icon>
              <input [(ngModel)]="note" placeholder="What is this for?"/>
            </div>
          </div>

          <!-- Right: summary + action -->
          <div class="wa-card" style="align-self: start;">
            <h3 class="card-title-small" style="margin-bottom: 16px;">Summary</h3>
            <div class="summary-rows">
              <div class="sum-row"><span>Adding to wallet</span><span class="sum-val teal">₹{{ amount > 0 ? (amount | number:'1.2-2') : '0.00' }}</span></div>
              <div class="sum-row"><span>Payment method</span><span class="sum-val">Mock Gateway</span></div>
              <div class="sum-row" *ngIf="note"><span>Note</span><span class="sum-val">{{ note }}</span></div>
            </div>
            <button class="wa-btn-primary" (click)="topUp()" [disabled]="loading || !amount || amount <= 0" style="margin-bottom: 20px;">
              <mat-icon>add_circle_outline</mat-icon> Add ₹{{ amount > 0 ? (amount | number:'1.0-0') : '0' }}
            </button>
            <div class="info-chips">
              <div class="chip"><mat-icon>bolt</mat-icon>Instant</div>
              <div class="chip"><mat-icon>security</mat-icon>Secure</div>
              <div class="chip"><mat-icon>workspace_premium</mat-icon>Points</div>
            </div>
          </div>
        </div>
      </ng-container>
    </div>
  `,
  styles: [`
    .page-container { max-width: 1000px; margin: 0 auto; }
    .page-header { margin-bottom: 32px; }
    .page-title { font-size: 32px; font-weight: 800; color: var(--text-primary); font-family: 'Outfit', sans-serif; margin-bottom: 8px; letter-spacing: -1px; }
    .page-subtitle { color: var(--text-secondary); font-size: 15px; margin: 0; }
    
    .kyc-banner { display: flex; align-items: center; gap: 16px; background: rgba(220, 38, 38, 0.08); border: 1px solid rgba(220, 38, 38, 0.2); border-radius: var(--r-lg); padding: 20px; margin-bottom: 24px; }
    .kyc-banner mat-icon { font-size: 28px; width: 28px; height: 28px; color: var(--danger); flex-shrink: 0; }
    .kyc-banner h3 { margin: 0 0 4px; font-size: 15px; font-weight: 700; color: var(--danger); }
    .kyc-banner p { margin: 0; font-size: 13px; color: var(--text-secondary); }
    .kyc-banner div { flex: 1; }
    .kyc-btn { border: 1px solid rgba(220, 38, 38, 0.4); background: var(--danger); color: #FFF; padding: 8px 14px; border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer; text-decoration: none; white-space: nowrap; }
    
    .two-col { display: grid; grid-template-columns: 1fr 340px; gap: 24px; }
    
    .amount-display { display: flex; align-items: center; justify-content: center; gap: 4px; padding: 32px 0; border-bottom: 1px solid var(--border); margin-bottom: 24px; }
    .sym { font-size: 32px; font-weight: 700; color: var(--text-muted); }
    .amount-input { border: none; outline: none; font-size: 64px; font-weight: 800; color: var(--text-primary); background: transparent; width: 260px; text-align: center; font-family: 'Outfit', sans-serif; -moz-appearance: textfield; letter-spacing: -2px; }
    .amount-input::-webkit-outer-spin-button, .amount-input::-webkit-inner-spin-button { -webkit-appearance: none; }
    
    .quick-row { display: flex; gap: 12px; flex-wrap: wrap; }
    .quick-chip { padding: 8px 16px; border: 1px solid var(--border); border-radius: 20px; background: var(--bg); color: var(--text-secondary); font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.2s; }
    .quick-chip:hover { border-color: var(--teal-light); color: var(--teal); background: rgba(192, 133, 82, 0.05); }
    .quick-chip.active { background: var(--teal); border-color: var(--teal); color: #FFF; box-shadow: 0 4px 12px rgba(192, 133, 82, 0.2); }
    
    .summary-rows { margin-bottom: 24px; }
    .sum-row { display: flex; justify-content: space-between; align-items: center; padding: 14px 0; border-bottom: 1px dashed var(--border); font-size: 13px; color: var(--text-secondary); }
    .sum-row:last-child { border-bottom: none; }
    .sum-val { font-weight: 600; color: var(--text-primary); }
    .sum-val.teal { font-size: 20px; font-weight: 800; color: var(--teal); font-family: 'Outfit', sans-serif; }
    
    .info-chips { display: flex; gap: 12px; }
    .chip { flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px; background: var(--bg); border: 1px solid var(--border); border-radius: 8px; padding: 10px 8px; font-size: 11px; font-weight: 600; color: var(--text-secondary); }
    .chip mat-icon { font-size: 16px; width: 16px; height: 16px; color: var(--teal); }
    
    @media (max-width: 900px) { .two-col { grid-template-columns: 1fr; } }
  `]
})
export class TopupComponent implements OnInit {
  amount = 0; note = ''; loading = true; kycBlocked = false; kycStatus = '';
  constructor(private api: ApiService, private router: Router, private snackBar: MatSnackBar) {}
  ngOnInit(): void {
    this.api.get<any>('/api/auth/profile').subscribe({
      next: (res) => { if (res.success) { this.kycStatus = res.data.status; this.kycBlocked = res.data.status !== 'Active'; } this.loading = false; },
      error: () => this.loading = false
    });
  }
  topUp(): void {
    if (!this.amount || this.amount <= 0) { this.snackBar.open('Enter a valid amount', 'Close', { duration: 3000 }); return; }
    this.loading = true;
    this.api.post<any>('/api/wallet/topup', { amount: this.amount, note: this.note }).subscribe({
      next: (res) => { if (res.success) { this.snackBar.open(`₹${this.amount} added successfully!`, 'Close', { duration: 3000 }); this.router.navigate(['/wallet/history']); } else { this.snackBar.open(res.message, 'Close', { duration: 3000 }); } this.loading = false; },
      error: (err: any) => { this.snackBar.open(err?.error?.message ?? 'Top up failed', 'Close', { duration: 3000 }); this.loading = false; }
    });
  }
}
