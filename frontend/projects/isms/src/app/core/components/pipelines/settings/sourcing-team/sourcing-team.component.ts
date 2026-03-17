import { JsonPipe, NgFor, NgIf } from "@angular/common";
import { Component, Input, OnInit } from "@angular/core";
import { FormGroup, FormsModule, ReactiveFormsModule } from "@angular/forms";
import { ProfilePhotoDirective } from "@isms-core/directives";
import { IAccount } from "@isms-core/interfaces";
import { isEmpty } from "lodash";
import { NzAvatarModule } from "ng-zorro-antd/avatar";
import { NzButtonModule } from "ng-zorro-antd/button";
import { NzDropDownModule } from "ng-zorro-antd/dropdown";
import { NzIconModule } from "ng-zorro-antd/icon";
import { NzInputModule } from "ng-zorro-antd/input";
import { NzPopconfirmModule } from "ng-zorro-antd/popconfirm";
import { NzSelectModule } from "ng-zorro-antd/select";
import { NzToolTipModule } from "ng-zorro-antd/tooltip";
import { lastValueFrom } from "rxjs";
import { StaffsService } from "@isms-core/services";

@Component({
  selector: "isms-pipeline-sourcing-team",
  templateUrl: "./sourcing-team.component.html",
  imports: [NgIf, NgFor, FormsModule, ReactiveFormsModule, NzSelectModule, NzToolTipModule, NzAvatarModule, NzButtonModule, NzIconModule, ProfilePhotoDirective],
})
export class SourcingTeamComponent implements OnInit {
  @Input("form-group") formGroup: FormGroup;
  public teamMembers: Array<IAccount> = null;
  public showHiringManagerSearch: boolean = false;
  constructor(private readonly staffsService: StaffsService) {}

  public ngOnInit(): void {
    lastValueFrom(this.staffsService.fetch({ includeMe: true })).then((res) => {
      if (res.success) {
        const teamMembers = res.data as Array<IAccount>;
        this.teamMembers = teamMembers;
      } else {
        this.teamMembers = [];
      }
    });
  }
}
