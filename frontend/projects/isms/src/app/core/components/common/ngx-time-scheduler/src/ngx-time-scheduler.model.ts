import { inject } from "@angular/core";
import { IScheduleSchedulesShift } from "@isms-core/interfaces";
import { AccountStore, BranchesStore, SelectedBranchStore } from "@isms-core/ngrx";
import { NGRXService } from "@isms-core/services";
import * as moment from "moment";
import { ISchedule } from "tui-calendar";

export class Period {
  name: string;
  classes: string;
  timeFramePeriod: number;
  timeFrameOverall: number;
  timeFrameHeaders: string[];
  timeFrameHeadersTooltip?: string[];
  tooltip?: string;
}

export class Item {
  id: number;
  name: string;
  start: moment.Moment;
  end: moment.Moment;
  classes: string;
  sectionID: number;
  tooltip?: string;
  metadata?: any;
  shift?: IScheduleSchedulesShift; // use for week-by-class
}

export class Section {
  id: number;
  title: string;
  description?: string;
  tooltip?: string;
  schedule?: IScheduleSchedulesShift;
}

export class Text {
  NextButton: string;
  PrevButton: string;
  CurrentWeekButton: string;
  TodayButton: string;
  GotoButton: string;
  SectionTitle: string;
  HeaderTitle: string;

  private readonly ngrxService: NGRXService = inject(NGRXService);

  public selectedBranch: string = null;

  constructor() {
    this.NextButton = "Next";
    this.PrevButton = "Prev";
    this.CurrentWeekButton = "Current Week";
    this.TodayButton = "Today";
    this.GotoButton = "Go to";
    this.HeaderTitle = null;
    this.ngrxService.selectedBranch().subscribe((res) => {
      this.selectedBranch = res;
    });
    this.ngrxService.branches().subscribe((res) => {
      this.SectionTitle = res.find((v) => v._id === this.selectedBranch).name + " `Branch";
    });
  }
}

export class Events {
  // ItemResized: (item: Item, start: any, end: any) => void;
  // ItemMovement: (item: Item, start: any, end: any) => void;
  // ItemMovementStart: (item: Item, start: any, end: any) => void;
  // ItemMovementEnd: (item: Item, start: any, end: any) => void;
  ItemDropped: (item: Item) => void;
  ItemClicked: (item: Item) => void;
  ItemContextMenu: (item: Item, event: MouseEvent) => void;
  SectionClickEvent: (section: Section) => void;
  SectionContextMenuEvent: (section: Section, event: MouseEvent) => void;
  PeriodChange: (start: moment.Moment, end: moment.Moment) => void;
  ScheduleUpdated: () => void;
}

export class SectionItem {
  section: Section;
  minRowHeight: number;
  itemMetas: ItemMeta[];

  constructor() {
    this.itemMetas = new Array<ItemMeta>();
  }
}

export class ItemMeta {
  item: Item;
  isStart: boolean;
  isEnd: boolean;
  cssTop: number;
  cssLeft: number;
  cssWidth: number;

  constructor() {
    this.cssTop = 0;
    this.cssLeft = 0;
    this.cssWidth = 0;
  }
}

export class Header {
  headerDetails: HeaderDetails[];

  constructor() {
    this.headerDetails = new Array<HeaderDetails>();
  }
}

export class HeaderDetails {
  name: string;
  colspan: number;
  tooltip?: string;
}
