/**
 * Courses Data Types
 *
 * @file          courses.endpoints.datatypes
 * @description   Defines all endpoint data types associated with /api/courses/*
 * @author        John Mark Alicante
 * @since         2025 - 06 - 01
 */

/***********************************************
 * @interface     CourseI
 * @description   Course interface
 */

export interface MaterialI {
  _id: string;
  name: string;
  quantity: number;
  price: number;
  properties: string; // UUID reference
  propertiesBranches: string; // Branch ID reference
  deleted: boolean;
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
}

export interface CourseI {
  _id: string;
  name: string;
  price: number;
  properties: string;
  propertiesBranches: string;
  hourlyMonthlyPrice: number;
  hourlyPackagePrice: number;
  material: MaterialI;
  deleted: boolean;
  updatedAt: string;
}
