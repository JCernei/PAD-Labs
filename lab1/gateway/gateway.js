import pLimit from 'p-limit';
import path from 'path';
import grpc from '@grpc/grpc-js';
import { loadSync } from '@grpc/proto-loader';
import express from 'express';
import bodyParser from 'body-parser';
import NodeCache from 'node-cache';
import dotenv from 'dotenv';

dotenv.config();
const PORT = process.env.GATEWAY_PORT;
const SERVICE_DISCOVERY_URL = process.env.SERVICE_DISCOVERY_URL;
const RECORDS_SERVICE_URL = process.env.RECORDS_SERVICE_URL;
const PRESCRIPTION_SERVICE_URL = process.env.PRESCRIPTION_SERVICE_URL;

const limit = pLimit(7); // Limit concurrency to 7 tasks
const cache = new NodeCache({ stdTTL: 300 }); // Cache data for 5 minutes
const MAX_ERROR_NUMBER = 3; // Maximum allowed errors before removing a service
const errorCounts = {}; // Object to track error counts for each service

const app = express();
app.use(bodyParser.json());

const __filename = new URL(import.meta.url).pathname;
const protoDir = path.dirname(__filename);

// Load the proto files
const packageDefinition = loadSync([
  path.resolve(protoDir, '../protobufs/records.proto'),
  path.resolve(protoDir, '../protobufs/prescription.proto'),
  path.resolve(protoDir, '../protobufs/registration.proto'),
], { keepCase: true });

// Create gRPC clients for internal communication
const services = grpc.loadPackageDefinition(packageDefinition);
const { RecordService } = services.records;
const { PrescriptionService } = services.prescription;
const { RegistrationService } = services.registration;

function createGRPCClient(service, host, credentials) {
  return new service(host, credentials);
}


function invalidateCache(key, id) {
  const cacheKey = `${key}:${id}`;
  cache.del(cacheKey);
}


const discoveryClient = createGRPCClient(RegistrationService, SERVICE_DISCOVERY_URL, grpc.credentials.createInsecure());

let registeredServices = [];
// Function to list registered services
function listRegisteredServices() {
  return new Promise((resolve, reject) => {
    discoveryClient.ListRegisteredServices({}, (error, response) => {
      if (error) {
        reject(error);
      } else {
        registeredServices = response.services;
        resolve(response.services);
      }
    });
  });
}

function selectService(services, serviceType) {
  let selectedService = null;
  let minLoad = Infinity;

  for (const service of services) {
    
    if (errorCounts[service.name] >= MAX_ERROR_NUMBER) {
      discoveryClient.DeRegister()
      continue; 
    }

    if (service.name.startsWith(serviceType) && service.load < minLoad) {
      selectedService = service;
      minLoad = service.load;
    }
  }

  return selectedService;
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

function handleRequestError(res, error, service, taskTimeoutLimit) {
  console.error(`Request failed for service ${service.name}: ${error}`);
  res.status(500).json({ error: 'Internal Server Error' });

  // Increment the error count for the service
  errorCounts[service.name] = (errorCounts[service.name] || 0) + 1;

  // Check if the error threshold is reached for this service after a delay
  setTimeout(() => {
    if (errorCounts[service.name] >= MAX_ERROR_NUMBER) {
      // Remove the service from the list of registered services
      registeredServices = registeredServices.filter((s) => s.name !== service.name);
      console.log(`Service ${service.name} removed due to too many errors.`);
    }
    else{
      errorCounts[service.name] = 0;
    }
  }, 3.5 * taskTimeoutLimit);
}

app.get('/records/:record_id', (req, res) => {
  listRegisteredServices()
    .then((services) => {
      const { record_id } = req.params;
      const requestPath = req.path.split('/')[1];
      const selectedService = selectService(services, requestPath);
      if (selectedService) {
        const { host, port } = selectedService;
        const client = createGRPCClient(RecordService, `${host}:${port}`, grpc.credentials.createInsecure());
        const timeoutMilliseconds = 5000;
        const cacheKey = `getRecordInfo:${record_id}`;

        limit(() => getFromCacheOrFetch(cache, cacheKey, () =>
          grpcRequestWithTimeout(client, 'GetRecordInfo', { record_id }, timeoutMilliseconds)
        ))
          .then((response) => {
            res.json(response);
          })
          .catch((error) => handleRequestError(res, error, selectedService, timeoutMilliseconds));
      } else {
        res.status(500).json({ error: 'No available service for the request' });
      }
    })
    .catch((error) => {
      console.error('Failed to retrieve registered services:', error);
      res.status(500).json({ error: 'Failed to retrieve registered services' });
    });
});

// List records
app.get('/records', (req, res) => {
  listRegisteredServices()
    .then((services) => {
      const requestPath = req.path.split('/')[1];
      const selectedService = selectService(services, requestPath);
      if (selectedService) {
        const { host, port } = selectedService;
        const client = createGRPCClient(RecordService, `${host}:${port}`, grpc.credentials.createInsecure());
        const timeoutMilliseconds = 5000; // 5 seconds

        console.log(`Active tasks: ${limit.activeCount}`);
        console.log(`Pending tasks: ${limit.pendingCount}`);

        limit(() => getFromCacheOrFetch(cache, 'listRecords', () =>
          grpcRequestWithTimeout(client, 'ListRecords', {}, timeoutMilliseconds)
        ))
          .then((response) => res.json(response))
          .catch((error) => handleRequestError(res, error, selectedService, timeoutMilliseconds));
      } else {
        res.status(500).json({ error: 'No available service for the request' });
      }
    })
    .catch((error) => {
      console.error('Failed to retrieve registered services:', error);
      res.status(500).json({ error: 'Failed to retrieve registered services' });
    });
});

// Create a new record
app.post('/records', (req, res) => {
  listRegisteredServices()
    .then((services) => {
      const { name, medical_history } = req.body;
      const requestPath = req.path.split('/')[1];
      const selectedService = selectService(services, requestPath);
      if (selectedService) {
        const { host, port } = selectedService;
        const client = createGRPCClient(RecordService, `${host}:${port}`, grpc.credentials.createInsecure());
        const timeoutMilliseconds = 5000; // 5 seconds

        console.log(`Active tasks: ${limit.activeCount}`);
        console.log(`Pending tasks: ${limit.pendingCount}`);

        limit(() => grpcRequestWithTimeout(client, 'CreateRecord', { name, medical_history }, timeoutMilliseconds))
        .then((response) => {
          // Invalidate the cache for listRecords
          cache.del('listRecords');
          res.json(response);
        })
          .catch((error) => handleRequestError(res, error, selectedService, timeoutMilliseconds));
      } else {
        res.status(500).json({ error: 'No available service for the request' });
      }
    })
    .catch((error) => {
      console.error('Failed to retrieve registered services:', error);
      res.status(500).json({ error: 'Failed to retrieve registered services' });
    });
});

// Update a record
app.put('/records/:record_id', (req, res) => {
  listRegisteredServices()
    .then((services) => {
      const { record_id } = req.params;
      const { updated_medical_history } = req.body;
      const request = { record_id, updated_medical_history };
      const requestPath = req.path.split('/')[1];
      const selectedService = selectService(services, requestPath);
      if (selectedService) {
        const { host, port } = selectedService;
        const client = createGRPCClient(RecordService, `${host}:${port}`, grpc.credentials.createInsecure());
        const timeoutMilliseconds = 5000; // 5 seconds
        const cacheKey = `updateRecordInfo:${record_id}`;

        console.log(`Active tasks: ${limit.activeCount}`);
        console.log(`Pending tasks: ${limit.pendingCount}`);

        limit(() => grpcRequestWithTimeout(client, 'UpdateRecordInfo', request, timeoutMilliseconds))
        .then((response) => {
          invalidateCache('getRecordInfo', record_id);
          res.json(response);
        })
          .catch((error) => handleRequestError(res, error, selectedService, timeoutMilliseconds));
      } else {
        res.status(500).json({ error: 'No available service for the request' });
      }
    })
    .catch((error) => {
      console.error('Failed to retrieve registered services:', error);
      res.status(500).json({ error: 'Failed to retrieve registered services' });
    });
});

// Delete a record
app.delete('/records/:record_id', (req, res) => {
  listRegisteredServices()
    .then((services) => {
      const { record_id } = req.params;
      const request = { record_id };
      const requestPath = req.path.split('/')[1];
      const selectedService = selectService(services, requestPath);
      if (selectedService) {
        const { host, port } = selectedService;
        const client = createGRPCClient(RecordService, `${host}:${port}`, grpc.credentials.createInsecure());
        const timeoutMilliseconds = 5000; // 5 seconds
        // const cacheKey = `deleteRecord:${record_id}`;

        console.log(`Active tasks: ${limit.activeCount}`);
        console.log(`Pending tasks: ${limit.pendingCount}`);

        limit(() => grpcRequestWithTimeout(client, 'DeleteRecord', request, timeoutMilliseconds))
          .then(() => {
            console.log(`Successfully deleted record with ID: ${record_id}`);
            invalidateCache('getRecordInfo', record_id);
            res.json(`Successfully deleted record with ID: ${record_id}`);
          })
          .catch((error) => handleRequestError(res, error, selectedService, timeoutMilliseconds));
      } else {
        res.status(500).json({ error: 'No available service for the request' });
      }
    })
    .catch((error) => {
      console.error('Failed to retrieve registered services:', error);
      res.status(500).json({ error: 'Failed to retrieve registered services' });
    });
});

app.post('/prescriptions', (req, res) => {
  listRegisteredServices()
    .then((services) => {
      const { medication } = req.body;
      const request = { medication };
      const requestPath = req.path.split('/')[1];
      const selectedService = selectService(services, requestPath);
      if (selectedService) {
        const { host, port } = selectedService;
        const client = createGRPCClient(PrescriptionService, `${host}:${port}`, grpc.credentials.createInsecure());
        const timeoutMilliseconds = 5000; // 5 seconds

        console.log(`Active tasks: ${limit.activeCount}`);
        console.log(`Pending tasks: ${limit.pendingCount}`);

        limit(() => grpcRequestWithTimeout(client, 'CreatePrescription', request, timeoutMilliseconds))
          .then((response) => res.json(response))
          .catch((error) => handleRequestError(res, error, selectedService, timeoutMilliseconds));
      } else {
        res.status(500).json({ error: 'No available service for the request' });
      }
    })
    .catch((error) => {
      console.error('Failed to retrieve registered services:', error);
      res.status(500).json({ error: 'Failed to retrieve registered services' });
    });
});

app.get('/prescriptions/:prescription_id', (req, res) => {
  listRegisteredServices()
    .then((services) => {
      const { prescription_id } = req.params;
      const request = { prescription_id };
      const requestPath = req.path.split('/')[1];
      const selectedService = selectService(services, requestPath);
      if (selectedService) {
        const { host, port } = selectedService;
        const client = createGRPCClient(PrescriptionService, `${host}:${port}`, grpc.credentials.createInsecure());
        const timeoutMilliseconds = 100; // 5 seconds
        const cacheKey = `getPrescription:${prescription_id}`;

        console.log(`Active tasks: ${limit.activeCount}`);
        console.log(`Pending tasks: ${limit.pendingCount}`);

        limit(() => getFromCacheOrFetch(cache, cacheKey, () =>
          grpcRequestWithTimeout(client, 'GetPrescription', request, timeoutMilliseconds)
        ))
          .then((response) => res.json(response))
          .catch((error) => handleRequestError(res, error, selectedService, timeoutMilliseconds));
      } else {
        res.status(500).json({ error: 'No available service for the request' });
      }
    })
    .catch((error) => {
      console.error('Failed to retrieve registered services:', error);
      res.status(500).json({ error: 'Failed to retrieve registered services' });
    });
});

app.put('/prescriptions/:prescription_id', (req, res) => {
  listRegisteredServices()
    .then((services) => {
      const { prescription_id } = req.params;
      const { updated_medication } = req.body;
      const request = { prescription_id, updated_medication };
      const requestPath = req.path.split('/')[1];
      const selectedService = selectService(services, requestPath);
      if (selectedService) {
        const { host, port } = selectedService;
        const client = createGRPCClient(PrescriptionService, `${host}:${port}`, grpc.credentials.createInsecure());
        const timeoutMilliseconds = 5000; // 5 seconds

        console.log(`Active tasks: ${limit.activeCount}`);
        console.log(`Pending tasks: ${limit.pendingCount}`);

        limit(() => grpcRequestWithTimeout(client, 'UpdatePrescription', request, timeoutMilliseconds))
        .then((response) => {
          invalidateCache('getPrescription', prescription_id);
          res.json(response);
        })
          .catch((error) => handleRequestError(res, error, selectedService, timeoutMilliseconds));
      } else {
        res.status(500).json({ error: 'No available service for the request' });
      }
    })
    .catch((error) => {
      console.error('Failed to retrieve registered services:', error);
      res.status(500).json({ error: 'Failed to retrieve registered services' });
    });
});

app.delete('/prescriptions/:prescription_id', (req, res) => {
  listRegisteredServices()
    .then((services) => {
      const { prescription_id } = req.params;
      const request = { prescription_id };
      const requestPath = req.path.split('/')[1];
      const selectedService = selectService(services, requestPath);
      if (selectedService) {
        const { host, port } = selectedService;
        const client = createGRPCClient(PrescriptionService, `${host}:${port}`, grpc.credentials.createInsecure());
        const timeoutMilliseconds = 5000; // 5 seconds

        console.log(`Active tasks: ${limit.activeCount}`);
        console.log(`Pending tasks: ${limit.pendingCount}`);

        limit(() => grpcRequestWithTimeout(client, 'DeletePrescription', request, timeoutMilliseconds))
          .then(() => {
            console.log(`Successfully deleted prescription with ID: ${prescription_id}`);
            invalidateCache('getPrescription', prescription_id);
            res.json(`Successfully deleted prescription with ID: ${prescription_id}`);
          })
          .catch((error) => handleRequestError(res, error, selectedService, timeoutMilliseconds));
      } else {
        res.status(500).json({ error: 'No available service for the request' });
      }
    })
    .catch((error) => {
      console.error('Failed to retrieve registered services:', error);
      res.status(500).json({ error: 'Failed to retrieve registered services' });
    });
});

// Define a status route for the gateway
app.get('/gateway/status', (req, res) => {
  const gatewayStatus = { status: 'OK' }; // You can customize this based on your needs.
  res.json(gatewayStatus);
});

// Start the HTTP server for the client
app.listen(PORT, () => {
  console.log(`Gateway server is running on port ${PORT}`);
});
