import { RANDOM_NUMBER_GENERATOR } from './generator.util';

export const ACCOUNT_ID = (firstLetterOfName: string): string => {
  const year = new Date().getUTCFullYear().toString().substring(2, 4);
  const month = (new Date().getMonth() + 1).toString().padStart(2, '0');
  const date = new Date().getDate().toString().padStart(2, '0');
  return `${process.env.PROJECT_PREFIX}-${year}${month}${date}-${RANDOM_NUMBER_GENERATOR(6)}`;
};
