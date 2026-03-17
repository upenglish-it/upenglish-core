export const PredefinedRole: Array<{ name: string; value: TPredefinedRole }> = [
  {
    name: 'Admin',
    value: 'admin',
  },
  {
    name: 'Teacher',
    value: 'teacher',
  },
  {
    name: 'Student',
    value: 'student',
  },
  {
    name: 'Receptionist',
    value: 'receptionist',
  },
  {
    name: 'Marketing',
    value: 'marketing',
  },
];

type TPredefinedRole = 'admin' | 'teacher' | 'student' | 'receptionist' | 'marketing';
export const RoleAndPermission = (role: TPredefinedRole) => {
  const permission = RolePermission;

  if (role === 'teacher') {
    permission[0].permissions[3].pageAccess = false;
    permission[0].permissions[3].create = false;
    permission[0].permissions[3].view = false;
    permission[0].permissions[3].edit = false;
    permission[0].permissions[3].delete = false;
  }

  if (role === 'student') {
    permission[0].permissions[1].pageAccess = false;
    permission[0].permissions[1].create = false;
    permission[0].permissions[1].view = false;
    permission[0].permissions[1].edit = false;
    permission[0].permissions[1].delete = false;

    permission[0].permissions[2].pageAccess = false;
    permission[0].permissions[2].create = false;
    permission[0].permissions[2].view = false;
    permission[0].permissions[2].edit = false;
    permission[0].permissions[2].delete = false;

    permission[0].permissions[3].pageAccess = false;
    permission[0].permissions[3].create = false;
    permission[0].permissions[3].view = false;
    permission[0].permissions[3].edit = false;
    permission[0].permissions[3].delete = false;
  }

  if (role === 'receptionist') {
  }

  if (role === 'marketing') {
  }

  return permission;
};

const RolePermission = [
  {
    name: 'General Pages',
    value: 'general-pages',
    permissions: [
      {
        name: 'Dashboard',
        value: 'dashboard',
        pageAccess: true,
        view: true,
        edit: true,
        create: true,
        delete: true,
        permissions: [],
      },
      {
        name: 'Students',
        value: 'students',
        pageAccess: true,
        create: true,
        delete: true,
        view: true,
        edit: true,
        permissions: [
          {
            name: 'Manage',
            value: 'students-manage',
            pageAccess: true,
            create: true,
            delete: true,
            view: true,
            edit: true,
            permissions: [],
          },
          {
            name: 'Tuition & Attendance',
            value: 'students-tuition-attendance',
            pageAccess: true,
            create: true,
            delete: true,
            view: true,
            edit: true,
            permissions: [],
          },
        ],
      },
      {
        name: 'Staffs',
        value: 'staffs',
        pageAccess: true,
        create: true,
        delete: true,
        view: true,
        edit: true,
        permissions: [
          {
            name: 'Manage',
            value: 'staffs-manage',
            pageAccess: true,
            create: true,
            delete: true,
            view: true,
            edit: true,
            permissions: [],
          },
          {
            name: 'Salary',
            value: 'staffs-salary',
            pageAccess: true,
            create: true,
            delete: true,
            view: true,
            edit: true,
            permissions: [],
          },
        ],
      },
      {
        name: 'Courses',
        value: 'courses',
        pageAccess: true,
        create: true,
        delete: true,
        view: true,
        edit: true,
        permissions: [
          {
            name: 'Manage',
            value: 'courses-manage',
            pageAccess: true,
            create: true,
            delete: true,
            view: true,
            edit: true,
            permissions: [],
          },
          {
            name: 'Courses Groups',
            value: 'courses-groups',
            pageAccess: true,
            create: true,
            delete: true,
            view: true,
            edit: true,
            permissions: [],
          },
        ],
      },
      {
        name: 'Classes',
        value: 'classes',
        pageAccess: true,
        create: true,
        delete: true,
        view: true,
        edit: true,
        permissions: [
          {
            name: 'Manage',
            value: 'classes-manage',
            pageAccess: true,
            create: true,
            delete: true,
            view: true,
            edit: true,
            permissions: [],
          },
          {
            name: 'Days',
            value: 'classes-days',
            pageAccess: true,
            create: true,
            delete: true,
            view: true,
            edit: true,
            permissions: [],
          },
          {
            name: 'Time',
            value: 'classes-time',
            pageAccess: true,
            create: true,
            delete: true,
            view: true,
            edit: true,
            permissions: [],
          },
        ],
      },
      {
        name: 'Roles Permissions',
        value: 'roles-permissions',
        pageAccess: true,
        create: true,
        delete: true,
        view: true,
        edit: true,
        permissions: [
          {
            name: 'Manage',
            value: 'roles-permissions-manage',
            pageAccess: true,
            create: true,
            delete: true,
            view: true,
            edit: true,
            permissions: [],
          },
          {
            name: 'Create',
            value: 'roles-permissions-create',
            pageAccess: true,
            create: true,
            delete: true,
            view: true,
            edit: true,
            permissions: [],
          },
        ],
      },
      {
        name: 'Cashflow',
        value: 'cashflow',
        pageAccess: true,
        create: true,
        delete: true,
        view: true,
        edit: true,
        permissions: [
          {
            name: 'Income',
            value: 'cashflow-income',
            pageAccess: true,
            create: true,
            delete: true,
            view: true,
            edit: true,
            permissions: [],
          },
          {
            name: 'Expenses',
            value: 'cashflow-expenses',
            pageAccess: true,
            create: true,
            delete: true,
            view: true,
            edit: true,
            permissions: [],
          },
        ],
      },
      {
        name: 'Materials',
        value: 'materials',
        pageAccess: true,
        create: true,
        delete: true,
        view: true,
        edit: true,
        permissions: [
          {
            name: 'Manage',
            value: 'materials-manage',
            pageAccess: true,
            create: true,
            delete: true,
            view: true,
            edit: true,
            permissions: [],
          },
        ],
      },
      {
        name: 'Challenges',
        value: 'challenges',
        pageAccess: true,
        create: true,
        delete: true,
        view: true,
        edit: true,
        permissions: [
          {
            name: 'Manage',
            value: 'challenges-manage',
            pageAccess: true,
            create: true,
            delete: true,
            view: true,
            edit: true,
            permissions: [],
          },
          {
            name: 'Results',
            value: 'challenges-results',
            pageAccess: true,
            create: true,
            delete: true,
            view: true,
            edit: true,
            permissions: [],
          },
          {
            name: 'My Challenges',
            value: 'challenges-my-challenges',
            pageAccess: true,
            create: true,
            delete: true,
            view: true,
            edit: true,
            permissions: [],
          },
          {
            name: 'My Challenges Results',
            value: 'challenges-my-results',
            pageAccess: true,
            create: true,
            delete: true,
            view: true,
            edit: true,
            permissions: [],
          },
        ],
      },
      {
        name: 'Announcements',
        value: 'announcements',
        pageAccess: true,
        create: true,
        delete: true,
        view: true,
        edit: true,
        permissions: [
          {
            name: 'Manage',
            value: 'announcements-manage',
            pageAccess: true,
            create: true,
            delete: true,
            view: true,
            edit: true,
            permissions: [],
          },
        ],
      },
      {
        name: 'Leads',
        value: 'leads',
        pageAccess: true,
        create: true,
        delete: true,
        view: true,
        edit: true,
        permissions: [
          {
            name: 'Manage',
            value: 'leads-manage',
            url: '/i/c/leads',
            pageAccess: true,
            create: true,
            delete: true,
            view: true,
            edit: true,
            permissions: [],
          },
        ],
      },
    ],
  },
];
