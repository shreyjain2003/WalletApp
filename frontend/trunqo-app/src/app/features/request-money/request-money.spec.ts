import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RequestMoney } from './request-money';

describe('RequestMoney', () => {
  let component: RequestMoney;
  let fixture: ComponentFixture<RequestMoney>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RequestMoney],
    }).compileComponents();

    fixture = TestBed.createComponent(RequestMoney);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
