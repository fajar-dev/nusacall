export interface Clock {
  now(): Date;
}

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}

export class TestClock implements Clock {
  constructor(private fixedDate: Date = new Date('2026-08-11T00:00:00.000Z')) {}

  now(): Date {
    return this.fixedDate;
  }

  setFixedDate(date: Date): void {
    this.fixedDate = date;
  }
}
