import { INavigation } from "@isms-pages/inner/layout/data";

export const AccountNavigation: Array<INavigation> = [
  {
    name: "My Profile",
    icon: "user-circle",
    route: "my-account/profile",
  },
  {
    name: "Notifications",
    icon: "bell",
    route: "my-account/notification",
  },
  {
    name: "Lock Screen",
    icon: "monitor",
    route: "my-account/lock-screen",
  },
  {
    name: "Language",
    icon: "translate",
    route: "my-account/language",
  },
  { separator: true },
  // {
  //   name: "My Payslip",
  //   icon: "scroll",
  //   route: "/i/account/settings/payslip"
  // },
  {
    name: "Integration",
    icon: "link",
    route: "my-account/integration",
  },
  {
    name: "Time Off",
    icon: "clipboard-text",
    route: "my-account/leaves",
  },
];

export const WorkspaceNavigation: Array<INavigation> = [
  {
    name: "Staffs",
    icon: "users-three",
    route: "/i/staffs",
  },
  {
    name: "Courses",
    icon: "users-four",
    route: "/i/courses",
  },
  // { separator: true },
  // {
  //   name: "Trash Bin",
  //   icon: "trash",
  //   route: "/i/account/trash"
  // }
];

export const SystemSettingsNavigation: Array<INavigation> = [
  {
    name: "Branches",
    icon: "git-branch",
    route: "general/branches",
  },
  {
    name: "Role & Permission",
    icon: "lock",
    route: "general/role-permission",
  },
  // // {
  // //   name: 'People & Access',
  // //   icon: 'users-three',
  // //   route: '/i/candidates',
  // // },
  // {
  //   name: 'Subscription Plan',
  //   icon: 'credit-card',
  //   route: '/i/account/billing',
  // },
  // {
  //   name: 'Key & Apps',
  //   icon: 'key',
  //   route: '/i/automations',
  //   child: [
  //     {
  //       name: 'All Automation',
  //       route: '/i/automations',
  //     },
  //     // {
  //     //   name: 'Stages',
  //     //   route: '/i/pipelines/bulk-upload',
  //     // },
  //   ],
  // },
  //   {
  //     name: 'Domains',
  //     icon: 'folders',
  //     route: '/i/templates',
  //     child: [
  //       {
  //         name: 'Emails',
  //         route: '/i/templates/emails',
  //       },
  //       {
  //         name: 'Hiring Stages',
  //         route: '/i/templates/hiring-stages',
  //       },
  //       {
  //         name: 'Sources',
  //         route: '/i/templates/sources',
  //       },
  //       {
  //         name: 'Tags',
  //         route: '/i/templates/tags',
  //       },
  //     ],
  //   },
  // { separator: true },
  // {
  //   name: 'Setup Integration',
  //   icon: 'key',
  //   route: '/i/automations',
  //   child: [
  //     {
  //       name: 'All Automation',
  //       route: '/i/automations',
  //     },
  //     // {
  //     //   name: 'Stages',
  //     //   route: '/i/pipelines/bulk-upload',
  //     // },
  //   ],
  // },
];
