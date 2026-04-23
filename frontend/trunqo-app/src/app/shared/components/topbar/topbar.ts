import { Component, Output, EventEmitter, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [CommonModule, RouterLink, MatIconModule],
  template: `
    <header class="topbar">
      <button class="menu-btn" (click)="menuClick.emit()">
        <mat-icon>menu</mat-icon>
      </button>

      <div class="topbar-left">
        <span class="page-title">{{ title }}</span>
      </div>

      <div class="topbar-right">
        <a class="icon-btn" routerLink="/notifications" title="Notifications">
          <mat-icon>notifications_none</mat-icon>
          <span class="badge-dot" *ngIf="hasNotifications"></span>
        </a>
        <a class="avatar-btn" routerLink="/profile" title="Profile">
          <div class="avatar">{{ initials }}</div>
        </a>
      </div>
    </header>
  `,
  styles: [`
    .topbar {
      height: 60px;
      background: var(--bg-card);
      border-bottom: 1px solid var(--border);
      display: flex; align-items: center;
      padding: 0 24px; gap: 16px;
      position: sticky; top: 0; z-index: 100;
      box-shadow: var(--shadow-sm);
    }

    .menu-btn {
      display: none; border: none; background: transparent;
      cursor: pointer; color: var(--text-secondary);
      width: 36px; height: 36px; border-radius: 8px;
      align-items: center; justify-content: center;
      transition: all 0.15s;
    }
    .menu-btn:hover { background: var(--space-800); color: var(--text-primary); }
    .menu-btn mat-icon { font-size: 20px; width: 20px; height: 20px; }

    .topbar-left { flex: 1; }
    .page-title {
      font-size: 15px; font-weight: 700; color: var(--text-primary);
      letter-spacing: -0.2px;
    }

    .topbar-right { display: flex; align-items: center; gap: 6px; }

    .icon-btn {
      position: relative;
      width: 36px; height: 36px; border-radius: 8px;
      display: flex; align-items: center; justify-content: center;
      color: var(--text-secondary); text-decoration: none;
      transition: all 0.15s;
    }
    .icon-btn:hover { background: var(--space-800); color: var(--teal); }
    .icon-btn mat-icon { font-size: 20px; width: 20px; height: 20px; }

    .badge-dot {
      position: absolute; top: 7px; right: 7px;
      width: 7px; height: 7px;
      background: var(--teal); border-radius: 50%;
      border: 1.5px solid var(--bg-card);
    }

    .avatar-btn {
      text-decoration: none; margin-left: 4px;
    }
    .avatar {
      width: 34px; height: 34px; border-radius: 8px;
      background: var(--teal);
      color: #FFF; font-size: 13px; font-weight: 800; font-family: 'Outfit', sans-serif;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; transition: opacity 0.15s;
    }
    .avatar:hover { opacity: 0.85; }

    @media (max-width: 900px) {
      .menu-btn { display: flex; }
      .topbar { padding: 0 16px; }
    }
  `]
})
export class TopbarComponent {
  @Input() title = 'Trunqo';
  @Input() initials = 'U';
  @Input() hasNotifications = false;
  @Output() menuClick = new EventEmitter<void>();
}
