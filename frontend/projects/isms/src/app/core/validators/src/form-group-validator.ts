import { AbstractControl, FormGroup, ValidationErrors, ValidatorFn } from "@angular/forms";

export const FormGroupValidator = {
  isEmailAddress: (control: AbstractControl): ValidationErrors => {
    if (control && control.value !== null && control.value !== undefined) {
      if (control.value.length >= 1) {
        const emailRegex: boolean = /^([a-zA-Z0-9_.-])+\@(([a-zA-Z0-9-])+\.)+([a-zA-Z0-9]{2,4})+$/.test(control.value.toLowerCase());
        return !emailRegex ? { isEmailAddress: true } : null;
      }
    }
    return null;
  },

  confirmPassword: (controlName: string, matchingControlName: string): any => {
    return (formGroup: FormGroup) => {
      let control = formGroup.controls[controlName];
      let matchingControl = formGroup.controls[matchingControlName];
      if (matchingControl.errors && !matchingControl.errors["confirmPassword"]) {
        return;
      }
      if (control.value !== matchingControl.value) {
        matchingControl.setErrors({ confirmPassword: true });
      } else {
        matchingControl.setErrors(null);
      }
    };
  },
};
