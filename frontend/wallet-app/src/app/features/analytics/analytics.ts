import { Component, OnInit, AfterViewInit, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ApiService } from '../../core/services/api';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

@Component({
  selector: 'app-analytics',
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
        <span class="title">Spending Analytics</span>
      </div>

      <div class="content">

        <!-- Summary Cards -->
        <div class="summary-grid">
          <div class="summary-card income">
            <div class="summary-icon">
              <mat-icon>arrow_downward</mat-icon>
            </div>
            <div class="summary-info">
              <p class="summary-label">Total Received</p>
              <p class="summary-amount">₹{{ totalReceived | number:'1.0-0' }}</p>
            </div>
          </div>

          <div class="summary-card expense">
            <div class="summary-icon">
              <mat-icon>arrow_upward</mat-icon>
            </div>
            <div class="summary-info">
              <p class="summary-label">Total Sent</p>
              <p class="summary-amount">₹{{ totalSent | number:'1.0-0' }}</p>
            </div>
          </div>
        </div>

        <!-- Transaction Count -->
        <div class="count-grid">
          <div class="count-item">
            <span class="count-num">{{ topupCount }}</span>
            <span class="count-label">Top Ups</span>
          </div>
          <div class="count-divider"></div>
          <div class="count-item">
            <span class="count-num">{{ sentCount }}</span>
            <span class="count-label">Sent</span>
          </div>
          <div class="count-divider"></div>
          <div class="count-item">
            <span class="count-num">{{ receivedCount }}</span>
            <span class="count-label">Received</span>
          </div>
          <div class="count-divider"></div>
          <div class="count-item">
            <span class="count-num">{{ totalTransactions }}</span>
            <span class="count-label">Total</span>
          </div>
        </div>

        <!-- Donut Chart -->
        <div class="chart-card" *ngIf="totalTransactions > 0">
          <h3 class="chart-title">Transaction Breakdown</h3>
          <div class="chart-wrap">
            <canvas #donutChart></canvas>
          </div>
          <div class="legend">
            <div class="legend-item">
              <div class="legend-dot topup"></div>
              <span>Top Ups ({{ topupCount }})</span>
            </div>
            <div class="legend-item">
              <div class="legend-dot sent"></div>
              <span>Money Sent ({{ sentCount }})</span>
            </div>
            <div class="legend-item">
              <div class="legend-dot received"></div>
              <span>Money Received ({{ receivedCount }})</span>
            </div>
          </div>
        </div>

        <!-- Bar Chart -->
        <div class="chart-card" *ngIf="totalTransactions > 0">
          <h3 class="chart-title">Amount by Type</h3>
          <div class="chart-wrap">
            <canvas #barChart></canvas>
          </div>
        </div>

        <!-- Recent Activity -->
        <div class="activity-card">
          <h3 class="chart-title">Recent Activity</h3>

          <div class="activity-item" *ngFor="let tx of recentTransactions">
            <div class="activity-icon" [class]="tx.type">
              <mat-icon>{{ getIcon(tx.type) }}</mat-icon>
            </div>
            <div class="activity-info">
              <p class="activity-type">{{ getLabel(tx.type) }}</p>
              <p class="activity-date">{{ tx.createdAt | date:'dd MMM, hh:mm a' }}</p>
            </div>
            <div class="activity-amount" [class]="tx.type">
              {{ tx.type === 'transfer_out' ? '-' : '+' }}₹{{ tx.amount | number:'1.0-0' }}
            </div>
          </div>

          <p class="empty" *ngIf="recentTransactions.length === 0 && !loading">
            No transactions yet. Make your first top-up!
          </p>
        </div>

      </div>
    </div>
  `,
  styles: [`
    .page-container { min-height: 100vh; background: #f0f2f5; }

    .navbar {
      display: flex;
      align-items: center;
      padding: 8px 16px;
      background: linear-gradient(135deg, #e91e63 0%, #f06292 100%);
      color: white;
      box-shadow: 0 4px 20px rgba(233,30,99,0.3);
      position: sticky;
      top: 0;
      z-index: 100;
    }

    .title { font-size: 17px; font-weight: 700; margin-left: 8px; flex: 1; }
    .content { padding: 20px 16px; max-width: 500px; margin: 0 auto; }

    /* ── Summary ── */
    .summary-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-bottom: 12px;
    }

    .summary-card {
      border-radius: 20px;
      padding: 16px;
      display: flex;
      align-items: center;
      gap: 12px;
      box-shadow: 0 2px 20px rgba(0,0,0,0.06);
    }

    .summary-card.income { background: linear-gradient(135deg, #e8f5e9, #c8e6c9); }
    .summary-card.expense { background: linear-gradient(135deg, #ffebee, #ffcdd2); }

    .summary-icon {
      width: 44px; height: 44px;
      border-radius: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .income .summary-icon { background: #00c853; }
    .income .summary-icon mat-icon { color: white; }
    .expense .summary-icon { background: #f44336; }
    .expense .summary-icon mat-icon { color: white; }

    .summary-label { margin: 0; font-size: 12px; color: #666; font-weight: 500; }
    .summary-amount { margin: 4px 0 0; font-size: 20px; font-weight: 800; color: #1a1a2e; }

    /* ── Count Grid ── */
    .count-grid {
      background: white;
      border-radius: 20px;
      padding: 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 16px;
      box-shadow: 0 2px 20px rgba(0,0,0,0.06);
    }

    .count-item { text-align: center; flex: 1; }
    .count-num { display: block; font-size: 24px; font-weight: 800; color: #1a1a2e; }
    .count-label { font-size: 11px; color: #888; font-weight: 500; }
    .count-divider { width: 1px; height: 36px; background: #f0f0f0; }

    /* ── Chart Card ── */
    .chart-card {
      background: white;
      border-radius: 20px;
      padding: 20px;
      margin-bottom: 16px;
      box-shadow: 0 2px 20px rgba(0,0,0,0.06);
    }

    .chart-title {
      margin: 0 0 16px;
      font-size: 15px;
      font-weight: 700;
      color: #1a1a2e;
    }

    .chart-wrap {
      position: relative;
      height: 220px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .chart-wrap canvas { max-height: 220px; }

    .legend {
      display: flex;
      gap: 16px;
      flex-wrap: wrap;
      margin-top: 16px;
      justify-content: center;
    }

    .legend-item {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      color: #666;
      font-weight: 500;
    }

    .legend-dot {
      width: 10px; height: 10px;
      border-radius: 50%;
    }

    .legend-dot.topup    { background: #00c853; }
    .legend-dot.sent     { background: #f44336; }
    .legend-dot.received { background: #2979ff; }

    /* ── Activity ── */
    .activity-card {
      background: white;
      border-radius: 20px;
      padding: 20px;
      margin-bottom: 24px;
      box-shadow: 0 2px 20px rgba(0,0,0,0.06);
    }

    .activity-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 0;
      border-bottom: 1px solid #f5f5f5;
    }

    .activity-item:last-child { border-bottom: none; }

    .activity-icon {
      width: 40px; height: 40px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .activity-icon mat-icon { color: white; font-size: 20px; width: 20px; height: 20px; }
    .activity-icon.topup        { background: linear-gradient(135deg, #00c853, #69f0ae); }
    .activity-icon.transfer_in  { background: linear-gradient(135deg, #2979ff, #82b1ff); }
    .activity-icon.transfer_out { background: linear-gradient(135deg, #f44336, #ef9a9a); }

    .activity-info { flex: 1; }
    .activity-type { margin: 0; font-size: 13px; font-weight: 600; color: #1a1a2e; }
    .activity-date { margin: 2px 0 0; font-size: 11px; color: #999; }

    .activity-amount { font-weight: 700; font-size: 14px; }
    .activity-amount.topup        { color: #00c853; }
    .activity-amount.transfer_in  { color: #2979ff; }
    .activity-amount.transfer_out { color: #f44336; }

    .empty { text-align: center; color: #999; padding: 32px; font-size: 14px; }

    /* ── Dark Mode ── */
    :host-context(body.dark) .count-grid,
    :host-context(body.dark) .chart-card,
    :host-context(body.dark) .activity-card {
      background: #13131f;
      border: 1px solid rgba(255,255,255,0.06);
    }

    :host-context(body.dark) .chart-title { color: #e8e8f0; }
    :host-context(body.dark) .count-num { color: #e8e8f0; }
    :host-context(body.dark) .count-divider { background: #1e1e30; }
    :host-context(body.dark) .summary-amount { color: #e8e8f0; }
    :host-context(body.dark) .activity-type { color: #e8e8f0; }
    :host-context(body.dark) .activity-item { border-bottom-color: #1e1e30; }
    :host-context(body.dark) .legend-item { color: #8888aa; }
  `]
})
export class AnalyticsComponent implements OnInit, AfterViewInit {

  @ViewChild('donutChart') donutChartRef!: ElementRef;
  @ViewChild('barChart') barChartRef!: ElementRef;

  loading = true;
  transactions: any[] = [];
  recentTransactions: any[] = [];

  totalReceived = 0;
  totalSent = 0;
  topupCount = 0;
  sentCount = 0;
  receivedCount = 0;
  totalTransactions = 0;

  private donutChartInstance: Chart | null = null;
  private barChartInstance: Chart | null = null;

  constructor(private api: ApiService,
    private snackBar: MatSnackBar) { }

  ngOnInit(): void {
    this.api.get<any>('/api/wallet/history').subscribe({
      next: (res) => {
        if (res.success) {
          this.transactions = res.data;
          this.calculateStats();
          this.recentTransactions = res.data.slice(0, 5);
        }
        this.loading = false;
      },
      error: () => {
        this.snackBar.open('Failed to load analytics', 'Close', { duration: 3000 });
        this.loading = false;
      }
    });
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.renderCharts(), 500);
  }

  calculateStats(): void {
    this.topupCount = this.transactions.filter(t => t.type === 'topup').length;
    this.sentCount = this.transactions.filter(t => t.type === 'transfer_out').length;
    this.receivedCount = this.transactions.filter(t => t.type === 'transfer_in').length;
    this.totalTransactions = this.transactions.length;

    this.totalReceived = this.transactions
      .filter(t => t.type === 'topup' || t.type === 'transfer_in')
      .reduce((sum, t) => sum + t.amount, 0);

    this.totalSent = this.transactions
      .filter(t => t.type === 'transfer_out')
      .reduce((sum, t) => sum + t.amount, 0);
  }

  renderCharts(): void {
    if (this.totalTransactions === 0) return;

    // Donut Chart
    if (this.donutChartRef) {
      if (this.donutChartInstance) this.donutChartInstance.destroy();
      this.donutChartInstance = new Chart(
        this.donutChartRef.nativeElement, {
        type: 'doughnut',
        data: {
          labels: ['Top Ups', 'Money Sent', 'Money Received'],
          datasets: [{
            data: [this.topupCount, this.sentCount, this.receivedCount],
            backgroundColor: ['#00c853', '#f44336', '#2979ff'],
            borderWidth: 0,
            hoverOffset: 8
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '70%',
          plugins: {
            legend: { display: false }
          }
        }
      });
    }

    // Bar Chart
    if (this.barChartRef) {
      const topupTotal = this.transactions
        .filter(t => t.type === 'topup')
        .reduce((s, t) => s + t.amount, 0);
      const sentTotal = this.transactions
        .filter(t => t.type === 'transfer_out')
        .reduce((s, t) => s + t.amount, 0);
      const receivedTotal = this.transactions
        .filter(t => t.type === 'transfer_in')
        .reduce((s, t) => s + t.amount, 0);

      if (this.barChartInstance) this.barChartInstance.destroy();
      this.barChartInstance = new Chart(
        this.barChartRef.nativeElement, {
        type: 'bar',
        data: {
          labels: ['Top Ups', 'Sent', 'Received'],
          datasets: [{
            data: [topupTotal, sentTotal, receivedTotal],
            backgroundColor: [
              'rgba(0,200,83,0.8)',
              'rgba(244,67,54,0.8)',
              'rgba(41,121,255,0.8)'
            ],
            borderRadius: 10,
            borderSkipped: false
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false }
          },
          scales: {
            y: {
              beginAtZero: true,
              grid: { color: 'rgba(0,0,0,0.05)' },
              ticks: {
                callback: (val) => `₹${Number(val).toLocaleString()}`
              }
            },
            x: { grid: { display: false } }
          }
        }
      });
    }
  }

  getIcon(type: string): string {
    switch (type) {
      case 'topup': return 'add_circle';
      case 'transfer_in': return 'arrow_downward';
      case 'transfer_out': return 'arrow_upward';
      default: return 'swap_horiz';
    }
  }

  getLabel(type: string): string {
    switch (type) {
      case 'topup': return 'Top Up';
      case 'transfer_in': return 'Money Received';
      case 'transfer_out': return 'Money Sent';
      default: return type;
    }
  }
}
