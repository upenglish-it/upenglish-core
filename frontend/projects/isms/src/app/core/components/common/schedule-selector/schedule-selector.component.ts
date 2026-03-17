import { JsonPipe, NgFor, NgIf } from "@angular/common";
import { Component, Input, OnDestroy, OnInit } from "@angular/core";
import { FormGroup, ReactiveFormsModule } from "@angular/forms";
import { Days, Recurrences, TRecurrence } from "@isms-core/constants";
import { INameValue } from "@isms-core/interfaces";
import { ComposedRRule } from "@isms-core/utils";
import { hasProperty } from "dot-prop";
import { NzButtonModule } from "ng-zorro-antd/button";
import { NzDatePickerModule } from "ng-zorro-antd/date-picker";
import { NzDropDownModule } from "ng-zorro-antd/dropdown";
import { NzIconModule } from "ng-zorro-antd/icon";
import { NzInputNumberModule } from "ng-zorro-antd/input-number";
import { NzModalModule } from "ng-zorro-antd/modal";
import { NzRadioModule } from "ng-zorro-antd/radio";
import { NzSelectModule } from "ng-zorro-antd/select";
import { NzSwitchModule } from "ng-zorro-antd/switch";
import { NzTimePickerModule } from "ng-zorro-antd/time-picker";
import { NzToolTipModule } from "ng-zorro-antd/tooltip";
import { Frequency, RRule, RRuleSet, Weekday } from "rrule";
import { SubSink } from "subsink";

@Component({
  selector: "isms-schedule-selector",
  templateUrl: "./schedule-selector.component.html",
  imports: [
    NgIf,
    NgFor,
    JsonPipe,
    ReactiveFormsModule,
    NzDatePickerModule,
    NzTimePickerModule,
    NzSelectModule,
    NzDropDownModule,
    NzButtonModule,
    NzIconModule,
    NzSwitchModule,
    NzModalModule,
    NzToolTipModule,
    NzInputNumberModule,
    NzSelectModule,
    NzRadioModule,
  ],
})
export class ScheduleSelectorComponent implements OnInit, OnDestroy {
  public subSink: SubSink = new SubSink();
  @Input("form-group") formGroup: FormGroup;
  @Input("disable-all-day") disableAllDay: boolean = false;
  public showRecurrenceModal: boolean = true;
  public recurrences: Array<INameValue> = Recurrences;
  public frequencies: Array<INameValue> = [
    {
      name: "day(s)",
      value: Frequency.DAILY,
    },
    {
      name: "week(s)",
      value: Frequency.WEEKLY,
    },
    {
      name: "month(s)",
      value: Frequency.MONTHLY,
    },
    {
      name: "year(s)",
      value: Frequency.YEARLY,
    },
  ];

  public rruleSet: RRuleSet = new RRuleSet();
  public days = Days;

  public ngOnInit(): void {
    this.subSink.add(
      this.formGroup.valueChanges.subscribe((value) => {
        // this.formGroup.get("rRuleOrigOptions").setValue(this.)
      })
    );

    this.subSink.add(
      this.endsFormGroup.get("type").valueChanges.subscribe((value) => {
        // this.onSelectFrequency(value);
        this.endsFormGroup.get("endDate").reset();
        this.endsFormGroup.get("count").reset();
      })
    );

    // console.log("\n\n\n\n???");
    let rrule = new RRule({
      freq: RRule.MONTHLY,
      interval: 2,
      count: 2,
    });

    // console.log(rrule.toText(), rrule.toString());

    rrule = new RRule({
      freq: RRule.WEEKLY,
      interval: 1,
    });

    // console.log(rrule.toText(), rrule.toString());
  }

  public ngOnDestroy(): void {
    this.subSink.unsubscribe();
  }

  public onSelectFrequency(rruleString: TRecurrence): void {
    this.recurrenceFormGroup.reset();

    this.recurrenceFormGroup.get("value").setValue(rruleString);

    if (
      rruleString === "RRULE:FREQ=DAILY;INTERVAL=1" ||
      rruleString === "RRULE:FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,FR" ||
      rruleString === "RRULE:FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,TU,WE,TH,FR" ||
      rruleString === "RRULE:FREQ=WEEKLY;INTERVAL=1;BYDAY=SA,SU"
    ) {
      /* if doest not repeat then disable recurrence */
      this.recurrenceFormGroup.get("enable").setValue(rruleString === this.recurrences[0].value);

      const origOptions = RRule.fromString(rruleString).origOptions;
      console.log("origOptions", origOptions);

      if (
        rruleString === this.recurrences[1].value ||
        rruleString === this.recurrences[2].value ||
        rruleString === this.recurrences[3].value ||
        rruleString === this.recurrences[4].value
      ) {
        this.endsFormGroup.get("type").setValue("never");
      }

      /* count */
      if (hasProperty(origOptions, "count")) {
        this.endsFormGroup.get("count").setValue(origOptions.count);
      }

      /* interval */
      if (hasProperty(origOptions, "interval")) {
        this.recurrenceFormGroup.get("interval").setValue(origOptions.interval);
      }

      /* freq */
      if (hasProperty(origOptions, "freq")) {
        this.recurrenceFormGroup.get("freq").setValue(origOptions.freq);
      }

      /* byweekday */
      if (hasProperty(origOptions, "byweekday")) {
        const byweekday = (origOptions.byweekday as Array<Weekday>).map((wd) => wd.weekday);
        this.recurrenceFormGroup.get("byweekday").setValue(byweekday);
      }
    } else if (rruleString === "do-not-repeat") {
      this.recurrenceFormGroup.get("freq").setValue(null);
      this.recurrenceFormGroup.get("interval").setValue(null);
      this.recurrenceFormGroup.get("byweekday").setValue([]);
      this.recurrenceFormGroup.get("bymonth").setValue([]);
      this.endsFormGroup.reset();
    } else {
      this.recurrenceFormGroup.get("interval").setValue(1);
      this.recurrenceFormGroup.get("freq").setValue(3);
      this.endsFormGroup.get("type").setValue("never");
    }
  }

  public get recurrence(): {
    approximate: RRule;
    nonApproximate: RRule;
  } {
    return ComposedRRule(this.formGroup.value);
  }

  public get recurrenceFormGroup(): FormGroup {
    return this.formGroup.get("recurrence") as FormGroup;
  }

  public get endsFormGroup(): FormGroup {
    return this.recurrenceFormGroup.get("ends") as FormGroup;
  }

  public get recurrenceName(): string {
    return this.recurrences.find((r) => r.value === this.recurrenceFormGroup.value.value)?.name || null;
  }
}
