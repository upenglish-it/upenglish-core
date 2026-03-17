export type MongoDBWebhook = {
  _id: {
    _data: string;
  };
  operationType: 'update' | 'insert';
  wallTime: string;
  fullDocument: any;
  documentKey: {
    _id: string;
  };
  updateDescription: {
    updatedFields: any;
    removedFields: Array<any>;
    truncatedArrays: Array<any>;
  };
  fullDocumentBeforeChange: any;
};
