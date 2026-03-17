import { HttpStatus, Injectable } from '@nestjs/common';
import {
  IResponseHandlerParams,
  ResponseHandlerService,
  STATUS_CODE,
  IAuthTokenPayload,
  Tasks,
  TasksSubmissions,
  Accounts,
  StudentsTuitionAttendance,
  Classes,
  TaskCategory,
  TaskQuestion,
  OpenAITaskPrompt,
  Notifications,
  TasksSubmissionsInstances,
} from 'apps/common';
import { ReturnModelType } from '@typegoose/typegoose';
import { InjectModel } from 'nestjs-typegoose';
import { CreateSubmissionDTO, ReviewParticipantAnswerDTO, ReviewParticipantAnswerReview, UpdateSubmissionCategoriesDTO } from './dto';
import { isEmpty } from 'lodash';
import { flatten } from 'mongo-dot-notation';
import { parse } from 'node-html-parser';
import { TasksService } from './tasks.service';

@Injectable()
export class TasksSubmissionsService {
  constructor(
    private readonly tasksService: TasksService,
    @InjectModel(Tasks) private readonly tasks: ReturnModelType<typeof Tasks>,
    @InjectModel(Accounts) private readonly accounts: ReturnModelType<typeof Accounts>,
    @InjectModel(Classes) private readonly classes: ReturnModelType<typeof Classes>,
    @InjectModel(StudentsTuitionAttendance) private readonly studentsTuitionAttendance: ReturnModelType<typeof StudentsTuitionAttendance>,
    @InjectModel(TasksSubmissionsInstances) private readonly tasksSubmissionsInstances: ReturnModelType<typeof TasksSubmissionsInstances>,

    @InjectModel(TasksSubmissions) private readonly tasksSubmissions: ReturnModelType<typeof TasksSubmissions>,
    @InjectModel(Notifications) private readonly notifications: ReturnModelType<typeof Notifications>
  ) {}

  public async submissionsOfParticipants(taskId: string, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const tasksSubmissions = await this.tasksSubmissions
        .aggregate([
          {
            $match: {
              // $or: [
              //   {
              //     'task.assignee.reviewers': { $in: [tokenPayload.accountId] },
              //   },
              //   // {
              //   //   'task.createdBy': tokenPayload.accountId,
              //   // },
              // ],
              'task._id': taskId,
              type: 'official',
              // properties: tokenPayload.propertyId,
              // propertiesBranches: tokenPayload.branchId,
              deleted: false,
            },
          },

          /* participant */
          {
            $lookup: {
              from: 'accounts',
              foreignField: '_id',
              localField: 'participant',
              as: 'participant',
            },
          },
          {
            $unwind: '$participant',
          },

          // {
          //   $unwind: {
          //     path: '$participant',
          //     preserveNullAndEmptyArrays: true,
          //   },
          // },

          /* class */
          {
            $lookup: {
              from: 'classes',
              foreignField: '_id',
              localField: 'class',
              as: 'class',
            },
          },
          {
            $unwind: {
              path: '$class',
              preserveNullAndEmptyArrays: true,
            },
          },
        ])
        .sort({ createdAt: -1 });

      if (isEmpty(tasksSubmissions)) {
        return ResponseHandlerService({
          success: false,
          httpCode: HttpStatus.NOT_FOUND,
          statusCode: STATUS_CODE.NOT_FOUND,
          message: 'No result(s) found',
        });
      }

      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.OK,
        statusCode: STATUS_CODE.HAS_DATA,
        data: tasksSubmissions,
      });
    } catch (error) {
      return ResponseHandlerService({
        success: false,
        httpCode: HttpStatus.INTERNAL_SERVER_ERROR,
        statusCode: STATUS_CODE.INTERNAL_SERVER_ERROR,
        message: 'Unable to process your data',
        errorDetails: error,
      });
    }
  }

  public async create(body: CreateSubmissionDTO, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const task = await this.tasksSubmissions.create({
        participant: tokenPayload.accountId,
        task: body,
        type: body.type,
        properties: tokenPayload.propertyId,
        propertiesBranches: tokenPayload.branchId,
      });
      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.CREATED,
        statusCode: STATUS_CODE.DATA_CREATED,
        message: 'Task was submitted',
        data: task,
      });
    } catch (error) {
      return ResponseHandlerService({
        success: false,
        httpCode: HttpStatus.INTERNAL_SERVER_ERROR,
        statusCode: STATUS_CODE.INTERNAL_SERVER_ERROR,
        message: 'Unable to process your data',
        errorDetails: error,
      });
    }
  }

  public async fetchById(submissionId: string, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const tasksSubmissions = await this.tasksSubmissions.findOne(
        {
          _id: submissionId,
          properties: tokenPayload.propertyId,
          // propertiesBranches: tokenPayload.branchId,
          deleted: false,
        },
        {
          // 'task.categories.questions.originalAnswer': 0,
          // 'task.categories.questions.reviewerAnswer': 0,
        }
      );

      if (isEmpty(tasksSubmissions)) {
        return ResponseHandlerService({
          success: false,
          httpCode: HttpStatus.NOT_FOUND,
          statusCode: STATUS_CODE.NOT_FOUND,
          message: 'No result(s) found',
        });
      }

      const account = await this.accounts.findOne({ _id: tasksSubmissions.participant });

      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.OK,
        statusCode: STATUS_CODE.HAS_DATA,
        data: { ...tasksSubmissions.toJSON(), account },
      });
    } catch (error) {
      return ResponseHandlerService({
        success: false,
        httpCode: HttpStatus.INTERNAL_SERVER_ERROR,
        statusCode: STATUS_CODE.INTERNAL_SERVER_ERROR,
        message: 'Unable to process your data',
        errorDetails: error,
      });
    }
  }

  public async updateCategoriesById(
    submissionId: string,
    body: UpdateSubmissionCategoriesDTO,
    tokenPayload: IAuthTokenPayload
  ): Promise<IResponseHandlerParams> {
    try {
      const flattened = flatten(body.taskSubmission, { array: true }); // object to mongodb-dot-notation

      const tasksSubmissions = await this.tasksSubmissions.findOneAndUpdate(
        {
          _id: submissionId,
          properties: tokenPayload.propertyId,
          propertiesBranches: tokenPayload.branchId,
        },
        flattened,
        {
          new: true,
        }
      );

      const allWasAnswered = tasksSubmissions.task.categories.find((category) =>
        category.questions.find((question) => isEmpty(parse(question.attendeeAnswer || '').textContent.trim()))
      );
      let status = 'incomplete';
      if (isEmpty(allWasAnswered)) {
        status = 'pending';
      }
      const allWasReviewed = tasksSubmissions.task.categories.find((category) =>
        category.questions.find((question) => question.reviewStatus === 'completed')
      );
      if (!isEmpty(allWasReviewed)) {
        status = 'reviewed';
      }
      await this.tasksSubmissions.updateOne(
        {
          _id: submissionId,
          // properties: tokenPayload.propertyId, propertiesBranches: tokenPayload.branchId
        },
        { $set: { status: status } }
      );

      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.CREATED,
        statusCode: STATUS_CODE.DATA_CREATED,
        message: 'Settings was updated',
      });
    } catch (error) {
      return ResponseHandlerService({
        success: false,
        httpCode: HttpStatus.INTERNAL_SERVER_ERROR,
        statusCode: STATUS_CODE.INTERNAL_SERVER_ERROR,
        message: 'Unable to process your data',
        errorDetails: error,
      });
    }
  }

  public async reviewParticipantAnswer(
    submissionId: string,
    body: ReviewParticipantAnswerDTO,
    tokenPayload: IAuthTokenPayload
  ): Promise<IResponseHandlerParams> {
    try {
      const tasksSubmission = await this.tasksSubmissions.findOne({
        _id: submissionId,
        // properties: tokenPayload.propertyId,
        // propertiesBranches: tokenPayload.branchId,
      });

      console.log('test', body);
      // loop the questions
      // - Automatic Reviewer by choice (skip the AI and manual reviewer)
      // - Manual Reviewer by  reviewer
      // - AI Reviewer by OpenAI

      if ('review' in body) {
        /* if review wants to review specific question */
        // const category = tasksSubmission.task.categories[body.review.categoryIndex];
        // const question = tasksSubmission.task.categories[body.review.categoryIndex].questions[body.review.questionIndex];
        // const reviewAnswerQuery = await this.reviewParticipantAnswerCategoryQuestion(tasksSubmission, category, question, body.review);

        // console.log('>>>>>', tasksSubmission, category, question, body.review);
        // console.log('reviewAnswerQuery with index ', reviewAnswerQuery);
        // if (!isEmpty(reviewAnswerQuery)) {
        // const objectEntries = Object.entries(reviewAnswerQuery);
        const reviewQuery = Object.create({});
        // if (objectEntries.length > 0) {
        // for await (const objectEntry of objectEntries) {
        reviewQuery[`task.categories.${body.review.categoryIndex}.questions.${body.review.questionIndex}.reviewerScore`] = body.review.reviewerScore;
        reviewQuery[`task.categories.${body.review.categoryIndex}.questions.${body.review.questionIndex}.conclusion`] = body.review.conclusion;
        // }

        console.log('reviewQuery', reviewQuery);
        await this.tasksSubmissions.updateOne(
          {
            _id: submissionId,
            //  properties: tokenPayload.propertyId, propertiesBranches: tokenPayload.branchId
          },
          { $set: reviewQuery }
        );
        // }
        // }
      } else {
        /* if review wants to review all question */
        // for await (const category of tasksSubmission.task.categories) {
        for (let categoryIndex = 0; categoryIndex < tasksSubmission.task.categories.length; categoryIndex++) {
          const category = tasksSubmission.task.categories[categoryIndex];

          let questionIndex = 0;

          for await (const question of category.questions) {
            const reviewAnswerQuery = await this.reviewParticipantAnswerCategoryQuestion(tasksSubmission, category, question);

            console.log('else reviewAnswerQuery', reviewAnswerQuery, question.title);

            if (!isEmpty(reviewAnswerQuery)) {
              const objectEntries = Object.entries(reviewAnswerQuery);
              const reviewQuery = Object.create({});
              if (objectEntries.length > 0) {
                for await (const objectEntry of objectEntries) {
                  reviewQuery[`task.categories.${categoryIndex}.questions.${questionIndex}.${objectEntry[0]}`] = objectEntry[1];
                }

                console.log('reviewQuery', reviewQuery);
                await this.tasksSubmissions.updateOne(
                  {
                    _id: submissionId,
                    //  properties: tokenPayload.propertyId, propertiesBranches: tokenPayload.branchId
                  },
                  { $set: reviewQuery }
                );
              }
            }

            questionIndex = +1;
          }

          // for (let questionIndex = 0; questionIndex < category.questions.length; questionIndex++) {
          //   const question = category.questions[questionIndex];
          //   const reviewAnswerQuery = await this.reviewParticipantAnswerCategoryQuestion(tasksSubmission, category, question);

          //   console.log('reviewAnswerQuery', reviewAnswerQuery);

          //   if (!isEmpty(reviewAnswerQuery)) {
          //     const objectEntries = Object.entries(reviewAnswerQuery);
          //     const reviewQuery = Object.create({});
          //     if (objectEntries.length > 0) {
          //       for await (const objectEntry of objectEntries) {
          //         reviewQuery[`task.categories.${categoryIndex}.questions.${questionIndex}.${objectEntry[0]}`] = objectEntry[1];
          //       }
          //       await this.tasksSubmissions.updateOne({ _id: submissionId, properties: tokenPayload.propertyId, propertiesBranches: tokenPayload.branchId }, { $set: reviewQuery });
          //     }
          //   }
          // }
        }
      }

      /* Update status after reviewing all questions */
      const updatedTasksSubmission = await this.tasksSubmissions.findOne({
        _id: submissionId,
        // properties: tokenPayload.propertyId,
        // propertiesBranches: tokenPayload.branchId,
      });
      const allWasAnswered = updatedTasksSubmission.task.categories.find((category) =>
        category.questions.find((question) => isEmpty(parse(question.attendeeAnswer || '').textContent.trim()))
      );
      let status = 'incomplete';
      if (isEmpty(allWasAnswered)) {
        status = 'pending';
      }
      const allWasReviewed = updatedTasksSubmission.task.categories.find((category) =>
        category.questions.find((question) => question.reviewStatus === 'completed')
      );
      if (!isEmpty(allWasReviewed)) {
        status = 'reviewed';
      }
      await this.tasksSubmissions.updateOne(
        {
          _id: submissionId,
          // properties: tokenPayload.propertyId,
          // propertiesBranches: tokenPayload.branchId,
        },
        { $set: { status: status } }
      );

      if (status === 'pending') {
        for await (const accountId of updatedTasksSubmission.task.assignee.reviewers) {
          await this.notifications.create({
            actionType: 'participant-submit-task',
            title: 'Participant Submit Task',
            message: null,
            data: {
              taskId: updatedTasksSubmission.task._id,
              tasksSubmission: updatedTasksSubmission._id,
            },
            accounts: accountId,
            // properties: tokenPayload.propertyId,
            // propertiesBranches: tokenPayload.branchId,
          });
        }
      }

      if (status === 'reviewed') {
        await this.notifications.create({
          actionType: 'reviewer-reviewed-submitted-task',
          title: 'Your task has been reviewed',
          message: null,
          data: {
            taskId: updatedTasksSubmission.task._id,
            tasksSubmission: updatedTasksSubmission._id,
          },
          accounts: updatedTasksSubmission.participant,
          properties: tokenPayload.propertyId,
          propertiesBranches: tokenPayload.branchId,
        });
      }

      //
      const assigneeParticipantsResponse = await this.tasksService.assigneeParticipants(tasksSubmission.task._id, tokenPayload);
      const assigneeParticipants: { name: string; value: any }[] = assigneeParticipantsResponse.data;

      console.log('assigneeParticipants', assigneeParticipants);

      // If the student is belong to any class
      const assignedClass = assigneeParticipants.find(
        (ap: {
          name: string;
          value: {
            type: 'class' | 'student';
            members: { studentsTuitionAttendance: StudentsTuitionAttendance[] };
          };
        }) => {
          console.log('aaa', ap.value);

          // return true;

          if (ap.value.type === 'class') {
            console.log('>>', ap.value.members);
            return ap.value.members.studentsTuitionAttendance?.find((m) => (m.student as any) === tokenPayload.accountId) || false;
          }
          return false;
        }
      );

      if (!isEmpty(assignedClass)) {
        await this.tasksSubmissions.updateOne(
          {
            _id: submissionId,
            // properties: tokenPayload.propertyId,
            // propertiesBranches: tokenPayload.branchId,
          },
          { $set: { status: status, class: assignedClass.value['id'] } }
        );
      }

      console.log('assignedClass', assignedClass);

      /* Decrease the instance */
      this.tasksSubmissionsInstances
        .findOneAndUpdate(
          {
            participant: tasksSubmission.participant,
            task: tasksSubmission.task._id,
            // properties: tokenPayload.propertyId,
            // propertiesBranches: tokenPayload.branchId,
          },
          { $inc: { instances: -1 } },
          { new: true }
        )
        .then();

      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.OK,
        statusCode: STATUS_CODE.DATA_UPDATED,
        message: 'Successfully reviewed',
      });
    } catch (error) {
      return ResponseHandlerService({
        success: false,
        httpCode: HttpStatus.INTERNAL_SERVER_ERROR,
        statusCode: STATUS_CODE.INTERNAL_SERVER_ERROR,
        message: 'Unable to process your data',
        errorDetails: error,
      });
    }
  }

  private async reviewParticipantAnswerCategoryQuestion(
    tasksSubmission: TasksSubmissions,
    category: TaskCategory,
    question: TaskQuestion,
    review?: ReviewParticipantAnswerReview
  ): Promise<any> {
    try {
      // loop the questions
      // - Automatic Reviewer by choice (skip the AI and manual reviewer)
      // - Manual Reviewer by  reviewer
      // - AI Reviewer by OpenAI
      console.log('test ', question);

      const reviewAnswerQuery: any = {};
      const title = question.title ? question.title.trim() : question.title;
      const description = question.description ? parse(question.description || '').textContent.trim() : null;
      const originalAnswer = question.originalAnswer ? question.originalAnswer.trim() : null;
      const attendeeAnswer = question.attendeeAnswer ? parse(question.attendeeAnswer || '').textContent.trim() : null;

      if (question.reviewStatus === 'pending') {
        if (isEmpty(attendeeAnswer)) {
          console.log('attendee did not answer');
          reviewAnswerQuery['reviewerScore'] = 0; // it can be a percentage 4.5
          // reviewAnswerQuery['attendeeScore'] = 0; // 1/0 only
          reviewAnswerQuery['conclusion'] = null;
          reviewAnswerQuery['reviewStatus'] = 'completed';
        } else {
          if (question.type === 'choices') {
            const correctAnswer = question.choices.find((choice) => choice.id === question.attendeeAnswer && choice.id === question.originalAnswer);
            console.log('correctAnswer', correctAnswer);

            if (!isEmpty(correctAnswer)) {
              // reviewAnswerQuery['attendeeScore'] = category.points;
              reviewAnswerQuery['reviewerScore'] = category.points;
            } else {
              if (!isEmpty(question.attendeeAnswer)) {
                let promptQuery = `AI Behavior:
You are an expert English language examiner applying rigorous standards. Be meticulous, literal, concise, direct, objective, and professional. Maintain strictness, reject leniency, and expect only perfect answers.*
Give your brief comment for  the student's answer. Provide clear, understandable feedback.\n
`;

                const _attendeeAnswer = question.choices.find((choice) => choice.id === question.attendeeAnswer);
                const _originalAnswer = question.choices.find((choice) => choice.id === question.originalAnswer);

                if (!isEmpty(title)) {
                  promptQuery = promptQuery + `\nQuestion: ${title}`;
                }

                if (!isEmpty(description)) {
                  promptQuery = promptQuery + `\nDescription: ${description}`;
                }

                promptQuery =
                  promptQuery +
                  `\nChoices: ${question.choices.map((c) => c.value).join(' or ')}` +
                  `\nCorrect Answer: ${_originalAnswer.value}\n` +
                  `\nStudent Answer: ${_attendeeAnswer.value}\n` +
                  `\nMake sure to format the reason with this JSON Schema. \n` +
                  `{"correctAnswerPoints":"score of the answer","correct":"true or false","reason":"
Output it in Vietnamese in the format below:
[Your comment here] 
Câu trả lời đúng: [Give them the correct answer, a simple explanation in form of a sentence or two.]"}\n`;

                const openAITaskPrompt = await OpenAITaskPrompt(promptQuery);
                if (openAITaskPrompt) {
                  if (!isEmpty(openAITaskPrompt)) {
                    console.log('openAITaskPrompt', openAITaskPrompt.content);

                    const openAIReview: { correctAnswerPoints: string; correct: string; reason: string } = JSON.parse(openAITaskPrompt.content);

                    reviewAnswerQuery['conclusion'] = openAIReview.reason;
                  }
                }
              }

              reviewAnswerQuery['reviewerScore'] = 0;
            }
            reviewAnswerQuery['reviewStatus'] = 'completed';
          }
          if (question.type === 'fill-in') {
            // use OpenAI to review
            if (
              question.check === 'short-answer' ||
              question.check === 'grammar-vocab-check' ||
              question.check === 'long-answer' ||
              tasksSubmission.type === 'training'
            ) {
              let promptQuery = `Question: ${title}`;

              if (!isEmpty(description)) {
                promptQuery = promptQuery + `\nQuestion Description: ${description}`;
              }

              //Provide a detailed explanation, focusing only on the grammar and spelling.
              let checkQuery = 'Double check word-counts if the question requires a specific number of words to be met.\n';
              let correctAnswerPointsQuery = '';

              if (question.check === 'long-answer') {
                checkQuery = `
## [Done] Prompt chấm điểm cho các bài viết dài

*AI Behavior:
You are an expert English language examiner applying rigorous standards. Be meticulous, literal, concise, direct, objective, and professional. Maintain strictness, reject leniency, and expect only perfect answers.*

Assign 50% of points based solely on content and comprehensibility, disregarding grammatical, spelling, and punctuation (GSP) errors, which are assessed in the later part. Award this half credit if the answer: (1) meets teacher/question requirements, and (2) is understandable. Deduct from this potential 50% only for requirement dissatisfactions and unintelligibility. Provide clear, easily understood feedback.
Dedicate the remaining 50% of points to evaluating linguistic accuracy, including grammar, vocabulary choice, spelling, punctuation, and structure. Deduct points from this allocation based on the severity and frequency of errors in these areas (e.g., poor structure, grammatical weaknesses, spelling mistakes, misused words). Note: Specific question or teacher requirements regarding phrasing or format supersede standard linguistic assessment for this section.
Award points solely based on objective merit and adherence to requirements; disregard effort or attitude.
Identify and list every error individually and sequentially as it appears in the student's response. Document each instance distinctly, including repetitions.

then `;

                correctAnswerPointsQuery = `{"correctAnswerPoints":"score of the answer","correct":"true or false","reason":"*Output it all in Vietnamese. Format the output depending on the conditions below (I included examples). 😘

1.
Yêu cầu & Mức độ dễ hiểu (50%):
…/…
[Nhận xét về từng yêu cầu]

2.
Ngữ pháp & Từ vựng (50%):
…/…

[*Lỗi dùng từ hoặc chính tả*, sửa lỗi, không cần giải thích. Ví dụ: becaus → because]
[*Lỗi cấu trúc hoặc dấu câu*, sửa lỗi, và giải thích rõ ràng để học sinh học hỏi. Ví dụ: more tall → taller: tính từ một âm tiết dùng đuôi ER ở dạng so sánh hơn.]


If the student's answer is over 100 words. Add this section: 3. Vấn đề nổi bật

[*Vấn đề nghiêm trọng hoặc lặp lại liên tục*]


Tổng điểm: …/…"}\n`;
              } else if (question.check === 'grammar-vocab-check') {
                checkQuery = `
## [Done] Prompt giúp kiểm tra ngữ pháp và từ vựng

*AI Behavior:
You are an expert English language examiner applying rigorous standards. Be meticulous, literal, concise, direct, objective, and professional. Maintain strictness, reject leniency, and expect only perfect answers.*

Comments on the answer based solely on content and comprehensibility, disregarding grammatical, spelling, and punctuation (GSP) errors, which are assessed in the later part. Judge if the answer (1) meets teacher/question requirements, and (2) is understandable. Provide clear, easily understood feedback.
Comment on the answer's linguistic accuracy, including grammar, vocabulary choice, spelling, punctuation, and structure. Judge the severity and frequency of errors in these areas (e.g., poor structure, grammatical weaknesses, spelling mistakes, misused words).
Identify and list every error individually and sequentially as it appears in the student's response. Document each instance distinctly, including repetitions.
Do not grade the student's answer. Tell the students to wait for the teacher's marking.


*Output it all in Vietnamese.*
Format the output depending on the conditions below (I included examples):

Bạn hãy chờ giáo viên chấm điểm nhé. Sau đây là một số nhận xét để bạn tham khảo:

 then `;

                correctAnswerPointsQuery = `{"correctAnswerPoints":"score of the answer","correct":"true or false","reason":"1. Yêu cầu & Mức độ dễ hiểu
[Nhận xét về từng yêu cầu]

2.Ngữ pháp & Từ vựng
[*Lỗi dùng từ hoặc chính tả*, sửa lỗi, không cần giải thích. Ví dụ: becaus → because]
[*Lỗi cấu trúc hoặc dấu câu*, sửa lỗi, và giải thích rõ ràng để học sinh học hỏi. Ví dụ: more tall → taller: tính từ một âm tiết dùng đuôi ER ở dạng so sánh hơn.]
If the student's answer is over 100 words. 
Add this section: 

3. Vấn đề nổi bật [*Vấn đề nghiêm trọng hoặc lặp lại liên tục*]"}\n`;
              } else if (question.check === 'short-answer') {
                checkQuery = `## [Done] Prompt chấm điểm cho các câu đọc, nghe, ngữ pháp, từ vựng
*AI Behavior:
You are an expert English language examiner applying rigorous standards. Be meticulous, literal, concise, direct, objective, and professional. Maintain strictness, reject leniency, and expect only perfect answers.*

Award 100% only for answers meeting all requirements (question, teacher) with perfect grammar and lexis. Award 0% for answers failing core requirements. For all others, deduct points proportionally for unmet requirements or errors (factual/linguistic), ensuring deductions match error severity. Minor errors outside core requirements receive minimal deductions. Provide clear, understandable feedback. Remember: Specific task requirements (phrasing/format) supersede general linguistic standards.
Should a response contain answers to multiple distinct questions, assess each part separately and rigorously based on the criteria for the question it addresses.
Give your brief comment for each of the student's answers


Output it in Vietnamese in the format below:

[Your comment here]

If the answer that doesn't meet the question's or teacher's requirements or is grammatically or lexically inaccurate, add this: Câu trả lời đúng: [Give them the correct answer, a simple explanation in form of a sentence or two. Don't mention the teacher's answer in your explanation]

Tổng điểm: …/….
`;

                correctAnswerPointsQuery = `{"correctAnswerPoints":"score of the answer","correct":"true or false","reason":"Always give a comment. For the answer that doesn't meet the question's or teacher's requirements or is grammatically or lexically inaccurate, g*ive them the correct answer, a simple explanation in form of a sentence or two and Final score: …/…. Don't mention the teacher's answer in your explanation. ***Output it all in Vietnamese**"}\n`;
              }

              if (question.check === 'none') {
                checkQuery = `Check and explain the answer then `;
              }

              //               Check the student answer and score it ranging from 0 to [your code]
              // Check the student answer versus the key points provided by the teacher and score it ranging from 0 to

              const inquiryPoints = isEmpty(originalAnswer)
                ? `Check the student answer and score it ranging from 0 to ${category.points} strictly and sum up the points in reason object.\n`
                : `Check the student answer versus the key points provided by the teacher and score it ranging from 0 to ${category.points} strictly and sum up the points in reason object.\n`;

              promptQuery =
                promptQuery +
                `\nTeacher Answer: ${originalAnswer}\n` +
                `Student Answer: ${attendeeAnswer}\n` +
                checkQuery +
                `Make sure to format the reason with this JSON Schema.\n` +
                correctAnswerPointsQuery +
                inquiryPoints;

              console.log('promptQuery', promptQuery);

              // console.log('promptQuery>>', promptQuery);
              // const openAITaskPrompt = null;

              const openAITaskPrompt = await OpenAITaskPrompt(promptQuery);

              // const openAITaskPrompt: { role: any; content: any } = {
              //   role: '',
              //   content: {
              //     correctAnswerPoints: '0',
              //     correct: 'false',
              //     conclusion:
              //       'The student answer is incorrect as it only provides a partial definition of acid precipitation. It fails to mention that acid precipitation can also include snow and fog with a pH lower than uncontaminated rain.',
              //   },
              // }; // comment for testing

              if (!isEmpty(openAITaskPrompt)) {
                console.log('openAITaskPrompt', openAITaskPrompt.content);

                const openAIReview: { correctAnswerPoints: string; correct: string; reason: string } = JSON.parse(openAITaskPrompt.content);
                // console.log('openAITaskPrompt JSON', openAIReview);

                // const openAIReview: { correctAnswerPoints: string; correct: string; conclusion: string } = openAITaskPrompt.content;
                // console.log('openAITaskPrompt JSON', openAIReview);

                // const correctAnswer = openAIReview.correct === 'true';
                const reviewerScore = parseFloat(openAIReview.correctAnswerPoints) > 0 ? parseFloat(openAIReview.correctAnswerPoints) : 0;

                reviewAnswerQuery['reviewerScore'] = reviewerScore; // it can be a percentage 4.5
                // reviewAnswerQuery['attendeeScore'] = reviewerScore > 0 ? 1 : 0; // 1/0 only
                reviewAnswerQuery['conclusion'] = openAIReview.reason;
                reviewAnswerQuery['reviewStatus'] = 'completed';
              }
            } else {
              // manual reviewer will do
              console.log('manual review', review);
              if (!isEmpty(attendeeAnswer)) {
                const reviewerScore = parseFloat(review.reviewerScore) > 0 ? parseFloat(review.reviewerScore) : 0;
                reviewAnswerQuery['reviewerScore'] = reviewerScore > 0 ? reviewerScore : 0; // it can be a percentage 4.5
                // reviewAnswerQuery['attendeeScore'] = reviewerScore > 0 ? 1 : 0; // 1/0 only
                reviewAnswerQuery['conclusion'] = review.conclusion;
                reviewAnswerQuery['reviewStatus'] = 'completed';
              }
            }
          }
        }
      } else {
        if (isEmpty(attendeeAnswer)) {
          console.log('attendee did not answer');
          reviewAnswerQuery['reviewerScore'] = 0; // it can be a percentage 4.5
          // reviewAnswerQuery['attendeeScore'] = 0; // 1/0 only
          reviewAnswerQuery['conclusion'] = null;
          reviewAnswerQuery['reviewStatus'] = 'completed';
        } else {
          if (question.type === 'choices') {
            const correctAnswer = question.choices.find((choice) => choice.id === question.attendeeAnswer && choice.id === question.originalAnswer);
            console.log('correctAnswer', correctAnswer);
            if (!isEmpty(correctAnswer)) {
              // reviewAnswerQuery['attendeeScore'] = category.points;
              reviewAnswerQuery['reviewerScore'] = category.points;
            } else {
              if (!isEmpty(question.attendeeAnswer)) {
                let promptQuery = `AI Behavior:
You are an expert English language examiner applying rigorous standards. Be meticulous, literal, concise, direct, objective, and professional. Maintain strictness, reject leniency, and expect only perfect answers.*
Give your brief comment for  the student's answer. Provide clear, understandable feedback.\n
`;

                const _attendeeAnswer = question.choices.find((choice) => choice.id === question.attendeeAnswer);
                const _originalAnswer = question.choices.find((choice) => choice.id === question.originalAnswer);

                if (!isEmpty(title)) {
                  promptQuery = promptQuery + `\nQuestion: ${title}`;
                }

                if (!isEmpty(description)) {
                  promptQuery = promptQuery + `\nDescription: ${description}`;
                }

                promptQuery =
                  promptQuery +
                  `\nChoices: ${question.choices.map((c) => c.value).join(' or ')}` +
                  `\nCorrect Answer: ${_originalAnswer.value}\n` +
                  `\nStudent Answer: ${_attendeeAnswer.value}\n` +
                  `\nMake sure to format the reason with this JSON Schema. \n` +
                  `{"correctAnswerPoints":"score of the answer","correct":"true or false","reason":"
Output it in Vietnamese in the format below:
[Your comment here] 
Câu trả lời đúng: [Give them the correct answer, a simple explanation in form of a sentence or two.]"}\n`;

                const openAITaskPrompt = await OpenAITaskPrompt(promptQuery);
                if (openAITaskPrompt) {
                  if (!isEmpty(openAITaskPrompt)) {
                    console.log('openAITaskPrompt', openAITaskPrompt.content);

                    const openAIReview: { correctAnswerPoints: string; correct: string; reason: string } = JSON.parse(openAITaskPrompt.content);

                    reviewAnswerQuery['conclusion'] = openAIReview.reason;
                  }
                }
              }

              reviewAnswerQuery['reviewerScore'] = 0;
            }
            reviewAnswerQuery['reviewStatus'] = 'completed';
          }
          if (question.type === 'fill-in') {
            // use OpenAI to review
            if (
              question.check === 'short-answer' ||
              question.check === 'grammar-vocab-check' ||
              question.check === 'long-answer' ||
              tasksSubmission.type === 'training'
            ) {
              let promptQuery = `Question: ${title}`;

              if (!isEmpty(description)) {
                promptQuery = promptQuery + `\nQuestion Description: ${description}`;
              }

              //Provide a detailed explanation, focusing only on the grammar and spelling.
              let checkQuery = 'Double check word-counts if the question requires a specific number of words to be met.\n';
              let correctAnswerPointsQuery = ``;

              if (question.check === 'long-answer') {
                checkQuery = `
## [Done] Prompt chấm điểm cho các bài viết dài

*AI Behavior:
You are an expert English language examiner applying rigorous standards. Be meticulous, literal, concise, direct, objective, and professional. Maintain strictness, reject leniency, and expect only perfect answers.*

Assign 50% of points based solely on content and comprehensibility, disregarding grammatical, spelling, and punctuation (GSP) errors, which are assessed in the later part. Award this half credit if the answer: (1) meets teacher/question requirements, and (2) is understandable. Deduct from this potential 50% only for requirement dissatisfactions and unintelligibility. Provide clear, easily understood feedback.
Dedicate the remaining 50% of points to evaluating linguistic accuracy, including grammar, vocabulary choice, spelling, punctuation, and structure. Deduct points from this allocation based on the severity and frequency of errors in these areas (e.g., poor structure, grammatical weaknesses, spelling mistakes, misused words). Note: Specific question or teacher requirements regarding phrasing or format supersede standard linguistic assessment for this section.
Award points solely based on objective merit and adherence to requirements; disregard effort or attitude.
Identify and list every error individually and sequentially as it appears in the student's response. Document each instance distinctly, including repetitions.

then `;

                correctAnswerPointsQuery = `{"correctAnswerPoints":"score of the answer","correct":"true or false","reason":"*Output it all in Vietnamese. Format the output depending on the conditions below (I included examples). 😘

1.
Yêu cầu & Mức độ dễ hiểu (50%):
…/…
[Nhận xét về từng yêu cầu]

2.
Ngữ pháp & Từ vựng (50%):
…/…

[*Lỗi dùng từ hoặc chính tả*, sửa lỗi, không cần giải thích. Ví dụ: becaus → because]
[*Lỗi cấu trúc hoặc dấu câu*, sửa lỗi, và giải thích rõ ràng để học sinh học hỏi. Ví dụ: more tall → taller: tính từ một âm tiết dùng đuôi ER ở dạng so sánh hơn.]


If the student's answer is over 100 words. Add this section: 3. Vấn đề nổi bật

[*Vấn đề nghiêm trọng hoặc lặp lại liên tục*]


Tổng điểm: …/…"}\n`;
              } else if (question.check === 'grammar-vocab-check') {
                checkQuery = `
## [Done] Prompt giúp kiểm tra ngữ pháp và từ vựng

*AI Behavior:
You are an expert English language examiner applying rigorous standards. Be meticulous, literal, concise, direct, objective, and professional. Maintain strictness, reject leniency, and expect only perfect answers.*

Comments on the answer based solely on content and comprehensibility, disregarding grammatical, spelling, and punctuation (GSP) errors, which are assessed in the later part. Judge if the answer (1) meets teacher/question requirements, and (2) is understandable. Provide clear, easily understood feedback.
Comment on the answer's linguistic accuracy, including grammar, vocabulary choice, spelling, punctuation, and structure. Judge the severity and frequency of errors in these areas (e.g., poor structure, grammatical weaknesses, spelling mistakes, misused words).
Identify and list every error individually and sequentially as it appears in the student's response. Document each instance distinctly, including repetitions.
Do not grade the student's answer. Tell the students to wait for the teacher's marking.


*Output it all in Vietnamese.*
Format the output depending on the conditions below (I included examples):

Bạn hãy chờ giáo viên chấm điểm nhé. Sau đây là một số nhận xét để bạn tham khảo:

 then `;

                correctAnswerPointsQuery = `{"correctAnswerPoints":"score of the answer","correct":"true or false","reason":"1. Yêu cầu & Mức độ dễ hiểu
[Nhận xét về từng yêu cầu]

2.Ngữ pháp & Từ vựng
[*Lỗi dùng từ hoặc chính tả*, sửa lỗi, không cần giải thích. Ví dụ: becaus → because]
[*Lỗi cấu trúc hoặc dấu câu*, sửa lỗi, và giải thích rõ ràng để học sinh học hỏi. Ví dụ: more tall → taller: tính từ một âm tiết dùng đuôi ER ở dạng so sánh hơn.]
If the student's answer is over 100 words. 
Add this section: 

3. Vấn đề nổi bật [*Vấn đề nghiêm trọng hoặc lặp lại liên tục*]"}\n`;
              } else if (question.check === 'short-answer') {
                checkQuery = `## [Done] Prompt chấm điểm cho các câu đọc, nghe, ngữ pháp, từ vựng

*AI Behavior:
You are an expert English language examiner applying rigorous standards. Be meticulous, literal, concise, direct, objective, and professional. Maintain strictness, reject leniency, and expect only perfect answers.*

Award 100% only for answers meeting all requirements (question, teacher) with perfect grammar and lexis. Award 0% for answers failing core requirements. For all others, deduct points proportionally for unmet requirements or errors (factual/linguistic), ensuring deductions match error severity. Minor errors outside core requirements receive minimal deductions. Provide clear, understandable feedback. Remember: Specific task requirements (phrasing/format) supersede general linguistic standards.
Should a response contain answers to multiple distinct questions, assess each part separately and rigorously based on the criteria for the question it addresses.
Give your brief comment for each of the student's answers


Output it in Vietnamese in the format below:

[Your comment here]

If the answer that doesn't meet the question's or teacher's requirements or is grammatically or lexically inaccurate, add this: Câu trả lời đúng: [Give them the correct answer, a simple explanation in form of a sentence or two. Don't mention the teacher's answer in your explanation]

Tổng điểm: …/….

`;

                correctAnswerPointsQuery = `{"correctAnswerPoints":"score of the answer","correct":"true or false","reason":"Always give a comment. For the answer that doesn't meet the question's or teacher's requirements or is grammatically or lexically inaccurate, g*ive them the correct answer, a simple explanation in form of a sentence or two and Final score: …/…. Don't mention the teacher's answer in your explanation. ***Output it all in Vietnamese**"}\n`;
              }

              if (question.check === 'none') {
                checkQuery = `Check and explain the answer then `;
              }

              //               Check the student answer and score it ranging from 0 to [your code]
              // Check the student answer versus the key points provided by the teacher and score it ranging from 0 to

              const inquiryPoints = isEmpty(originalAnswer)
                ? `Check the student answer and score it ranging from 0 to ${category.points} strictly and sum up the points in reason object.\n`
                : `Check the student answer versus the key points provided by the teacher and score it ranging from 0 to ${category.points} strictly and sum up the points in reason object.\n`;

              promptQuery =
                promptQuery +
                `\nTeacher Answer: ${originalAnswer}\n` +
                `Student Answer: ${attendeeAnswer}\n` +
                checkQuery +
                `Make sure to format the reason with this JSON Schema. \n` +
                correctAnswerPointsQuery +
                inquiryPoints;

              console.log('promptQuery', promptQuery);

              // console.log('promptQuery>>', promptQuery);
              // const openAITaskPrompt = null;

              const openAITaskPrompt = await OpenAITaskPrompt(promptQuery);

              // const openAITaskPrompt: { role: any; content: any } = {
              //   role: '',
              //   content: {
              //     correctAnswerPoints: '0',
              //     correct: 'false',
              //     conclusion:
              //       'The student answer is incorrect as it only provides a partial definition of acid precipitation. It fails to mention that acid precipitation can also include snow and fog with a pH lower than uncontaminated rain.',
              //   },
              // }; // comment for testing

              if (!isEmpty(openAITaskPrompt)) {
                console.log('openAITaskPrompt', openAITaskPrompt.content);

                const openAIReview: { correctAnswerPoints: string; correct: string; reason: string } = JSON.parse(openAITaskPrompt.content);
                // console.log('openAITaskPrompt JSON', openAIReview);

                // const openAIReview: { correctAnswerPoints: string; correct: string; conclusion: string } = openAITaskPrompt.content;
                // console.log('openAITaskPrompt JSON', openAIReview);

                // const correctAnswer = openAIReview.correct === 'true';
                const reviewerScore = parseFloat(openAIReview.correctAnswerPoints) > 0 ? parseFloat(openAIReview.correctAnswerPoints) : 0;

                reviewAnswerQuery['reviewerScore'] = reviewerScore; // it can be a percentage 4.5
                // reviewAnswerQuery['attendeeScore'] = reviewerScore > 0 ? 1 : 0; // 1/0 only
                reviewAnswerQuery['conclusion'] = openAIReview.reason;
                reviewAnswerQuery['reviewStatus'] = 'completed';
              } else {
                console.log('error in open ai');
                reviewAnswerQuery['reviewerScore'] = 0; // it can be a percentage 4.5
                // reviewAnswerQuery['attendeeScore'] = 0; // 1/0 only
                reviewAnswerQuery['conclusion'] = null;
                reviewAnswerQuery['reviewStatus'] = 'pending';
              }
            } else {
              // manual reviewer will do
              console.log('manual review', review);
              if (!isEmpty(attendeeAnswer)) {
                const reviewerScore = review.reviewerScore ? (parseFloat(review.reviewerScore) > 0 ? parseFloat(review.reviewerScore) : 0) : 0;
                reviewAnswerQuery['reviewerScore'] = reviewerScore > 0 ? reviewerScore : 0; // it can be a percentage 4.5
                // reviewAnswerQuery['attendeeScore'] = reviewerScore > 0 ? 1 : 0; // 1/0 only
                reviewAnswerQuery['conclusion'] = review.conclusion;
                reviewAnswerQuery['reviewStatus'] = 'completed';
              }
            }
          }
        }
      }
      return reviewAnswerQuery;
    } catch (error) {
      console.log('errr', error);
      return null;
    }
  }

  public async participantSubmissionsByTask(taskId: string, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const tasksSubmissions = await this.tasksSubmissions.find({
        'task._id': taskId,
        participant: tokenPayload.accountId,
        // properties: tokenPayload.propertyId,
        // propertiesBranches: tokenPayload.branchId,
        deleted: false,
      });

      if (isEmpty(tasksSubmissions)) {
        return ResponseHandlerService({
          success: false,
          httpCode: HttpStatus.NOT_FOUND,
          statusCode: STATUS_CODE.NOT_FOUND,
          message: 'No result(s) found',
        });
      }

      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.OK,
        statusCode: STATUS_CODE.HAS_DATA,
        data: tasksSubmissions,
      });
    } catch (error) {
      return ResponseHandlerService({
        success: false,
        httpCode: HttpStatus.INTERNAL_SERVER_ERROR,
        statusCode: STATUS_CODE.INTERNAL_SERVER_ERROR,
        message: 'Unable to process your data',
        errorDetails: error,
      });
    }
  }

  public async deleteSubmissions(taskId: string, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      await this.tasksSubmissions.deleteOne({
        _id: taskId,
        // properties: tokenPayload.propertyId,
      });

      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.OK,
        statusCode: STATUS_CODE.HAS_DATA,
        data: 'Successfully deleted',
      });
    } catch (error) {
      return ResponseHandlerService({
        success: false,
        httpCode: HttpStatus.INTERNAL_SERVER_ERROR,
        statusCode: STATUS_CODE.INTERNAL_SERVER_ERROR,
        message: 'Unable to process your data',
        errorDetails: error,
      });
    }
  }

  public async participantSubmissions(tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const tasksSubmissions = await this.tasksSubmissions.find({
        participant: tokenPayload.accountId,
        // properties: tokenPayload.propertyId,
        // propertiesBranches: tokenPayload.branchId,
        deleted: false,
      });

      if (isEmpty(tasksSubmissions)) {
        return ResponseHandlerService({
          success: false,
          httpCode: HttpStatus.NOT_FOUND,
          statusCode: STATUS_CODE.NOT_FOUND,
          message: 'No result(s) found',
        });
      }

      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.OK,
        statusCode: STATUS_CODE.HAS_DATA,
        data: tasksSubmissions,
      });
    } catch (error) {
      return ResponseHandlerService({
        success: false,
        httpCode: HttpStatus.INTERNAL_SERVER_ERROR,
        statusCode: STATUS_CODE.INTERNAL_SERVER_ERROR,
        message: 'Unable to process your data',
        errorDetails: error,
      });
    }
  }
}
