import { IPricing } from "@isms-core/components/students/enroll-new-student-modal/enroll-new-student-modal.component";
import { ISchedule } from "@isms-core/interfaces";
import { DateTime } from "luxon";
import { RRule } from "rrule";
import { differenceInDays } from "date-fns";

export const ComposedRRule = (
  data: ISchedule,
  getOnlyEndDate?: boolean
): {
  approximate: RRule;
  nonApproximate: RRule;
  text: string;
} => {
  /* start date */
  let dtstart = data.fromDate;
  // console.log("111", data);
  if (data.allDay) {
    const fromDate = DateTime.fromJSDate(data.fromDate);
    dtstart = new Date(Date.UTC(fromDate.year, fromDate.month - 1, fromDate.day));
    // console.log("dtstart1", dtstart);
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
    // console.log("dtstart2", dtstart);

    // console.log("dtstart >>>22 ", dtstart);
  }

  /* end date */
  let until = null;
  if (data.toDate) {
    if (data.allDay) {
      const toDate = DateTime.fromJSDate(data.toDate);
      until = new Date(Date.UTC(toDate.year, toDate.month - 1, toDate.day));
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
      until = new Date(Date.UTC(toDateTime.year, toDateTime.month - 1, toDateTime.day, toDateTime.hour, toDateTime.minute, 0, 0)); // toDateTime.toJSDate();
    }
  }

  let byweekday = null;
  if (data.recurrence.byweekday !== null && Object.prototype.toString.call(data.recurrence.byweekday) === "[object Array]" && data.recurrence.byweekday.length > 0) {
    byweekday = data.recurrence.byweekday;
  }

  let bymonth = null;
  if (data.recurrence.bymonth !== null && data.recurrence.bymonth.length > 0) {
    bymonth = data.recurrence.bymonth;
  }

  let interval = null;
  interval = data.recurrence.interval !== null ? data.recurrence.interval : null;

  let freq = null;
  freq = data.recurrence.freq !== null ? data.recurrence.freq : null;

  let count = null;

  // if (data.recurrence.ends.type === "after") {
  count = data.recurrence.ends.count !== null ? data.recurrence.ends.count : null;
  // }

  /* it use only when getting the last date purpose */
  if (getOnlyEndDate) {
    if (data.recurrence.ends.type === "after") {
      count = data.recurrence.ends.count !== null ? data.recurrence.ends.count : null;
    }
    if (data.recurrence.ends.type === "on") {
      const endDate = DateTime.fromISO(data.recurrence.ends.endDate);
      until = new Date(Date.UTC(endDate.year, endDate.month - 1, endDate.day, 0, 0, 0, 0));
    }
  }

  let tzid = null;
  if (data.toTimezone !== null) {
    tzid = data.toTimezone;
  }

  // console.log("dtstart", count, data, dtstart, until);

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

  // console.log("rrule", rrule);

  return {
    approximate: rrule,
    nonApproximate: RRule.fromText(rrule.toText()),
    text: rrule.toText(),
  };
  // return RRule.fromText(rrule.toText());
};

export const DataComposedRRule = (fromDate: DateTime, toDate: DateTime, pricing: IPricing): { approximate: RRule; nonApproximate: RRule } => {
  // console.log("fromDate", fromDate.toISO());
  const composeRRule = ComposedRRule({
    ...pricing.schedulesShift.schedule,
    fromDate: fromDate.toJSDate(), //DateTime.fromISO(this.pricing.schedulesShift.schedules.schedule.fromDate as any).toJSDate(),
    fromTime: fromDate.startOf("day").toJSDate(), //DateTime.fromISO(this.pricing.schedulesShift.schedules.schedule.fromTime as any).toJSDate(),
    toDate: toDate.toJSDate(),
    toTime: toDate.endOf("day").toJSDate(), // DateTime.fromISO(this.pricing.schedulesShift.schedules.schedule.toTime as any).toJSDate()
  });

  // console.log(">>>", composeRRule.approximate.all());
  if (composeRRule.approximate.all().length === 0) {
    let _fromDate = fromDate; //.plus({ days: 1 });
    // console.log("here");
    let _toDate = toDate;

    /* if _fromDate is equally to _toDate then _toDate will extend the month */
    if (_fromDate.day === _toDate.day && _fromDate.month === _toDate.month && _fromDate.year === _toDate.year) {
      _toDate = _toDate.plus({ months: 1 });
    }

    /* if _fromDate is greater than _toDate then get the endof month of the _fromDate as _toDate value */
    if (differenceInDays(_fromDate.toJSDate(), _toDate.toJSDate()) > 0) {
      _toDate = _fromDate.endOf("month");
    }

    return DataComposedRRule(_fromDate, _toDate, pricing);
  }

  // console.log("composeRRule", composeRRule);

  return composeRRule;
};
