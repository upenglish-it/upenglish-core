import { IBranch } from "../branches/branches.interface";

export interface IProperties {
  _id: string;
  name: string;
  deleted: false;
  propertiesBranches: IBranch[];
}
