import pLimit from 'p-limit';
import path from 'path';
import grpc from '@grpc/grpc-js';
import { loadSync } from '@grpc/proto-loader';
import express from 'express';
import bodyParser from 'body-parser';
import NodeCache from 'node-cache';
import dotenv from 'dotenv';
import Memcached from 'memcached';
import HashRing from 'hashring';

dotenv.config();
const PORT = process.env.GATEWAY_PORT;

const SERVICE_DISCOVERY_HOSTNAME = process.env.SERVICE_DISCOVERY_HOSTNAME;
const SERVICE_DISCOVERY_PORT = process.env.SERVICE_DISCOVERY_PORT;
const SERVICE_DISCOVERY_URL = `${SERVICE_DISCOVERY_HOSTNAME}:${SERVICE_DISCOVERY_PORT}`;

const limit = pLimit(7); // Limit concurrency to 7 tasks
// const cache = new NodeCache({ stdTTL: 300 }); // Cache data for 5 minutes
const MAX_ERROR_NUMBER = 3; // Maximum allowed errors before removing a service
const errorCounts = {}; // Object to track error counts for each service

const MEMCACHED_PORT = process.env.MEMCACHED_PORT;
const MEMCACHED_HOSTNAMES = process.env.MEMCACHED_HOSTNAMES.split(',');

const memcachedServers = MEMCACHED_HOSTNAMES.map((host) => `${host}:${MEMCACHED_PORT}`);
// const memcachedServers = ['memcached1.local:11211', 'memcached2.local:11211', 'memcached3.local:11211'];
// console.log(`Memcached servers: ${memcachedServers}`);

// Create a hash ring for consistent hashing
const hashRing = new HashRing(memcachedServers);

// Function to get the Memcached server for a key
function getMemcachedServerForKey(key) {
  return hashRing.get(key);
}

// Function to create a Memcached client for a specific server
function createMemcachedClient(server) {
  console.log(`Creating Memcached client for server: ${server}`);
  return new Memcached(server);
}

// Function to set data in the cache with consistent hashing
function setInCacheWithConsistentHashing(key, value, ttlInSeconds) {
  const memcachedServer = getMemcachedServerForKey(key);
  const memcachedClient = createMemcachedClient(memcachedServer);

  memcachedClient.set(key, value, ttlInSeconds, (err) => {
    if (err) {
      console.error(`Error setting data in cache on server ${memcachedServer}:`, err);
    } else {
      console.log(`Data set successfully in cache on server ${memcachedServer} for key: ${key}`);
    }
  });
}

// Function to get data from the cache with consistent hashing
function getFromCacheWithConsistentHashing(key, callback) {
  const memcachedServer = getMemcachedServerForKey(key);
  const memcachedClient = createMemcachedClient(memcachedServer);

  memcachedClient.get(key, (err, data) => {
    if (err) {
      console.error(`Error getting data from cache on server ${memcachedServer}:`, err);
      callback(err, null);
    } else if (data === undefined || data === null) {
      console.log(`Data not found in cache on server ${memcachedServer} for key: ${key}`);
      callback(null, null);
    } else {
      console.log(`Data retrieved successfully from cache on server ${memcachedServer} for key: ${key}`);
      callback(null, data);
    }
  });
}

// Function to delete data from the cache with consistent hashing
function deleteFromCacheWithConsistentHashing(key) {
  const memcachedServer = getMemcachedServerForKey(key);
  const memcachedClient = createMemcachedClient(memcachedServer);

  memcachedClient.del(key, (err) => {
    if (err) {
      console.error(`Error deleting data from cache on server ${memcachedServer} for key: ${key}`, err);
    } else {
      console.log(`Data deleted successfully from cache on server ${memcachedServer} for key: ${key}`);
    }
  });
}

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

// function invalidateCache(key, id) {
//   const cacheKey = `${key}:${id}`;
//   cache.del(cacheKey);
// }

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

// function getFromCacheOrFetch(cache, cacheKey, fetchFunction) {
//   const cachedResponse = cache.get(cacheKey);
//   if (cachedResponse) {
//     console.log(`Cache hit for ${cacheKey}`);
//     return Promise.resolve(cachedResponse);
//   }

//   return fetchFunction().then((response) => {
//     cache.set(cacheKey, response);
//     return response;
//   });
// }

function getFromCacheOrFetchWithConsistentHashing(cacheKey, fetchFunction) {
  return new Promise((resolve, reject) => {
    getFromCacheWithConsistentHashing(cacheKey, (err, cachedResponse) => {
      if (cachedResponse) {
        resolve(cachedResponse);
      } else {
        fetchFunction()
          .then((response) => {
            setInCacheWithConsistentHashing(cacheKey, response, 300); // Cache for 5 minutes
            resolve(response);
          })
          .catch((error) => reject(error));
      }
    });
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

        limit(() => getFromCacheOrFetchWithConsistentHashing(cacheKey, () =>
          grpcRequestWithTimeout(client, 'GetRecordInfo', { record_id }, timeoutMilliseconds)
        ))
          .then((response) => {
            console.log(`Active tasks: ${limit.activeCount}`);
            console.log(`Pending tasks: ${limit.pendingCount}`);
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

        limit(() => getFromCacheOrFetchWithConsistentHashing('listRecords', () =>
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
          deleteFromCacheWithConsistentHashing('listRecords');
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
          deleteFromCacheWithConsistentHashing(`getRecordInfo:${record_id}`);
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
            deleteFromCacheWithConsistentHashing(`getRecordInfo:${record_id}`);
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

        limit(() => getFromCacheOrFetchWithConsistentHashing(cacheKey, () =>
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
          deleteFromCacheWithConsistentHashing(`getPrescription:${prescription_id}`);
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
            deleteFromCacheWithConsistentHashing(`getPrescription:${prescription_id}`);
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
