import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SidebarComponent } from '../sidebar/sidebar';
import { TopbarComponent } from '../topbar/topbar';
import { AuthService } from '../../../core/services/auth';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [CommonModule, SidebarComponent, TopbarComponent],
  template: `
    <div class="layout">
      <app-sidebar [open]="sidebarOpen" (close)="sidebarOpen = false"></app-sidebar>
      <div class="layout-body">
        <app-topbar [title]="title" [initials]="initials" (menuClick)="sidebarOpen = true"></app-topbar>
        <main class="layout-main">
          <ng-content></ng-content>
        </main>
      </div>
    </div>
  `,
  styles: [`
    .layout {
      display: flex;
      min-height: 100vh;
      background: var(--bg);
    }
    .layout-body {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-width: 0;
      background: var(--bg);
    }
    .layout-main {
      flex: 1;
      padding: 28px 32px;
      max-width: 1100px;
      width: 100%;
    }
    @media (max-width: 1200px) {
      .layout-main { max-width: 100%; }
    }
    @media (max-width: 600px) {
      .layout-main { padding: 16px; }
    }
  `]
})
export class MainLayoutComponent implements OnInit {
  @Input() title = 'Trunqo';
  sidebarOpen = false;

  constructor(private auth: AuthService) {}

  get initials(): string {
    return this.auth.getName().split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) || 'U';
  }

  ngOnInit(): void {}
}
