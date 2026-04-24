import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ApiService } from '../../../core/services/api';
import { AuthService } from '../../../core/services/auth';

type RewardType = 'POINTS' | 'CASHBACK' | 'OFFER';
type TxnType = 'topup' | 'transfer_in' | 'transfer_out';

interface CampaignRule {
  id: string;
  transactionType: TxnType;
  minAmount?: number | null;
  maxAmount?: number | null;
  rewardType: RewardType;
  rewardPoints: number;
  cashbackAmount: number;
  cashbackPercent: number;
  maxCashbackAmount: number;
  isActive: boolean;
}

interface Campaign {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  isActive: boolean;
  priority: number;
  startAtUtc: string;
  endAtUtc: string;
  rules: CampaignRule[];
  ruleDraft?: AddRuleRequest;
  addingRule?: boolean;
}

interface CreateCampaignRequest {
  name: string;
  code: string;
  description?: string;
  isActive: boolean;
  priority: number;
  startAtUtc: string;
  endAtUtc: string;
}

interface AddRuleRequest {
  transactionType: TxnType;
  minAmount: number | null;
  maxAmount: number | null;
  rewardType: RewardType;
  rewardPoints: number;
  cashbackAmount: number;
  cashbackPercent: number;
  maxCashbackAmount: number;
  isActive: boolean;
}

@Component({
  selector: 'app-campaign-control',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, MatIconModule, MatSnackBarModule],
  template: `
    <div class="page-container fade-in">
      <div class="navbar">
        <div class="nav-content">
          <span class="brand"><mat-icon style="margin-right:8px; vertical-align:middle;">admin_panel_settings</mat-icon>Admin Panel</span>
          <div class="nav-links">
            <a style="cursor:pointer;" routerLink="/admin/kyc">KYC</a>
            <a style="cursor:pointer;" routerLink="/admin/tickets">Tickets</a>
            <a style="cursor:pointer;" routerLink="/admin/users">Users</a>
            <a style="cursor:pointer;" (click)="logout()"><mat-icon>logout</mat-icon> Logout</a>
          </div>
        </div>
      </div>

      <div class="content">
        <div class="page-header">
          <div>
            <h2 class="page-title">Campaign Control</h2>
            <p class="page-subtitle">Create and manage reward campaigns and rules</p>
          </div>
          <button class="wa-btn-outline" (click)="loadCampaigns()">
            <mat-icon>refresh</mat-icon> Refresh
          </button>
        </div>

        <div class="wa-card form-card">
          <h3 class="form-title"><mat-icon>add_circle</mat-icon> Create Campaign</h3>
          <div class="grid-2">
            <div class="wa-field">
              <div class="wa-label">Campaign Name</div>
              <div class="wa-input-wrap"><mat-icon>campaign</mat-icon><input type="text" [(ngModel)]="campaignForm.name" placeholder="Festival Cashback"/></div>
            </div>
            <div class="wa-field">
              <div class="wa-label">Campaign Code</div>
              <div class="wa-input-wrap"><mat-icon>sell</mat-icon><input type="text" [(ngModel)]="campaignForm.code" placeholder="FEST25"/></div>
            </div>
          </div>

          <div class="wa-field">
            <div class="wa-label">Description</div>
            <div class="wa-input-wrap"><mat-icon>description</mat-icon><input type="text" [(ngModel)]="campaignForm.description" placeholder="Earn rewards on festival spends"/></div>
          </div>

          <div class="grid-3">
            <div class="wa-field">
              <div class="wa-label">Priority</div>
              <div class="wa-input-wrap"><mat-icon>low_priority</mat-icon><input type="number" [(ngModel)]="campaignForm.priority" min="0"/></div>
            </div>
            <div class="wa-field">
              <div class="wa-label">Start (Local)</div>
              <div class="wa-input-wrap"><mat-icon>event</mat-icon><input type="datetime-local" [(ngModel)]="campaignForm.startAtLocal"/></div>
            </div>
            <div class="wa-field">
              <div class="wa-label">End (Local)</div>
              <div class="wa-input-wrap"><mat-icon>event_busy</mat-icon><input type="datetime-local" [(ngModel)]="campaignForm.endAtLocal"/></div>
            </div>
          </div>

          <label class="check-row"><input type="checkbox" [(ngModel)]="campaignForm.isActive"/> Active</label>
          <button class="wa-btn-primary" (click)="createCampaign()" [disabled]="creating">
            <mat-icon>add</mat-icon> {{ creating ? 'Creating...' : 'Create Campaign' }}
          </button>
        </div>

        <div class="wa-card empty-state" *ngIf="campaigns.length === 0">
          <mat-icon>insights</mat-icon>
          <p>No campaigns yet. Create your first campaign above.</p>
        </div>

        <div class="wa-card campaign-card" *ngFor="let campaign of campaigns">
          <div class="campaign-head">
            <div>
              <h3>{{ campaign.name }} <span class="code">{{ campaign.code }}</span></h3>
              <p>{{ campaign.description || 'No description' }}</p>
            </div>
            <div class="right-meta">
              <span class="status-badge" [class.active]="campaign.isActive" [class.inactive]="!campaign.isActive">
                {{ campaign.isActive ? 'Active' : 'Inactive' }}
              </span>
              <small>Priority: {{ campaign.priority }}</small>
              <small>{{ campaign.startAtUtc | date:'medium' }} → {{ campaign.endAtUtc | date:'medium' }}</small>
            </div>
          </div>

          <div class="rule-table" *ngIf="campaign.rules.length > 0">
            <div class="table-head">
              <span>Txn Type</span><span>Reward</span><span>Min-Max</span><span>Rule Status</span>
            </div>
            <div class="table-row" *ngFor="let rule of campaign.rules">
              <span>{{ rule.transactionType }}</span>
              <span>{{ renderReward(rule) }}</span>
              <span>{{ (rule.minAmount ?? 0) | number:'1.0-2' }} - {{ (rule.maxAmount ?? 0) | number:'1.0-2' }}</span>
              <span>{{ rule.isActive ? 'Active' : 'Inactive' }}</span>
            </div>
          </div>

          <div class="wa-card add-rule-card">
            <h4><mat-icon>rule</mat-icon> Add Rule</h4>
            <div class="grid-4">
              <div class="wa-field">
                <div class="wa-label">Transaction Type</div>
                <div class="wa-input-wrap">
                  <mat-icon>sync_alt</mat-icon>
                  <select [(ngModel)]="campaign.ruleDraft!.transactionType">
                    <option value="topup">topup</option>
                    <option value="transfer_in">transfer_in</option>
                    <option value="transfer_out">transfer_out</option>
                  </select>
                </div>
              </div>
              <div class="wa-field">
                <div class="wa-label">Reward Type</div>
                <div class="wa-input-wrap">
                  <mat-icon>redeem</mat-icon>
                  <select [(ngModel)]="campaign.ruleDraft!.rewardType">
                    <option value="POINTS">POINTS</option>
                    <option value="CASHBACK">CASHBACK</option>
                    <option value="OFFER">OFFER</option>
                  </select>
                </div>
              </div>
              <div class="wa-field">
                <div class="wa-label">Min Amount</div>
                <div class="wa-input-wrap"><mat-icon>pin</mat-icon><input type="number" [(ngModel)]="campaign.ruleDraft!.minAmount"/></div>
              </div>
              <div class="wa-field">
                <div class="wa-label">Max Amount</div>
                <div class="wa-input-wrap"><mat-icon>pin_end</mat-icon><input type="number" [(ngModel)]="campaign.ruleDraft!.maxAmount"/></div>
              </div>
            </div>

            <div class="grid-4">
              <div class="wa-field">
                <div class="wa-label">Reward Points</div>
                <div class="wa-input-wrap"><mat-icon>stars</mat-icon><input type="number" [(ngModel)]="campaign.ruleDraft!.rewardPoints" min="0"/></div>
              </div>
              <div class="wa-field">
                <div class="wa-label">Cashback Amount</div>
                <div class="wa-input-wrap"><mat-icon>currency_rupee</mat-icon><input type="number" [(ngModel)]="campaign.ruleDraft!.cashbackAmount" min="0"/></div>
              </div>
              <div class="wa-field">
                <div class="wa-label">Cashback %</div>
                <div class="wa-input-wrap"><mat-icon>percent</mat-icon><input type="number" [(ngModel)]="campaign.ruleDraft!.cashbackPercent" min="0"/></div>
              </div>
              <div class="wa-field">
                <div class="wa-label">Max Cashback</div>
                <div class="wa-input-wrap"><mat-icon>price_check</mat-icon><input type="number" [(ngModel)]="campaign.ruleDraft!.maxCashbackAmount" min="0"/></div>
              </div>
            </div>

            <label class="check-row"><input type="checkbox" [(ngModel)]="campaign.ruleDraft!.isActive"/> Rule Active</label>
            <button class="wa-btn-primary" (click)="addRule(campaign)" [disabled]="campaign.addingRule">
              <mat-icon>playlist_add</mat-icon> {{ campaign.addingRule ? 'Adding...' : 'Add Rule' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .page-container { min-height: 100vh; background: var(--bg); color: var(--text-primary); }
    .navbar { background: var(--bg-card); border-bottom: 1px solid var(--border); position: sticky; top: 0; z-index: 100; }
    .nav-content { display: flex; align-items: center; justify-content: space-between; max-width: 1100px; margin: 0 auto; padding: 16px 24px; }
    .brand { font-size: 18px; font-weight: 800; color: var(--text-primary); font-family: 'Outfit', sans-serif; display:flex; align-items:center; }
    .nav-links { display: flex; gap: 24px; align-items: center; }
    .nav-links a { display:flex; align-items:center; gap:6px; color: var(--text-secondary); text-decoration:none; font-weight:600; font-size:14px; }
    .nav-links a:hover { color: var(--teal); }

    .content { max-width: 1100px; margin: 0 auto; padding: 28px 20px; }
    .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px; }
    .page-title { margin: 0; font-size: 30px; font-weight: 800; font-family: 'Outfit', sans-serif; }
    .page-subtitle { margin: 4px 0 0; color: var(--text-muted); }
    .form-card { margin-bottom: 18px; padding: 20px; }
    .form-title { margin: 0 0 14px; display:flex; align-items:center; gap:8px; }

    .grid-2, .grid-3, .grid-4 { display: grid; gap: 12px; }
    .grid-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .grid-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .grid-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }
    .check-row { display:flex; gap:8px; align-items:center; margin: 8px 0 14px; color: var(--text-secondary); font-size: 14px; }

    .campaign-card { margin-bottom: 16px; padding: 18px; }
    .campaign-head { display:flex; justify-content:space-between; gap:14px; margin-bottom: 14px; }
    .campaign-head h3 { margin: 0; font-size: 20px; font-family: 'Outfit', sans-serif; }
    .campaign-head p { margin: 6px 0 0; color: var(--text-secondary); }
    .code { color: var(--teal); font-size: 13px; font-weight: 700; margin-left: 8px; }
    .right-meta { display:flex; flex-direction:column; gap:4px; align-items:flex-end; }
    .status-badge { padding: 4px 10px; border-radius: 999px; font-size: 12px; font-weight: 700; border: 1px solid transparent; }
    .status-badge.active { background: rgba(16,185,129,0.12); color: #10B981; border-color: rgba(16,185,129,0.28); }
    .status-badge.inactive { background: rgba(239,68,68,0.1); color: #ef4444; border-color: rgba(239,68,68,0.25); }

    .rule-table { border: 1px solid var(--border); border-radius: 12px; overflow: hidden; margin-bottom: 14px; }
    .table-head, .table-row { display:grid; grid-template-columns: 1.2fr 1.5fr 1.3fr 1fr; gap: 10px; padding: 10px 12px; font-size: 13px; }
    .table-head { background: rgba(0,0,0,0.12); color: var(--text-secondary); font-weight: 700; text-transform: uppercase; letter-spacing: .4px; }
    .table-row { border-top: 1px solid var(--border); color: var(--text-primary); }
    .add-rule-card { padding: 14px; background: rgba(192,133,82,0.04); border: 1px dashed rgba(192,133,82,0.32); }
    .add-rule-card h4 { margin: 0 0 12px; display:flex; gap:8px; align-items:center; }
    .empty-state { text-align:center; padding: 36px; color: var(--text-muted); }
    .empty-state mat-icon { width: 36px; height: 36px; font-size: 36px; margin-bottom: 8px; opacity: .7; }

    select {
      width: 100%;
      background: transparent;
      border: none;
      outline: none;
      color: var(--text-primary);
      font-family: inherit;
      font-size: 14px;
    }

    @media (max-width: 960px) {
      .grid-4 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .grid-3 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .campaign-head { flex-direction: column; }
      .right-meta { align-items: flex-start; }
    }

    @media (max-width: 640px) {
      .grid-2, .grid-3, .grid-4 { grid-template-columns: 1fr; }
      .nav-content { flex-direction: column; align-items: flex-start; gap: 10px; }
      .nav-links { flex-wrap: wrap; gap: 14px; }
      .table-head, .table-row { grid-template-columns: 1fr; }
    }
  `]
})
export class CampaignControlComponent implements OnInit {
  campaigns: Campaign[] = [];
  creating = false;

  campaignForm = {
    name: '',
    code: '',
    description: '',
    isActive: true,
    priority: 10,
    startAtLocal: '',
    endAtLocal: ''
  };

  constructor(
    private api: ApiService,
    private auth: AuthService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    const now = new Date();
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    this.campaignForm.startAtLocal = this.toDateTimeLocal(now);
    this.campaignForm.endAtLocal = this.toDateTimeLocal(in7Days);
    this.loadCampaigns();
  }

  loadCampaigns(): void {
    this.api.get<any>('/api/rewards/campaigns').subscribe({
      next: (res) => {
        if (!res.success) {
          this.snackBar.open(res.message || 'Failed to load campaigns', 'Close', { duration: 3000 });
          return;
        }
        this.campaigns = (res.data || []).map((c: Campaign) => ({
          ...c,
          rules: c.rules || [],
          ruleDraft: this.defaultRuleDraft(),
          addingRule: false
        }));
      },
      error: (err) => {
        const msg = err?.error?.message ?? 'Failed to load campaigns';
        this.snackBar.open(msg, 'Close', { duration: 3000 });
      }
    });
  }

  createCampaign(): void {
    const request = this.buildCreateCampaignRequest();
    if (!request) return;

    this.creating = true;
    this.api.post<any>('/api/rewards/campaigns', request).subscribe({
      next: (res) => {
        if (res.success) {
          this.snackBar.open('Campaign created successfully', 'Close', { duration: 2500 });
          this.campaignForm.name = '';
          this.campaignForm.code = '';
          this.campaignForm.description = '';
          this.loadCampaigns();
        } else {
          this.snackBar.open(res.message || 'Failed to create campaign', 'Close', { duration: 3000 });
        }
        this.creating = false;
      },
      error: (err) => {
        const msg = err?.error?.message ?? 'Failed to create campaign';
        this.snackBar.open(msg, 'Close', { duration: 3000 });
        this.creating = false;
      }
    });
  }

  addRule(campaign: Campaign): void {
    const draft = campaign.ruleDraft!;
    if (!draft.transactionType || !draft.rewardType) {
      this.snackBar.open('Transaction type and reward type are required', 'Close', { duration: 3000 });
      return;
    }
    if (draft.minAmount != null && draft.maxAmount != null && draft.minAmount > draft.maxAmount) {
      this.snackBar.open('Min amount cannot be greater than max amount', 'Close', { duration: 3000 });
      return;
    }

    campaign.addingRule = true;
    const request: AddRuleRequest = {
      transactionType: draft.transactionType,
      minAmount: this.normalizeNullableNumber(draft.minAmount),
      maxAmount: this.normalizeNullableNumber(draft.maxAmount),
      rewardType: draft.rewardType,
      rewardPoints: Number(draft.rewardPoints || 0),
      cashbackAmount: Number(draft.cashbackAmount || 0),
      cashbackPercent: Number(draft.cashbackPercent || 0),
      maxCashbackAmount: Number(draft.maxCashbackAmount || 0),
      isActive: !!draft.isActive
    };

    this.api.post<any>(`/api/rewards/campaigns/${campaign.id}/rules`, request).subscribe({
      next: (res) => {
        if (res.success) {
          this.snackBar.open('Rule added successfully', 'Close', { duration: 2500 });
          campaign.ruleDraft = this.defaultRuleDraft();
          this.loadCampaigns();
        } else {
          this.snackBar.open(res.message || 'Failed to add rule', 'Close', { duration: 3000 });
        }
        campaign.addingRule = false;
      },
      error: (err) => {
        const msg = err?.error?.message ?? 'Failed to add rule';
        this.snackBar.open(msg, 'Close', { duration: 3000 });
        campaign.addingRule = false;
      }
    });
  }

  renderReward(rule: CampaignRule): string {
    if (rule.rewardType === 'POINTS') return `Points: ${rule.rewardPoints}`;
    if (rule.rewardType === 'CASHBACK') {
      return `Cashback: Rs ${rule.cashbackAmount || 0} / ${rule.cashbackPercent || 0}%`;
    }
    return 'Offer';
  }

  logout(): void {
    this.auth.logout();
  }

  private buildCreateCampaignRequest(): CreateCampaignRequest | null {
    if (!this.campaignForm.name.trim() || !this.campaignForm.code.trim()) {
      this.snackBar.open('Campaign name and code are required', 'Close', { duration: 3000 });
      return null;
    }

    const startDate = new Date(this.campaignForm.startAtLocal);
    const endDate = new Date(this.campaignForm.endAtLocal);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      this.snackBar.open('Valid start/end date-time is required', 'Close', { duration: 3000 });
      return null;
    }
    if (endDate <= startDate) {
      this.snackBar.open('End date must be after start date', 'Close', { duration: 3000 });
      return null;
    }

    return {
      name: this.campaignForm.name.trim(),
      code: this.campaignForm.code.trim().toUpperCase(),
      description: this.campaignForm.description?.trim() || '',
      isActive: !!this.campaignForm.isActive,
      priority: Number(this.campaignForm.priority || 0),
      startAtUtc: startDate.toISOString(),
      endAtUtc: endDate.toISOString()
    };
  }

  private defaultRuleDraft(): AddRuleRequest {
    return {
      transactionType: 'topup',
      minAmount: null,
      maxAmount: null,
      rewardType: 'POINTS',
      rewardPoints: 0,
      cashbackAmount: 0,
      cashbackPercent: 0,
      maxCashbackAmount: 0,
      isActive: true
    };
  }

  private normalizeNullableNumber(value: number | null): number | null {
    if (value == null) return null;
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    return n;
  }

  private toDateTimeLocal(date: Date): string {
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
  }
}
