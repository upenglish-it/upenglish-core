import { isEmpty } from 'lodash';
import { DateTime } from 'luxon';
import { RRule } from 'rrule';

export const ComposedRRule = (
  data: ISchedule,
): {
  approximate: RRule;
  nonApproximate: RRule;
} => {
  /* start date */
  let dtstart = data.fromDate;
  if (data.allDay) {
    const fromDate = DateTime.fromJSDate(data.fromDate);
    dtstart = new Date(Date.UTC(fromDate.year, fromDate.month - 1, fromDate.day));
    // console.log("dtstart >>> ", dtstart);
  } else {
    const fromDate = DateTime.fromJSDate(data.fromDate).toISODate();
    const fromTime = data.fromTime as Date;
    const fromDateTime = DateTime.fromISO(fromDate).set({
      hour: fromTime.getHours(),
      minute: fromTime.getMinutes(),
      second: fromTime.getSeconds(),
    });
    if (data.fromTimezone) {
      fromDateTime.setZone(data.fromTimezone);
    }
    dtstart = new Date(Date.UTC(fromDateTime.year, fromDateTime.month - 1, fromDateTime.day, fromDateTime.hour, fromDateTime.minute, 0, 0)); // toDateTime.toJSDate();

    // console.log("dtstart >>>22 ", dtstart);
  }

  /* end date */
  let until = null;
  if (data.toDate) {
    if (data.allDay) {
      const toDate = DateTime.fromJSDate(data.toDate);
      until = new Date(Date.UTC(toDate.year, toDate.month - 1, toDate.day, toDate.hour, toDate.minute, toDate.second, toDate.millisecond));
    } else {
      const toDate = DateTime.fromJSDate(data.toDate).toISODate();
      const toTime = data.toTime as Date;
      const toDateTime = DateTime.fromISO(toDate).set({
        hour: toTime.getHours(),
        minute: toTime.getMinutes(),
        second: toTime.getSeconds(),
      });
      if (data.toTimezone) {
        toDateTime.setZone(data.toTimezone);
      }
      until = new Date(Date.UTC(toDateTime.year, toDateTime.month - 1, toDateTime.day, toDateTime.hour, toDateTime.minute, toDateTime.second, toDateTime.millisecond)); // toDateTime.toJSDate();
    }
  }

  // console.log('until', until);

  let byweekday = null;
  if (data?.recurrence?.byweekday !== null && Object.prototype.toString.call(data?.recurrence?.byweekday) === '[object Array]' && data?.recurrence?.byweekday?.length > 0) {
    byweekday = data.recurrence.byweekday;
  }

  let bymonth = null;
  if (data?.recurrence?.bymonth !== null && data?.recurrence?.bymonth?.length > 0) {
    bymonth = data.recurrence.bymonth;
  }

  let interval = null;
  interval = data?.recurrence?.interval !== null ? data?.recurrence?.interval : null;

  let freq = null;
  freq = data?.recurrence?.freq !== null ? data?.recurrence?.freq : null;

  let count = null;
  // if (data.recurrence.ends.type === "after") {
  count = data?.recurrence?.ends?.count !== null ? data?.recurrence?.ends?.count : null;
  // }

  let tzid = null;
  if (data.toTimezone !== null) {
    tzid = data.toTimezone;
  }
  // console.log(data.toTimezone);

  const rrule = new RRule({
    ...(tzid ? { tzid: tzid } : null),
    ...(freq ? { freq: freq } : null),
    ...(interval ? { interval: interval } : null),
    ...(count ? { count: count } : null),
    ...(byweekday ? { byweekday: byweekday } : null),
    ...(bymonth ? { bymonth: bymonth } : null),
    ...(dtstart ? { dtstart: dtstart } : null),
    ...(until ? { until: until } : null),
  });

  // console.log('rrule ', rrule.toString());
  return {
    approximate: rrule,
    nonApproximate: RRule.fromText(rrule.toText()),
  };
  // return RRule.fromText(rrule.toText());
};

export interface ISchedule {
  fromDate: Date;
  fromTime: Date;
  fromTimezone: string;
  toDate: Date;
  toTime: Date;
  toTimezone: string;
  allDay: boolean;
  recurrence: {
    enable: string;
    value: string;
    freq: number;
    interval: number;
    byweekday: Array<number>;
    bymonth: Array<number>;
    ends: {
      type: 'never' | 'on' | 'after';
      endDate: string;
      count: number;
    };
  };
}
