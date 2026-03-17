import { AbstractControl, FormArray, FormControl, FormGroup, Validators } from "@angular/forms";
import { Task } from "@isms-core/interfaces";

export const TaskFormGroup = (): FormGroup => {
  return new FormGroup({
    _id: new FormControl(null),
    status: new FormControl(null),
    mode: new FormControl(null),
    course: new FormControl(null),
    class: new FormControl(null),
    createdAt: new FormControl(null),
    generalInfo: new FormGroup({
      type: new FormControl("challenge", [Validators.required]), // challenge/homework
      title: new FormControl(null, [Validators.required]),
      passing: new FormControl(0, [Validators.required]),
      instances: new FormControl(0, [Validators.required]),
      duration: new FormGroup({
        noExpiration: new FormControl(false, [Validators.required]),
        value: new FormControl(0, [Validators.required]),
        type: new FormControl("minute", [Validators.required]),
      }),
      expand: new FormControl(true, [Validators.required]),
    }),
    assignee: new FormGroup({
      reviewers: new FormControl([], [Validators.required]),
      participants: new FormArray([]),
      expand: new FormControl(true, [Validators.required]),
    }),
    categories: new FormArray([]),
    // Editing
    editing: new FormGroup({
      categoryIndex: new FormControl(0, [Validators.required]),
      questionIndex: new FormControl(0, [Validators.required]),
    }),
  });
};

export const CategoryFormGroup = (): FormGroup => {
  return new FormGroup({
    id: new FormControl(null),
    title: new FormControl(null, [Validators.required]),
    points: new FormControl(null, [Validators.required]),
    questions: new FormArray([]),
  });
};

export const QuestionFormGroup = (): FormGroup => {
  return new FormGroup({
    expand: new FormControl(false),
    id: new FormControl(null),
    title: new FormControl(null, [Validators.required]),
    description: new FormControl(null),
    type: new FormControl("fill-in"), // fill-in, choices
    choices: new FormArray([]),
    // fillIn: new FormControl(null),
    originalAnswer: new FormControl(null), // id if choices or text if fill-in
    attendeeAnswer: new FormControl(null), // only if attendee already answer

    fillInScore: new FormControl(0), // use for type=fill-in
    // enableOpenAI: new FormControl(false),
    check: new FormControl("none"),
    reviewerAnswer: new FormControl(null), // answer of reviewer
    conclusion: new FormControl(null), // contain an explanation and reason of reviewer on the attendee answer (it can be AI/teacher)

    reviewerScore: new FormControl(0), // the score of reviewer
    // attendeeScore: new FormControl(0), // the computed score as per the reviewer score
    reviewStatus: new FormControl("pending"), // use to identify of specific question if already reviewed, pending/completed,
  });
};

export const ChoiceFormGroup = (): FormGroup => {
  return new FormGroup({
    id: new FormControl(null),
    value: new FormControl(null, [Validators.required]),
  });
};

export const ParticipantFormGroup = (): FormGroup => {
  return new FormGroup({
    id: new FormControl(null), // id of user/group
    type: new FormControl(null, [Validators.required]), // group/user
  });
};

export const SetTaskFormGroup = (formGroup: AbstractControl, task: Task, expand: boolean): void => {
  console.log("task", task);
  formGroup.get("_id").setValue(task._id, { emitEvent: false });
  formGroup.get("status").setValue(task.status || "unpublished", { emitEvent: false });
  formGroup.get("mode").setValue(task.mode || "training", { emitEvent: false });
  formGroup.get("course").setValue(task.course || null, { emitEvent: false });
  formGroup.get("class").setValue(task.class || null, { emitEvent: false });
  formGroup.get("createdAt").setValue(task.createdAt || null, { emitEvent: false });

  formGroup.get("generalInfo").get("type").setValue(task.generalInfo.type, { emitEvent: false });
  formGroup.get("generalInfo").get("title").setValue(task.generalInfo.title, { emitEvent: false });
  formGroup.get("generalInfo").get("passing").setValue(task.generalInfo.passing, { emitEvent: false });
  formGroup
    .get("generalInfo")
    .get("instances")
    .setValue(task.generalInfo.instances || 0, { emitEvent: false });

  formGroup.get("generalInfo").get("duration").get("noExpiration").setValue(task.generalInfo.duration.noExpiration, { emitEvent: false });
  formGroup.get("generalInfo").get("duration").get("type").setValue(task.generalInfo.duration.type, { emitEvent: false });
  formGroup.get("generalInfo").get("duration").get("value").setValue(task.generalInfo.duration.value, { emitEvent: false });

  const categoriesFormArray = formGroup.get("categories") as FormArray;
  categoriesFormArray.clear({ emitEvent: false });
  task.categories.forEach((category) => {
    const categoryFormGroup = CategoryFormGroup();
    categoryFormGroup.get("id").setValue(category.id);
    categoryFormGroup.get("title").setValue(category.title);
    categoryFormGroup.get("points").setValue(category.points);

    const questionsFormArray = categoryFormGroup.get("questions") as FormArray;
    questionsFormArray.clear({ emitEvent: false });
    category.questions.forEach((question) => {
      const questionFormGroup = QuestionFormGroup();
      questionFormGroup.get("expand").setValue(expand);
      questionFormGroup.get("id").setValue(question.id);
      questionFormGroup.get("type").setValue(question.type);
      questionFormGroup.get("title").setValue(question.title);
      questionFormGroup.get("description").setValue(question.description);

      questionFormGroup.get("fillInScore").setValue(question.fillInScore);
      // questionFormGroup.get("enableOpenAI").setValue(question.enableOpenAI);
      questionFormGroup.get("check").setValue(question.check);

      questionFormGroup.get("originalAnswer").setValue(question.originalAnswer);
      questionFormGroup.get("attendeeAnswer").setValue(question.attendeeAnswer);

      questionFormGroup.get("reviewerAnswer").setValue(question.reviewerAnswer);
      questionFormGroup.get("conclusion").setValue(question.conclusion);
      questionFormGroup.get("reviewerScore").setValue(question?.reviewerScore || 0);
      // questionFormGroup.get("attendeeScore").setValue(question.attendeeScore);
      questionFormGroup.get("reviewStatus").setValue(question.reviewStatus);

      const choicesFormArray = questionFormGroup.get("choices") as FormArray;
      choicesFormArray.clear({ emitEvent: false });

      if ("choices" in question) {
        question.choices.forEach((choice) => {
          const choiceFormGroup = ChoiceFormGroup();
          choiceFormGroup.get("id").setValue(choice.id);
          choiceFormGroup.get("value").setValue(choice.value);
          choicesFormArray.push(choiceFormGroup);
        });
        questionsFormArray.push(questionFormGroup);
      }
    });
    categoriesFormArray.push(categoryFormGroup, { emitEvent: false });
  });

  formGroup.get("assignee").get("reviewers").setValue(task.assignee.reviewers, { emitEvent: false });

  const participantsFormArray = formGroup.get("assignee").get("participants") as FormArray;
  participantsFormArray.clear({ emitEvent: false });
  task.assignee.participants.forEach((participant) => {
    participantsFormArray.push(
      new FormGroup({
        id: new FormControl(participant.id),
        type: new FormControl(participant.type, [Validators.required]),
      }),
      { emitEvent: false }
    );
  });
};

export const UploadTaskFormGroup = (): FormGroup => {
  return new FormGroup({
    type: new FormControl(null, [Validators.required]),
    title: new FormControl(null, [Validators.required]),
  });
};
