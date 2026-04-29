import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ApiService } from '../../../core/services/api';

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatSnackBarModule],
  template: `
    <div class="spinner-overlay" *ngIf="loading"><div class="spinner"></div></div>
    
    <div class="page-container fade-in">
      <div class="page-header">
        <div>
          <h1 class="page-title">Transaction History</h1>
          <p class="page-subtitle">View and download your past wallet activity.</p>
        </div>
        <div class="export-btns" *ngIf="transactions.length > 0">
          <button class="export-btn" (click)="downloadCsv()"><mat-icon>table_view</mat-icon>CSV</button>
          <button class="export-btn teal" (click)="downloadPdf()"><mat-icon>picture_as_pdf</mat-icon>PDF</button>
        </div>
      </div>

      <!-- Stats row -->
      <div class="stats-row">
        <div class="stat-card">
          <div class="stat-icon income"><mat-icon>call_received</mat-icon></div>
          <div><p class="stat-label">Total Received</p><p class="stat-val">&#8377;{{ totalReceived | number:'1.2-2' }}</p></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon expense"><mat-icon>call_made</mat-icon></div>
          <div><p class="stat-label">Total Sent</p><p class="stat-val">&#8377;{{ totalSent | number:'1.2-2' }}</p></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon txns"><mat-icon>receipt_long</mat-icon></div>
          <div><p class="stat-label">Transactions</p><p class="stat-val">{{ transactions.length }}</p></div>
        </div>
      </div>

      <!-- Table Wrapper -->
      <div class="wa-card list-wrapper">
        <div class="table-header">
          <span>Transaction</span>
          <span>Date</span>
          <span>Reference</span>
          <span class="right">Amount</span>
          <span class="right">Balance After</span>
        </div>

        <div class="empty-state" *ngIf="transactions.length === 0 && !loading">
          <mat-icon>receipt_long</mat-icon>
          <p>No transactions yet. Make your first top-up!</p>
        </div>

        <div class="table-list">
          <div class="table-row" *ngFor="let tx of transactions">
            <div class="tx-cell">
              <div class="tx-icon" [class]="tx.type"><mat-icon>{{ getIcon(tx.type) }}</mat-icon></div>
              <div>
                <p class="tx-label">{{ getLabel(tx.type) }}</p>
                <p class="tx-note" *ngIf="tx.note">{{ tx.note }}</p>
              </div>
            </div>
            <span class="date-cell">{{ tx.createdAt | date:'dd MMM yyyy, hh:mm a' }}</span>
            <span class="ref-cell">{{ tx.reference }}</span>
            <span class="amount-cell right" [class]="tx.type">
              {{ tx.type === 'transfer_out' ? '&minus;' : '+' }}&#8377;{{ tx.amount | number:'1.2-2' }}
            </span>
            <span class="bal-cell right">&#8377;{{ tx.balanceAfter | number:'1.2-2' }}</span>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .page-container { max-width: 1140px; margin: 0 auto; padding-bottom: 32px; }
    .page-header { margin-bottom: 32px; display: flex; align-items: flex-end; justify-content: space-between;}
    .page-title { font-size: 32px; font-weight: 800; color: var(--text-primary); font-family: 'Outfit', sans-serif; margin-bottom: 6px; letter-spacing: -0.5px; }
    .page-subtitle { color: var(--text-secondary); font-size: 15px; margin: 0; font-weight: 500;}

    .stats-row { display: flex; align-items: center; gap: 20px; margin-bottom: 32px; flex-wrap: wrap; }
    .stat-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--r-md); padding: 20px 24px; display: flex; align-items: center; gap: 16px; flex: 1; min-width: 220px; box-shadow: var(--shadow-sm); transition: all 0.2s;}
    .stat-card:hover { transform: translateY(-2px); box-shadow: var(--shadow-md); border-color: var(--teal); }

    .stat-icon { width: 50px; height: 50px; border-radius: 14px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .stat-icon mat-icon { font-size: 24px; width: 24px; height: 24px; }
    .stat-icon.income { background: rgba(45, 138, 86, 0.1); color: var(--success); }
    .stat-icon.expense { background: rgba(217, 72, 72, 0.1); color: var(--danger); }
    .stat-icon.txns { background: var(--teal-dim); color: var(--teal); }
    
    .stat-label { margin: 0 0 6px; font-size: 13px; color: var(--text-muted); font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
    .stat-val   { margin: 0; font-size: 24px; font-weight: 800; color: var(--text-primary); font-family: 'Outfit', sans-serif;}
    
    .export-btns { display: flex; gap: 12px; }
    .export-btn { display: flex; align-items: center; gap: 8px; padding: 12px 20px; border-radius: 12px; border: 1.5px solid var(--border); background: var(--bg); color: var(--text-primary); font-size: 14px; font-weight: 600; cursor: pointer; font-family: 'Inter', sans-serif; transition: all 0.2s; box-shadow: var(--shadow-sm);}
    .export-btn:hover { border-color: var(--teal-light); color: var(--teal); background: var(--space-800); transform: translateY(-1px);}
    .export-btn.teal { border-color: var(--teal); color: #fff; background: var(--teal); }
    .export-btn.teal:hover { background: var(--secondary); border-color: var(--secondary); box-shadow: var(--shadow-teal); }
    .export-btn mat-icon { font-size: 18px; width: 18px; height: 18px; }

    .list-wrapper { padding: 0; overflow: hidden; background: var(--bg-card); border-radius: var(--r-xl);}
    
    .table-header { display: grid; grid-template-columns: 2.5fr 1.5fr 2fr 1fr 1fr; gap: 20px; padding: 20px 32px; background: var(--space-800); font-size: 12px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 1px; border-bottom: 1px solid var(--space-600); }
    
    .table-list { display: flex; flex-direction: column; }
    .table-row { display: grid; grid-template-columns: 2.5fr 1.5fr 2fr 1fr 1fr; gap: 20px; padding: 20px 32px; border-bottom: 1px solid var(--space-600); align-items: center; transition: all 0.2s ease; cursor: pointer;}
    .table-row:last-child { border-bottom: none; }
    .table-row:hover { background: var(--space-800); padding-left: 36px;}
    
    .tx-cell { display: flex; align-items: center; gap: 16px; }
    .tx-icon { width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .tx-icon mat-icon { font-size: 20px; width: 20px; height: 20px; }
    .tx-icon.topup        { background: rgba(45,138,86,0.1); color: var(--success);}
    .tx-icon.transfer_in  { background: rgba(45,106,138,0.1); color: var(--info);}
    .tx-icon.transfer_out { background: rgba(217,72,72,0.1); color: var(--danger);}
    .tx-icon.admin_adjustment { background: var(--teal-dim); color: var(--teal);}
    .tx-icon.cashback { background: rgba(59,130,246,0.1); color: #3B82F6; }
    
    .tx-label { margin: 0 0 4px; font-size: 15px; font-weight: 700; color: var(--text-primary); }
    .tx-note  { margin: 0; font-size: 13px; color: var(--text-secondary); font-style: italic; }
    .date-cell { font-size: 14px; font-weight: 500; color: var(--text-secondary); }
    .ref-cell  { font-size: 13px; color: var(--text-muted); font-family: monospace; background: var(--space-800); padding: 4px 8px; border-radius: 6px;}
    
    .amount-cell { font-size: 16px; font-weight: 800; font-family: 'Outfit', sans-serif;}
    .amount-cell.topup        { color: var(--success); }
    .amount-cell.transfer_in  { color: var(--info); }
    .amount-cell.transfer_out { color: var(--danger); }
    .amount-cell.admin_adjustment { color: var(--teal); }
    .amount-cell.cashback { color: #3B82F6; }
    .bal-cell { font-size: 15px; font-weight: 600; color: var(--text-muted); font-family: 'Outfit', sans-serif;}
    .right { text-align: right; }
    
    .empty-state { text-align: center; padding: 80px 24px; color: var(--text-muted); }
    .empty-state mat-icon { font-size: 56px; width: 56px; height: 56px; margin-bottom: 16px; opacity: 0.3; }
    .empty-state p { font-size: 15px; font-weight: 500;}
    
    @media (max-width: 992px) {
      .table-header { grid-template-columns: 2fr 1fr 1fr; }
      .table-header span:nth-child(3), .table-header span:nth-child(5) { display: none; }
      .table-row { grid-template-columns: 2fr 1fr 1fr; }
      .table-row > *:nth-child(3), .table-row > *:nth-child(5) { display: none; }
      .page-header { flex-direction: column; align-items: flex-start; gap: 16px;}
    }
  `]
})
export class HistoryComponent implements OnInit {
  transactions: any[] = []; loading = true; totalReceived = 0; totalSent = 0;
  constructor(private api: ApiService, private snackBar: MatSnackBar) {}
  ngOnInit(): void {
    this.api.get<any>('/api/wallet/history').subscribe({
      next: (res) => { if (res.success) { this.transactions = res.data; this.calcSummary(); } this.loading = false; },
      error: () => { this.snackBar.open('Failed to load history', 'Close', { duration: 3000 }); this.loading = false; }
    });
  }
  calcSummary(): void {
    this.totalReceived = this.transactions.filter(t => t.type === 'topup' || t.type === 'transfer_in').reduce((s, t) => s + t.amount, 0);
    this.totalSent = this.transactions.filter(t => t.type === 'transfer_out').reduce((s, t) => s + t.amount, 0);
  }
  getIcon(type: string): string { const m: Record<string,string> = { topup: 'add_circle', transfer_in: 'call_received', transfer_out: 'call_made', admin_adjustment: 'tune', cashback: 'local_offer' }; return m[type] ?? 'swap_horiz'; }
  getLabel(type: string): string { const m: Record<string,string> = { topup: 'Wallet Top Up', transfer_in: 'Money Received', transfer_out: 'Money Sent', admin_adjustment: 'Admin Adjustment', cashback: 'Cashback Reward' }; return m[type] ?? type; }
  downloadCsv(): void { this.api.download('/api/wallet/history/export/csv', `wallet-history-${new Date().toISOString().slice(0,10)}.csv`); }
  downloadPdf(): void { this.api.download('/api/wallet/history/export/pdf', `wallet-history-${new Date().toISOString().slice(0,10)}.pdf`); }
}
