export interface ISegmentSelector {
  label: string;
  description?: string;
  icon: string;
  route?: string;
  disable?: boolean;
  type?: string;
  selected?: boolean;
}
