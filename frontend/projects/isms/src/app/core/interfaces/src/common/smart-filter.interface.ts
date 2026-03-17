import { INameValue } from "./generic.interface";

export interface ISmartFilter {
  parameter: INameValue;
  operator: INameValue;
  value: INameValue;
  sequenceOperator: INameValue;
}
