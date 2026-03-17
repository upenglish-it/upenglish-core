import { IAccountNotification, TRole } from '../../database/mongodb';

export const NOTIFICATION_DEFAULT_VALUE = (role: TRole): IAccountNotification => {
  if (role === 'admin') {
    return {
      softwareUpdates: false,
      payslip: false,
      leadConversation: false,
      salaryModification: false,
      wonLose: true,
      leadCreation: true,
      leaveApproval: false,
    };
  }

  if (role === 'teacher') {
    return {
      softwareUpdates: false,
      payslip: false,
      leadConversation: false,
      salaryModification: false,
      wonLose: true,
      leadCreation: true,
      leaveApproval: false,
    };
  }

  if (role === 'student') {
    return {
      softwareUpdates: false,
      payslip: false,
      leadConversation: false,
      salaryModification: false,
      wonLose: true,
      leadCreation: true,
      leaveApproval: false,
    };
  }

  if (role === 'receptionist') {
    return {
      softwareUpdates: false,
      payslip: false,
      leadConversation: false,
      salaryModification: false,
      wonLose: true,
      leadCreation: true,
      leaveApproval: false,
    };
  }

  if (role === 'marketing') {
    return {
      softwareUpdates: false,
      payslip: false,
      leadConversation: false,
      salaryModification: false,
      wonLose: true,
      leadCreation: true,
      leaveApproval: false,
    };
  }
};
