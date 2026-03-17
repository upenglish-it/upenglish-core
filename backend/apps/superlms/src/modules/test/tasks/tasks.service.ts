// NestJs imports
import { isEmpty } from 'lodash';
import { InjectModel } from 'nestjs-typegoose';
import { ReturnModelType } from '@typegoose/typegoose';
import { HttpStatus, Injectable } from '@nestjs/common';
// DTO's
import {
  AddNotesInTimelineDTO,
  CreateTaskDTO,
  QueryGetByIdDTO,
  QueryUpdateByIdDTO,
  ListsDTO,
  StudentSubmitTaskDTO,
  TeacherMarkAsReviewedTaskDTO,
  UpdateByIdTaskDTO,
} from './dto';
// Commons
import {
  SYSTEM_ID,
  IELTSTasks,
  STATUS_CODE,
  IELTSPrompts,
  SuperLMSAIPrompt,
  IAuthTokenPayload,
  PaginationFieldsU,
  PaginationService,
  SuperLMSPromptComposer,
  IResponseHandlerParams,
  ResponseHandlerService,
  SuperLMSAIPromptSpeaking,
  SuperLMSPromptComposerSpeaking,
  IELTSTestsOfClassPeriodsSections,
  IELTSTestsOfClassPeriodsSectionsTests,
  IELTSTestsOfClassPeriodsSectionsTestsStudent,
  IELTSTestsOfClassPeriodsSectionsTestsTimeline,
} from 'apps/common';

@Injectable()
export class TasksService {
  constructor(
    @InjectModel(IELTSTasks) private readonly tasks: ReturnModelType<typeof IELTSTasks>,
    @InjectModel(IELTSPrompts) private readonly prompts: ReturnModelType<typeof IELTSPrompts>,
    @InjectModel(IELTSTestsOfClassPeriodsSections)
    private readonly testsOfClassPeriodsSections: ReturnModelType<typeof IELTSTestsOfClassPeriodsSections>,
    @InjectModel(IELTSTestsOfClassPeriodsSectionsTests)
    private readonly testsOfClassPeriodsSectionsTests: ReturnModelType<typeof IELTSTestsOfClassPeriodsSectionsTests>,
    @InjectModel(IELTSTestsOfClassPeriodsSectionsTestsTimeline)
    private readonly testsOfClassPeriodsSectionsTestsTimeline: ReturnModelType<typeof IELTSTestsOfClassPeriodsSectionsTestsTimeline>,
    @InjectModel(IELTSTestsOfClassPeriodsSectionsTestsStudent)
    private readonly testsOfClassPeriodsSectionsTestsStudent: ReturnModelType<typeof IELTSTestsOfClassPeriodsSectionsTestsStudent>
  ) {}

  public async create(body: CreateTaskDTO, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const createdTask = await this.tasks.create({
        name: body.name,
        type: body.type,
        variations: [
          {
            id: SYSTEM_ID(),
            parts: [{ id: SYSTEM_ID(), description: '', showLeftPanel: true, items: [] }],
          },
        ],
        createdBy: tokenPayload.accountId,
        properties: tokenPayload.propertyId,
        propertiesBranches: tokenPayload.branchId,
      });
      console.log('createdTask', createdTask);
      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.OK,
        statusCode: STATUS_CODE.DATA_CREATED,
        message: 'Successfully created',
        data: createdTask,
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

  public async getAll(query: ListsDTO, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const { page, limit } = query;
      const tasks = await this.tasks.aggregate([
        {
          $match: {
            properties: tokenPayload.propertyId,
          },
        },
        {
          $project: {
            name: 1,
            type: 1,
            createdAt: 1,
          },
        },
        ...PaginationFieldsU(page, limit),
      ]);

      if (isEmpty(tasks[0]?.items)) {
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
        data: PaginationService(tasks[0]),
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

  public async getById(taskId: string, query: QueryGetByIdDTO, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      let task = null;

      if (query.type === 'template') {
        task = await this.tasks.findOne({ _id: taskId });
      }

      if (query.type === 'test') {
        // Admin or teacher viewing the original section test / task
        if ((query.mode === 'viewing' && query.action === 'builder-editing') || (query.mode === 'editing' && query.action === 'builder-editing')) {
          const test = await this.testsOfClassPeriodsSectionsTests.findOne({ _id: taskId });
          task = test.test;
        }

        // Student viewing the copied section test document
        if (query.mode === 'viewing' && query.action === 'student-viewing-results') {
          const test = await this.testsOfClassPeriodsSectionsTestsStudent.findOne({ _id: taskId });
          task = test.test;
        }

        // Student viewing and answering a test
        if (query.mode === 'viewing' && query.action === 'student-answering') {
          // Checks if original test is copied
          const isTaskStudentExists = await this.testsOfClassPeriodsSectionsTestsStudent.findOne({ _id: taskId }).lean();

          if (isEmpty(isTaskStudentExists)) {
            // Get the original test
            task = await this.testsOfClassPeriodsSectionsTests.findOne({ _id: taskId });

            // Create a copy of test from original test
            const copiedTest = await this.testsOfClassPeriodsSectionsTestsStudent.findOneAndUpdate(
              { _id: taskId, studentId: tokenPayload.accountId },
              { $set: { ...task, studentId: tokenPayload.accountId } },
              { upsert: true, new: true }
            );

            // Assign the copiedTest test to the task variable
            task = copiedTest;
          } else {
            // Assign the isTaskStudentExists to the task variable
            task = isTaskStudentExists;
          }
        }
      }

      if (isEmpty(task)) {
        return ResponseHandlerService({
          success: false,
          httpCode: HttpStatus.NOT_FOUND,
          statusCode: STATUS_CODE.NOT_FOUND,
          message: 'No result(s) found',
        });
      }

      // Student viewing and answering a test
      if (query.type === 'test' && query.mode === 'viewing' && query.action === 'student-answering') {
        // Shuffles the test variation and pick only one
        const variations = task.test.variations;
        const randomIndex = Math.floor(Math.random() * variations.length);
        const selectedVariation = variations[randomIndex];

        task = {
          ...task.test,
          teacherReviewed: false,
          variations: [selectedVariation],
        };
      }

      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.OK,
        statusCode: STATUS_CODE.HAS_DATA,
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

  public async updateById(
    testId: string,
    query: QueryUpdateByIdDTO,
    body: UpdateByIdTaskDTO,
    tokenPayload: IAuthTokenPayload
  ): Promise<IResponseHandlerParams> {
    try {
      if (query.type === 'template') {
        // Teacher or admin make changes to template task
        if ((query.mode === 'editing', query.action === 'builder-editing')) {
          // This updates the existing section test by task id
          this.testsOfClassPeriodsSectionsTests
            .updateOne(
              {
                'test._id': testId,
              },
              {
                $set: {
                  'test.name': body.name,
                  'test.type': body.type,
                  'test.duration': body.duration,
                  'test.testselectedVariationIndex': body.selectedVariationIndex,
                  'test.selectedPartIndex': body.selectedPartIndex,
                  'test.variations': body.variations,
                },
              }
            )
            .then();

          // This updates the task by id
          await this.tasks.findOneAndUpdate(
            { _id: testId },
            {
              $set: {
                name: body.name,
                type: body.type,
                duration: body.duration,
                selectedVariationIndex: body.selectedVariationIndex,
                selectedPartIndex: body.selectedPartIndex,
                variations: body.variations,
              },
            }
          );
        }
      }

      if (query.type === 'test') {
        // Admin or teacher editing section test specific task
        if ((query.mode === 'editing', query.action === 'builder-editing')) {
          // This updates the section test's task
          const updatedTest = await this.testsOfClassPeriodsSectionsTests.findOneAndUpdate(
            { _id: testId },
            {
              $set: {
                'test.name': body.name,
                'test.type': body.type,
                'test.duration': body.duration,
                'test.testselectedVariationIndex': body.selectedVariationIndex,
                'test.selectedPartIndex': body.selectedPartIndex,
                'test.variations': body.variations,
              },
            }
          );

          /**
           * This updates the original task.
           * This way both original task and section test task are synced.
           */
          this.tasks
            .updateOne(
              { _id: updatedTest.test._id },
              {
                $set: {
                  name: body.name,
                  type: body.type,
                  duration: body.duration,
                  selectedVariationIndex: body.selectedVariationIndex,
                  selectedPartIndex: body.selectedPartIndex,
                  variations: body.variations,
                },
              }
            )
            .then();
        }

        // Student Answering
        if ((query.mode === 'viewing', query.action === 'student-answering')) {
          // Update only the task or copied task
          await this.testsOfClassPeriodsSectionsTestsStudent.findOneAndUpdate(
            { _id: testId },
            {
              $set: {
                'test.name': body.name,
                'test.type': body.type,
                'test.duration': body.duration,
                'test.testselectedVariationIndex': body.selectedVariationIndex,
                'test.selectedPartIndex': body.selectedPartIndex,
                'test.variations': body.variations,
              },
            }
          );
        }
      }

      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.OK,
        statusCode: STATUS_CODE.DATA_CREATED,
        message: 'Successfully created',
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

  public async deleteById(taskId: string, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      await this.tasks.deleteOne({ _id: taskId, properties: tokenPayload.propertyId });

      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.OK,
        statusCode: STATUS_CODE.DATA_DELETED,
        message: 'Successfully deleted',
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

  public async studentSubmitTask(body: StudentSubmitTaskDTO): Promise<IResponseHandlerParams> {
    try {
      const originalTask = await this.testsOfClassPeriodsSectionsTestsStudent.findOne({ _id: body.taskId });

      const task = originalTask.toJSON();

      task.test.submittedDate = new Date().toISOString();

      await Promise.all(
        task.test.variations.map(async (variation) => {
          await Promise.all(
            variation.parts.map(async (part) => {
              await Promise.all(
                part.items.map(async (item) => {
                  let reviewed = false;
                  let score = 0;
                  let reviewerAnswer = null;

                  let ieltsWritingResult = null;
                  if (item.type === 'choice') {
                    reviewed = true;
                    score = item.originalAnswer === item.participantAnswer ? item.points : 0;
                  }

                  if (item.type === 'box-ticking') {
                    const totalBoxTickingRows = item.boxTickingRows.length;

                    item.boxTickingRows.forEach((row, i) => {
                      const index = i + 1;

                      if (row.originalAnswer === row.participantAnswer) {
                        score += row.points;
                      }

                      if (totalBoxTickingRows === index) {
                        reviewed = true;
                      }
                    });
                  }

                  if (item.type === 'fill-in') {
                    //--- The teacher will mark the score
                  }

                  if (item.type === 'fill-in-input') {
                    const fillInputBlanks = item.fillInputBlanks;

                    fillInputBlanks.forEach((blank, i) => {
                      if (!blank.participantAnswer) return;

                      const index = i + 1;

                      let correctAnswer = Array.isArray(blank.correctAnswers) ? blank.correctAnswers : [blank.correctAnswers];

                      let participantAnswer = blank.participantAnswer.trim();

                      if (!blank.caseSensitive) {
                        participantAnswer = participantAnswer.toLowerCase();
                        correctAnswer = correctAnswer.map((answer) => answer.toLowerCase());
                      }

                      if (correctAnswer.includes(participantAnswer)) {
                        score += blank.points;
                      }

                      if (fillInputBlanks.length === index) {
                        reviewed = true;
                      }
                    });
                  }

                  if (item.type === 'drag-to-fill') {
                    const dragToFillBlanks = item.dragToFillBlanks;

                    dragToFillBlanks.forEach((blank, i) => {
                      if (!blank.participantAnswer) return;

                      const index = i + 1;

                      let correctAnswer = Array.isArray(blank.correctAnswers) ? blank.correctAnswers : [blank.correctAnswers];

                      let participantAnswer = blank.participantAnswer.trim();

                      if (!blank.caseSensitive) {
                        participantAnswer = participantAnswer.toLowerCase();
                        correctAnswer = correctAnswer.map((answer) => answer.toLowerCase());
                      }

                      if (correctAnswer.includes(participantAnswer)) {
                        score += blank.points;
                      }

                      if (dragToFillBlanks.length === index) {
                        reviewed = true;
                      }
                    });
                  }

                  if (item.type === 'drag-drop') {
                    //--- The system will mark the score in frontend side but server side we just mark as reviewed
                    reviewed = true;
                  }

                  if (item.type === 'speaking') {
                    //--- The teacher will mark the score
                  }

                  if (item.type === 'ielts-writing') {
                    //--- AI will answer the question

                    const essay = part.description;
                    const question = item.ieltsWriting;

                    const participantAnswer = item.participantAnswer;

                    const originalAnswer = item.originalAnswer;

                    const prompt = await this.prompts.findOne({ _id: item.aiPrompt._id });
                    const promptText = SuperLMSPromptComposer({
                      essay: essay,
                      question: question,
                      studentAnswer: participantAnswer,
                      originalAnswer: originalAnswer,
                      scoreRangeFrom: 0,
                      scoreRangeTo: item.points,
                      prompt: prompt.message,
                    });

                    const aiResponse = await SuperLMSAIPrompt(promptText, prompt);

                    if (!isEmpty(aiResponse)) {
                      reviewed = false;
                      score = aiResponse.score;
                      reviewerAnswer = aiResponse.feedback;

                      ieltsWritingResult = {
                        taskResponseBand: aiResponse.taskResponseBand,
                        coherenceCohesionBand: aiResponse.coherenceCohesionBand,
                        lexicalResourceBand: aiResponse.lexicalResourceBand,
                        grammarBand: aiResponse.grammarBand,
                      };
                    } else {
                      ieltsWritingResult = {
                        taskResponseBand: 0,
                        coherenceCohesionBand: 0,
                        lexicalResourceBand: 0,
                        grammarBand: 0,
                      };
                    }
                  }

                  if (item.type === 'ielts-speaking') {
                    //--- AI will answer the question

                    const originalAnswer = item.originalAnswer;

                    if (!isEmpty(item.speaking) && !isEmpty(item.participantAnswer)) {
                      const prompt = await this.prompts.findOne({ _id: item.aiPrompt._id });
                      const promptText = SuperLMSPromptComposerSpeaking({
                        originalAnswer: originalAnswer,
                        scoreRangeFrom: 0,
                        scoreRangeTo: item.points,
                        prompt: prompt.message,
                      });

                      const teacherBase64Audio = await audioUrlToBase64(item.speaking);
                      const studentBase64Audio = await audioUrlToBase64(item.participantAnswer);

                      const aiResponse = await SuperLMSAIPromptSpeaking(promptText, teacherBase64Audio, studentBase64Audio, prompt);

                      console.log('ielts-speaking ai ', aiResponse);

                      if (aiResponse) {
                        reviewed = true;
                        score = aiResponse.score;
                        reviewerAnswer = aiResponse.feedback;
                        ieltsWritingResult = {
                          taskResponseBand: aiResponse.taskResponseBand,
                          coherenceCohesionBand: aiResponse.coherenceCohesionBand,
                          lexicalResourceBand: aiResponse.lexicalResourceBand,
                          grammarBand: aiResponse.grammarBand,
                        };
                      }
                    } else {
                      ieltsWritingResult = {
                        taskResponseBand: 0,
                        coherenceCohesionBand: 0,
                        lexicalResourceBand: 0,
                        grammarBand: 0,
                      };
                    }
                  }

                  //--- Use for IELTS Writing Only
                  if (ieltsWritingResult) {
                    item['ieltsWritingResult'] = ieltsWritingResult;
                  }

                  if (reviewerAnswer) {
                    item['reviewerAnswer'] = reviewerAnswer;
                  }

                  item['reviewed'] = reviewed;
                  item['score'] = score;

                  return item;
                })
              );

              return part;
            })
          );

          return variation;
        })
      );

      const updatedTask = await this.testsOfClassPeriodsSectionsTestsStudent.findOneAndUpdate(
        { _id: body.taskId },
        {
          $set: {
            test: task.test,
          },
        },
        { new: true }
      );

      //--- Just checking if all items are reviewed that means all are completed and ready to add a note.
      // let remainingTestToReview = 0;
      // updatedTask.test.variations.forEach(async (variation) => {
      //   variation.parts.forEach(async (part) => {
      //     part.items.forEach(async (item) => {
      //       remainingTestToReview += !item.reviewed ? 1 : 0;
      //     });
      //   });
      // });
      // if (remainingTestToReview === 0) {
      //   await this.addTaskTimeline(updatedTask.test, 'task', updatedTask.class);
      // }

      //--- Check if all are mini test are reviewed.
      this.updatePeriodSectionReviewed(updatedTask.testsOfClassPeriodSectionId);

      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.OK,
        statusCode: STATUS_CODE.OK,
        message: 'Successfully submitted',
        data: updatedTask,
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

  public async teacherMarkTaskAsReviewed(body: TeacherMarkAsReviewedTaskDTO): Promise<IResponseHandlerParams> {
    try {
      const originalTask = await this.testsOfClassPeriodsSectionsTestsStudent.findOne({ _id: body.taskId });

      const task = originalTask.toJSON();

      task.test.submittedDate = new Date().toISOString();

      task.test.variations.map((variation) => {
        variation.parts.map((part) => {
          part.items.map((item) => {
            if (isEmpty(item.reviewed)) {
              item['reviewed'] = true;
            }
            return item;
          });

          return part;
        });

        return variation;
      });

      const updatedTask = await this.testsOfClassPeriodsSectionsTestsStudent.findOneAndUpdate(
        { _id: body.taskId },
        {
          $set: {
            test: task.test,
            reviewed: true,
            teacherReviewed: true,
          },
        },
        { new: true }
      );

      //--- Check if all are mini test are reviewed.
      this.updatePeriodSectionReviewed(updatedTask.testsOfClassPeriodSectionId);

      // this.addTaskTimeline(task.test, 'task', updatedTask.class);

      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.OK,
        statusCode: STATUS_CODE.OK,
        message: 'Successfully submitted',
        data: updatedTask,
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

  public async updatePeriodSectionReviewed(sectionId: string): Promise<IResponseHandlerParams> {
    try {
      const periodsSectionsTests = await this.testsOfClassPeriodsSectionsTests.countDocuments({
        testsOfClassPeriodSectionId: sectionId,
        'test.variations.parts.items.reviewed': false,
      });

      //--- If all tests are reviewed then we can mark the section as reviewed.
      if (periodsSectionsTests === 0) {
        const periodsSection = await this.testsOfClassPeriodsSections
          .findOneAndUpdate({ _id: sectionId }, { $set: { reviewed: true } }, { new: true })
          .then();

        //--- Add the timeline entry
        const completedTests = await this.testsOfClassPeriodsSectionsTests.find({
          testsOfClassPeriodSectionId: sectionId,
        });
        this.testsOfClassPeriodsSectionsTestsTimeline
          .create({
            type: 'task',
            tests: completedTests.map((ct) => ct.test),
            periodsSection: periodsSection,
            class: periodsSection.class,
          })
          .then();
      }

      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.OK,
        statusCode: STATUS_CODE.OK,
        message: 'Successfully created',
        // data: timeline,
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

  public async addNotesInTimeline(body: AddNotesInTimelineDTO): Promise<IResponseHandlerParams> {
    try {
      await this.addTaskTimeline(body.notes, 'notes', body.classId);

      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.OK,
        statusCode: STATUS_CODE.OK,
        message: 'Successfully added',
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

  public async addTaskTimeline(body: any, type: 'notes' | 'task', classId: string): Promise<IResponseHandlerParams> {
    try {
      const timeline = await this.testsOfClassPeriodsSectionsTestsTimeline.create({
        type: type,
        ...(type === 'notes' ? { notes: body } : { test: body }),
        class: classId,
      });

      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.OK,
        statusCode: STATUS_CODE.OK,
        message: 'Successfully created',
        data: timeline,
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

  public async getAllTimelineByClassId(query: ListsDTO, classId: string): Promise<IResponseHandlerParams> {
    try {
      const page = typeof query.page === 'string' ? parseInt(query.page) : query.page;
      const limit = typeof query.limit === 'string' ? parseInt(query.limit) : query.limit;

      const timeline = await this.testsOfClassPeriodsSectionsTestsTimeline.aggregate([
        {
          $match: { class: classId, 'periodsSection.type': { $ne: 'assignment' } },
        },
        ...PaginationFieldsU(page, limit),
      ]);

      if (isEmpty(timeline[0]?.items)) {
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
        statusCode: STATUS_CODE.OK,
        data: PaginationService(timeline[0]),
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

const audioUrlToBase64 = async (url: string): Promise<string> => {
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`Failed to fetch audio: ${res.status}`);
  }

  const buffer = Buffer.from(await res.arrayBuffer());

  // IMPORTANT: return pure base64 (no data: prefix)
  return buffer.toString('base64');
};
