export const RouterUtils = {
  processing: "processing",
  auth: {
    root: "a",
    signIn: "signin",
    socialLoginLanding: "social-login-landing",
    signUp: "signup",
    resetPassword: "reset-password",
    verifyEmail: "verify-email",
  },
  inner: {
    root: "i",
    dashboard: {
      root: "dashboard",
      manage: "manage",
    },
    students: {
      root: "students",
    },
    staffs: {
      root: "staffs",
    },
    courses: {
      root: "courses",
    },
    classes: {
      root: "classes",
    },
    materials: {
      root: "materials",
    },
    cashflow: {
      root: "cashflow",
    },
    templates: {
      root: "templates",
    },
    announcements: {
      root: "announcements",
    },
    schedule: {
      root: "schedule",
    },
    calendar: {
      root: "calendar",
    },
    pipelines: {
      root: "pipelines",
      designer: {
        root: "designer",
        pipeline: "pipeline/:pipelineId/:type",
        settings: "settings/:pipelineId/:type",
      },
    },
    tasks: {
      root: "tasks",
      builder: {
        root: ":taskId",
        builder: "builder",
        settings: "settings",
        submissions: "submissions",
      },
    },
    settings: {
      root: "settings",
      myAccount: {
        root: "my-account",
        profile: "profile",
        notification: "notification",
        lockScreen: "lock-screen",
        language: "language",
        leaves: "leaves",
        integration: "integration",
        payslip: "payslip",
      },
      branch: {
        root: "branch",
        profile: "profile",
      },
      general: {
        root: "general",
        branches: "branches",
      },
    },
  },
  socialLoginLanding: {
    root: "sll",
  },
  integrationLanding: {
    root: "ilc",
  },
  // calendarBooking: {
  //   root: "cb",
  //   book: "book"
  // },
  proofOfPayment: {
    root: "pop",
    staffPayslip: "staff-payslip",
    studentReceipt: "student-receipt",
    expenseReceipt: "expense-receipt",
  },
  tasks: {
    root: "tasks",
    report: "report/:submissionId",
    take: {
      root: ":id",
    },
  },
  errorResponse: {
    notFound: "not-found",
  },
};
