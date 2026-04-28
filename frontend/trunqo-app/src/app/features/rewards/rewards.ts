import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ApiService } from '../../core/services/api';

interface RewardSummary {
  pointsBalance: number;
  totalEarned: number;
  tier: 'Bronze' | 'Silver' | 'Gold';
}

interface RewardHistoryItem {
  reason: string;
  reference: string;
  points: number;
  createdAt: string;
}

interface CampaignRedemption {
  id: string;
  campaignId: string;
  campaignCode: string;
  campaignName: string;
  transactionRef: string;
  transactionType: string;
  transactionAmount: number;
  rewardType: string;
  rewardPoints: number;
  cashbackAmount: number;
  appliedAtUtc: string;
}

interface CampaignRule {
  id: string;
  transactionType: string;
  minAmount: number | null;
  maxAmount: number | null;
  rewardType: string;
  rewardPoints: number;
  cashbackAmount: number;
  cashbackPercent: number;
  maxCashbackAmount: number;
  isActive: boolean;
}

interface AvailableCampaign {
  id: string;
  name: string;
  code: string;
  description: string | null;
  isActive: boolean;
  priority: number;
  startAtUtc: string;
  endAtUtc: string;
  rules: CampaignRule[];
}

@Component({
  selector: 'app-rewards',
  standalone: true,
  imports: [CommonModule, RouterLink, MatIconModule, MatSnackBarModule],
  template: `
    <div class="spinner-overlay" *ngIf="loading"><div class="spinner"></div></div>

    <div class="page-container fade-in">
      <!-- Page Header -->
      <div class="page-header">
        <div>
          <h1 class="page-title">Rewards Center</h1>
          <p class="page-subtitle">Earn points, unlock tiers, and benefit from active campaigns.</p>
        </div>
      </div>

      <!-- Tier + Info row -->
      <div class="top-row">
        <!-- Tier Card -->
        <div class="tier-card wa-card">
          <div class="tier-top">
            <div>
              <p class="tier-label">Current Tier</p>
              <h2 class="tier-name">{{ reward?.tier ?? 'Bronze' }}</h2>
            </div>
            <span class="tier-emoji">{{ tierEmoji }}</span>
          </div>
          <div class="points-row">
            <span class="points-num">{{ reward?.pointsBalance ?? 0 | number }}</span>
            <span class="points-lbl">points</span>
          </div>
          <div class="progress-track">
            <div class="progress-fill" [style.width.%]="progress"></div>
          </div>
          <div class="progress-footer">
            <p class="progress-lbl">{{ progressLabel }}</p>
            <p class="total-earned">Total earned: {{ reward?.totalEarned ?? 0 | number }} pts</p>
          </div>
        </div>

        <!-- Tier Info -->
        <div class="tier-info-panel wa-card">
          <h3 class="card-title-small">Reward Tiers</h3>
          <div class="tier-row">
            <div class="tier-badge bronze">🥉 Bronze</div>
            <span class="tier-range">0 – 999 pts</span>
          </div>
          <div class="tier-row">
            <div class="tier-badge silver">🥈 Silver</div>
            <span class="tier-range">1,000 – 4,999 pts</span>
          </div>
          <div class="tier-row last">
            <div class="tier-badge gold">🥇 Gold</div>
            <span class="tier-range">5,000+ pts</span>
          </div>
          <div class="earn-tip">
            <mat-icon>stars</mat-icon>
            <span>Earn 10 points for every transfer!</span>
          </div>
        </div>
      </div>

      <!-- Active Campaigns -->
      <div class="section-block">
        <div class="section-header">
          <h3 class="section-heading">
            <mat-icon>local_offer</mat-icon> Active Campaigns
          </h3>
          <span class="section-count" *ngIf="availableCampaigns.length > 0">
            {{ availableCampaigns.length }} available
          </span>
        </div>

        <div class="empty-card" *ngIf="availableCampaigns.length === 0 && !loading">
          <mat-icon>campaign</mat-icon>
          <p>No active campaigns right now. Check back soon!</p>
        </div>

        <div class="campaigns-grid" *ngIf="availableCampaigns.length > 0">
          <div class="campaign-card" *ngFor="let c of availableCampaigns">
            <!-- Card top: name + code + dates -->
            <div class="campaign-top">
              <div class="campaign-name-row">
                <span class="campaign-name">{{ c.name }}</span>
                <span class="campaign-code">{{ c.code }}</span>
              </div>
              <p class="campaign-desc" *ngIf="c.description">{{ c.description }}</p>
              <p class="campaign-dates">
                <mat-icon>schedule</mat-icon>
                {{ c.startAtUtc | date:'dd MMM' }} – {{ c.endAtUtc | date:'dd MMM yyyy' }}
              </p>
            </div>

            <!-- Rules -->
            <div class="campaign-rules" *ngIf="c.rules.length > 0">
              <p class="rules-label">How to earn</p>
              <div class="rule-chip" *ngFor="let r of c.rules">
                <mat-icon>{{ ruleIcon(r.rewardType) }}</mat-icon>
                <span class="rule-reward">{{ formatRuleLabel(r) }}</span>
                <span class="rule-sep">on</span>
                <span class="rule-txn">{{ formatTxnType(r.transactionType) }}</span>
                <span class="rule-range" *ngIf="r.minAmount || r.maxAmount">
                  &nbsp;({{ r.minAmount ? '₹' + (r.minAmount | number:'1.0-0') : '₹0' }}
                  – {{ r.maxAmount ? '₹' + (r.maxAmount | number:'1.0-0') : 'any' }})
                </span>
              </div>
            </div>

            <!-- Auto-apply notice + CTA -->
            <div class="campaign-footer">
              <div class="auto-apply-note">
                <mat-icon>auto_awesome</mat-icon>
                <span>Applied automatically on eligible transactions</span>
              </div>
              <a class="earn-now-btn" routerLink="/wallet/transfer"
                 *ngIf="hasTransferRule(c)">
                <mat-icon>send</mat-icon> Transfer Now
              </a>
              <a class="earn-now-btn topup-btn" routerLink="/wallet/topup"
                 *ngIf="hasTopupRule(c) && !hasTransferRule(c)">
                <mat-icon>add_circle</mat-icon> Top Up Now
              </a>
            </div>
          </div>
        </div>
      </div>

      <!-- Campaign Redemptions -->
      <div class="section-block">
        <div class="section-header">
          <h3 class="section-heading">
            <mat-icon>redeem</mat-icon> Campaign Rewards Applied
          </h3>
        </div>

        <div class="empty-card" *ngIf="campaignRedemptions.length === 0 && !loading">
          <mat-icon>local_offer</mat-icon>
          <p>No campaign rewards applied yet. Make a transaction to earn!</p>
        </div>

        <div class="data-list" *ngIf="campaignRedemptions.length > 0">
          <div class="data-row" *ngFor="let red of campaignRedemptions">
            <div class="row-icon campaign-icon">
              <mat-icon>local_offer</mat-icon>
            </div>
            <div class="row-main">
              <p class="row-title">{{ red.campaignName }}
                <span class="code-tag">{{ red.campaignCode }}</span>
              </p>
              <p class="row-sub">{{ red.transactionRef }} &middot; {{ formatTransactionType(red.transactionType) }}
                &middot; ₹{{ red.transactionAmount | number:'1.2-2' }}</p>
            </div>
            <p class="row-date">{{ red.appliedAtUtc | date:'dd MMM yyyy, hh:mm a' }}</p>
            <span class="reward-badge" [class.cashback-badge]="red.rewardType === 'CASHBACK'">
              {{ formatCampaignReward(red) }}
            </span>
          </div>
        </div>
      </div>

      <!-- Points History -->
      <div class="section-block">
        <div class="section-header">
          <h3 class="section-heading">
            <mat-icon>workspace_premium</mat-icon> Points History
          </h3>
        </div>

        <div class="empty-card" *ngIf="history.length === 0 && !loading">
          <mat-icon>workspace_premium</mat-icon>
          <p>No points earned yet. Make a transfer!</p>
        </div>

        <div class="data-list" *ngIf="history.length > 0">
          <div class="data-row" *ngFor="let tx of history">
            <div class="row-icon points-icon">
              <mat-icon>stars</mat-icon>
            </div>
            <div class="row-main">
              <p class="row-title">{{ tx.reason }}</p>
              <p class="row-sub">{{ tx.reference }}</p>
            </div>
            <p class="row-date">{{ tx.createdAt | date:'dd MMM yyyy, hh:mm a' }}</p>
            <span class="reward-badge">+{{ tx.points }} pts</span>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .page-container { max-width: 960px; margin: 0 auto; padding-bottom: 40px; }

    /* Header */
    .page-header { margin-bottom: 28px; }
    .page-title { font-size: 30px; font-weight: 800; color: var(--text-primary); font-family: 'Outfit', sans-serif; margin: 0 0 6px; letter-spacing: -0.5px; }
    .page-subtitle { color: var(--text-secondary); font-size: 15px; margin: 0; }

    /* Top row — equal height columns */
    .top-row {
      display: grid;
      grid-template-columns: 1.3fr 1fr;
      gap: 20px;
      margin-bottom: 28px;
      align-items: stretch;
    }

    /* Tier card */
    .tier-card {
      margin-bottom: 0;
      padding: 28px;
      position: relative;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    .tier-card::before {
      content: ''; position: absolute; top: -60px; right: -40px;
      width: 200px; height: 200px; border-radius: 50%;
      background: radial-gradient(circle, rgba(192,133,82,0.1) 0%, transparent 60%);
      pointer-events: none;
    }
    .tier-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; }
    .tier-label { font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px; margin: 0 0 6px; }
    .tier-name  { font-size: 28px; font-weight: 800; color: var(--text-primary); margin: 0; font-family: 'Outfit', sans-serif; }
    .tier-emoji { font-size: 44px; line-height: 1; flex-shrink: 0; }

    .points-row { display: flex; align-items: baseline; gap: 8px; margin-bottom: 20px; }
    .points-num { font-size: 52px; font-weight: 800; color: var(--teal); letter-spacing: -2px; line-height: 1; font-family: 'Outfit', sans-serif; }
    .points-lbl { font-size: 15px; color: var(--text-secondary); font-weight: 500; }

    .progress-track { background: var(--border); border-radius: 8px; height: 8px; margin-bottom: 10px; overflow: hidden; }
    .progress-fill  { background: var(--teal); border-radius: 8px; height: 100%; transition: width 0.6s ease; }

    .progress-footer { display: flex; justify-content: space-between; align-items: center; margin-top: auto; }
    .progress-lbl  { font-size: 13px; color: var(--text-muted); margin: 0; font-weight: 500; }
    .total-earned  { font-size: 13px; color: var(--text-secondary); margin: 0; font-weight: 600; }

    /* Tier info panel */
    .tier-info-panel {
      margin-bottom: 0;
      padding: 28px 24px;
      display: flex;
      flex-direction: column;
    }
    .card-title-small { font-size: 16px; font-weight: 700; color: var(--text-primary); font-family: 'Outfit', sans-serif; margin: 0 0 20px; }

    .tier-row { display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px dashed var(--border); }
    .tier-row.last { border-bottom: none; }
    .tier-badge { font-size: 13px; font-weight: 700; padding: 5px 12px; border-radius: 6px; }
    .tier-badge.bronze { background: rgba(201,153,107,0.15); color: #C9996B; }
    .tier-badge.silver { background: rgba(160,168,180,0.15); color: #A0A8B4; }
    .tier-badge.gold   { background: rgba(245,158,11,0.15); color: #F59E0B; }
    .tier-range { font-size: 14px; color: var(--text-secondary); font-weight: 500; }

    .earn-tip {
      display: flex; align-items: center; gap: 8px;
      margin-top: auto; padding: 10px 14px;
      background: var(--teal-dim); border-radius: 8px;
      color: var(--teal); font-size: 13px; font-weight: 600;
    }
    .earn-tip mat-icon { font-size: 18px; width: 18px; height: 18px; flex-shrink: 0; }

    /* Section blocks */
    .section-block { margin-bottom: 28px; }
    .section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
    .section-heading {
      display: flex; align-items: center; gap: 8px;
      font-size: 16px; font-weight: 700; color: var(--text-primary);
      font-family: 'Outfit', sans-serif; margin: 0;
    }
    .section-heading mat-icon { font-size: 20px; width: 20px; height: 20px; color: var(--teal); }
    .section-count { font-size: 12px; font-weight: 700; color: var(--teal); background: var(--teal-dim); padding: 3px 10px; border-radius: 20px; }

    /* Empty card */
    .empty-card {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      padding: 36px 24px; text-align: center;
      background: var(--bg-card); border: 1px dashed var(--border); border-radius: var(--r-lg);
      color: var(--text-muted);
    }
    .empty-card mat-icon { font-size: 36px; width: 36px; height: 36px; margin-bottom: 10px; opacity: 0.4; }
    .empty-card p { font-size: 14px; margin: 0; font-weight: 500; }

    /* Campaigns grid */
    .campaigns-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; }

    .campaign-card {
      background: var(--bg-card); border: 1px solid var(--border);
      border-radius: var(--r-lg); padding: 0;
      box-shadow: var(--shadow-sm);
      transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s;
      display: flex; flex-direction: column; overflow: hidden;
    }
    .campaign-card:hover { transform: translateY(-2px); box-shadow: var(--shadow-md); border-color: var(--teal); }

    /* Campaign top section */
    .campaign-top {
      padding: 18px 18px 14px;
      border-bottom: 1px solid var(--border);
    }
    .campaign-name-row { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; flex-wrap: wrap; }
    .campaign-name { font-size: 15px; font-weight: 700; color: var(--text-primary); font-family: 'Outfit', sans-serif; }
    .campaign-code { font-size: 11px; font-weight: 700; color: var(--teal); background: var(--teal-dim); padding: 2px 8px; border-radius: 4px; letter-spacing: 0.5px; }
    .campaign-desc { font-size: 13px; color: var(--text-secondary); margin: 0 0 8px; line-height: 1.5; }
    .campaign-dates { display: flex; align-items: center; gap: 5px; font-size: 12px; color: var(--text-muted); margin: 0; font-weight: 500; }
    .campaign-dates mat-icon { font-size: 14px; width: 14px; height: 14px; }

    /* Campaign rules */
    .campaign-rules { padding: 14px 18px; flex: 1; }
    .rules-label { font-size: 10px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px; margin: 0 0 8px; }
    .rule-chip {
      display: flex; align-items: center; gap: 5px; flex-wrap: wrap;
      background: var(--space-800); border: 1px solid var(--border);
      border-radius: 8px; padding: 7px 10px; margin-bottom: 6px;
      font-size: 12px; color: var(--text-primary);
    }
    .rule-chip:last-child { margin-bottom: 0; }
    .rule-chip mat-icon { font-size: 14px; width: 14px; height: 14px; color: var(--teal); flex-shrink: 0; }
    .rule-reward { font-weight: 700; color: var(--teal); }
    .rule-sep { color: var(--text-muted); font-weight: 400; }
    .rule-txn { font-weight: 600; color: var(--text-secondary); }
    .rule-range { color: var(--text-muted); font-weight: 400; }

    /* Campaign footer */
    .campaign-footer {
      padding: 12px 18px;
      border-top: 1px solid var(--border);
      background: rgba(192,133,82,0.02);
      display: flex; align-items: center; justify-content: space-between; gap: 10px;
    }
    .auto-apply-note {
      display: flex; align-items: center; gap: 5px;
      font-size: 11px; color: var(--text-muted); font-weight: 500; flex: 1;
    }
    .auto-apply-note mat-icon { font-size: 13px; width: 13px; height: 13px; color: var(--teal); flex-shrink: 0; }

    .earn-now-btn {
      display: inline-flex; align-items: center; gap: 5px;
      padding: 6px 14px; border-radius: 8px;
      background: var(--teal); color: white;
      font-size: 12px; font-weight: 700; text-decoration: none;
      transition: all 0.2s; white-space: nowrap; flex-shrink: 0;
      box-shadow: var(--shadow-teal);
    }
    .earn-now-btn:hover { background: var(--secondary); transform: translateY(-1px); }
    .earn-now-btn mat-icon { font-size: 14px; width: 14px; height: 14px; }
    .earn-now-btn.topup-btn { background: var(--success); box-shadow: 0 4px 12px rgba(45,138,86,0.25); }
    .earn-now-btn.topup-btn:hover { background: #1e6b3a; }

    /* Data list */
    .data-list { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--r-lg); overflow: hidden; box-shadow: var(--shadow-sm); }
    .data-row {
      display: flex; align-items: center; gap: 14px;
      padding: 14px 20px; border-bottom: 1px dashed var(--border);
      transition: background 0.15s;
    }
    .data-row:last-child { border-bottom: none; }
    .data-row:hover { background: rgba(192,133,82,0.03); }

    .row-icon {
      width: 40px; height: 40px; border-radius: 10px;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }
    .row-icon mat-icon { font-size: 20px; width: 20px; height: 20px; }
    .points-icon   { background: rgba(192,133,82,0.1); }
    .points-icon mat-icon { color: var(--teal); }
    .campaign-icon { background: rgba(59,130,246,0.1); }
    .campaign-icon mat-icon { color: #3B82F6; }

    .row-main { flex: 1; min-width: 0; }
    .row-title {
      margin: 0 0 3px; font-size: 14px; font-weight: 600; color: var(--text-primary);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .row-sub { margin: 0; font-size: 12px; color: var(--text-muted); font-family: monospace; letter-spacing: 0.3px; }
    .code-tag { font-size: 11px; font-weight: 700; color: var(--teal); background: var(--teal-dim); padding: 1px 6px; border-radius: 4px; margin-left: 6px; font-family: 'Inter', sans-serif; }

    .row-date { font-size: 12px; color: var(--text-muted); white-space: nowrap; flex-shrink: 0; }

    .reward-badge {
      background: rgba(16,185,129,0.1); color: #10B981;
      border: 1px solid rgba(16,185,129,0.3);
      padding: 4px 12px; border-radius: 20px;
      font-size: 13px; font-weight: 700; white-space: nowrap; flex-shrink: 0;
    }
    .cashback-badge {
      background: rgba(59,130,246,0.1); color: #2563EB;
      border-color: rgba(37,99,235,0.3);
    }

    @media (max-width: 900px) {
      .top-row { grid-template-columns: 1fr; }
      .campaigns-grid { grid-template-columns: 1fr; }
    }
    @media (max-width: 600px) {
      .data-row { flex-wrap: wrap; gap: 8px; }
      .row-date { order: 3; font-size: 11px; }
      .reward-badge { order: 4; }
      .campaign-footer { flex-direction: column; align-items: flex-start; }
    }
  `]
})
export class RewardsComponent implements OnInit {
  reward: RewardSummary | null = null;
  history: RewardHistoryItem[] = [];
  campaignRedemptions: CampaignRedemption[] = [];
  availableCampaigns: AvailableCampaign[] = [];
  loading = true;

  constructor(private api: ApiService, private snackBar: MatSnackBar) {}

  ngOnInit(): void {
    forkJoin({
      rewards:      this.api.get<any>('/api/rewards').pipe(catchError(() => of({ success: false, data: null }))),
      history:      this.api.get<any>('/api/rewards/history').pipe(catchError(() => of({ success: false, data: [] }))),
      redemptions:  this.api.get<any>('/api/rewards/campaigns/my-redemptions').pipe(catchError(() => of({ success: false, data: [] }))),
      campaigns:    this.api.get<any>('/api/rewards/campaigns/available').pipe(catchError(() => of({ success: false, data: [] })))
    }).subscribe({
      next: ({ rewards, history, redemptions, campaigns }) => {
        if (rewards.success)     this.reward = rewards.data;
        if (history.success)     this.history = history.data ?? [];
        if (redemptions.success) this.campaignRedemptions = redemptions.data ?? [];
        if (campaigns.success)   this.availableCampaigns = campaigns.data ?? [];
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.snackBar.open('Unable to load rewards right now.', 'Close', { duration: 3000 });
      }
    });
  }

  get tierEmoji(): string {
    if (this.reward?.tier === 'Gold')   return '🥇';
    if (this.reward?.tier === 'Silver') return '🥈';
    return '🥉';
  }

  get progress(): number {
    const t = this.reward?.totalEarned ?? 0;
    if (t >= 5000) return 100;
    if (t >= 1000) return ((t - 1000) / 4000) * 100;
    return (t / 1000) * 100;
  }

  get progressLabel(): string {
    const t = this.reward?.totalEarned ?? 0;
    if (t >= 5000) return '🎉 Gold tier reached!';
    if (t >= 1000) return `${5000 - t} pts to Gold`;
    return `${1000 - t} pts to Silver`;
  }

  formatTransactionType(value: string): string {
    const map: Record<string, string> = {
      topup: 'Top Up',
      transfer_in: 'Transfer In',
      transfer_out: 'Transfer Out'
    };
    return map[value] ?? value;
  }

  formatTxnType(value: string): string {
    return this.formatTransactionType(value);
  }

  formatCampaignReward(r: CampaignRedemption): string {
    if (r.rewardType === 'POINTS')   return `+${r.rewardPoints} pts`;
    if (r.rewardType === 'CASHBACK') return `₹${r.cashbackAmount.toFixed(2)} cashback`;
    return 'Offer applied';
  }

  formatRuleLabel(r: CampaignRule): string {
    if (r.rewardType === 'POINTS')   return `+${r.rewardPoints} pts`;
    if (r.rewardType === 'CASHBACK') {
      if (r.cashbackPercent > 0) return `${r.cashbackPercent}% cashback`;
      return `₹${r.cashbackAmount} cashback`;
    }
    return 'Special offer';
  }

  ruleIcon(rewardType: string): string {
    if (rewardType === 'POINTS')   return 'stars';
    if (rewardType === 'CASHBACK') return 'currency_rupee';
    return 'card_giftcard';
  }

  hasTransferRule(c: AvailableCampaign): boolean {
    return c.rules.some(r => r.transactionType === 'transfer_out' || r.transactionType === 'transfer_in');
  }

  hasTopupRule(c: AvailableCampaign): boolean {
    return c.rules.some(r => r.transactionType === 'topup');
  }
}
