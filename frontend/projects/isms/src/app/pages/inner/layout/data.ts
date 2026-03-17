/* Page Navigations */
export const AdminNavigations: Array<INavigation> = [
  {
    name: "Dashboard",
    icon: "ph-house",
    route: "/i/dashboard",
  },
  {
    name: "Students",
    icon: "ph-users-four",
    route: "/i/students",
  },
  {
    name: "Staffs",
    icon: "ph-users-three",
    route: "/i/staffs",
  },
  {
    name: "Courses",
    icon: "ph-chalkboard",
    route: "/i/courses",
  },
  {
    name: "Classes",
    icon: "ph-chalkboard-teacher",
    route: "/i/classes",
  },
  {
    name: "Items",
    icon: "ph-folder-open",
    route: "/i/materials",
  },
  {
    name: "Cashflow",
    icon: "ph-hand-coins",
    route: "/i/cashflow",
  },
  {
    name: "Announcements",
    icon: "ph-megaphone",
    route: "/i/announcements",
  },
  {
    name: "Task",
    icon: "ph-exam",
    route: "/i/tasks",
  },
  {
    name: "Schedule",
    icon: "ph-table",
    route: "/i/schedule",
  },
  {
    name: "Templates",
    icon: "ph-files",
    route: "/i/templates",
  },
  {
    name: "My Calendar",
    icon: "ph-calendar",
    route: "/i/calendar",
  },
  {
    name: "Pipeline",
    icon: "ph-kanban",
    route: "/i/pipelines",
  },
];

export const TeacherNavigations: Array<INavigation> = [
  {
    name: "Dashboard",
    icon: "ph-house",
    route: "/i/dashboard",
  },
  {
    name: "Students",
    icon: "ph-users-four",
    route: "/i/students",
  },
  {
    name: "Courses",
    icon: "ph-chalkboard",
    route: "/i/courses",
  },
  {
    name: "Classes",
    icon: "ph-chalkboard-teacher",
    route: "/i/classes",
  },
  {
    name: "Announcements",
    icon: "ph-megaphone",
    route: "/i/announcements",
  },
  {
    name: "Task",
    icon: "ph-exam",
    route: "/i/tasks",
  },
];

export const ReceptionistNavigations: Array<INavigation> = [
  {
    name: "Dashboard",
    icon: "ph-house",
    route: "/i/dashboard",
  },
  {
    name: "Students",
    icon: "ph-users-four",
    route: "/i/students",
  },
  // {
  //   name: "Staffs",
  //   icon: "ph-users-three",
  //   route: "/i/staffs"
  // },
  // {
  //   name: "Courses",
  //   icon: "ph-chalkboard",
  //   route: "/i/courses"
  // },
  {
    name: "Classes",
    icon: "ph-chalkboard-teacher",
    route: "/i/classes",
  },
  {
    name: "Materials",
    icon: "ph-folder-open",
    route: "/i/materials",
  },
  {
    name: "Cashflow",
    icon: "ph-hand-coins",
    route: "/i/cashflow",
  },
  // {
  //   name: "Announcements",
  //   icon: "ph-megaphone",
  //   route: "/i/announcements"
  // },
  // {
  //   name: "Task",
  //   icon: "ph-exam",
  //   route: "/i/tasks"
  // },
  {
    name: "Schedule",
    icon: "ph-table",
    route: "/i/schedule",
  },
  // {
  //   name: "Templates",
  //   icon: "ph-files",
  //   route: "/i/templates"
  // },
  // {
  //   name: "My Calendar",
  //   icon: "ph-calendar",
  //   route: "/i/calendar"
  // },
  {
    name: "Pipeline",
    icon: "ph-kanban",
    route: "/i/pipelines",
  },
];

export const StudentNavigations: Array<INavigation> = [
  {
    name: "Dashboard",
    icon: "ph-house",
    route: "/i/dashboard",
  },
];

export const MarketingNavigations: Array<INavigation> = [
  {
    name: "Dashboard",
    icon: "ph-house",
    route: "/i/dashboard",
  },
  {
    name: "Students",
    icon: "ph-users-four",
    route: "/i/students",
  },
  {
    name: "Pipeline",
    icon: "ph-kanban",
    route: "/i/pipelines",
  },
];

/* Account Navigations */
export const AccountNavigations: Array<INavigation> = [
  {
    name: "My Profile",
    icon: "ph-user-circle",
    route: "/i/settings/my-account/profile",
  },
  {
    name: "My Calendar",
    icon: "ph-calendar",
    route: "/i/calendar",
  },
  {
    name: "Notifications",
    icon: "ph-bell",
    route: "/i/settings/my-account/notification",
  },
  {
    name: "Language",
    icon: "ph-calendar",
    route: "/i/settings/my-account/language",
  },
  // {
  //   name: 'My Team',
  //   icon: 'ph-users-four',
  //   route: '/i/account/availability',
  // },
  // { separator: true },
  // {
  //   name: 'Workspace',
  //   icon: 'ph-briefcase',
  //   route: '/i/account/availability',
  // },
  // {
  //   name: 'Manage Billing & Usage',
  //   icon: 'ph-wallet',
  //   route: '/i/account/subscription',
  // },
  { separator: true },
  {
    name: "Lock Screen",
    icon: "ph-monitor",
    type: "lockscreen",
  },
  { separator: true },
  {
    name: "Logout",
    icon: "ph-sign-out",
    type: "logout",
    route: "/a/signin",
  },
  // { separator: true },
  // {
  //   name: 'Availability',
  //   icon: 'user-circle',
  //   route: '/i/account/profile',
  // },

  // <!-- ['My Profile', 'Availability', 'Calendar', 'Billing', 'TeamMembers'] -->
];

export interface INavigation {
  name?: string;
  icon?: string;
  type?: string;
  route?: string;
  separator?: boolean; // as a separator/divider in list
  selected?: boolean;
  child?: Array<INavigation>;
}
