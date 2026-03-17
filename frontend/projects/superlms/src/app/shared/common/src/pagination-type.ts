export interface WithPaginationI<T = any> {
  items: T;
  metadata: {
    page: number;
    limit: number;
  };
}
