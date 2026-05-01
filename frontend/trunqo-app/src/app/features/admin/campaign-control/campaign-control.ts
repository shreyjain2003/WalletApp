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
    <div class="page-wrapper">
      <!-- Admin Navbar -->
      <nav class="admin-nav">
        <div class="nav-inner">
          <span class="nav-brand">
            <mat-icon>admin_panel_settings</mat-icon> Admin Panel
          </span>
          <div class="nav-links">
            <a routerLink="/admin/kyc">KYC</a>
            <a routerLink="/admin/tickets">Tickets</a>
            <a routerLink="/admin/users">Users</a>
            <a routerLink="/admin/campaigns" class="active">Campaigns</a>
            <button class="logout-btn" (click)="logout()">
              <mat-icon>logout</mat-icon> Logout
            </button>
          </div>
        </div>
      </nav>

      <div class="page-content">
        <!-- Page Header -->
        <div class="page-header">
          <div>
            <h2 class="page-title">Campaign Control</h2>
            <p class="page-subtitle">Create and manage reward campaigns and rules</p>
          </div>
          <button class="refresh-btn" (click)="loadCampaigns()">
            <mat-icon>refresh</mat-icon> Refresh
          </button>
        </div>

        <!-- Create Campaign Form -->
        <div class="form-card">
          <div class="form-card-header">
            <mat-icon>add_circle_outline</mat-icon>
            <h3>Create New Campaign</h3>
          </div>

          <div class="form-grid-2">
            <div class="form-field">
              <label class="field-label">Campaign Name</label>
              <div class="field-input">
                <mat-icon>campaign</mat-icon>
                <input type="text" [(ngModel)]="campaignForm.name" placeholder="e.g. Festival Cashback"/>
              </div>
            </div>
            <div class="form-field">
              <label class="field-label">Campaign Code</label>
              <div class="field-input">
                <mat-icon>sell</mat-icon>
                <input type="text" [(ngModel)]="campaignForm.code" placeholder="e.g. FEST25"/>
              </div>
            </div>
          </div>

          <div class="form-field">
            <label class="field-label">Description (optional)</label>
            <div class="field-input">
              <mat-icon>description</mat-icon>
              <input type="text" [(ngModel)]="campaignForm.description" placeholder="Earn rewards on festival spends"/>
            </div>
          </div>

          <div class="form-grid-3">
            <div class="form-field">
              <label class="field-label">Priority</label>
              <div class="field-input">
                <mat-icon>low_priority</mat-icon>
                <input type="number" [(ngModel)]="campaignForm.priority" min="0"/>
              </div>
            </div>
            <div class="form-field">
              <label class="field-label">Start Date & Time</label>
              <div class="field-input">
                <mat-icon>event</mat-icon>
                <input type="datetime-local" [(ngModel)]="campaignForm.startAtLocal"/>
              </div>
            </div>
            <div class="form-field">
              <label class="field-label">End Date & Time</label>
              <div class="field-input">
                <mat-icon>event_busy</mat-icon>
                <input type="datetime-local" [(ngModel)]="campaignForm.endAtLocal"/>
              </div>
            </div>
          </div>

          <div class="form-footer">
            <label class="checkbox-label">
              <input type="checkbox" [(ngModel)]="campaignForm.isActive"/>
              <span>Active immediately</span>
            </label>
            <button class="create-btn" (click)="createCampaign()" [disabled]="creating">
              <mat-icon>add</mat-icon>
              {{ creating ? 'Creating...' : 'Create Campaign' }}
            </button>
          </div>
        </div>

        <!-- Empty state -->
        <div class="empty-state-card" *ngIf="campaigns.length === 0 && !loading">
          <mat-icon>insights</mat-icon>
          <p>No campaigns yet. Create your first campaign above.</p>
        </div>

        <!-- Campaign Cards -->
        <div class="campaign-card" *ngFor="let campaign of campaigns">
          <!-- Campaign Header -->
          <div class="campaign-header">
            <div class="campaign-title-block">
              <div class="campaign-title-row">
                <h3 class="campaign-name">{{ campaign.name }}</h3>
                <span class="campaign-code">{{ campaign.code }}</span>
                <span class="status-pill" [class.active]="campaign.isActive" [class.inactive]="!campaign.isActive">
                  {{ campaign.isActive ? 'Active' : 'Inactive' }}
                </span>
              </div>
              <p class="campaign-desc">{{ campaign.description || 'No description provided' }}</p>
              <div class="campaign-meta">
                <span><mat-icon>low_priority</mat-icon> Priority: {{ campaign.priority }}</span>
                <span><mat-icon>schedule</mat-icon> {{ campaign.startAtUtc | date:'dd MMM yyyy, HH:mm' }} → {{ campaign.endAtUtc | date:'dd MMM yyyy, HH:mm' }}</span>
              </div>
            </div>
          </div>

          <!-- Existing Rules Table -->
          <div class="rules-section" *ngIf="campaign.rules.length > 0">
            <p class="rules-label">Existing Rules ({{ campaign.rules.length }})</p>
            <div class="rules-table">
              <div class="rules-table-head">
                <span>Transaction Type</span>
                <span>Reward</span>
                <span>Amount Range</span>
                <span>Status</span>
              </div>
              <div class="rules-table-row" *ngFor="let rule of campaign.rules">
                <span class="txn-chip">{{ formatTxnType(rule.transactionType) }}</span>
                <span class="reward-text">{{ renderReward(rule) }}</span>
                <span class="range-text">
                  {{ rule.minAmount != null ? ('₹' + (rule.minAmount | number:'1.0-0')) : '₹0' }}
                  –
                  {{ rule.maxAmount != null ? ('₹' + (rule.maxAmount | number:'1.0-0')) : 'Any' }}
                </span>
                <span class="rule-status" [class.active]="rule.isActive">
                  {{ rule.isActive ? 'Active' : 'Inactive' }}
                </span>
              </div>
            </div>
          </div>

          <!-- Add Rule Form -->
          <div class="add-rule-section">
            <div class="add-rule-header">
              <mat-icon>playlist_add</mat-icon>
              <span>Add Rule to this Campaign</span>
            </div>

            <div class="form-grid-4">
              <div class="form-field">
                <label class="field-label">Transaction Type</label>
                <div class="field-input">
                  <mat-icon>sync_alt</mat-icon>
                  <select [(ngModel)]="campaign.ruleDraft!.transactionType">
                    <option value="topup">Top Up</option>
                    <option value="transfer_in">Transfer In</option>
                    <option value="transfer_out">Transfer Out</option>
                  </select>
                </div>
              </div>
              <div class="form-field">
                <label class="field-label">Reward Type</label>
                <div class="field-input">
                  <mat-icon>redeem</mat-icon>
                  <select [(ngModel)]="campaign.ruleDraft!.rewardType">
                    <option value="POINTS">Points</option>
                    <option value="CASHBACK">Cashback</option>
                    <option value="OFFER">Offer</option>
                  </select>
                </div>
              </div>
              <div class="form-field">
                <label class="field-label">Min Amount (₹)</label>
                <div class="field-input">
                  <mat-icon>arrow_downward</mat-icon>
                  <input type="number" [(ngModel)]="campaign.ruleDraft!.minAmount" placeholder="0"/>
                </div>
              </div>
              <div class="form-field">
                <label class="field-label">Max Amount (₹)</label>
                <div class="field-input">
                  <mat-icon>arrow_upward</mat-icon>
                  <input type="number" [(ngModel)]="campaign.ruleDraft!.maxAmount" placeholder="No limit"/>
                </div>
              </div>
            </div>

            <div class="form-grid-4">
              <div class="form-field">
                <label class="field-label">Reward Points</label>
                <div class="field-input">
                  <mat-icon>stars</mat-icon>
                  <input type="number" [(ngModel)]="campaign.ruleDraft!.rewardPoints" min="0" placeholder="0"/>
                </div>
              </div>
              <div class="form-field">
                <label class="field-label">Cashback Amount (₹)</label>
                <div class="field-input">
                  <mat-icon>currency_rupee</mat-icon>
                  <input type="number" [(ngModel)]="campaign.ruleDraft!.cashbackAmount" min="0" placeholder="0"/>
                </div>
              </div>
              <div class="form-field">
                <label class="field-label">Cashback %</label>
                <div class="field-input">
                  <mat-icon>percent</mat-icon>
                  <input type="number" [(ngModel)]="campaign.ruleDraft!.cashbackPercent" min="0" placeholder="0"/>
                </div>
              </div>
              <div class="form-field">
                <label class="field-label">Max Cashback (₹)</label>
                <div class="field-input">
                  <mat-icon>price_check</mat-icon>
                  <input type="number" [(ngModel)]="campaign.ruleDraft!.maxCashbackAmount" min="0" placeholder="0"/>
                </div>
              </div>
            </div>

            <div class="rule-footer">
              <label class="checkbox-label">
                <input type="checkbox" [(ngModel)]="campaign.ruleDraft!.isActive"/>
                <span>Rule active immediately</span>
              </label>
              <button class="add-rule-btn" (click)="addRule(campaign)" [disabled]="campaign.addingRule">
                <mat-icon>playlist_add</mat-icon>
                {{ campaign.addingRule ? 'Adding...' : 'Add Rule' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    /* ── Layout ── */
    .page-wrapper { min-height: 100vh; background: var(--bg); }

    /* ── Admin Navbar ── */
    .admin-nav {
      background: var(--bg-card); border-bottom: 1px solid var(--border);
      position: sticky; top: 0; z-index: 100;
      box-shadow: var(--shadow-sm);
    }
    .nav-inner {
      display: flex; align-items: center; justify-content: space-between;
      max-width: 1200px; margin: 0 auto; padding: 0 24px; height: 60px;
    }
    .nav-brand {
      display: flex; align-items: center; gap: 8px;
      font-size: 16px; font-weight: 800; color: var(--text-primary);
      font-family: 'Outfit', sans-serif;
    }
    .nav-brand mat-icon { color: var(--teal); font-size: 22px; width: 22px; height: 22px; }
    .nav-links { display: flex; align-items: center; gap: 4px; }
    .nav-links a {
      padding: 6px 14px; border-radius: 8px;
      color: var(--text-secondary); text-decoration: none;
      font-weight: 600; font-size: 13px; transition: all 0.15s;
    }
    .nav-links a:hover { background: var(--space-800); color: var(--text-primary); }
    .nav-links a.active { background: var(--teal-dim); color: var(--teal); }
    .logout-btn {
      display: flex; align-items: center; gap: 6px;
      padding: 6px 14px; border-radius: 8px;
      border: none; background: transparent;
      color: var(--danger); font-size: 13px; font-weight: 600;
      cursor: pointer; font-family: 'Inter', sans-serif; transition: all 0.15s;
    }
    .logout-btn:hover { background: rgba(217,72,72,0.08); }
    .logout-btn mat-icon { font-size: 16px; width: 16px; height: 16px; }

    /* ── Page Content ── */
    .page-content { max-width: 1200px; margin: 0 auto; padding: 28px 24px 48px; }

    .page-header {
      display: flex; justify-content: space-between; align-items: flex-start;
      margin-bottom: 24px;
    }
    .page-title { font-size: 28px; font-weight: 800; font-family: 'Outfit', sans-serif; color: var(--text-primary); margin: 0 0 4px; }
    .page-subtitle { color: var(--text-muted); font-size: 14px; margin: 0; }
    .refresh-btn {
      display: flex; align-items: center; gap: 6px;
      padding: 8px 16px; border-radius: 8px;
      border: 1.5px solid var(--border); background: var(--bg-card);
      color: var(--text-secondary); font-size: 13px; font-weight: 600;
      cursor: pointer; font-family: 'Inter', sans-serif; transition: all 0.15s;
    }
    .refresh-btn:hover { border-color: var(--teal); color: var(--teal); }
    .refresh-btn mat-icon { font-size: 16px; width: 16px; height: 16px; }

    /* ── Form Card ── */
    .form-card {
      background: var(--bg-card); border: 1px solid var(--border);
      border-radius: var(--r-lg); padding: 24px;
      margin-bottom: 24px; box-shadow: var(--shadow-sm);
    }
    .form-card-header {
      display: flex; align-items: center; gap: 10px;
      margin-bottom: 20px; padding-bottom: 16px;
      border-bottom: 1px solid var(--border);
    }
    .form-card-header mat-icon { color: var(--teal); font-size: 22px; width: 22px; height: 22px; }
    .form-card-header h3 { margin: 0; font-size: 16px; font-weight: 700; color: var(--text-primary); font-family: 'Outfit', sans-serif; }

    /* ── Form Grids ── */
    .form-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 14px; }
    .form-grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px; margin-bottom: 14px; }
    .form-grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 12px; }

    /* ── Form Field ── */
    .form-field { display: flex; flex-direction: column; gap: 6px; }
    .field-label { font-size: 11px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.6px; }
    .field-input {
      display: flex; align-items: center; gap: 10px;
      border: 1.5px solid var(--border); border-radius: 10px;
      padding: 10px 14px; background: var(--bg);
      transition: border-color 0.2s, box-shadow 0.2s;
    }
    .field-input:focus-within { border-color: var(--teal); box-shadow: 0 0 0 3px rgba(192,133,82,0.1); }
    .field-input mat-icon { color: var(--text-muted); font-size: 18px; width: 18px; height: 18px; flex-shrink: 0; }
    .field-input:focus-within mat-icon { color: var(--teal); }
    .field-input input, .field-input select {
      flex: 1; border: none; outline: none;
      font-size: 14px; color: var(--text-primary);
      background: transparent; font-family: 'Inter', sans-serif;
      min-width: 0;
    }
    .field-input input::placeholder { color: var(--text-muted); }
    .field-input select { cursor: pointer; }

    /* ── Form Footer ── */
    .form-footer {
      display: flex; align-items: center; justify-content: space-between;
      padding-top: 16px; border-top: 1px solid var(--border); margin-top: 4px;
    }
    .checkbox-label {
      display: flex; align-items: center; gap: 8px;
      font-size: 14px; color: var(--text-secondary); font-weight: 500; cursor: pointer;
    }
    .checkbox-label input[type="checkbox"] { width: 16px; height: 16px; accent-color: var(--teal); cursor: pointer; }

    .create-btn {
      display: flex; align-items: center; gap: 8px;
      padding: 10px 20px; border-radius: 10px;
      background: var(--teal); color: white; border: none;
      font-size: 14px; font-weight: 700; cursor: pointer;
      font-family: 'Inter', sans-serif; transition: all 0.2s;
      box-shadow: var(--shadow-teal);
    }
    .create-btn:hover:not(:disabled) { background: var(--secondary); transform: translateY(-1px); }
    .create-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
    .create-btn mat-icon { font-size: 18px; width: 18px; height: 18px; }

    /* ── Empty State ── */
    .empty-state-card {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      padding: 48px 24px; text-align: center;
      background: var(--bg-card); border: 1px dashed var(--border);
      border-radius: var(--r-lg); color: var(--text-muted);
      margin-bottom: 24px;
    }
    .empty-state-card mat-icon { font-size: 40px; width: 40px; height: 40px; margin-bottom: 12px; opacity: 0.4; }
    .empty-state-card p { font-size: 14px; margin: 0; font-weight: 500; }

    /* ── Campaign Card ── */
    .campaign-card {
      background: var(--bg-card); border: 1px solid var(--border);
      border-radius: var(--r-lg); margin-bottom: 20px;
      box-shadow: var(--shadow-sm); overflow: hidden;
    }

    .campaign-header {
      padding: 20px 24px; border-bottom: 1px solid var(--border);
      background: linear-gradient(135deg, var(--bg-card) 60%, rgba(192,133,82,0.03) 100%);
    }
    .campaign-title-row {
      display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 6px;
    }
    .campaign-name { font-size: 18px; font-weight: 800; color: var(--text-primary); font-family: 'Outfit', sans-serif; margin: 0; }
    .campaign-code {
      font-size: 12px; font-weight: 700; color: var(--teal);
      background: var(--teal-dim); padding: 3px 10px; border-radius: 6px; letter-spacing: 0.5px;
    }
    .status-pill {
      font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 20px;
      border: 1px solid transparent;
    }
    .status-pill.active   { background: rgba(16,185,129,0.1); color: #10B981; border-color: rgba(16,185,129,0.25); }
    .status-pill.inactive { background: rgba(239,68,68,0.1);  color: #EF4444; border-color: rgba(239,68,68,0.2); }

    .campaign-desc { font-size: 13px; color: var(--text-secondary); margin: 0 0 10px; }
    .campaign-meta {
      display: flex; align-items: center; gap: 20px; flex-wrap: wrap;
    }
    .campaign-meta span {
      display: flex; align-items: center; gap: 5px;
      font-size: 12px; color: var(--text-muted); font-weight: 500;
    }
    .campaign-meta mat-icon { font-size: 14px; width: 14px; height: 14px; }

    /* ── Rules Table ── */
    .rules-section { padding: 16px 24px; border-bottom: 1px solid var(--border); }
    .rules-label { font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.8px; margin: 0 0 10px; }
    .rules-table { border: 1px solid var(--border); border-radius: 10px; overflow: hidden; }
    .rules-table-head {
      display: grid; grid-template-columns: 1.5fr 2fr 1.5fr 1fr;
      gap: 12px; padding: 10px 16px;
      background: var(--space-800);
      font-size: 11px; font-weight: 700; color: var(--text-muted);
      text-transform: uppercase; letter-spacing: 0.6px;
    }
    .rules-table-row {
      display: grid; grid-template-columns: 1.5fr 2fr 1.5fr 1fr;
      gap: 12px; padding: 12px 16px;
      border-top: 1px solid var(--border);
      font-size: 13px; color: var(--text-primary);
      align-items: center;
    }
    .rules-table-row:hover { background: rgba(192,133,82,0.02); }
    .txn-chip {
      display: inline-flex; align-items: center;
      background: var(--teal-dim); color: var(--teal);
      padding: 3px 10px; border-radius: 6px;
      font-size: 12px; font-weight: 600;
    }
    .reward-text { font-weight: 600; color: var(--text-primary); }
    .range-text  { font-size: 12px; color: var(--text-secondary); font-family: monospace; }
    .rule-status { font-size: 12px; font-weight: 600; }
    .rule-status.active { color: #10B981; }

    /* ── Add Rule Section ── */
    .add-rule-section { padding: 20px 24px; background: rgba(192,133,82,0.02); }
    .add-rule-header {
      display: flex; align-items: center; gap: 8px;
      font-size: 13px; font-weight: 700; color: var(--text-secondary);
      text-transform: uppercase; letter-spacing: 0.6px;
      margin-bottom: 16px;
    }
    .add-rule-header mat-icon { font-size: 18px; width: 18px; height: 18px; color: var(--teal); }

    .rule-footer {
      display: flex; align-items: center; justify-content: space-between;
      padding-top: 14px; border-top: 1px dashed var(--border); margin-top: 4px;
    }
    .add-rule-btn {
      display: flex; align-items: center; gap: 8px;
      padding: 9px 18px; border-radius: 10px;
      background: var(--teal); color: white; border: none;
      font-size: 13px; font-weight: 700; cursor: pointer;
      font-family: 'Inter', sans-serif; transition: all 0.2s;
      box-shadow: var(--shadow-teal);
    }
    .add-rule-btn:hover:not(:disabled) { background: var(--secondary); transform: translateY(-1px); }
    .add-rule-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
    .add-rule-btn mat-icon { font-size: 17px; width: 17px; height: 17px; }

    /* ── Responsive ── */
    @media (max-width: 1024px) {
      .form-grid-4 { grid-template-columns: repeat(2, 1fr); }
    }
    @media (max-width: 768px) {
      .form-grid-2, .form-grid-3 { grid-template-columns: 1fr; }
      .form-grid-4 { grid-template-columns: 1fr 1fr; }
      .rules-table-head, .rules-table-row { grid-template-columns: 1fr 1fr; }
      .rules-table-head span:nth-child(3),
      .rules-table-row span:nth-child(3) { display: none; }
      .campaign-meta { flex-direction: column; gap: 6px; }
      .nav-links { gap: 2px; }
      .nav-links a { padding: 6px 10px; font-size: 12px; }
    }
    @media (max-width: 560px) {
      .form-grid-4 { grid-template-columns: 1fr; }
      .page-header { flex-direction: column; gap: 12px; }
      .form-footer, .rule-footer { flex-direction: column; gap: 12px; align-items: stretch; }
      .create-btn, .add-rule-btn { justify-content: center; }
    }
  `]
})
export class CampaignControlComponent implements OnInit {
  campaigns: Campaign[] = [];
  creating = false;
  loading = false;

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
    this.loading = true;
    this.api.get<any>('/api/rewards/campaigns').subscribe({
      next: (res) => {
        if (!res.success) {
          this.snackBar.open(res.message || 'Failed to load campaigns', 'Close', { duration: 3000 });
          this.loading = false;
          return;
        }
        this.campaigns = (res.data || []).map((c: Campaign) => ({
          ...c,
          rules: c.rules || [],
          ruleDraft: this.defaultRuleDraft(),
          addingRule: false
        }));
        this.loading = false;
      },
      error: (err) => {
        const msg = err?.error?.message ?? 'Failed to load campaigns';
        this.snackBar.open(msg, 'Close', { duration: 3000 });
        this.loading = false;
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

    if (draft.rewardType === 'POINTS' && Number(draft.rewardPoints || 0) <= 0) {
      this.snackBar.open('Points rules must award at least 1 point', 'Close', { duration: 3000 });
      return;
    }

    if (draft.rewardType === 'CASHBACK'
        && Number(draft.cashbackAmount || 0) <= 0
        && Number(draft.cashbackPercent || 0) <= 0) {
      this.snackBar.open('Cashback rules need a fixed amount or percentage', 'Close', { duration: 3000 });
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

  formatTxnType(value: string): string {
    const map: Record<string, string> = {
      topup: 'Top Up',
      transfer_in: 'Transfer In',
      transfer_out: 'Transfer Out'
    };
    return map[value] ?? value;
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
      rewardPoints: 10,
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
