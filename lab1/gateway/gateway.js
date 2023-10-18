import pLimit from 'p-limit';
import path from 'path';
import grpc from '@grpc/grpc-js';
import { loadSync } from '@grpc/proto-loader';
import express from 'express';
import bodyParser from 'body-parser';
import NodeCache from 'node-cache';

const app = express();
app.use(bodyParser.json());

const __filename = new URL(import.meta.url).pathname;
const protoDir = path.dirname(__filename);

// Load the proto files
const packageDefinition = loadSync([
  path.resolve(protoDir, '../protobufs/records.proto'),
  path.resolve(protoDir, '../protobufs/prescription.proto'),
], { keepCase: true });

// Create gRPC clients for internal communication
const services = grpc.loadPackageDefinition(packageDefinition);
const { RecordService } = services.records;
const { PrescriptionService } = services.prescription;

function createGRPCClient(service, host, credentials) {
  return new service(host, credentials);
}

const limit = pLimit(7); // Limit concurrency to 5 tasks
const cache = new NodeCache({ stdTTL: 300 }); // Cache data for 5 minutes

function invalidateCache(key, id) {
  const cacheKey = `${key}:${id}`;
  cache.del(cacheKey);
}

function grpcRequestWithTimeout(client, method, request, timeoutMilliseconds) {
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

function getFromCacheOrFetch(cache, cacheKey, fetchFunction) {
  const cachedResponse = cache.get(cacheKey);
  if (cachedResponse) {
    console.log(`Cache hit for ${cacheKey}`);
    return Promise.resolve(cachedResponse);
  }

  return fetchFunction().then((response) => {
    cache.set(cacheKey, response);
    return response;
  });
}

function handleRequestError(res, error) {
  console.error(`Request failed: ${error}`);
  res.status(500).json({ error: 'Internal Server Error' });
}

// Get a record by ID
app.get('/records/:record_id', (req, res) => {
  const { record_id } = req.params;
  const request = { record_id };
  const client = createGRPCClient(RecordService, 'localhost:50051', grpc.credentials.createInsecure());
  const timeoutMilliseconds = 1000; // 5 seconds
  const cacheKey = `getRecordInfo:${record_id}`;

  console.log(`Active tasks: ${limit.activeCount}`);
  console.log(`Pending tasks: ${limit.pendingCount}`);

  limit(() => getFromCacheOrFetch(cache, cacheKey, () =>
    grpcRequestWithTimeout(client, 'GetRecordInfo', request, timeoutMilliseconds)
  ))
    .then((response) => res.json(response))
    .catch((error) => handleRequestError(res, error));
});

// List records
app.get('/records', (req, res) => {
  const client = createGRPCClient(RecordService, 'localhost:50051', grpc.credentials.createInsecure());
  const timeoutMilliseconds = 5000; // 5 seconds

  console.log(`Active tasks: ${limit.activeCount}`);
  console.log(`Pending tasks: ${limit.pendingCount}`);

  limit(() => getFromCacheOrFetch(cache, 'listRecords', () =>
    grpcRequestWithTimeout(client, 'ListRecords', {}, timeoutMilliseconds)
  ))
    .then((response) => res.json(response))
    .catch((error) => handleRequestError(res, error));
});

// Create a new record
app.post('/records', (req, res) => {
  const { name, medical_history } = req.body;
  const client = createGRPCClient(RecordService, 'localhost:50051', grpc.credentials.createInsecure());
  const timeoutMilliseconds = 5000; // 5 seconds

  console.log(`Active tasks: ${limit.activeCount}`);
  console.log(`Pending tasks: ${limit.pendingCount}`);

  limit(() => grpcRequestWithTimeout(client, 'CreateRecord', { name, medical_history }, timeoutMilliseconds))
  .then((response) => {
    // Invalidate the cache for listRecords
    cache.del('listRecords');
    res.json(response);
  })
    .catch((error) => handleRequestError(res, error));
});

// Update a record
app.put('/records/:record_id', (req, res) => {
  const { record_id } = req.params;
  const { updated_medical_history } = req.body;
  const request = { record_id, updated_medical_history };
  const client = createGRPCClient(RecordService, 'localhost:50051', grpc.credentials.createInsecure());
  const timeoutMilliseconds = 5000; // 5 seconds
  const cacheKey = `updateRecordInfo:${record_id}`;

  console.log(`Active tasks: ${limit.activeCount}`);
  console.log(`Pending tasks: ${limit.pendingCount}`);

  limit(() => grpcRequestWithTimeout(client, 'UpdateRecordInfo', request, timeoutMilliseconds))
  .then((response) => {
    invalidateCache('getRecordInfo', record_id);
    res.json(response);
  })
    .catch((error) => handleRequestError(res, error));
});

// Delete a record
app.delete('/records/:record_id', (req, res) => {
  const { record_id } = req.params;
  const request = { record_id };
  const client = createGRPCClient(RecordService, 'localhost:50051', grpc.credentials.createInsecure());
  const timeoutMilliseconds = 5000; // 5 seconds
  const cacheKey = `deleteRecord:${record_id}`;

  console.log(`Active tasks: ${limit.activeCount}`);
  console.log(`Pending tasks: ${limit.pendingCount}`);

  limit(() => grpcRequestWithTimeout(client, 'DeleteRecord', request, timeoutMilliseconds))
    .then(() => {
      console.log(`Successfully deleted record with ID: ${record_id}`);
      invalidateCache('getRecordInfo', record_id);
      res.json(`Successfully deleted record with ID: ${record_id}`);
    })
    .catch((error) => handleRequestError(res, error));
});

app.post('/prescriptions', (req, res) => {
  const { medication } = req.body;
  const request = { medication };
  const client = createGRPCClient(PrescriptionService, 'localhost:50052', grpc.credentials.createInsecure());
  const timeoutMilliseconds = 5000; // 5 seconds

  console.log(`Active tasks: ${limit.activeCount}`);
  console.log(`Pending tasks: ${limit.pendingCount}`);

  limit(() => grpcRequestWithTimeout(client, 'CreatePrescription', request, timeoutMilliseconds))
    .then((response) => res.json(response))
    .catch((error) => handleRequestError(res, error));
});

app.get('/prescriptions/:prescription_id', (req, res) => {
  const { prescription_id } = req.params;
  const request = { prescription_id };
  const client = createGRPCClient(PrescriptionService, 'localhost:50052', grpc.credentials.createInsecure());
  const timeoutMilliseconds = 100; // 5 seconds
  const cacheKey = `getPrescription:${prescription_id}`;

  console.log(`Active tasks: ${limit.activeCount}`);
  console.log(`Pending tasks: ${limit.pendingCount}`);

  limit(() => getFromCacheOrFetch(cache, cacheKey, () =>
    grpcRequestWithTimeout(client, 'GetPrescription', request, timeoutMilliseconds)
  ))
    .then((response) => res.json(response))
    .catch((error) => handleRequestError(res, error));
});

app.put('/prescriptions/:prescription_id', (req, res) => {
  const { prescription_id } = req.params;
  const { updated_medication } = req.body;
  const request = { prescription_id, updated_medication };
  const client = createGRPCClient(PrescriptionService, 'localhost:50052', grpc.credentials.createInsecure());
  const timeoutMilliseconds = 5000; // 5 seconds

  console.log(`Active tasks: ${limit.activeCount}`);
  console.log(`Pending tasks: ${limit.pendingCount}`);

  limit(() => grpcRequestWithTimeout(client, 'UpdatePrescription', request, timeoutMilliseconds))
  .then((response) => {
    invalidateCache('getPrescription', prescription_id);
    res.json(response);
  })
    .catch((error) => handleRequestError(res, error));
});

app.delete('/prescriptions/:prescription_id', (req, res) => {
  const { prescription_id } = req.params;
  const request = { prescription_id };
  const client = createGRPCClient(PrescriptionService, 'localhost:50052', grpc.credentials.createInsecure());
  const timeoutMilliseconds = 5000; // 5 seconds

  console.log(`Active tasks: ${limit.activeCount}`);
  console.log(`Pending tasks: ${limit.pendingCount}`);

  limit(() => grpcRequestWithTimeout(client, 'DeletePrescription', request, timeoutMilliseconds))
    .then(() => {
      console.log(`Successfully deleted prescription with ID: ${prescription_id}`);
      invalidateCache('getPrescription', prescription_id);
      res.json(`Successfully deleted prescription with ID: ${prescription_id}`);
    })
    .catch((error) => handleRequestError(res, error));
});

// Start the HTTP server for the client
const gatewayPort = 8080;
app.listen(gatewayPort, () => {
  console.log(`Gateway server is running on port ${gatewayPort}`);
});
