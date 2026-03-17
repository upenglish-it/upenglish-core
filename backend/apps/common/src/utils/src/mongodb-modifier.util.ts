/***********************************************
 * @interface               PaginationFieldsU
 * @description             Pagination query fields constructor
 * @params                  Page, LImit, sortField, sort
 */
export const PaginationFieldsU = (page: number = 1, limit: number = 25, sortField: string = 'createdAt', sort: number = -1): any => {
  return [
    {
      $sort: { [sortField]: sort },
    },
    {
      $facet: {
        items: [{ $skip: (page - 1) * limit }, { $limit: limit }],
        // totalCount: [{ $count: "count" }],
      },
    },
    {
      $addFields: {
        metadata: {
          // count: { $ifNull: [{ $arrayElemAt: ["$totalCount.count", 0] }, 0] },
          page,
          limit: limit,
        },
      },
    },
  ];
};
