import { IScheduleSchedulesShift } from "@isms-core/interfaces";
import { environment } from "@isms-env/environment";
import { uniqBy } from "lodash";
import { DateTime } from "luxon";
// import * as moment from "moment";
import moment from "moment";
import { ulid } from "ulidx";

export const SYSTEM_ID = () => {
  return `${environment.appName}${ulid().replace(/-/g, "")}`;
};

export const ArrayMove = (arr: Array<any>, oldIndex: number, newIndex: number) => {
  while (oldIndex < 0) {
    oldIndex += arr.length;
  }
  while (newIndex < 0) {
    newIndex += arr.length;
  }
  if (newIndex >= arr.length) {
    var k = newIndex - arr.length + 1;
    while (k--) {
      arr.push(undefined);
    }
  }
  arr.splice(newIndex, 0, arr.splice(oldIndex, 1)[0]);
  return arr;
};

export const FormatTime = (time: string) => {
  const [hours, minutes] = time.split(":");
  return DateTime.local(1, 1, 1, Number(hours), Number(minutes));
};

export const SortSchedule = (schedules: Array<IScheduleSchedulesShift>): Array<IScheduleSchedulesShift> => {
  let sortedSchedules: Array<IScheduleSchedulesShift> = [];
  const sorted = new Set();
  const filteredSorted = schedules; //
  // .filter((schedule) => {
  //   const key = `${schedule.time.from}-${schedule.time.to}`;
  //   if (!sorted.has(key)) {
  //     sorted.add(key);
  //     return true;
  //   }
  //   return false;
  // });

  // console.log("filteredSorted", filteredSorted);
  filteredSorted.forEach((shift) => {
    sortedSchedules.push(shift);
  });
  let sortedScheduleTimeRanges: Array<IScheduleSchedulesShift> = [...sortedSchedules.values()]
    .sort((a, b) => {
      const timeA = FormatTime(a.time.from);
      const timeB = FormatTime(b.time.from);
      return timeA.toMillis() - timeB.toMillis();
    })
    .map((schedule) => {
      const fromTime = moment(schedule.time.from, "HH:mm").format("hh:mma");
      const toTime = moment(schedule.time.to, "HH:mm").format("hh:mma");
      schedule["timeRangeText"] = `${fromTime} - ${toTime}`;
      return schedule;
    });
  return sortedScheduleTimeRanges;
};

export const SortScheduleShift = (scheduleShifts: Array<IScheduleSchedulesShift>): Array<IScheduleSchedulesShift> => {
  let sortedTimeRanges: Array<IScheduleSchedulesShift> = [];
  let sortedShifts: Array<IScheduleSchedulesShift> = scheduleShifts;

  // scheduleShifts.forEach((shift, scheduleIndex) => {
  //   /* Week By Class */
  //   const sortShifts = new Set();
  //   const xsortedShifts = scheduleShifts.filter((shift) => {
  //     const key = `${shift.time.from}-${shift.time.to}`;
  //     if (!sortShifts.has(key)) {
  //       sortShifts.add(key);
  //       return true;
  //     }
  //     return false;
  //   });
  //   xsortedShifts.forEach((shift) => {
  //     sortedShifts.push(shift);
  //   });
  // });

  sortedTimeRanges = [...sortedShifts.values()]
    .sort((a, b) => {
      const timeA = FormatTime(a.time.from);
      const timeB = FormatTime(b.time.from);
      return timeA.toMillis() - timeB.toMillis();
    })
    .map((schedule) => {
      const fromTime = moment(schedule.time.from, "HH:mm").format("hh:mma");
      const toTime = moment(schedule.time.to, "HH:mm").format("hh:mma");
      schedule["timeRangeText"] = `${fromTime} - ${toTime}`;
      return schedule;
    });

  return uniqBy(sortedTimeRanges, "timeRangeText");
};

export const isTimeWithinRange = (timeToCheck: string, schedule: { from: string; to: string }) => {
  const { from, to } = schedule;
  const startTime = DateTime.fromFormat(from, "HH:mm");
  const endTime = DateTime.fromFormat(to, "HH:mm");
  const checkTime = DateTime.fromFormat(timeToCheck, "HH:mm");
  return checkTime >= startTime && checkTime <= endTime;
};

export const ArrayRange = (start: number, stop: number, step: number = 1) => Array.from({ length: (stop - start) / step + 1 }, (value, index) => start + index * step);

export const FormatterPercent = (value: number): any => `${value} %`;
export const ParserPercent = (value: string): any => value.replace(" %", "");
export const FormatterVND = (value: number): any => `₫ ${value}`;
export const ParserVND = (value: string): any => value.replace("₫ ", "");
