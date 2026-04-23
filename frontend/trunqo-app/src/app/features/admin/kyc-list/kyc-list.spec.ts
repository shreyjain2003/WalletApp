import { ComponentFixture, TestBed } from '@angular/core/testing';

import { KycList } from './kyc-list';

describe('KycList', () => {
  let component: KycList;
  let fixture: ComponentFixture<KycList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [KycList],
    }).compileComponents();

    fixture = TestBed.createComponent(KycList);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
