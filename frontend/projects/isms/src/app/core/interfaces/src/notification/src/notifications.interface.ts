export interface INotification {
  _id: string;
  actionType: TNotificationsActionType;
  title: string;
  message: string;
  status: "unread" | "read";
  accounts: string;
  properties: string;
  propertiesBranches: string;
  deleted: boolean;
  createdAt: string;
  updatedAt: string;
  data: {
    studentImportIndexingId: string; // upload-bulk-student
    urlCode: string; // use in staff-payslip, student-receipt
    taskId?: string;
    tasksSubmission?: string;

    /* use in pipeline changes */
    pipelineId: string;
    updatedBy: string;
  };
}

export type TNotificationsActionType =
  | "upload-bulk-student"
  | "staff-payslip"
  | "student-receipt"
  | "assign-task-to-reviewer"
  | "assign-task-to-participant"
  | "participant-submit-task"
  | "reviewer-reviewed-submitted-task"
  | "lead-changes-in-pipeline";
