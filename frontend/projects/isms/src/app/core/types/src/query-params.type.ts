export type QueryParams = {
  limit?: number;
  skip?: number;
  page?: number;
  status?: string;
  name?: string;
  includeMe?: boolean;
  branches?: Array<string>;
  staffs?: Array<string>;
  startEndDate?: Array<string>;
};
