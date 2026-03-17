import { INavigation } from "@isms-pages/inner/layout/data";

export const TabNavigations: Readonly<Array<INavigation>> = [
  // {
  //   name: 'Candidates',
  //   icon: 'ph-users-three',
  //   route: 'candidates',
  // },
  {
    name: "Pipeline",
    icon: "ph-kanban",
    route: "pipeline",
  },
  {
    name: "Settings",
    icon: "ph-gear",
    route: "settings",
  },
];
