import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TokenRefreshService } from './core/services/token-refresh';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: `<router-outlet />`
})
export class App implements OnInit {

  constructor(private tokenRefresh: TokenRefreshService) { }

  ngOnInit(): void {
    // Only start auto-refresh if user is already logged in (e.g. page reload)
    const token = localStorage.getItem('token');
    if (token) {
      this.tokenRefresh.startAutoRefresh();
    }
  }
}
