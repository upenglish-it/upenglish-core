// Interfaces
import { PaginationParamsI, PaginationResponseI } from '../../interfaces/src/pagination-interface';

export const PaginationService = (params: PaginationParamsI): PaginationResponseI => {
  return {
    items: params.items,
    metadata: params.metadata,
  };
};
