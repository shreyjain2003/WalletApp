import { Injectable, OnDestroy, Injector } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from './auth';

@Injectable({ providedIn: 'root' })
export class TokenRefreshService implements OnDestroy {

  private refreshInterval: any;
  private readonly REFRESH_EVERY_MS = 15 * 60 * 1000; // 15 minutes

  private auth!: AuthService;

  constructor(private injector: Injector, private router: Router) { }

  // Lazy load AuthService to break circular dependency
  private getAuthService(): AuthService {
    if (!this.auth) {
      this.auth = this.injector.get(AuthService);
    }
    return this.auth;
  }

  startAutoRefresh(): void {
    this.stopAutoRefresh();

    this.refreshInterval = setInterval(() => {
      const token = localStorage.getItem('token');
      if (!token) return;

      this.getAuthService().refreshToken().subscribe({
        next: (res: any) => {
          if (res.success) {
            localStorage.setItem('token', res.data.token);
            console.log('Auto token refreshed');
          }
        },
        error: () => {
          console.warn('Token refresh failed — logging out.');
        }
      });
    }, this.REFRESH_EVERY_MS);
  }

  stopAutoRefresh(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }

  // Manual refresh
  refreshNow(): void {
    const token = localStorage.getItem('token');
    if (!token) return;

    this.getAuthService().refreshToken().subscribe({
      next: (res: any) => {
        if (res.success) {
          localStorage.setItem('token', res.data.token);
          console.log('Token refreshed. New status:', res.data.status);
          
        }
      },
      error: () => {
        console.warn('Refresh failed — NOT logging out');
      }
    });
  }

  ngOnDestroy(): void {
    this.stopAutoRefresh();
  }
}
