import { Routes } from '@angular/router';
import { authGuard, adminGuard } from './core/guards/auth-guard';

export const routes: Routes = [
  { 
    path: '', 
    loadComponent: () => import('./features/landing/landing').then(m => m.LandingComponent),
    pathMatch: 'full' 
  },
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login').then(m => m.LoginComponent)
  },
  {
    path: 'register',
    loadComponent: () => import('./features/auth/register/register').then(m => m.RegisterComponent)
  },
  {
    path: 'forgot-password',
    loadComponent: () => import('./features/auth/forgot-password/forgot-password').then(m => m.ForgotPasswordComponent)
  },
  {
    path: 'verify-otp',
    loadComponent: () => import('./features/auth/verify-otp/verify-otp').then(m => m.VerifyOtpComponent)
  },
  {
    path: 'reset-password',
    loadComponent: () => import('./features/auth/reset-password/reset-password').then(m => m.ResetPasswordComponent)
  },
  
  // Dashboard Layout Wraps Authenticated Routes
  {
    path: '',
    loadComponent: () => import('./core/layout/dashboard-layout/dashboard-layout').then(m => m.DashboardLayoutComponent),
    canActivate: [authGuard],
    children: [
      {
        path: 'dashboard',
        loadComponent: () => import('./features/dashboard/dashboard').then(m => m.DashboardComponent)
      },
      {
        path: 'wallet/topup',
        loadComponent: () => import('./features/wallet/topup/topup').then(m => m.TopupComponent)
      },
      {
        path: 'wallet/transfer',
        loadComponent: () => import('./features/wallet/transfer/transfer').then(m => m.TransferComponent)
      },
      {
        path: 'wallet/history',
        loadComponent: () => import('./features/wallet/history/history').then(m => m.HistoryComponent)
      },
      {
        path: 'rewards',
        loadComponent: () => import('./features/rewards/rewards').then(m => m.RewardsComponent)
      },
      {
        path: 'notifications',
        loadComponent: () => import('./features/notifications/notifications').then(m => m.NotificationsComponent)
      },
      {
        path: 'profile',
        loadComponent: () => import('./features/profile/profile').then(m => m.ProfileComponent)
      },
      {
        path: 'support',
        loadComponent: () => import('./features/support/support').then(m => m.SupportComponent)
      },
      {
        path: 'analytics',
        loadComponent: () => import('./features/analytics/analytics').then(m => m.AnalyticsComponent)
      },
      {
        path: 'request-money',
        loadComponent: () => import('./features/request-money/request-money').then(m => m.RequestMoneyComponent)
      },
      {
        path: 'set-pin',
        loadComponent: () => import('./features/set-pin/set-pin').then(m => m.SetPinComponent)
      }
    ]
  },

  // Admin Routes
  {
    path: 'admin/login',
    loadComponent: () => import('./features/admin/admin-login/admin-login').then(m => m.AdminLoginComponent)
  },
  {
    path: 'admin/kyc',
    loadComponent: () => import('./features/admin/kyc-list/kyc-list').then(m => m.KycListComponent),
    canActivate: [adminGuard]
  },
  {
    path: 'admin/tickets',
    loadComponent: () => import('./features/admin/ticket-list/ticket-list').then(m => m.TicketListComponent),
    canActivate: [adminGuard]
  },
  {
    path: 'admin/users',
    loadComponent: () => import('./features/admin/user-list/user-list').then(m => m.UserListComponent),
    canActivate: [adminGuard]
  },
  {
    path: 'admin/campaigns',
    loadComponent: () => import('./features/admin/campaign-control/campaign-control').then(m => m.CampaignControlComponent),
    canActivate: [adminGuard]
  },
  
  // Public info pages
  {
    path: 'features',
    loadComponent: () => import('./features/public-pages/public-pages').then(m => m.PublicPagesComponent)
  },
  {
    path: 'pricing',
    loadComponent: () => import('./features/public-pages/public-pages').then(m => m.PublicPagesComponent)
  },
  {
    path: 'security',
    loadComponent: () => import('./features/public-pages/public-pages').then(m => m.PublicPagesComponent)
  },
  {
    path: 'about',
    loadComponent: () => import('./features/public-pages/public-pages').then(m => m.PublicPagesComponent)
  },
  {
    path: 'careers',
    loadComponent: () => import('./features/public-pages/public-pages').then(m => m.PublicPagesComponent)
  },
  {
    path: 'contact',
    loadComponent: () => import('./features/public-pages/public-pages').then(m => m.PublicPagesComponent)
  },
  {
    path: 'privacy',
    loadComponent: () => import('./features/public-pages/public-pages').then(m => m.PublicPagesComponent)
  },
  {
    path: 'terms',
    loadComponent: () => import('./features/public-pages/public-pages').then(m => m.PublicPagesComponent)
  },

  // Custom 404
  { path: '**', redirectTo: 'not-found' },
  {
    path: 'not-found',
    loadComponent: () => import('./features/not-found/not-found').then(m => m.NotFoundComponent)
  }
];
