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
    this.tokenRefresh.startAutoRefresh();
  }
}
