import { FormControl, FormGroup, Validators } from "@angular/forms";

export const CashflowIncomeFormGroup = (): FormGroup => {
  return new FormGroup({
    _id: new FormControl(null),
    from: new FormControl(null, Validators.required),
    materialId: new FormControl(null),
    studentId: new FormControl(null, Validators.required),
    quantity: new FormControl(1),
    amount: new FormControl(null),
    mode: new FormControl("cash", Validators.required),
    notes: new FormControl(null, Validators.required),
  });
};

export const CashflowExpenseFormGroup = (): FormGroup => {
  return new FormGroup({
    _id: new FormControl(null),
    amount: new FormControl(null, Validators.required),
    notes: new FormControl(null, Validators.required),
    mode: new FormControl("cash", Validators.required),
  });
};
