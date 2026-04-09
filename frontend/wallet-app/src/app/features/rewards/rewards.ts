import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ApiService } from '../../core/services/api';

@Component({
  selector: 'app-rewards',
  standalone: true,
  imports: [
    CommonModule, RouterLink,
    MatCardModule, MatButtonModule,
    MatIconModule, MatSnackBarModule
  ],
  template: `
    <div class="spinner-overlay" *ngIf="loading">
      <div class="spinner"></div>
    </div>

    <div class="page-container">
      <div class="navbar">
        <button mat-icon-button routerLink="/dashboard">
          <mat-icon>arrow_back</mat-icon>
        </button>
        <span class="title">Rewards</span>
      </div>

      <div class="content">

        <!-- Tier Card -->
        <mat-card class="tier-card" [class]="getTierClass()">
          <mat-card-content>
            <div class="tier-top">
              <span class="tier-emoji">{{ getTierEmoji() }}</span>
              <div>
                <h2 class="tier-name">{{ reward?.tier ?? 'Bronze' }}</h2>
                <p class="tier-sub">Member</p>
              </div>
            </div>

            <div class="points-display">
              <span class="points-number">{{ reward?.pointsBalance ?? 0 }}</span>
              <span class="points-label">Points</span>
            </div>

            <div class="progress-section">
              <div class="progress-bar">
                <div class="progress-fill" [style.width.%]="getProgress()"></div>
              </div>
              <p class="progress-label">{{ getProgressLabel() }}</p>
            </div>

            <p class="total-earned">
              Total Earned: {{ reward?.totalEarned ?? 0 }} pts
            </p>
          </mat-card-content>
        </mat-card>

        <!-- Tier Info -->
        <mat-card class="info-card">
          <mat-card-content>
            <h3>Reward Tiers</h3>
            <div class="tier-row">
              <span>🥉 Bronze</span>
              <span class="tier-range">0 – 999 pts</span>
            </div>
            <div class="tier-row">
              <span>🥈 Silver</span>
              <span class="tier-range">1,000 – 4,999 pts</span>
            </div>
            <div class="tier-row">
              <span>🥇 Gold</span>
              <span class="tier-range">5,000+ pts</span>
            </div>
            <div class="earn-info">
              <mat-icon>info</mat-icon>
              <span>Earn 10 points for every transfer!</span>
            </div>
          </mat-card-content>
        </mat-card>

        <!-- Points History -->
        <h3 class="section-heading">Points History</h3>

        <mat-card *ngIf="history.length === 0 && !loading">
          <mat-card-content>
            <p class="empty">No points earned yet. Make a transfer!</p>
          </mat-card-content>
        </mat-card>

        <mat-card class="tx-card" *ngFor="let tx of history">
          <mat-card-content class="tx-content">
            <div class="points-icon-wrap">
              <mat-icon>stars</mat-icon>
            </div>
            <div class="tx-info">
              <p class="tx-reason">{{ tx.reason }}</p>
              <p class="tx-ref">{{ tx.reference }}</p>
              <p class="tx-date">{{ tx.createdAt | date:'dd MMM yyyy, hh:mm a' }}</p>
            </div>
            <div class="tx-points">+{{ tx.points }} pts</div>
          </mat-card-content>
        </mat-card>

      </div>
    </div>
  `,
  styles: [`
    .page-container { min-height: 100vh; background: #f5f5f5; }
    .navbar {
      display: flex;
      align-items: center;
      padding: 8px 16px;
      background: linear-gradient(135deg, #3f51b5 0%, #5c6bc0 100%);
      color: white;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    }
    .title { font-size: 18px; font-weight: 500; margin-left: 8px; flex: 1; }
    .content { padding: 24px; max-width: 600px; margin: 0 auto; }

    .tier-card {
      color: white;
      margin-bottom: 16px;
      padding: 8px;
    }
    .tier-card.bronze { background: linear-gradient(135deg, #8d6e63, #a1887f) !important; }
    .tier-card.silver { background: linear-gradient(135deg, #546e7a, #78909c) !important; }
    .tier-card.gold   { background: linear-gradient(135deg, #f9a825, #ffd54f) !important; color: #333 !important; }

    .tier-top {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 24px;
    }
    .tier-emoji { font-size: 48px; }
    .tier-name { margin: 0; font-size: 28px; font-weight: 700; }
    .tier-sub { margin: 0; opacity: 0.8; }

    .points-display {
      display: flex;
      align-items: baseline;
      gap: 8px;
      margin-bottom: 16px;
    }
    .points-number { font-size: 56px; font-weight: 700; line-height: 1; }
    .points-label { font-size: 18px; opacity: 0.8; }

    .progress-section { margin-bottom: 12px; }
    .progress-bar {
      background: rgba(255,255,255,0.3);
      border-radius: 8px;
      height: 8px;
      margin-bottom: 6px;
    }
    .progress-fill {
      background: white;
      border-radius: 8px;
      height: 100%;
      transition: width 0.5s ease;
    }
    .progress-label { font-size: 13px; opacity: 0.8; }
    .total-earned { font-size: 13px; opacity: 0.7; margin: 0; }

    .info-card { margin-bottom: 16px; }
    .info-card h3 { margin: 0 0 16px; font-size: 16px; font-weight: 600; }
    .tier-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 0;
      border-bottom: 1px solid #eee;
      font-size: 14px;
    }
    .tier-range { color: #666; }
    .earn-info {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 12px;
      color: #3f51b5;
      font-size: 13px;
      font-weight: 500;
    }
    .earn-info mat-icon { font-size: 18px; width: 18px; height: 18px; }

    .section-heading { margin: 0 0 12px; font-size: 16px; font-weight: 600; color: #333; }

    .tx-card { margin-bottom: 8px; }
    .tx-content {
      display: flex !important;
      align-items: center !important;
      gap: 12px !important;
    }
    .points-icon-wrap {
      width: 44px; height: 44px;
      border-radius: 12px;
      background: linear-gradient(135deg, #f4511e, #ff7043);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .points-icon-wrap mat-icon { color: white; }
    .tx-info { flex: 1; }
    .tx-reason { margin: 0; font-weight: 600; font-size: 14px; }
    .tx-ref { margin: 0; font-size: 11px; color: #999; }
    .tx-date { margin: 0; font-size: 12px; color: #999; }
    .tx-points { font-weight: 700; color: #f4511e; font-size: 16px; }
    .empty { text-align: center; color: #999; padding: 32px; }
  `]
})
export class RewardsComponent implements OnInit {
  reward: any = null;
  history: any[] = [];
  loading = true;

  constructor(private api: ApiService,
    private snackBar: MatSnackBar) { }

  ngOnInit(): void {
    this.api.get<any>('/api/rewards').subscribe({
      next: (res) => {
        if (res.success) this.reward = res.data;
        this.loading = false;
      }
    });

    this.api.get<any>('/api/rewards/history').subscribe({
      next: (res) => { if (res.success) this.history = res.data; }
    });
  }

  getTierEmoji(): string {
    switch (this.reward?.tier) {
      case 'Gold': return '🥇';
      case 'Silver': return '🥈';
      default: return '🥉';
    }
  }

  getTierClass(): string {
    return this.reward?.tier?.toLowerCase() ?? 'bronze';
  }

  getProgress(): number {
    const total = this.reward?.totalEarned ?? 0;
    if (total >= 5000) return 100;
    if (total >= 1000) return ((total - 1000) / 4000) * 100;
    return (total / 1000) * 100;
  }

  getProgressLabel(): string {
    const total = this.reward?.totalEarned ?? 0;
    if (total >= 5000) return '🎉 Gold tier reached!';
    if (total >= 1000) return `${5000 - total} pts to Gold`;
    return `${1000 - total} pts to Silver`;
  }
}
