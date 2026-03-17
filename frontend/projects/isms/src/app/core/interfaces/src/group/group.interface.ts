import { ISubGroup } from "./sub-group.interface";

export interface IGroup {
  _id: string;
  name: string;
  subGroup: Array<ISubGroup>;

  expand?: boolean; // added in FE
}
