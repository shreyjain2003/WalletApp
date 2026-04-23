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
