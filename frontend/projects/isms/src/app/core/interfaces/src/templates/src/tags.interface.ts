export interface ITag {
  _id: string;
  value: string;
  color: string;
  type: "general" | "relationship";
  createdAt: string;
  updatedAt: string;
}

export interface ISource {
  _id: string;
  value: string;
  createdAt: string;
  updatedAt: string;
}
