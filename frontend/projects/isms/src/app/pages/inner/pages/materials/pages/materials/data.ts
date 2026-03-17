import { ISegmentSelector } from "@isms-core/interfaces";

export const MaterialsSegmentOptions: Array<ISegmentSelector> = [
  {
    label: "Items",
    description: "All created item will go here",
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
