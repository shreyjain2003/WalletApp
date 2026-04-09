import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ApiService } from '../../../core/services/api';
import { AuthService } from '../../../core/services/auth';
import { ContactsService, Contact } from '../../../core/services/contacts';

@Component({
  selector: 'app-transfer',
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

    <!-- PIN Overlay -->
    <div class="pin-overlay" *ngIf="showPinPrompt">
      <div class="pin-modal">
        <div class="pin-modal-header">
          <div class="pin-lock-icon">
            <mat-icon>lock</mat-icon>
          </div>
          <h3>Enter Transaction PIN</h3>
          <p>Confirm your identity to send ₹{{ amount | number:'1.0-0' }} to {{ receiverName }}</p>
        </div>
        <div class="pin-dots">
          <div class="dot" *ngFor="let i of [0,1,2,3]"
               [class.filled]="enteredPin.length > i"></div>
        </div>
        <p class="pin-error" *ngIf="pinError">{{ pinError }}</p>
        <div class="numpad">
          <button class="num-btn" *ngFor="let n of [1,2,3,4,5,6,7,8,9]"
                  (click)="pinKey(n.toString())">{{ n }}</button>
          <button class="num-btn clear" (click)="pinClear()">
            <mat-icon>backspace</mat-icon>
          </button>
          <button class="num-btn" (click)="pinKey('0')">0</button>
          <button class="num-btn confirm"
                  [disabled]="enteredPin.length < 4"
                  (click)="verifyPin()">
            <mat-icon>check</mat-icon>
          </button>
        </div>
        <button class="cancel-pin-btn" (click)="cancelPin()">Cancel</button>
      </div>
    </div>

    <div class="page-container">
      <div class="navbar">
        <button mat-icon-button routerLink="/dashboard">
          <mat-icon>arrow_back</mat-icon>
        </button>
        <span class="title">Transfer Money</span>
        <div class="pin-badge" *ngIf="hasPin">
          <mat-icon>lock</mat-icon>
          <span>PIN Protected</span>
        </div>
      </div>

      <div class="content">

        <!-- KYC Blocked State -->
        <div class="kyc-blocked" *ngIf="kycBlocked && !loading">
          <div class="blocked-icon">
            <mat-icon>lock</mat-icon>
          </div>
          <h3>Wallet Restricted</h3>
          <p>
            Your KYC verification is
            <strong>{{ kycStatus === 'Rejected' ? 'rejected' : 'pending approval' }}</strong>.
            You cannot perform wallet operations until your KYC is approved by admin.
          </p>
          <div class="blocked-steps">
            <div class="blocked-step" [class.done]="true">
              <mat-icon>check_circle</mat-icon>
              <span>Account Created</span>
            </div>
            <div class="blocked-step">
              <mat-icon>{{ kycStatus === 'Approved' ? 'check_circle' : kycStatus === 'Rejected' ? 'cancel' : 'hourglass_empty' }}</mat-icon>
              <span>KYC {{ kycStatus === 'Approved' ? 'Approved' : kycStatus === 'Rejected' ? 'Rejected' : 'Under Review' }}</span>
            </div>
            <div class="blocked-step">
              <mat-icon>account_balance_wallet</mat-icon>
              <span>Wallet Active</span>
            </div>
          </div>
          <a routerLink="/profile" style="text-decoration:none; display:block">
            <button class="go-kyc-btn">
              <mat-icon>verified_user</mat-icon>
              {{ kycStatus === 'Rejected' ? 'Resubmit KYC' : 'View KYC Status' }}
            </button>
          </a>
        </div>

        <!-- Normal Transfer UI -->
        <ng-container *ngIf="!kycBlocked">

          <!-- Recent Contacts -->
          <div class="section-card" *ngIf="recentContacts.length > 0 && !receiverName">
            <p class="section-label">
              <mat-icon>history</mat-icon>
              Recent
            </p>
            <div class="contacts-row">
              <div class="contact-item"
                   *ngFor="let c of recentContacts"
                   (click)="selectContact(c)">
                <div class="contact-avatar">{{ getInitials(c.name) }}</div>
                <span class="contact-name">{{ c.name.split(' ')[0] }}</span>
                <span class="contact-amount">₹{{ c.amount | number:'1.0-0' }}</span>
              </div>
            </div>
          </div>

          <!-- Receiver Section -->
          <div class="section-card">
            <p class="section-label">
              <mat-icon>person_search</mat-icon>
              Find Receiver
            </p>
            <div class="email-input-wrap"
                 [class.active]="receiverName"
                 [class.error]="receiverError">
              <mat-icon class="input-icon">alternate_email</mat-icon>
              <input type="email"
                     [(ngModel)]="receiverEmail"
                     placeholder="Enter receiver's email"
                     (blur)="lookupReceiver()"/>
              <div class="mini-spinner" *ngIf="lookingUp"></div>
              <mat-icon class="status-icon success" *ngIf="receiverName">check_circle</mat-icon>
              <mat-icon class="status-icon error"
                        *ngIf="receiverError && !lookingUp">error</mat-icon>
            </div>
            <div class="receiver-found" *ngIf="receiverName">
              <div class="receiver-avatar">{{ getInitials(receiverName) }}</div>
              <div class="receiver-info">
                <p class="receiver-name">{{ receiverName }}</p>
                <p class="receiver-email">{{ receiverEmail }}</p>
              </div>
              <mat-icon class="verified-icon">verified</mat-icon>
            </div>
            <div class="error-msg" *ngIf="receiverError && !lookingUp">
              <mat-icon>info</mat-icon>
              {{ receiverError }}
            </div>
          </div>

          <!-- Amount Section -->
          <div class="section-card" *ngIf="receiverName">
            <p class="section-label">
              <mat-icon>currency_rupee</mat-icon>
              Enter Amount
            </p>
            <div class="amount-display">
              <span class="currency-symbol">₹</span>
              <input class="amount-input"
                     type="number"
                     [(ngModel)]="amount"
                     placeholder="0"/>
            </div>
            <div class="quick-amounts">
              <button *ngFor="let amt of quickAmounts"
                      class="quick-btn"
                      [class.selected]="amount === amt"
                      (click)="amount = amt">
                ₹{{ amt | number }}
              </button>
            </div>
            <div class="note-wrap">
              <mat-icon>edit_note</mat-icon>
              <input type="text"
                     [(ngModel)]="note"
                     placeholder="Add a note (optional)"/>
            </div>
          </div>

          <!-- Summary -->
          <div class="summary-card" *ngIf="receiverName && amount > 0">
            <div class="summary-row">
              <span>Sending to</span>
              <span class="summary-val">{{ receiverName }}</span>
            </div>
            <div class="summary-row">
              <span>Amount</span>
              <span class="summary-val amount">₹{{ amount | number:'1.2-2' }}</span>
            </div>
            <div class="summary-row" *ngIf="note">
              <span>Note</span>
              <span class="summary-val">{{ note }}</span>
            </div>
            <div class="summary-row" *ngIf="hasPin">
              <span>Security</span>
              <span class="summary-val pin-required">
                <mat-icon>lock</mat-icon>
                PIN required
              </span>
            </div>
          </div>

          <!-- Send Button -->
          <button class="send-btn"
                  *ngIf="receiverName"
                  (click)="initTransfer()"
                  [disabled]="loading || !amount || amount <= 0">
            <mat-icon>{{ hasPin ? 'lock' : 'send' }}</mat-icon>
            {{ hasPin ? 'Send with PIN' : 'Send' }} ₹{{ amount > 0 ? (amount | number:'1.0-0') : '0' }}
          </button>

          <!-- No PIN warning -->
          <div class="no-pin-warning" *ngIf="receiverName && !hasPin">
            <mat-icon>warning_amber</mat-icon>
            <span>No PIN set. <a routerLink="/set-pin">Set a PIN</a> to secure transfers.</span>
          </div>

        </ng-container>

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

    .pin-badge {
      display: flex; align-items: center; gap: 4px;
      background: rgba(255,255,255,0.2); padding: 4px 10px;
      border-radius: 20px; font-size: 11px; font-weight: 600;
    }
    .pin-badge mat-icon { font-size: 14px; width: 14px; height: 14px; }

    .content { padding: 20px 16px; max-width: 500px; margin: 0 auto; }

    /* ── KYC Blocked ── */
    .kyc-blocked {
      background: white; border-radius: 24px; padding: 36px 24px;
      text-align: center; box-shadow: 0 4px 24px rgba(0,0,0,0.08);
      margin-bottom: 16px;
    }
    .blocked-icon {
      width: 80px; height: 80px; border-radius: 50%;
      background: linear-gradient(135deg, #ff6d00, #ffab40);
      display: flex; align-items: center; justify-content: center;
      margin: 0 auto 20px; box-shadow: 0 8px 24px rgba(255,109,0,0.35);
    }
    .blocked-icon mat-icon { color: white; font-size: 40px; width: 40px; height: 40px; }
    .kyc-blocked h3 { margin: 0 0 12px; font-size: 22px; font-weight: 800; color: #1a1a2e; }
    .kyc-blocked p { color: #666; font-size: 14px; line-height: 1.7; margin-bottom: 28px; }
    .kyc-blocked p strong { color: #ff6d00; }
    .blocked-steps {
      display: flex; justify-content: center; align-items: center;
      gap: 8px; margin-bottom: 28px; flex-wrap: wrap;
    }
    .blocked-step {
      display: flex; flex-direction: column; align-items: center;
      gap: 4px; font-size: 11px; font-weight: 600; color: #aaa;
    }
    .blocked-step mat-icon { font-size: 24px; width: 24px; height: 24px; color: #ddd; }
    .blocked-step.done mat-icon { color: #00c853; }
    .blocked-step:nth-child(2) mat-icon { color: #ff6d00; }
    .go-kyc-btn {
      width: 100%; height: 52px;
      background: linear-gradient(135deg, #ff6d00, #ffab40);
      color: white; border: none; border-radius: 16px;
      font-size: 16px; font-weight: 700; cursor: pointer;
      display: flex; align-items: center; justify-content: center; gap: 8px;
      font-family: 'Inter', sans-serif; transition: all 0.3s ease;
      box-shadow: 0 4px 20px rgba(255,109,0,0.3);
    }
    .go-kyc-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 28px rgba(255,109,0,0.45); }
    .go-kyc-btn mat-icon { font-size: 20px; width: 20px; height: 20px; }

    /* ── PIN Overlay ── */
    .pin-overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,0.6);
      backdrop-filter: blur(6px); z-index: 1000;
      display: flex; align-items: center; justify-content: center;
      animation: fadeIn 0.2s ease;
    }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    .pin-modal {
      background: white; border-radius: 28px; padding: 32px 24px; width: 320px;
      box-shadow: 0 24px 64px rgba(0,0,0,0.3);
      animation: slideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); text-align: center;
    }
    @keyframes slideUp {
      from { opacity: 0; transform: translateY(40px) scale(0.95); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }
    .pin-modal-header { margin-bottom: 24px; }
    .pin-lock-icon {
      width: 64px; height: 64px; border-radius: 20px;
      background: linear-gradient(135deg, #3f51b5, #7c4dff);
      display: flex; align-items: center; justify-content: center;
      margin: 0 auto 16px; box-shadow: 0 8px 24px rgba(63,81,181,0.4);
    }
    .pin-lock-icon mat-icon { color: white; font-size: 32px; width: 32px; height: 32px; }
    .pin-modal-header h3 { margin: 0 0 8px; font-size: 20px; font-weight: 800; color: #1a1a2e; }
    .pin-modal-header p  { margin: 0; font-size: 13px; color: #666; line-height: 1.5; }
    .pin-dots { display: flex; justify-content: center; gap: 16px; margin-bottom: 12px; }
    .dot {
      width: 16px; height: 16px; border-radius: 50%; border: 2px solid #d0d0e0;
      transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    .dot.filled {
      background: #3f51b5; border-color: #3f51b5; transform: scale(1.2);
      box-shadow: 0 4px 12px rgba(63,81,181,0.4);
    }
    .pin-error { color: #f44336; font-size: 13px; font-weight: 500; margin-bottom: 12px; animation: shake 0.4s ease; }
    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      25%       { transform: translateX(-8px); }
      75%       { transform: translateX(8px); }
    }
    .numpad { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; max-width: 240px; margin: 0 auto 16px; }
    .num-btn {
      height: 56px; border: none; border-radius: 14px; background: #f5f5f8; color: #1a1a2e;
      font-size: 20px; font-weight: 700; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      transition: all 0.15s ease; font-family: 'Inter', sans-serif;
    }
    .num-btn:active { transform: scale(0.92); background: #e8e8f0; }
    .num-btn.clear { background: #fff0f0; color: #f44336; }
    .num-btn.clear mat-icon { font-size: 20px; width: 20px; height: 20px; }
    .num-btn.confirm { background: linear-gradient(135deg, #3f51b5, #7c4dff); color: white; box-shadow: 0 4px 16px rgba(63,81,181,0.4); }
    .num-btn.confirm mat-icon { font-size: 22px; width: 22px; height: 22px; }
    .num-btn.confirm:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }
    .cancel-pin-btn {
      width: 100%; padding: 12px; border: none; background: transparent; color: #999;
      font-size: 14px; font-weight: 600; cursor: pointer; font-family: 'Inter', sans-serif; transition: color 0.2s;
    }
    .cancel-pin-btn:hover { color: #f44336; }

    /* ── Section Card ── */
    .section-card {
      background: white; border-radius: 20px; padding: 20px;
      margin-bottom: 16px; box-shadow: 0 2px 20px rgba(0,0,0,0.06);
      border: 1px solid rgba(0,0,0,0.04);
    }
    .section-label {
      display: flex; align-items: center; gap: 8px;
      font-size: 13px; font-weight: 700; color: #666;
      text-transform: uppercase; letter-spacing: 1px; margin-bottom: 16px;
    }
    .section-label mat-icon { font-size: 18px; width: 18px; height: 18px; color: #7c4dff; }

    /* ── Recent Contacts ── */
    .contacts-row { display: flex; gap: 16px; overflow-x: auto; padding-bottom: 4px; }
    .contact-item {
      display: flex; flex-direction: column; align-items: center;
      gap: 6px; cursor: pointer; flex-shrink: 0; transition: transform 0.2s ease;
    }
    .contact-item:hover { transform: translateY(-4px); }
    .contact-avatar {
      width: 52px; height: 52px; border-radius: 16px;
      background: linear-gradient(135deg, #3f51b5, #7c4dff);
      color: white; font-size: 18px; font-weight: 700;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 4px 12px rgba(124,77,255,0.3);
    }
    .contact-name   { font-size: 12px; font-weight: 600; color: #444; }
    .contact-amount { font-size: 11px; color: #888; }

    /* ── Email Input ── */
    .email-input-wrap {
      display: flex; align-items: center; gap: 12px;
      border: 2px solid #e8e8f0; border-radius: 14px;
      padding: 14px 16px; transition: all 0.2s ease;
      background: #fafafa; margin-bottom: 12px;
    }
    .email-input-wrap.active { border-color: #00c853; background: #f0fff4; }
    .email-input-wrap.error  { border-color: #ff5252; background: #fff5f5; }
    .input-icon { color: #aaa; font-size: 20px; width: 20px; height: 20px; flex-shrink: 0; }
    .email-input-wrap input {
      flex: 1; border: none; outline: none; font-size: 15px;
      color: #1a1a2e; background: transparent; font-family: 'Inter', sans-serif;
    }
    .email-input-wrap input::placeholder { color: #bbb; }
    .status-icon { font-size: 20px; width: 20px; height: 20px; flex-shrink: 0; }
    .status-icon.success { color: #00c853; }
    .status-icon.error   { color: #ff5252; }
    .mini-spinner {
      width: 18px; height: 18px; border: 2px solid #e0e0e0;
      border-top-color: #7c4dff; border-radius: 50%;
      animation: spin 0.6s linear infinite; flex-shrink: 0;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .receiver-found {
      display: flex; align-items: center; gap: 12px;
      background: linear-gradient(135deg, #f0fff4, #e8f5e9);
      border: 1px solid #c8e6c9; border-radius: 12px;
      padding: 12px 16px; animation: slideIn 0.3s ease;
    }
    @keyframes slideIn {
      from { opacity: 0; transform: translateY(-8px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .receiver-avatar {
      width: 40px; height: 40px; border-radius: 50%;
      background: linear-gradient(135deg, #00c853, #69f0ae);
      color: white; font-size: 16px; font-weight: 700;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .receiver-info { flex: 1; }
    .receiver-name  { margin: 0; font-weight: 700; font-size: 14px; color: #1a1a2e; }
    .receiver-email { margin: 2px 0 0; font-size: 12px; color: #666; }
    .verified-icon  { color: #00c853; font-size: 20px; width: 20px; height: 20px; }
    .error-msg {
      display: flex; align-items: center; gap: 8px;
      color: #ff5252; font-size: 13px; font-weight: 500; padding: 8px 0;
    }
    .error-msg mat-icon { font-size: 16px; width: 16px; height: 16px; }

    /* ── Amount ── */
    .amount-display {
      display: flex; align-items: center; justify-content: center; gap: 4px;
      padding: 16px 0; border-bottom: 2px solid #f0f0f0; margin-bottom: 16px;
    }
    .currency-symbol { font-size: 32px; font-weight: 700; color: #7c4dff; }
    .amount-input {
      border: none; outline: none; font-size: 52px; font-weight: 800;
      color: #1a1a2e; background: transparent; width: 200px; text-align: center;
      font-family: 'Inter', sans-serif; -moz-appearance: textfield;
    }
    .amount-input::-webkit-outer-spin-button,
    .amount-input::-webkit-inner-spin-button { -webkit-appearance: none; }
    .quick-amounts { display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap; }
    .quick-btn {
      padding: 6px 14px; border: 2px solid #e8e8f0; border-radius: 20px;
      background: transparent; color: #555; font-size: 13px; font-weight: 600;
      cursor: pointer; transition: all 0.2s ease; font-family: 'Inter', sans-serif;
    }
    .quick-btn:hover    { border-color: #7c4dff; color: #7c4dff; }
    .quick-btn.selected { background: #7c4dff; border-color: #7c4dff; color: white; }
    .note-wrap {
      display: flex; align-items: center; gap: 10px;
      border: 2px solid #e8e8f0; border-radius: 12px; padding: 12px 14px; background: #fafafa;
    }
    .note-wrap mat-icon { color: #aaa; font-size: 20px; width: 20px; height: 20px; }
    .note-wrap input {
      flex: 1; border: none; outline: none; font-size: 14px;
      color: #1a1a2e; background: transparent; font-family: 'Inter', sans-serif;
    }
    .note-wrap input::placeholder { color: #bbb; }

    /* ── Summary ── */
    .summary-card {
      background: white; border-radius: 20px; padding: 20px;
      margin-bottom: 16px; box-shadow: 0 2px 20px rgba(0,0,0,0.06);
      border: 1px solid rgba(0,0,0,0.04);
    }
    .summary-row {
      display: flex; justify-content: space-between; align-items: center;
      padding: 10px 0; border-bottom: 1px solid #f5f5f5; font-size: 14px; color: #666;
    }
    .summary-row:last-child { border-bottom: none; }
    .summary-val { font-weight: 600; color: #1a1a2e; }
    .summary-val.amount { font-size: 18px; font-weight: 800; color: #7c4dff; }
    .summary-val.pin-required { display: flex; align-items: center; gap: 4px; color: #3f51b5; font-size: 13px; }
    .summary-val.pin-required mat-icon { font-size: 14px; width: 14px; height: 14px; }

    /* ── Send Button ── */
    .send-btn {
      width: 100%; height: 56px;
      background: linear-gradient(135deg, #3f51b5, #7c4dff);
      color: white; border: none; border-radius: 16px;
      font-size: 17px; font-weight: 700; cursor: pointer;
      display: flex; align-items: center; justify-content: center; gap: 10px;
      transition: all 0.3s ease; font-family: 'Inter', sans-serif;
      box-shadow: 0 4px 20px rgba(124,77,255,0.3); margin-bottom: 12px;
    }
    .send-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 8px 28px rgba(124,77,255,0.45); }
    .send-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
    .send-btn mat-icon { font-size: 22px; width: 22px; height: 22px; }

    /* ── No PIN Warning ── */
    .no-pin-warning {
      display: flex; align-items: center; gap: 8px;
      background: #fff8e1; border: 1px solid #ffe082;
      border-radius: 12px; padding: 12px 16px;
      font-size: 13px; color: #f57f17; margin-bottom: 24px;
    }
    .no-pin-warning mat-icon { font-size: 18px; width: 18px; height: 18px; color: #ff6f00; flex-shrink: 0; }
    .no-pin-warning a { color: #3f51b5; font-weight: 700; }

    /* ── Dark Mode ── */
    :host-context(body.dark) .section-card,
    :host-context(body.dark) .summary-card,
    :host-context(body.dark) .kyc-blocked { background: #13131f; border-color: rgba(255,255,255,0.06); }
    :host-context(body.dark) .kyc-blocked h3 { color: #e8e8f0; }
    :host-context(body.dark) .kyc-blocked p { color: #8888aa; }
    :host-context(body.dark) .blocked-step { color: #555577; }
    :host-context(body.dark) .pin-modal { background: #13131f; }
    :host-context(body.dark) .pin-modal-header h3 { color: #e8e8f0; }
    :host-context(body.dark) .pin-modal-header p { color: #8888aa; }
    :host-context(body.dark) .num-btn { background: #1e1e30; color: #e8e8f0; }
    :host-context(body.dark) .num-btn:active { background: #2a2a40; }
    :host-context(body.dark) .num-btn.clear { background: #2d1a1a; }
    :host-context(body.dark) .dot { border-color: #333355; }
    :host-context(body.dark) .contact-name { color: #b0b0cc; }
    :host-context(body.dark) .email-input-wrap { border-color: #333355; background: #1a1a2e; }
    :host-context(body.dark) .email-input-wrap input,
    :host-context(body.dark) .amount-input,
    :host-context(body.dark) .note-wrap input { color: #e8e8f0; }
    :host-context(body.dark) .note-wrap { border-color: #333355; background: #1a1a2e; }
    :host-context(body.dark) .amount-display { border-bottom-color: #1e1e30; }
    :host-context(body.dark) .quick-btn { border-color: #333355; color: #b0b0cc; }
    :host-context(body.dark) .summary-row { border-bottom-color: #1e1e30; color: #8888aa; }
    :host-context(body.dark) .summary-val { color: #e8e8f0; }
    :host-context(body.dark) .section-label { color: #555577; }
    :host-context(body.dark) .receiver-name { color: #e8e8f0; }
    :host-context(body.dark) .no-pin-warning { background: #2d2200; border-color: #5a4400; color: #ffd54f; }
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

  // KYC check
  kycBlocked = false;
  kycStatus = '';

  // PIN related
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
  ) { }

  ngOnInit(): void {
    this.recentContacts = this.contacts.getContacts();
    this.auth.getPinStatus().subscribe({
      next: (res) => {
        this.hasPin = !!res?.data?.hasPin;
      },
      error: () => {
        this.hasPin = false;
      }
    });

    // Check KYC status before showing the form
    this.api.get<any>('/api/auth/profile').subscribe({
      next: (res) => {
        if (res.success) {
          this.kycStatus = res.data.status;
          this.kycBlocked = res.data.status !== 'Active';
        }
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

    this.api.get<any>(`/api/wallet/by-email?email=${this.receiverEmail}`)
      .subscribe({
        next: (res) => {
          if (res.success) {
            this.receiverUserId = res.data.userId;
            this.api.get<any>(
              `/api/auth/internal/user-by-email?email=${this.receiverEmail}`)
              .subscribe({
                next: (authRes) => {
                  if (authRes.success) this.receiverName = authRes.data.fullName;
                  this.lookingUp = false;
                },
                error: () => {
                  this.receiverName = this.receiverEmail;
                  this.lookingUp = false;
                }
              });
          } else {
            this.receiverError = 'User not found or wallet not activated.';
            this.lookingUp = false;
          }
        },
        error: () => {
          this.receiverError = 'User not found or wallet not activated.';
          this.lookingUp = false;
        }
      });
  }

  initTransfer(): void {
    if (!this.receiverUserId || !this.amount || this.amount <= 0) {
      this.snackBar.open('Please fill in all fields', 'Close', { duration: 3000 });
      return;
    }
    if (!this.hasPin) {
      this.snackBar.open('Set your transaction PIN before transferring money.', 'Close', { duration: 4000 });
      this.router.navigate(['/set-pin']);
      return;
    }
    this.enteredPin = '';
    this.pinError = '';
    this.showPinPrompt = true;
  }

  pinKey(key: string): void {
    if (this.enteredPin.length < 4) {
      this.enteredPin += key;
      this.pinError = '';
    }
  }

  pinClear(): void {
    this.enteredPin = this.enteredPin.slice(0, -1);
    this.pinError = '';
  }

  verifyPin(): void {
    this.showPinPrompt = false;
    this.executeTransfer(this.enteredPin);
  }

  cancelPin(): void {
    this.showPinPrompt = false;
    this.enteredPin = '';
    this.pinError = '';
  }

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
          this.contacts.saveContact({
            userId: this.receiverUserId,
            name: this.receiverName,
            email: this.receiverEmail,
            lastSent: new Date().toISOString(),
            amount: this.amount
          });
          this.snackBar.open(
            `₹${this.amount} sent to ${this.receiverName}! Export is available in History.`,
            'Close', { duration: 3000 });
          this.router.navigate(['/wallet/history']);
        } else {
          this.snackBar.open(res.message, 'Close', { duration: 4000 });
        }
        this.loading = false;
      },
      error: (err) => {
        const message = err?.error?.message ?? 'Transfer failed. Try again.';
        this.snackBar.open(message, 'Close', { duration: 4000 });
        this.loading = false;
      }
    });
  }

  getInitials(name: string): string {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }
}
