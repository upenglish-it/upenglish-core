import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
// import cluster from 'cluster';
import * as notReallyCluster from 'cluster';
const cluster = notReallyCluster as unknown as notReallyCluster.Cluster;
import * as compression from 'compression';
import { json, urlencoded } from 'express';
import * as useragent from 'express-useragent';
import helmet from 'helmet';
import * as trimRequest from 'trim-request';
import { ISMSModule } from './isms.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(ISMSModule, {
    bodyParser: true,
    cors: true,
  });

  const PORT = process.env.PORT || 3000;
  const apiVersionOne = 'api/v1';
  const appTitle = 'ISMS Core';

  app.use(json({ limit: '50mb' }));
  app.use(urlencoded({ extended: true, limit: '50mb' }));
  app.use(compression());
  app.disable('x-powered-by');

  app.setGlobalPrefix(apiVersionOne);
  app.enableCors();
  app.use(useragent.express());

  // Trim request
  app.use(trimRequest.all);

  // Swagger configuration
  const options = new DocumentBuilder()
    .setTitle(`${appTitle} - API Documentation`)
    .setDescription(`${appTitle} documentation of the application`)
    .setVersion('1.0')
    .setExternalDoc('For more information', 'https://upenglishvietnam.com/')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT', in: 'header' }, process.env.AUTHORIZATION_KEY)
    .build();
  const document = SwaggerModule.createDocument(app, options);
  SwaggerModule.setup('api-docs', app, document, {
    customSiteTitle: `${appTitle} - API Documentation`,
    customfavIcon: '/favicon.ico',
  });

  // Redoc Setup
  // const options = new DocumentBuilder()
  //   .setTitle(`${appTitle} - API Documentation`)
  //   .setDescription(`${appTitle} documentation of the application`)
  //   .setVersion('1.0')
  //   // .addTag('cats')
  //   .addBasicAuth()
  //   .addBearerAuth()
  //   .addOAuth2()
  //   .addApiKey()
  //   .addCookieAuth()
  //   .addSecurityRequirements('bearer')
  //   .build();
  // const document = SwaggerModule.createDocument(app, options);
  // const redocOptions: RedocOptions = {
  //   title: 'Redoc Module',
  //   logo: {
  //     url: 'https://app.upenglishvietnam.com/assets/images/logo-nav.png',
  //     backgroundColor: '#F0F0F0',
  //     altText: 'Logo',
  //   },
  //   sortPropsAlphabetically: true,
  //   hideDownloadButton: false,
  //   hideHostname: false,
  //   noAutoAuth: true,
  //   pathInMiddlePanel: true,
  //   auth: {
  //     enabled: true,
  //     user: 'admin',
  //     password: '123',
  //   },
  // };
  // await RedocModule.setup('api-docs', app, document, redocOptions);

  /* refuse iframe injection */
  app.use(
    helmet({
      frameguard: {
        action: 'deny',
      },
    })
  );

  // Cluster configuration
  if (process.env.NODE_ENV === 'production') {
    if (cluster.isPrimary) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const numWorkers = require('os').cpus().length;

      Logger.log('Master cluster setting up ' + numWorkers + ' workers');

      for (let i = 0; i < numWorkers; i++) {
        cluster.fork();
      }

      cluster.on('online', (worker) => {
        Logger.log('Worker ' + worker.process.pid + ' is online');
      });

      cluster.on('exit', (worker, code, signal) => {
        Logger.log('Worker ' + worker.process.pid + ' died with code: ' + code + ', and signal: ' + signal);
        Logger.log('Starting a new worker');
        cluster.fork();
      });
    } else {
      /* start running a server in a multiple worker */
      await app.listen(PORT, () => {
        Logger.log(`[SMS] Server is now running in production at port ${PORT}`); // unless $PORT is undefined, in which case you're listening to 8081.
      });

      /* Catch when server is error then restart the server */
      process.on('uncaughtException', (err) => {
        Logger.log(err);
        process.exit(1);
      });
    }
  } else {
    /* start running a server in a single worker */
    await app.listen(PORT, () => {
      Logger.log(`[SMS] Server is now running in development at port ${PORT}`); // unless $PORT is undefined, in which case you're listening to 8081.
    });
  }
}
bootstrap();
