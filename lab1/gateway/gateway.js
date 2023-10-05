const path = require('path');
const grpc = require('@grpc/grpc-js');
const { loadSync } = require('@grpc/proto-loader');
const express = require('express');
const bodyParser = require('body-parser');
const NodeCache = require('node-cache');

const cache = new NodeCache({ stdTTL: 300 }); // Cache data for 5 minutes

const app = express();
app.use(bodyParser.json());

// Load the proto files
const packageDefinition = loadSync([
  path.resolve(__dirname, '../protobufs/records.proto'),
  path.resolve(__dirname, '../protobufs/prescription.proto'),
], {keepCase: true});

// Create gRPC clients for internal communication
var services = grpc.loadPackageDefinition(packageDefinition);
const recordsService = services.records;
const prescriptionService = services.prescription;

// Define a function to wrap gRPC calls with a timeout
function wrapWithTimeout(client, method, request, timeoutMilliseconds) {
  return new Promise((resolve, reject) => {
    const deadline = new Date(Date.now() + timeoutMilliseconds);

    client[method](request, { deadline }, (error, response) => {
      if (error) {
        console.error(error.details);
        reject(error.details);
      } else {
        console.log(`Received gRPC response for ${method}: ${JSON.stringify(response)}`);
        resolve(response);
      }
    });
  });
}

function wrapWithTimeoutAndCache(client, method, request, timeoutMilliseconds, cacheKey) {
  const cachedResponse = cache.get(cacheKey);
  if (cachedResponse) {
    console.log(`Cache hit for ${cacheKey}`);
    return Promise.resolve(cachedResponse);
  }

  return new Promise((resolve, reject) => {
    const deadline = new Date(Date.now() + timeoutMilliseconds);

    client[method](request, { deadline }, (error, response) => {
      if (error) {
        console.error(error.details);
        reject(error.details);
      } else {
        console.log(`Received gRPC response for ${method}: ${JSON.stringify(response)}`);
        cache.set(cacheKey, response);
        resolve(response);
      }
    });
  });
}

// Get a record by ID
app.get('/records/:record_id', (req, res) => {
  const { record_id } = req.params;
  const request = { record_id };
  const client = new recordsService.RecordService('localhost:50051', grpc.credentials.createInsecure());
  const timeoutMilliseconds = 100; // 5 seconds
  const cacheKey = `getRecordInfo:${record_id}`;

  wrapWithTimeoutAndCache(client, 'GetRecordInfo', request, timeoutMilliseconds, cacheKey)
    .then((response) => res.json(response))
    .catch((error) => {
      console.error(`Request for getRecordInfo failed: ${error}`);
      res.status(500).json({ error: 'Internal Server Error' });
    });
});

// List records
app.get('/records', (req, res) => {
  const client = new recordsService.RecordService('localhost:50051', grpc.credentials.createInsecure());
  const timeoutMilliseconds = 5000; // 5 seconds
  // const cacheKey = '';

  wrapWithTimeoutAndCache(client, 'ListRecords', {}, timeoutMilliseconds, cacheKey)
    .then((response) => res.json(response))
    .catch((error) => {
      console.error(`Request for listRecords failed: ${error}`);
      res.status(500).json({ error: 'Internal Server Error' });
    });
});

// Create a new record
app.post('/records', (req, res) => {
  const { name, medical_history } = req.body;
  const client = new recordsService.RecordService('localhost:50051', grpc.credentials.createInsecure());
  const timeoutMilliseconds = 5000; // 5 seconds
  // const cacheKey = 'createRecord';

  wrapWithTimeout(client, 'CreateRecord', { name, medical_history }, timeoutMilliseconds)
    .then((response) => res.json(response))
    .catch((error) => {
      console.error(`Request for createRecord failed: ${error}`);
      res.status(500).json({ error: 'Internal Server Error' });
    });
});

// Update a record
app.put('/records/:record_id', (req, res) => {
  const { record_id } = req.params;
  const { updated_medical_history } = req.body;
  const client = new recordsService.RecordService('localhost:50051', grpc.credentials.createInsecure());
  const timeoutMilliseconds = 5000; // 5 seconds
  // const cacheKey = `updateRecordInfo:${record_id}`;

  wrapWithTimeout(client, 'UpdateRecordInfo', { record_id, updated_medical_history }, timeoutMilliseconds)
    .then((response) => res.json(response))
    .catch((error) => {
      console.error(`Request for updateRecordInfo failed: ${error}`);
      res.status(500).json({ error: 'Internal Server Error' });
    });
});

// Delete a record
app.delete('/records/:record_id', (req, res) => {
  const { record_id } = req.params;
  const client = new recordsService.RecordService('localhost:50051', grpc.credentials.createInsecure());
  const timeoutMilliseconds = 5000; // 5 seconds
  // const cacheKey = `deleteRecord:${record_id}`;

  wrapWithTimeout(client, 'DeleteRecord', { record_id }, timeoutMilliseconds)
    .then(() => {
      console.log(`Successfully deleted record with ID: ${record_id}`);
      res.json(`Successfully deleted record with ID: ${record_id}`);
    })
    .catch((error) => {
      console.error(`Request for deleteRecord failed: ${error}`);
      res.status(500).json({ error: 'Internal Server Error' });
    });
});

app.post('/prescriptions', (req, res) => {
  const { medication } = req.body;
  const request = { medication };
  const client = new prescriptionService.PrescriptionService('localhost:50052', grpc.credentials.createInsecure());
  const timeoutMilliseconds = 5000; // 5 seconds

  wrapWithTimeout(client, 'CreatePrescription', request, timeoutMilliseconds)
  .then((response) => res.json(response))
  .catch((error) => {
    console.error(`Request for createPrescription failed: ${error}`);
    res.status(500).json({ error: 'Internal Server Error' });
  });
});

app.get('/prescriptions/:prescription_id', (req, res) => {
  const { prescription_id } = req.params;
  const request = { prescription_id };
  const client = new prescriptionService.PrescriptionService('localhost:50052', grpc.credentials.createInsecure());
  const timeoutMilliseconds = 100; // 5 seconds
  const cacheKey = `getPrescription:${prescription_id}`;

  wrapWithTimeoutAndCache(client, 'GetPrescription', request, timeoutMilliseconds, cacheKey)
    .then((response) => res.json(response))
    .catch((error) => {
      console.error(`Request for getPrescription failed: ${error}`);
      res.status(500).json({ error: 'Internal Server Error' });
    });
});

app.put('/prescriptions/:prescription_id', (req, res) => {
  const { prescription_id } = req.params;
  const { updated_medication } = req.body;
  const request = { prescription_id, updated_medication };
  const client = new prescriptionService.PrescriptionService('localhost:50052', grpc.credentials.createInsecure());
  const timeoutMilliseconds = 5000; // 5 seconds
  
  wrapWithTimeout(client, 'UpdatePrescription', request, timeoutMilliseconds)
    .then((response) => res.json(response))
    .catch((error) => {
      console.error(`Request for updatePrescription failed: ${error}`);
      res.status(500).json({ error: 'Internal Server Error' });
    });
});

app.delete('/prescriptions/:prescription_id', (req, res) => {
  const { prescription_id } = req.params;
  const request = { prescription_id };
  const client = new prescriptionService.PrescriptionService('localhost:50052', grpc.credentials.createInsecure());
  const timeoutMilliseconds = 5000; // 5 seconds

  wrapWithTimeout(client, 'DeletePrescription', request, timeoutMilliseconds)
    .then(() => {
      console.log(`Successfully deleted record with ID: ${record_id}`);
      res.json(`Successfully deleted prescription with ID: ${record_id}`);
    })
    .catch((error) => {
      console.error(`Request for deletePrescription failed: ${error}`);
      res.status(500).json({ error: 'Internal Server Error' });
    });
});


// Start the HTTP server for the client
const gatewayPort = 8080;
app.listen(gatewayPort, () => {
  console.log(`Gateway server is running on port ${gatewayPort}`);
});
