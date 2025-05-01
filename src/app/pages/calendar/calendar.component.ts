import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CalendarModule, DateAdapter } from 'angular-calendar';
import { adapterFactory } from 'angular-calendar/date-adapters/date-fns';

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [CommonModule, CalendarModule],
  providers: [
    {
      provide: DateAdapter,
      useFactory: adapterFactory
    }
  ],
  template: `
    <mwl-calendar-month-view
      [viewDate]="viewDate"
      [events]="events">
    </mwl-calendar-month-view>
  `
})
export class CalendarComponent {
  viewDate = new Date();
  events = [];
} 