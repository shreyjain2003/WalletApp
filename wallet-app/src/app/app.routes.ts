import { Routes } from '@angular/router';
import { authGuard, adminGuard } from './core/guards/auth-guard';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login/login')
        .then(m => m.LoginComponent)
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./features/auth/register/register')
        .then(m => m.RegisterComponent)
  },
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./features/dashboard/dashboard')
        .then(m => m.DashboardComponent),
    canActivate: [authGuard]
  },
  {
    path: 'wallet/topup',
    loadComponent: () =>
      import('./features/wallet/topup/topup')
        .then(m => m.TopupComponent),
    canActivate: [authGuard]
  },
  {
    path: 'wallet/transfer',
    loadComponent: () =>
      import('./features/wallet/transfer/transfer')
        .then(m => m.TransferComponent),
    canActivate: [authGuard]
  },
  {
    path: 'wallet/history',
    loadComponent: () =>
      import('./features/wallet/history/history')
        .then(m => m.HistoryComponent),
    canActivate: [authGuard]
  },
  {
    path: 'rewards',
    loadComponent: () =>
      import('./features/rewards/rewards')
        .then(m => m.RewardsComponent),
    canActivate: [authGuard]
  },
  {
    path: 'notifications',
    loadComponent: () =>
      import('./features/notifications/notifications')
        .then(m => m.NotificationsComponent),
    canActivate: [authGuard]
  },
  {
    path: 'profile',
    loadComponent: () =>
      import('./features/profile/profile')
        .then(m => m.ProfileComponent),
    canActivate: [authGuard]
  },
  {
    path: 'admin/login',
    loadComponent: () =>
      import('./features/admin/admin-login/admin-login')
        .then(m => m.AdminLoginComponent)
  },
  {
    path: 'admin/kyc',
    loadComponent: () =>
      import('./features/admin/kyc-list/kyc-list')
        .then(m => m.KycListComponent),
    canActivate: [adminGuard]
  },
  {
    path: 'admin/tickets',
    loadComponent: () =>
      import('./features/admin/ticket-list/ticket-list')
        .then(m => m.TicketListComponent),
    canActivate: [adminGuard]
  },
  {
    path: 'support',
    loadComponent: () =>
      import('./features/support/support')
        .then(m => m.SupportComponent),
    canActivate: [authGuard]
  },
  { path: '**', redirectTo: 'login' }
];
