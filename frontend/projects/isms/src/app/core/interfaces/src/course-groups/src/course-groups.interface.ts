import { ICourse } from "../../courses";

export interface ICourseGroup {
  _id: string;
  name: string;
  courses: Array<ICourse>;
  createdAt: string;
  updatedAt: string;
}
