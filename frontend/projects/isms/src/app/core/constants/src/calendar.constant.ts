import { INameValue } from "@isms-core/interfaces";

export const Recurrences: Array<{
  name: string;
  value: TRecurrence;
}> = [
  {
    name: "Does not repeat",
    value: "do-not-repeat",
  },
  {
    name: "Daily",
    value: "RRULE:FREQ=DAILY;INTERVAL=1",
  },
  {
    name: "Every weekday (Monday and Friday)",
    value: "RRULE:FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,FR",
  },
  {
    name: "Every weekday (Monday to Friday)",
    value: "RRULE:FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,TU,WE,TH,FR",
  },
  {
    name: "Every weekend (Saturday and Sunday)",
    value: "RRULE:FREQ=WEEKLY;INTERVAL=1;BYDAY=SA,SU",
  },
  {
    name: "Custom",
    value: "custom",
  },
];

export type TRecurrence =
  | "do-not-repeat"
  | "RRULE:FREQ=DAILY;INTERVAL=1"
  | "RRULE:FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,FR"
  | "RRULE:FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,TU,WE,TH,FR"
  | "RRULE:FREQ=WEEKLY;INTERVAL=1;BYDAY=SA,SU"
  | "custom";
