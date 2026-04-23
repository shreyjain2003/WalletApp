import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [CommonModule, RouterLink, MatIconModule],
  template: `
    <div class="nf-page">
      <div class="nf-card fade-in">
        <div class="nf-icon"><mat-icon>search_off</mat-icon></div>
        <h1>404</h1>
        <h2>Page Not Found</h2>
        <p>The page you're looking for doesn't exist or has been moved.</p>
        <a routerLink="/dashboard" class="nf-btn">
          <mat-icon>home</mat-icon> Back to Dashboard
        </a>
      </div>
    </div>
  `,
  styles: [`
    .nf-page { min-height: 100vh; background: var(--bg); display: flex; align-items: center; justify-content: center; padding: 24px; }
    .nf-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: 20px; padding: 48px 40px; text-align: center; max-width: 400px; width: 100%; box-shadow: var(--shadow-lg); }
    .nf-icon { width: 64px; height: 64px; border-radius: 16px; background: var(--teal-dim); border: 1px solid rgba(192, 133, 82, 0.2); display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; }
    .nf-icon mat-icon { color: var(--teal); font-size: 32px; width: 32px; height: 32px; }
    h1 { font-size: 72px; font-weight: 900; color: var(--border); margin: 0 0 4px; letter-spacing: -2px; font-family: 'Outfit', sans-serif; }
    h2 { font-size: 20px; font-weight: 800; color: var(--text-primary); margin: 0 0 12px; font-family: 'Outfit', sans-serif; }
    p  { color: var(--text-secondary); font-size: 14px; line-height: 1.6; margin-bottom: 28px; }
    .nf-btn { display: inline-flex; align-items: center; gap: 8px; background: var(--teal); color: #FFF; text-decoration: none; padding: 12px 24px; border-radius: 10px; font-size: 14px; font-weight: 700; transition: all 0.2s ease; box-shadow: var(--shadow-teal); font-family: 'Inter', sans-serif; }
    .nf-btn:hover { opacity: 0.9; transform: translateY(-1px); }
    .nf-btn mat-icon { font-size: 18px; width: 18px; height: 18px; }
  `]
})
export class NotFoundComponent {}
