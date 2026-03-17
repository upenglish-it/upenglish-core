// import { HttpServer, INestApplication } from '@nestjs/common';
// import { NestExpressApplication } from '@nestjs/platform-express';
// import { OpenAPIObject } from '@nestjs/swagger';
// import { Request, Response } from 'express';
// import * as expressAuth from 'express-basic-auth';
// import * as handlebars from 'express-handlebars';
// // import * as hbs from 'express-handlebars';
// import * as pathModule from 'path';
// import { resolve } from 'url';
// import * as Joi from 'joi';

// // import { LogoOptions, RedocDocument, RedocOptions } from './interfaces';
// // import { schema } from './model/options.model';

// export class RedocModule {
//   /**
//    * Setup ReDoc frontend
//    * @param path - path to mount the ReDoc frontend
//    * @param app - NestApplication
//    * @param document - Swagger document object
//    * @param options - Init options
//    */
//   public static async setup(path: string, app: INestApplication, document: OpenAPIObject, options: RedocOptions): Promise<void> {
//     // Validate options object
//     try {
//       const _options = await this.validateOptionsObject(options, document);
//       const redocDocument = this.addVendorExtensions(_options, <RedocDocument>document);
//       const httpAdapter: HttpServer = app.getHttpAdapter();
//       if (httpAdapter && httpAdapter.constructor && httpAdapter.constructor.name === 'FastifyAdapter') {
//         return this.setupFastify();
//       }
//       return await this.setupExpress(path, <NestExpressApplication>app, redocDocument, _options);
//     } catch (error) {
//       throw error;
//     }
//   }

//   /**
//    * Setup fastify (not implemented yet)
//    */
//   private static async setupFastify(): Promise<void> {
//     throw new Error('Fastify is not implemented yet');
//   }

//   private static async validateOptionsObject(options: RedocOptions, document: OpenAPIObject): Promise<RedocOptions> {
//     try {
//       return schema(document).validateAsync(options) as RedocOptions;
//     } catch (error) {
//       // Something went wrong while parsing config object
//       throw new TypeError(error.message);
//     }
//   }

//   /**
//    * Setup ReDoc frontend for express plattform
//    * @param path - path to mount the ReDoc frontend
//    * @param app - NestApplication
//    * @param document - ReDoc document object
//    * @param options - Init options
//    */
//   private static async setupExpress(path: string, app: NestExpressApplication, document: RedocDocument, options: RedocOptions) {
//     const httpAdapter = app.getHttpAdapter();
//     // Normalize URL path to use
//     const finalPath = this.normalizePath(path);
//     // Add a slash to the end of the URL path to use in URL resolve function
//     const resolvedPath = finalPath.slice(-1) !== '/' ? finalPath + '/' : finalPath;
//     // Serve swagger spec in another URL appended to the normalized path
//     const docUrl = resolve(resolvedPath, `${options.docName}.json`);
//     // create helper to convert metadata to JSON
//     console.log('handlebars', handlebars.create());
//     const hbs = handlebars.create({
//       helpers: {
//         toJSON: function (object: any) {
//           return JSON.stringify(object);
//         },
//       },
//     });
//     // spread redoc options
//     const { title, favicon, theme, redocVersion, ...otherOptions } = options;
//     // create render object
//     const renderData = {
//       data: {
//         title,
//         docUrl,
//         favicon,
//         redocVersion,
//         options: otherOptions,
//         ...(theme && {
//           theme: {
//             ...theme,
//           },
//         }),
//       },
//     };
//     // this is our handlebars file path
//     const redocFilePath = pathModule.join(__dirname, '..', 'isms/redoc', 'redoc.handlebars');
//     // get handlebars rendered HTML
//     const redocHTML = await hbs.render(redocFilePath, renderData);
//     // Serve ReDoc Frontend
//     httpAdapter.get(finalPath, async (req: Request, res: Response) => {
//       const sendPage = () => {
//         // Content-Security-Policy: worker-src 'self' blob:
//         res.setHeader(
//           'Content-Security-Policy',
//           "default-src * 'unsafe-inline' 'unsafe-eval'; script-src * 'unsafe-inline' 'unsafe-eval'; child-src * 'unsafe-inline' 'unsafe-eval' blob:; worker-src * 'unsafe-inline' 'unsafe-eval' blob:; connect-src * 'unsafe-inline'; img-src * data: blob: 'unsafe-inline'; frame-src *; style-src * 'unsafe-inline';",
//         );
//         // whoosh
//         res.send(redocHTML);
//       };
//       if (options.auth?.enabled) {
//         const { user, password } = options.auth;
//         expressAuth({ users: { [user]: password }, challenge: true })(req, res, () => {
//           sendPage();
//         });
//       } else {
//         sendPage();
//       }
//     });
//     // Serve swagger spec json
//     httpAdapter.get(docUrl, (req: Request, res: Response) => {
//       res.setHeader('Content-Type', 'application/json');
//       res.send(document);
//     });
//   }

//   /**
//    * Normalize path string
//    * @param path - Path string
//    */
//   private static normalizePath(path: string): string {
//     return path.charAt(0) !== '/' ? '/' + path : path;
//   }

//   /**
//    * Add any vendor options if they are present in the options object
//    * @param options options object
//    * @param document redoc document
//    */
//   private static addVendorExtensions(options: RedocOptions, document: RedocDocument): RedocDocument {
//     if (options.logo) {
//       const logoOption: Partial<LogoOptions> = { ...options.logo };
//       document.info['x-logo'] = logoOption;
//     }

//     if (options.tagGroups) {
//       document['x-tagGroups'] = options.tagGroups;
//     }

//     return document;
//   }
// }

// export interface RedocOptions {
//   /** Version of ReDoc to use (e.g. next, latest, 2.0.0-rc.50), by default is latest */
//   redocVersion?: string;
//   /** Web site title (e.g: ReDoc documentation) */
//   title?: string;
//   /** Web site favicon URL */
//   favicon?: string;
//   /** Logo Options */
//   logo?: LogoOptions;
//   /** Theme options */
//   theme?: any;
//   /** If set, the spec is considered untrusted and all HTML/markdown is sanitized to prevent XSS, by default is false */
//   untrustedSpec?: boolean;
//   /** If set, warnings are not rendered at the top of documentation (they are still logged to the console) */
//   supressWarnings?: boolean;
//   /** If set, the protocol and hostname won't be shown in the operation definition */
//   hideHostname?: boolean;
//   /** Specify which responses to expand by default by response codes,
//    * values should be passed as comma-separated list without spaces
//    * (e.g: 200, 201, "all")
//    */
//   expandResponses?: string;
//   /** If set, show required properties first ordered in the same order as in required array */
//   requiredPropsFirst?: boolean;
//   /** If set, propeties will be sorted alphabetically */
//   sortPropsAlphabetically?: boolean;
//   /** If set the fields starting with "x-" will be shown, can be a boolean or a string with names of extensions to display */
//   showExtensions?: boolean | string;
//   /** If set, redoc won't inject authentication section automatically */
//   noAutoAuth?: boolean;
//   /** If set, path link and HTTP verb will be shown in the middle panel instead of the right one */
//   pathInMiddlePanel?: boolean;
//   /** If set, loading spinner animation won't be shown */
//   hideLoading?: boolean;
//   /** If set, a native scrollbar will be used instead of perfect-scroll, this can improve performance of the frontend for big specs */
//   nativeScrollbars?: boolean;
//   /** This will hide the "Download spec" button, it only hides the button */
//   hideDownloadButton?: boolean;
//   /** If set, the search bar will be disabled */
//   disableSearch?: boolean;
//   /** Shows only required fileds in request samples */
//   onlyRequiredInSamples?: boolean;
//   /** Name of the swagger json spec file */
//   docName?: string;
//   /** Authentication options */
//   auth?: {
//     // Default value is false
//     enabled: boolean;
//     // If auth is enabled but no user is provided the default value is "admin"
//     user: string;
//     // If auth is enabled but no password is provided the default value is "123"
//     password: string;
//   };

//   /** Vendor extensions */

//   /** If set, group tags in categories in the side menu. Tags not added to a group will not be displayed. */
//   tagGroups?: TagGroupOptions[];
// }

// export interface LogoOptions {
//   /** The URL pointing to the spec logo, must be in the format of a URL and an absolute URL */
//   url?: string;
//   /** Background color to be used, must be RGB color in hexadecimal format (e.g: #008080) */
//   backgroundColor?: string;
//   /** Alt tag for logo */
//   altText?: string;
//   /** href tag for logo, it defaults to the one used in your API spec */
//   href?: string;
// }

// export interface TagGroupOptions {
//   name: string;
//   tags: string[];
// }

// export interface RedocDocument extends Partial<OpenAPIObject> {
//   info: OpenAPIObject['info'] & {
//     'x-logo'?: LogoOptions;
//   };
//   'x-tagGroups': TagGroupOptions[];
// }

// export const schema = (document: OpenAPIObject) =>
//   Joi.object().keys({
//     redocVersion: Joi.string().default('latest'),
//     title: Joi.string()
//       .optional()
//       .default(document.info ? document.info.title : 'Swagger documentation'),
//     favicon: Joi.string().optional(),
//     logo: {
//       url: Joi.string().optional().uri(),
//       backgroundColor: Joi.string().optional().regex(new RegExp('^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$')),
//       altText: Joi.string().optional(),
//       href: Joi.string().optional().uri(),
//     },
//     theme: Joi.any(),
//     untrustedSpec: Joi.boolean().optional().default(false),
//     supressWarnings: Joi.boolean().optional().default(true),
//     hideHostname: Joi.boolean().optional().default(false),
//     expandResponses: Joi.string().optional(),
//     requiredPropsFirst: Joi.boolean().optional().default(true),
//     sortPropsAlphabetically: Joi.boolean().optional().default(true),
//     showExtensions: Joi.any().optional().default(false),
//     noAutoAuth: Joi.boolean().optional().default(true),
//     pathInMiddlePanel: Joi.boolean().optional().default(false),
//     hideLoading: Joi.boolean().optional().default(false),
//     nativeScrollbars: Joi.boolean().optional().default(false),
//     hideDownloadButton: Joi.boolean().optional().default(false),
//     disableSearch: Joi.boolean().optional().default(false),
//     onlyRequiredInSamples: Joi.boolean().optional().default(false),
//     docName: Joi.string().optional().default('swagger'),
//     auth: {
//       enabled: Joi.boolean().optional().default(false),
//       user: Joi.string().default('admin'),
//       password: Joi.string().default('123'),
//     },
//     tagGroups: Joi.array()
//       .items(
//         Joi.object({
//           name: Joi.string(),
//           tags: Joi.array().items(Joi.string()),
//         }),
//       )
//       .optional(),
//   });
