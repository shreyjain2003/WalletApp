/**
 * analytics.ts — AnalyticsComponent
 *
 * Spending analytics page with Chart.js visualisations.
 * Route: /analytics (protected by authGuard)
 *
 * Data source: GET /api/wallet/history (same endpoint as the history page)
 *
 * Charts rendered after data loads (not in ngAfterViewInit):
 *  - Doughnut chart: transaction count breakdown (topup / sent / received)
 *  - Bar chart: total amount by transaction type
 *
 * Summary cards: Total Received, Total Sent
 * Count row: Top Ups, Sent, Received, Total
 * Recent Activity: last 5 transactions
 *
 * Chart.js is registered globally at the top of the file.
 * Existing chart instances are destroyed before re-rendering to prevent
 * "Canvas is already in use" errors on navigation.
 */
import { Component, OnInit, AfterViewInit, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ApiService } from '../../core/services/api';
import { Chart, registerables } from 'chart.js';

// Register all Chart.js components (scales, elements, plugins) globally
Chart.register(...registerables);

@Component({
  selector: 'app-analytics',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatSnackBarModule],
  template: `
    <div class="spinner-overlay" *ngIf="loading"><div class="spinner"></div></div>
    
    <div class="page-container fade-in">
      <div class="page-header">
        <h1 class="page-title">Spending Analytics</h1>
        <p class="page-subtitle">Track your transactions and spending habits.</p>
      </div>

      <div class="summary-grid">
        <div class="wa-card sum-card green">
          <div class="sum-icon"><mat-icon>arrow_downward</mat-icon></div>
          <div><p class="sum-label">Total Received</p><p class="sum-val">₹{{ totalReceived | number:'1.0-0' }}</p></div>
        </div>
        <div class="wa-card sum-card red">
          <div class="sum-icon"><mat-icon>arrow_upward</mat-icon></div>
          <div><p class="sum-label">Total Sent</p><p class="sum-val">₹{{ totalSent | number:'1.0-0' }}</p></div>
        </div>
      </div>

      <div class="wa-card count-card">
        <div class="count-item"><span class="count-num">{{ topupCount }}</span><span class="count-lbl">Top Ups</span></div>
        <div class="count-div"></div>
        <div class="count-item"><span class="count-num">{{ sentCount }}</span><span class="count-lbl">Sent</span></div>
        <div class="count-div"></div>
        <div class="count-item"><span class="count-num">{{ receivedCount }}</span><span class="count-lbl">Received</span></div>
        <div class="count-div"></div>
        <div class="count-item"><span class="count-num">{{ totalTransactions }}</span><span class="count-lbl">Total</span></div>
      </div>

      <div class="wa-card" *ngIf="totalTransactions > 0" style="margin-bottom: 24px;">
        <h3 class="card-title-small" style="margin-bottom: 24px;">Transaction Breakdown</h3>
        <div class="chart-wrap"><canvas #donutChart></canvas></div>
        <div class="legend">
          <div class="legend-item"><div class="leg-dot topup"></div><span>Top Ups ({{ topupCount }})</span></div>
          <div class="legend-item"><div class="leg-dot sent"></div><span>Sent ({{ sentCount }})</span></div>
          <div class="legend-item"><div class="leg-dot recv"></div><span>Received ({{ receivedCount }})</span></div>
        </div>
      </div>

      <div class="wa-card" *ngIf="totalTransactions > 0" style="margin-bottom: 24px;">
        <h3 class="card-title-small" style="margin-bottom: 24px;">Amount by Type</h3>
        <div class="chart-wrap"><canvas #barChart></canvas></div>
      </div>

      <div class="wa-card" style="padding: 0;">
        <div style="padding: 24px 24px 12px;"><h3 class="card-title-small">Recent Activity</h3></div>
        
        <div class="activity-item" *ngFor="let tx of recentTransactions">
          <div class="act-icon" [class]="tx.type"><mat-icon>{{ getIcon(tx.type) }}</mat-icon></div>
          <div class="act-info"><p class="act-type">{{ getLabel(tx.type) }}</p><p class="act-date">{{ tx.createdAt | date:'dd MMM, hh:mm a' }}</p></div>
          <span class="act-amount" [class]="tx.type">{{ tx.type === 'transfer_out' ? '-' : '+' }}₹{{ tx.amount | number:'1.0-0' }}</span>
        </div>
        
        <div class="empty-state" *ngIf="recentTransactions.length === 0 && !loading" style="padding: 40px 24px;">
          <mat-icon>receipt_long</mat-icon><p>No transactions yet</p>
        </div>
      </div>

    </div>
  `,
  styles: [`
    .page-container { max-width: 680px; margin: 0 auto; padding-bottom: 32px; }
    .page-header { margin-bottom: 32px; display: flex; flex-direction: column; }
    .page-title { font-size: 32px; font-weight: 800; color: var(--text-primary); font-family: 'Outfit', sans-serif; margin-bottom: 8px; letter-spacing: -1px; }
    .page-subtitle { color: var(--text-secondary); font-size: 15px; margin: 0; }

    .summary-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px; }
    .sum-card { display: flex; align-items: center; gap: 16px; margin: 0; }
    
    .sum-icon { width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .sum-icon mat-icon { font-size: 22px; width: 22px; height: 22px; }
    .sum-card.green .sum-icon { background: rgba(16,185,129,0.1); color: #10B981; }
    .sum-card.red   .sum-icon { background: rgba(239,68,68,0.1); color: #EF4444; }
    
    .sum-label { margin: 0 0 4px; font-size: 12px; font-weight: 500; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.8px; }
    .sum-val   { margin: 0; font-size: 22px; font-weight: 800; color: var(--text-primary); font-family: 'Outfit', sans-serif; }
    
    .count-card { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; padding: 24px; }
    .count-item { text-align: center; flex: 1; }
    .count-num { display: block; font-size: 24px; font-weight: 800; color: var(--text-primary); font-family: 'Outfit', sans-serif; margin-bottom: 4px; }
    .count-lbl { font-size: 12px; color: var(--text-secondary); font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
    .count-div { width: 1px; height: 36px; background: var(--border); }
    
    .chart-wrap { position: relative; height: 240px; display: flex; align-items: center; justify-content: center; }
    .chart-wrap canvas { max-height: 240px; }
    
    .legend { display: flex; gap: 20px; flex-wrap: wrap; margin-top: 24px; justify-content: center; }
    .legend-item { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--text-secondary); font-weight: 600; }
    .leg-dot { width: 12px; height: 12px; border-radius: 4px; }
    .leg-dot.topup { background: var(--teal); }
    .leg-dot.sent  { background: #EF4444; }
    .leg-dot.recv  { background: #3B82F6; }
    
    .activity-item { display: flex; align-items: center; gap: 14px; padding: 16px 24px; border-bottom: 1px dashed var(--border); transition: background 0.15s; }
    .activity-item:last-child { border-bottom: none; }
    .activity-item:hover { background: rgba(192, 133, 82, 0.03); }
    
    .act-icon { width: 42px; height: 42px; border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .act-icon mat-icon { font-size: 20px; width: 20px; height: 20px; }
    .act-icon.topup        { background: rgba(16,185,129,0.1); color: #10B981; }
    .act-icon.transfer_in  { background: rgba(59,130,246,0.1); color: #3B82F6; }
    .act-icon.transfer_out { background: rgba(239,68,68,0.1); color: #EF4444; }
    
    .act-info { flex: 1; }
    .act-type { margin: 0 0 2px; font-size: 14px; font-weight: 600; color: var(--text-primary); }
    .act-date { margin: 0; font-size: 12px; color: var(--text-muted); }
    
    .act-amount { font-weight: 700; font-size: 14px; white-space: nowrap; }
    .act-amount.topup        { color: #10B981; }
    .act-amount.transfer_in  { color: #3B82F6; }
    .act-amount.transfer_out { color: #EF4444; }
    
    .empty-state { text-align: center; color: var(--text-muted); }
    .empty-state mat-icon { font-size: 40px; width: 40px; height: 40px; margin-bottom: 12px; opacity: 0.5; }
    .empty-state p { font-size: 14px; margin: 0; }
  `]
})
export class AnalyticsComponent implements OnInit, AfterViewInit {

  /** Template reference to the doughnut chart canvas element */
  @ViewChild('donutChart') donutChartRef!: ElementRef;
  /** Template reference to the bar chart canvas element */
  @ViewChild('barChart') barChartRef!: ElementRef;

  /** Controls the full-page spinner */
  loading = true;
  /** All transactions from GET /api/wallet/history */
  transactions: any[] = [];
  /** Last 5 transactions shown in the Recent Activity list */
  recentTransactions: any[] = [];

  /** Summary stats computed from the transactions array */
  totalReceived = 0;
  totalSent = 0;
  topupCount = 0;
  sentCount = 0;
  receivedCount = 0;
  totalTransactions = 0;

  /** Chart.js instances — stored so they can be destroyed before re-rendering */
  private donutChartInstance: Chart | null = null;
  private barChartInstance: Chart | null = null;

  constructor(private api: ApiService, private snackBar: MatSnackBar) { }

  /**
   * Loads transaction history, computes stats, and renders charts.
   * Charts are rendered with a 100ms setTimeout after data loads to ensure
   * the canvas elements are in the DOM before Chart.js tries to use them.
   */
  ngOnInit(): void {
    this.api.get<any>('/api/wallet/history').subscribe({
      next: (res) => {
        if (res.success) {
          this.transactions = res.data;
          this.calculateStats();
          this.recentTransactions = res.data.slice(0, 5);
          // Defer chart rendering until after Angular has rendered the canvas elements
          setTimeout(() => this.renderCharts(), 100);
        }
        this.loading = false;
      },
      error: () => {
        this.snackBar.open('Failed to load analytics', 'Close', { duration: 3000 });
        this.loading = false;
      }
    });
  }

  /**
   * ngAfterViewInit is intentionally empty.
   * Charts are rendered in ngOnInit after data loads, not here,
   * because the canvas elements are conditionally rendered (*ngIf="totalTransactions > 0")
   * and may not exist in the DOM until data is available.
   */
  ngAfterViewInit(): void { }

  /** Computes all summary statistics from the loaded transactions array */
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

  /**
   * Renders both Chart.js charts.
   * Destroys existing instances first to prevent "Canvas already in use" errors
   * that occur when navigating away and back to this page.
   */
  renderCharts(): void {
    if (this.totalTransactions === 0) return;

    // ── Doughnut Chart: transaction count breakdown ────────────────────────
    if (this.donutChartRef) {
      // Destroy the previous instance before creating a new one
      if (this.donutChartInstance) this.donutChartInstance.destroy();
      this.donutChartInstance = new Chart(this.donutChartRef.nativeElement, {
        type: 'doughnut',
        data: {
          labels: ['Top Ups', 'Money Sent', 'Money Received'],
          datasets: [{
            data: [this.topupCount, this.sentCount, this.receivedCount],
            backgroundColor: ['#C08552', '#EF4444', '#3B82F6'],
            borderWidth: 0,
            hoverOffset: 8
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '72%', // thick ring style
          plugins: { legend: { display: false } } // custom legend below the chart
        }
      });
    }

    // ── Bar Chart: total amount by transaction type ────────────────────────
    if (this.barChartRef) {
      const topupTotal = this.transactions.filter(t => t.type === 'topup').reduce((s, t) => s + t.amount, 0);
      const sentTotal = this.transactions.filter(t => t.type === 'transfer_out').reduce((s, t) => s + t.amount, 0);
      const receivedTotal = this.transactions.filter(t => t.type === 'transfer_in').reduce((s, t) => s + t.amount, 0);

      // Apply theme-consistent defaults to Chart.js global config
      Chart.defaults.color = '#6B7280';
      Chart.defaults.font.family = 'Inter, sans-serif';

      if (this.barChartInstance) this.barChartInstance.destroy();
      this.barChartInstance = new Chart(this.barChartRef.nativeElement, {
        type: 'bar',
        data: {
          labels: ['Top Ups', 'Sent', 'Received'],
          datasets: [{
            data: [topupTotal, sentTotal, receivedTotal],
            backgroundColor: ['rgba(192, 133, 82, 0.8)', 'rgba(239, 68, 68, 0.8)', 'rgba(59, 130, 246, 0.8)'],
            borderRadius: 8,
            borderSkipped: false
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: {
              beginAtZero: true,
              grid: { color: 'rgba(255, 255, 255, 0.05)' },
              ticks: { callback: (val) => `₹${Number(val).toLocaleString()}` }
            },
            x: { grid: { display: false } }
          }
        }
      });
    }
  }

  /** Maps a transaction type to a Material icon name */
  getIcon(type: string): string {
    switch (type) {
      case 'topup': return 'add_circle';
      case 'transfer_in': return 'arrow_downward';
      case 'transfer_out': return 'arrow_upward';
      default: return 'swap_horiz';
    }
  }

  /** Maps a transaction type to a human-readable label */
  getLabel(type: string): string {
    switch (type) {
      case 'topup': return 'Top Up';
      case 'transfer_in': return 'Money Received';
      case 'transfer_out': return 'Money Sent';
      default: return type;
    }
  }
}
