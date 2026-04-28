import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ApiService } from '../../../core/services/api';
import { AuthService } from '../../../core/services/auth';
import { ContactsService, Contact } from '../../../core/services/contacts';

@Component({
  selector: 'app-transfer',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, MatIconModule, MatSnackBarModule],
  template: `
    <div class="spinner-overlay" *ngIf="loading"><div class="spinner"></div></div>

    <!-- PIN Overlay -->
    <div class="pin-overlay" *ngIf="showPinPrompt">
      <div class="pin-modal">
        <div class="pin-header">
          <div class="pin-icon"><mat-icon>lock</mat-icon></div>
          <h3 class="card-title-small">Enter Transaction PIN</h3>
          <p class="pin-desc">Confirm your identity to send &#8377;{{ amount | number:'1.0-0' }} to {{ receiverName }}</p>
        </div>
        <div class="pin-dots">
          <div class="dot" *ngFor="let i of [0,1,2,3]" [class.filled]="enteredPin.length > i"></div>
        </div>
        <p class="pin-error" *ngIf="pinError">{{ pinError }}</p>
        <div class="numpad">
          <button class="num-btn" *ngFor="let n of [1,2,3,4,5,6,7,8,9]" (click)="pinKey(n.toString())">{{ n }}</button>
          <button class="num-btn clear" (click)="pinClear()"><mat-icon>backspace</mat-icon></button>
          <button class="num-btn" (click)="pinKey('0')">0</button>
          <button class="num-btn confirm" [disabled]="enteredPin.length < 4" (click)="verifyPin()"><mat-icon>check</mat-icon></button>
        </div>
        <button class="cancel-pin" (click)="cancelPin()">Cancel</button>
      </div>
    </div>

    <div class="page-container fade-in">
      <div class="page-header">
        <h1 class="page-title">Transfer Money</h1>
        <p class="page-subtitle">Send funds instantly to any registered user.</p>
      </div>

      <!-- KYC Block -->
      <div class="kyc-banner" *ngIf="kycBlocked && !loading">
        <mat-icon>lock</mat-icon>
        <div>
          <h3>Wallet Restricted</h3>
          <p>Your KYC is <strong style="color: var(--danger);">{{ kycStatus === 'Rejected' ? 'rejected' : 'pending approval' }}</strong>. Complete KYC to use wallet services.</p>
        </div>
        <a routerLink="/profile" class="kyc-btn">{{ kycStatus === 'Rejected' ? 'Resubmit KYC' : 'View Status' }} →</a>
      </div>

      <ng-container *ngIf="!kycBlocked">

        <!-- Recent Contacts -->
        <div class="wa-card" *ngIf="recentContacts.length > 0 && !receiverName">
          <h3 class="card-title-small" style="margin-bottom: 16px; display: flex; align-items: center; gap: 8px;">
            <mat-icon style="font-size: 18px; width: 18px; height: 18px; color: var(--teal);">history</mat-icon> Recent
          </h3>
          <div class="contacts-row">
            <div class="contact-item" *ngFor="let c of recentContacts" (click)="selectContact(c)">
              <div class="contact-avatar">{{ getInitials(c.name) }}</div>
              <span class="contact-name">{{ c.name.split(' ')[0] }}</span>
            </div>
          </div>
        </div>

        <!-- Receiver -->
        <div class="wa-card">
          <h3 class="card-title-small" style="margin-bottom: 16px; display: flex; align-items: center; gap: 8px;">
            <mat-icon style="font-size: 18px; width: 18px; height: 18px; color: var(--teal);">person_search</mat-icon> Find Receiver
          </h3>
          
          <div class="email-wrap" [class.found]="receiverName" [class.err]="receiverError">
            <mat-icon>alternate_email</mat-icon>
            <input type="email" [(ngModel)]="receiverEmail" placeholder="Enter receiver's email" (blur)="lookupReceiver()"/>
            <div class="mini-spin" *ngIf="lookingUp"></div>
            <mat-icon class="status-ic ok" *ngIf="receiverName">check_circle</mat-icon>
            <mat-icon class="status-ic err" *ngIf="receiverError && !lookingUp">error</mat-icon>
          </div>
          
          <div class="receiver-found" *ngIf="receiverName">
            <div class="recv-avatar">{{ getInitials(receiverName) }}</div>
            <div class="recv-info"><p class="recv-name">{{ receiverName }}</p><p class="recv-email">{{ receiverEmail }}</p></div>
            <mat-icon class="verified-ic">verified</mat-icon>
          </div>
          <p class="err-msg" *ngIf="receiverError && !lookingUp"><mat-icon>info</mat-icon>{{ receiverError }}</p>
        </div>

        <!-- Amount -->
        <div class="wa-card" *ngIf="receiverName">
          <h3 class="card-title-small" style="margin-bottom: 16px; display: flex; align-items: center; gap: 8px;">
            <mat-icon style="font-size: 18px; width: 18px; height: 18px; color: var(--teal);">currency_rupee</mat-icon> Enter Amount
          </h3>
          <div class="amount-row">
            <span class="currency">&#8377;</span>
            <input class="amount-input" type="number" [(ngModel)]="amount" placeholder="0"/>
          </div>
          <div class="quick-row">
            <button *ngFor="let a of quickAmounts" class="quick-chip" [class.active]="amount===a" (click)="amount=a">&#8377;{{ a | number }}</button>
          </div>
          <br>
          <div class="wa-label">Add a note (Optional)</div>
          <div class="wa-input-wrap">
            <mat-icon>edit_note</mat-icon>
            <input [(ngModel)]="note" placeholder="What is this for?"/>
          </div>
        </div>

        <!-- Summary -->
        <div class="wa-card" *ngIf="receiverName && amount > 0">
          <div class="sum-row"><span>Sending to</span><span class="sum-val">{{ receiverName }}</span></div>
          <div class="sum-row"><span>Amount</span><span class="sum-accent">&#8377;{{ amount | number:'1.2-2' }}</span></div>
          <div class="sum-row" *ngIf="note"><span>Note</span><span class="sum-val">{{ note }}</span></div>
          <div class="sum-row" *ngIf="hasPin">
            <span>Security</span>
            <span class="sum-pin"><mat-icon>lock</mat-icon>PIN required</span>
          </div>
        </div>

        <!-- Send Button -->
        <button class="wa-btn-primary full-width" *ngIf="receiverName" (click)="initTransfer()" [disabled]="loading || !amount || amount <= 0" style="margin-top: 12px; margin-bottom: 12px;">
          <mat-icon>{{ hasPin ? 'lock' : 'send' }}</mat-icon>
          {{ hasPin ? 'Send with PIN' : 'Send' }} &#8377;{{ amount > 0 ? (amount | number:'1.0-0') : '0' }}
        </button>

        <!-- No PIN Warning -->
        <div class="no-pin-warn" *ngIf="receiverName && !hasPin">
          <mat-icon>warning_amber</mat-icon>
          <span>No PIN set. <a routerLink="/set-pin">Set a PIN</a> to secure transfers.</span>
        </div>

      </ng-container>
    </div>
  `,
  styles: [`
    .page-container { max-width: 600px; margin: 0 auto; padding-bottom: 32px; }
    .page-header { margin-bottom: 32px; }
    .page-title { font-size: 32px; font-weight: 800; color: var(--text-primary); font-family: 'Outfit', sans-serif; margin-bottom: 8px; letter-spacing: -1px; }
    .page-subtitle { color: var(--text-secondary); font-size: 15px; margin: 0; }

    .pin-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); backdrop-filter: blur(8px); z-index: 1000; display: flex; align-items: center; justify-content: center; animation: fadeIn 0.2s ease; }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    .pin-modal { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--r-xl); padding: 32px 24px; width: 320px; box-shadow: 0 24px 64px rgba(0,0,0,0.5); text-align: center; animation: slideUp 0.3s cubic-bezier(0.34,1.56,0.64,1); }
    @keyframes slideUp { from { opacity: 0; transform: translateY(40px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }
    
    .pin-header { margin-bottom: 24px; }
    .pin-icon { width: 56px; height: 56px; border-radius: 16px; background: rgba(192, 133, 82, 0.1); border: 1px solid rgba(192, 133, 82, 0.2); display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; }
    .pin-icon mat-icon { color: var(--teal); font-size: 28px; width: 28px; height: 28px; }
    .pin-desc { margin: 8px 0 0; font-size: 13px; color: var(--text-muted); line-height: 1.5; }
    
    .pin-dots { display: flex; justify-content: center; gap: 16px; margin-bottom: 12px; }
    .dot { width: 14px; height: 14px; border-radius: 50%; border: 2px solid var(--border); transition: all 0.2s cubic-bezier(0.34,1.56,0.64,1); }
    .dot.filled { background: var(--teal); border-color: var(--teal); transform: scale(1.2); box-shadow: 0 0 10px rgba(192, 133, 82, 0.4); }
    .pin-error { color: var(--danger); font-size: 13px; margin-bottom: 12px; }
    
    .numpad { display: grid; grid-template-columns: repeat(3,1fr); gap: 10px; max-width: 240px; margin: 0 auto 16px; }
    .num-btn { height: 54px; border: 1px solid var(--border); border-radius: 12px; background: var(--bg); color: var(--text-primary); font-size: 22px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.15s ease; font-family: 'Outfit', sans-serif; }
    .num-btn:active { transform: scale(0.93); background: rgba(255,255,255,0.05); }
    .num-btn.clear { background: rgba(239,68,68,0.1); color: var(--danger); border-color: rgba(239,68,68,0.2); }
    .num-btn.confirm { background: var(--teal); color: #FFF; border-color: transparent; box-shadow: 0 4px 14px rgba(192, 133, 82, 0.35); }
    .num-btn.confirm:disabled { opacity: 0.4; cursor: not-allowed; transform: none; box-shadow: none; }
    
    .cancel-pin { width: 100%; padding: 12px; border: none; background: transparent; color: var(--text-secondary); font-size: 14px; font-weight: 600; cursor: pointer; font-family: 'Inter', sans-serif; transition: color 0.2s; }
    .cancel-pin:hover { color: var(--danger); }

    .kyc-banner { display: flex; align-items: center; gap: 16px; background: rgba(220, 38, 38, 0.08); border: 1px solid rgba(220, 38, 38, 0.2); border-radius: var(--r-lg); padding: 20px; margin-bottom: 24px; }
    .kyc-banner mat-icon { font-size: 28px; width: 28px; height: 28px; color: var(--danger); flex-shrink: 0; }
    .kyc-banner h3 { margin: 0 0 4px; font-size: 15px; font-weight: 700; color: var(--danger); }
    .kyc-banner p { margin: 0; font-size: 13px; color: var(--text-secondary); }
    .kyc-banner div { flex: 1; }
    .kyc-btn { border: 1px solid rgba(220, 38, 38, 0.4); background: var(--danger); color: #FFF; padding: 8px 14px; border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer; text-decoration: none; white-space: nowrap; }

    .wa-card { margin-bottom: 16px; }
    .full-width { width: 100%; }

    .contacts-row { display: flex; gap: 16px; overflow-x: auto; padding-bottom: 4px; }
    .contact-item { display: flex; flex-direction: column; align-items: center; gap: 8px; cursor: pointer; flex-shrink: 0; transition: transform 0.2s; }
    .contact-item:hover { transform: translateY(-3px); }
    .contact-avatar { width: 48px; height: 48px; border-radius: 14px; background: linear-gradient(135deg, var(--teal-light), var(--teal)); color: #FFF; font-size: 16px; font-weight: 800; display: flex; align-items: center; justify-content: center; }
    .contact-name { font-size: 12px; font-weight: 600; color: var(--text-secondary); }

    .email-wrap { display: flex; align-items: center; gap: 12px; border: 1px solid var(--border); border-radius: 10px; padding: 12px 14px; background: var(--bg); margin-bottom: 12px; transition: all 0.2s; }
    .email-wrap.found { border-color: #10B981; background: rgba(16,185,129,0.05); }
    .email-wrap.err   { border-color: var(--danger); background: rgba(239,68,68,0.05); }
    .email-wrap mat-icon { color: var(--text-muted); font-size: 18px; width: 18px; height: 18px; flex-shrink: 0; }
    .email-wrap input { flex: 1; border: none; outline: none; font-size: 14px; color: var(--text-primary); background: transparent; font-family: 'Inter', sans-serif; }
    .email-wrap input::placeholder { color: var(--text-muted); }
    
    .mini-spin { width: 16px; height: 16px; border: 2px solid var(--border); border-top-color: var(--teal); border-radius: 50%; animation: spin 0.6s linear infinite; flex-shrink: 0; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .status-ic { font-size: 18px; width: 18px; height: 18px; flex-shrink: 0; }
    .status-ic.ok  { color: #10B981; }
    .status-ic.err { color: var(--danger); }
    
    .receiver-found { display: flex; align-items: center; gap: 12px; background: rgba(16,185,129,0.08); border: 1px solid rgba(16,185,129,0.2); border-radius: 10px; padding: 12px 14px; }
    .recv-avatar { width: 40px; height: 40px; border-radius: 12px; background: linear-gradient(135deg, #10B981, #059669); color: white; font-size: 14px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .recv-info { flex: 1; }
    .recv-name  { margin: 0; font-size: 14px; font-weight: 700; color: var(--text-primary); }
    .recv-email { margin: 2px 0 0; font-size: 12px; color: var(--text-secondary); }
    .verified-ic { color: #10B981; font-size: 18px; width: 18px; height: 18px; }
    .err-msg { display: flex; align-items: center; gap: 6px; color: var(--danger); font-size: 12px; padding: 6px 0; margin: 0; }

    .amount-row { display: flex; align-items: center; justify-content: center; gap: 4px; padding: 16px 0; border-bottom: 1px solid var(--border); margin-bottom: 16px; }
    .currency { font-size: 32px; font-weight: 700; color: var(--text-muted); }
    .amount-input { border: none; outline: none; font-size: 56px; font-weight: 800; color: var(--text-primary); background: transparent; width: 220px; text-align: center; font-family: 'Outfit', sans-serif; -moz-appearance: textfield; letter-spacing: -2px; }
    .amount-input::-webkit-outer-spin-button, .amount-input::-webkit-inner-spin-button { -webkit-appearance: none; }
    
    .quick-row { display: flex; gap: 10px; flex-wrap: wrap; }
    .quick-chip { padding: 6px 14px; border: 1px solid var(--border); border-radius: 20px; background: var(--bg); color: var(--text-secondary); font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.2sease; font-family: 'Inter', sans-serif; }
    .quick-chip:hover { border-color: var(--teal-light); color: var(--teal); }
    .quick-chip.active { background: var(--teal); border-color: var(--teal); color: #FFF; box-shadow: 0 4px 12px rgba(192, 133, 82, 0.2); }

    .sum-row { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px dashed var(--border); font-size: 13px; color: var(--text-secondary); }
    .sum-row:last-child { border-bottom: none; }
    .sum-val { font-weight: 600; color: var(--text-primary); }
    .sum-accent { font-size: 18px; font-weight: 800; color: var(--teal); font-family: 'Outfit', sans-serif;}
    .sum-pin { display: flex; align-items: center; gap: 4px; font-weight: 600; color: var(--teal); font-size: 12px; }
    .sum-pin mat-icon { font-size: 14px; width: 14px; height: 14px; }

    .no-pin-warn { display: flex; align-items: center; gap: 10px; background: rgba(220, 38, 38, 0.08); border: 1px solid rgba(220, 38, 38, 0.2); border-radius: 10px; padding: 12px 16px; font-size: 13px; color: var(--danger); }
    .no-pin-warn a { color: var(--danger); font-weight: 700; text-decoration: underline; }
  `]
})
export class TransferComponent implements OnInit {
  receiverEmail = '';
  receiverUserId = '';
  receiverName = '';
  receiverError = '';
  lookingUp = false;
  amount = 0;
  note = '';
  loading = true;
  quickAmounts = [500, 1000, 2000, 5000];
  recentContacts: Contact[] = [];

  kycBlocked = false;
  kycStatus = '';

  hasPin = false;
  showPinPrompt = false;
  enteredPin = '';
  pinError = '';

  constructor(
    private api: ApiService,
    private auth: AuthService,
    private router: Router,
    private snackBar: MatSnackBar,
    private contacts: ContactsService
  ) {}

  ngOnInit(): void {
    this.recentContacts = this.contacts.getContacts();
    this.auth.getPinStatus().subscribe({
      next: (res) => { this.hasPin = !!res?.data?.hasPin; },
      error: () => { this.hasPin = false; }
    });
    this.api.get<any>('/api/auth/profile').subscribe({
      next: (res) => {
        if (res.success) { this.kycStatus = res.data.status; this.kycBlocked = res.data.status !== 'Active'; }
        this.loading = false;
      },
      error: () => { this.loading = false; }
    });
  }

  selectContact(contact: Contact): void {
    this.receiverEmail = contact.email;
    this.receiverUserId = contact.userId;
    this.receiverName = contact.name;
    this.receiverError = '';
    this.amount = contact.amount;
  }

  lookupReceiver(): void {
    if (!this.receiverEmail) return;
    this.receiverName = '';
    this.receiverError = '';
    this.receiverUserId = '';
    this.lookingUp = true;
    this.api.get<any>(`/api/wallet/by-email?email=${this.receiverEmail}`).subscribe({
      next: (res) => {
        if (res.success) {
          this.receiverUserId = res.data.userId;
          this.api.get<any>(`/api/auth/lookup-by-email?email=${encodeURIComponent(this.receiverEmail)}`).subscribe({
            next: (authRes) => { if (authRes.success) this.receiverName = authRes.data.fullName; this.lookingUp = false; },
            error: () => { this.receiverName = this.receiverEmail; this.lookingUp = false; }
          });
        } else {
          this.receiverError = 'User not found or wallet not activated.';
          this.lookingUp = false;
        }
      },
      error: () => { this.receiverError = 'User not found or wallet not activated.'; this.lookingUp = false; }
    });
  }

  initTransfer(): void {
    if (!this.receiverUserId || !this.amount || this.amount <= 0) {
      this.snackBar.open('Please fill in all fields', 'Close', { duration: 3000 }); return;
    }
    if (!this.hasPin) {
      this.snackBar.open('Set your transaction PIN before transferring money.', 'Close', { duration: 4000 });
      this.router.navigate(['/set-pin']); return;
    }
    this.enteredPin = '';
    this.pinError = '';
    this.showPinPrompt = true;
  }

  pinKey(key: string): void {
    if (this.enteredPin.length < 4) { this.enteredPin += key; this.pinError = ''; }
  }

  pinClear(): void { this.enteredPin = this.enteredPin.slice(0, -1); this.pinError = ''; }

  verifyPin(): void { this.showPinPrompt = false; this.executeTransfer(this.enteredPin); }

  cancelPin(): void { this.showPinPrompt = false; this.enteredPin = ''; this.pinError = ''; }

  private executeTransfer(transactionPin?: string): void {
    this.loading = true;
    this.api.post<any>('/api/wallet/transfer', {
      receiverUserId: this.receiverUserId,
      amount: this.amount,
      note: this.note,
      transactionPin
    }).subscribe({
      next: (res) => {
        if (res.success) {
          this.contacts.saveContact({ userId: this.receiverUserId, name: this.receiverName, email: this.receiverEmail, lastSent: new Date().toISOString(), amount: this.amount });
          this.snackBar.open(`Rs.${this.amount} sent to ${this.receiverName}!`, 'Close', { duration: 3000 });
          this.router.navigate(['/wallet/history']);
        } else {
          this.snackBar.open(res.message, 'Close', { duration: 4000 });
        }
        this.loading = false;
      },
      error: (err: any) => {
        this.snackBar.open(err?.error?.message ?? 'Transfer failed. Try again.', 'Close', { duration: 4000 });
        this.loading = false;
      }
    });
  }

  getInitials(name: string): string {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }
}
