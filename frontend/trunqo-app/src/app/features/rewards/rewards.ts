import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
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

@Component({
  selector: 'app-rewards',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatSnackBarModule],
  template: `
    <div class="spinner-overlay" *ngIf="loading"><div class="spinner"></div></div>

    <div class="page-container fade-in">
      <div class="page-header">
        <h1 class="page-title">Rewards Center</h1>
        <p class="page-subtitle">Earn points and level up your tier.</p>
      </div>

      <div class="top-row">
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
          <div class="progress-track"><div class="progress-fill" [style.width.%]="progress"></div></div>
          <div style="display: flex; justify-content: space-between;">
            <p class="progress-lbl">{{ progressLabel }}</p>
            <p class="total-earned">Total earned: {{ reward?.totalEarned ?? 0 | number }} pts</p>
          </div>
        </div>

        <div class="tier-info-panel wa-card">
          <h3 class="card-title-small" style="margin-bottom: 20px;">Reward Tiers</h3>
          <div class="tier-row"><div class="tier-badge bronze">Bronze</div><span class="tier-range">0 - 999 pts</span></div>
          <div class="tier-row"><div class="tier-badge silver">Silver</div><span class="tier-range">1,000 - 4,999 pts</span></div>
          <div class="tier-row"><div class="tier-badge gold">Gold</div><span class="tier-range">5,000+ pts</span></div>
          <div class="warn-msg info" style="margin-top: 16px;">
            <mat-icon>stars</mat-icon> <span>Earn 10 points for every transfer!</span>
          </div>
        </div>
      </div>

      <div class="wa-card" style="padding: 0; margin-bottom: 24px;">
        <div style="padding: 24px 24px 12px;"><h3 class="card-title-small">Campaign Rewards Applied</h3></div>

        <div class="empty-state" *ngIf="campaignRedemptions.length === 0 && !loading" style="padding: 28px 24px;">
          <mat-icon>local_offer</mat-icon><p>No campaign rewards applied yet.</p>
        </div>

        <div class="data-list">
          <div class="data-row" *ngFor="let red of campaignRedemptions">
            <div class="pts-icon"><mat-icon>local_offer</mat-icon></div>
            <div class="tx-info">
              <p class="tx-reason">{{ red.campaignName }} ({{ red.campaignCode }})</p>
              <p class="tx-ref">{{ red.transactionRef }} • {{ formatTransactionType(red.transactionType) }}</p>
            </div>
            <p class="tx-date" style="margin-right: 16px;">{{ red.appliedAtUtc | date:'dd MMM yyyy, hh:mm a' }}</p>
            <span class="pts-badge" [ngClass]="{ 'cashback-badge': red.rewardType === 'CASHBACK' }">{{ formatCampaignReward(red) }}</span>
          </div>
        </div>
      </div>

      <div class="wa-card" style="padding: 0;">
        <div style="padding: 24px 24px 12px;"><h3 class="card-title-small">Points History</h3></div>

        <div class="empty-state" *ngIf="history.length === 0 && !loading" style="padding: 40px 24px;">
          <mat-icon>workspace_premium</mat-icon><p>No points earned yet. Make a transfer!</p>
        </div>

        <div class="data-list">
          <div class="data-row" *ngFor="let tx of history">
            <div class="pts-icon"><mat-icon>stars</mat-icon></div>
            <div class="tx-info">
              <p class="tx-reason">{{ tx.reason }}</p>
              <p class="tx-ref">{{ tx.reference }}</p>
            </div>
            <p class="tx-date" style="margin-right: 16px;">{{ tx.createdAt | date:'dd MMM yyyy, hh:mm a' }}</p>
            <span class="pts-badge">+{{ tx.points }} pts</span>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .page-container { max-width: 900px; margin: 0 auto; padding-bottom: 32px; }
    .page-header { margin-bottom: 32px; display: flex; flex-direction: column; }
    .page-title { font-size: 32px; font-weight: 800; color: var(--text-primary); font-family: 'Outfit', sans-serif; margin-bottom: 8px; letter-spacing: -1px; }
    .page-subtitle { color: var(--text-secondary); font-size: 15px; margin: 0; }

    .top-row { display: grid; grid-template-columns: 1.2fr 1fr; gap: 24px; margin-bottom: 24px; }

    .tier-card { margin-bottom: 0; padding: 32px; position: relative; overflow: hidden; background: linear-gradient(135deg, var(--bg-card) 40%, rgba(192, 133, 82, 0.05) 100%); }
    .tier-card::before { content: ''; position: absolute; top: -60px; right: -40px; width: 220px; height: 220px; border-radius: 50%; background: radial-gradient(circle, rgba(192, 133, 82, 0.1) 0%, transparent 60%); }
    .tier-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
    .tier-label { font-size: 13px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px; }
    .tier-name  { font-size: 32px; font-weight: 800; color: var(--text-primary); margin: 0; font-family: 'Outfit', sans-serif; }
    .tier-emoji { font-size: 48px; }

    .points-row { display: flex; align-items: baseline; gap: 10px; margin-bottom: 24px; }
    .points-num { font-size: 56px; font-weight: 800; color: var(--teal); letter-spacing: -2px; line-height: 1; font-family: 'Outfit', sans-serif; }
    .points-lbl { font-size: 16px; color: var(--text-secondary); font-weight: 500; }

    .progress-track { background: var(--border); border-radius: 8px; height: 8px; margin-bottom: 12px; overflow: hidden; }
    .progress-fill  { background: var(--teal); border-radius: 8px; height: 100%; transition: width 0.5s ease; position: relative; }
    .progress-fill::after { content: ''; position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.3) 50%, rgba(255,255,255,0) 100%); animation: shimmer 2s infinite; }
    @keyframes shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }

    .progress-lbl   { font-size: 13px; color: var(--text-muted); margin: 0; font-weight: 500; }
    .total-earned   { font-size: 13px; color: var(--text-secondary); margin: 0; font-weight: 600; }

    .tier-info-panel { margin-bottom: 0; padding: 32px 24px; }
    .tier-row { display: flex; justify-content: space-between; align-items: center; padding: 14px 0; border-bottom: 1px dashed var(--border); }
    .tier-row:last-of-type { border-bottom: none; }

    .tier-badge { font-size: 13px; font-weight: 700; padding: 4px 12px; border-radius: 6px; }
    .tier-badge.bronze { background: rgba(201,153,107,0.15); color: #C9996B; }
    .tier-badge.silver { background: rgba(160,168,180,0.15); color: #A0A8B4; }
    .tier-badge.gold   { background: rgba(245,158,11,0.15); color: #F59E0B; }
    .tier-range { font-size: 14px; color: var(--text-secondary); font-weight: 500; }

    .empty-state { text-align: center; color: var(--text-muted); }
    .empty-state mat-icon { font-size: 40px; width: 40px; height: 40px; margin-bottom: 12px; opacity: 0.5; }
    .empty-state p { font-size: 14px; margin: 0; }

    .data-list { overflow: hidden; }
    .data-row { display: flex; align-items: center; padding: 16px 24px; border-bottom: 1px dashed var(--border); transition: background 0.15s; }
    .data-row:last-child { border-bottom: none; }
    .data-row:hover { background: rgba(192, 133, 82, 0.03); }

    .pts-icon { width: 42px; height: 42px; border-radius: 12px; background: rgba(192, 133, 82, 0.1); display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-right: 16px; }
    .pts-icon mat-icon { font-size: 20px; width: 20px; height: 20px; color: var(--teal); }

    .tx-info { flex: 1; }
    .tx-reason { margin: 0 0 4px; font-size: 14px; font-weight: 600; color: var(--text-primary); }
    .tx-ref    { margin: 0; font-size: 12px; color: var(--text-muted); font-family: monospace; letter-spacing: 0.5px; }
    .tx-date   { font-size: 13px; color: var(--text-muted); white-space: nowrap; }

    .pts-badge { background: rgba(16,185,129,0.1); color: #10B981; border: 1px solid rgba(16,185,129,0.3); padding: 4px 12px; border-radius: 20px; font-size: 13px; font-weight: 700; white-space: nowrap; }
    .cashback-badge { background: rgba(59,130,246,0.1); color: #2563EB; border-color: rgba(37,99,235,0.35); }

    @media (max-width: 900px) {
      .top-row { grid-template-columns: 1fr; }
    }
  `]
})
export class RewardsComponent implements OnInit {
  reward: RewardSummary | null = null;
  history: RewardHistoryItem[] = [];
  campaignRedemptions: CampaignRedemption[] = [];
  loading = true;

  constructor(private api: ApiService, private snackBar: MatSnackBar) {}

  ngOnInit(): void {
    forkJoin({
      rewards: this.api.get<any>('/api/rewards').pipe(catchError(() => of({ success: false, data: null }))),
      history: this.api.get<any>('/api/rewards/history').pipe(catchError(() => of({ success: false, data: [] }))),
      redemptions: this.api.get<any>('/api/rewards/campaigns/my-redemptions').pipe(catchError(() => of({ success: false, data: [] })))
    }).subscribe({
      next: ({ rewards, history, redemptions }) => {
        if (rewards.success) this.reward = rewards.data;
        if (history.success) this.history = history.data ?? [];
        if (redemptions.success) this.campaignRedemptions = redemptions.data ?? [];
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.snackBar.open('Unable to load rewards right now.', 'Close', { duration: 3000 });
      }
    });
  }

  get tierEmoji(): string {
    return this.reward?.tier === 'Gold' ? '??' : this.reward?.tier === 'Silver' ? '??' : '??';
  }

  get progress(): number {
    const t = this.reward?.totalEarned ?? 0;
    if (t >= 5000) return 100;
    if (t >= 1000) return ((t - 1000) / 4000) * 100;
    return (t / 1000) * 100;
  }

  get progressLabel(): string {
    const t = this.reward?.totalEarned ?? 0;
    if (t >= 5000) return 'Gold tier reached!';
    if (t >= 1000) return `${5000 - t} pts to Gold`;
    return `${1000 - t} pts to Silver`;
  }

  formatTransactionType(value: string): string {
    if (value === 'topup') return 'Topup';
    if (value === 'transfer_in') return 'Transfer In';
    if (value === 'transfer_out') return 'Transfer Out';
    return value;
  }

  formatCampaignReward(redemption: CampaignRedemption): string {
    if (redemption.rewardType === 'POINTS') return `+${redemption.rewardPoints} pts`;
    if (redemption.rewardType === 'CASHBACK') return `?${redemption.cashbackAmount.toFixed(2)} cashback`;
    return 'Offer applied';
  }
}
