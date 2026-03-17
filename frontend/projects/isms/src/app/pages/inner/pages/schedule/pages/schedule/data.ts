import { ISegmentSelector } from "@isms-core/interfaces";

export const ScheduleSegmentOptions: Array<ISegmentSelector> = [
  {
    label: "Schedules",
    description: "All created schedules will go here",
    icon: "ph-duotone ph-chalkboard",
    disable: false,
  },
  {
    label: "Time",
    description: "All created time will go here",
    icon: "ph-duotone ph-clock",
    disable: false,
  },
  {
    label: "Days",
    description: "All created days will go here",
    icon: "ph-duotone ph-calendar",
    disable: false,
  },
];
