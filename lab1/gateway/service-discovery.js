import path from 'path';
import grpc from '@grpc/grpc-js';
import { loadSync } from '@grpc/proto-loader';

const __filename = new URL(import.meta.url).pathname;
const protoDir = path.dirname(__filename);
const packageDefinition = loadSync(path.resolve(protoDir, '../protobufs/registration.proto'), { keepCase: true });
const services = grpc.loadPackageDefinition(packageDefinition);
const { RegistrationService } = services.registration;

// Initialize an object to track registered services
const registeredServices = {};
const deletedServices = {};

const serviceHeartbeats = {};
const HEARTBEAT_TIMEOUT = 6000;

const serviceLoad = {};
const CRITICAL_LOAD_THRESHOLD = 60;

// Implement the service registration function
function register(name, host, port) {
  registeredServices[name] = { host, port };
  console.log(`Service ${name} registered in the gateway`);
}

// Implement the service deregistration function
function deregister(service) {
  console.log(registeredServices[service]);
  delete registeredServices[service];
  console.log(registeredServices[service]);
  console.log(`Service ${service} deregistered from the gateway`);
}

// Function to re-register deleted services upon receiving heartbeats.
function reRegister(serviceName) {
  if (deletedServices[serviceName]) {
    registeredServices[serviceName] = deletedServices[serviceName];
    delete deletedServices[serviceName];
    console.log(`Service ${serviceName} re-registered due to received heartbeat.`);
  }
}

// Function to update service load
function updateLoad(serviceName, load) {
  if (!serviceLoad[serviceName]) {
    serviceLoad[serviceName] = 0;
  }
  serviceLoad[serviceName] = load;
  console.log(`Service ${serviceName} load updated: ${load}`);
}

// Function to check and raise an alert for critical load
function checkCriticalLoad(serviceName) {
  if (serviceLoad[serviceName] && serviceLoad[serviceName] > CRITICAL_LOAD_THRESHOLD) {
    console.error(`Critical load alert: Service ${serviceName} is overloaded! Load: ${serviceLoad[serviceName]}`);
  }
}

// Function to update service heartbeat
function updateHeartbeat(serviceName) {
  serviceHeartbeats[serviceName] = new Date();
  console.log(`Heartbeat received for service ${serviceName}`);
}

// Function to calculate the time since the last heartbeat for a service
function getTimeSinceLastHeartbeat(serviceName) {
  const lastHeartbeat = serviceHeartbeats[serviceName];
  if (lastHeartbeat) {
    const currentTime = new Date();
    const timeDiff = currentTime - lastHeartbeat;
    return timeDiff;
  } else {
    return null;
  }
}

// Function to check if a service is active based on the time since the last heartbeat
function isServiceActive(serviceName) {
  const timeSinceLastHeartbeat = getTimeSinceLastHeartbeat(serviceName);
  
  if (timeSinceLastHeartbeat === null) {
    console.log(`Service ${serviceName} has not sent a heartbeat.`);
  } else {
    console.log(`Time since last heartbeat for service ${serviceName}: ${timeSinceLastHeartbeat}ms`);
  }

  if (timeSinceLastHeartbeat !== null && timeSinceLastHeartbeat <= HEARTBEAT_TIMEOUT) {
    return true;
  } else {
    return false;
  }
}

// Function to periodically check the status of registered services
function checkServiceStatus() {
  setInterval(() => {
    const currentTime = new Date();

    for (const serviceName in registeredServices) {
      const isActive = isServiceActive(serviceName); // Check if the service is active based on heartbeat timeout
      if (!isActive) {
        console.log(`Service ${serviceName} is inactive.`);

        deletedServices[serviceName] = registeredServices[serviceName];
        deregister(serviceName)
        // console.log(`Service ${serviceName} deregistered due to inactivity.`);
      }
    }
  }, HEARTBEAT_TIMEOUT); // Check service status every 10 seconds (adjust as needed)
}

// Start checking service status
checkServiceStatus();

// Service function for registration
function RegisterService(call, callback) {
  const registrationInfo = call.request;
  register(registrationInfo.name, registrationInfo.host, registrationInfo.port);
  console.log(`Received registration: Name: ${registrationInfo.name}, Host: ${registrationInfo.host}, Port: ${registrationInfo.port}`);
  console.log(registeredServices);
  callback(null, {});
}

// Service function for de-registration
function DeregisterService(call, callback) {
  const deregistrationInfo = call.request;
  deregister(deregistrationInfo.service_name);
  console.log(`Received de-registration: Name: ${deregistrationInfo.service_name}, Host: ${deregistrationInfo.host}, Port: ${deregistrationInfo.port}`);
  callback(null, {});
}

// Service function for status updates
function UpdateServiceStatus(call, callback) {
  const request = call.request;
  const serviceName = request.service_name;

  updateLoad(serviceName, request.load);
  checkCriticalLoad(serviceName);
  callback(null, {});
}

// Service function for heartbeat updates
function UpdateServiceHeartbeat(call, callback) {
  const heartbeat = call.request;
  updateHeartbeat(heartbeat.service_name);
  reRegister(heartbeat.service_name);
  callback(null, {});
}

const server = new grpc.Server();

server.addService(RegistrationService.service, {
  RegisterService,
  DeregisterService,
  UpdateServiceStatus,
  UpdateServiceHeartbeat,
});

server.bindAsync('0.0.0.0:50053', grpc.ServerCredentials.createInsecure(), () => {
  console.log('Registration server running at http://0.0.0.0:50053');
  server.start();
});