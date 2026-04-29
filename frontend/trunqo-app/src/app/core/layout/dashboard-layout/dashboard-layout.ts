import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { AuthService } from '../../services/auth';
import { ApiService } from '../../services/api';

@Component({
  selector: 'app-dashboard-layout',
  standalone: true,
  imports: [CommonModule, RouterModule, MatIconModule, MatMenuModule],
  templateUrl: './dashboard-layout.html',
  styleUrls: ['./dashboard-layout.css']
})
export class DashboardLayoutComponent implements OnInit {
  userName = 'User';
  userInitials = 'U';
  hasUnreadNotifications = false;

  navItems = [
    { label: 'Dashboard', icon: 'dashboard', route: '/dashboard' },
    { label: 'Wallet', icon: 'account_balance_wallet', route: '/wallet/history' },
    { label: 'Transfer', icon: 'swap_horiz', route: '/wallet/transfer' },
    { label: 'Top Up', icon: 'add_circle_outline', route: '/wallet/topup' },
    { label: 'Rewards', icon: 'redeem', route: '/rewards' },
    { label: 'Profile', icon: 'person', route: '/profile' }
  ];

  constructor(private auth: AuthService, private router: Router, private api: ApiService) {}

  ngOnInit() {
    this.userName = this.auth.getName() || 'User';
    this.userInitials = this.userName.split(' ').map((n: string) => n[0]).join('').toUpperCase().substring(0, 2) || 'U';
    this.loadUnreadCount();
  }

  private loadUnreadCount(): void {
    this.api.get<any>('/api/notifications').subscribe({
      next: (res) => {
        if (res.success) {
          this.hasUnreadNotifications = res.data.some((n: any) => !n.isRead);
        }
      },
      error: () => { /* silently ignore */ }
    });
  }

  logout() {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
