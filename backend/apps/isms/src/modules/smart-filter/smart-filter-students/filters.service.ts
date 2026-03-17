import { Injectable } from '@nestjs/common';
import { IAuthTokenPayload, Accounts, TOperators, TParameters, IFilter } from 'apps/common';
import { ReturnModelType } from '@typegoose/typegoose';
import { InjectModel } from 'nestjs-typegoose';

@Injectable()
export class SmartFilterStudentsFiltersService {
  constructor(@InjectModel(Accounts) private readonly accounts: ReturnModelType<typeof Accounts>) {}

  public async fetchFilterResult(smartFilters: Array<IFilter>, tokenPayload: IAuthTokenPayload): Promise<Array<Accounts>> {
    try {
      const queries = [];

      smartFilters.forEach((filter: IFilter) => {
        // let query = {};

        const parameter = filter.parameter.value as TParameters;
        const operators = filter.operator.value as TOperators;

        if (parameter === 'student/gender') {
          const value = filter.value.value;
          if (operators === 'is') {
            queries.push({
              $match: {
                gender: value,
              },
            });
          }
          if (operators === 'is-not') {
            queries.push({
              $match: {
                gender: { $ne: value },
              },
            });
          }
        }

        if (parameter === 'student/age') {
          const value = filter.value as any;
          const parsedValue = parseInt(value);

          queries.push({
            $addFields: {
              convertedBirthDate: { $toDate: '$birthDate' }, // Convert birthdate string field to Date object
            },
          });
          queries.push({
            $addFields: {
              age: {
                $divide: [
                  { $subtract: ['$$NOW', '$convertedBirthDate'] },
                  1000 * 60 * 60 * 24 * 365, // Convert milliseconds to years
                ],
              },
            },
          });
          queries.push({
            $addFields: {
              truncAge: {
                $trunc: '$age',
              },
            },
          });

          if (operators === 'equal') {
            // query = {
            //   birthDate: { $ne: null },
            //   $expr: {
            //     $eq: [
            //       {
            //         $dateSubtract: {
            //           startDate: '$$NOW',
            //           unit: 'year',
            //           amount: parsedValue,
            //         },
            //       },
            //       { $toDate: '$birthDate' },
            //     ],
            //   },
            // };
            queries.push({
              $match: {
                birthDate: {
                  $ne: null,
                },
                $expr: {
                  $eq: ['$truncAge', parsedValue],
                },
              },
            });
          }
          if (operators === 'not-equal') {
            // query = {
            //   birthDate: { $ne: null },
            //   $expr: {
            //     $ne: [
            //       {
            //         $dateSubtract: {
            //           startDate: '$$NOW',
            //           unit: 'year',
            //           amount: parsedValue,
            //         },
            //       },
            //       { $toDate: '$birthDate' },
            //     ],
            //   },
            // };

            queries.push({
              $match: {
                birthDate: {
                  $ne: null,
                },
                $expr: {
                  $ne: ['$truncAge', parsedValue],
                },
              },
            });
          }
          if (operators === 'less-than-and-equal') {
            // query = {
            //   birthDate: { $ne: null },
            //   $expr: {
            //     $lte: [
            //       {
            //         $dateSubtract: {
            //           startDate: '$$NOW',
            //           unit: 'year',
            //           amount: parsedValue,
            //         },
            //       },
            //       { $toDate: '$birthDate' },
            //     ],
            //   },
            // };
            queries.push({
              $match: {
                birthDate: {
                  $ne: null,
                },
                $expr: {
                  $lte: ['$truncAge', parsedValue],
                },
              },
            });
          }
          if (operators === 'greater-than-and-equal') {
            // query = {
            //   birthDate: { $ne: null },
            //   $expr: {
            //     $gte: [
            //       {
            //         $dateSubtract: {
            //           startDate: '$$NOW',
            //           unit: 'year',
            //           amount: parsedValue,
            //         },
            //       },
            //       { $toDate: '$birthDate' },
            //     ],
            //   },
            // };
            queries.push({
              $match: {
                birthDate: {
                  $ne: null,
                },
                $expr: {
                  $gte: ['$truncAge', parsedValue],
                },
              },
            });
          }

          queries.push({
            $project: {
              truncAge: 0,
              age: 0,
              convertedBirthDate: 0,
            },
          });
        }

        if (parameter === 'student/status') {
          const value = filter.value.value;
          const active = value === 'active';
          if (operators === 'is') {
            // query = {
            //   active: active,
            // };
            queries.push({
              $match: { active: active },
            });
          }
          if (operators === 'is-not') {
            // query = {
            //   active: { $ne: active },
            // };
            queries.push({
              $match: { $ne: active },
            });
          }
        }

        if (parameter === 'student/country') {
          const value = filter.value.value;
          if (operators === 'is') {
            // query = {
            //   'address.country': value,
            // };
            queries.push({
              $match: {
                'address.country': value,
              },
            });
          }
          if (operators === 'is-not') {
            // query = {
            //   'address.country': { $ne: value },
            // };
            queries.push({
              $match: {
                'address.country': { $ne: value },
              },
            });
          }
        }

        if (parameter === 'student/branch') {
          const value = filter.value;
          if (operators === 'is-in') {
            // query = {
            //   propertiesBranches: { $in: value },
            // };
            queries.push({
              $match: {
                propertiesBranches: { $in: value },
              },
            });
          }
          if (operators === 'is-not-in') {
            // query = {
            //   propertiesBranches: { $ne: value },
            // };
            queries.push({
              $match: {
                propertiesBranches: { $ne: value },
              },
            });
          }
        }

        if (parameter === 'student/lead') {
          const value = filter.value;
          if (value) {
            queries.push({ $match: { official: false, won: false } });
          } else {
            queries.push({
              $match: {
                $or: [
                  { official: true, won: false },
                  { official: true, won: true },
                  { official: false, won: true },
                ],
              },
            });
          }
        }
      });

      console.log('queries', JSON.stringify(queries));

      queries.push({
        $match: {
          role: 'student',
          properties: tokenPayload.propertyId,
        },
      });

      // queries.push({
      //   role: 'student',
      //   properties: tokenPayload.propertyId,
      // });

      console.log('queries ', queries);

      const students = await this.accounts.aggregate(queries).sort({ createdAt: -1 }).limit(100);

      return students;
    } catch (error) {
      return [];
    }
  }

  public async fetchFilterResult2(smartFilters: Array<IFilter>, tokenPayload: IAuthTokenPayload): Promise<Array<Accounts>> {
    try {
      let query = {};

      smartFilters.forEach((filter: IFilter) => {
        const parameter = filter.parameter.value as TParameters;
        const operators = filter.operator.value as TOperators;

        if (parameter === 'student/gender') {
          const value = filter.value.value;
          if (operators === 'is') {
            query = {
              ...query,
              gender: value,
            };
          }
          if (operators === 'is-not') {
            query = {
              ...query,
              gender: { $ne: value },
            };
          }
        }

        if (parameter === 'student/age') {
          const value = filter.value as any;
          const parsedValue = parseInt(value);

          if (operators === 'equal') {
            query = {
              ...query,
              birthDate: { $ne: null },
              $expr: {
                $eq: [
                  {
                    $dateSubtract: {
                      startDate: '$$NOW',
                      unit: 'year',
                      amount: parsedValue,
                    },
                  },
                  { $toDate: '$birthDate' },
                ],
              },
            };
          }
          if (operators === 'not-equal') {
            query = {
              ...query,
              birthDate: { $ne: null },
              $expr: {
                $ne: [
                  {
                    $dateSubtract: {
                      startDate: '$$NOW',
                      unit: 'year',
                      amount: parsedValue,
                    },
                  },
                  { $toDate: '$birthDate' },
                ],
              },
            };
          }
          if (operators === 'less-than-and-equal') {
            query = {
              ...query,
              birthDate: { $ne: null },
              $expr: {
                $lte: [
                  {
                    $dateSubtract: {
                      startDate: '$$NOW',
                      unit: 'year',
                      amount: parsedValue,
                    },
                  },
                  { $toDate: '$birthDate' },
                ],
              },
            };
          }
          if (operators === 'greater-than-and-equal') {
            query = {
              ...query,
              birthDate: { $ne: null },
              $expr: {
                $gte: [
                  {
                    $dateSubtract: {
                      startDate: '$$NOW',
                      unit: 'year',
                      amount: parsedValue,
                    },
                  },
                  { $toDate: '$birthDate' },
                ],
              },
            };
          }
        }

        if (parameter === 'student/status') {
          const value = filter.value.value;
          const active = value === 'active';
          if (operators === 'is') {
            query = {
              ...query,
              active: active,
            };
          }
          if (operators === 'is-not') {
            query = {
              ...query,
              active: { $ne: active },
            };
          }
        }

        if (parameter === 'student/country') {
          const value = filter.value.value;
          if (operators === 'is') {
            query = {
              ...query,
              'address.country': value,
            };
          }
          if (operators === 'is-not') {
            query = {
              ...query,
              'address.country': { $ne: value },
            };
          }
        }

        if (parameter === 'student/branch') {
          const value = filter.value;
          if (operators === 'is-in') {
            query = {
              ...query,
              propertiesBranches: { $in: value },
            };
          }
          if (operators === 'is-not-in') {
            query = {
              ...query,
              propertiesBranches: { $ne: value },
            };
          }
        }
      });

      const students = await this.accounts
        .find({
          ...query,
          role: 'student',
          properties: tokenPayload.propertyId,
        })
        .sort({ createdAt: -1 })
        .limit(50);

      return students;
    } catch (error) {
      return [];
    }
  }
}
