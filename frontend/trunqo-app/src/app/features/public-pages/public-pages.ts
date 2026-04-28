import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-public-pages',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, MatIconModule],
  template: `
    <div class="pub-wrapper">
      <!-- Navbar -->
      <nav class="pub-nav">
        <div class="pub-nav-inner">
          <a routerLink="/" class="pub-logo">Trunqo</a>
          <div class="pub-nav-links">
            <a routerLink="/features">Features</a>
            <a routerLink="/pricing">Pricing</a>
            <a routerLink="/about">About</a>
            <a routerLink="/contact">Contact</a>
          </div>
          <div class="pub-nav-actions">
            <a routerLink="/login" class="pub-nav-text">Sign In</a>
            <a routerLink="/register" class="pub-nav-btn">Get Started</a>
          </div>
        </div>
      </nav>

      <!-- Page Content -->
      <main class="pub-main">

        <!-- ── FEATURES ── -->
        <ng-container *ngIf="page === 'features'">
          <div class="hero-band">
            <div class="hero-band-inner">
              <span class="page-tag">Product</span>
              <h1>Everything you need to manage money</h1>
              <p>Trunqo packs a full financial toolkit into one clean, fast app.</p>
            </div>
          </div>
          <div class="content-section">
            <div class="features-grid">
              <div class="feat-card" *ngFor="let f of featuresData">
                <div class="feat-icon"><mat-icon>{{ f.icon }}</mat-icon></div>
                <h3>{{ f.title }}</h3>
                <p>{{ f.desc }}</p>
              </div>
            </div>
          </div>
        </ng-container>

        <!-- ── PRICING ── -->
        <ng-container *ngIf="page === 'pricing'">
          <div class="hero-band">
            <div class="hero-band-inner">
              <span class="page-tag">Pricing</span>
              <h1>Simple, transparent pricing</h1>
              <p>No hidden fees. No surprises. Just honest banking.</p>
            </div>
          </div>
          <div class="content-section">
            <div class="pricing-grid">
              <div class="price-card" *ngFor="let p of pricingData" [class.featured]="p.featured">
                <div class="price-badge" *ngIf="p.featured">Most Popular</div>
                <h3 class="price-name">{{ p.name }}</h3>
                <div class="price-amount">
                  <span class="price-currency">₹</span>
                  <span class="price-val">{{ p.price }}</span>
                  <span class="price-period">/mo</span>
                </div>
                <p class="price-desc">{{ p.desc }}</p>
                <ul class="price-features">
                  <li *ngFor="let feat of p.features">
                    <mat-icon>check_circle</mat-icon> {{ feat }}
                  </li>
                </ul>
                <a routerLink="/register" class="price-btn" [class.price-btn-primary]="p.featured">
                  {{ p.cta }}
                </a>
              </div>
            </div>
          </div>
        </ng-container>

        <!-- ── SECURITY ── -->
        <ng-container *ngIf="page === 'security'">
          <div class="hero-band">
            <div class="hero-band-inner">
              <span class="page-tag">Security</span>
              <h1>Your money is safe with us</h1>
              <p>We use bank-grade security to protect every rupee in your wallet.</p>
            </div>
          </div>
          <div class="content-section">
            <div class="security-grid">
              <div class="sec-card" *ngFor="let s of securityData">
                <div class="sec-icon"><mat-icon>{{ s.icon }}</mat-icon></div>
                <h3>{{ s.title }}</h3>
                <p>{{ s.desc }}</p>
              </div>
            </div>
            <div class="trust-banner">
              <mat-icon>verified_user</mat-icon>
              <div>
                <h3>RBI Compliant</h3>
                <p>Trunqo operates under full regulatory compliance with the Reserve Bank of India's digital payments framework.</p>
              </div>
            </div>
          </div>
        </ng-container>

        <!-- ── ABOUT ── -->
        <ng-container *ngIf="page === 'about'">
          <div class="hero-band">
            <div class="hero-band-inner">
              <span class="page-tag">Company</span>
              <h1>We're building the future of money</h1>
              <p>Trunqo was founded in 2023 with a simple mission — make financial services accessible to everyone.</p>
            </div>
          </div>
          <div class="content-section">
            <div class="about-story">
              <div class="story-block">
                <h2>Our Story</h2>
                <p>Trunqo started as a side project by a group of engineers frustrated with the complexity of traditional banking. We believed that managing money should be as simple as sending a message.</p>
                <p>Today, Trunqo serves over 2 million users across India, processing billions in transactions every month — all with zero hidden fees and a product people actually love to use.</p>
              </div>
              <div class="stats-row">
                <div class="about-stat" *ngFor="let s of aboutStats">
                  <span class="about-stat-val">{{ s.val }}</span>
                  <span class="about-stat-lbl">{{ s.lbl }}</span>
                </div>
              </div>
            </div>
            <div class="values-grid">
              <div class="value-card" *ngFor="let v of valuesData">
                <mat-icon>{{ v.icon }}</mat-icon>
                <h3>{{ v.title }}</h3>
                <p>{{ v.desc }}</p>
              </div>
            </div>
          </div>
        </ng-container>

        <!-- ── CAREERS ── -->
        <ng-container *ngIf="page === 'careers'">
          <div class="hero-band">
            <div class="hero-band-inner">
              <span class="page-tag">Careers</span>
              <h1>Join the team building tomorrow's bank</h1>
              <p>We're a remote-first team of builders, designers, and dreamers. Come work on problems that matter.</p>
            </div>
          </div>
          <div class="content-section">
            <div class="jobs-list">
              <div class="job-card" *ngFor="let j of jobsData">
                <div class="job-info">
                  <h3>{{ j.title }}</h3>
                  <div class="job-tags">
                    <span class="job-tag">{{ j.dept }}</span>
                    <span class="job-tag">{{ j.type }}</span>
                    <span class="job-tag">{{ j.location }}</span>
                  </div>
                </div>
                <a routerLink="/contact" class="job-apply-btn">Apply Now</a>
              </div>
            </div>
            <div class="perks-grid">
              <div class="perk-card" *ngFor="let p of perksData">
                <mat-icon>{{ p.icon }}</mat-icon>
                <h4>{{ p.title }}</h4>
                <p>{{ p.desc }}</p>
              </div>
            </div>
          </div>
        </ng-container>

        <!-- ── CONTACT ── -->
        <ng-container *ngIf="page === 'contact'">
          <div class="hero-band">
            <div class="hero-band-inner">
              <span class="page-tag">Contact</span>
              <h1>We'd love to hear from you</h1>
              <p>Reach out for support, partnerships, or just to say hello.</p>
            </div>
          </div>
          <div class="content-section">
            <div class="contact-grid">
              <div class="contact-info">
                <div class="contact-item" *ngFor="let c of contactData">
                  <div class="contact-icon"><mat-icon>{{ c.icon }}</mat-icon></div>
                  <div>
                    <h4>{{ c.label }}</h4>
                    <p>{{ c.value }}</p>
                  </div>
                </div>
              </div>
              <div class="contact-form-card">
                <h3>Send us a message</h3>
                <div class="form-field">
                  <label>Your Name</label>
                  <input type="text" [(ngModel)]="contactName" placeholder="John Doe" class="form-input"/>
                </div>
                <div class="form-field">
                  <label>Email Address</label>
                  <input type="email" [(ngModel)]="contactEmail" placeholder="you@example.com" class="form-input"/>
                </div>
                <div class="form-field">
                  <label>Message</label>
                  <textarea [(ngModel)]="contactMessage" placeholder="How can we help?" rows="4" class="form-input"></textarea>
                </div>
                <button class="pub-submit-btn" (click)="submitContact()" [disabled]="contactSent">
                  <mat-icon>{{ contactSent ? 'check_circle' : 'send' }}</mat-icon>
                  {{ contactSent ? 'Message Sent!' : 'Send Message' }}
                </button>
              </div>
            </div>
          </div>
        </ng-container>

        <!-- ── PRIVACY POLICY ── -->
        <ng-container *ngIf="page === 'privacy'">
          <div class="hero-band">
            <div class="hero-band-inner">
              <span class="page-tag">Legal</span>
              <h1>Privacy Policy</h1>
              <p>Last updated: January 1, 2026</p>
            </div>
          </div>
          <div class="content-section legal-content">
            <div class="legal-doc">
              <div class="legal-section" *ngFor="let s of privacySections">
                <h2>{{ s.title }}</h2>
                <p *ngFor="let p of s.paragraphs">{{ p }}</p>
              </div>
            </div>
          </div>
        </ng-container>

        <!-- ── TERMS OF SERVICE ── -->
        <ng-container *ngIf="page === 'terms'">
          <div class="hero-band">
            <div class="hero-band-inner">
              <span class="page-tag">Legal</span>
              <h1>Terms of Service</h1>
              <p>Last updated: January 1, 2026</p>
            </div>
          </div>
          <div class="content-section legal-content">
            <div class="legal-doc">
              <div class="legal-section" *ngFor="let s of termsSections">
                <h2>{{ s.title }}</h2>
                <p *ngFor="let p of s.paragraphs">{{ p }}</p>
              </div>
            </div>
          </div>
        </ng-container>

      </main>

      <!-- Footer -->
      <footer class="pub-footer">
        <div class="pub-footer-inner">
          <div class="pub-footer-brand">
            <span class="pub-logo">Trunqo</span>
            <p>Smart banking for a modern world.</p>
          </div>
          <div class="pub-footer-links">
            <div class="link-col">
              <h4>Product</h4>
              <a routerLink="/features">Features</a>
              <a routerLink="/pricing">Pricing</a>
              <a routerLink="/security">Security</a>
            </div>
            <div class="link-col">
              <h4>Company</h4>
              <a routerLink="/about">About Us</a>
              <a routerLink="/careers">Careers</a>
              <a routerLink="/contact">Contact</a>
            </div>
            <div class="link-col">
              <h4>Legal</h4>
              <a routerLink="/privacy">Privacy Policy</a>
              <a routerLink="/terms">Terms of Service</a>
            </div>
          </div>
        </div>
        <div class="pub-footer-bottom">
          <p>&copy; 2026 Trunqo Financial. All rights reserved.</p>
        </div>
      </footer>
    </div>
  `,
  styles: [`
    .pub-wrapper { min-height: 100vh; background: var(--bg); color: var(--text-primary); }
    .pub-nav { background: var(--bg-card); border-bottom: 1px solid var(--border); position: sticky; top: 0; z-index: 100; }
    .pub-nav-inner { display: flex; align-items: center; justify-content: space-between; max-width: 1200px; margin: 0 auto; padding: 16px 24px; }
    .pub-logo { font-size: 22px; font-weight: 800; color: var(--text-primary); font-family: 'Outfit', sans-serif; text-decoration: none; }
    .pub-nav-links { display: flex; gap: 24px; }
    .pub-nav-links a { color: var(--text-secondary); text-decoration: none; font-weight: 600; font-size: 14px; transition: color 0.2s; }
    .pub-nav-links a:hover { color: var(--teal); }
    .pub-nav-actions { display: flex; gap: 12px; align-items: center; }
    .pub-nav-text { color: var(--text-secondary); text-decoration: none; font-weight: 600; font-size: 14px; padding: 8px 16px; border-radius: 8px; transition: all 0.2s; }
    .pub-nav-text:hover { background: var(--space-800); color: var(--text-primary); }
    .pub-nav-btn { background: var(--teal); color: #FFF; padding: 8px 20px; border-radius: 8px; font-weight: 700; font-size: 14px; text-decoration: none; box-shadow: var(--shadow-teal); transition: all 0.2s; }
    .pub-nav-btn:hover { background: var(--secondary); transform: translateY(-1px); }

    .pub-main { min-height: 60vh; }
    .hero-band { background: linear-gradient(135deg, var(--text-primary) 0%, #2A1A18 100%); padding: 80px 24px; text-align: center; color: #FFF; }
    .hero-band-inner { max-width: 800px; margin: 0 auto; }
    .page-tag { display: inline-block; background: rgba(192, 133, 82, 0.2); color: rgba(255, 255, 255, 0.9); padding: 6px 16px; border-radius: 20px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 20px; border: 1px solid rgba(192, 133, 82, 0.3); }
    .hero-band h1 { font-size: 48px; font-weight: 800; font-family: 'Outfit', sans-serif; margin: 0 0 16px; letter-spacing: -1px; }
    .hero-band p { font-size: 18px; color: rgba(255, 255, 255, 0.8); margin: 0; }

    .content-section { max-width: 1200px; margin: 0 auto; padding: 80px 24px; }
    .features-grid, .pricing-grid, .security-grid, .values-grid, .perks-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }
    .feat-card, .sec-card, .value-card, .perk-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--r-lg); padding: 32px; transition: all 0.2s; }
    .feat-card:hover, .sec-card:hover, .value-card:hover, .perk-card:hover { border-color: var(--teal); box-shadow: var(--shadow-md); transform: translateY(-2px); }
    .feat-icon, .sec-icon { width: 56px; height: 56px; border-radius: 14px; background: rgba(192, 133, 82, 0.1); display: flex; align-items: center; justify-content: center; margin-bottom: 20px; }
    .feat-icon mat-icon, .sec-icon mat-icon { color: var(--teal); font-size: 28px; width: 28px; height: 28px; }
    .feat-card h3, .sec-card h3, .value-card h3, .perk-card h4 { margin: 0 0 12px; font-size: 18px; font-weight: 700; color: var(--text-primary); font-family: 'Outfit', sans-serif; }
    .feat-card p, .sec-card p, .value-card p, .perk-card p { margin: 0; font-size: 14px; color: var(--text-secondary); line-height: 1.6; }

    .pricing-grid { grid-template-columns: repeat(3, 1fr); }
    .price-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--r-lg); padding: 40px 32px; position: relative; transition: all 0.2s; }
    .price-card.featured { border-color: var(--teal); box-shadow: 0 8px 32px rgba(192, 133, 82, 0.2); transform: scale(1.05); }
    .price-badge { position: absolute; top: 16px; right: 16px; background: var(--teal); color: #FFF; padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 700; }
    .price-name { margin: 0 0 16px; font-size: 20px; font-weight: 700; color: var(--text-primary); font-family: 'Outfit', sans-serif; }
    .price-amount { display: flex; align-items: baseline; gap: 4px; margin-bottom: 12px; }
    .price-currency { font-size: 24px; font-weight: 700; color: var(--text-muted); }
    .price-val { font-size: 56px; font-weight: 800; color: var(--text-primary); font-family: 'Outfit', sans-serif; letter-spacing: -2px; }
    .price-period { font-size: 16px; color: var(--text-muted); }
    .price-desc { margin: 0 0 24px; font-size: 14px; color: var(--text-secondary); }
    .price-features { list-style: none; padding: 0; margin: 0 0 32px; }
    .price-features li { display: flex; align-items: center; gap: 10px; padding: 10px 0; border-bottom: 1px dashed var(--border); font-size: 14px; color: var(--text-primary); }
    .price-features li:last-child { border-bottom: none; }
    .price-features mat-icon { color: var(--teal); font-size: 18px; width: 18px; height: 18px; }
    .price-btn { display: block; text-align: center; padding: 12px; border: 1px solid var(--border); border-radius: 10px; background: var(--bg); color: var(--text-primary); font-weight: 700; text-decoration: none; transition: all 0.2s; }
    .price-btn:hover { background: var(--space-800); border-color: var(--teal); }
    .price-btn-primary { background: var(--teal); color: #FFF; border-color: var(--teal); box-shadow: var(--shadow-teal); }
    .price-btn-primary:hover { background: var(--secondary); }

    .trust-banner { display: flex; align-items: center; gap: 20px; background: rgba(192, 133, 82, 0.05); border: 1px solid rgba(192, 133, 82, 0.2); border-radius: var(--r-lg); padding: 32px; margin-top: 40px; }
    .trust-banner mat-icon { color: var(--teal); font-size: 48px; width: 48px; height: 48px; }
    .trust-banner h3 { margin: 0 0 8px; font-size: 20px; font-weight: 700; color: var(--text-primary); font-family: 'Outfit', sans-serif; }
    .trust-banner p { margin: 0; font-size: 14px; color: var(--text-secondary); line-height: 1.6; }

    .about-story { margin-bottom: 60px; }
    .story-block { max-width: 800px; margin: 0 auto 40px; }
    .story-block h2 { font-size: 32px; font-weight: 800; font-family: 'Outfit', sans-serif; margin: 0 0 20px; color: var(--text-primary); }
    .story-block p { font-size: 16px; color: var(--text-secondary); line-height: 1.8; margin: 0 0 16px; }
    .stats-row { display: flex; justify-content: center; gap: 60px; }
    .about-stat { display: flex; flex-direction: column; align-items: center; }
    .about-stat-val { font-size: 48px; font-weight: 800; color: var(--teal); font-family: 'Outfit', sans-serif; letter-spacing: -1px; }
    .about-stat-lbl { font-size: 14px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 1px; font-weight: 600; }

    .value-card mat-icon { color: var(--teal); font-size: 32px; width: 32px; height: 32px; margin-bottom: 16px; }

    .jobs-list { margin-bottom: 60px; }
    .job-card { display: flex; align-items: center; justify-content: space-between; background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--r-lg); padding: 24px 32px; margin-bottom: 16px; transition: all 0.2s; }
    .job-card:hover { border-color: var(--teal); box-shadow: var(--shadow-md); }
    .job-info h3 { margin: 0 0 12px; font-size: 18px; font-weight: 700; color: var(--text-primary); font-family: 'Outfit', sans-serif; }
    .job-tags { display: flex; gap: 10px; }
    .job-tag { background: var(--space-800); color: var(--text-secondary); padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }
    .job-apply-btn { background: var(--teal); color: #FFF; padding: 10px 24px; border-radius: 8px; font-weight: 700; text-decoration: none; box-shadow: var(--shadow-teal); transition: all 0.2s; }
    .job-apply-btn:hover { background: var(--secondary); transform: translateY(-1px); }

    .perk-card mat-icon { color: var(--teal); font-size: 28px; width: 28px; height: 28px; margin-bottom: 16px; }

    .contact-grid { display: grid; grid-template-columns: 1fr 1.5fr; gap: 40px; }
    .contact-item { display: flex; align-items: flex-start; gap: 16px; margin-bottom: 24px; }
    .contact-icon { width: 48px; height: 48px; border-radius: 12px; background: rgba(192, 133, 82, 0.1); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .contact-icon mat-icon { color: var(--teal); font-size: 24px; width: 24px; height: 24px; }
    .contact-item h4 { margin: 0 0 6px; font-size: 16px; font-weight: 700; color: var(--text-primary); }
    .contact-item p { margin: 0; font-size: 14px; color: var(--text-secondary); }
    .contact-form-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--r-lg); padding: 32px; }
    .contact-form-card h3 { margin: 0 0 24px; font-size: 20px; font-weight: 700; color: var(--text-primary); font-family: 'Outfit', sans-serif; }
    .form-field { margin-bottom: 20px; }
    .form-field label { display: block; margin-bottom: 8px; font-size: 13px; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px; }
    .form-input { width: 100%; padding: 12px 16px; border: 1px solid var(--border); border-radius: 10px; background: var(--bg); color: var(--text-primary); font-size: 14px; font-family: 'Inter', sans-serif; transition: all 0.2s; }
    .form-input:focus { outline: none; border-color: var(--teal); box-shadow: 0 0 0 3px rgba(192, 133, 82, 0.1); }
    .pub-submit-btn { width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; padding: 14px; border: none; border-radius: 10px; background: var(--teal); color: #FFF; font-weight: 700; font-size: 14px; cursor: pointer; font-family: 'Inter', sans-serif; box-shadow: var(--shadow-teal); transition: all 0.2s; }
    .pub-submit-btn:hover:not(:disabled) { background: var(--secondary); transform: translateY(-1px); }
    .pub-submit-btn:disabled { opacity: 0.6; cursor: not-allowed; }
    .pub-submit-btn mat-icon { font-size: 18px; width: 18px; height: 18px; }

    .legal-content { max-width: 900px; margin: 0 auto; }
    .legal-doc { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--r-lg); padding: 48px; }
    .legal-section { margin-bottom: 40px; }
    .legal-section:last-child { margin-bottom: 0; }
    .legal-section h2 { font-size: 24px; font-weight: 700; color: var(--text-primary); font-family: 'Outfit', sans-serif; margin: 0 0 16px; }
    .legal-section p { font-size: 15px; color: var(--text-secondary); line-height: 1.8; margin: 0 0 16px; }

    .pub-footer { background: var(--bg-card); border-top: 1px solid var(--border); padding: 60px 24px 24px; }
    .pub-footer-inner { display: flex; justify-content: space-between; max-width: 1200px; margin: 0 auto 40px; }
    .pub-footer-brand { max-width: 300px; }
    .pub-footer-brand .pub-logo { font-size: 20px; font-weight: 800; color: var(--text-primary); font-family: 'Outfit', sans-serif; }
    .pub-footer-brand p { margin: 12px 0 0; font-size: 14px; color: var(--text-secondary); }
    .pub-footer-links { display: flex; gap: 60px; }
    .link-col h4 { margin: 0 0 16px; font-size: 14px; font-weight: 700; color: var(--text-primary); text-transform: uppercase; letter-spacing: 0.5px; }
    .link-col a { display: block; margin-bottom: 12px; color: var(--text-secondary); text-decoration: none; font-size: 14px; transition: color 0.2s; }
    .link-col a:hover { color: var(--teal); }
    .pub-footer-bottom { text-align: center; padding-top: 24px; border-top: 1px solid var(--border); max-width: 1200px; margin: 0 auto; }
    .pub-footer-bottom p { margin: 0; font-size: 13px; color: var(--text-muted); }

    @media (max-width: 992px) {
      .features-grid, .pricing-grid, .security-grid, .values-grid, .perks-grid { grid-template-columns: 1fr; }
      .contact-grid { grid-template-columns: 1fr; }
      .pub-footer-inner { flex-direction: column; gap: 40px; }
    }
  `]
})
export class PublicPagesComponent implements OnInit {
  page = '';
  contactName = '';
  contactEmail = '';
  contactMessage = '';
  contactSent = false;

  featuresData = [
    { icon: 'bolt', title: 'Instant Transfers', desc: 'Send money to anyone globally in seconds with minimal fees.' },
    { icon: 'security', title: 'Secure Vault', desc: 'Bank-level encryption keeping your funds secure 24/7.' },
    { icon: 'insights', title: 'Smart Analytics', desc: 'Track your spending habits with AI-powered insights.' },
    { icon: 'workspace_premium', title: 'Rewards Program', desc: 'Earn points on every transaction and unlock exclusive perks.' },
    { icon: 'support_agent', title: '24/7 Support', desc: 'Our team is always here to help, day or night.' },
    { icon: 'account_balance_wallet', title: 'Multi-Currency', desc: 'Hold and exchange multiple currencies at competitive rates.' }
  ];

  pricingData = [
    { name: 'Free', price: 0, desc: 'Perfect for getting started', features: ['Unlimited transfers', 'Basic analytics', 'Email support'], cta: 'Get Started', featured: false },
    { name: 'Pro', price: 99, desc: 'For power users', features: ['Everything in Free', 'Priority support', 'Advanced analytics', 'Cashback rewards'], cta: 'Start Free Trial', featured: true },
    { name: 'Business', price: 499, desc: 'For teams and companies', features: ['Everything in Pro', 'Team accounts', 'API access', 'Dedicated manager'], cta: 'Contact Sales', featured: false }
  ];

  securityData = [
    { icon: 'lock', title: '256-bit Encryption', desc: 'All data is encrypted using industry-standard AES-256 encryption.' },
    { icon: 'fingerprint', title: 'Biometric Auth', desc: 'Secure your account with fingerprint or face recognition.' },
    { icon: 'verified_user', title: 'Two-Factor Auth', desc: 'Add an extra layer of security with 2FA on every login.' },
    { icon: 'shield', title: 'Fraud Detection', desc: 'AI-powered systems monitor every transaction for suspicious activity.' },
    { icon: 'backup', title: 'Daily Backups', desc: 'Your data is backed up daily across multiple secure locations.' },
    { icon: 'gpp_good', title: 'Compliance', desc: 'Fully compliant with RBI, PCI-DSS, and GDPR regulations.' }
  ];

  aboutStats = [
    { val: '2M+', lbl: 'Active Users' },
    { val: '₹5B+', lbl: 'Transactions' },
    { val: '50+', lbl: 'Team Members' }
  ];

  valuesData = [
    { icon: 'favorite', title: 'Customer First', desc: 'Every decision we make starts with our users.' },
    { icon: 'lightbulb', title: 'Innovation', desc: 'We constantly push boundaries to build better products.' },
    { icon: 'handshake', title: 'Transparency', desc: 'No hidden fees, no fine print — just honest banking.' }
  ];

  jobsData = [
    { title: 'Senior Backend Engineer', dept: 'Engineering', type: 'Full-time', location: 'Remote' },
    { title: 'Product Designer', dept: 'Design', type: 'Full-time', location: 'Remote' },
    { title: 'Customer Success Manager', dept: 'Support', type: 'Full-time', location: 'Bangalore' }
  ];

  perksData = [
    { icon: 'home', title: 'Remote First', desc: 'Work from anywhere in the world.' },
    { icon: 'health_and_safety', title: 'Health Insurance', desc: 'Comprehensive coverage for you and your family.' },
    { icon: 'beach_access', title: 'Unlimited PTO', desc: 'Take time off when you need it.' },
    { icon: 'school', title: 'Learning Budget', desc: '₹50,000/year for courses and conferences.' }
  ];

  contactData = [
    { icon: 'email', label: 'Email', value: 'support@trunqo.com' },
    { icon: 'phone', label: 'Phone', value: '+91 80 1234 5678' },
    { icon: 'location_on', label: 'Office', value: 'Bangalore, Karnataka, India' }
  ];

  privacySections = [
    { title: '1. Information We Collect', paragraphs: ['We collect information you provide directly to us, such as when you create an account, make a transaction, or contact customer support. This includes your name, email address, phone number, and financial information.', 'We also automatically collect certain information about your device and how you interact with our services, including IP address, browser type, and usage data.'] },
    { title: '2. How We Use Your Information', paragraphs: ['We use the information we collect to provide, maintain, and improve our services, process transactions, send you technical notices and support messages, and respond to your comments and questions.', 'We may also use your information to detect, prevent, and address fraud, security, or technical issues, and to protect the rights and safety of Trunqo and our users.'] },
    { title: '3. Information Sharing', paragraphs: ['We do not sell your personal information. We may share your information with third-party service providers who perform services on our behalf, such as payment processing and data analysis.', 'We may also share information when required by law or to protect our rights and the safety of our users.'] },
    { title: '4. Data Security', paragraphs: ['We take reasonable measures to protect your information from unauthorized access, use, or disclosure. However, no internet or email transmission is ever fully secure or error-free.'] },
    { title: '5. Your Rights', paragraphs: ['You have the right to access, update, or delete your personal information at any time. You can do this through your account settings or by contacting us directly.'] },
    { title: '6. Contact Us', paragraphs: ['If you have any questions about this Privacy Policy, please contact us at privacy@trunqo.com.'] }
  ];

  termsSections = [
    { title: '1. Acceptance of Terms', paragraphs: ['By accessing and using Trunqo services, you accept and agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our services.'] },
    { title: '2. Account Registration', paragraphs: ['To use certain features of our services, you must register for an account. You agree to provide accurate, current, and complete information during registration and to update such information to keep it accurate, current, and complete.', 'You are responsible for safeguarding your account credentials and for any activities or actions under your account.'] },
    { title: '3. Use of Services', paragraphs: ['You agree to use our services only for lawful purposes and in accordance with these Terms. You agree not to use our services in any way that could damage, disable, overburden, or impair our servers or networks.'] },
    { title: '4. Fees and Payments', paragraphs: ['Certain features of our services may be subject to fees. You agree to pay all applicable fees as described on our website. All fees are non-refundable unless otherwise stated.'] },
    { title: '5. Termination', paragraphs: ['We may terminate or suspend your account and access to our services immediately, without prior notice or liability, for any reason, including if you breach these Terms.'] },
    { title: '6. Limitation of Liability', paragraphs: ['To the maximum extent permitted by law, Trunqo shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use of or inability to use our services.'] },
    { title: '7. Changes to Terms', paragraphs: ['We reserve the right to modify these Terms at any time. We will notify you of any changes by posting the new Terms on our website. Your continued use of our services after such changes constitutes your acceptance of the new Terms.'] },
    { title: '8. Contact Us', paragraphs: ['If you have any questions about these Terms, please contact us at legal@trunqo.com.'] }
  ];

  constructor(private route: ActivatedRoute) {}

  ngOnInit(): void {
    this.route.url.subscribe(segments => {
      this.page = segments[0]?.path || 'features';
    });
  }

  submitContact(): void {
    if (!this.contactName || !this.contactEmail || !this.contactMessage) return;
    this.contactSent = true;
    setTimeout(() => {
      this.contactName = '';
      this.contactEmail = '';
      this.contactMessage = '';
      this.contactSent = false;
    }, 3000);
  }
}

