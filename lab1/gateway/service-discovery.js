import path from 'path';
import grpc from '@grpc/grpc-js';
import { loadSync } from '@grpc/proto-loader';
import dotenv from 'dotenv';

dotenv.config();
const PORT = parseInt(process.env.SERVICE_DISCOVERY_PORT);


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
  if(!deletedServices[`${name}:${port}`]){
    registeredServices[`${name}:${port}`] = { host, port };
    console.log(`Service ${name}:${port} registered in the gateway`);
  } else {
    reRegister(name, port);
  }
}

// Implement the service deregistration function
function deregister(serviceInstance) {
  delete registeredServices[serviceInstance];
  console.log(`Service ${serviceInstance} deregistered from the gateway`);
}

// Function to re-register deleted services upon receiving heartbeats.
function reRegister(serviceName, port) {
  if (deletedServices[`${serviceName}:${port}`]) {
    registeredServices[`${serviceName}:${port}`] = deletedServices[`${serviceName}:${port}`];
    delete deletedServices[`${serviceName}:${port}`];
    console.log(`Service ${serviceName}:${port} re-registered due to received heartbeat.`);
  }
}

// Function to update service load
function updateLoad(serviceName, port, load) {
  if (!serviceLoad[`${serviceName}:${port}`]) {
    serviceLoad[`${serviceName}:${port}`] = 0;
  }
  serviceLoad[`${serviceName}:${port}`] = load;
  console.log(`Service ${serviceName}:${port} load updated: ${load}`);
}

// Function to check and raise an alert for critical load
function checkCriticalLoad(serviceName, port) {
  if (serviceLoad[`${serviceName}:${port}`] && serviceLoad[`${serviceName}:${port}`] > CRITICAL_LOAD_THRESHOLD) {
    console.error(`Critical load alert: Service ${serviceName}:${port} is overloaded! Load: ${serviceLoad[`${serviceName}:${port}`]}`);
  }
}

// Function to update service heartbeat
function updateHeartbeat(serviceName, port) {
  if (!serviceHeartbeats[`${serviceName}:${port}`]) {
    serviceHeartbeats[`${serviceName}:${port}`] = {};
  }
  serviceHeartbeats[`${serviceName}:${port}`] = new Date();
  // console.log(serviceHeartbeats);
  console.log(`Heartbeat received for service ${serviceName}:${port}`);
}

// Function to calculate the time since the last heartbeat for a service
function getTimeSinceLastHeartbeat(serviceInstance) {
  console.log(serviceInstance);
  const lastHeartbeat = serviceHeartbeats[serviceInstance];
  if (lastHeartbeat) {
    const currentTime = new Date();
    const timeDiff = currentTime - lastHeartbeat;
    return timeDiff;
  } else {
    return null;
  }
}

// Function to check if a service is active based on the time since the last heartbeat
function isServiceActive(serviceInstance) {
  const timeSinceLastHeartbeat = getTimeSinceLastHeartbeat(serviceInstance);
  
  // if (timeSinceLastHeartbeat === null) {
  //   console.log(`Service ${serviceInstance} has not sent a heartbeat.`);
  // } else {
  //   console.log(`Time since last heartbeat for service ${serviceInstance}: ${timeSinceLastHeartbeat}ms`);
  // }

  if (timeSinceLastHeartbeat !== null && timeSinceLastHeartbeat <= HEARTBEAT_TIMEOUT) {
    console.log(`Time since last heartbeat for service ${serviceInstance}: ${timeSinceLastHeartbeat}ms`);
    return true;
  } else {
    console.log(`Service ${serviceInstance} has not sent a heartbeat.`);
    return false;
  }
}

// Function to periodically check the status of registered services
function checkServiceStatus() {
  setInterval(() => {
    const currentTime = new Date();
    if(registeredServices){
      for (const serviceInstance in registeredServices) {
        const isActive = isServiceActive(serviceInstance);
        if (!isActive) {
          console.log(`Service ${serviceInstance} is inactive.`);

          deletedServices[serviceInstance] = registeredServices[serviceInstance];
          deregister(serviceInstance)
          // console.log(`Service ${serviceInstance} deregistered due to inactivity.`);
        }
      }
    }
  }, HEARTBEAT_TIMEOUT);
}

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
  // const serviceName = request.service_name;
  // console.log(request.load);
  updateLoad(request.service_name, request.port, request.load);
  checkCriticalLoad(request.service_name, request.port);
  callback(null, {});
}

// Service function for heartbeat updates
function UpdateServiceHeartbeat(call, callback) {
  const heartbeat = call.request;
  updateHeartbeat(heartbeat.service_name, heartbeat.port);
  reRegister(heartbeat.service_name, heartbeat.port);
  callback(null, {});
}

// Service function to send the list of registered services
function ListRegisteredServices(call, callback) {
  console.log(registeredServices);
  const servicesList = Object.keys(registeredServices).map((name) => ({
    name,
    host: registeredServices[name].host,
    port: registeredServices[name].port,
    load: serviceLoad[name] || 0,
  }));
  
  const response = {
    services: servicesList,
  };
  console.log(response);
  
  callback(null, response);
}

const server = new grpc.Server();

server.addService(RegistrationService.service, {
  RegisterService,
  DeregisterService,
  UpdateServiceStatus,
  UpdateServiceHeartbeat,
  ListRegisteredServices,
});

server.bindAsync(`0.0.0.0:${PORT}`, grpc.ServerCredentials.createInsecure(), () => {
  console.log(`Registration server running at http://0.0.0.0:${PORT}`);
  server.start();
});

checkServiceStatus();
