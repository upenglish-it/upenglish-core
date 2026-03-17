import { ISmartFilter } from "../../common/smart-filter.interface";

export interface ISmartFilterStudent {
  _id: string;
  title: string;
  filters: Array<ISmartFilter>;
  accounts: string;
  properties: string;
  propertiesBranches: string;
  createdAt: string;
  updatedAt: string;

  selected?: boolean; // added in FE
}
