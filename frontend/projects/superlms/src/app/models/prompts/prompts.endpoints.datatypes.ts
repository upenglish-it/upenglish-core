/**
 * Prompts Data Types
 *
 * @file          prompts.endpoints.datatypes
 * @description   Defines all endpoint data types associated with /api/prompts/*
 * @author        John Mark Alicante
 * @since         2026 - 01 - 14
 */

/**
//  * @interface     ItemsTypeT
//  * @description   Item type
//  */
// const ItemsTypeC = ["product", "service"] as const;
// export type ItemsTypeT = (typeof ItemsTypeC)[number];

/**
 * @interface     PromptI
 * @description   Prompt interface
 */
export interface PromptI {
  _id: string;
  name: string;
  provider: string;
  model: string;
  apiKey: string;
  message: string;
}
