import { IMaterial } from "../../materials";

export interface ICourse {
  _id: string;
  name: string;
  price: number;
  hourlyMonthlyPrice: number;
  hourlyPackagePrice: number;
  material: IMaterial;
  createdAt: string;
  updatedAt: string;
  selected?: boolean;

  // FE added
  count?: number;
}
