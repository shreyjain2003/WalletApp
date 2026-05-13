/**
 * landing.ts — LandingComponent
 *
 * Public marketing landing page — the first thing visitors see at /.
 * Route: / (public, no guard)
 *
 * Sections (defined in landing.html / landing.css):
 *  - Navbar with Sign In and Get Started links
 *  - Hero section with headline, subtitle, CTA button, and mock card visual
 *  - Features grid (3 cards: Instant Transfers, Secure Vault, Smart Analytics)
 *  - Footer with links to public info pages (features, pricing, about, etc.)
 *
 * The features array is defined here and rendered via *ngFor in the template.
 * All footer links use routerLink to navigate to the PublicPagesComponent
 * which handles 8 routes: features, pricing, security, about, careers,
 * contact, privacy, terms.
 */
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule, RouterModule, MatIconModule],
  templateUrl: './landing.html',
  styleUrls: ['./landing.css']
})
export class LandingComponent {
  features = [
    { title: 'Instant Transfers', desc: 'Send money to anyone globally in seconds with minimal fees.', icon: 'bolt' },
    { title: 'Secure Vault', desc: 'Bank-level encryption keeping your funds secure 24/7.', icon: 'security' },
    { title: 'Smart Analytics', desc: 'Track your spending habits with AI-powered insights.', icon: 'insights' }
  ];
}
