import { ChangeDetectorRef, Component, ElementRef, Input, OnDestroy, OnInit, ViewChild } from "@angular/core";
import { CdkDragDrop } from "@angular/cdk/drag-drop";
import { NgxTimeSchedulerService } from "../ngx-time-scheduler.service";
import { HeaderDetails, Header, ItemMeta, Item, Period, SectionItem, Section, Text, Events } from "../ngx-time-scheduler.model";
import * as moment from "moment";
import { Subscription, lastValueFrom } from "rxjs";
import { NgClass, NgFor, NgIf } from "@angular/common";
import { NzDatePickerModule } from "ng-zorro-antd/date-picker";
import { NzAvatarModule } from "ng-zorro-antd/avatar";
import { DragDropModule } from "@angular/cdk/drag-drop";
import { NzToolTipModule } from "ng-zorro-antd/tooltip";
import { ManageStaffScheduleDrawerComponent } from "@isms-core/components/schedule/manage-staff-schedule-drawer/manage-staff-schedule-drawer.component";
import { NzButtonModule } from "ng-zorro-antd/button";
import { ProfilePhotoDirective } from "@isms-core/directives";
import { NzIconModule } from "ng-zorro-antd/icon";
import { SetSectionsInSectionItems } from "../common";
import { ManageStaffScheduleShiftDrawerComponent } from "@isms-core/components/schedule/manage-staff-schedule-shift-drawer/manage-staff-schedule-shift-drawer.component";
import { NzInputModule } from "ng-zorro-antd/input";
import { IScheduleSchedulesShift, IScheduleSchedulesShiftNote } from "@isms-core/interfaces";
import { DateTime } from "luxon";
import { NzEmptyModule } from "ng-zorro-antd/empty";
import { FormsModule } from "@angular/forms";
import { NzDividerModule } from "ng-zorro-antd/divider";
import { SchedulesShiftsService } from "@isms-core/services";
import { NzNotificationService } from "ng-zorro-antd/notification";
import { NzBadgeModule } from "ng-zorro-antd/badge";

@Component({
  selector: "isms-staff-scheduler[items][periods][sections]",
  templateUrl: "./staff-scheduler.component.html",
  styleUrls: ["../ngx-time-scheduler.component.scss"],
  imports: [
    NgClass,
    NgIf,
    NgFor,
    FormsModule,
    DragDropModule,
    NzDatePickerModule,
    NzAvatarModule,
    NzToolTipModule,
    NzButtonModule,
    NzInputModule,
    NzIconModule,
    NzEmptyModule,
    NzDividerModule,
    NzBadgeModule,
    ManageStaffScheduleDrawerComponent,
    ManageStaffScheduleShiftDrawerComponent,
    ProfilePhotoDirective,
  ],
})
export class StaffSchedulerComponent implements OnInit, OnDestroy {
  @ViewChild("manageStaffScheduleDrawer") manageStaffScheduleDrawer: ManageStaffScheduleDrawerComponent;

  @Input("view") view: "week" | "week-by-class" | "day";
  public showWeekByClassTooltip: boolean = false;

  @ViewChild("sectionTd") set SectionTd(elementRef: ElementRef) {
    this.SectionLeftMeasure = elementRef.nativeElement.clientWidth + "px";
    this.changeDetector.detectChanges();
  }

  @Input() currentTimeFormat = "DD-MMM-YYYY HH:mm";
  @Input() showCurrentTime = true;
  @Input() showHeaderTitle = true;
  @Input() showActionButtons = true;
  @Input() showGoto = true;
  @Input() showToday = true;
  @Input() allowDragging = false;
  // @Input() allowResizing = false;
  @Input() locale = "";
  @Input() showBusinessDayOnly = false;
  @Input() headerFormat = "MMM DD, yyyy";
  @Input() minRowHeight = 52;
  @Input() maxHeight: string = null;
  @Input() text = new Text();
  @Input() items: Item[];
  @Input() sections: Section[];
  @Input() periods: Period[];
  @Input() events: Events = new Events();
  @Input() start = moment().startOf("week");
  @Input() end = moment().endOf("week");
  showGotoModal = false;
  currentTimeIndicatorPosition: string;
  currentTimeVisibility = "visible";
  currentTimeTitle: string;
  ShowCurrentTimeHandle: any = null;
  SectionLeftMeasure = "0";
  currentPeriod: Period;
  currentPeriodMinuteDiff = 0;
  header: Header[];
  sectionItems: SectionItem[];
  subscription = new Subscription();

  private currentDate = moment().startOf("day");

  constructor(
    private changeDetector: ChangeDetectorRef,
    private service: NgxTimeSchedulerService,
    private readonly schedulesShiftsService: SchedulesShiftsService,
    private readonly nzNotificationService: NzNotificationService
  ) {
    moment.locale(this.locale);
  }

  ngOnInit(): void {
    this.setSectionsInSectionItems();
    this.changePeriod(this.periods[0], false);
    this.itemPush();
    this.itemPop();
    this.itemRemove();
    this.sectionPush();
    this.sectionPop();
    this.sectionRemove();
    this.refresh();
  }

  private refreshView() {
    this.setSectionsInSectionItems();
    this.changePeriod(this.currentPeriod, false);
  }

  trackByFn(index: number, item: any) {
    return index;
  }

  private setSectionsInSectionItems(): void {
    // this.sectionItems = new Array<SectionItem>();
    // this.sections.forEach((section) => {
    //   const perSectionItem = new SectionItem();
    //   perSectionItem.section = section;
    //   perSectionItem.minRowHeight = this.minRowHeight;
    //   this.sectionItems.push(perSectionItem);
    // });
    this.sectionItems = SetSectionsInSectionItems(this.sections, this.minRowHeight);
  }

  private setItemsInSectionItems(): void {
    const itemMetas = new Array<ItemMeta>();

    this.sectionItems.forEach((ele) => {
      ele.itemMetas = new Array<ItemMeta>();
      ele.minRowHeight = this.minRowHeight;

      this.items.filter((i) => {
        let itemMeta = new ItemMeta();

        if (i.sectionID === ele.section.id) {
          itemMeta.item = i;
          if (itemMeta.item.start <= this.end && itemMeta.item.end >= this.start) {
            itemMeta = this.itemMetaCal(itemMeta);
            ele.itemMetas.push(itemMeta);
            itemMetas.push(itemMeta);
          }
        }
      });
    });

    const sortedItems = itemMetas.reduce((sortItems: any, itemMeta: ItemMeta) => {
      const index = this.sectionItems.findIndex((sectionItem) => sectionItem.section.id === itemMeta.item.sectionID);
      if (!sortItems[index]) {
        sortItems[index] = [];
      }
      sortItems[index].push(itemMeta);
      return sortItems;
    }, {});

    this.calCssTop(sortedItems);
  }

  itemMetaCal(itemMeta: ItemMeta) {
    const foundStart = moment.max(itemMeta.item.start, this.start);
    const foundEnd = moment.min(itemMeta.item.end, this.end);

    let widthMinuteDiff = Math.abs(foundStart.diff(foundEnd, "minutes"));
    let leftMinuteDiff = foundStart.diff(this.start, "minutes");
    if (this.showBusinessDayOnly) {
      widthMinuteDiff -= this.getNumberOfWeekendDays(moment(foundStart), moment(foundEnd)) * this.currentPeriod.timeFramePeriod;
      leftMinuteDiff -= this.getNumberOfWeekendDays(moment(this.start), moment(foundStart)) * this.currentPeriod.timeFramePeriod;
    }

    itemMeta.cssLeft = (leftMinuteDiff / this.currentPeriodMinuteDiff) * 100;
    itemMeta.cssWidth = (widthMinuteDiff / this.currentPeriodMinuteDiff) * 100;

    if (itemMeta.item.start >= this.start) {
      itemMeta.isStart = true;
    }
    if (itemMeta.item.end <= this.end) {
      itemMeta.isEnd = true;
    }

    return itemMeta;
  }

  calCssTop(sortedItems: any) {
    for (const prop of Object.keys(sortedItems)) {
      for (let i = 0; i < sortedItems[prop].length; i++) {
        let elemBottom;
        const elem = sortedItems[prop][i];

        for (let prev = 0; prev < i; prev++) {
          const prevElem = sortedItems[prop][prev];
          const prevElemBottom = prevElem.cssTop + this.minRowHeight;
          elemBottom = elem.cssTop + this.minRowHeight;

          if (
            ((prevElem.item.start <= elem.item.start && elem.item.start <= prevElem.item.end) ||
              (prevElem.item.start <= elem.item.end && elem.item.end <= prevElem.item.end) ||
              (prevElem.item.start >= elem.item.start && elem.item.end >= prevElem.item.end)) &&
            ((prevElem.cssTop <= elem.cssTop && elem.cssTop <= prevElemBottom) || (prevElem.cssTop <= elemBottom && elemBottom <= prevElemBottom))
          ) {
            elem.cssTop = prevElemBottom + 1;
            prev = 0;
          }
        }

        elemBottom = elem.cssTop + this.minRowHeight + 1;
        if (this.sectionItems[Number(prop)] && elemBottom > this.sectionItems[Number(prop)].minRowHeight) {
          this.sectionItems[Number(prop)].minRowHeight = elemBottom;
        }
      }
    }
  }

  changePeriod(period: Period, userTrigger: boolean = true) {
    this.currentPeriod = period;
    const _start = this.start;
    this.end = moment(_start).add(this.currentPeriod.timeFrameOverall, "minutes").endOf("day");
    this.currentPeriodMinuteDiff = Math.abs(this.start.diff(this.end, "minutes"));

    if (userTrigger && this.events.PeriodChange) {
      this.events.PeriodChange(this.start, this.end);
    }

    if (this.showBusinessDayOnly) {
      this.currentPeriodMinuteDiff -= this.getNumberOfWeekendDays(moment(this.start), moment(this.end)) * this.currentPeriod.timeFramePeriod;
    }

    this.header = new Array<Header>();
    this.currentPeriod.timeFrameHeaders.forEach((ele: string, index: number) => {
      const headerDate = this.getDatesBetweenTwoDates(ele, index);
      this.header.push(headerDate);
    });
    this.setItemsInSectionItems();
    this.showCurrentTimeIndicator();
  }

  showCurrentTimeIndicator = () => {
    if (this.ShowCurrentTimeHandle) {
      clearTimeout(this.ShowCurrentTimeHandle);
    }

    const currentTime = moment();
    if (currentTime >= this.start && currentTime <= this.end) {
      this.currentTimeVisibility = "visible";
      this.currentTimeIndicatorPosition = (Math.abs(this.start.diff(currentTime, "minutes")) / this.currentPeriodMinuteDiff) * 100 + "%";
      this.currentTimeTitle = currentTime.format(this.currentTimeFormat);
    } else {
      this.currentTimeVisibility = "hidden";
    }
    this.ShowCurrentTimeHandle = setTimeout(this.showCurrentTimeIndicator, 30000);
  };

  gotoToday() {
    this.start = moment().startOf("day");
    this.changePeriod(this.currentPeriod);
  }

  currentWeek() {
    this.start = moment().startOf("week");
    this.changePeriod(this.currentPeriod);
  }

  nextPeriod() {
    // this.start.add(this.currentPeriod.timeFrameOverall, "minutes");
    this.start.add(1, "week").startOf("week");
    this.changePeriod(this.currentPeriod);
  }

  previousPeriod() {
    // this.start.subtract(this.currentPeriod.timeFrameOverall, "minutes");
    this.start.subtract(1, "week").startOf("week");
    this.changePeriod(this.currentPeriod);
  }

  public previousDayPeriod(): void {
    // console.log("previousDayPeriod ", this.currentDate);
    this.currentDate.subtract(1, "day").startOf("day");
    this.start = this.currentDate;
    // this.end = this.currentDate;
    // console.log("previousDayPeriod ", this.currentDate);
    this.changePeriod(this.currentPeriod);
  }

  public currentDay(): void {
    const currentDate = moment().startOf("day");
    this.start = currentDate;
    // this.currentDate = currentDate;
    this.changePeriod(this.currentPeriod);
  }

  public nextDayPeriod(): void {
    // console.log("nextDayPeriod ", this.currentDate);
    this.currentDate.add(1, "day").startOf("day");
    this.start = this.currentDate;
    // this.end = this.currentDate;
    // console.log("nextDayPeriod ", this.currentDate);
    this.changePeriod(this.currentPeriod);
  }

  gotoDate(event: any) {
    // const value = event as HTMLInputElement
    this.showGotoModal = false;
    this.start = moment(event.value).startOf("day");
    this.changePeriod(this.currentPeriod);
  }

  getDatesBetweenTwoDates(format: string, index: number): Header {
    const now = moment(this.start);
    const dates = new Header();
    let prev: string;
    let colspan = 0;

    while (now.isBefore(this.end) || now.isSame(this.end)) {
      if (!this.showBusinessDayOnly || (now.day() !== 0 && now.day() !== 6)) {
        const headerDetails = new HeaderDetails();
        headerDetails.name = now.locale(this.locale).format(format);

        if (prev && prev !== headerDetails.name) {
          colspan = 1;
        } else {
          colspan++;
          dates.headerDetails.pop();
        }
        prev = headerDetails.name;
        headerDetails.colspan = colspan;
        headerDetails.tooltip =
          this.currentPeriod.timeFrameHeadersTooltip && this.currentPeriod.timeFrameHeadersTooltip[index]
            ? now.locale(this.locale).format(this.currentPeriod.timeFrameHeadersTooltip[index])
            : "";

        // console.log("headerDetails", headerDetails);
        dates.headerDetails.push(headerDetails);
      }

      now.add(this.currentPeriod.timeFramePeriod, "minutes");
    }
    return dates;
  }

  getNumberOfWeekendDays(startDate: moment.Moment, endDate: moment.Moment) {
    let count = 0;
    while (startDate.isBefore(endDate) || startDate.isSame(endDate)) {
      if (startDate.day() === 0 || startDate.day() === 6) {
        count++;
      }
      startDate.add(this.currentPeriod.timeFramePeriod, "minutes");
    }
    return count;
  }

  drop(event: CdkDragDrop<Section>) {
    event.item.data.sectionID = event.container.data.id;
    this.refreshView();
    this.events.ItemDropped(event.item.data);
  }

  itemPush() {
    this.subscription.add(
      this.service.itemAdd.asObservable().subscribe((item: Item) => {
        this.items.push(item);
        this.refreshView();
      })
    );
  }

  itemPop() {
    this.subscription.add(
      this.service.item.asObservable().subscribe(() => {
        this.items.pop();
        this.refreshView();
      })
    );
  }

  itemRemove() {
    this.subscription.add(
      this.service.itemId.asObservable().subscribe((itemId: number) => {
        this.items.splice(
          this.items.findIndex((item) => {
            return item.id === itemId;
          }),
          1
        );
        this.refreshView();
      })
    );
  }

  sectionPush() {
    this.subscription.add(
      this.service.sectionAdd.asObservable().subscribe((section: Section) => {
        this.sections.push(section);
        this.refreshView();
      })
    );
  }

  sectionPop() {
    this.subscription.add(
      this.service.section.asObservable().subscribe(() => {
        this.sections.pop();
        this.refreshView();
      })
    );
  }

  sectionRemove() {
    this.subscription.add(
      this.service.sectionId.asObservable().subscribe((sectionId: number) => {
        this.sections.splice(
          this.sections.findIndex((section) => {
            return section.id === sectionId;
          }),
          1
        );
        this.refreshView();
      })
    );
  }

  refresh() {
    this.subscription.add(
      this.service.refreshView.asObservable().subscribe(() => {
        this.refreshView();
      })
    );
  }

  ngOnDestroy(): void {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }

  public onSelectSchedule(sectionItem: SectionItem): void {
    console.log("sectionItem", sectionItem);
    this.manageStaffScheduleDrawer.staffScheduleFormGroup.get("_id").setValue(sectionItem.section.schedule._id);
    this.manageStaffScheduleDrawer.toggle();
  }

  public getNotes(shift: IScheduleSchedulesShift, startDate: Date): Array<IScheduleSchedulesShiftNote> {
    return shift.notes.filter((n) => n.date === DateTime.fromJSDate(startDate).toISODate()) || [];
  }

  public nzTooltipVisible = false;
  public staffTooltipVisibleChange(show: boolean, date: Date, itemMeta: ItemMeta): void {
    // console.log("ee", show, itemMeta);

    this.notes = "";
    this.lessonDetails = itemMeta.item.shift?.lessonDetails?.find((ld) => ld.date === DateTime.fromJSDate(date).toISODate())?.lessonDetails || "";
  }

  public lessonDetails: string = "";
  public onChangeLessonDetails(date: Date, itemMeta: ItemMeta) {
    lastValueFrom(
      this.schedulesShiftsService.teacherManageLessonDetails({
        date: DateTime.fromJSDate(date).toISODate(),
        lessonDetails: this.lessonDetails,
        shiftId: itemMeta.item.shift._id,
      })
    ).then((res) => {
      itemMeta.item.shift.lessonDetails = res.data.lessonDetails;
    });
  }

  public notes: string = "";

  public addNote(date: Date, itemMeta: ItemMeta): void {
    lastValueFrom(
      this.schedulesShiftsService.teacherManageShift({
        date: DateTime.fromJSDate(date).toISODate(),
        notes: this.notes,
        shiftId: itemMeta.item.shift._id,
      })
    ).then((res) => {
      this.nzNotificationService.create(res.success ? "success" : "error", "Add Notes", res.message);
      if (res.success) {
        this.notes = null;
        itemMeta.item.shift.notes = res.data.notes;
      }
    });
  }

  public hasNewChanges(itemMeta: ItemMeta): boolean {
    const currentDateTime = DateTime.now();
    const updatedAt = DateTime.fromISO(itemMeta.item.shift.updatedAt);

    const diffInMinutes = currentDateTime.diff(updatedAt, "minutes").minutes;

    // Check if the difference is less than or equal to 5 minutes
    const isUpdated = diffInMinutes <= 30;

    return isUpdated;
  }
}
